import { cardList } from "../data/cards.js";
import { speciesList } from "../data/species.js";
import { LOG_LIMIT } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { clearFieldGuide, loadFieldGuide } from "./storage.js";
import { BEHAVIOR_STATE_DISPLAY, getCurrentPhotoState, getRemainingDecisionCount } from "./photoSequence.js";
import { endGame, handleExploreAction, handlePhotoAction, handleSpotSelectAction, startGame, startGameAtSpot } from "./gameSession.js";
import { getAllSpots, getCurrentSpot, getSurroundingSpotMap } from "./spotManager.js";

let gameState = createDefaultGameState();

const elements = {
  mode: document.querySelector("#modeText"),
  turn: document.querySelector("#turnText"),
  spot: document.querySelector("#spotText"),
  direction: document.querySelector("#directionText"),
  sdCard: document.querySelector("#sdCardText"),
  eventText: document.querySelector("#eventText"),
  actionPanel: document.querySelector("#actionPanel"),
  logList: document.querySelector("#logList"),
  detailPanel: document.querySelector("#detailPanel")
};

function getSpeciesName(speciesId) {
  const species = speciesList.find((item) => item.id === speciesId);
  return species ? species.name : "未知鸟种";
}

function getBehaviorDisplay(behaviorState) {
  return BEHAVIOR_STATE_DISPLAY[behaviorState] || BEHAVIOR_STATE_DISPLAY.NORMAL;
}

function renderBehaviorBadge(behaviorState) {
  const display = getBehaviorDisplay(behaviorState);
  return `<span class="behavior-badge ${display.className}">${display.label}</span>`;
}

function createButton(label, actionName, actionType) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = actionName;
  button.dataset.type = actionType;
  return button;
}

function renderActions() {
  elements.actionPanel.innerHTML = "";

  if (gameState.mode === "START") {
    elements.actionPanel.append(createButton("开始游戏", "start", "system"));
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
    elements.actionPanel.append(createButton("观察当前方向", "observe", "explore"));
    elements.actionPanel.append(createButton("向左转", "turnLeft", "explore"));
    elements.actionPanel.append(createButton("向右转", "turnRight", "explore"));
    elements.actionPanel.append(createButton("回头观察", "turnBack", "explore"));
    elements.actionPanel.append(createButton("静听", "listen", "explore"));
    elements.actionPanel.append(createButton("倾听远处的声音", "listenFar", "explore"));
    elements.actionPanel.append(createButton("等待片刻", "wait", "explore"));
    elements.actionPanel.append(createButton("查看图鉴", "fieldGuide", "system"));
    elements.actionPanel.append(createButton("提前撤离并结算", "retreat", "explore"));
    return;
  }

  if (gameState.mode === "SPOT_SELECT") {
    gameState.availableSpotOptions.forEach((spot) => {
      elements.actionPanel.append(createButton(`前往：${spot.name}`, spot.id, "spot"));
    });
    elements.actionPanel.append(createButton("留在当前鸟点", "stay", "spot"));
    return;
  }

  if (gameState.mode === "PHOTO") {
    elements.actionPanel.append(createButton("按下快门", "shoot", "photo"));
    elements.actionPanel.append(createButton("再等一等", "wait", "photo"));
    elements.actionPanel.append(createButton("放弃拍摄", "giveUp", "photo"));
    return;
  }

  if (gameState.mode === "FIELD_GUIDE") {
    elements.actionPanel.append(createButton("返回", "back", "system"));
    elements.actionPanel.append(createButton("开始新游戏", "start", "system"));
    elements.actionPanel.append(createButton("清空图鉴", "clearGuide", "system"));
    return;
  }

  if (gameState.mode === "SETTLEMENT") {
    elements.actionPanel.append(createButton("重新开始", "start", "system"));
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
      <pre>            [${mapInfo.north}]
                ↑
                │
[${mapInfo.west}] ← [${mapInfo.currentSpot.name}] → [${mapInfo.east}]
                │
                ↓
            [${mapInfo.south}]</pre>
      <p>当前位置：${mapInfo.currentSpot.name}</p>
      <p>当前面向：${mapInfo.facingDirection}</p>
      <ul>
        <li>前方：${mapInfo.front}</li>
        <li>右侧：${mapInfo.right}</li>
        <li>后方：${mapInfo.back}</li>
        <li>左侧：${mapInfo.left}</li>
      </ul>
    </section>
  `;
}

function renderFieldGuide() {
  const guide = gameState.fieldGuide;
  const heardCount = guide.heardSpeciesIds.length;
  const cardCount = guide.collectedCards.length;
  const cardItems = cardList.map((card) => {
    const collected = guide.collectedCards.some((item) => item.id === card.id);
    const className = collected ? "guide-card collected" : "guide-card";
    const label = collected ? `${card.title} · ${card.stars} 星` : "未收集";
    return `<li class="${className}"><strong>${getSpeciesName(card.speciesId)}</strong><span>${label}</span></li>`;
  });

  elements.detailPanel.innerHTML = `
    <h2>图鉴</h2>
    <p>听见鸟种：${heardCount} / ${speciesList.length}</p>
    <p>收集卡牌：${cardCount} / ${cardList.length}</p>
    <ul class="guide-list">${cardItems.join("")}</ul>
  `;
}

function renderSettlement() {
  const foundSpeciesIds = [...new Set(gameState.photos.map((photo) => photo.speciesId))];
  const totalStars = gameState.photos.reduce((sum, photo) => sum + photo.card.stars, 0);
  const photoItems = gameState.photos.map((photo) => {
    return `<li><strong>${photo.speciesName}</strong>：${photo.card.title}，${photo.card.stars} 星，时机 ${renderBehaviorBadge(photo.behaviorState)}</li>`;
  });

  elements.detailPanel.innerHTML = `
    <h2>本局结算</h2>
    <p>本局拍照数量：${gameState.photos.length}</p>
    <p>发现鸟种：${foundSpeciesIds.map(getSpeciesName).join("、") || "无"}</p>
    <p>新增卡牌：${gameState.sessionNewCards.length}</p>
    <p>总星级：${totalStars}</p>
    <h3>照片列表</h3>
    <ul>${photoItems.join("") || "<li>本局没有拍到照片。</li>"}</ul>
  `;
}

function renderPhotoDetail() {
  const bird = gameState.currentPhotoTarget;
  const photoSequence = gameState.currentPhotoSequence;
  const behaviorState = getCurrentPhotoState(photoSequence);
  const display = getBehaviorDisplay(behaviorState);

  elements.detailPanel.innerHTML = `
    <h2>拍照时机</h2>
    <p>你正在观察：${getSpeciesName(bird.speciesId)}</p>
    <p>当前时机：${renderBehaviorBadge(behaviorState)}</p>
    <p>${display.description}</p>
    <p>${display.hint}</p>
    <p>本次观察已拍摄：${photoSequence.shutterCount} 张</p>
    <p>剩余判断机会：${getRemainingDecisionCount(photoSequence)}</p>
    <p>SD 卡：${gameState.photos.length} / ${gameState.maxPhotos}</p>
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
  elements.mode.textContent = gameState.mode;
  elements.turn.textContent = `${gameState.maxTurns - gameState.currentTurn} / ${gameState.maxTurns}`;
  elements.spot.textContent = currentSpot.name;
  elements.direction.textContent = gameState.directions[gameState.facingDirection];
  elements.sdCard.textContent = `${gameState.photos.length} / ${gameState.maxPhotos}`;
  elements.eventText.textContent = gameState.eventText;

  renderActions();
  renderLogs();
  renderDetailPanel();
}

function showFieldGuide() {
  gameState.previousMode = gameState.mode;
  gameState.mode = "FIELD_GUIDE";
  gameState.fieldGuide = loadFieldGuide();
  gameState.eventText = "你翻开图鉴，查看已经听见和收集过的记录。";
}

function returnFromFieldGuide() {
  gameState.mode = gameState.previousMode || "START";
  delete gameState.previousMode;
}

function handleSystemAction(action) {
  if (action === "start") {
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
    gameState = endGame(gameState);
  }
}

elements.actionPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const type = button.dataset.type;

  if (type === "system") {
    handleSystemAction(action);
  }

  if (type === "explore") {
    gameState = handleExploreAction(gameState, action);
  }

  if (type === "spot") {
    gameState = handleSpotSelectAction(gameState, action);
  }

  if (type === "startSpot") {
    gameState = startGameAtSpot(action);
  }

  if (type === "photo") {
    gameState = handlePhotoAction(gameState, action);
  }

  render();
});

render();
