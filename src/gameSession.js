/**
 * 模块职责：
 * - 维护主要业务状态机，处理 EXPLORE / PHOTO / SETTLEMENT 等模式切换。
 * - 负责探索行为、观察、拍照动作、图鉴加新和结算触发。
 *
 * 维护边界：
 * - 不访问 DOM，不负责界面渲染。
 * - 不负责 FOCUS 每帧动画，也不负责具体对焦运动计算。
 * - PHOTO 点击瞬间的可见状态与对焦结果由 main.js 捕获后传入。
 */
import { BADGE_ROTATION, MAX_PHOTOS } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { generateClues, getSpeciesById, initializeBirds, updateBirds } from "./birdManager.js";
import { listen, listenDistantSounds, observeCurrentDirection } from "./encounterSystem.js";
import {
  BEHAVIOR_STATE_DISPLAY,
  createPhotoSequence,
  advancePhotoSequence,
  getCurrentPhotoState,
  isBirdGone,
  recordShutterDecision
} from "./photoSequence.js";
import { drawCard } from "./cardDraw.js";
import { getFocusConfig } from "./focusEngine.js";
import { generateFocusSequence } from "./focusSequence.js";
import { addCard, getCollectedCardIds, getSpeciesKnowledgeState, incrementSpeciesPhotoCount, incrementSpeciesSeenCount, markCatalogued, markHeard, markSeen } from "./fieldGuide.js";
import { createRarityBadgeHtml, getRarityDisplay } from "./rarityDisplay.js";
import { getAllSpots, getAvailableSpotOptions, getCurrentSpot, getSpotById, getSurroundingSpotMap } from "./spotManager.js";

function addLog(state, message) {
  state.logs.unshift(message);
}

function advanceTurn(state, turnCost = 1) {
  state.currentTurn += turnCost;
  state.activeBirds = updateBirds(state);

  if (state.currentTurn >= state.maxTurns) {
    return endGame(state, "time");
  }

  return state;
}

function getDirectionName(state) {
  return getSurroundingSpotMap(state).facingName;
}

function getBehaviorLabel(behaviorState) {
  const display = BEHAVIOR_STATE_DISPLAY[behaviorState] || BEHAVIOR_STATE_DISPLAY.NORMAL;
  return display.label;
}

function normalizeCaptureBehaviorState(value) {
  if (value === "NORMAL" || value === "INTERESTING" || value === "REMARKABLE") {
    return value;
  }

  return null;
}

function normalizePhotoFocusAffix(focusAffix) {
  return focusAffix === "BLUR" ? "BLUR" : "IN_FOCUS";
}

function getTimeOfDayLabel(state) {
  const maxTurns = Number.isFinite(state && state.maxTurns) ? state.maxTurns : 30;
  const currentTurn = Number.isFinite(state && state.currentTurn) ? state.currentTurn : 0;
  const remainingTurns = Math.max(0, maxTurns - currentTurn);

  if (remainingTurns >= 25) {
    return "清晨";
  }

  if (remainingTurns >= 19) {
    return "上午";
  }

  if (remainingTurns >= 13) {
    return "中午";
  }

  if (remainingTurns >= 7) {
    return "下午";
  }

  return "黄昏";
}

function normalizeBirdDistance(distance) {
  if (distance === "near" || distance === "medium" || distance === "far") {
    return distance;
  }

  return "medium";
}

function getDistanceEncounterText(distance, { isFirstEncounter = false } = {}) {
  const safeDistance = normalizeBirdDistance(distance);

  if (safeDistance === "near") {
    return isFirstEncounter
      ? "距离很近，你甚至能听到它翅膀轻轻擦过空气。"
      : "它离得很近，羽毛上的细节几乎能一笔笔看清。";
  }

  if (safeDistance === "far") {
    return isFirstEncounter
      ? "距离有些远，你只能先记住它的大致形状。"
      : "它在视野尽头，只剩一个小小的轮廓。";
  }

  return "";
}

function getFocusAffixDisplay(focusAffix) {
  if (normalizePhotoFocusAffix(focusAffix) === "BLUR") {
    return { key: "BLUR", label: "失焦" };
  }

  return { key: "IN_FOCUS", label: "正常" };
}

function getFocusAffixText(focusAffix) {
  const display = getFocusAffixDisplay(focusAffix);
  return display.key === "BLUR" ? `【${display.label}】` : "";
}

function createFocusAffixBadgeHtml(focusAffix) {
  const display = getFocusAffixDisplay(focusAffix);

  if (display.key !== "BLUR") {
    return "";
  }

  return `<span class="focus-affix-badge is-blur">${display.label}</span>`;
}

function clampSnapshotNumber(value, fallback, min, max) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}

function normalizeSnapshotScale(value) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeSnapshotRotation(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const maxDegrees = Math.max(Number(BADGE_ROTATION.maxDegrees) || 30, 0);
  return Math.max(-maxDegrees, Math.min(maxDegrees, value));
}

function normalizeSnapshotSplitStop(value) {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(10, Math.min(90, value));
}

function getSnapshotFocusGrade(focusScore) {
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

function normalizeSnapshotFocusGrade(value, focusScore) {
  if (value === "数毛" || value === "清晰" || value === "尚可" || value === "失焦") {
    return value;
  }

  return getSnapshotFocusGrade(focusScore);
}

function createPhotoSnapshot(state, focusAffix, capturedState, options) {
  const nextPhotoCount = state.photos.length + 1;
  const currentBird = state.currentPhotoTarget;
  const fallbackFocusScore = focusAffix === "IN_FOCUS" ? 100 : 50;
  const badgeRelX = clampSnapshotNumber(options.badgeRelX, 50, 0, 100);
  const badgeRelY = clampSnapshotNumber(options.badgeRelY, 50, 0, 100);
  const focusScore = Math.round(clampSnapshotNumber(options.focusScore, fallbackFocusScore, 0, 100));
  const splitStop = normalizeSnapshotSplitStop(options.splitStop);

  const snapshot = {
    turn: state.currentTurn,
    turnMax: state.maxTurns,
    spotId: state.currentSpotId,
    batteryRemaining: Math.max(0, state.maxPhotos - nextPhotoCount),
    batteryMax: state.maxPhotos,
    focusAffix,
    badgeRelX,
    badgeRelY,
    capturedState,
    distance: normalizeBirdDistance(currentBird && currentBird.distance),
    finalScale: normalizeSnapshotScale(options.finalScale),
    badgeRotation: normalizeSnapshotRotation(options.badgeRotation),
    focusScore,
    focusGrade: normalizeSnapshotFocusGrade(options.focusGrade, focusScore),
    realTimestamp: Date.now()
  };

  if (Number.isFinite(options.speciesPhotoIndex)) {
    snapshot.speciesPhotoIndex = Math.max(1, Math.floor(options.speciesPhotoIndex));
  }

  if (Number.isFinite(splitStop)) {
    snapshot.splitStop = splitStop;
  }

  return snapshot;
}

function createFocusSequenceSeed(state, outerBehaviorState) {
  const bird = state.currentPhotoTarget || {};
  const source = [
    bird.instanceId || bird.speciesId || "unknown",
    outerBehaviorState || "NORMAL",
    state.currentTurn,
    state.photos.length,
    state.currentPhotoSequence ? state.currentPhotoSequence.shutterCount : 0,
    Date.now()
  ].join("|");
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function clearFocusSequence(state) {
  state.currentFocusSequence = null;
}

function enterFocusPhase(state, eventText) {
  const bird = state.currentPhotoTarget;
  const outerBehaviorState = getCurrentPhotoState(state.currentPhotoSequence);
  const speciesId = bird ? bird.speciesId : "";
  const focusConfig = getFocusConfig(speciesId, outerBehaviorState);
  const sequence = generateFocusSequence(
    focusConfig,
    outerBehaviorState,
    createFocusSequenceSeed(state, outerBehaviorState)
  );
  const firstSegment = sequence.segments[0] || { state: outerBehaviorState };

  state.photoPhase = "FOCUS";
  state.currentFocusSequence = {
    ...sequence,
    segmentIndex: 0,
    startedAt: 0,
    outerBehaviorState,
    currentVisibleState: firstSegment.state || outerBehaviorState
  };
  state.eventText = eventText;
  state.eventHtml = "";
  addLog(state, state.eventText);

  return state;
}

function getBehaviorBadgeClassName(behaviorState) {
  const classNameByState = {
    NORMAL: "rarity-normal",
    INTERESTING: "rarity-interesting",
    REMARKABLE: "rarity-remarkable"
  };

  return classNameByState[behaviorState] || classNameByState.NORMAL;
}

function createBehaviorBadgeHtml(behaviorState) {
  const safeBehaviorState = normalizeCaptureBehaviorState(behaviorState) || "NORMAL";
  const display = BEHAVIOR_STATE_DISPLAY[safeBehaviorState] || BEHAVIOR_STATE_DISPLAY.NORMAL;
  return `<span class="behavior-badge rarity-badge ${getBehaviorBadgeClassName(safeBehaviorState)}">${display.label}</span>`;
}

function getCurrentBehaviorMessage(photoSequence) {
  const behaviorState = getCurrentPhotoState(photoSequence);
  return `它现在正处于【${getBehaviorLabel(behaviorState)}】状态。`;
}

function getCurrentBehaviorMessageHtml(photoSequence) {
  const behaviorState = getCurrentPhotoState(photoSequence);
  return `它现在正处于${createBehaviorBadgeHtml(behaviorState)}状态。`;
}

function getStillInViewMessage(photoSequence) {
  const behaviorState = getCurrentPhotoState(photoSequence);
  return `它还在视野里，正处于【${getBehaviorLabel(behaviorState)}】状态。`;
}

function getStillInViewMessageHtml(photoSequence) {
  const behaviorState = getCurrentPhotoState(photoSequence);
  return `它还在视野里，正处于${createBehaviorBadgeHtml(behaviorState)}状态。`;
}

function getRepositionFoundMessage(state, photoSequence) {
  const behaviorState = getCurrentPhotoState(photoSequence);
  return `你在${getDirectionName(state)}重新跟上了它，它变成了【${getBehaviorLabel(behaviorState)}】，还可以继续拍。`;
}

function getRepositionFoundMessageHtml(state, photoSequence) {
  const behaviorState = getCurrentPhotoState(photoSequence);
  return `你在${getDirectionName(state)}重新跟上了它，它变成了 ${createBehaviorBadgeHtml(behaviorState)}，还可以继续拍。`;
}

function getContinueShootingMessage(photoSequence) {
  const behaviorState = getCurrentPhotoState(photoSequence);
  return `它变成了【${getBehaviorLabel(behaviorState)}】，还可以继续拍。`;
}

function getContinueShootingMessageHtml(photoSequence) {
  const behaviorState = getCurrentPhotoState(photoSequence);
  return `它变成了${createBehaviorBadgeHtml(behaviorState)}，还可以继续拍。`;
}

function getSpeciesKnownName(state, species) {
  const knowledgeState = getSpeciesKnowledgeState(state.fieldGuide, species.id);
  return knowledgeState === "CATALOGUED" ? species.name : species.nickname;
}

function getHeardSpeciesText(state, speciesId) {
  if (!speciesId) {
    return "没有听到清楚的鸟鸣。";
  }

  const species = getSpeciesById(speciesId);
  const knowledgeState = getSpeciesKnowledgeState(state.fieldGuide, speciesId);

  if (knowledgeState === "CATALOGUED") {
    return `你听到${species.name}在叫。`;
  }

  if (knowledgeState === "SEEN") {
    return `你听到${species.nickname}的声音。`;
  }

  return "你听到某种鸟叫，和之前记下的线索有点像。";
}

function enterFirstEncounterMode(state, bird) {
  const species = getSpeciesById(bird.speciesId);
  const distanceText = getDistanceEncounterText(bird.distance, { isFirstEncounter: true });
  const appearanceText = species.firstEncounterAppearance || species.appearance || "";

  state.mode = "FIRST_ENCOUNTER";
  state.photoPhase = null;
  state.currentPhotoTarget = bird;
  state.currentPhotoSequence = null;
  state.eventText = `你发现了一只还叫不出名字的鸟。${distanceText}${appearanceText}`;
  state.eventHtml = "";
  addLog(state, "你发现了一只还叫不出名字的鸟。");
}

function enterPhotoMode(state, bird) {
  state.mode = "PHOTO";
  state.photoPhase = "DECISION";
  state.currentPhotoTarget = bird;
  state.currentPhotoSequence = createPhotoSequence(bird.speciesId);
  clearFocusSequence(state);

  const species = getSpeciesById(bird.speciesId);
  const knowledgeState = getSpeciesKnowledgeState(state.fieldGuide, bird.speciesId);
  const encounterName = getSpeciesKnownName(state, species);
  const distanceText = getDistanceEncounterText(bird.distance, { isFirstEncounter: false });

  if (knowledgeState === "CATALOGUED") {
    state.eventText = `你看见了${encounterName}。${distanceText}${getCurrentBehaviorMessage(state.currentPhotoSequence)}`;
    state.eventHtml = `你看见了${encounterName}。${distanceText}${getCurrentBehaviorMessageHtml(state.currentPhotoSequence)}`;
    addLog(state, `看见${encounterName}，进入观察判断。`);
    return;
  }

  state.eventText = `你再次看见了${encounterName}。${distanceText}${getCurrentBehaviorMessage(state.currentPhotoSequence)}`;
  state.eventHtml = `你再次看见了${encounterName}。${distanceText}${getCurrentBehaviorMessageHtml(state.currentPhotoSequence)}`;
  addLog(state, `再次看见${encounterName}，进入观察判断。`);
}

function enterObservedBirdMode(state, bird) {
  const knowledgeState = getSpeciesKnowledgeState(state.fieldGuide, bird.speciesId);
  incrementSpeciesSeenCount(state.fieldGuide, bird.speciesId);

  if (knowledgeState === "UNKNOWN" || knowledgeState === "HEARD") {
    enterFirstEncounterMode(state, bird);
    return;
  }

  enterPhotoMode(state, bird);
}

function turnDirection(state, offset) {
  const directionCount = state.directions.length;
  state.facingDirection = (state.facingDirection + offset + directionCount) % directionCount;
  state.eventText = `你转向${getDirectionName(state)}。${generateClues(state)}`;
  addLog(state, `转向${getDirectionName(state)}。`);
  return advanceTurn(state);
}

function enterSpotSelectMode(state) {
  // 旧版鸟点选择流程，当前主流程使用 DISTANT_LISTEN，暂不暴露在 UI，保留给后续地图选点。
  const currentSpot = getCurrentSpot(state);
  state.availableSpotOptions = getAvailableSpotOptions(state.currentSpotId);
  state.mode = "SPOT_SELECT";
  state.eventText = `你在${currentSpot.name}停下脚步，分辨周围鸟点传来的动静。`;
  addLog(state, "你分辨周围鸟点传来的动静，辨认出几个可能前往的鸟点。");
  return advanceTurn(state);
}

function clearDistantListenOptions(state) {
  state.distantListenOptions = [];
}

function recordHeardSpecies(state, speciesId) {
  if (!speciesId) {
    return;
  }

  const isNewHeard = markHeard(state.fieldGuide, speciesId);
  if (isNewHeard && !state.sessionHeardSpeciesIds.includes(speciesId)) {
    state.sessionHeardSpeciesIds.push(speciesId);
  }
}

function getUnlockedCardIds(fieldGuide) {
  return getCollectedCardIds(fieldGuide);
}

function getStartSpotOptions() {
  const allSpots = getAllSpots();
  const startSpots = allSpots.filter((spot) => spot.isStartSpot === true);

  return startSpots.length > 0 ? startSpots : allSpots;
}

function resolveStartSpot(spotId) {
  const startSpots = getStartSpotOptions();
  return startSpots.find((spot) => spot.id === spotId) || startSpots[0] || getSpotById(spotId);
}

function updateDistantListenResult(state, introText) {
  const result = listenDistantSounds(state);

  result.distantClues.forEach((clue) => {
    clue.text = getHeardSpeciesText(state, clue.heardSpeciesId);
  });

  const distantLines = result.distantClues.length > 0
    ? result.distantClues.map((clue) => `${clue.spotName}：${clue.text}`).join("\n")
    : "周围鸟点的动静还太散，暂时分不出来自哪里。";

  state.eventText = `${introText}\n\n${distantLines}`;
  state.availableSpotOptions = [];
  state.distantListenOptions = result.distantClues;

  result.heardSpeciesIds.forEach((speciesId) => {
    recordHeardSpecies(state, speciesId);
  });
}

function getFlyAwayMessage() {
  return "它察觉到动静，振翅飞离了视野。";
}

function getPhotoWaitMessage(previousState, nextState) {
  if (nextState === "FLY_AWAY") {
    return getFlyAwayMessage();
  }

  if (previousState === nextState) {
    const steadyMessages = {
      NORMAL: "你又等了一会儿，它仍安静地停着。",
      INTERESTING: "你继续看着，它的小动作还在持续。",
      REMARKABLE: "这一瞬还没有过去，机会仍在眼前。",
      PRECIOUS: "难得的瞬间还停在眼前。"
    };

    return steadyMessages[nextState] || "你又等了一会儿，周围的动静还在继续。";
  }

  if (nextState === "PRECIOUS") {
    return "你跟住了节奏，更好的瞬间出现了。";
  }

  if (previousState === "PRECIOUS") {
    return "精彩的一瞬过去了，但它还没有离开。";
  }

  const transitionKey = `${previousState}->${nextState}`;
  const transitionMessages = {
    "NORMAL->INTERESTING": "你多等了一会儿，它忽然有了动作。",
    "INTERESTING->REMARKABLE": "你抓住了节奏，更好的瞬间出现了。",
    "NORMAL->REMARKABLE": "你屏住呼吸，精彩的一瞬突然出现。",
    "REMARKABLE->INTERESTING": "精彩的一瞬过去了，但它还没有离开。",
    "INTERESTING->NORMAL": "它的动作慢慢平静下来。",
    "REMARKABLE->NORMAL": "它很快安静下来，机会淡了下去。"
  };

  return transitionMessages[transitionKey] || "你继续等待，鸟的状态有了新的变化。";
}

const RARITY_RANK = {
  NORMAL: 1,
  INTERESTING: 2,
  REMARKABLE: 3,
  PRECIOUS: 4
};

function getMomentComment(card, behaviorState) {
  const rarity = card.rarity || "NORMAL";

  if (rarity === "PRECIOUS") {
    return "这一瞬抓住了。";
  }

  const behaviorRank = RARITY_RANK[behaviorState] || RARITY_RANK.NORMAL;
  const rarityRank = RARITY_RANK[rarity] || RARITY_RANK.NORMAL;

  if (rarityRank > behaviorRank) {
    return "刚好抓住了。";
  }

  if (rarityRank < behaviorRank) {
    return "差一点。";
  }

  if (Math.random() < 0.25) {
    return "时机刚好。";
  }

  return "";
}

function getShutterMessage(card, behaviorState, focusAffix = "IN_FOCUS") {
  const rarityDisplay = getRarityDisplay(card);
  const title = card.title || "未命名照片";
  const description = card.description || "这张照片还没有记录具体内容。";
  const momentComment = getMomentComment(card, behaviorState);

  return `咔擦！${momentComment}获得【${rarityDisplay.label}】${getFocusAffixText(focusAffix)}照片：${title}\n${description}`;
}

function getShutterMessageHtml(card, behaviorState, focusAffix = "IN_FOCUS") {
  const title = card.title || "未命名照片";
  const description = card.description || "这张照片还没有记录具体内容。";
  const momentComment = getMomentComment(card, behaviorState);

  return `咔擦！${momentComment}获得${createRarityBadgeHtml(card)}${createFocusAffixBadgeHtml(focusAffix)}照片：<strong>${title}</strong><br>${description}`;
}

export function startGame() {
  const state = createDefaultGameState();
  state.mode = "START_SPOT_SELECT";
  state.eventText = "从一个鸟点开始今天的观察。";
  addLog(state, "准备开始今天的观鸟，先选一个鸟点。");
  return state;
}

export function startGameAtSpot(spotId) {
  const state = createDefaultGameState();
  const currentSpot = resolveStartSpot(spotId);
  state.unlockedCardIdsAtRunStart = getUnlockedCardIds(state.fieldGuide);
  state.currentSpotId = currentSpot.id;
  state.facingDirection = 0;
  state.mode = "EXPLORE";
  state.activeBirds = initializeBirds(currentSpot);
  state.eventText = `你来到${currentSpot.name}，面向${getDirectionName(state)}。${generateClues(state)}`;
  addLog(state, `你从${currentSpot.name}开始了今天的观鸟。`);
  return state;
}

/**
 * 处理探索阶段按钮 action。
 *
 * 注意：
 * - observe 会进入观察 / 遭遇逻辑，可能转入 FIRST_ENCOUNTER 或 PHOTO。
 * - PHOTO 子阶段按钮不应在这里处理。
 */
export function handleExploreAction(state, action) {
  if (state.mode !== "EXPLORE") {
    return state;
  }

  if (action === "turnLeft") {
    return turnDirection(state, -1);
  }

  if (action === "turnRight") {
    return turnDirection(state, 1);
  }

  if (action === "turnBack") {
    // 预留：当前 MVP UI 未显示“转身”，保留给后续方向 HUD 或快速转向。
    return turnDirection(state, 2);
  }

  if (action === "listenFar") {
    // 旧版鸟点选择流程，当前主流程使用 DISTANT_LISTEN，暂不暴露在 UI，保留给后续地图选点。
    return enterSpotSelectMode(state);
  }

  if (action === "retreat") {
    addLog(state, "你决定今天先回家，带着已有记录慢慢整理。");
    return endGame(state, "retreat");
  }

  if (action === "listenDistant") {
    if (state.photos.length >= state.maxPhotos) {
      return endGame(state, "battery");
    }

    updateDistantListenResult(state, "你停下来，分辨周围鸟点传来的动静。");
    state.mode = "DISTANT_LISTEN";
    addLog(state, "你停下来，分辨周围鸟点传来的动静。");

    return advanceTurn(state);
  }

  if (action === "listen") {
    // 预留：当前 MVP 使用 observe + distant listen，普通 listen 暂不显示。
    const result = listen(state);
    const heardText = result.heardSpeciesId
      ? `${getHeardSpeciesText(state, result.heardSpeciesId)}方向感更清楚了。`
      : result.message;
    state.eventText = heardText;
    addLog(state, heardText);

    recordHeardSpecies(state, result.heardSpeciesId);

    return advanceTurn(state);
  }

  if (action === "wait") {
    // 探索等待动作，区别于 PHOTO 阶段的 wait。
    state.eventText = `你等了一会儿。${generateClues(state)}`;
    addLog(state, "你等了一会儿，周围的动静有了细微变化。");
    return advanceTurn(state);
  }

  if (action === "observe") {
    const result = observeCurrentDirection(state);

    if (result.found) {
      enterObservedBirdMode(state, result.bird);
      return state;
    }

    state.eventText = result.message;
    addLog(state, result.message);
    return advanceTurn(state);
  }

  return state;
}

export function handleDistantListenAction(state, action) {
  if (state.mode !== "DISTANT_LISTEN") {
    return state;
  }

  if (action === "observe") {
    clearDistantListenOptions(state);
    state.mode = "EXPLORE";
    return handleExploreAction(state, "observe");
  }

  if (action === "listenAgain") {
    updateDistantListenResult(state, "你又停留了一会儿，继续分辨周围鸟点的动静。");
    addLog(state, "你又停留了一会儿，继续分辨周围鸟点的动静。");
    return advanceTurn(state);
  }

  const option = state.distantListenOptions.find((item) => item.spotId === action);

  if (!option) {
    return state;
  }

  const nextSpot = getSpotById(option.spotId);
  state.currentSpotId = nextSpot.id;
  state.availableSpotOptions = [];
  state.activeBirds = initializeBirds(nextSpot);
  clearDistantListenOptions(state);
  state.mode = "EXPLORE";
  state.eventText = `你来到${nextSpot.name}。${nextSpot.soundscape}`;
  addLog(state, `你前往了${nextSpot.name}。`);
  return advanceTurn(state, nextSpot.travelCost);
}

export function handleSpotSelectAction(state, spotId) {
  if (state.mode !== "SPOT_SELECT") {
    return state;
  }

  if (spotId === "stay") {
    const currentSpot = getCurrentSpot(state);
    state.mode = "EXPLORE";
    state.availableSpotOptions = [];
    clearDistantListenOptions(state);
    state.eventText = `你决定继续留在${currentSpot.name}观察。${generateClues(state)}`;
    addLog(state, `你留在${currentSpot.name}，没有切换鸟点。`);
    return state;
  }

  const nextSpot = getSpotById(spotId);
  state.currentSpotId = nextSpot.id;
  state.availableSpotOptions = [];
  clearDistantListenOptions(state);
  state.activeBirds = initializeBirds(nextSpot);
  state.mode = "EXPLORE";
  state.eventText = `你前往${nextSpot.name}。${nextSpot.soundscape}`;
  addLog(state, `切换到${nextSpot.name}，消耗 ${nextSpot.travelCost} 回合。`);
  return advanceTurn(state, nextSpot.travelCost);
}

export function handleFirstEncounterAction(state, action) {
  if (state.mode !== "FIRST_ENCOUNTER" || action !== "continue") {
    return state;
  }

  const bird = state.currentPhotoTarget;
  if (!bird) {
    state.mode = "EXPLORE";
    state.photoPhase = null;
    return state;
  }

  markSeen(state.fieldGuide, bird.speciesId);
  state.mode = "PHOTO";
  state.photoPhase = "DECISION";
  state.currentPhotoSequence = createPhotoSequence(bird.speciesId);
  clearFocusSequence(state);
  state.eventText = getCurrentBehaviorMessage(state.currentPhotoSequence);
  state.eventHtml = getCurrentBehaviorMessageHtml(state.currentPhotoSequence);
  addLog(state, "你先记下它的样子，准备继续观察。");
  return state;
}

export function handleCatalogueAction(state, speciesId) {
  const species = getSpeciesById(speciesId);
  if (!species) {
    return state;
  }

  const wasCatalogued = markCatalogued(state.fieldGuide, speciesId, getTimeOfDayLabel(state));

  if (!wasCatalogued) {
    return state;
  }

  state.eventText = `你终于把它写进了笔记：${species.name}。`;
  state.eventHtml = "";
  addLog(state, `为${species.name}完成加新。`);
  return state;
}

/**
 * 处理 PHOTO 子阶段 action。
 *
 * 注意：
 * - 子阶段包括 DECISION / FOCUS / RESULT / REPOSITION / LOST。
 * - 每个 action 只应在合法 phase 生效；wait 当前只允许 DECISION / RESULT。
 * - shoot 应由 UI 层在允许拍摄时触发，并携带点击瞬间捕获的 payload。
 */
export function handlePhotoAction(state, action, options = {}) {
  if (state.mode !== "PHOTO") {
    return state;
  }

  const bird = state.currentPhotoTarget;
  const species = getSpeciesById(bird.speciesId);
  const behaviorState = getCurrentPhotoState(state.currentPhotoSequence);

  if (action === "raiseCamera" && state.photoPhase === "DECISION") {
    return enterFocusPhase(state, "你举起相机，把它放进取景框里。");
  }

  if (action === "refocus" && state.photoPhase === "RESULT") {
    return enterFocusPhase(state, "你重新跟住它，准备再拍一张。");
  }

  if (action === "raiseCamera") {
    if (state.photoPhase !== "DECISION") {
      return state;
    }

    state.photoPhase = "FOCUS";
    state.eventText = "你举起相机，把它放进取景框里。";
    addLog(state, state.eventText);
    return state;
  }

  if (action === "refocus") {
    if (state.photoPhase !== "RESULT") {
      return state;
    }

    state.photoPhase = "FOCUS";
    state.eventText = "你重新跟住它，准备再拍一张。";
    addLog(state, state.eventText);
    return state;
  }

  if (action === "shoot") {
    if (state.photoPhase !== "FOCUS") {
      return state;
    }

    // 所见即所得核心边界：可见 badge 状态决定抽哪个 rarity 卡池。
    const captureState = normalizeCaptureBehaviorState(options.capturedBehaviorState)
      || normalizeCaptureBehaviorState(behaviorState)
      || "NORMAL";
    // 对焦词缀只记录正常 / 失焦，不反向改变卡牌 rarity。
    const focusAffix = normalizePhotoFocusAffix(options.capturedFocusAffix);
    clearFocusSequence(state);

    if (behaviorState === "FLY_AWAY") {
      state.eventText = getFlyAwayMessage();
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    if (state.photos.length >= MAX_PHOTOS) {
      state.eventText = "电池没有电了，该回家了。";
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    const card = drawCard(bird.speciesId, captureState);

    if (!card) {
      state.eventText = "这次快门没有留下可用照片。";
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    const speciesPhotoIndex = incrementSpeciesPhotoCount(state.fieldGuide, bird.speciesId);
    const snapshot = createPhotoSnapshot(state, focusAffix, captureState, {
      ...options,
      speciesPhotoIndex
    });
    const photo = {
      id: `${Date.now()}_${state.photos.length}`,
      speciesId: bird.speciesId,
      speciesName: getSpeciesKnownName(state, species),
      behaviorState: captureState,
      capturedBehaviorState: captureState,
      focusAffix,
      focusAffixLabel: getFocusAffixDisplay(focusAffix).label,
      card,
      snapshot
    };

    state.photos.push(photo);
    state.currentPhotoSequence = recordShutterDecision(state.currentPhotoSequence);
    const isNewCard = addCard(state.fieldGuide, card, snapshot);

    if (isNewCard) {
      state.sessionNewCards.push(card);
    }

    if (state.photos.length >= MAX_PHOTOS) {
      state.eventText = `${getShutterMessage(card, captureState, focusAffix)}\n\n电池没有电了，该回家了。`;
      state.eventHtml = `${getShutterMessageHtml(card, captureState, focusAffix)}\n\n电池没有电了，该回家了。`;
      addLog(state, state.eventText);
      return enterSettlementFromPhotoMode(state);
    }

    if (isBirdGone(state.currentPhotoSequence)) {
      state.eventText = `${getShutterMessage(card, captureState, focusAffix)}\n\n${getFlyAwayMessage()}`;
      state.eventHtml = `${getShutterMessageHtml(card, captureState, focusAffix)}\n\n${getFlyAwayMessage()}`;
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    state.photoPhase = "RESULT";
    state.eventText = `${getShutterMessage(card, captureState, focusAffix)}\n\n${getContinueShootingMessage(state.currentPhotoSequence)}`;
    state.eventHtml = `${getShutterMessageHtml(card, captureState, focusAffix)}\n\n${getContinueShootingMessageHtml(state.currentPhotoSequence)}`;
    addLog(state, state.eventText);
    return state;
  }

  if (action === "timeout") {
    if (state.photoPhase !== "FOCUS") {
      return state;
    }

    clearFocusSequence(state);
    state.currentPhotoSequence = advancePhotoSequence(state.currentPhotoSequence);

    if (isBirdGone(state.currentPhotoSequence)) {
      // LOST 表示本次已经失去位置，只能放下相机回到探索。
      state.photoPhase = "LOST";
      state.eventText = "这一瞬错过去，它直接飞远了，你失去了它的位置。";
      state.eventHtml = "";
      addLog(state, state.eventText);
      return state;
    }

    // REPOSITION 表示鸟离开当前取景位置但仍在视野中，不能直接当作 LOST 结束观察。
    state.photoPhase = "REPOSITION";
    state.eventText = "它换到了别的地方，但还没有完全离开你的视野。";
    state.eventHtml = "";
    addLog(state, state.eventText);
    return state;
  }

  if (action === "reposition") {
    if (state.photoPhase !== "REPOSITION") {
      return state;
    }

    state.photoPhase = "DECISION";
    state.eventText = getRepositionFoundMessage(state, state.currentPhotoSequence);
    state.eventHtml = getRepositionFoundMessageHtml(state, state.currentPhotoSequence);
    return state;
  }

  if (action === "putDownCamera") {
    if (state.photoPhase !== "LOST") {
      return state;
    }

    state.activeBirds = state.activeBirds.filter((item) => {
      return item.instanceId !== state.currentPhotoTarget.instanceId;
    });
    state.currentPhotoTarget = null;
    state.currentPhotoSequence = null;
    clearFocusSequence(state);
    state.photoPhase = null;
    state.mode = "EXPLORE";
    state.eventText = "你放下相机，重新看向周围。";
    state.eventHtml = "";
    return state;
  }

  if (action === "wait") {
    if (state.photoPhase !== "DECISION" && state.photoPhase !== "RESULT") {
      return state;
    }

    clearFocusSequence(state);
    state.currentPhotoSequence = advancePhotoSequence(state.currentPhotoSequence);
    state.photoPhase = "DECISION";

    if (isBirdGone(state.currentPhotoSequence)) {
      state.eventText = "它飞远了。";
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    state.eventText = getStillInViewMessage(state.currentPhotoSequence);
    state.eventHtml = getStillInViewMessageHtml(state.currentPhotoSequence);
    addLog(state, state.eventText);
    return state;
  }

  if (action === "giveUp") {
    if (state.photoPhase !== "DECISION" && state.photoPhase !== "RESULT") {
      return state;
    }

    state.eventText = "你放下相机，没有继续追拍。";
    addLog(state, state.eventText);
    return exitPhotoMode(state);
  }

  return state;
}

function exitPhotoMode(state) {
  state.activeBirds = state.activeBirds.filter((bird) => {
    return bird.instanceId !== state.currentPhotoTarget.instanceId;
  });
  state.currentPhotoTarget = null;
  state.currentPhotoSequence = null;
  clearFocusSequence(state);
  state.photoPhase = null;
  state.mode = "EXPLORE";
  return advanceTurn(state);
}

function enterSettlementFromPhotoMode(state) {
  state.activeBirds = state.activeBirds.filter((bird) => {
    return bird.instanceId !== state.currentPhotoTarget.instanceId;
  });
  state.currentPhotoTarget = null;
  state.currentPhotoSequence = null;
  clearFocusSequence(state);
  state.photoPhase = null;
  state.availableSpotOptions = [];
  clearDistantListenOptions(state);
  state.mode = "SETTLEMENT";
  addLog(state, "电池没有电了，今天先回家整理记录。");
  return state;
}

/**
 * 进入整局结算。
 *
 * 注意：
 * - 结算是整理视角，展示鸟名时应按结算时 fieldGuide 状态解析。
 * - 未加新的鸟不能因为历史日志或照片记录泄露正式名。
 */
export function endGame(state, reason = "time") {
  state.mode = "SETTLEMENT";
  state.photoPhase = null;
  state.currentPhotoTarget = null;
  state.currentPhotoSequence = null;
  clearFocusSequence(state);
  state.availableSpotOptions = [];
  clearDistantListenOptions(state);
  if (reason === "battery") {
    state.eventText = "电池没有电了，该回家了。";
    addLog(state, "电池没有电了，该回家了。");
    return state;
  }

  if (reason === "retreat") {
    state.eventText = "今天先到这里，回家整理照片和笔记。";
    addLog(state, "今天先到这里，回家整理照片和笔记。");
    return state;
  }

  state.eventText = "天色不早了，该回家了。";
  addLog(state, "天色不早了，该回家了。");
  return state;
}
