import { MAX_PHOTOS } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { generateClues, getSpeciesById, initializeBirds, updateBirds } from "./birdManager.js";
import { listen, listenDistantSounds, observeCurrentDirection } from "./encounterSystem.js";
import {
  createPhotoSequence,
  advancePhotoSequence,
  getCurrentPhotoState,
  isBirdGone,
  recordShutterDecision
} from "./photoSequence.js";
import { drawCard } from "./cardDraw.js";
import { addCard, markHeard } from "./fieldGuide.js";
import { createRarityBadgeHtml, getRarityDisplay } from "./rarityDisplay.js";
import { getAvailableSpotOptions, getCurrentSpot, getSpotById, getSurroundingSpotMap } from "./spotManager.js";

function addLog(state, message) {
  state.logs.unshift(message);
}

function advanceTurn(state, turnCost = 1) {
  state.currentTurn += turnCost;
  state.activeBirds = updateBirds(state);

  if (state.currentTurn >= state.maxTurns) {
    return endGame(state);
  }

  return state;
}

function getDirectionName(state) {
  return getSurroundingSpotMap(state).facingName;
}

function enterPhotoMode(state, bird) {
  state.mode = "PHOTO";
  state.currentPhotoTarget = bird;
  state.currentPhotoSequence = createPhotoSequence();

  const species = getSpeciesById(bird.speciesId);
  state.eventText = `${species.name}停在${getDirectionName(state)}，你举起相机。`;
  addLog(state, `发现${species.name}，进入拍照时机。`);
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
  state.eventText = `你在${currentSpot.name}停下脚步，倾听远处传来的声音。`;
  addLog(state, "你倾听远处的声音，辨认出几个可能前往的鸟点。");
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
  return (fieldGuide.collectedCards || []).map((card) => card.id);
}

function updateDistantListenResult(state, introText) {
  const result = listenDistantSounds(state);
  state.eventText = result.message.replace("你停下脚步，分辨远处传来的鸟鸣。", introText);
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
      NORMAL: "你又等了一会儿，它仍只是安静地停着。",
      INTERESTING: "你继续观察，它的小动作还在持续。",
      REMARKABLE: "这一瞬还没有过去，机会仍在眼前。",
      PRECIOUS: "难得的瞬间仍停在眼前。"
    };

    return steadyMessages[nextState] || "你又等了一会儿，观察仍在继续。";
  }

  if (nextState === "PRECIOUS") {
    return "难得的瞬间出现了。";
  }

  if (previousState === "PRECIOUS") {
    return "难得的瞬间已经过去。";
  }

  const transitionKey = `${previousState}->${nextState}`;
  const transitionMessages = {
    "NORMAL->INTERESTING": "你多等了一会儿，它忽然有了动作。",
    "INTERESTING->REMARKABLE": "你抓住了节奏，更好的瞬间出现了。",
    "NORMAL->REMARKABLE": "你屏住呼吸，精彩的一瞬突然出现。",
    "REMARKABLE->INTERESTING": "精彩的一瞬稍纵即逝，但它还没有离开。",
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
    return "太难得了！";
  }

  const behaviorRank = RARITY_RANK[behaviorState] || RARITY_RANK.NORMAL;
  const rarityRank = RARITY_RANK[rarity] || RARITY_RANK.NORMAL;

  if (rarityRank > behaviorRank) {
    return "赚到了！";
  }

  if (rarityRank < behaviorRank) {
    return "可惜！";
  }

  if (Math.random() < 0.25) {
    return "时机刚好！";
  }

  return "";
}

function getShutterMessage(card, behaviorState) {
  const rarityDisplay = getRarityDisplay(card);
  const title = card.title || "未命名照片";
  const description = card.description || "这张照片还没有记录具体内容。";
  const momentComment = getMomentComment(card, behaviorState);

  return `咔擦！${momentComment}获得${rarityDisplay.label}照片：${title}\n${description}`;
}

function getShutterMessageHtml(card, behaviorState) {
  const title = card.title || "未命名照片";
  const description = card.description || "这张照片还没有记录具体内容。";
  const momentComment = getMomentComment(card, behaviorState);

  return `咔擦！${momentComment}获得${createRarityBadgeHtml(card)}照片：<strong>${title}</strong><br>${description}`;
}

export function startGame() {
  const state = createDefaultGameState();
  state.mode = "START_SPOT_SELECT";
  state.eventText = "请选择本局开始的鸟点。";
  addLog(state, "准备开始新的一局，先选择一个初始鸟点。");
  return state;
}

export function startGameAtSpot(spotId) {
  const state = createDefaultGameState();
  const currentSpot = getSpotById(spotId);
  state.unlockedCardIdsAtRunStart = getUnlockedCardIds(state.fieldGuide);
  state.currentSpotId = currentSpot.id;
  state.facingDirection = 0;
  state.mode = "EXPLORE";
  state.activeBirds = initializeBirds(currentSpot);
  state.eventText = `你来到${currentSpot.name}，面向${getDirectionName(state)}。${generateClues(state)}`;
  addLog(state, `你从${currentSpot.name}开始了今天的观鸟。`);
  return state;
}

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
    addLog(state, "你决定带着已有记录提前撤离。");
    return endGame(state);
  }

  if (action === "listenDistant") {
    if (state.photos.length >= state.maxPhotos) {
      return endGame(state);
    }

    updateDistantListenResult(state, "你停下脚步，分辨远处传来的鸟鸣。");
    state.mode = "DISTANT_LISTEN";
    addLog(state, "你停下脚步，分辨远处传来的鸟鸣。");

    return advanceTurn(state);
  }

  if (action === "listen") {
    // 预留：当前 MVP 使用 observe + distant listen，普通 listen 暂不显示。
    const result = listen(state);
    state.eventText = result.message;
    addLog(state, result.message);

    recordHeardSpecies(state, result.heardSpeciesId);

    return advanceTurn(state);
  }

  if (action === "wait") {
    // 探索等待动作，区别于 PHOTO 阶段的 wait。
    state.eventText = `你等待片刻。${generateClues(state)}`;
    addLog(state, "你等待片刻，周围的动静有了细微变化。");
    return advanceTurn(state);
  }

  if (action === "observe") {
    const result = observeCurrentDirection(state);
    state.eventText = result.message;
    addLog(state, result.message);

    if (result.found) {
      enterPhotoMode(state, result.bird);
      return state;
    }

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
    updateDistantListenResult(state, "你又停留了一会儿，继续分辨远处的声音。");
    addLog(state, "你又停留了一会儿，继续分辨远处的声音。");
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

export function handlePhotoAction(state, action) {
  if (state.mode !== "PHOTO") {
    return state;
  }

  const bird = state.currentPhotoTarget;
  const species = getSpeciesById(bird.speciesId);
  const behaviorState = getCurrentPhotoState(state.currentPhotoSequence);

  if (action === "shoot") {
    if (behaviorState === "FLY_AWAY") {
      state.eventText = getFlyAwayMessage();
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    if (state.photos.length >= MAX_PHOTOS) {
      state.eventText = "SD 卡已经满了，不能继续拍摄。本次观察结束。";
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    const card = drawCard(bird.speciesId, behaviorState);

    if (!card) {
      state.eventText = "这次快门没有记录到可用卡牌。本次观察结束。";
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    const photo = {
      id: `${Date.now()}_${state.photos.length}`,
      speciesId: bird.speciesId,
      speciesName: species.name,
      behaviorState,
      card
    };

    state.photos.push(photo);
    state.currentPhotoSequence = recordShutterDecision(state.currentPhotoSequence);
    const isNewCard = addCard(state.fieldGuide, card);

    if (isNewCard) {
      state.sessionNewCards.push(card);
    }

    if (state.photos.length >= MAX_PHOTOS) {
      state.eventText = `${getShutterMessage(card, behaviorState)}\n\nSD 卡已满，本次观鸟结束。`;
      state.eventHtml = `${getShutterMessageHtml(card, behaviorState)}\n\nSD 卡已满，本次观鸟结束。`;
      addLog(state, state.eventText);
      return enterSettlementFromPhotoMode(state);
    }

    if (isBirdGone(state.currentPhotoSequence)) {
      state.eventText = `${getShutterMessage(card, behaviorState)}\n\n${getFlyAwayMessage()}`;
      state.eventHtml = `${getShutterMessageHtml(card, behaviorState)}\n\n${getFlyAwayMessage()}`;
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    state.eventText = `${getShutterMessage(card, behaviorState)}\n\n它还没有飞走，你可以继续观察。`;
    state.eventHtml = `${getShutterMessageHtml(card, behaviorState)}\n\n它还没有飞走，你可以继续观察。`;
    addLog(state, state.eventText);
    return state;
  }

  if (action === "wait") {
    const previousState = getCurrentPhotoState(state.currentPhotoSequence);
    state.currentPhotoSequence = advancePhotoSequence(state.currentPhotoSequence);
    const nextState = getCurrentPhotoState(state.currentPhotoSequence);

    if (isBirdGone(state.currentPhotoSequence)) {
      state.eventText = getPhotoWaitMessage(previousState, nextState);
      addLog(state, state.eventText);
      return exitPhotoMode(state);
    }

    state.eventText = getPhotoWaitMessage(previousState, nextState);
    addLog(state, state.eventText);
    return state;
  }

  if (action === "giveUp") {
    state.eventText = `你放下相机，没有继续拍摄${species.name}。本次观察结束。`;
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
  state.mode = "EXPLORE";
  return advanceTurn(state);
}

function enterSettlementFromPhotoMode(state) {
  state.activeBirds = state.activeBirds.filter((bird) => {
    return bird.instanceId !== state.currentPhotoTarget.instanceId;
  });
  state.currentPhotoTarget = null;
  state.currentPhotoSequence = null;
  state.availableSpotOptions = [];
  clearDistantListenOptions(state);
  state.mode = "SETTLEMENT";
  addLog(state, "SD 卡已满，进入本局结算。");
  return state;
}

export function endGame(state) {
  state.mode = "SETTLEMENT";
  state.availableSpotOptions = [];
  clearDistantListenOptions(state);
  state.eventText = "本局观察结束，整理 SD 卡和观察笔记。";
  addLog(state, "一局结束，进入结算。");
  return state;
}
