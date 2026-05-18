import { cardList } from "../data/cards.js";
import { speciesList } from "../data/species.js";
import { LOG_LIMIT } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { clearFieldGuide, loadFieldGuide } from "./storage.js";
import { BEHAVIOR_STATE_DISPLAY, getCurrentPhotoState, getRemainingDecisionCount } from "./photoSequence.js";
import { endGame, handleCatalogueAction, handleDistantListenAction, handleExploreAction, handleFirstEncounterAction, handlePhotoAction, handleSpotSelectAction, startGame, startGameAtSpot } from "./gameSession.js";
import { getSpeciesKnowledgeState } from "./fieldGuide.js";
import { createRarityBadgeHtml } from "./rarityDisplay.js";
import { getAllSpots, getCurrentSpot, getSurroundingSpotMap } from "./spotManager.js";
import { getFocusConfig, createFocusRuntime, evaluateFocus, getFocusAffixDisplay, getFocusAffixFromPosition, getFocusDistance, isInGreenZone } from "./focusEngine.js";
import { getFocusSequenceState } from "./focusSequence.js";

let gameState = createDefaultGameState();
let isSettlementRevealed = false;
let fieldGuideSpeciesIndex = 0;
let focusAnimationFrameId = null;
let focusRuntime = null;
let focusStartedAt = 0;
let latestFocusResult = null;
let latestFocusKey = "";
let focusEnterFrom = null;
let focusEnterCurve = null;
let focusEnterTarget = null;
let focusMotionStarted = false;
let focusActiveWindowStartedAt = 0;
let focusTimedOut = false;
let canShootCurrentFocus = false;
let latestVisibleFocusState = "NORMAL";
let focusExitAnimationFrameId = null;
let focusExitStartedAt = 0;
let isFocusExiting = false;
let focusExitFrom = null;
let focusExitTo = null;
let focusExitCurve = null;
let focusExitBehaviorState = null;
let focusExitReason = "";

const FOCUS_ENTER_DELAY_MS = 1200;
const FOCUS_ENTER_DURATION_MS = 700;
const FOCUS_EXIT_DURATION_MS = 550;
const FOCUS_SEQUENCE_MAX_FALLBACK_MS = 12000;

const elements = {
  mode: document.querySelector("#modeText"),
  turn: document.querySelector("#turnText"),
  spot: document.querySelector("#spotText"),
  direction: document.querySelector("#directionText"),
  sdCard: document.querySelector("#sdCardText"),
  photoTiming: document.querySelector("#photoTimingText"),
  eventText: document.querySelector("#eventText"),
  actionPanel: document.querySelector("#actionPanel"),
  logList: document.querySelector("#logList"),
  detailPanel: document.querySelector("#detailPanel")
};

function getSpeciesPhotoDisplayName(speciesId) {
  const species = speciesList.find((item) => item.id === speciesId);
  if (!species) {
    return "未知鸟种";
  }

  return getSpeciesKnowledgeState(gameState.fieldGuide, speciesId) === "CATALOGUED"
    ? species.name
    : species.nickname;
}

function getBehaviorDisplay(behaviorState) {
  return BEHAVIOR_STATE_DISPLAY[behaviorState] || BEHAVIOR_STATE_DISPLAY.NORMAL;
}

function normalizeCaptureBehaviorState(value) {
  if (value === "NORMAL" || value === "INTERESTING" || value === "REMARKABLE") {
    return value;
  }

  return null;
}

function getModeDisplay(mode) {
  const modeDisplay = {
    START: "准备开始",
    START_SPOT_SELECT: "选择鸟点",
    EXPLORE: "探索中",
    DISTANT_LISTEN: "远听中",
    FIRST_ENCOUNTER: "初次发现",
    PHOTO: "拍摄中",
    SETTLEMENT: "本局结算",
    FIELD_GUIDE: "图鉴查看",
    SPOT_SELECT: "选择鸟点"
  };

  return modeDisplay[mode] || "未知阶段";
}

function renderBehaviorBadge(behaviorState) {
  const display = getBehaviorDisplay(behaviorState);
  return `<span class="behavior-badge ${display.className}">${display.label}</span>`;
}

function getCurrentVisibleFocusState() {
  const sequence = gameState.currentFocusSequence;

  if (sequence && sequence.currentVisibleState && sequence.currentVisibleState !== "TRANSFER") {
    return sequence.currentVisibleState;
  }

  if (gameState.currentPhotoSequence) {
    return getCurrentPhotoState(gameState.currentPhotoSequence);
  }

  return "NORMAL";
}

function getSequenceSegmentState(sequence) {
  if (!sequence || !Array.isArray(sequence.segments)) {
    return null;
  }

  const segment = sequence.segments[sequence.segmentIndex] || null;
  return segment ? normalizeCaptureBehaviorState(segment.state) : null;
}

function captureVisibleFocusBehaviorState() {
  const sequence = gameState.currentFocusSequence;
  const externalState = gameState.currentPhotoSequence
    ? getCurrentPhotoState(gameState.currentPhotoSequence)
    : "NORMAL";

  return normalizeCaptureBehaviorState(latestVisibleFocusState)
    || normalizeCaptureBehaviorState(sequence && sequence.currentVisibleState)
    || getSequenceSegmentState(sequence)
    || normalizeCaptureBehaviorState(externalState)
    || "NORMAL";
}

function renderPhotoTimingStatus() {
  if (isFocusExiting) {
    return `
      <span class="focus-playfield is-exiting">
        <span class="focus-frame" aria-hidden="true"></span>
        <span class="focus-moving-badge is-exiting">
          ${renderBehaviorBadge(focusExitBehaviorState || "NORMAL")}
        </span>
      </span>
    `;
  }

  if (
    gameState.mode === "PHOTO"
    && gameState.photoPhase === "RESULT"
    && gameState.currentPhotoSequence
  ) {
    return `
      <span class="focus-playfield is-result">
        <span class="focus-frame" aria-hidden="true"></span>
      </span>
    `;
  }

  if (
    gameState.mode !== "PHOTO"
    || gameState.photoPhase !== "FOCUS"
    || !gameState.currentPhotoSequence
  ) {
    return `
      <span class="focus-playfield is-empty">
        <span class="focus-empty-label">[空]</span>
      </span>
    `;
  }

  return `
    <span class="focus-playfield">
      <span class="focus-frame" aria-hidden="true"></span>
      <span class="focus-moving-badge is-hidden">
        ${renderBehaviorBadge(getCurrentVisibleFocusState())}
      </span>
    </span>
  `;
}

function renderRarityBadge(raritySource) {
  return createRarityBadgeHtml(raritySource);
}

function normalizePhotoFocusAffix(focusAffix) {
  return focusAffix === "BLUR" ? "BLUR" : "IN_FOCUS";
}

function getFocusAffixFromResult(result) {
  if (!result) {
    return "BLUR";
  }

  return result.isGreen ? "IN_FOCUS" : "BLUR";
}

function renderFocusAffixBadge(focusAffix) {
  if (normalizePhotoFocusAffix(focusAffix) !== "BLUR") {
    return "";
  }

  return `<span class="focus-affix-badge is-blur">失焦</span>`;
}

function getPhotoScore(photo) {
  const card = photo && photo.card ? photo.card : null;
  const baseScore = Number(card && card.stars !== undefined ? card.stars : photo && photo.stars);
  const safeBaseScore = Number.isFinite(baseScore) ? baseScore : 0;

  if (normalizePhotoFocusAffix(photo && photo.focusAffix) === "BLUR") {
    return Math.max(0, safeBaseScore - 1);
  }

  return safeBaseScore;
}

function getBatteryInfo(state) {
  const maxPhotos = Math.max(Number(state.maxPhotos) || 1, 1);
  const used = Math.max(Number(state.photos.length) || 0, 0);
  const remaining = Math.max(0, maxPhotos - used);
  const pct = Math.round((remaining / maxPhotos) * 100);
  const usedPct = Math.round((used / maxPhotos) * 100);
  let level = "green";

  if (pct <= 0) {
    level = "empty";
  } else if (pct <= 10) {
    level = "red";
  } else if (pct <= 30) {
    level = "yellow";
  }

  return {
    maxPhotos,
    used,
    remaining,
    pct,
    usedPct,
    level
  };
}

function renderBatteryWidget(state) {
  const battery = getBatteryInfo(state);
  const blinkingClass = battery.level === "red" ? " blinking" : "";

  return `
    <span class="battery-widget" aria-label="剩余电量 ${battery.pct}%">
      <span class="battery-shell">
        <span class="battery-fill ${battery.level}${blinkingClass}" style="width: ${battery.pct}%;"></span>
      </span>
      <span class="battery-pct ${battery.level}${blinkingClass}">${battery.pct}%</span>
    </span>
  `;
}

function renderNewBadge() {
  return `<span class="new-badge">NEW</span>`;
}

function normalizeFieldGuideSpeciesIndex() {
  if (speciesList.length === 0) {
    fieldGuideSpeciesIndex = 0;
    return;
  }

  if (fieldGuideSpeciesIndex < 0 || fieldGuideSpeciesIndex >= speciesList.length) {
    fieldGuideSpeciesIndex = ((fieldGuideSpeciesIndex % speciesList.length) + speciesList.length) % speciesList.length;
  }
}

function getCardsForSpecies(speciesId) {
  const rarityOrder = {
    NORMAL: 1,
    INTERESTING: 2,
    REMARKABLE: 3,
    PRECIOUS: 4
  };

  return cardList
    .map((card, index) => ({ card, index }))
    .filter((item) => item.card.speciesId === speciesId)
    .sort((left, right) => {
      const leftRank = rarityOrder[left.card.rarity] || 99;
      const rightRank = rarityOrder[right.card.rarity] || 99;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.index - right.index;
    })
    .map((item) => item.card);
}

function createButton(label, actionName, actionType, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = actionName;
  button.dataset.type = actionType;
  if (className) {
    button.className = className;
  }
  return button;
}

function createActionRow(buttons, rowClassName = "action-row") {
  const row = document.createElement("div");
  row.className = rowClassName;
  buttons.forEach((button) => row.append(button));
  return row;
}

function createFocusSeed(value) {
  const text = String(value || "");
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createFocusEnterFrom() {
  const side = Math.floor(Math.random() * 4);

  if (side === 0) {
    return { x: -1.25, y: randomBetween(-0.6, 0.6) };
  }

  if (side === 1) {
    return { x: 1.25, y: randomBetween(-0.6, 0.6) };
  }

  if (side === 2) {
    return { x: randomBetween(-0.8, 0.8), y: -1.25 };
  }

  return { x: randomBetween(-0.8, 0.8), y: 1.25 };
}

function createFocusEnterCurve() {
  return {
    x: randomBetween(-0.22, 0.22),
    y: randomBetween(-0.18, 0.18)
  };
}

function createFocusExitTo() {
  const side = Math.floor(Math.random() * 4);

  if (side === 0) {
    return { x: -1.35, y: randomBetween(-0.7, 0.7) };
  }

  if (side === 1) {
    return { x: 1.35, y: randomBetween(-0.7, 0.7) };
  }

  if (side === 2) {
    return { x: randomBetween(-0.8, 0.8), y: -1.35 };
  }

  return { x: randomBetween(-0.8, 0.8), y: 1.35 };
}

function createFocusExitCurve() {
  return {
    x: randomBetween(-0.25, 0.25),
    y: randomBetween(-0.25, 0.25)
  };
}

function easeOutCubic(progress) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  return 1 - Math.pow(1 - clampedProgress, 3);
}

function easeInCubic(progress) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  return clampedProgress * clampedProgress * clampedProgress;
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function getFocusPixelOffset(position, rect) {
  const maxOffsetX = rect.width * 0.42;
  const maxOffsetY = rect.height * 0.34;

  return {
    x: position.x * maxOffsetX,
    y: position.y * maxOffsetY
  };
}

function markFocusTargetVisible() {
  if (!canShootCurrentFocus) {
    canShootCurrentFocus = true;
  }
}

function updateMovingBadgeState(movingBadge, behaviorState) {
  const visibleState = behaviorState === "TRANSFER" ? latestVisibleFocusState : behaviorState;

  if (!movingBadge || !visibleState) {
    return;
  }

  latestVisibleFocusState = visibleState;

  if (gameState.currentFocusSequence) {
    gameState.currentFocusSequence.currentVisibleState = visibleState;
  }

  movingBadge.innerHTML = renderBehaviorBadge(visibleState);
}

function startFocusSequenceIfNeeded(now) {
  const sequence = gameState.currentFocusSequence;

  if (!sequence || sequence.startedAt > 0) {
    return;
  }

  sequence.startedAt = now;
  focusActiveWindowStartedAt = now;
}

function updateFocusSequencePlayback(now, movingBadge, displayPosition) {
  const sequence = gameState.currentFocusSequence;

  if (!sequence) {
    return false;
  }

  const firstSegment = sequence.segments && sequence.segments[0] ? sequence.segments[0] : null;

  if (sequence.startedAt <= 0) {
    updateMovingBadgeState(movingBadge, sequence.currentVisibleState || (firstSegment && firstSegment.state) || "NORMAL");
    return false;
  }

  const elapsedMs = now - sequence.startedAt;
  const sequenceState = getFocusSequenceState(sequence, elapsedMs);

  if (sequenceState.isTransfer || elapsedMs >= FOCUS_SEQUENCE_MAX_FALLBACK_MS) {
    triggerFocusTransfer(displayPosition);
    return true;
  }

  sequence.segmentIndex = sequenceState.segmentIndex;
  updateMovingBadgeState(movingBadge, sequenceState.state);
  return false;
}

function canShootNow() {
  return gameState.mode === "PHOTO"
    && gameState.photoPhase === "FOCUS"
    && canShootCurrentFocus
    && !isFocusExiting
    && !focusTimedOut
    && Boolean(focusRuntime)
    && Boolean(latestFocusResult && latestFocusResult.position)
    && Boolean(document.querySelector(".focus-moving-badge:not(.is-hidden)"));
}

function evaluateDisplayedFocus(position) {
  const distance = getFocusDistance(position);
  const affix = getFocusAffixFromPosition(position, focusRuntime.config);

  return {
    position,
    distance,
    affix,
    affixDisplay: getFocusAffixDisplay(affix),
    isGreen: isInGreenZone(position, focusRuntime.config)
  };
}

function getCurrentFocusKey() {
  if (
    gameState.mode !== "PHOTO"
    || gameState.photoPhase !== "FOCUS"
    || !gameState.currentPhotoTarget
    || !gameState.currentPhotoSequence
  ) {
    return "";
  }

  const speciesId = gameState.currentPhotoTarget.speciesId;
  const instanceId = gameState.currentPhotoTarget.instanceId || speciesId;
  const behaviorState = getCurrentPhotoState(gameState.currentPhotoSequence);

  return `${instanceId}|${speciesId}|${behaviorState}`;
}

function stopFocusAnimation() {
  if (focusAnimationFrameId !== null) {
    cancelAnimationFrame(focusAnimationFrameId);
  }

  focusAnimationFrameId = null;
  focusRuntime = null;
  focusStartedAt = 0;
  focusActiveWindowStartedAt = 0;
  latestFocusResult = null;
  latestVisibleFocusState = "NORMAL";
  canShootCurrentFocus = false;
  latestFocusKey = "";
  focusEnterFrom = null;
  focusEnterCurve = null;
  focusEnterTarget = null;
  focusMotionStarted = false;
}

function stopFocusExitAnimation() {
  if (focusExitAnimationFrameId !== null) {
    cancelAnimationFrame(focusExitAnimationFrameId);
  }

  focusExitAnimationFrameId = null;
  focusExitStartedAt = 0;
  isFocusExiting = false;
  focusExitFrom = null;
  focusExitTo = null;
  focusExitCurve = null;
  focusExitBehaviorState = null;
  focusExitReason = "";
  canShootCurrentFocus = false;
}

function clearFocusTimeoutState() {
  focusTimedOut = false;
  focusActiveWindowStartedAt = 0;
}

function triggerFocusTransfer(exitFrom) {
  if (focusTimedOut || isFocusExiting) {
    return true;
  }

  focusTimedOut = true;
  canShootCurrentFocus = false;
  startFocusExitAnimation(exitFrom, latestVisibleFocusState || getCurrentVisibleFocusState(), "transfer");
  updateFocusExitAnimation();
  return true;
}

function updateFocusAnimation() {
  if (isFocusExiting) {
    stopFocusAnimation();
    return;
  }

  if (gameState.mode !== "PHOTO" || gameState.photoPhase !== "FOCUS") {
    stopFocusAnimation();
    return;
  }

  const playfield = document.querySelector(".focus-playfield");
  const movingBadge = document.querySelector(".focus-moving-badge");
  const focusFrame = document.querySelector(".focus-frame");

  if (playfield && movingBadge && focusFrame && focusRuntime) {
    const now = performance.now();
    const rect = playfield.getBoundingClientRect();
    const elapsedMs = now - focusStartedAt;
    const motionMs = Math.max(elapsedMs - FOCUS_ENTER_DELAY_MS, 0);
    const t = motionMs / 1000;
    const result = evaluateFocus(focusRuntime, t);
    let displayPosition = result.position;

    if (elapsedMs < FOCUS_ENTER_DELAY_MS) {
      movingBadge.classList.add("is-hidden");
      focusFrame.classList.remove("is-green");
      latestFocusResult = null;
      canShootCurrentFocus = false;
      updateMovingBadgeState(movingBadge, getCurrentVisibleFocusState());
    } else if (!focusMotionStarted) {
      const progress = Math.min(motionMs / FOCUS_ENTER_DURATION_MS, 1);
      const easedProgress = easeOutCubic(progress);
      const arc = Math.sin(progress * Math.PI);

      displayPosition = {
        x: lerp(focusEnterFrom.x, focusEnterTarget.x, easedProgress) + arc * focusEnterCurve.x,
        y: lerp(focusEnterFrom.y, focusEnterTarget.y, easedProgress) + arc * focusEnterCurve.y
      };
      movingBadge.classList.remove("is-hidden");
      movingBadge.classList.add("is-entering");
      latestFocusResult = evaluateDisplayedFocus(displayPosition);
      markFocusTargetVisible();
      startFocusSequenceIfNeeded(now);
      if (updateFocusSequencePlayback(now, movingBadge, displayPosition)) {
        return;
      }
      focusFrame.classList.toggle("is-green", latestFocusResult.isGreen);

      if (progress >= 1) {
        focusMotionStarted = true;
        movingBadge.classList.remove("is-entering");
        latestFocusResult = result;
        markFocusTargetVisible();
        focusFrame.classList.toggle("is-green", result.isGreen);
      }
    } else {
      movingBadge.classList.remove("is-hidden");
      movingBadge.classList.remove("is-entering");
      latestFocusResult = result;
      markFocusTargetVisible();
      startFocusSequenceIfNeeded(now);
      if (updateFocusSequencePlayback(now, movingBadge, displayPosition)) {
        return;
      }
      focusFrame.classList.toggle("is-green", result.isGreen);
    }

    const offset = getFocusPixelOffset(displayPosition, rect);
    movingBadge.style.transform = `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`;

    if (updateFocusSequencePlayback(now, movingBadge, displayPosition)) {
      return;
    }
  }

  focusAnimationFrameId = requestAnimationFrame(updateFocusAnimation);
}

function updateFocusExitAnimation() {
  if (!isFocusExiting || gameState.mode !== "PHOTO") {
    stopFocusExitAnimation();
    clearFocusTimeoutState();
    return;
  }

  const playfield = document.querySelector(".focus-playfield");
  const movingBadge = document.querySelector(".focus-moving-badge");
  const focusFrame = document.querySelector(".focus-frame");

  if (!playfield || !movingBadge || !focusFrame || !focusExitFrom || !focusExitTo || !focusExitCurve) {
    focusExitAnimationFrameId = requestAnimationFrame(updateFocusExitAnimation);
    return;
  }

  const now = performance.now();
  const progress = Math.min((now - focusExitStartedAt) / FOCUS_EXIT_DURATION_MS, 1);
  const easedProgress = easeInCubic(progress);
  const arc = Math.sin(progress * Math.PI);
  const displayPosition = {
    x: lerp(focusExitFrom.x, focusExitTo.x, easedProgress) + arc * focusExitCurve.x,
    y: lerp(focusExitFrom.y, focusExitTo.y, easedProgress) + arc * focusExitCurve.y
  };
  const offset = getFocusPixelOffset(displayPosition, playfield.getBoundingClientRect());

  movingBadge.classList.remove("is-hidden");
  movingBadge.classList.add("is-exiting");
  movingBadge.style.transform = `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`;

  if (progress >= 1) {
    const completedReason = focusExitReason;
    stopFocusExitAnimation();
    if (completedReason === "timeout" || completedReason === "transfer") {
      gameState = handlePhotoAction(gameState, "timeout");
      clearFocusTimeoutState();
    }
    render();
    return;
  }

  focusExitAnimationFrameId = requestAnimationFrame(updateFocusExitAnimation);
}

function startFocusExitAnimation(exitFrom, behaviorState, reason = "shoot") {
  stopFocusAnimation();
  stopFocusExitAnimation();

  isFocusExiting = true;
  canShootCurrentFocus = false;
  focusExitStartedAt = performance.now();
  focusExitFrom = exitFrom || { x: 0, y: 0 };
  focusExitTo = createFocusExitTo();
  focusExitCurve = createFocusExitCurve();
  focusExitBehaviorState = behaviorState;
  focusExitReason = reason;
}

function setupFocusAnimationIfNeeded() {
  if (!isFocusExiting && (gameState.mode !== "PHOTO" || gameState.photoPhase !== "FOCUS")) {
    clearFocusTimeoutState();
    gameState.currentFocusSequence = null;
  }

  if (
    isFocusExiting
    || focusTimedOut
    || gameState.mode !== "PHOTO"
    || gameState.photoPhase !== "FOCUS"
    || !gameState.currentPhotoTarget
    || !gameState.currentPhotoSequence
  ) {
    stopFocusAnimation();
    return;
  }

  const focusKey = getCurrentFocusKey();
  if (focusAnimationFrameId !== null && focusRuntime && latestFocusKey === focusKey) {
    return;
  }

  stopFocusAnimation();

  const speciesId = gameState.currentPhotoTarget.speciesId;
  const behaviorState = getCurrentPhotoState(gameState.currentPhotoSequence);
  const config = getFocusConfig(speciesId, behaviorState);
  const seed = createFocusSeed(focusKey);

  focusRuntime = createFocusRuntime(config, seed);
  focusStartedAt = performance.now();
  latestFocusKey = focusKey;
  latestVisibleFocusState = getCurrentVisibleFocusState();
  focusEnterFrom = createFocusEnterFrom();
  focusEnterCurve = createFocusEnterCurve();
  focusEnterTarget = evaluateFocus(
    createFocusRuntime(config, seed),
    FOCUS_ENTER_DURATION_MS / 1000
  ).position;
  focusMotionStarted = false;
  canShootCurrentFocus = false;
  clearFocusTimeoutState();
  focusAnimationFrameId = requestAnimationFrame(updateFocusAnimation);
}

function restartCssAnimation(element, className) {
  if (!element) {
    return;
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function getPendingPhotoEffect(type, action) {
  if (type !== "photo") {
    return "";
  }

  if (action === "wait") {
    return "photo-wait";
  }

  if (action === "shoot") {
    return "photo-shutter";
  }

  return "";
}

function playImmediatePhotoEffect(pendingEffect) {
  if (pendingEffect === "photo-shutter") {
    restartCssAnimation(elements.eventText.closest(".event-box"), "is-shutter-flashing");
  }
}

function playAfterRenderPhotoEffect(pendingEffect) {
  if (pendingEffect === "photo-shutter") {
    restartCssAnimation(elements.photoTiming.querySelector(".focus-playfield"), "is-shutter-flashing");
  }

  if (pendingEffect === "photo-wait") {
    restartCssAnimation(elements.photoTiming.querySelector(".behavior-badge"), "is-pulsing");
  }
}

function renderStatusBlocks(currentSpot, mapInfo) {
  const spotItem = elements.spot.closest(".status-item");
  const directionItem = elements.direction.closest(".status-item");
  const photoTimingItem = elements.photoTiming.closest(".status-item");
  const spotLabel = spotItem ? spotItem.querySelector(".status-label") : null;
  const batteryItem = elements.sdCard.closest(".status-item");
  const batteryLabel = batteryItem ? batteryItem.querySelector(".status-label") : null;

  if (spotLabel) {
    spotLabel.textContent = "位置";
  }

  if (batteryLabel) {
    batteryLabel.textContent = "电量";
  }

  if (spotItem) {
    spotItem.classList.add("status-location");
  }

  if (directionItem) {
    directionItem.classList.add("is-merged-away");
    directionItem.setAttribute("aria-hidden", "true");
  }

  if (photoTimingItem) {
    photoTimingItem.classList.toggle(
      "is-focus-active",
      gameState.mode === "PHOTO"
        && gameState.photoPhase === "FOCUS"
        && Boolean(gameState.currentPhotoSequence)
    );
    photoTimingItem.classList.toggle(
      "is-empty",
      gameState.mode !== "PHOTO"
        || (gameState.photoPhase !== "FOCUS" && gameState.photoPhase !== "RESULT")
        || !gameState.currentPhotoSequence
    );
    photoTimingItem.classList.toggle(
      "is-result",
      gameState.mode === "PHOTO"
        && gameState.photoPhase === "RESULT"
        && Boolean(gameState.currentPhotoSequence)
    );
    photoTimingItem.classList.add("status-photo-moment");
  }

  elements.spot.textContent = `${currentSpot.name} · ${mapInfo.facingName}`;
  elements.direction.textContent = mapInfo.facingName;
}

function renderActions() {
  elements.actionPanel.innerHTML = "";

  if (gameState.mode === "START") {
    elements.actionPanel.append(createButton("开始游戏", "start", "system", "button-major"));
    elements.actionPanel.append(createButton("查看图鉴", "fieldGuide", "system"));
    return;
  }

  if (gameState.mode === "START_SPOT_SELECT") {
    getAllSpots().forEach((spot) => {
      elements.actionPanel.append(createButton(`从这里开始：${spot.name}`, spot.id, "startSpot"));
    });
    elements.actionPanel.append(createButton("返回", "back", "system"));
    return;
  }

  if (gameState.mode === "EXPLORE") {
    elements.actionPanel.append(createActionRow([
      createButton("观察当前方向", "observe", "explore")
    ]));
    elements.actionPanel.append(createActionRow([
      createButton("向左转", "turnLeft", "explore"),
      createButton("向右转", "turnRight", "explore")
    ], "action-row action-row-two"));
    elements.actionPanel.append(createActionRow([
      createButton("倾听远处的声音", "listenDistant", "explore")
    ]));
    elements.actionPanel.append(createActionRow([
      createButton("查看图鉴", "fieldGuide", "system")
    ]));
    elements.actionPanel.append(createActionRow([
      createButton("提前撤离并结算", "retreat", "explore")
    ]));
    return;
  }

  if (gameState.mode === "DISTANT_LISTEN") {
    gameState.distantListenOptions.forEach((option) => {
      elements.actionPanel.append(createButton(`前往${option.spotName}`, option.spotId, "distantListen"));
    });
    elements.actionPanel.append(createButton("观察当前方向", "observe", "distantListen"));
    elements.actionPanel.append(createButton("再听一会", "listenAgain", "distantListen"));
    return;
  }

  if (gameState.mode === "SPOT_SELECT") {
    gameState.availableSpotOptions.forEach((spot) => {
      elements.actionPanel.append(createButton(`前往：${spot.name}`, spot.id, "spot"));
    });
    elements.actionPanel.append(createButton("留在当前鸟点", "stay", "spot"));
    return;
  }

  if (gameState.mode === "FIRST_ENCOUNTER") {
    elements.actionPanel.append(createButton("继续", "continue", "firstEncounter", "button-major"));
    return;
  }

  if (gameState.mode === "PHOTO") {
    if (gameState.photoPhase === "FOCUS") {
      elements.actionPanel.append(createButton("按下快门", "shoot", "photo"));
      return;
    }

    if (gameState.photoPhase === "REPOSITION") {
      elements.actionPanel.append(createButton("寻找位置", "reposition", "photo"));
      return;
    }

    if (gameState.photoPhase === "LOST") {
      elements.actionPanel.append(createButton("放下相机", "putDownCamera", "photo"));
      return;
    }

    if (gameState.photoPhase === "RESULT") {
      elements.actionPanel.append(createButton("继续跟焦", "refocus", "photo"));
      elements.actionPanel.append(createButton("再等一等", "wait", "photo"));
      elements.actionPanel.append(createButton("放弃拍摄", "giveUp", "photo"));
      return;
    }

    elements.actionPanel.append(createButton("举起相机", "raiseCamera", "photo"));
    elements.actionPanel.append(createButton("再等一等", "wait", "photo"));
    elements.actionPanel.append(createButton("放弃拍摄", "giveUp", "photo"));
    return;
  }

  if (gameState.mode === "FIELD_GUIDE") {
    elements.actionPanel.append(createButton("返回", "back", "system"));
    elements.actionPanel.append(createButton("开始新游戏", "start", "system", "button-major"));
    elements.actionPanel.append(createButton("清空图鉴", "clearGuide", "system"));
    return;
  }

  if (gameState.mode === "SETTLEMENT") {
    elements.actionPanel.append(createButton("重新开始", "start", "system", "button-major"));
    elements.actionPanel.append(createButton("查看图鉴", "fieldGuide", "system"));
  }
}

function renderLogs() {
  elements.logList.innerHTML = "";

  gameState.logs.slice(0, LOG_LIMIT).forEach((logText) => {
    const item = document.createElement("li");
    item.textContent = logText;
    elements.logList.append(item);
  });
}

function renderMapHtml() {
  const mapInfo = getSurroundingSpotMap(gameState);

  return `
    <section class="text-map" aria-label="周边地图">
      <h3>周边地图</h3>
      <div class="map-grid">
        <div class="map-node map-front">[${mapInfo.front}]</div>
        <div class="map-connector map-connector-up">↑<span>│</span></div>
        <div class="map-node map-left">[${mapInfo.left}]</div>
        <div class="map-connector map-connector-left">←</div>
        <div class="map-node map-center">[${mapInfo.currentSpot.name}]</div>
        <div class="map-connector map-connector-right">→</div>
        <div class="map-node map-right">[${mapInfo.right}]</div>
        <div class="map-connector map-connector-down"><span>│</span>↓</div>
        <div class="map-node map-back">[${mapInfo.back}]</div>
      </div>
      <p>当前位置：${mapInfo.currentSpot.name}</p>
      <p>当前面向：${mapInfo.facingName}</p>
    </section>
  `;
}

function renderFieldGuide() {
  const guide = gameState.fieldGuide;
  normalizeFieldGuideSpeciesIndex();

  if (speciesList.length === 0) {
    elements.detailPanel.innerHTML = `
      <section class="field-guide-page">
        <h2>图鉴</h2>
        <p>暂时没有可查看的鸟种。</p>
      </section>
    `;
    return;
  }

  const species = speciesList[fieldGuideSpeciesIndex];
  const knowledgeState = getSpeciesKnowledgeState(guide, species.id);
  const isKnownBySight = knowledgeState === "SEEN" || knowledgeState === "CATALOGUED";
  const isCataloguedSpecies = knowledgeState === "CATALOGUED";
  const speciesCards = getCardsForSpecies(species.id);
  const collectedCardsForSpecies = speciesCards.filter((card) => {
    return guide.collectedCards.some((item) => item.id === card.id);
  });
  const collectedCount = collectedCardsForSpecies.length;
  const totalCount = speciesCards.length;
  const speciesTitle = isCataloguedSpecies
    ? species.name
    : knowledgeState === "SEEN"
      ? "？？？"
      : "未知鸟种";
  const progressText = isKnownBySight
    ? `已收集 ${collectedCount} / ${totalCount}`
    : "尚未建立完整记录";
  const knowledgeNote = {
    UNKNOWN: "先在野外听见声音或拍下身影。",
    HEARD: "你听到过它的声音，但还没有真正看清它。",
    SEEN: "你已经见过它，但还不知道它的名字。",
    CATALOGUED: "已加新"
  }[knowledgeState] || "先在野外听见声音或拍下身影。";
  const appearanceHtml = isKnownBySight
    ? `<p class="field-guide-appearance">${species.appearance}</p>`
    : "";
  const catalogueButtonHtml = knowledgeState === "SEEN"
    ? `<button class="field-guide-catalogue-button button-major" type="button" data-species-id="${species.id}">为它加新</button>`
    : "";
  const pageTabs = speciesList.map((item, index) => {
    const className = index === fieldGuideSpeciesIndex
      ? "field-guide-page-tab is-active"
      : "field-guide-page-tab";

    return `<span class="${className}" aria-hidden="true"></span>`;
  });
  const cardItems = speciesCards.map((card) => {
    const isCollected = isKnownBySight && guide.collectedCards.some((item) => item.id === card.id);

    if (!isCollected) {
      return `
        <li class="field-guide-card is-locked">
          <div class="field-guide-card-title-row">
            ${renderRarityBadge(card)}
            <strong class="field-guide-card-title">？？？</strong>
          </div>
          <p class="field-guide-card-description is-muted">尚未获得</p>
        </li>
      `;
    }

    return `
      <li class="field-guide-card is-collected">
        <div class="field-guide-card-title-row">
          ${renderRarityBadge(card)}
          <strong class="field-guide-card-title">${card.title}</strong>
        </div>
        <p class="field-guide-card-description">${card.description}</p>
      </li>
    `;
  });
  const emptyCardItem = `
    <li class="field-guide-card is-locked">
      <div class="field-guide-card-title-row">
        <strong class="field-guide-card-title">暂无卡牌</strong>
      </div>
      <p class="field-guide-card-description is-muted">这个鸟种还没有配置卡牌。</p>
    </li>
  `;

  elements.detailPanel.innerHTML = `
    <section class="field-guide-page">
      <div class="field-guide-page-tabs" aria-label="图鉴页数">${pageTabs.join("")}</div>
      <div class="field-guide-pager">
        <button class="field-guide-nav-button field-guide-nav-prev" type="button" data-action="fieldGuidePrev" aria-label="上一种鸟">◀</button>
        <div class="field-guide-species-header">
          <h2 class="field-guide-species-title">${speciesTitle}</h2>
          <p class="field-guide-species-progress">${progressText}</p>
        </div>
        <button class="field-guide-nav-button field-guide-nav-next" type="button" data-action="fieldGuideNext" aria-label="下一种鸟">▶</button>
      </div>
      <p class="field-guide-knowledge-note">${knowledgeNote}</p>
      ${appearanceHtml}
      ${catalogueButtonHtml}
      <ul class="field-guide-card-list">${cardItems.join("") || emptyCardItem}</ul>
    </section>
  `;
}

function renderSettlement() {
  if (!isSettlementRevealed) {
    elements.detailPanel.innerHTML = `
      <section class="settlement-panel settlement-collapsed" data-action="revealSettlement" role="button" tabindex="0">
        <div class="settlement-collapsed-content">
          <h2 class="settlement-collapsed-title">本局结算</h2>
          <p class="settlement-collapsed-hint">点击展开本次记录</p>
          <div class="settlement-collapsed-arrow" aria-hidden="true">↓</div>
        </div>
      </section>
    `;
    return;
  }

  const foundSpeciesIds = [...new Set(gameState.photos.map((photo) => photo.speciesId))];
  const battery = getBatteryInfo(gameState);
  const shownNewCardIds = [];
  const photoItems = gameState.photos.map((photo, index) => {
    const cardWasUnlockedBefore = gameState.unlockedCardIdsAtRunStart.includes(photo.card.id);
    const shouldShowNew = !cardWasUnlockedBefore && !shownNewCardIds.includes(photo.card.id);
    const revealDelay = 1500 + Math.min(index * 85, 1100);
    const className = shouldShowNew
      ? "settlement-photo-card settlement-reveal is-new-card"
      : "settlement-photo-card settlement-reveal";

    if (shouldShowNew) {
      shownNewCardIds.push(photo.card.id);
    }

    return `<li class="${className}" style="--reveal-delay: ${revealDelay}ms"><strong>${photo.speciesName}</strong> · ${photo.card.title} ${renderRarityBadge(photo.card)}${renderFocusAffixBadge(photo.focusAffix)} ${shouldShowNew ? renderNewBadge() : ""}</li>`;
  });
  const emptyPhotoItem = `<li class="settlement-photo-card settlement-reveal" style="--reveal-delay: 1500ms">本局没有拍到照片。</li>`;

  elements.detailPanel.innerHTML = `
    <h2 class="settlement-reveal" style="--reveal-delay: 0ms">本局结算</h2>
    <p class="settlement-reveal" style="--reveal-delay: 240ms">拍照数量：${battery.used} 张（已用电量 ${battery.usedPct}%）</p>
    <p class="settlement-reveal" style="--reveal-delay: 480ms">记录鸟种：${foundSpeciesIds.length}</p>
    <p class="settlement-reveal" style="--reveal-delay: 720ms">听到鸟种：${gameState.sessionHeardSpeciesIds.length}</p>
    <p class="settlement-reveal" style="--reveal-delay: 960ms">新增图鉴：${shownNewCardIds.length}</p>
    <h3 class="settlement-reveal" style="--reveal-delay: 1350ms">照片列表</h3>
    <ul class="settlement-photo-list">${photoItems.join("") || emptyPhotoItem}</ul>
  `;
}

function renderPhotoDetail() {
  const bird = gameState.currentPhotoTarget;
  const photoSequence = gameState.currentPhotoSequence;
  const behaviorState = getCurrentPhotoState(photoSequence);
  const display = getBehaviorDisplay(behaviorState);
  const phaseTextByKey = {
    DECISION: "你正在观察它的行为，还没有举起相机。",
    FOCUS: "你已举起相机，正在对焦。",
    REPOSITION: "它离开了当前取景框，你需要重新找到它的位置。",
    LOST: "它已经飞离取景范围，你失去了它的位置。",
    RESULT: "刚拍完一张照片，你可以继续跟焦或再等一等。"
  };
  const phaseText = phaseTextByKey[gameState.photoPhase] || phaseTextByKey.DECISION;
  const timingDetailHtml = gameState.photoPhase === "REPOSITION" || gameState.photoPhase === "LOST"
    ? ""
    : `
    <p>当前时机：${renderBehaviorBadge(behaviorState)}</p>
    <p>${display.description}</p>
    <p>${display.hint}</p>
  `;

  elements.detailPanel.innerHTML = `
    <h2>拍照时机</h2>
    <p>你正在观察：${getSpeciesPhotoDisplayName(bird.speciesId)}</p>
    <p>${phaseText}</p>
    ${timingDetailHtml}
    <p>本次观察已拍摄：${photoSequence.shutterCount} 张</p>
    <p>剩余判断机会：${getRemainingDecisionCount(photoSequence)}</p>
    <p>电量：${getBatteryInfo(gameState).pct}%</p>
  `;
}

function renderFirstEncounterDetail() {
  elements.detailPanel.innerHTML = `
    <h2>初次发现</h2>
    <p>这是你第一次近距离看到它。</p>
    <p>继续后可以尝试拍摄，但现在还不能确定它的正式名字。</p>
  `;
}

function renderSpotSelectDetail() {
  const currentSpot = getCurrentSpot(gameState);
  const optionItems = gameState.availableSpotOptions.map((spot) => {
    return `
      <li class="spot-option">
        <strong>${spot.name}</strong>
        <span>${spot.description}</span>
        <span>${spot.soundscape}</span>
        <span>特征：${spot.traits.join("、")}</span>
        <span>路程：${spot.travelCost} 回合</span>
      </li>
    `;
  });

  elements.detailPanel.innerHTML = `
    <h2>远处声景</h2>
    <p>当前鸟点：${currentSpot.name}</p>
    <ul class="spot-list">${optionItems.join("")}</ul>
    ${renderMapHtml()}
  `;
}

function renderStartSpotSelectDetail() {
  const spotItems = getAllSpots().map((spot) => {
    return `
      <li class="spot-option start-spot-card">
        <strong>${spot.name}</strong>
        <span>${spot.description}</span>
        <span>特征：${spot.traits.join(" / ")}</span>
      </li>
    `;
  });

  elements.detailPanel.innerHTML = `
    <h2>选择初始鸟点</h2>
    <p>选择一个鸟点开始本局观察。初始选点不会消耗回合。</p>
    <ul class="spot-list start-spot-select">${spotItems.join("")}</ul>
  `;
}

function renderDefaultDetail() {
  const currentSpot = getCurrentSpot(gameState);

  elements.detailPanel.innerHTML = `
    <h2>观察区域</h2>
    <p>当前鸟点：${currentSpot.name}</p>
    <p>${currentSpot.description}</p>
    <p>${currentSpot.soundscape}</p>
    ${renderMapHtml()}
  `;
}

function renderDetailPanel() {
  if (gameState.mode === "FIELD_GUIDE") {
    renderFieldGuide();
    return;
  }

  if (gameState.mode === "SETTLEMENT") {
    renderSettlement();
    return;
  }

  if (gameState.mode === "PHOTO") {
    renderPhotoDetail();
    return;
  }

  if (gameState.mode === "FIRST_ENCOUNTER") {
    renderFirstEncounterDetail();
    return;
  }

  if (gameState.mode === "START_SPOT_SELECT") {
    renderStartSpotSelectDetail();
    return;
  }

  if (gameState.mode === "SPOT_SELECT") {
    renderSpotSelectDetail();
    return;
  }

  renderDefaultDetail();
}

function render() {
  const currentSpot = getCurrentSpot(gameState);
  const mapInfo = getSurroundingSpotMap(gameState);
  elements.mode.textContent = getModeDisplay(gameState.mode);
  elements.turn.textContent = `${gameState.maxTurns - gameState.currentTurn} / ${gameState.maxTurns}`;
  renderStatusBlocks(currentSpot, mapInfo);
  elements.sdCard.innerHTML = renderBatteryWidget(gameState);
  elements.photoTiming.innerHTML = renderPhotoTimingStatus();

  if (gameState.eventHtml) {
    elements.eventText.innerHTML = gameState.eventHtml;
  } else {
    elements.eventText.textContent = gameState.eventText;
  }

  renderActions();
  renderDetailPanel();
  renderLogs();
  setupFocusAnimationIfNeeded();
}

function showFieldGuide() {
  if (gameState.mode === "SETTLEMENT") {
    isSettlementRevealed = false;
  }

  gameState.previousMode = gameState.mode;
  gameState.mode = "FIELD_GUIDE";
  gameState.fieldGuide = loadFieldGuide();
  gameState.eventText = "你翻开图鉴，查看已经听见和收集过的记录。";
}

function returnFromFieldGuide() {
  if (gameState.mode === "SETTLEMENT" || gameState.previousMode === "SETTLEMENT") {
    isSettlementRevealed = false;
  }

  gameState.mode = gameState.previousMode || "START";
  delete gameState.previousMode;
}

function handleSystemAction(action) {
  if (action === "start") {
    isSettlementRevealed = false;
    gameState = startGame();
  }

  if (action === "fieldGuide") {
    showFieldGuide();
  }

  if (action === "back") {
    returnFromFieldGuide();
  }

  if (action === "clearGuide") {
    clearFieldGuide();
    gameState.fieldGuide = loadFieldGuide();
    gameState.eventText = "图鉴已经清空。";
  }

  if (action === "endGame") {
    isSettlementRevealed = false;
    gameState = endGame(gameState);
  }
}

function revealSettlement() {
  if (gameState.mode !== "SETTLEMENT" || isSettlementRevealed) {
    return;
  }

  isSettlementRevealed = true;
  render();
}

function turnFieldGuidePage(direction) {
  if (gameState.mode !== "FIELD_GUIDE" || speciesList.length === 0) {
    return;
  }

  fieldGuideSpeciesIndex = (fieldGuideSpeciesIndex + direction + speciesList.length) % speciesList.length;
  render();
}

elements.detailPanel.addEventListener("click", (event) => {
  const catalogueButton = event.target.closest(".field-guide-catalogue-button");

  if (catalogueButton) {
    gameState = handleCatalogueAction(gameState, catalogueButton.dataset.speciesId);
    render();
    return;
  }

  const fieldGuideButton = event.target.closest(".field-guide-nav-button");

  if (fieldGuideButton) {
    const action = fieldGuideButton.dataset.action;

    if (action === "fieldGuidePrev") {
      turnFieldGuidePage(-1);
      return;
    }

    if (action === "fieldGuideNext") {
      turnFieldGuidePage(1);
      return;
    }
  }

  const collapsedSettlement = event.target.closest(".settlement-collapsed");

  if (!collapsedSettlement) {
    return;
  }

  revealSettlement();
});

elements.detailPanel.addEventListener("keydown", (event) => {
  const collapsedSettlement = event.target.closest(".settlement-collapsed");

  if (!collapsedSettlement || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  event.preventDefault();
  revealSettlement();
});

elements.actionPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const type = button.dataset.type;
  const isShootAction = type === "photo" && action === "shoot";

  if (isShootAction && !canShootNow()) {
    return;
  }

  if (isFocusExiting || (focusTimedOut && isShootAction)) {
    return;
  }

  const pendingEffect = getPendingPhotoEffect(type, action);
  const previousMode = gameState.mode;
  const capturedShootBehaviorState = isShootAction ? captureVisibleFocusBehaviorState() : null;
  const capturedFocusAffix = isShootAction ? getFocusAffixFromResult(latestFocusResult) : null;
  const shouldPlayFocusExit = isShootAction
    && gameState.mode === "PHOTO"
    && gameState.photoPhase === "FOCUS";
  const focusExitStartPosition = shouldPlayFocusExit && latestFocusResult
    ? latestFocusResult.position
    : { x: 0, y: 0 };
  const focusExitState = shouldPlayFocusExit && gameState.currentPhotoSequence
    ? capturedShootBehaviorState
    : null;

  playImmediatePhotoEffect(pendingEffect);
  gameState.eventHtml = "";

  if (type === "system") {
    handleSystemAction(action);
  }

  if (type === "explore") {
    gameState = handleExploreAction(gameState, action);
  }

  if (type === "distantListen") {
    gameState = handleDistantListenAction(gameState, action);
  }

  if (type === "spot") {
    gameState = handleSpotSelectAction(gameState, action);
  }

  if (type === "firstEncounter") {
    gameState = handleFirstEncounterAction(gameState, action);
  }

  if (type === "startSpot") {
    isSettlementRevealed = false;
    gameState = startGameAtSpot(action);
  }

  if (type === "photo") {
    gameState = handlePhotoAction(gameState, action, {
      capturedBehaviorState: capturedShootBehaviorState,
      capturedFocusAffix
    });
  }

  if (shouldPlayFocusExit && gameState.mode === "PHOTO" && gameState.photoPhase === "RESULT") {
    startFocusExitAnimation(focusExitStartPosition, focusExitState);
  } else if (gameState.mode !== "PHOTO") {
    stopFocusExitAnimation();
    clearFocusTimeoutState();
  }

  if (previousMode !== "SETTLEMENT" && gameState.mode === "SETTLEMENT") {
    isSettlementRevealed = false;
  }

  render();
  if (isFocusExiting && focusExitAnimationFrameId === null) {
    updateFocusExitAnimation();
  }
  playAfterRenderPhotoEffect(pendingEffect);
});

render();
