import { cardList } from "../data/cards.js";
import { speciesList } from "../data/species.js";
import { LOG_LIMIT } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { clearFieldGuide, loadFieldGuide } from "./storage.js";
import { BEHAVIOR_STATE_DISPLAY, getCurrentPhotoState, getRemainingDecisionCount } from "./photoSequence.js";
import { endGame, handleDistantListenAction, handleExploreAction, handlePhotoAction, handleSpotSelectAction, startGame, startGameAtSpot } from "./gameSession.js";
import { createRarityBadgeHtml } from "./rarityDisplay.js";
import { getAllSpots, getCurrentSpot, getSurroundingSpotMap } from "./spotManager.js";

let gameState = createDefaultGameState();
let isSettlementRevealed = false;
let fieldGuideSpeciesIndex = 0;

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

function getSpeciesName(speciesId) {
  const species = speciesList.find((item) => item.id === speciesId);
  return species ? species.name : "未知鸟种";
}

function getBehaviorDisplay(behaviorState) {
  return BEHAVIOR_STATE_DISPLAY[behaviorState] || BEHAVIOR_STATE_DISPLAY.NORMAL;
}

function getModeDisplay(mode) {
  const modeDisplay = {
    START: "准备开始",
    START_SPOT_SELECT: "选择鸟点",
    EXPLORE: "探索中",
    DISTANT_LISTEN: "远听中",
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

function renderPhotoTimingStatus() {
  if (gameState.mode !== "PHOTO" || !gameState.currentPhotoSequence) {
    return "--";
  }

  return renderBehaviorBadge(getCurrentPhotoState(gameState.currentPhotoSequence));
}

function renderRarityBadge(raritySource) {
  return createRarityBadgeHtml(raritySource);
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
  if (pendingEffect === "photo-wait") {
    restartCssAnimation(elements.photoTiming.querySelector(".behavior-badge"), "is-pulsing");
  }
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

  if (gameState.mode === "PHOTO") {
    elements.actionPanel.append(createButton("按下快门", "shoot", "photo"));
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
  const speciesCards = getCardsForSpecies(species.id);
  const collectedCardsForSpecies = speciesCards.filter((card) => {
    return guide.collectedCards.some((item) => item.id === card.id);
  });
  const isHeard = guide.heardSpeciesIds.includes(species.id);
  const hasCollectedSpeciesCard = collectedCardsForSpecies.length > 0;
  const isUnknownSpecies = !isHeard && !hasCollectedSpeciesCard;
  const collectedCount = collectedCardsForSpecies.length;
  const totalCount = speciesCards.length;
  const speciesTitle = isUnknownSpecies ? "未知鸟种" : species.name;
  const pageTabs = speciesList.map((item, index) => {
    const className = index === fieldGuideSpeciesIndex
      ? "field-guide-page-tab is-active"
      : "field-guide-page-tab";

    return `<span class="${className}" aria-hidden="true"></span>`;
  });
  const cardItems = speciesCards.map((card) => {
    const isCollected = guide.collectedCards.some((item) => item.id === card.id);

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
          <p class="field-guide-species-progress">已收集 ${collectedCount} / ${totalCount}</p>
        </div>
        <button class="field-guide-nav-button field-guide-nav-next" type="button" data-action="fieldGuideNext" aria-label="下一种鸟">▶</button>
      </div>
      ${isUnknownSpecies ? `<p class="field-guide-unknown-hint">先在野外听见它的声音，或拍下它的身影。</p>` : ""}
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
  const totalStars = gameState.photos.reduce((sum, photo) => sum + photo.card.stars, 0);
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

    return `<li class="${className}" style="--reveal-delay: ${revealDelay}ms"><strong>${photo.speciesName}</strong> · ${photo.card.title} ${renderRarityBadge(photo.card)} ${shouldShowNew ? renderNewBadge() : ""}</li>`;
  });
  const emptyPhotoItem = `<li class="settlement-photo-card settlement-reveal" style="--reveal-delay: 1500ms">本局没有拍到照片。</li>`;

  elements.detailPanel.innerHTML = `
    <h2 class="settlement-reveal" style="--reveal-delay: 0ms">本局结算</h2>
    <p class="settlement-reveal" style="--reveal-delay: 240ms">拍照数量：${gameState.photos.length} / ${gameState.maxPhotos}</p>
    <p class="settlement-reveal" style="--reveal-delay: 480ms">记录鸟种：${foundSpeciesIds.length}</p>
    <p class="settlement-reveal" style="--reveal-delay: 720ms">听到鸟种：${gameState.sessionHeardSpeciesIds.length}</p>
    <p class="settlement-reveal" style="--reveal-delay: 960ms">新增图鉴：${shownNewCardIds.length}</p>
    <p class="settlement-reveal" style="--reveal-delay: 1200ms">记录点数：${totalStars}</p>
    <h3 class="settlement-reveal" style="--reveal-delay: 1350ms">照片列表</h3>
    <ul class="settlement-photo-list">${photoItems.join("") || emptyPhotoItem}</ul>
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
  const mapInfo = getSurroundingSpotMap(gameState);
  elements.mode.textContent = getModeDisplay(gameState.mode);
  elements.turn.textContent = `${gameState.maxTurns - gameState.currentTurn} / ${gameState.maxTurns}`;
  elements.spot.textContent = currentSpot.name;
  elements.direction.textContent = mapInfo.facingName;
  elements.sdCard.textContent = `${gameState.photos.length} / ${gameState.maxPhotos}`;
  elements.photoTiming.innerHTML = renderPhotoTimingStatus();

  if (gameState.eventHtml) {
    elements.eventText.innerHTML = gameState.eventHtml;
  } else {
    elements.eventText.textContent = gameState.eventText;
  }

  renderActions();
  renderDetailPanel();
  renderLogs();
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
  const pendingEffect = getPendingPhotoEffect(type, action);
  const previousMode = gameState.mode;
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

  if (type === "startSpot") {
    isSettlementRevealed = false;
    gameState = startGameAtSpot(action);
  }

  if (type === "photo") {
    gameState = handlePhotoAction(gameState, action);
  }

  if (previousMode !== "SETTLEMENT" && gameState.mode === "SETTLEMENT") {
    isSettlementRevealed = false;
  }

  render();
  playAfterRenderPhotoEffect(pendingEffect);
});

render();
