import { cardList } from "../data/cards.js";
import { speciesList } from "../data/species.js";
import { LOG_LIMIT } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { clearFieldGuide, loadFieldGuide } from "./storage.js";
import { BEHAVIOR_STATE_DISPLAY, getCurrentPhotoState, getRemainingDecisionCount } from "./photoSequence.js";
import { endGame, handleDistantListenAction, handleExploreAction, handlePhotoAction, handleSpotSelectAction, startGame, startGameAtSpot } from "./gameSession.js";
import { createRarityBadgeHtml } from "./rarityDisplay.js";
import { getAllSpots, getCurrentSpot, getSurroundingSpotMap } from "./spotManager.js";
import { clearTesterProfile, getAnalyticsContext, isPlaytestParticipant, setTesterProfile, submitAnalyticsSurvey } from "./analytics.js";

let gameState = createDefaultGameState();
let isSettlementRevealed = false;
let fieldGuideSpeciesIndex = 0;
let testerIdInputText = "";
let pendingTesterId = "";
let testerIdErrorText = "";
let surveyAnswers = createEmptySurveyAnswers();
let surveyErrorText = "";
let surveySubmitting = false;
let surveySubmitted = false;

const TESTER_PROFILE_OPTIONS = [
  {
    level: 1,
    text: "不太了解观鸟这件事"
  },
  {
    level: 2,
    text: "了解观鸟，但还没开始实践"
  },
  {
    level: 3,
    text: "已经开始观鸟，还没有专业设备"
  },
  {
    level: 4,
    text: "已经投入专业设备，是认真的观鸟者"
  }
];

const SURVEY_QUESTIONS = [
  {
    id: "q1",
    title: "Q1. 游戏画面感",
    question: "游戏的文字描述，有没有让你脑子里浮现出画面？",
    options: [
      { value: 1, text: "有，很有画面感，感觉像真的在观鸟" },
      { value: 2, text: "有一点，偶尔会有画面感" },
      { value: 3, text: "不太有，文字感比较强" },
      { value: 4, text: "没有，感觉就是在读文字" }
    ]
  },
  {
    id: "q2",
    title: "Q2. 出红兴奋感",
    question: "当你拍到\"精彩\"照片的时候，有没有感到兴奋？",
    options: [
      { value: 1, text: "有！会有明显的惊喜感" },
      { value: 2, text: "有一点，还不错的感觉" },
      { value: 3, text: "没什么特别的感觉" },
      { value: 4, text: "我这局没拍到精彩照片" }
    ]
  },
  {
    id: "q3",
    title: "Q3. 文字卡牌收集感",
    question: "你觉得收集这些文字卡牌有意思吗？",
    options: [
      { value: 1, text: "很有意思，看到新卡牌会有满足感" },
      { value: 2, text: "还好，可以接受" },
      { value: 3, text: "一般，没有特别的感觉" },
      { value: 4, text: "没什么意思，不太吸引我" }
    ]
  },
  {
    id: "q4",
    title: "Q4. 全收集意愿",
    question: "游戏结束后，你有想继续拍齐所有卡牌的冲动吗？",
    options: [
      { value: 1, text: "很想，这是我继续玩的主要动力" },
      { value: 2, text: "有一点想，可以再玩几局" },
      { value: 3, text: "不太在意收集完整" },
      { value: 4, text: "完全没有这个冲动" }
    ]
  },
  {
    id: "q5",
    title: "Q5. 找鸟难易感受",
    question: "找鸟的过程感觉怎么样？",
    options: [
      { value: 1, text: "太容易了，几乎每次都能找到" },
      { value: 2, text: "刚刚好，有挑战感但不挫败" },
      { value: 3, text: "有点难，经常找不到，有些挫败" },
      { value: 4, text: "太难了，大部分时间都没找到鸟" }
    ]
  },
  {
    id: "q6",
    title: "Q6. 鸟种与栖息地关系感知",
    question: "你有没有感觉到不同的鸟偏好出现在不同的地方？",
    options: [
      { value: 1, text: "有，很明显，我会根据想找的鸟选择去哪里" },
      { value: 2, text: "有一点感觉，但不是很清晰" },
      { value: 3, text: "没有特别注意到" },
      { value: 4, text: "没有，感觉鸟出现得很随机" }
    ]
  },
  {
    id: "q7",
    title: "Q7. 游玩深度意愿",
    question: "如果可以随时停下来，你大概会玩到哪个阶段觉得\"差不多了\"？",
    options: [
      { value: 1, text: "打完一局就不太想继续了" },
      { value: 2, text: "打完几局之后就不想继续了" },
      { value: 3, text: "图鉴收集到一半左右，感觉差不多了" },
      { value: 4, text: "想把图鉴全部集齐再停" },
      { value: 5, text: "没有想停的感觉，还想一直玩" }
    ]
  },
  {
    id: "q8",
    title: "Q8. 体力 / SD 卡数值感受",
    question: "在游戏中，哪个资源先让你感到紧张？",
    options: [
      { value: 1, text: "SD 卡快满了，开始不敢随便拍" },
      { value: 2, text: "回合数快用完了，开始着急" },
      { value: 3, text: "两个都让我紧张过" },
      { value: 4, text: "两个都没感到太大压力" },
      { value: 5, text: "我不太确定这两个数值的意思" }
    ]
  }
];

const SURVEY_TEXT_QUESTIONS = [
  {
    id: "q10",
    title: "Q10. 稀有度规则理解",
    question: "用你自己的话说：什么情况下会拍到\"精彩\"照片？（不需要完全准确，写你的理解就好）",
    placeholder: "请在这里输入你的理解……"
  },
  {
    id: "q11",
    title: "Q11. 希望增加的鸟种",
    question: "你最希望在游戏里看到哪种鸟？（可以说中文名、英文名或描述）",
    placeholder: "请在这里输入……"
  },
  {
    id: "q12",
    title: "Q12. 希望增加的内容",
    question: "你最希望游戏增加什么？",
    placeholder: "请在这里输入……"
  }
];

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
    TESTER_ID_INPUT: "参与测试",
    TESTER_PROFILE: "参与测试",
    PLAYTEST_FEEDBACK_PREFACE: "测试反馈",
    PLAYTEST_SURVEY: "测试反馈",
    SURVEY_THANKS: "感谢反馈",
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createEmptySurveyAnswers() {
  return {
    q1: null,
    q2: null,
    q3: null,
    q4: null,
    q5: null,
    q6: null,
    q7: null,
    q8: null,
    q9: null,
    q10: "",
    q11: "",
    q12: ""
  };
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
    elements.actionPanel.append(createButton("参与测试 · 留下反馈", "startPlaytest", "system", "button-secondary"));
    elements.actionPanel.append(createButton("查看图鉴", "fieldGuide", "system"));
    return;
  }

  if (gameState.mode === "TESTER_ID_INPUT") {
    elements.actionPanel.append(createButton("继续", "confirmTesterId", "system", "button-major"));
    elements.actionPanel.append(createButton("返回", "backToStart", "system"));
    return;
  }

  if (gameState.mode === "TESTER_PROFILE") {
    elements.actionPanel.append(createButton("返回", "backToTesterId", "system"));
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
    if (isPlaytestParticipant()) {
      elements.actionPanel.append(createButton("填写测试反馈", "openFeedbackPreface", "system", "button-secondary"));
    }
    elements.actionPanel.append(createButton("查看图鉴", "fieldGuide", "system"));
    return;
  }

  if (gameState.mode === "PLAYTEST_FEEDBACK_PREFACE") {
    elements.actionPanel.append(createButton("继续再玩一局", "continuePlaytestRun", "system", "button-major"));
    elements.actionPanel.append(createButton("现在填写反馈", "openSurveyForm", "system", "button-secondary"));
    elements.actionPanel.append(createButton("返回结算", "backToSettlement", "system"));
    return;
  }

  if (gameState.mode === "PLAYTEST_SURVEY") {
    const submitButton = createButton(surveySubmitting ? "提交中……" : "提交反馈", "submitSurvey", "system", "button-major");
    submitButton.disabled = surveySubmitting || surveySubmitted;
    elements.actionPanel.append(submitButton);
    elements.actionPanel.append(createButton("返回上一步", "openFeedbackPreface", "system"));
    return;
  }

  if (gameState.mode === "SURVEY_THANKS") {
    elements.actionPanel.append(createButton("返回主界面", "backToStart", "system"));
    elements.actionPanel.append(createButton("继续再玩一局", "continuePlaytestRun", "system", "button-secondary"));
    return;
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

function renderTesterIdInputDetail() {
  elements.detailPanel.innerHTML = `
    <section class="tester-panel">
      <h2>参与测试</h2>
      <p>给自己起一个测试者 ID，方便我把你的多局数据和反馈对应起来。ID 仅用于本次测试，不会公开。</p>
      <label class="tester-input-label" for="testerIdInput">测试者 ID</label>
      <input
        class="tester-input"
        id="testerIdInput"
        type="text"
        value="${escapeHtml(testerIdInputText)}"
        placeholder="昵称 / 微信名 / 英文名都可以"
        autocomplete="off"
      >
      <p class="tester-error">${escapeHtml(testerIdErrorText)}</p>
    </section>
  `;
}

function renderTesterProfileDetail() {
  const optionItems = TESTER_PROFILE_OPTIONS.map((option) => {
    return `
      <li>
        <button class="tester-profile-option" type="button" data-action="selectTesterProfile" data-level="${option.level}">
          <span class="tester-profile-level">Q0-${option.level}</span>
          <span>${escapeHtml(option.text)}</span>
        </button>
      </li>
    `;
  });

  elements.detailPanel.innerHTML = `
    <section class="tester-panel">
      <h2>你和观鸟的距离有多远？</h2>
      <ul class="tester-profile-list">${optionItems.join("")}</ul>
    </section>
  `;
}

function renderFeedbackPrefaceDetail() {
  elements.detailPanel.innerHTML = `
    <section class="feedback-panel">
      <h2>先别急着填写</h2>
      <p>如果你还想继续玩，可以先多玩几局。等你觉得差不多了、准备停下来时，再填写这份反馈，会更接近你的真实感受。</p>
      <p class="feedback-note">问卷只需要最后填一次。</p>
    </section>
  `;
}

function renderSurveyDetail() {
  const context = getAnalyticsContext();
  const choiceQuestionItems = SURVEY_QUESTIONS.map((question) => {
    const optionButtons = question.options.map((option) => {
      const isSelected = surveyAnswers[question.id] === option.value;
      const className = isSelected ? "survey-choice is-selected" : "survey-choice";

      return `
        <button class="${className}" type="button" data-question="${question.id}" data-value="${option.value}">
          <span class="survey-choice-value">${option.value}</span>
          <span>${escapeHtml(option.text)}</span>
        </button>
      `;
    });

    return `
      <section class="survey-question-card">
        <h3>${escapeHtml(question.title)}</h3>
        <p class="survey-question-text">${escapeHtml(question.question)}</p>
        <div class="survey-choice-list">${optionButtons.join("")}</div>
      </section>
    `;
  });
  const scoreButtons = Array.from({ length: 11 }, (_, score) => {
    const className = surveyAnswers.q9 === score ? "survey-score-button is-selected" : "survey-score-button";

    return `<button class="${className}" type="button" data-question="q9" data-value="${score}">${score}</button>`;
  });
  const textQuestionItems = SURVEY_TEXT_QUESTIONS.map((question) => {
    return `
      <section class="survey-question-card">
        <h3>${escapeHtml(question.title)}</h3>
        <p class="survey-question-text">${escapeHtml(question.question)}</p>
        <textarea
          class="survey-textarea"
          data-question="${question.id}"
          placeholder="${escapeHtml(question.placeholder)}"
        >${escapeHtml(surveyAnswers[question.id])}</textarea>
      </section>
    `;
  });

  elements.detailPanel.innerHTML = `
    <section class="survey-panel">
      <h2>测试反馈</h2>
      <p>感谢你愿意帮我测试。选择题按你的真实感受填写即可，开放题可以简短写几句。</p>
      <p class="survey-tester-id">测试者：${escapeHtml(context.tester_id || "未填写")}</p>
      <p class="survey-error">${escapeHtml(surveyErrorText)}</p>
      ${choiceQuestionItems.join("")}
      <section class="survey-question-card">
        <h3>Q9. 推荐意愿（NPS）</h3>
        <p class="survey-question-text">你有多大可能把这个游戏推荐给朋友？</p>
        <p class="survey-scale-hint">不可能 / 非常可能</p>
        <div class="survey-score-list">${scoreButtons.join("")}</div>
      </section>
      ${textQuestionItems.join("")}
    </section>
  `;
}

function renderSurveyThanksDetail() {
  elements.detailPanel.innerHTML = `
    <section class="feedback-panel">
      <h2>感谢反馈</h2>
      <p>你的反馈已经提交。谢谢你帮我测试这个小小的观鸟游戏。</p>
    </section>
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
  if (gameState.mode === "PLAYTEST_FEEDBACK_PREFACE") {
    renderFeedbackPrefaceDetail();
    return;
  }

  if (gameState.mode === "PLAYTEST_SURVEY") {
    renderSurveyDetail();
    return;
  }

  if (gameState.mode === "SURVEY_THANKS") {
    renderSurveyThanksDetail();
    return;
  }

  if (gameState.mode === "TESTER_ID_INPUT") {
    renderTesterIdInputDetail();
    return;
  }

  if (gameState.mode === "TESTER_PROFILE") {
    renderTesterProfileDetail();
    return;
  }

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

function resetTesterEntryState() {
  testerIdInputText = "";
  pendingTesterId = "";
  testerIdErrorText = "";
}

function startPlaytestEntry() {
  resetTesterEntryState();
  gameState.mode = "TESTER_ID_INPUT";
  gameState.eventText = "填写测试信息后，再开始本局观察。";
}

function confirmTesterId() {
  const trimmedTesterId = testerIdInputText.trim();

  if (!trimmedTesterId) {
    testerIdErrorText = "请先填写一个测试者 ID。";
    return;
  }

  pendingTesterId = trimmedTesterId;
  testerIdErrorText = "";
  gameState.mode = "TESTER_PROFILE";
  gameState.eventText = "选择一个最接近你的观鸟经验。";
}

function selectTesterProfile(level) {
  const option = TESTER_PROFILE_OPTIONS.find((item) => item.level === level);

  if (!option) {
    return;
  }

  setTesterProfile({
    testerId: pendingTesterId,
    testerLevel: option.level,
    testerLevelText: option.text
  });
  testerIdErrorText = "";
  gameState = startGame();
}

function openFeedbackPreface() {
  gameState.previousMode = "SETTLEMENT";
  gameState.mode = "PLAYTEST_FEEDBACK_PREFACE";
  gameState.eventText = "你可以先多玩几局，最后再填写测试反馈。";
}

function continuePlaytestRun() {
  isSettlementRevealed = false;
  gameState = startGame();
  gameState.eventText = "继续测试，选择下一局开始的鸟点。";
}

function openSurveyForm() {
  gameState.previousMode = "SETTLEMENT";
  gameState.mode = "PLAYTEST_SURVEY";
  surveyAnswers = createEmptySurveyAnswers();
  surveyErrorText = "";
  surveySubmitting = false;
  surveySubmitted = false;
  gameState.eventText = "按你的真实感受填写这份测试反馈。";
}

function backToSettlement() {
  gameState.mode = "SETTLEMENT";
  delete gameState.previousMode;
  gameState.eventText = "本局结算仍保留在这里，你可以继续查看记录。";
}

function getSurveyOptionText(questionId, value) {
  const question = SURVEY_QUESTIONS.find((item) => item.id === questionId);
  const option = question ? question.options.find((item) => item.value === value) : null;
  return option ? option.text : "";
}

function isSurveyChoiceComplete() {
  return SURVEY_QUESTIONS.every((question) => surveyAnswers[question.id] !== null)
    && surveyAnswers.q9 !== null;
}

function buildSurveyPayload() {
  const survey = {};

  SURVEY_QUESTIONS.forEach((question) => {
    const value = surveyAnswers[question.id];
    survey[question.id] = value;
    survey[`${question.id}_text`] = getSurveyOptionText(question.id, value);
  });

  survey.q9 = surveyAnswers.q9;
  survey.q10 = surveyAnswers.q10.trim();
  survey.q11 = surveyAnswers.q11.trim();
  survey.q12 = surveyAnswers.q12.trim();
  return survey;
}

async function submitSurveyFeedback() {
  if (surveySubmitting || surveySubmitted) {
    return;
  }

  if (!isSurveyChoiceComplete()) {
    surveyErrorText = "还有几道选择题没有完成。";
    render();
    return;
  }

  surveySubmitting = true;
  surveyErrorText = "";
  render();

  const result = await submitAnalyticsSurvey(buildSurveyPayload());

  surveySubmitting = false;

  if (!result.ok) {
    surveyErrorText = "提交似乎没有成功，可以稍后再试。";
    render();
    return;
  }

  surveySubmitted = true;
  gameState.mode = "SURVEY_THANKS";
  gameState.eventText = "感谢你完成测试反馈。";
  render();
}

function handleSystemAction(action) {
  if (action === "start") {
    isSettlementRevealed = false;
    clearTesterProfile();
    resetTesterEntryState();
    gameState = startGame();
  }

  if (action === "startPlaytest") {
    startPlaytestEntry();
  }

  if (action === "confirmTesterId") {
    confirmTesterId();
  }

  if (action === "backToStart") {
    resetTesterEntryState();
    gameState.mode = "START";
    gameState.eventText = "准备好后，开始一局文字观鸟。";
  }

  if (action === "backToTesterId") {
    gameState.mode = "TESTER_ID_INPUT";
    gameState.eventText = "填写测试信息后，再开始本局观察。";
  }

  if (action === "openFeedbackPreface") {
    openFeedbackPreface();
  }

  if (action === "continuePlaytestRun") {
    continuePlaytestRun();
  }

  if (action === "openSurveyForm") {
    openSurveyForm();
  }

  if (action === "submitSurvey") {
    submitSurveyFeedback();
  }

  if (action === "backToSettlement") {
    backToSettlement();
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

  const testerProfileButton = event.target.closest(".tester-profile-option");

  if (testerProfileButton) {
    selectTesterProfile(Number(testerProfileButton.dataset.level));
    render();
    return;
  }

  const surveyChoiceButton = event.target.closest(".survey-choice, .survey-score-button");

  if (surveyChoiceButton) {
    const questionId = surveyChoiceButton.dataset.question;
    const value = Number(surveyChoiceButton.dataset.value);

    if (questionId && Number.isFinite(value)) {
      surveyAnswers[questionId] = value;
      surveyErrorText = "";
      render();
    }

    return;
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

elements.detailPanel.addEventListener("input", (event) => {
  if (event.target.id !== "testerIdInput") {
    const surveyQuestionId = event.target.dataset.question;

    if (surveyQuestionId && ["q10", "q11", "q12"].includes(surveyQuestionId)) {
      surveyAnswers[surveyQuestionId] = event.target.value;
    }

    return;
  }

  testerIdInputText = event.target.value;

  if (testerIdErrorText && testerIdInputText.trim()) {
    testerIdErrorText = "";
  }
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
