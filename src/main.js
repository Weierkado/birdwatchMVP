/**
 * 模块职责：
 * - 负责 DOM 渲染、事件绑定、UI 临时状态和动画生命周期。
 * - 管理 FOCUS moving badge 的屏幕位置、可见状态和拍立得视觉层。
 *
 * 维护边界：
 * - 业务状态推进应交给 gameSession 等规则模块。
 * - UI 层只在点击瞬间捕获所见即所得所需数据，不重写抽卡或判定规则。
 */
import { cardList } from "../data/cards.js";
import { speciesList } from "../data/species.js";
import { LOG_LIMIT } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { clearFieldGuide, loadFieldGuide } from "./storage.js";
import { BEHAVIOR_STATE_DISPLAY, getCurrentPhotoState } from "./photoSequence.js";
import { endGame, handleCatalogueAction, handleDistantListenAction, handleExploreAction, handleFirstEncounterAction, handlePhotoAction, handleSpotSelectAction, startGame, startGameAtSpot } from "./gameSession.js";
import { getCollectedCardEntry, getCollectedCardIds, getSpeciesKnowledgeState } from "./fieldGuide.js";
import { createRarityBadgeHtml } from "./rarityDisplay.js";
import { getAllSpots, getCurrentSpot, getSpotById, getSurroundingSpotMap } from "./spotManager.js";
import { getFocusConfig, createFocusRuntime, evaluateFocus, getFocusAffixDisplay, getFocusAffixFromPosition, getFocusDistance, isInGreenZone } from "./focusEngine.js";
import { getFocusSequenceState } from "./focusSequence.js";

let gameState = createDefaultGameState();
let isSettlementRevealed = false;
let fieldGuideSpeciesIndex = 0;
let fieldGuideDetailCardId = null;
let recentlyCataloguedSpeciesId = null;
let focusAnimationFrameId = null;
let focusRuntime = null;
let focusStartedAt = 0;
// 点击快门时读取这个结果生成 capturedFocusAffix；失焦不阻止拍摄，也不改变 rarity。
let latestFocusResult = null;
let latestFocusKey = "";
let focusEnterFrom = null;
let focusEnterCurve = null;
let focusEnterTarget = null;
let focusMotionStarted = false;
let focusActiveWindowStartedAt = 0;
let focusTimedOut = false;
let canShootCurrentFocus = false;
// 玩家当前在取景框里看到的行为状态，是所见即所得抽卡的来源。
let latestVisibleFocusState = "NORMAL";
let focusExitAnimationFrameId = null;
let focusExitStartedAt = 0;
let isFocusExiting = false;
let focusExitFrom = null;
let focusExitTo = null;
let focusExitCurve = null;
let focusExitBehaviorState = null;
let focusExitReason = "";
let activePolaroidEl = null;
let activePolaroidTimerIds = [];
let polaroidOverlayRoot = null;
let lastEventTextRevealKey = "";

const FOCUS_ENTER_DELAY_MS = 1200;
const FOCUS_ENTER_DURATION_MS = 700;
const FOCUS_EXIT_DURATION_MS = 550;
const FOCUS_SEQUENCE_MAX_FALLBACK_MS = 12000;
const POLAROID_VISUAL_SCALE = 0.92;
const POLAROID_HOLD_MS = 1000;
const POLAROID_SLIDE_MS = 500;
const POLAROID_QUICK_DISMISS_MS = 240;
const FIRST_ENCOUNTER_SEGMENT_REVEAL_MS = 520;
const FIRST_ENCOUNTER_SEGMENT_CHAR_MS = 56;
const FIRST_ENCOUNTER_SEGMENT_PAUSE_MS = 280;
const FIRST_ENCOUNTER_SEGMENT_MIN_MS = 400;
const FIRST_ENCOUNTER_SEGMENT_MAX_MS = 1600;

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

function getSpeciesNameForSettlement(state, speciesId) {
  const species = speciesList.find((item) => item.id === speciesId);

  if (!species) {
    return "未知鸟种";
  }

  return getSpeciesKnowledgeState(state.fieldGuide, speciesId) === "CATALOGUED"
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
  const safeBehaviorState = normalizeCaptureBehaviorState(behaviorState) || "NORMAL";
  const display = getBehaviorDisplay(safeBehaviorState);
  const classNameByState = {
    NORMAL: "rarity-normal",
    INTERESTING: "rarity-interesting",
    REMARKABLE: "rarity-remarkable"
  };
  const className = classNameByState[safeBehaviorState] || classNameByState.NORMAL;

  return `<span class="behavior-badge rarity-badge ${className}">${display.label}</span>`;
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

function renderFocusFrame() {
  return `
    <span class="focus-frame" aria-hidden="true">
      <span class="focus-corner top-left"></span>
      <span class="focus-corner top-right"></span>
      <span class="focus-corner bottom-left"></span>
      <span class="focus-corner bottom-right"></span>
    </span>
  `;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function renderPhotoTimingStatus() {
  if (isFocusExiting) {
    return `
      <span class="focus-playfield is-exiting">
        ${renderFocusFrame()}
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
        ${renderFocusFrame()}
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
        ${renderFocusFrame()}
      </span>
    `;
  }

  return `
    <span class="focus-playfield">
      ${renderFocusFrame()}
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

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function computeFocusScoreFromBadgePosition(badgeRelX, badgeRelY) {
  const dx = badgeRelX - 50;
  const dy = badgeRelY - 50;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const focusRadius = 30;
  const viewRadius = 50 * Math.sqrt(2);
  let focusScore = 0;

  if (distance <= focusRadius) {
    focusScore = 70 + Math.round((1 - distance / focusRadius) * 30);
  } else {
    const blurDistance = distance - focusRadius;
    const blurRange = viewRadius - focusRadius;
    focusScore = Math.round((1 - blurDistance / blurRange) * 69);
    focusScore = Math.max(0, focusScore);
  }

  return clampNumber(focusScore, 0, 100);
}

function getFocusGrade(focusScore) {
  if (focusScore >= 95) {
    return "数毛";
  }

  if (focusScore >= 70) {
    return "清晰";
  }

  if (focusScore >= 30) {
    return "尚可";
  }

  return "失焦";
}

function getPolaroidFocusGradeClass(snapshot) {
  const validGrades = ["数毛", "清晰", "尚可", "失焦"];
  const grade = snapshot && snapshot.focusGrade;

  return validGrades.includes(grade) ? `grade-${grade}` : "";
}

function shouldShowPolaroidCrown(snapshot) {
  return Boolean(snapshot && snapshot.focusGrade === "数毛");
}

function sampleFocusSnapshotPayload() {
  const playfieldEl = document.querySelector(".focus-playfield");
  const badgeEl = document.querySelector(".focus-moving-badge");

  if (!playfieldEl || !badgeEl) {
    return {
      badgeRelX: 50,
      badgeRelY: 50,
      hasDomSample: false
    };
  }

  const playfieldRect = playfieldEl.getBoundingClientRect();
  const badgeRect = badgeEl.getBoundingClientRect();

  if (playfieldRect.width <= 0 || playfieldRect.height <= 0 || badgeRect.width <= 0 || badgeRect.height <= 0) {
    return {
      badgeRelX: 50,
      badgeRelY: 50,
      hasDomSample: false
    };
  }

  const badgeCenterX = badgeRect.left + badgeRect.width / 2;
  const badgeCenterY = badgeRect.top + badgeRect.height / 2;
  const badgeRelX = clampNumber(((badgeCenterX - playfieldRect.left) / playfieldRect.width) * 100, 0, 100);
  const badgeRelY = clampNumber(((badgeCenterY - playfieldRect.top) / playfieldRect.height) * 100, 0, 100);

  return {
    badgeRelX,
    badgeRelY,
    hasDomSample: true
  };
}

function createFocusSnapshotPayload() {
  const sample = sampleFocusSnapshotPayload();
  const focusScore = computeFocusScoreFromBadgePosition(sample.badgeRelX, sample.badgeRelY);

  return {
    badgeRelX: sample.badgeRelX,
    badgeRelY: sample.badgeRelY,
    focusScore,
    focusGrade: getFocusGrade(focusScore)
  };
}

function clampPolaroidPercent(value) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(0, Math.min(100, value));
}

function formatPolaroidDate(timestamp) {
  const date = new Date(Number.isFinite(timestamp) ? timestamp : Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function getStateClassFromCapturedState(capturedState) {
  if (capturedState === "INTERESTING") {
    return "state-interesting";
  }

  if (capturedState === "REMARKABLE") {
    return "state-remarkable";
  }

  if (capturedState === "PRECIOUS") {
    return "state-precious";
  }

  return "state-normal";
}

function clearActivePolaroid() {
  activePolaroidTimerIds.forEach((timerId) => window.clearTimeout(timerId));
  activePolaroidTimerIds = [];

  if (activePolaroidEl) {
    activePolaroidEl.remove();
    activePolaroidEl = null;
  }
}

function startActivePolaroidDismiss() {
  if (!activePolaroidEl || !activePolaroidEl.isConnected) {
    return;
  }

  if (activePolaroidEl.classList.contains("is-quick-dismiss")) {
    return;
  }

  const shotEl = activePolaroidEl;
  activePolaroidTimerIds.forEach((timerId) => window.clearTimeout(timerId));
  activePolaroidTimerIds = [];
  shotEl.classList.add("is-quick-dismiss");

  const removeTimerId = window.setTimeout(() => {
    if (shotEl.parentElement) {
      shotEl.remove();
    }

    if (activePolaroidEl === shotEl) {
      activePolaroidEl = null;
    }

    activePolaroidTimerIds = activePolaroidTimerIds.filter((timerId) => timerId !== removeTimerId);
  }, POLAROID_QUICK_DISMISS_MS);

  activePolaroidTimerIds.push(removeTimerId);
}

function getPolaroidOverlayRoot() {
  if (polaroidOverlayRoot && polaroidOverlayRoot.isConnected) {
    return polaroidOverlayRoot;
  }

  polaroidOverlayRoot = document.createElement("div");
  polaroidOverlayRoot.className = "focus-polaroid-overlay-root";
  document.body.appendChild(polaroidOverlayRoot);
  return polaroidOverlayRoot;
}

function createPolaroidCorner(className) {
  const corner = document.createElement("span");
  corner.className = `focus-polaroid-corner ${className}`;
  return corner;
}

function showPolaroidShot(photo) {
  if (!photo || !photo.card || !photo.snapshot) {
    return;
  }

  const playfieldEl = document.querySelector(".focus-playfield");

  if (!playfieldEl) {
    return;
  }

  const playfieldRect = playfieldEl.getBoundingClientRect();
  const overlayRoot = getPolaroidOverlayRoot();

  clearActivePolaroid();

  const shotEl = document.createElement("div");
  shotEl.className = "focus-polaroid-shot";
  shotEl.style.left = `${playfieldRect.left + window.scrollX}px`;
  shotEl.style.top = `${playfieldRect.top + window.scrollY}px`;
  shotEl.style.width = `${playfieldRect.width}px`;
  shotEl.style.height = `${playfieldRect.height}px`;

  const paperEl = document.createElement("div");
  paperEl.className = "focus-polaroid-paper";
  paperEl.style.setProperty("--polaroid-visual-scale", POLAROID_VISUAL_SCALE);

  const frameEl = document.createElement("div");
  frameEl.className = "focus-polaroid-frame";
  const frameWidth = Math.max(1, Math.round(playfieldRect.width));
  const frameHeight = Math.max(1, Math.round(playfieldRect.height));
  frameEl.style.width = `${frameWidth}px`;
  frameEl.style.height = `${frameHeight}px`;

  const focusAreaEl = document.createElement("div");
  focusAreaEl.className = "focus-polaroid-focus-area";
  if (photo.snapshot.focusAffix === "IN_FOCUS") {
    focusAreaEl.classList.add("is-green");
  } else {
    focusAreaEl.classList.add("is-blur");
  }
  focusAreaEl.append(
    createPolaroidCorner("corner-tl"),
    createPolaroidCorner("corner-tr"),
    createPolaroidCorner("corner-bl"),
    createPolaroidCorner("corner-br")
  );

  const badgeEl = document.createElement("div");
  const focusGradeClass = getPolaroidFocusGradeClass(photo.snapshot);
  badgeEl.className = `focus-polaroid-badge behavior-badge ${getStateClassFromCapturedState(photo.snapshot.capturedState)}${focusGradeClass ? ` ${focusGradeClass}` : ""}`;
  if (photo.snapshot.focusAffix === "BLUR") {
    badgeEl.classList.add("is-blur");
  }
  badgeEl.textContent = photo.card.title;
  const badgeRelX = clampPolaroidPercent(photo.snapshot.badgeRelX);
  const badgeRelY = clampPolaroidPercent(photo.snapshot.badgeRelY);
  badgeEl.style.left = `${badgeRelX}%`;
  badgeEl.style.top = `${badgeRelY}%`;

  const dateEl = document.createElement("div");
  dateEl.className = "focus-polaroid-date";
  dateEl.textContent = formatPolaroidDate(photo.snapshot.realTimestamp);

  frameEl.append(focusAreaEl, badgeEl);
  paperEl.append(frameEl, dateEl);
  if (shouldShowPolaroidCrown(photo.snapshot)) {
    const crownEl = document.createElement("span");
    crownEl.className = "focus-polaroid-crown";
    crownEl.textContent = "♛";
    paperEl.append(crownEl);
  }
  shotEl.append(paperEl);
  overlayRoot.appendChild(shotEl);
  activePolaroidEl = shotEl;

  requestAnimationFrame(() => {
    if (!shotEl.isConnected) {
      return;
    }

    const slideTimerId = window.setTimeout(() => {
      if (shotEl.isConnected) {
        shotEl.classList.add("is-sliding-out");
      }
    }, POLAROID_HOLD_MS);
    const removeTimerId = window.setTimeout(() => {
      if (shotEl.parentElement) {
        shotEl.remove();
      }

      if (activePolaroidEl === shotEl) {
        activePolaroidEl = null;
      }
    }, POLAROID_HOLD_MS + POLAROID_SLIDE_MS);

    activePolaroidTimerIds.push(slideTimerId, removeTimerId);
  });
}

function renderFocusAffixBadge(focusAffix) {
  if (normalizePhotoFocusAffix(focusAffix) !== "BLUR") {
    return "";
  }

  return `<span class="focus-affix-badge is-blur">失焦</span>`;
}

function escapeLogText(logText) {
  return String(logText)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLogTextHtml(logText) {
  const safeText = escapeLogText(logText);
  const replacements = {
    "【寻常】": renderBehaviorBadge("NORMAL"),
    "【有趣】": renderBehaviorBadge("INTERESTING"),
    "【精彩】": renderBehaviorBadge("REMARKABLE"),
    "【失焦】": renderFocusAffixBadge("BLUR")
  };

  return Object.entries(replacements).reduce((html, [text, badgeHtml]) => {
    return html.replaceAll(text, badgeHtml);
  }, safeText);
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
  let filledSlots = 0;
  let levelClass = "is-empty";

  if (battery.pct >= 76) {
    filledSlots = 4;
    levelClass = "is-high";
  } else if (battery.pct >= 51) {
    filledSlots = 3;
    levelClass = "is-medium";
  } else if (battery.pct >= 26) {
    filledSlots = 2;
    levelClass = "is-low";
  } else if (battery.pct > 10) {
    filledSlots = 1;
    levelClass = "is-danger";
  } else if (battery.pct > 0) {
    filledSlots = 1;
    levelClass = "is-critical";
  }

  const slots = [0, 1, 2, 3].map((index) => {
    const filledClass = index < filledSlots ? " is-filled" : "";
    return `<span class="battery-cell${filledClass}"></span>`;
  }).join("");

  return `
    <span class="battery-widget ${levelClass}" aria-label="剩余电量：${filledSlots}格" title="剩余电量：${battery.pct}%">
      <span class="battery-shell" aria-hidden="true">
        <span class="battery-cells">${slots}</span>
      </span>
    </span>
  `;
}

function renderNewBadge() {
  return `<span class="new-badge">NEW</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDiscoveredSpecies(fieldGuide) {
  const discoveryOrder = Array.isArray(fieldGuide.discoveryOrder)
    ? fieldGuide.discoveryOrder
    : [];
  const seenSpeciesIds = new Set();

  return discoveryOrder
    .filter((speciesId) => {
      if (typeof speciesId !== "string" || seenSpeciesIds.has(speciesId)) {
        return false;
      }

      seenSpeciesIds.add(speciesId);
      return true;
    })
    .map((speciesId) => speciesList.find((species) => species.id === speciesId))
    .filter(Boolean);
}

function normalizeFieldGuideSpeciesIndex(totalCount = speciesList.length) {
  if (totalCount <= 0) {
    fieldGuideSpeciesIndex = 0;
    return;
  }

  if (fieldGuideSpeciesIndex < 0 || fieldGuideSpeciesIndex >= totalCount) {
    fieldGuideSpeciesIndex = Math.max(0, Math.min(fieldGuideSpeciesIndex, totalCount - 1));
  }
}

function getCardsForSpecies(speciesId) {
  const rarityOrder = {
    PRECIOUS: 0,
    REMARKABLE: 1,
    INTERESTING: 2,
    NORMAL: 3
  };

  return cardList
    .filter((card) => card.speciesId === speciesId)
    .sort((left, right) => {
      const leftRank = rarityOrder[left.rarity] ?? 99;
      const rightRank = rarityOrder[right.rarity] ?? 99;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.id.localeCompare(right.id);
    });
}

function getSnapshotBatteryPercent(snapshot) {
  if (
    !snapshot
    || !Number.isFinite(snapshot.batteryRemaining)
    || !Number.isFinite(snapshot.batteryMax)
    || snapshot.batteryMax <= 0
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((snapshot.batteryRemaining / snapshot.batteryMax) * 100)));
}

function getSnapshotSpotName(snapshot) {
  if (!snapshot || !snapshot.spotId) {
    return null;
  }

  const spotExists = getAllSpots().some((item) => item.id === snapshot.spotId);
  const spot = spotExists ? getSpotById(snapshot.spotId) : null;
  return spot ? spot.name : null;
}

function renderFieldGuideDetailCornerHtml() {
  return `
    <span class="field-guide-detail-corner corner-tl"></span>
    <span class="field-guide-detail-corner corner-tr"></span>
    <span class="field-guide-detail-corner corner-bl"></span>
    <span class="field-guide-detail-corner corner-br"></span>
  `;
}

function renderFieldGuideDetailPolaroid(card, snapshot) {
  if (!snapshot) {
    return `
      <div class="field-guide-detail-polaroid">
        <div class="field-guide-detail-polaroid-paper">
          <div class="field-guide-detail-polaroid-frame">
            <div class="field-guide-detail-no-snapshot">本卡无拍摄记录</div>
          </div>
        </div>
      </div>
    `;
  }

  const focusClassName = snapshot.focusAffix === "IN_FOCUS" ? "is-green" : "is-blur";
  const focusGradeClass = getPolaroidFocusGradeClass(snapshot);
  const badgeClassName = [
    "field-guide-detail-badge",
    "behavior-badge",
    getStateClassFromCapturedState(snapshot.capturedState),
    snapshot.focusAffix === "BLUR" ? "is-blur" : "",
    focusGradeClass
  ].filter(Boolean).join(" ");
  const crownHtml = shouldShowPolaroidCrown(snapshot)
    ? `<span class="field-guide-detail-crown">♛</span>`
    : "";
  const badgeRelX = clampPolaroidPercent(snapshot.badgeRelX);
  const badgeRelY = clampPolaroidPercent(snapshot.badgeRelY);

  return `
    <div class="field-guide-detail-polaroid">
      <div class="field-guide-detail-polaroid-paper">
        <div class="field-guide-detail-polaroid-frame">
          <div class="field-guide-detail-focus-area ${focusClassName}">
            ${renderFieldGuideDetailCornerHtml()}
          </div>
          <div class="${badgeClassName}" style="left: ${badgeRelX}%; top: ${badgeRelY}%;">${escapeHtml(card.title)}</div>
        </div>
        <div class="field-guide-detail-date">${formatPolaroidDate(snapshot.realTimestamp)}</div>
        ${crownHtml}
      </div>
    </div>
  `;
}

function renderContextItem(label, value, sub = "") {
  const subHtml = sub ? `<div class="field-guide-context-sub">${escapeHtml(sub)}</div>` : "";

  return `
    <div class="field-guide-context-item">
      <div class="field-guide-context-label">${escapeHtml(label)}</div>
      <div class="field-guide-context-value">${escapeHtml(value)}</div>
      ${subHtml}
    </div>
  `;
}

function renderFieldGuideCardDetail(species, card, entry) {
  const snapshot = entry ? entry.snapshot : null;
  const turnMax = snapshot && Number.isFinite(snapshot.turnMax) ? snapshot.turnMax : gameState.maxTurns;
  const turnText = snapshot && Number.isFinite(snapshot.turn)
    ? `第 ${snapshot.turn} 回合 / ${turnMax}`
    : "—";
  const spotText = getSnapshotSpotName(snapshot) || "—";
  const batteryPercent = getSnapshotBatteryPercent(snapshot);
  const batteryText = batteryPercent === null ? "—" : `${batteryPercent}%`;
  const focusText = snapshot && Number.isFinite(snapshot.focusScore)
    ? `${snapshot.focusScore}%${snapshot.focusGrade ? ` ${snapshot.focusGrade}` : ""}`
    : "—";

  elements.detailPanel.innerHTML = `
    <section class="field-guide-detail-view" aria-label="${escapeHtml(species.name)}卡牌详情">
      <div class="field-guide-detail-toolbar">
        <button class="field-guide-detail-back button-ghost" type="button" data-action="fieldGuideDetailBack">◀ 返回图鉴</button>
      </div>
      <section class="field-guide-detail-card-info">
        <div class="field-guide-card-title-row">
          ${renderRarityBadge(card)}
          <h2 class="field-guide-detail-card-title">${escapeHtml(card.title)}</h2>
        </div>
        <p class="field-guide-detail-card-description">${escapeHtml(card.description)}</p>
      </section>
      <div class="field-guide-context-grid">
        ${renderContextItem("拍摄回合", turnText)}
        ${renderContextItem("拍摄地点", spotText)}
        ${renderContextItem("拍摄时电量", batteryText)}
        ${renderContextItem("对焦精度", focusText)}
      </div>
      ${renderFieldGuideDetailPolaroid(card, snapshot)}
    </section>
  `;
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

/**
 * 启动或停止 FOCUS 动画。
 *
 * 注意：
 * - rAF 只应存在于 PHOTO / FOCUS 或离场动画期间。
 * - moving badge 的位置来自 focusEngine，显示状态来自 focusSequence。
 */
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
    elements.actionPanel.append(createButton("查看图鉴", "fieldGuide", "system", "button-ghost"));
    return;
  }

  if (gameState.mode === "START_SPOT_SELECT") {
    getAllSpots().forEach((spot) => {
      elements.actionPanel.append(createButton(`从这里开始：${spot.name}`, spot.id, "startSpot"));
    });
    elements.actionPanel.append(createButton("返回", "back", "system", "button-ghost"));
    return;
  }

  if (gameState.mode === "EXPLORE") {
    elements.actionPanel.append(createActionRow([
      createButton("观察当前方向", "observe", "explore", "button-major")
    ]));
    elements.actionPanel.append(createActionRow([
      createButton("向左转", "turnLeft", "explore"),
      createButton("向右转", "turnRight", "explore")
    ], "action-row action-row-two"));
    elements.actionPanel.append(createActionRow([
      createButton("倾听远处的声音", "listenDistant", "explore")
    ]));
    elements.actionPanel.append(createActionRow([
      createButton("提前撤离并结算", "retreat", "explore")
    ]));
    elements.actionPanel.append(createActionRow([
      createButton("查看图鉴", "fieldGuide", "system", "button-ghost")
    ]));
    return;
  }

  if (gameState.mode === "DISTANT_LISTEN") {
    gameState.distantListenOptions.forEach((option) => {
      elements.actionPanel.append(createButton(`前往${option.spotName}`, option.spotId, "distantListen", "button-major"));
    });
    elements.actionPanel.append(createButton("观察当前方向", "observe", "distantListen"));
    elements.actionPanel.append(createButton("再听一会", "listenAgain", "distantListen"));
    return;
  }

  if (gameState.mode === "SPOT_SELECT") {
    gameState.availableSpotOptions.forEach((spot) => {
      elements.actionPanel.append(createButton(`前往：${spot.name}`, spot.id, "spot", "button-major"));
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
      elements.actionPanel.append(createButton("按下快门", "shoot", "photo", "is-shutter-action"));
      return;
    }

    if (gameState.photoPhase === "REPOSITION") {
      elements.actionPanel.append(createButton("寻找位置", "reposition", "photo", "button-major"));
      return;
    }

    if (gameState.photoPhase === "LOST") {
      elements.actionPanel.append(createButton("放下相机", "putDownCamera", "photo"));
      return;
    }

    if (gameState.photoPhase === "RESULT") {
      elements.actionPanel.append(createButton("继续跟焦", "refocus", "photo", "button-major"));
      elements.actionPanel.append(createButton("再等一等", "wait", "photo"));
      elements.actionPanel.append(createButton("放弃拍摄", "giveUp", "photo"));
      return;
    }

    elements.actionPanel.append(createButton("举起相机", "raiseCamera", "photo", "button-major"));
    elements.actionPanel.append(createButton("再等一等", "wait", "photo"));
    elements.actionPanel.append(createButton("放弃拍摄", "giveUp", "photo"));
    return;
  }

  if (gameState.mode === "FIELD_GUIDE") {
    if (gameState.previousMode === "START" || !gameState.previousMode) {
      elements.actionPanel.append(createButton("开始游戏", "start", "system", "button-major"));
    }

    if (gameState.previousMode && gameState.previousMode !== "START") {
      elements.actionPanel.append(createButton("返回", "back", "system"));
    }
    return;
  }

  if (gameState.mode === "SETTLEMENT") {
    elements.actionPanel.append(createButton("重新开始", "start", "system", "button-major"));
    elements.actionPanel.append(createButton("查看图鉴", "fieldGuide", "system", "button-ghost"));
  }
}

function renderLogs() {
  elements.logList.innerHTML = "";

  // 日志是历史记录，允许保留当时的 nickname / 真名差异；结算会按当前图鉴状态统一显示。
  gameState.logs.slice(0, LOG_LIMIT).forEach((logText) => {
    const item = document.createElement("li");
    item.innerHTML = renderLogTextHtml(logText);
    elements.logList.append(item);
  });
}

function renderMapHtml() {
  const mapInfo = getSurroundingSpotMap(gameState);

  return `
    <section class="text-map" aria-label="周边地图">
      <h3>周边地图</h3>
      <div class="map-grid">
        <div class="map-node map-front">${mapInfo.front}</div>
        <div class="map-connector map-connector-up">↑<span aria-hidden="true">&nbsp;</span></div>
        <div class="map-node map-left">${mapInfo.left}</div>
        <div class="map-connector map-connector-left">←</div>
        <div class="map-node map-center">${mapInfo.currentSpot.name}</div>
        <div class="map-connector map-connector-right">→</div>
        <div class="map-node map-right">${mapInfo.right}</div>
        <div class="map-connector map-connector-down"><span aria-hidden="true">&nbsp;</span>↓</div>
        <div class="map-node map-back">${mapInfo.back}</div>
      </div>
      <p>当前位置：${mapInfo.currentSpot.name}</p>
      <p>当前面向：${mapInfo.facingName}</p>
    </section>
  `;
}

function renderFieldGuide() {
  const guide = gameState.fieldGuide;
  const discoveredSpecies = getDiscoveredSpecies(guide);
  normalizeFieldGuideSpeciesIndex(discoveredSpecies.length);
  const clearGuideButtonHtml = `
    <div class="field-guide-bottom-actions">
      <button class="field-guide-clear-button" type="button" data-action="clearGuide">清空图鉴</button>
    </div>
  `;

  if (discoveredSpecies.length === 0) {
    elements.detailPanel.innerHTML = `
      <section class="field-guide-page field-guide-empty">
        <h2>图鉴</h2>
        <p class="field-guide-empty-title">图鉴还是空白的。</p>
        <p class="field-guide-empty-desc">去野外，遇见你的第一只鸟。</p>
        ${clearGuideButtonHtml}
      </section>
    `;
    return;
  }

  const species = discoveredSpecies[fieldGuideSpeciesIndex];
  const knowledgeState = getSpeciesKnowledgeState(guide, species.id);
  const isCataloguedSpecies = knowledgeState === "CATALOGUED";
  const shouldRevealCataloguedPage = isCataloguedSpecies && species.id === recentlyCataloguedSpeciesId;
  const collectedCardIds = getCollectedCardIds(guide);
  const collectedCardsForSpecies = isCataloguedSpecies
    ? getCardsForSpecies(species.id).filter((card) => collectedCardIds.includes(card.id))
    : [];
  const detailCard = fieldGuideDetailCardId
    ? collectedCardsForSpecies.find((card) => card.id === fieldGuideDetailCardId)
    : null;
  const detailEntry = fieldGuideDetailCardId
    ? getCollectedCardEntry(guide, fieldGuideDetailCardId)
    : null;

  if (fieldGuideDetailCardId && isCataloguedSpecies && detailCard && detailEntry) {
    renderFieldGuideCardDetail(species, detailCard, detailEntry);
    return;
  }

  if (fieldGuideDetailCardId) {
    fieldGuideDetailCardId = null;
  }

  const collectedCount = collectedCardsForSpecies.length;
  const speciesTitle = isCataloguedSpecies ? species.name : "？？？";
  const progressText = isCataloguedSpecies
    ? `已收集 ${collectedCount} 张`
    : "已发现，但还不知道它的名字。";
  const knowledgeNote = isCataloguedSpecies ? "已加新" : "";
  const revealAttrs = (order) => {
    if (!shouldRevealCataloguedPage) {
      return "";
    }

    return ` field-guide-reveal" style="--field-guide-reveal-delay: ${Math.min(order * 80, 720)}ms`;
  };
  const knowledgeNoteHtml = knowledgeNote
    ? `<p class="field-guide-knowledge-note${revealAttrs(1)}">${knowledgeNote}</p>`
    : "";
  const catalogueButtonHtml = isCataloguedSpecies
    ? ""
    : `<button class="field-guide-catalogue-button button-accent" type="button" data-species-id="${species.id}">为它加新</button>`;
  const pageTabs = discoveredSpecies.map((item, index) => {
    const className = index === fieldGuideSpeciesIndex
      ? "field-guide-page-tab is-active"
      : "field-guide-page-tab";

    return `<span class="${className}" aria-hidden="true"></span>`;
  });
  const prevButtonHtml = discoveredSpecies.length > 1
    ? `<button class="field-guide-nav-button field-guide-nav-prev" type="button" data-action="fieldGuidePrev" aria-label="上一种鸟">◀</button>`
    : "";
  const nextButtonHtml = discoveredSpecies.length > 1
    ? `<button class="field-guide-nav-button field-guide-nav-next" type="button" data-action="fieldGuideNext" aria-label="下一种鸟">▶</button>`
    : "";
  const pagerClassName = discoveredSpecies.length > 1
    ? "field-guide-pager"
    : "field-guide-pager is-single-page";
  const cardItems = collectedCardsForSpecies.map((card, index) => {
    return `
      <li class="field-guide-card is-collected${revealAttrs(3 + index)}">
        <button class="field-guide-card-button" type="button" data-card-id="${escapeHtml(card.id)}" aria-label="查看${escapeHtml(card.title)}的拍摄记录">
          <span class="field-guide-card-title-row">
            ${renderRarityBadge(card)}
            <strong class="field-guide-card-title">${escapeHtml(card.title)}</strong>
          </span>
          <span class="field-guide-card-description">${escapeHtml(card.description)}</span>
        </button>
      </li>
    `;
  });
  const cardListHtml = isCataloguedSpecies && cardItems.length > 0
    ? `<ul class="field-guide-card-list">${cardItems.join("")}</ul>`
    : "";

  elements.detailPanel.innerHTML = `
    <section class="field-guide-page">
      <div class="field-guide-page-tabs" aria-label="图鉴页数">${pageTabs.join("")}</div>
      <div class="${pagerClassName}">
        ${prevButtonHtml}
        <div class="field-guide-species-header${revealAttrs(0)}">
          <h2 class="field-guide-species-title">${escapeHtml(speciesTitle)}</h2>
          <p class="field-guide-species-progress">${progressText}</p>
        </div>
        ${nextButtonHtml}
      </div>
      ${knowledgeNoteHtml}
      <p class="field-guide-appearance${revealAttrs(2)}">${escapeHtml(species.appearance)}</p>
      ${catalogueButtonHtml}
      ${cardListHtml}
      ${clearGuideButtonHtml}
    </section>
  `;

  if (shouldRevealCataloguedPage) {
    recentlyCataloguedSpeciesId = null;
  }
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
    const displayName = getSpeciesNameForSettlement(gameState, photo.speciesId);

    if (shouldShowNew) {
      shownNewCardIds.push(photo.card.id);
    }

    return `<li class="${className}" style="--reveal-delay: ${revealDelay}ms"><strong>${displayName}</strong> · ${photo.card.title} ${renderRarityBadge(photo.card)}${renderFocusAffixBadge(photo.focusAffix)} ${shouldShowNew ? renderNewBadge() : ""}</li>`;
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
  const behaviorState = getCurrentPhotoState(gameState.currentPhotoSequence);
  const phaseTextByKey = {
    DECISION: "你正在观察它的行为，还没有举起相机。",
    FOCUS: "你已举起相机，正在对焦。",
    REPOSITION: "它暂时离开了取景位置。",
    LOST: "你失去了它的位置。",
    RESULT: "刚拍完一张照片，你可以继续跟焦或再等一等。"
  };
  const phaseText = phaseTextByKey[gameState.photoPhase] || phaseTextByKey.DECISION;
  const timingDetailHtml = gameState.photoPhase === "REPOSITION" || gameState.photoPhase === "LOST"
    ? ""
    : `
    <p>当前时机：${renderBehaviorBadge(behaviorState)}</p>
  `;

  elements.detailPanel.innerHTML = `
    <h2>拍照时机</h2>
    <p>你正在观察：${getSpeciesPhotoDisplayName(bird.speciesId)}</p>
    <p>${phaseText}</p>
    ${timingDetailHtml}
  `;
}

function renderFirstEncounterDetail() {
  const bird = gameState.currentPhotoTarget || {};
  const species = speciesList.find((item) => item.id === bird.speciesId);
  const nickname = species && species.nickname ? species.nickname : "这只鸟";

  elements.detailPanel.innerHTML = `
    <section class="encounter-hint" aria-label="初次发现">
      <p class="encounter-sub">你暂时这样记下它：</p>
      <h2 class="encounter-nickname">${escapeHtml(nickname)}</h2>
      <p class="encounter-sub">你还不知道它的名字。继续，看看能否拍下来。</p>
    </section>
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

function getEventTextClassName() {
  const classNames = [];

  if (gameState.mode === "FIRST_ENCOUNTER") {
    classNames.push("is-new-bird-event");
  }

  if (gameState.eventText.includes("你终于知道了它的名字")) {
    classNames.push("is-catalogue-reveal");
  }

  return classNames.join(" ");
}

function getEventTextRevealKey() {
  return [
    gameState.mode,
    gameState.photoPhase || "",
    gameState.eventHtml || gameState.eventText
  ].join("|");
}

function splitEventTextByChinesePeriod(text) {
  const segments = [];
  let startIndex = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "。") {
      continue;
    }

    const segment = text.slice(startIndex, index + 1).trim();
    if (segment) {
      segments.push(segment);
    }
    startIndex = index + 1;
  }

  const rest = text.slice(startIndex).trim();
  if (rest) {
    segments.push(rest);
  }

  return segments.length > 0 ? segments : [text];
}

function renderFirstEncounterEventText(shouldAnimate, eventTextRevealKey) {
  if (!shouldAnimate && elements.eventText.dataset.revealKey === eventTextRevealKey) {
    return;
  }

  const segments = splitEventTextByChinesePeriod(gameState.eventText);
  const shouldRevealSegments = shouldAnimate && !prefersReducedMotion();
  let delay = 0;

  elements.eventText.dataset.revealKey = eventTextRevealKey;
  elements.eventText.textContent = "";
  segments.forEach((segment, index) => {
    const paragraph = document.createElement("p");
    const segmentClassNames = ["event-text-segment"];
    if (index === 0) {
      segmentClassNames.push("is-lead");
    }
    if (shouldRevealSegments) {
      segmentClassNames.push("is-revealing");
    }
    paragraph.className = segmentClassNames.join(" ");
    paragraph.textContent = segment;
    elements.eventText.append(paragraph);

    if (shouldRevealSegments) {
      paragraph.style.setProperty("--segment-delay", `${delay}ms`);
      paragraph.style.setProperty("--segment-duration", `${FIRST_ENCOUNTER_SEGMENT_REVEAL_MS}ms`);
      delay += clampNumber(
        segment.length * FIRST_ENCOUNTER_SEGMENT_CHAR_MS + FIRST_ENCOUNTER_SEGMENT_PAUSE_MS,
        FIRST_ENCOUNTER_SEGMENT_MIN_MS,
        FIRST_ENCOUNTER_SEGMENT_MAX_MS
      );
    }
  });
}

function renderEventText(shouldAnimate, eventTextRevealKey) {
  elements.eventText.className = getEventTextClassName();

  if (gameState.mode === "FIRST_ENCOUNTER" && !gameState.eventHtml) {
    renderFirstEncounterEventText(shouldAnimate, eventTextRevealKey);
    return;
  }

  delete elements.eventText.dataset.revealKey;
  if (gameState.eventHtml) {
    elements.eventText.innerHTML = gameState.eventHtml;
  } else {
    elements.eventText.textContent = gameState.eventText;
  }

  if (shouldAnimate) {
    restartCssAnimation(elements.eventText, "text-reveal");
  }
}

/**
 * 根据当前 state 重绘界面。
 *
 * 注意：
 * - render 不应推进回合、抽卡或改变业务流程。
 * - 业务变化应在 action 分发到规则函数后再由 render 反映出来。
 */
function render() {
  const currentSpot = getCurrentSpot(gameState);
  const mapInfo = getSurroundingSpotMap(gameState);
  if (gameState.mode !== "PHOTO") {
    clearActivePolaroid();
  }

  elements.mode.textContent = getModeDisplay(gameState.mode);
  elements.turn.textContent = `${gameState.maxTurns - gameState.currentTurn} / ${gameState.maxTurns}`;
  renderStatusBlocks(currentSpot, mapInfo);
  elements.sdCard.innerHTML = renderBatteryWidget(gameState);
  elements.photoTiming.innerHTML = renderPhotoTimingStatus();
  const eventTextRevealKey = getEventTextRevealKey();
  const shouldRevealEventText = eventTextRevealKey !== lastEventTextRevealKey;

  if (shouldRevealEventText) {
    lastEventTextRevealKey = eventTextRevealKey;
  }
  renderEventText(shouldRevealEventText, eventTextRevealKey);

  renderActions();
  renderDetailPanel();
  renderLogs();
  setupFocusAnimationIfNeeded();
}

function showFieldGuide() {
  if (gameState.mode === "SETTLEMENT") {
    isSettlementRevealed = false;
  }

  fieldGuideDetailCardId = null;
  gameState.previousMode = gameState.mode;
  gameState.mode = "FIELD_GUIDE";
  gameState.fieldGuide = loadFieldGuide();
  gameState.eventText = "你翻开图鉴，查看你亲眼见过的记录。";
}

function returnFromFieldGuide() {
  if (gameState.mode === "SETTLEMENT" || gameState.previousMode === "SETTLEMENT") {
    isSettlementRevealed = false;
  }

  gameState.mode = gameState.previousMode || "START";
  fieldGuideDetailCardId = null;
  delete gameState.previousMode;
}

function handleSystemAction(action) {
  if (action === "start") {
    isSettlementRevealed = false;
    fieldGuideDetailCardId = null;
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
    fieldGuideSpeciesIndex = 0;
    fieldGuideDetailCardId = null;
    gameState.eventText = "图鉴已经清空。";
  }

  if (action === "endGame") {
    isSettlementRevealed = false;
    fieldGuideDetailCardId = null;
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
  const discoveredSpecies = getDiscoveredSpecies(gameState.fieldGuide);

  if (gameState.mode !== "FIELD_GUIDE" || discoveredSpecies.length <= 1) {
    return;
  }

  fieldGuideSpeciesIndex = (fieldGuideSpeciesIndex + direction + discoveredSpecies.length) % discoveredSpecies.length;
  fieldGuideDetailCardId = null;
  render();
}

elements.detailPanel.addEventListener("click", (event) => {
  const fieldGuideClearButton = event.target.closest(".field-guide-clear-button");

  if (fieldGuideClearButton) {
    handleSystemAction(fieldGuideClearButton.dataset.action);
    render();
    return;
  }

  const detailBackButton = event.target.closest(".field-guide-detail-back");

  if (detailBackButton) {
    fieldGuideDetailCardId = null;
    render();
    return;
  }

  const fieldGuideCardButton = event.target.closest(".field-guide-card-button");

  if (fieldGuideCardButton) {
    fieldGuideDetailCardId = fieldGuideCardButton.dataset.cardId || null;
    render();
    return;
  }

  const catalogueButton = event.target.closest(".field-guide-catalogue-button");

  if (catalogueButton) {
    const catalogueSpeciesId = catalogueButton.dataset.speciesId || null;
    gameState = handleCatalogueAction(gameState, catalogueButton.dataset.speciesId);
    recentlyCataloguedSpeciesId = catalogueSpeciesId && getSpeciesKnowledgeState(gameState.fieldGuide, catalogueSpeciesId) === "CATALOGUED"
      ? catalogueSpeciesId
      : null;
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
  const previousPhotoCount = isShootAction ? gameState.photos.length : 0;

  if (isShootAction && !canShootNow()) {
    return;
  }

  if (isFocusExiting || (focusTimedOut && isShootAction)) {
    return;
  }

  if (
    type === "photo"
    && action === "refocus"
    && activePolaroidEl
    && activePolaroidEl.isConnected
  ) {
    startActivePolaroidDismiss();
  }

  const pendingEffect = getPendingPhotoEffect(type, action);
  const previousMode = gameState.mode;
  // shoot 的捕获必须发生在分发业务 action 之前，避免下一帧动画导致状态错位。
  const capturedShootBehaviorState = isShootAction ? captureVisibleFocusBehaviorState() : null;
  const capturedFocusAffix = isShootAction ? getFocusAffixFromResult(latestFocusResult) : null;
  const focusSnapshotPayload = isShootAction ? createFocusSnapshotPayload() : {};
  const shouldPlayFocusExit = isShootAction
    && gameState.mode === "PHOTO"
    && gameState.photoPhase === "FOCUS";
  const focusExitStartPosition = shouldPlayFocusExit && latestFocusResult
    ? latestFocusResult.position
    : { x: 0, y: 0 };
  const focusExitState = shouldPlayFocusExit && gameState.currentPhotoSequence
    ? capturedShootBehaviorState
    : null;

  if (type === "photo" && !isShootAction && action !== "refocus") {
    clearActivePolaroid();
  }

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
      capturedFocusAffix,
      ...focusSnapshotPayload
    });
  }

  const latestPolaroidPhoto = isShootAction && gameState.photos.length > previousPhotoCount
    ? gameState.photos[gameState.photos.length - 1]
    : null;

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
  if (latestPolaroidPhoto && latestPolaroidPhoto.snapshot) {
    requestAnimationFrame(() => showPolaroidShot(latestPolaroidPhoto));
  }
});

function hideInitialLoadingMask() {
  const loadingEl = document.getElementById("app-loading");

  if (!loadingEl) {
    return;
  }

  const removeLoading = () => {
    loadingEl.remove();
  };

  loadingEl.addEventListener("transitionend", removeLoading, { once: true });

  requestAnimationFrame(() => {
    loadingEl.classList.add("is-hiding");
  });

  window.setTimeout(() => {
    if (document.body.contains(loadingEl)) {
      loadingEl.remove();
    }
  }, 600);
}

render();
hideInitialLoadingMask();
