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
import { SISTER_KNOWLEDGE_BY_CARD, SISTER_KNOWLEDGE_FALLBACK } from "../data/sisterKnowledge.js";
import { INITIAL_MESSAGE_THREADS } from "../data/initialMessages.js";
import { BADGE_RANDOM_SCALE, BADGE_ROTATION, BIRD_DISTANCE_SCALE, CAMERA_FOCUS_CONFIG, LOG_LIMIT } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { createAnalyticsSession, flush, track } from "./analytics.js";
import { SAVE_RESET_REGISTRY, loadFieldGuide, resetSave as resetStoredSave, saveFieldGuide } from "./storage.js";
import { BEHAVIOR_STATE_DISPLAY, getCurrentPhotoState } from "./photoSequence.js";
import { endGame, handleCatalogueAction, handleDistantListenAction, handleExploreAction, handleFirstEncounterAction, handlePhotoAction, handleSpotSelectAction, startGame, startGameAtSpot } from "./gameSession.js";
import { getCardCaptureCount, getCollectedCardEntry, getCollectedCardIds, getCollectedCardSnapshots, getCollectedCardSisterKnowledge, getPendingAutoCatalogueCardId, getSpeciesCataloguedRealTimestamp, getSpeciesKnowledgeState, getSpeciesPhotoCount, getSpeciesSeenCount, hasUnreadLiyaMessages, hasUnreadLiyaPhotoReply, identifyCollectedCard, isCollectedCardSentToSister, isCollectedCardSisterKnowledgeUnlocked, markAutoCatalogueCompleted, markCollectedCardViewed, markDueSisterRepliesReadByCardIds, sendCollectedCardToSister, setCollectedCardLiyaMessageQueueItem } from "./fieldGuide.js";
import { createRarityBadgeHtml } from "./rarityDisplay.js";
import { getAllSpots, getCurrentSpot, getSpotById, getSurroundingSpotMap } from "./spotManager.js";
import { getFocusConfig, createFocusRuntime, evaluateFocus, computeBadgeRotation, getFocusAffixDisplay, getFocusDistance } from "./focusEngine.js";
import { getFocusSequenceState } from "./focusSequence.js";
import { getLiyaMessageById, loadLiyaMessages, selectLiyaMessages } from "./liyaMessageSystem.js";
import {
  captureChatScrollState as captureChatScrollStateUI,
  clearLiyaLineAnimationTimers as clearLiyaLineAnimationTimersUI,
  getVisibleLiyaReplyCardIds as getVisibleLiyaReplyCardIdsUI,
  isElementFullyVisibleInContainer as isElementFullyVisibleInContainerUI,
  renderMessagePanel as renderMessagePanelUI,
  restoreChatScrollState as restoreChatScrollStateUI
} from "./ui/messagePanel.js";
import {
  renderFieldGuideCardDetailPanel,
  renderFieldGuideDetailPolaroid as renderFieldGuideDetailPolaroidUI,
  renderFieldGuideEmptyPanel,
  renderFieldGuideListPanel,
  renderResetSaveConfirmPanel,
  renderFieldGuideSnapshotNav as renderFieldGuideSnapshotNavUI
} from "./ui/fieldGuidePanel.js";

let gameState = createDefaultGameState();
let isSettlementRevealed = false;
let fieldGuideSpeciesIndex = 0;
let fieldGuideDetailCardId = null;
let fieldGuideDetailSnapshotIndex = 0;
let activeOverlay = null;
let resetSaveReturnOverlay = null;
let inlinePanelJustOpened = null;
let activeMessagePreview = null;
let messageView = "list";
let shouldAutoScrollChatHistory = false;
let recentlyCataloguedSpeciesId = null;
let recentlyIdentifiedCardId = null;
let recentlyIdentifiedTimerId = null;
let sisterReplyTimerId = null;
let autoCatalogueCompletionTimerId = null;
let autoCatalogueCompletingSpeciesId = null;
let focusAnimationFrameId = null;
let focusRuntime = null;
let focusStartedAt = 0;
let focusBadgeRandomScale = 1;
let latestBadgeRotation = 0;
// 点击快门时读取这个结果生成 capturedFocusAffix；失焦不阻止拍摄，也不改变 rarity。
let latestFocusResult = null;
let latestFocusKey = "";
let focusEnterFrom = null;
let focusEnterCurve = null;
let focusEnterTarget = null;
let focusMotionStarted = false;
let focusActiveWindowStartedAt = 0;
let focusTimedOut = false;
let isApplyingVisibleLiyaAutoRead = false;
let pendingChatScrollRestoreState = null;
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
let hasShownOpeningMonologue = false;
let currentAnalyticsSession = null;
let analyticsSessionStartedAt = null;
let analyticsLastPhotoAt = null;
let analyticsSessionPhotoCount = 0;
let analyticsSpeciesSeenInSession = new Set();
let analyticsSpotsVisitedInSession = new Set();
let analyticsSessionEnded = true;
let analyticsCurrentChatSession = null;
let analyticsChatOpenCount = 0;
let analyticsChatTotalMs = 0;
let analyticsLastChatOpenedAt = null;
let analyticsLastBusinessEvent = "unknown";
let analyticsSisterRepliesReceivedCount = 0;
let analyticsSisterRepliesViewedCount = 0;
let analyticsFieldGuideOpenCount = 0;
let analyticsOpeningNarrativeSeenAt = null;
let analyticsOpeningNarrativeCompleted = false;
let analyticsOpeningNarrativeActive = false;

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
const FOCUS_OFFSET_X_RATIO = 0.42;
const FOCUS_OFFSET_Y_RATIO = 0.34;
const FOCUS_ENTER_TARGET_RANGE_X = 0.156 / FOCUS_OFFSET_X_RATIO;
const FOCUS_ENTER_TARGET_RANGE_Y = 0.13 / FOCUS_OFFSET_Y_RATIO;
const ENABLE_CARD_IDENTIFY_UI = false;
const FOCUS_FRAME_VISUAL_SIZE = {
  width: 40,
  height: 30
};
const FOCUS_FRAME_CONTAINER_PADDING = 32;
const OPENING_MONOLOGUE_TEXT = `我只是想出来走走。

辞职以后，时间突然变得很空，空得让我不知道该把自己放在哪里。
力娅说，如果看到鸟，不要自己查，先拍下来发给她。
她说这是“陈老师的作业”。

那就从今天开始吧。`;
const REST_TRANSITION_TEXT = `我回到家，给手机充上电。

窗外的天慢慢暗下来。明天清晨，再去看看吧。`;
const START_DAY_PROMPT_TEXT = "准备好了就出发吧。";
const OPENING_NARRATIVE_ID = "opening_v1";

const elements = {
  mode: document.querySelector("#modeText"),
  turn: document.querySelector("#turnText"),
  spot: document.querySelector("#spotText"),
  direction: document.querySelector("#directionText"),
  sdCard: document.querySelector("#sdCardText"),
  photoTiming: document.querySelector("#photoTimingText"),
  eventText: document.querySelector("#eventText"),
  statusGrid: document.querySelector(".status-grid"),
  actionPanel: document.querySelector("#actionPanel"),
  logList: document.querySelector("#logList"),
  detailPanel: document.querySelector("#detailPanel")
};

const utilityActions = document.createElement("section");
utilityActions.className = "utility-actions";
utilityActions.setAttribute("aria-label", "系统入口");
utilityActions.innerHTML = `
  <button class="dashboard-card-button utility-action-button utility-message-button" type="button" data-action="messages"></button>
  <button class="dashboard-card-button utility-action-button utility-guide-button" type="button" data-action="fieldGuide"></button>
`;
elements.actionPanel.before(utilityActions);
elements.utilityActions = utilityActions;
elements.utilityMessages = utilityActions.querySelector('[data-action="messages"]');
elements.utilityGuide = utilityActions.querySelector('[data-action="fieldGuide"]');
elements.detailLayout = elements.detailPanel.parentElement;
elements.logPanel = elements.logList.closest(".log-panel");

const subtitleElement = document.querySelector(".subtitle");
if (subtitleElement) {
  subtitleElement.remove();
}

function replaceStatusEntryWithInfo(entryEl, label, value) {
  if (!entryEl) {
    return null;
  }

  const infoBlock = document.createElement("div");
  infoBlock.id = entryEl.id;
  infoBlock.className = "status-info-card";
  infoBlock.innerHTML = `
    <span class="status-label">${label}</span>
    <span class="status-value">${value}</span>
  `;
  entryEl.replaceWith(infoBlock);
  return infoBlock;
}

elements.mode = replaceStatusEntryWithInfo(elements.mode, "周围事件", "暂无事件");
elements.spot = replaceStatusEntryWithInfo(elements.spot, "天气", "晴天");

function getSpeciesPhotoDisplayName(speciesId) {
  const species = speciesList.find((item) => item.id === speciesId);
  if (!species) {
    return "未知鸟种";
  }

  return getSpeciesKnowledgeState(gameState.fieldGuide, speciesId) === "CATALOGUED"
    ? species.name
    : species.nickname;
}

function getSpeciesById(speciesId) {
  return speciesList.find((item) => item.id === speciesId) || null;
}

function getSpeciesNameForSettlement(state, speciesId) {
  const species = getSpeciesById(speciesId);

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

function getTimeOfDayClassName(label) {
  const classNameByLabel = {
    清晨: "time-of-day-dawn",
    上午: "time-of-day-morning",
    中午: "time-of-day-noon",
    下午: "time-of-day-afternoon",
    黄昏: "time-of-day-dusk"
  };

  return classNameByLabel[label] || classNameByLabel.清晨;
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
    SETTLEMENT: "观察记录",
    FIELD_GUIDE: "笔记查看",
    SPOT_SELECT: "选择鸟点"
  };

  return modeDisplay[mode] || "未知阶段";
}

function hasFieldGuideProgress(fieldGuide) {
  if (!fieldGuide || typeof fieldGuide !== "object") {
    return false;
  }

  const heardCount = Array.isArray(fieldGuide.heardSpeciesIds) ? fieldGuide.heardSpeciesIds.length : 0;
  const seenCount = Array.isArray(fieldGuide.seenSpeciesIds) ? fieldGuide.seenSpeciesIds.length : 0;
  const cataloguedCount = Array.isArray(fieldGuide.cataloguedSpeciesIds) ? fieldGuide.cataloguedSpeciesIds.length : 0;
  const cardsCount = Array.isArray(fieldGuide.collectedCards) ? fieldGuide.collectedCards.length : 0;

  return heardCount > 0 || seenCount > 0 || cataloguedCount > 0 || cardsCount > 0;
}

function applyStartModeNarration({ fromRest = false } = {}) {
  if (gameState.mode !== "START") {
    return;
  }

  if (fromRest) {
    gameState.eventText = REST_TRANSITION_TEXT;
    hasShownOpeningMonologue = true;
    analyticsOpeningNarrativeActive = false;
    return;
  }

  const hasProgress = hasFieldGuideProgress(gameState.fieldGuide);
  if (!hasShownOpeningMonologue && !hasProgress) {
    gameState.eventText = OPENING_MONOLOGUE_TEXT;
    hasShownOpeningMonologue = true;
    trackOpeningNarrativeSeen({ source: "fresh_start" });
    return;
  }

  gameState.eventText = START_DAY_PROMPT_TEXT;
  hasShownOpeningMonologue = true;
  analyticsOpeningNarrativeActive = false;
}

function isAnalyticsString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getAnalyticsTimeOfDayValueFromState(state) {
  const label = getTimeOfDayLabel(state);

  if (label === "清晨" || label === "早晨" || label === "上午") {
    return "morning";
  }

  if (label === "黄昏" || label === "傍晚" || label === "夕阳") {
    return "dusk";
  }

  if (label === "中午" || label === "白天" || label === "下午") {
    return "day";
  }

  if (label === "夜晚" || label === "晚上") {
    return "night";
  }

  return "";
}

function getAnalyticsWeather() {
  return "晴天";
}

function createAnalyticsChatSessionId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getUnreadLiyaMessagesCountAtOpen() {
  const now = Date.now();
  const collectedCards = gameState.fieldGuide && Array.isArray(gameState.fieldGuide.collectedCards)
    ? gameState.fieldGuide.collectedCards
    : [];
  let unreadCount = 0;

  collectedCards.forEach((entry) => {
    if (Number.isFinite(getPendingUnreadLiyaReplyDueAt(entry, now))) {
      unreadCount += 1;
    }
  });

  const liyaThread = getInitialThreadConfig("liya");
  if (liyaThread && Array.isArray(liyaThread.messages)) {
    liyaThread.messages.forEach((message) => {
      if (
        message
        && message.read === false
        && !isInitialMessageRead(message, gameState.fieldGuide)
      ) {
        unreadCount += 1;
      }
    });
  }

  return unreadCount;
}

function openAnalyticsChatSession(options = {}) {
  if (!currentAnalyticsSession || analyticsSessionEnded || analyticsCurrentChatSession) {
    return;
  }

  const threadId = isAnalyticsString(options.threadId) ? options.threadId : "messages";
  const source = isAnalyticsString(options.source) ? options.source : "unknown";
  const openedAt = Date.now();
  const unreadCountAtOpen = getUnreadLiyaMessagesCountAtOpen();
  const precedingEvent = isAnalyticsString(analyticsLastBusinessEvent) ? analyticsLastBusinessEvent : "unknown";

  analyticsCurrentChatSession = {
    chatSessionId: createAnalyticsChatSessionId(),
    openedAt,
    unreadCountAtOpen,
    precedingEvent,
    messagesViewedInChat: 0,
    threadId,
    source
  };
  analyticsChatOpenCount += 1;
  analyticsLastChatOpenedAt = openedAt;

  track("chat_opened", {
    chat_session_id: analyticsCurrentChatSession.chatSessionId,
    unread_count_at_open: unreadCountAtOpen,
    preceding_event: precedingEvent,
    thread_id: threadId,
    source
  });
}

function closeAnalyticsChatSession() {
  if (!currentAnalyticsSession || analyticsSessionEnded || !analyticsCurrentChatSession) {
    return;
  }

  const durationMs = Math.max(0, Date.now() - analyticsCurrentChatSession.openedAt);
  analyticsChatTotalMs += durationMs;

  track("chat_closed", {
    chat_session_id: analyticsCurrentChatSession.chatSessionId,
    duration_ms: durationMs,
    messages_viewed_in_chat: analyticsCurrentChatSession.messagesViewedInChat || 0,
    thread_id: analyticsCurrentChatSession.threadId || ""
  });

  analyticsCurrentChatSession = null;
}

function getFieldGuideDiscoveredSpeciesCount(guide) {
  if (!guide || typeof guide !== "object") {
    return 0;
  }

  const speciesSet = new Set();
  const heardSpeciesIds = Array.isArray(guide.heardSpeciesIds) ? guide.heardSpeciesIds : [];
  const seenSpeciesIds = Array.isArray(guide.seenSpeciesIds) ? guide.seenSpeciesIds : [];
  const cataloguedSpeciesIds = Array.isArray(guide.cataloguedSpeciesIds) ? guide.cataloguedSpeciesIds : [];

  heardSpeciesIds.forEach((speciesId) => speciesSet.add(speciesId));
  seenSpeciesIds.forEach((speciesId) => speciesSet.add(speciesId));
  cataloguedSpeciesIds.forEach((speciesId) => speciesSet.add(speciesId));

  return speciesSet.size;
}

function trackFieldGuideOpened(options = {}) {
  if (!currentAnalyticsSession || analyticsSessionEnded) {
    return;
  }

  const guide = gameState.fieldGuide && typeof gameState.fieldGuide === "object"
    ? gameState.fieldGuide
    : null;
  const cardsInGuide = guide && Array.isArray(guide.collectedCards) ? guide.collectedCards.length : 0;
  const discoveredSpeciesCount = getFieldGuideDiscoveredSpeciesCount(guide);
  const cataloguedSpeciesCount = guide && Array.isArray(guide.cataloguedSpeciesIds)
    ? guide.cataloguedSpeciesIds.length
    : 0;
  const precedingEvent = isAnalyticsString(analyticsLastBusinessEvent) ? analyticsLastBusinessEvent : "unknown";
  const source = isAnalyticsString(options.source) ? options.source : "unknown";

  track("field_guide_opened", {
    preceding_event: precedingEvent,
    cards_in_guide: cardsInGuide,
    discovered_species_count: discoveredSpeciesCount,
    catalogued_species_count: cataloguedSpeciesCount,
    source
  });

  analyticsFieldGuideOpenCount += 1;
  analyticsLastBusinessEvent = "field_guide_opened";
}

function trackOpeningNarrativeSeen(options = {}) {
  if (analyticsOpeningNarrativeActive) {
    return;
  }

  const seenAt = Date.now();
  const source = isAnalyticsString(options.source) ? options.source : "unknown";
  const mode = isAnalyticsString(gameState && gameState.mode) ? gameState.mode : "unknown";

  track("opening_narrative_seen", {
    narrative_id: OPENING_NARRATIVE_ID,
    mode,
    source
  });

  analyticsOpeningNarrativeSeenAt = seenAt;
  analyticsOpeningNarrativeCompleted = false;
  analyticsOpeningNarrativeActive = true;
  analyticsLastBusinessEvent = "opening_narrative_seen";
}

function trackOpeningNarrativeCompleted(options = {}) {
  if (!analyticsOpeningNarrativeActive || analyticsOpeningNarrativeCompleted) {
    return;
  }

  const now = Date.now();
  const nextAction = isAnalyticsString(options.nextAction) ? options.nextAction : "unknown";
  const secondsOnPage = Number.isFinite(analyticsOpeningNarrativeSeenAt)
    ? Math.max(0, Math.round((now - analyticsOpeningNarrativeSeenAt) / 1000))
    : null;

  track("opening_narrative_completed", {
    narrative_id: OPENING_NARRATIVE_ID,
    seconds_on_page: secondsOnPage,
    next_action: nextAction
  });

  analyticsOpeningNarrativeCompleted = true;
  analyticsOpeningNarrativeActive = false;
  analyticsLastBusinessEvent = "opening_narrative_completed";
}

function getAnalyticsLiyaQueueSnapshot(entry) {
  const queueItem = getLiyaQueueItem(entry);
  if (!queueItem || queueItem.source !== "photo_reply" || queueItem.threadId !== "liya") {
    return null;
  }

  const messageId = isAnalyticsString(queueItem.messageId) ? queueItem.messageId : "";
  if (!messageId) {
    return null;
  }

  const createdAt = toSafeTimestamp(queueItem.createdAt);
  const dueAt = toSafeTimestamp(queueItem.dueAt);
  const deliveredAt = toSafeTimestamp(queueItem.deliveredAt);
  const readAt = toSafeTimestamp(queueItem.readAt);
  const isRead = (typeof queueItem.status === "string" && queueItem.status === "read") || Number.isFinite(readAt);
  const context = queueItem && queueItem.context && typeof queueItem.context === "object" && !Array.isArray(queueItem.context)
    ? queueItem.context
    : {};
  const cardId = isAnalyticsString(queueItem.cardId)
    ? queueItem.cardId
    : (isAnalyticsString(entry && entry.cardId) ? entry.cardId : "");
  const speciesId = isAnalyticsString(queueItem.speciesId)
    ? queueItem.speciesId
    : (isAnalyticsString(context.speciesId) ? context.speciesId : "");
  const photoId = isAnalyticsString(queueItem.photoId)
    ? queueItem.photoId
    : (isAnalyticsString(context.photoId) ? context.photoId : cardId);

  return {
    messageId,
    cardId,
    speciesId,
    photoId: photoId || "",
    createdAt,
    dueAt,
    deliveredAt,
    readAt,
    isRead
  };
}

function getLiyaMessageTagsText(messageId) {
  if (!isAnalyticsString(messageId)) {
    return "";
  }

  const message = getLiyaMessageById(messageId);
  const tags = message && Array.isArray(message.tags) ? message.tags : [];
  const safeTags = tags
    .map((tag) => (isAnalyticsString(tag) ? tag : ""))
    .filter(Boolean);
  return safeTags.join(",");
}

function trackSisterMessageReceived(entry, receivedAt = Date.now()) {
  if (!currentAnalyticsSession || analyticsSessionEnded) {
    return false;
  }

  const queueItem = getLiyaQueueItem(entry);
  if (!queueItem || queueItem.source !== "photo_reply" || queueItem.threadId !== "liya") {
    return false;
  }

  const snapshot = getAnalyticsLiyaQueueSnapshot(entry);
  if (!snapshot || Number.isFinite(snapshot.deliveredAt)) {
    return false;
  }

  if (!Number.isFinite(snapshot.dueAt) || receivedAt < snapshot.dueAt) {
    return false;
  }

  const delaySeconds = Number.isFinite(snapshot.createdAt) && Number.isFinite(snapshot.dueAt)
    ? Math.max(0, Math.round((snapshot.dueAt - snapshot.createdAt) / 1000))
    : null;

  track("sister_message_received", {
    message_id: snapshot.messageId,
    photo_id: snapshot.photoId,
    card_id: snapshot.cardId,
    species_id: snapshot.speciesId,
    tags: getLiyaMessageTagsText(snapshot.messageId),
    delay_seconds: delaySeconds
  });

  queueItem.deliveredAt = receivedAt;
  if (queueItem.status === "pending") {
    queueItem.status = "delivered";
  }
  entry.liyaMessageQueueItem = queueItem;
  analyticsSisterRepliesReceivedCount += 1;
  analyticsLastBusinessEvent = "sister_message_received";
  return true;
}

function trackSisterMessageViewed(snapshot, viewedAt = Date.now()) {
  if (!currentAnalyticsSession || analyticsSessionEnded || !snapshot || !snapshot.messageId) {
    return false;
  }

  const receivedAt = Number.isFinite(snapshot.deliveredAt)
    ? snapshot.deliveredAt
    : (Number.isFinite(snapshot.dueAt) ? snapshot.dueAt : null);
  const secondsSinceReceived = Number.isFinite(receivedAt)
    ? Math.max(0, Math.round((viewedAt - receivedAt) / 1000))
    : null;
  const secondsSincePhotoTaken = Number.isFinite(snapshot.createdAt)
    ? Math.max(0, Math.round((viewedAt - snapshot.createdAt) / 1000))
    : null;

  track("sister_message_viewed", {
    message_id: snapshot.messageId,
    photo_id: snapshot.photoId,
    card_id: snapshot.cardId,
    species_id: snapshot.speciesId,
    seconds_since_received: secondsSinceReceived,
    seconds_since_photo_taken: secondsSincePhotoTaken
  });

  analyticsSisterRepliesViewedCount += 1;
  if (analyticsCurrentChatSession) {
    analyticsCurrentChatSession.messagesViewedInChat += 1;
  }
  analyticsLastBusinessEvent = "sister_message_viewed";
  return true;
}

function getQueueSnapshotsByCardIds(fieldGuide, cardIds) {
  const normalizedCardIds = Array.isArray(cardIds)
    ? cardIds.filter((cardId) => isAnalyticsString(cardId))
    : [];
  const snapshotByCardId = new Map();

  if (!fieldGuide || normalizedCardIds.length <= 0) {
    return snapshotByCardId;
  }

  const cardIdSet = new Set(normalizedCardIds);
  const collectedCards = fieldGuide && Array.isArray(fieldGuide.collectedCards) ? fieldGuide.collectedCards : [];

  collectedCards.forEach((entry) => {
    if (!entry || !cardIdSet.has(entry.cardId)) {
      return;
    }

    const snapshot = getAnalyticsLiyaQueueSnapshot(entry);
    if (snapshot) {
      snapshotByCardId.set(entry.cardId, snapshot);
    }
  });

  return snapshotByCardId;
}

function syncViewedEventsFromReadTransitions(fieldGuide, cardIds, beforeByCardId, now = Date.now()) {
  if (!currentAnalyticsSession || analyticsSessionEnded) {
    return;
  }

  const afterByCardId = getQueueSnapshotsByCardIds(fieldGuide, cardIds);
  const normalizedCardIds = Array.isArray(cardIds)
    ? cardIds.filter((cardId) => isAnalyticsString(cardId))
    : [];
  const collectedCards = fieldGuide && Array.isArray(fieldGuide.collectedCards) ? fieldGuide.collectedCards : [];
  let hasGuideChanged = false;

  normalizedCardIds.forEach((cardId) => {
    const beforeSnapshot = beforeByCardId.get(cardId) || null;
    const afterSnapshot = afterByCardId.get(cardId) || null;
    if (!afterSnapshot || !afterSnapshot.isRead) {
      return;
    }

    const wasRead = beforeSnapshot ? beforeSnapshot.isRead : false;
    if (wasRead) {
      return;
    }

    const entry = collectedCards.find((item) => item && item.cardId === cardId);
    if (!entry) {
      return;
    }

    if (!Number.isFinite(afterSnapshot.deliveredAt)) {
      if (trackSisterMessageReceived(entry, now)) {
        hasGuideChanged = true;
      }
    }

    const finalSnapshot = getAnalyticsLiyaQueueSnapshot(entry);
    trackSisterMessageViewed(finalSnapshot || afterSnapshot, now);
  });

  if (hasGuideChanged) {
    saveFieldGuide(fieldGuide);
  }
}

function syncDueLiyaAnalyticsEvents(now = Date.now()) {
  if (!currentAnalyticsSession || analyticsSessionEnded) {
    return;
  }

  const collectedCards = gameState.fieldGuide && Array.isArray(gameState.fieldGuide.collectedCards)
    ? gameState.fieldGuide.collectedCards
    : [];
  let hasGuideChanged = false;

  collectedCards.forEach((entry) => {
    if (trackSisterMessageReceived(entry, now)) {
      hasGuideChanged = true;
    }
  });

  if (hasGuideChanged) {
    saveFieldGuide(gameState.fieldGuide);
  }
}

function resetAnalyticsSessionRuntime() {
  currentAnalyticsSession = null;
  analyticsSessionStartedAt = null;
  analyticsLastPhotoAt = null;
  analyticsSessionPhotoCount = 0;
  analyticsSpeciesSeenInSession = new Set();
  analyticsSpotsVisitedInSession = new Set();
  analyticsSessionEnded = true;
  analyticsCurrentChatSession = null;
  analyticsChatOpenCount = 0;
  analyticsChatTotalMs = 0;
  analyticsLastChatOpenedAt = null;
  analyticsLastBusinessEvent = "unknown";
  analyticsSisterRepliesReceivedCount = 0;
  analyticsSisterRepliesViewedCount = 0;
  analyticsFieldGuideOpenCount = 0;
}

function beginAnalyticsSession(startSpotId = "") {
  if (currentAnalyticsSession && !analyticsSessionEnded) {
    return;
  }

  resetAnalyticsSessionRuntime();
  currentAnalyticsSession = createAnalyticsSession({ forceNew: true });
  analyticsSessionStartedAt = Date.now();
  analyticsSessionEnded = false;

  if (isAnalyticsString(startSpotId)) {
    analyticsSpotsVisitedInSession.add(startSpotId);
  }

  track("session_start", {
    start_spot_id: isAnalyticsString(startSpotId) ? startSpotId : "",
    battery_max: Number.isFinite(gameState.maxPhotos) ? gameState.maxPhotos : null,
    start_time_of_day: getAnalyticsTimeOfDayValueFromState(gameState),
    weather: getAnalyticsWeather()
  });
  analyticsLastBusinessEvent = "session_start";
}

function deriveSessionEndReason(type, action) {
  if ((type === "system" && action === "endGame") || action === "retreat") {
    return "retreat";
  }

  const eventText = String(gameState.eventText || "");
  if (eventText.includes("电池没有电")) {
    return "battery_exhausted";
  }

  if (eventText.includes("天色不早")) {
    return "time_exhausted";
  }

  if (eventText.includes("今天先到这里")) {
    return "retreat";
  }

  return "unknown";
}

function finishAnalyticsSession(type, action) {
  if (!currentAnalyticsSession || analyticsSessionEnded) {
    return;
  }

  const durationMs = analyticsSessionStartedAt
    ? Math.max(0, Date.now() - analyticsSessionStartedAt)
    : null;
  const sessionEndedAt = Date.now();
  const activeChatDurationMs = analyticsCurrentChatSession
    ? Math.max(0, sessionEndedAt - analyticsCurrentChatSession.openedAt)
    : 0;
  const chatTotalMs = analyticsChatTotalMs + activeChatDurationMs;
  const isLast30sChatOpened = Number.isFinite(analyticsLastChatOpenedAt)
    ? Math.max(0, sessionEndedAt - analyticsLastChatOpenedAt) <= 30000
    : false;

  track("session_end", {
    reason: deriveSessionEndReason(type, action),
    duration_ms: durationMs,
    total_photos: analyticsSessionPhotoCount,
    unique_species: analyticsSpeciesSeenInSession.size,
    spots_visited: analyticsSpotsVisitedInSession.size,
    total_sister_replies: analyticsSisterRepliesReceivedCount,
    sister_replies_read: analyticsSisterRepliesViewedCount,
    chat_open_count: analyticsChatOpenCount,
    chat_total_seconds: Math.round(chatTotalMs / 1000),
    field_guide_open_count: analyticsFieldGuideOpenCount,
    last_30s_chat_opened: isLast30sChatOpened
  });

  analyticsSessionEnded = true;
  analyticsCurrentChatSession = null;
  void flush({ reason: "session_end" });
}

function trackPhotoTaken(photo) {
  if (!photo || !photo.snapshot || !currentAnalyticsSession || analyticsSessionEnded) {
    return;
  }

  const snapshot = photo.snapshot;
  const speciesId = isAnalyticsString(photo.speciesId) ? photo.speciesId : "";
  const now = Number.isFinite(snapshot.realTimestamp) ? snapshot.realTimestamp : Date.now();
  const isFirstSpecies = speciesId ? !analyticsSpeciesSeenInSession.has(speciesId) : false;
  const secondsSinceLastPhoto = analyticsLastPhotoAt === null
    ? null
    : Math.max(0, Math.round((now - analyticsLastPhotoAt) / 1000));
  const composition = getLiyaPhotoComposition(snapshot);
  const quality = getLiyaPhotoQuality(snapshot);
  const timeOfDay = getLiyaTimeOfDayValue(snapshot);

  track("photo_taken", {
    photo_id: isAnalyticsString(photo.id) ? photo.id : `${isAnalyticsString(photo.card && photo.card.id) ? photo.card.id : "photo"}_${now}`,
    species_id: speciesId,
    card_id: isAnalyticsString(photo.card && photo.card.id) ? photo.card.id : "",
    behavior_state: isAnalyticsString(photo.capturedBehaviorState)
      ? photo.capturedBehaviorState
      : (isAnalyticsString(photo.behaviorState) ? photo.behaviorState : ""),
    quality: quality === "unknown" ? "" : quality,
    composition: composition === "unknown" ? "" : composition,
    is_first_species: isFirstSpecies,
    is_repeat_species_in_session: !isFirstSpecies,
    battery_remain: Number.isFinite(snapshot.batteryRemaining)
      ? snapshot.batteryRemaining
      : Math.max(0, (Number(gameState.maxPhotos) || 0) - (Number(gameState.photos.length) || 0)),
    seconds_since_last_photo: secondsSinceLastPhoto,
    spot_id: isAnalyticsString(snapshot.spotId) ? snapshot.spotId : (isAnalyticsString(gameState.currentSpotId) ? gameState.currentSpotId : ""),
    time_of_day: timeOfDay === "unknown" ? "" : timeOfDay
  });

  if (speciesId) {
    analyticsSpeciesSeenInSession.add(speciesId);
  }

  if (isAnalyticsString(snapshot.spotId)) {
    analyticsSpotsVisitedInSession.add(snapshot.spotId);
  } else if (isAnalyticsString(gameState.currentSpotId)) {
    analyticsSpotsVisitedInSession.add(gameState.currentSpotId);
  }

  analyticsSessionPhotoCount += 1;
  analyticsLastPhotoAt = now;
  analyticsLastBusinessEvent = "photo_taken";
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
    <span class="focus-frame" style="${getFocusFrameStyle()}" aria-hidden="true">
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

function getCardDisplayTitle(card) {
  return card.title;
}

function getCardDisplayDescription(card) {
  return card.description;
}

const MESSAGE_THREAD_VIEW_BY_ID = {
  liya: "sisterChat",
  mother: "momChat",
  miaomiao: "miaomiaoChat"
};

const MESSAGE_THREAD_ID_BY_VIEW = {
  sisterChat: "liya",
  momChat: "mother",
  miaomiaoChat: "miaomiao"
};

const MESSAGE_THREAD_ORDER = ["liya", "mother", "miaomiao"];

const INITIAL_MESSAGE_THREAD_BY_ID = new Map(
  (Array.isArray(INITIAL_MESSAGE_THREADS) ? INITIAL_MESSAGE_THREADS : [])
    .filter((thread) => thread && typeof thread.id === "string")
    .map((thread) => [thread.id, thread])
);

function getMessageThreadIdByView(view) {
  return MESSAGE_THREAD_ID_BY_VIEW[view] || null;
}

function getMessageThreadViewById(threadId) {
  return MESSAGE_THREAD_VIEW_BY_ID[threadId] || null;
}

function getInitialThreadConfig(threadId) {
  return INITIAL_MESSAGE_THREAD_BY_ID.get(threadId) || null;
}

function getMessageThreadIds() {
  return MESSAGE_THREAD_ORDER.filter((threadId) => INITIAL_MESSAGE_THREAD_BY_ID.has(threadId));
}

function getInitialMessageReadMap(fieldGuide) {
  if (!fieldGuide || typeof fieldGuide !== "object" || Array.isArray(fieldGuide)) {
    return {};
  }

  const readMap = fieldGuide.initialMessageReadMap;
  if (!readMap || typeof readMap !== "object" || Array.isArray(readMap)) {
    return {};
  }

  return readMap;
}

function isInitialMessageRead(message, fieldGuide) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return true;
  }

  if (message.read === true) {
    return true;
  }

  if (message.read === false) {
    const readMap = getInitialMessageReadMap(fieldGuide);
    return readMap[message.id] === true;
  }

  return true;
}

function hasUnreadInitialMessages(threadId, fieldGuide) {
  const thread = getInitialThreadConfig(threadId);
  if (!thread || !Array.isArray(thread.messages)) {
    return false;
  }

  return thread.messages.some((message) => (
    message
    && message.read === false
    && !isInitialMessageRead(message, fieldGuide)
  ));
}

function hasAnyUnreadInitialMessages(fieldGuide) {
  return getMessageThreadIds().some((threadId) => hasUnreadInitialMessages(threadId, fieldGuide));
}

function hasAnyUnreadMessages(fieldGuide) {
  return hasUnreadLiyaMessages(fieldGuide) || hasAnyUnreadInitialMessages(fieldGuide);
}

function markInitialThreadMessagesRead(threadId) {
  const thread = getInitialThreadConfig(threadId);
  if (!thread || !Array.isArray(thread.messages) || !gameState || !gameState.fieldGuide) {
    return false;
  }

  const unreadIds = thread.messages
    .filter((message) => (
      message
      && message.read === false
      && typeof message.id === "string"
      && message.id.trim()
      && !isInitialMessageRead(message, gameState.fieldGuide)
    ))
    .map((message) => message.id.trim());

  if (unreadIds.length <= 0) {
    return false;
  }

  const nextReadMap = { ...getInitialMessageReadMap(gameState.fieldGuide) };
  unreadIds.forEach((messageId) => {
    nextReadMap[messageId] = true;
  });

  gameState.fieldGuide = {
    ...gameState.fieldGuide,
    initialMessageReadMap: nextReadMap
  };
  saveFieldGuide(gameState.fieldGuide);
  return true;
}

function openMessageThread(threadId) {
  const view = getMessageThreadViewById(threadId);
  if (!view) {
    return false;
  }

  if (threadId !== "liya") {
    clearLiyaLineAnimationTimers();
  }
  markInitialThreadMessagesRead(threadId);
  messageView = view;
  shouldAutoScrollChatHistory = true;
  render();
  return true;
}

function normalizeInitialMessageSender(speaker) {
  if (speaker === "player" || speaker === "self" || speaker === "yu") {
    return "player";
  }

  return "sister";
}

function normalizeInitialThreadMessages(threadId) {
  const thread = getInitialThreadConfig(threadId);
  if (!thread || !Array.isArray(thread.messages)) {
    return [];
  }

  return thread.messages
    .map((message, index) => {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        return null;
      }

      const fallbackTimestamp = 0;
      const timestamp = Number.isFinite(message.timestamp) ? message.timestamp : fallbackTimestamp;
      const text = typeof message.text === "string" ? message.text : "";

      return {
        id: typeof message.id === "string" ? message.id : `${threadId}_initial_${index}`,
        sender: normalizeInitialMessageSender(message.speaker),
        type: "text",
        source: "initial_seed",
        threadId,
        text,
        time: timestamp,
        sortAt: timestamp,
        order: 0,
        _stableKey: `${threadId}_initial_${index}`
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.sortAt !== right.sortAt) {
        return left.sortAt - right.sortAt;
      }
      return String(left._stableKey).localeCompare(String(right._stableKey));
    });
}

function normalizeKnowledgeLines(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function getSisterKnowledgeForCard(card, species, options = {}) {
  if (!card) {
    return normalizeKnowledgeLines(SISTER_KNOWLEDGE_FALLBACK.NORMAL);
  }

  const cardKnowledge = normalizeKnowledgeLines(SISTER_KNOWLEDGE_BY_CARD[card.id]);
  if (cardKnowledge.length > 0) {
    return cardKnowledge;
  }

  const fallbackKnowledge = normalizeKnowledgeLines(SISTER_KNOWLEDGE_FALLBACK[card.rarity]);
  if (fallbackKnowledge.length > 0) {
    return fallbackKnowledge;
  }

  return normalizeKnowledgeLines(SISTER_KNOWLEDGE_FALLBACK.NORMAL);
}

function getLiyaTimeOfDayValue(snapshot) {
  const label = getSnapshotTimeOfDayLabel(snapshot);

  if (label === "清晨" || label === "早晨" || label === "上午") {
    return "morning";
  }

  if (label === "黄昏" || label === "傍晚" || label === "夕阳") {
    return "dusk";
  }

  if (label === "中午" || label === "白天" || label === "下午") {
    return "day";
  }

  if (label === "夜晚" || label === "晚上") {
    return "night";
  }

  return "unknown";
}

function getLiyaPhotoQuality(snapshot) {
  if (!snapshot) {
    return "unknown";
  }

  if (Number.isFinite(snapshot.focusScore)) {
    if (snapshot.focusScore >= 80) {
      return "clear";
    }

    if (snapshot.focusScore >= 50) {
      return "normal";
    }

    return "blurred";
  }

  if (snapshot.focusAffix === "IN_FOCUS") {
    return "clear";
  }

  if (snapshot.focusAffix === "BLUR") {
    return "blurred";
  }

  return "normal";
}

function getLiyaPhotoComposition(snapshot) {
  if (!snapshot || !Number.isFinite(snapshot.badgeRelX) || !Number.isFinite(snapshot.badgeRelY)) {
    return "unknown";
  }

  const offsetX = Math.abs(snapshot.badgeRelX - 50);
  const offsetY = Math.abs(snapshot.badgeRelY - 50);
  return offsetX <= 18 && offsetY <= 18 ? "centered" : "off_center";
}

function hasSentSpeciesToSisterBefore(card, currentCardId) {
  if (!card || !card.speciesId) {
    return false;
  }

  const collectedCards = gameState.fieldGuide && Array.isArray(gameState.fieldGuide.collectedCards)
    ? gameState.fieldGuide.collectedCards
    : [];

  return collectedCards.some((entry) => {
    if (!entry || entry.cardId === currentCardId || entry.sentToSister !== true) {
      return false;
    }

    const sentCard = getCardById(entry.cardId);
    return Boolean(sentCard && sentCard.speciesId === card.speciesId);
  });
}

function getRecentLiyaPhotoReplyMessageIds(currentCardId, limit = 5) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
  const collectedCards = gameState.fieldGuide && Array.isArray(gameState.fieldGuide.collectedCards)
    ? gameState.fieldGuide.collectedCards
    : [];
  const candidateItems = collectedCards
    .filter((entry) => entry && entry.cardId && entry.cardId !== currentCardId)
    .map((entry) => {
      const queueItem = entry && entry.liyaMessageQueueItem && typeof entry.liyaMessageQueueItem === "object" && !Array.isArray(entry.liyaMessageQueueItem)
        ? entry.liyaMessageQueueItem
        : null;

      if (!queueItem || queueItem.threadId !== "liya" || queueItem.source !== "photo_reply") {
        return null;
      }

      const messageId = typeof queueItem.messageId === "string" ? queueItem.messageId.trim() : "";
      if (!messageId) {
        return null;
      }

      const createdAt = Number.isFinite(queueItem.createdAt) ? queueItem.createdAt : null;
      const dueAt = Number.isFinite(queueItem.dueAt) ? queueItem.dueAt : null;
      const sentAt = Number.isFinite(entry.sentToSisterAt) ? entry.sentToSisterAt : null;

      return {
        messageId,
        sortAt: createdAt ?? dueAt ?? sentAt ?? 0
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.sortAt - left.sortAt);

  const seen = new Set();
  const recentIds = [];
  for (const item of candidateItems) {
    if (seen.has(item.messageId)) {
      continue;
    }

    seen.add(item.messageId);
    recentIds.push(item.messageId);
    if (recentIds.length >= safeLimit) {
      break;
    }
  }

  return recentIds;
}

function createLiyaPhotoContext(card, snapshot, entry = null) {
  const speciesId = card && card.speciesId ? card.speciesId : "";
  const cardId = card && card.id ? card.id : "";
  const hasPriorSentSpecies = speciesId ? hasSentSpeciesToSisterBefore(card, (entry && entry.cardId) || cardId) : false;
  const species = speciesId ? getSpeciesById(speciesId) : null;
  const cardTitle = card ? getCardDisplayTitle(card) : "";
  const snapshotSpeciesName = snapshot && typeof snapshot.speciesName === "string" ? snapshot.speciesName.trim() : "";
  const entrySpeciesName = entry && typeof entry.speciesName === "string" ? entry.speciesName.trim() : "";
  const speciesName = (
    (species && typeof species.name === "string" && species.name.trim())
    || entrySpeciesName
    || snapshotSpeciesName
    || cardTitle
    || "这只鸟"
  );
  const sentToSisterAt = entry && Number.isFinite(entry.sentToSisterAt) ? entry.sentToSisterAt : "";
  const realTimestamp = snapshot && Number.isFinite(snapshot.realTimestamp) ? snapshot.realTimestamp : "";
  const cardIndex = snapshot && Number.isFinite(Number(snapshot.speciesPhotoIndex))
    ? Math.max(1, Math.floor(Number(snapshot.speciesPhotoIndex)))
    : "";

  return {
    speciesId,
    cardId,
    cardTitle: cardTitle || speciesName || "这张照片",
    speciesName,
    timeOfDay: getLiyaTimeOfDayValue(snapshot),
    quality: getLiyaPhotoQuality(snapshot),
    composition: getLiyaPhotoComposition(snapshot),
    locationId: snapshot && snapshot.spotId ? snapshot.spotId : "",
    firstTimeSpecies: speciesId ? !hasPriorSentSpecies : false,
    repeatSpecies: speciesId ? hasPriorSentSpecies : false,
    sentToSisterAt,
    realTimestamp,
    snapshotId: "",
    cardCreatedAt: "",
    cardIndex,
    storyStage: "early"
  };
}

function getLiyaPhotoReplySelection(card, snapshot, entry) {
  const photoContext = createLiyaPhotoContext(card, snapshot, entry);
  const recentMessageIds = getRecentLiyaPhotoReplyMessageIds((entry && entry.cardId) || (card && card.id) || "", 5);
  const selectedMessages = selectLiyaMessages("photo_sent", photoContext, {
    stage: photoContext.storyStage || "early",
    maxResults: 1,
    sentMessageIds: recentMessageIds
  });

  return {
    photoContext,
    message: selectedMessages[0] || null
  };
}

function renderLiyaMessageLines(lines, context = {}) {
  const speciesName = String((context && (context.speciesName || context.cardTitle)) || "这只鸟");
  const cardTitle = String((context && (context.cardTitle || context.speciesName)) || "这张照片");
  const safeLines = normalizeKnowledgeLines(lines);

  return safeLines.map((line) => (
    String(line)
      .replaceAll("{speciesName}", speciesName)
      .replaceAll("{cardTitle}", cardTitle)
  ));
}

function getLiyaMessageTextById(messageId, context = {}) {
  if (typeof messageId !== "string" || !messageId) {
    return "";
  }

  const message = getLiyaMessageById(messageId);
  const selectedLines = renderLiyaMessageLines(message && message.lines, context);
  return selectedLines.length > 0 ? selectedLines.join("\n") : "";
}

function getLiyaQueuedPhotoReplyText(entry, card) {
  const queueItem = entry && entry.liyaMessageQueueItem;
  const queueContext = queueItem && queueItem.context && typeof queueItem.context === "object" && !Array.isArray(queueItem.context)
    ? queueItem.context
    : {};
  const fallbackCard = card || ((entry && entry.cardId) ? getCardById(entry.cardId) : null);
  const speciesId = queueContext.speciesId || (fallbackCard && fallbackCard.speciesId) || "";
  const species = speciesId ? getSpeciesById(speciesId) : null;
  const speciesName = (
    (typeof queueContext.speciesName === "string" && queueContext.speciesName.trim())
    || (species && typeof species.name === "string" && species.name.trim())
    || ""
  );

  return getLiyaMessageTextById(queueItem && queueItem.messageId, {
    cardTitle: queueContext.cardTitle || (fallbackCard ? getCardDisplayTitle(fallbackCard) : ""),
    speciesName
  });
}

function getLiyaPhotoReplyText(card, snapshot, entry, fallbackLines) {
  const fallbackText = normalizeKnowledgeLines(fallbackLines)[0] || "我看到了，这张照片我会认真看。";
  const queuedText = getLiyaQueuedPhotoReplyText(entry, card);

  if (queuedText) {
    return queuedText;
  }

  try {
    const { photoContext, message } = getLiyaPhotoReplySelection(card, snapshot, entry);
    const selectedLines = renderLiyaMessageLines(message && message.lines, photoContext);

    return selectedLines.length > 0 ? selectedLines.join("\n") : fallbackText;
  } catch (error) {
    return fallbackText;
  }
}

function createLiyaPhotoReplyQueueItem(card, snapshot, entry) {
  if (!card || !entry || (entry.liyaMessageQueueItem && entry.liyaMessageQueueItem.messageId)) {
    return null;
  }

  try {
    const { photoContext, message } = getLiyaPhotoReplySelection(card, snapshot, entry);
    if (!message || !message.id) {
      return null;
    }

    const createdAt = Number.isFinite(entry.sentToSisterAt) ? entry.sentToSisterAt : Date.now();
    const dueAt = Number.isFinite(entry.sisterReplyDueAt) ? entry.sisterReplyDueAt : createdAt + 30000;
    const cardId = card.id || entry.cardId || "";
    const speciesId = card.speciesId || "";

    return {
      id: `liya_queue_photo_reply_${cardId}_${createdAt}`,
      source: "photo_reply",
      threadId: "liya",
      speaker: "liya",
      messageId: message.id,
      status: "pending",
      createdAt,
      dueAt,
      deliveredAt: null,
      readAt: null,
      cardId,
      speciesId,
      context: {
        eventName: "photo_sent",
        speciesId: photoContext.speciesId || "",
        speciesName: photoContext.speciesName || "",
        cardId: photoContext.cardId || "",
        cardTitle: photoContext.cardTitle || "这张照片",
        timeOfDay: photoContext.timeOfDay || "unknown",
        quality: photoContext.quality || "unknown",
        composition: photoContext.composition || "unknown",
        firstTimeSpecies: photoContext.firstTimeSpecies === true,
        repeatSpecies: photoContext.repeatSpecies === true
      },
      effects: {
        unlockSisterKnowledge: true,
        triggerAutoCatalogue: true
      }
    };
  } catch (error) {
    return null;
  }
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

function getFocusFrameSizeForContainerRect(containerRect) {
  if (!containerRect || containerRect.width <= 0 || containerRect.height <= 0) {
    return { ...FOCUS_FRAME_VISUAL_SIZE };
  }

  const maxWidth = Math.max(1, containerRect.width - FOCUS_FRAME_CONTAINER_PADDING);
  const maxHeight = Math.max(1, containerRect.height - FOCUS_FRAME_CONTAINER_PADDING);
  const scale = Math.min(
    1,
    maxWidth / FOCUS_FRAME_VISUAL_SIZE.width,
    maxHeight / FOCUS_FRAME_VISUAL_SIZE.height
  );

  return {
    width: Math.max(1, FOCUS_FRAME_VISUAL_SIZE.width * scale),
    height: Math.max(1, FOCUS_FRAME_VISUAL_SIZE.height * scale)
  };
}

function getFocusFrameStyle(size = FOCUS_FRAME_VISUAL_SIZE) {
  const width = Number.isFinite(size.width) ? size.width : FOCUS_FRAME_VISUAL_SIZE.width;
  const height = Number.isFinite(size.height) ? size.height : FOCUS_FRAME_VISUAL_SIZE.height;

  return [
    `width: ${width}px`,
    `height: ${height}px`,
    "left: 50%",
    "top: 50%",
    "transform: translate(-50%, -50%)"
  ].join("; ");
}

function applyFocusFrameSize(frameEl, containerRect = null) {
  if (!frameEl) {
    return { ...FOCUS_FRAME_VISUAL_SIZE };
  }

  const containerEl = frameEl.closest(".focus-playfield, .focus-polaroid-frame, .field-guide-detail-polaroid-frame");
  const size = getFocusFrameSizeForContainerRect(
    containerRect || (containerEl ? containerEl.getBoundingClientRect() : null)
  );

  frameEl.style.width = `${size.width}px`;
  frameEl.style.height = `${size.height}px`;
  frameEl.style.left = "50%";
  frameEl.style.top = "50%";
  frameEl.style.transform = "translate(-50%, -50%)";

  return size;
}

function applyRenderedFocusFrameSizes() {
  document
    .querySelectorAll(".focus-frame, .focus-polaroid-focus-area, .field-guide-detail-focus-area")
    .forEach((frameEl) => applyFocusFrameSize(frameEl));
}

function rollBadgeRandomScale() {
  return BADGE_RANDOM_SCALE.min + Math.random() * (BADGE_RANDOM_SCALE.max - BADGE_RANDOM_SCALE.min);
}

function getDistanceScale(distance) {
  return BIRD_DISTANCE_SCALE[distance] || BIRD_DISTANCE_SCALE.medium || 1;
}

function getCurrentBadgeFinalScale(currentBird) {
  const distanceScale = getDistanceScale((currentBird && currentBird.distance) || "medium");
  const randomScale = Number.isFinite(focusBadgeRandomScale) ? focusBadgeRandomScale : 1;
  return distanceScale * randomScale;
}

function getSnapshotFinalScale(snapshot) {
  return snapshot && Number.isFinite(snapshot.finalScale) ? snapshot.finalScale : 1;
}

function clampBadgeRotation(rotation) {
  if (!Number.isFinite(rotation)) {
    return 0;
  }

  const maxDegrees = Math.max(Number(BADGE_ROTATION.maxDegrees) || 30, 0);
  return Math.max(-maxDegrees, Math.min(maxDegrees, rotation));
}

function getSnapshotBadgeRotation(snapshot) {
  return snapshot && Number.isFinite(snapshot.badgeRotation)
    ? clampBadgeRotation(snapshot.badgeRotation)
    : 0;
}

const POLAROID_TIME_TINT_STOPS = [
  { at: 0, color: [218, 238, 232], alpha: 0.22, dim: 0 },
  { at: 0.3, color: [238, 240, 222], alpha: 0.16, dim: 0 },
  { at: 0.55, color: [246, 238, 218], alpha: 0.12, dim: 0 },
  { at: 0.78, color: [244, 213, 172], alpha: 0.18, dim: 0.04 },
  { at: 1, color: [214, 144, 82], alpha: 0.26, dim: 0.12 }
];

function lerpNumber(start, end, progress) {
  return start + (end - start) * progress;
}

function getPolaroidTimeProgress(snapshot, fallbackState = gameState) {
  const snapshotTurn = snapshot ? Number(snapshot.turn) : NaN;
  const snapshotTurnMax = snapshot ? Number(snapshot.turnMax) : NaN;
  const fallbackTurn = fallbackState ? Number(fallbackState.currentTurn) : NaN;
  const fallbackTurnMax = fallbackState ? Number(fallbackState.maxTurns) : NaN;
  const turn = Number.isFinite(snapshotTurn)
    ? snapshotTurn
    : Number.isFinite(fallbackTurn)
      ? fallbackTurn
      : null;
  const turnMax = Number.isFinite(snapshotTurnMax)
    ? snapshotTurnMax
    : Number.isFinite(fallbackTurnMax)
      ? fallbackTurnMax
      : null;

  if (!Number.isFinite(turn) || !Number.isFinite(turnMax) || turnMax <= 1) {
    return 0.5;
  }

  return clampNumber((turn - 1) / (turnMax - 1), 0, 1);
}

function getPolaroidTimeTint(snapshot, fallbackState = gameState) {
  const progress = getPolaroidTimeProgress(snapshot, fallbackState);
  const stops = POLAROID_TIME_TINT_STOPS;

  for (let index = 0; index < stops.length - 1; index += 1) {
    const currentStop = stops[index];
    const nextStop = stops[index + 1];

    if (progress <= nextStop.at) {
      const localProgress = clampNumber((progress - currentStop.at) / (nextStop.at - currentStop.at), 0, 1);

      return {
        color: currentStop.color.map((channel, channelIndex) => Math.round(
          lerpNumber(channel, nextStop.color[channelIndex], localProgress)
        )),
        alpha: lerpNumber(currentStop.alpha, nextStop.alpha, localProgress),
        dim: lerpNumber(currentStop.dim, nextStop.dim, localProgress)
      };
    }
  }

  return stops[stops.length - 1];
}

function getPolaroidTimeTintStyle(snapshot, fallbackState = gameState) {
  const tint = getPolaroidTimeTint(snapshot, fallbackState);
  const [red, green, blue] = tint.color;

  return [
    `--polaroid-time-tint: rgba(${red}, ${green}, ${blue}, ${tint.alpha.toFixed(3)})`,
    `--polaroid-time-dim: ${tint.dim.toFixed(3)}`
  ].join("; ");
}

function isSafePaletteColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);
}

function getPaletteColor(value, fallback) {
  return isSafePaletteColor(value) ? value : fallback;
}

function getPaletteSplitStop(palette, snapshot) {
  const snapshotSplitStop = snapshot && Number(snapshot.splitStop);
  const paletteSplitStop = palette && Number(palette.splitStop);
  const splitStop = Number.isFinite(snapshotSplitStop)
    ? snapshotSplitStop
    : Number.isFinite(paletteSplitStop)
      ? paletteSplitStop
      : 50;

  return clampNumber(splitStop, 10, 90);
}

function shouldUseSplitStop(palette) {
  return Boolean(
    palette
    && (palette.scheme === "horizontal-split" || palette.scheme === "vertical-split")
  );
}

function rollSnapshotSplitStop(palette) {
  if (!shouldUseSplitStop(palette)) {
    return undefined;
  }

  const base = Number.isFinite(Number(palette.splitStop)) ? Number(palette.splitStop) : 50;
  const jitter = Number.isFinite(Number(palette.splitStopJitter)) ? Number(palette.splitStopJitter) : 0;
  const delta = jitter > 0 ? (Math.random() * 2 - 1) * jitter : 0;

  return clampNumber(base + delta, 10, 90);
}

function getDotPatternTileSize(dotDensity) {
  if (dotDensity === "low") {
    return 22;
  }

  if (dotDensity === "high") {
    return 12;
  }

  return 16;
}

function createDotPatternDataUri(color, tileSize, offset = 0) {
  const safeColor = getPaletteColor(color, "#2a2520");
  const center = tileSize / 2 + offset;
  const dotSize = Math.max(3, Math.round(tileSize * 0.24));
  const halfDot = dotSize / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}"><rect x="${center - halfDot}" y="${center - halfDot}" width="${dotSize}" height="${dotSize}" transform="rotate(45 ${center} ${center})" fill="${safeColor}"/></svg>`;

  return `url(data:image/svg+xml,${encodeURIComponent(svg)})`;
}

function buildSpeciesBadgeStyle(species, snapshot) {
  const palette = species && species.colorPalette;
  if (!palette) {
    return "";
  }

  const primary = getPaletteColor(palette.primary, "#2a2520");
  const secondary = getPaletteColor(palette.secondary, primary);
  const tertiary = getPaletteColor(palette.tertiary, "");
  const textColor = getPaletteColor(palette.textColor, "#f0ede5");
  const baseStyle = [
    `color: ${textColor}`,
    "border: 1px solid rgba(255, 255, 255, 0.38)"
  ];

  if (palette.scheme === "horizontal-split" && isSafePaletteColor(palette.secondary)) {
    const splitStop = getPaletteSplitStop(palette, snapshot);
    return [
      ...baseStyle,
      `background: linear-gradient(to right, ${primary} 0%, ${primary} ${splitStop}%, ${secondary} ${splitStop}%, ${secondary} 100%)`
    ].join("; ");
  }

  if (palette.scheme === "vertical-split" && isSafePaletteColor(palette.secondary)) {
    const splitStop = getPaletteSplitStop(palette, snapshot);
    return [
      ...baseStyle,
      "padding: 7px 14px",
      `background: linear-gradient(to bottom, ${primary} 0%, ${primary} ${splitStop}%, ${secondary} ${splitStop}%, ${secondary} 100%)`
    ].join("; ");
  }

  if (palette.scheme === "dot-pattern") {
    const tileSize = getDotPatternTileSize(palette.dotDensity);
    const backgroundImages = [createDotPatternDataUri(secondary, tileSize)];
    const backgroundPositions = ["0 0"];

    if (tertiary) {
      backgroundImages.push(createDotPatternDataUri(tertiary, tileSize, -tileSize / 4));
      backgroundPositions.push(`${tileSize / 2}px ${tileSize / 2}px`);
    }

    return [
      ...baseStyle,
      `background-color: ${primary}`,
      `background-image: ${backgroundImages.join(", ")}`,
      `background-size: ${tileSize}px ${tileSize}px`,
      `background-position: ${backgroundPositions.join(", ")}`,
      "text-shadow: 0 0 1px rgba(42,37,32,1), 0 0 3px rgba(42,37,32,0.97), 0 0 5px rgba(42,37,32,0.6), 0 0 8px rgba(42,37,32,0.3)"
    ].join("; ");
  }

  return [
    ...baseStyle,
    `background: ${primary}`
  ].join("; ");
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

function shouldShowCardCrown(snapshots) {
  if (!Array.isArray(snapshots)) {
    return false;
  }

  return snapshots.some((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    if (snapshot.focusGrade === "数毛") {
      return true;
    }

    return Number.isFinite(snapshot.focusScore) && snapshot.focusScore >= 95;
  });
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
  const species = getSpeciesById(gameState.currentPhotoTarget && gameState.currentPhotoTarget.speciesId);

  return {
    badgeRelX: sample.badgeRelX,
    badgeRelY: sample.badgeRelY,
    finalScale: getCurrentBadgeFinalScale(gameState.currentPhotoTarget),
    badgeRotation: clampBadgeRotation(latestBadgeRotation),
    splitStop: rollSnapshotSplitStop(species && species.colorPalette),
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

function formatGuideAddedRealTime(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "—";
  }

  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  const now = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const isSameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (isSameDay) {
    return `${hours}:${minutes}`;
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function formatMessageTime(timestamp) {
  const fallbackTime = Date.now();
  const time = Number.isFinite(timestamp) ? timestamp : fallbackTime;
  const date = new Date(time);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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

function getSnapshotBehaviorState(snapshot, card = null) {
  if (!snapshot) {
    return normalizeCaptureBehaviorState(card && card.rarity) || "NORMAL";
  }

  return normalizeCaptureBehaviorState(snapshot.capturedState)
    || normalizeCaptureBehaviorState(snapshot.visibleBehaviorState)
    || normalizeCaptureBehaviorState(snapshot.behaviorState)
    || normalizeCaptureBehaviorState(snapshot.behavior)
    || normalizeCaptureBehaviorState(snapshot.rarity)
    || normalizeCaptureBehaviorState(card && card.rarity)
    || "NORMAL";
}

function buildBehaviorBadgeStyle(behaviorState) {
  const safeBehaviorState = normalizeCaptureBehaviorState(behaviorState) || "NORMAL";
  const styleByState = {
    NORMAL: {
      color: "#5e8c61",
      background: "#edf2df"
    },
    INTERESTING: {
      color: "#8a6a3f",
      background: "#f3e6bd"
    },
    REMARKABLE: {
      color: "#c97552",
      background: "#f5d8c8"
    }
  };
  const style = styleByState[safeBehaviorState] || styleByState.NORMAL;

  return [
    `color: ${style.color}`,
    `background: ${style.background}`,
    "border: 1px solid rgba(255, 255, 255, 0.38)"
  ].join("; ");
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
  frameEl.style.cssText += `; ${getPolaroidTimeTintStyle(photo.snapshot, gameState)}`;

  const focusAreaEl = document.createElement("div");
  focusAreaEl.className = "focus-polaroid-focus-area";
  focusAreaEl.style.cssText = getFocusFrameStyle(
    getFocusFrameSizeForContainerRect({ width: frameWidth, height: frameHeight })
  );
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
  const behaviorBadgeStyle = buildBehaviorBadgeStyle(getSnapshotBehaviorState(photo.snapshot, photo.card));
  const badgeRelX = clampPolaroidPercent(photo.snapshot.badgeRelX);
  const badgeRelY = clampPolaroidPercent(photo.snapshot.badgeRelY);
  const finalScale = getSnapshotFinalScale(photo.snapshot);
  const badgeRotation = getSnapshotBadgeRotation(photo.snapshot);
  badgeEl.style.left = `${badgeRelX}%`;
  badgeEl.style.top = `${badgeRelY}%`;
  badgeEl.style.transform = `translate(-50%, -50%) rotate(${badgeRotation}deg) scale(${finalScale})`;
  badgeEl.style.cssText += `; ${behaviorBadgeStyle}`;

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

function renderTimeAndBatteryStatus(state) {
  const timeOfDayLabel = getTimeOfDayLabel(state);
  const timeOfDayClassName = getTimeOfDayClassName(timeOfDayLabel);

  return `
    <span class="status-combo-section">
      <span class="status-combo-label">当前时间</span>
      <span class="status-combo-value ${timeOfDayClassName}">${timeOfDayLabel}</span>
    </span>
    <span class="status-combo-divider" aria-hidden="true"></span>
    <span class="status-combo-section">
      <span class="status-combo-label">当前电量</span>
      ${renderBatteryWidget(state)}
    </span>
  `;
}

function renderNewBadge() {
  return `<span class="new-badge">NEW</span>`;
}

function hasAnyNewCollectedCard(fieldGuide) {
  if (!fieldGuide || !Array.isArray(fieldGuide.collectedCards)) {
    return false;
  }

  return fieldGuide.collectedCards.some((entry) => entry && entry.hasNewCard === true);
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

function getCardById(cardId) {
  return cardList.find((card) => card.id === cardId) || null;
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

function getSnapshotTimeOfDayLabel(snapshot) {
  if (!snapshot || !Number.isFinite(snapshot.turn)) {
    return "旧记录";
  }

  return getTimeOfDayLabel({
    currentTurn: snapshot.turn,
    maxTurns: Number.isFinite(snapshot.turnMax) ? snapshot.turnMax : gameState.maxTurns
  });
}

function renderSnapshotBatteryWidget(snapshot) {
  const batteryPercent = getSnapshotBatteryPercent(snapshot);

  if (batteryPercent === null) {
    return `<span class="field-guide-detail-battery-missing">—</span>`;
  }

  let filledSlots = 0;
  let levelClass = "is-empty";

  if (batteryPercent >= 76) {
    filledSlots = 4;
    levelClass = "is-high";
  } else if (batteryPercent >= 51) {
    filledSlots = 3;
    levelClass = "is-medium";
  } else if (batteryPercent >= 26) {
    filledSlots = 2;
    levelClass = "is-low";
  } else if (batteryPercent > 10) {
    filledSlots = 1;
    levelClass = "is-danger";
  } else if (batteryPercent > 0) {
    filledSlots = 1;
    levelClass = "is-critical";
  }

  const slots = [0, 1, 2, 3].map((index) => {
    const filledClass = index < filledSlots ? " is-filled" : "";
    return `<span class="battery-cell${filledClass}"></span>`;
  }).join("");

  return `
    <span class="battery-widget field-guide-detail-battery ${levelClass}" aria-label="电量：${filledSlots}格">
      <span class="battery-shell" aria-hidden="true">
        <span class="battery-cells">${slots}</span>
      </span>
    </span>
  `;
}

function getSnapshotSpotName(snapshot) {
  if (!snapshot || !snapshot.spotId) {
    return null;
  }

  const spotExists = getAllSpots().some((item) => item.id === snapshot.spotId);
  const spot = spotExists ? getSpotById(snapshot.spotId) : null;
  return spot ? spot.name : null;
}

function renderFieldGuideDetailPolaroid(card, snapshot, isIdentified, displayTitle = card.title, options = {}) {
  return renderFieldGuideDetailPolaroidUI({
    card,
    snapshot,
    isIdentified,
    displayTitle,
    variant: options && options.variant === "chat" ? "chat" : "detail",
    enableCardIdentifyUi: ENABLE_CARD_IDENTIFY_UI,
    recentlyIdentifiedCardId,
    getPolaroidFocusGradeClass,
    getStateClassFromCapturedState,
    shouldShowPolaroidCrown,
    clampPolaroidPercent,
    getSnapshotFinalScale,
    clampNumber,
    getSnapshotBadgeRotation,
    getSpeciesById,
    getPolaroidTimeTintStyle,
    gameState,
    buildSpeciesBadgeStyle,
    buildBehaviorBadgeStyle,
    getSnapshotBehaviorState,
    getFocusFrameStyle,
    escapeHtml,
    formatPolaroidDate
  });
}

function clampFieldGuideDetailSnapshotIndex(snapshotCount) {
  if (snapshotCount <= 0) {
    fieldGuideDetailSnapshotIndex = 0;
    return;
  }

  fieldGuideDetailSnapshotIndex = Math.max(0, Math.min(fieldGuideDetailSnapshotIndex, snapshotCount - 1));
}

function renderFieldGuideSnapshotNav(snapshotCount) {
  return renderFieldGuideSnapshotNavUI(snapshotCount, fieldGuideDetailSnapshotIndex);
}

function renderFieldGuideCardDetail(species, card, snapshots, collectedCard, isCataloguedSpecies) {
  const safeSnapshots = Array.isArray(snapshots) ? snapshots : [];
  clampFieldGuideDetailSnapshotIndex(safeSnapshots.length);
  const snapshot = safeSnapshots[fieldGuideDetailSnapshotIndex] || safeSnapshots[0] || null;
  const isIdentified = Boolean(collectedCard && collectedCard.isIdentified === true);
  const displayTitle = getCardDisplayTitle(card);
  const displayDescription = getCardDisplayDescription(card);
  const sentToSister = isCollectedCardSentToSister(gameState.fieldGuide, card.id);
  const sisterKnowledge = getCollectedCardSisterKnowledge(gameState.fieldGuide, card.id);
  const isSisterKnowledgeUnlocked = isCollectedCardSisterKnowledgeUnlocked(gameState.fieldGuide, card.id);
  const captureTimeText = getSnapshotTimeOfDayLabel(snapshot);
  const spotText = getSnapshotSpotName(snapshot) || "—";
  const batteryHtml = renderSnapshotBatteryWidget(snapshot);
  const focusText = snapshot && Number.isFinite(snapshot.focusScore)
    ? `${snapshot.focusScore}%${snapshot.focusGrade ? ` ${snapshot.focusGrade}` : ""}`
    : "—";
  const speciesPhotoIndexText = snapshot && Number.isFinite(Number(snapshot.speciesPhotoIndex))
    ? String(Math.max(1, Math.floor(Number(snapshot.speciesPhotoIndex))))
    : "—";
  const captureCount = getCardCaptureCount(gameState.fieldGuide, card.id);
  const captureCountText = Number.isFinite(captureCount) ? String(captureCount) : "—";
  const detailStatsHtml = `
    <p class="field-guide-detail-stats">
      第 ${speciesPhotoIndexText} 张照片 · 第 ${captureCountText} 次拍到「${escapeHtml(displayTitle)}」 · 已留存 ${safeSnapshots.length} 张
    </p>
  `;
  const identifyControlHtml = ENABLE_CARD_IDENTIFY_UI
    ? (
      isIdentified
        ? `<span class="field-guide-identify-status">已辨认</span>`
        : `<button class="field-guide-identify-button" type="button" data-card-id="${escapeHtml(card.id)}">仔细辨认</button>`
    )
    : "";
  const identifyRowHtml = identifyControlHtml
    ? `<div class="field-guide-identify-row">${identifyControlHtml}</div>`
    : "";
  const sisterKnowledgeHtml = isSisterKnowledgeUnlocked && sisterKnowledge.length > 0
    ? `
      <section class="sister-knowledge-panel" aria-label="妹妹的补充">
        <h3 class="sister-knowledge-title">妹妹的补充</h3>
        ${sisterKnowledge.map((line) => `<p class="sister-knowledge-line">${escapeHtml(line)}</p>`).join("")}
      </section>
    `
    : "";
  const sendToSisterHtml = snapshot && !sentToSister
    ? `
      <div class="field-guide-share-row">
        <button class="field-guide-send-button button-ghost" type="button" data-card-id="${escapeHtml(card.id)}">发给妹妹</button>
      </div>
    `
    : sentToSister
      ? `<div class="field-guide-share-row"><span class="sent-to-sister-status">已发给妹妹</span></div>`
    : "";

  elements.detailPanel.innerHTML = renderFieldGuideCardDetailPanel({
    isEntering: inlinePanelJustOpened === "fieldGuide",
    displayTitle,
    displayDescription,
    rarityBadgeHtml: renderRarityBadge(card),
    identifyRowHtml,
    detailStatsHtml,
    sisterKnowledgeHtml,
    polaroidHtml: renderFieldGuideDetailPolaroid(card, snapshot, isIdentified, displayTitle),
    captureTimeText,
    spotText,
    batteryHtml,
    focusText,
    snapshotNavHtml: renderFieldGuideSnapshotNav(safeSnapshots.length),
    sendToSisterHtml,
    escapeHtml
  });
  return;
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

function pseudoRandomFromSeed(seed, index) {
  const safeSeed = Number.isFinite(Number(seed)) ? Number(seed) : 0;
  const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
  const value = Math.sin((safeSeed + 1) * 12.9898 + safeIndex * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function randomBetweenSeeded(seed, index, min, max) {
  const safeMin = Number(min);
  const safeMax = Number(max);
  if (!Number.isFinite(safeMin) || !Number.isFinite(safeMax)) {
    return 0;
  }

  const from = Math.min(safeMin, safeMax);
  const to = Math.max(safeMin, safeMax);
  return from + pseudoRandomFromSeed(seed, index) * (to - from);
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

function createFocusEnterTarget(seed) {
  return {
    x: randomBetweenSeeded(seed, 41, -FOCUS_ENTER_TARGET_RANGE_X, FOCUS_ENTER_TARGET_RANGE_X),
    y: randomBetweenSeeded(seed, 42, -FOCUS_ENTER_TARGET_RANGE_Y, FOCUS_ENTER_TARGET_RANGE_Y)
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
  const maxOffsetX = rect.width * FOCUS_OFFSET_X_RATIO;
  const maxOffsetY = rect.height * FOCUS_OFFSET_Y_RATIO;

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

function getFocusFrameBoxForPosition(playfieldRect, focusFrame) {
  const frameRect = focusFrame ? focusFrame.getBoundingClientRect() : null;
  const frameSize = frameRect && frameRect.width > 0 && frameRect.height > 0
    ? { width: frameRect.width, height: frameRect.height }
    : getFocusFrameSizeForContainerRect(playfieldRect);

  return {
    halfWidth: (frameSize.width / 2) / Math.max(playfieldRect.width * FOCUS_OFFSET_X_RATIO, 1),
    halfHeight: (frameSize.height / 2) / Math.max(playfieldRect.height * FOCUS_OFFSET_Y_RATIO, 1)
  };
}

function isPositionInsideFocusFrame(position, playfieldRect, focusFrame) {
  if (!position || !playfieldRect || playfieldRect.width <= 0 || playfieldRect.height <= 0) {
    return false;
  }

  const focusBox = getFocusFrameBoxForPosition(playfieldRect, focusFrame);
  const x = Number(position.x) || 0;
  const y = Number(position.y) || 0;

  return Math.abs(x) <= focusBox.halfWidth && Math.abs(y) <= focusBox.halfHeight;
}

function getFocusAffixFromDisplayedPosition(position, playfieldRect, focusFrame) {
  const distance = getFocusDistance(position);

  if (distance < CAMERA_FOCUS_CONFIG.perfect) {
    return "PERFECT";
  }

  return isPositionInsideFocusFrame(position, playfieldRect, focusFrame) ? "OK" : "BLUR";
}

function evaluateDisplayedFocus(position, playfieldRect, focusFrame) {
  const distance = getFocusDistance(position);
  const affix = getFocusAffixFromDisplayedPosition(position, playfieldRect, focusFrame);

  return {
    position,
    distance,
    affix,
    affixDisplay: getFocusAffixDisplay(affix),
    isGreen: affix === "OK" || affix === "PERFECT"
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
    applyFocusFrameSize(focusFrame, rect);
    const elapsedMs = now - focusStartedAt;
    const motionMs = Math.max(elapsedMs - FOCUS_ENTER_DELAY_MS, 0);
    const steadyMotionMs = Math.max(motionMs - FOCUS_ENTER_DURATION_MS, 0);
    const t = steadyMotionMs / 1000;
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
      latestFocusResult = evaluateDisplayedFocus(displayPosition, rect, focusFrame);
      markFocusTargetVisible();
      startFocusSequenceIfNeeded(now);
      if (updateFocusSequencePlayback(now, movingBadge, displayPosition)) {
        return;
      }
      focusFrame.classList.toggle("is-green", latestFocusResult.isGreen);

      if (progress >= 1) {
        focusMotionStarted = true;
        movingBadge.classList.remove("is-entering");
        latestFocusResult = evaluateDisplayedFocus(result.position, rect, focusFrame);
        markFocusTargetVisible();
        focusFrame.classList.toggle("is-green", latestFocusResult.isGreen);
      }
    } else {
      movingBadge.classList.remove("is-hidden");
      movingBadge.classList.remove("is-entering");
      latestFocusResult = evaluateDisplayedFocus(result.position, rect, focusFrame);
      markFocusTargetVisible();
      startFocusSequenceIfNeeded(now);
      if (updateFocusSequencePlayback(now, movingBadge, displayPosition)) {
        return;
      }
      focusFrame.classList.toggle("is-green", latestFocusResult.isGreen);
    }

    const offset = getFocusPixelOffset(displayPosition, rect);
    const finalScale = getCurrentBadgeFinalScale(gameState.currentPhotoTarget);
    latestBadgeRotation = clampBadgeRotation(computeBadgeRotation(focusRuntime, t, displayPosition));
    movingBadge.style.transform = `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${latestBadgeRotation}deg) scale(${finalScale})`;

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
  const rect = playfield.getBoundingClientRect();
  applyFocusFrameSize(focusFrame, rect);
  const offset = getFocusPixelOffset(displayPosition, rect);
  const finalScale = getCurrentBadgeFinalScale(gameState.currentPhotoTarget);

  movingBadge.classList.remove("is-hidden");
  movingBadge.classList.add("is-exiting");
  movingBadge.style.transform = `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${latestBadgeRotation}deg) scale(${finalScale})`;

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

  focusEnterTarget = createFocusEnterTarget(seed);
  focusRuntime = createFocusRuntime(config, seed, { initialPosition: focusEnterTarget });
  focusStartedAt = performance.now();
  focusBadgeRandomScale = rollBadgeRandomScale();
  latestBadgeRotation = 0;
  latestFocusKey = focusKey;
  latestVisibleFocusState = getCurrentVisibleFocusState();
  focusEnterFrom = createFocusEnterFrom();
  focusEnterCurve = createFocusEnterCurve();
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
  const locationItem = elements.sdCard.closest(".status-item");
  const locationLabel = locationItem ? locationItem.querySelector(".status-label") : null;

  if (locationLabel) {
    locationLabel.textContent = "位置";
  }

  if (spotItem) {
    spotItem.classList.remove("status-location");
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

  const isMessagesOpen = activeOverlay === "messages";
  const isFieldGuideOpen = activeOverlay === "fieldGuide" || activeOverlay === "resetSaveConfirm";
  const fieldGuideButtonText = isFieldGuideOpen ? "收起笔记" : "打开笔记";
  const shouldShowFieldGuideNewBadge = !isFieldGuideOpen && hasAnyNewCollectedCard(gameState.fieldGuide);
  const shouldShowMessageUnreadDot = hasAnyUnreadMessages(gameState.fieldGuide);

  elements.mode.innerHTML = `
    <span class="status-label">周围事件</span>
    <span class="status-value">暂无事件</span>
  `;
  elements.spot.innerHTML = `
    <span class="status-label">天气</span>
    <span class="status-value">晴天</span>
  `;
  elements.utilityGuide.innerHTML = shouldShowFieldGuideNewBadge
    ? `<span class="top-entry-button-label">${fieldGuideButtonText}</span><span class="top-entry-new-badge">new</span>`
    : `<span class="top-entry-button-label">${fieldGuideButtonText}</span>`;
  elements.utilityMessages.innerHTML = `
    <span class="top-entry-button-label">${isMessagesOpen ? "关闭消息" : "查看消息"}</span>
    ${shouldShowMessageUnreadDot ? `<span class="top-entry-unread-dot" aria-hidden="true"></span>` : ""}
  `;
  elements.utilityMessages.classList.toggle("is-active", isMessagesOpen);
  elements.utilityMessages.setAttribute("aria-expanded", String(isMessagesOpen));
  elements.utilityGuide.classList.toggle("is-active", isFieldGuideOpen);
  elements.utilityGuide.setAttribute("aria-expanded", String(isFieldGuideOpen));
  elements.sdCard.textContent = `${currentSpot.name} · ${mapInfo.facingName}`;
  elements.direction.textContent = mapInfo.facingName;
}

function getStartSpotChoices() {
  const allSpots = getAllSpots();
  const startSpots = allSpots.filter((spot) => spot.isStartSpot === true);

  return startSpots.length > 0 ? startSpots : allSpots;
}

function renderActions() {
  elements.actionPanel.innerHTML = "";

  if (gameState.mode === "START") {
    elements.actionPanel.append(createButton("开始今天的观鸟", "start", "system", "button-major"));
    return;
  }

  if (gameState.mode === "START_SPOT_SELECT") {
    getStartSpotChoices().forEach((spot) => {
      elements.actionPanel.append(createButton(`从这里开始：${spot.name}`, spot.id, "startSpot", "button-secondary"));
    });
    elements.actionPanel.append(createButton("返回", "back", "system", "button-secondary"));
    return;
  }

  if (gameState.mode === "EXPLORE") {
    elements.actionPanel.append(createActionRow([
      createButton("观察当前方向", "observe", "explore", "button-major")
    ]));
    elements.actionPanel.append(createActionRow([
      createButton("向左转", "turnLeft", "explore", "button-secondary"),
      createButton("向右转", "turnRight", "explore", "button-secondary")
    ], "action-row action-row-two"));
    elements.actionPanel.append(createActionRow([
      createButton("聆听周围鸟点", "listenDistant", "explore", "button-secondary")
    ]));
    elements.actionPanel.append(createActionRow([
      createButton("提前撤离并结算", "retreat", "explore", "button-secondary")
    ]));
    return;
  }

  if (gameState.mode === "DISTANT_LISTEN") {
    gameState.distantListenOptions.forEach((option) => {
      elements.actionPanel.append(createButton(`前往${option.spotName}`, option.spotId, "distantListen", "button-major"));
    });
    elements.actionPanel.append(createButton("观察当前方向", "observe", "distantListen", "button-secondary"));
    elements.actionPanel.append(createButton("再听一会", "listenAgain", "distantListen", "button-secondary"));
    return;
  }

  if (gameState.mode === "SPOT_SELECT") {
    gameState.availableSpotOptions.forEach((spot) => {
      elements.actionPanel.append(createButton(`前往：${spot.name}`, spot.id, "spot", "button-major"));
    });
    elements.actionPanel.append(createButton("留在当前鸟点", "stay", "spot", "button-secondary"));
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
      elements.actionPanel.append(createButton("再等一等", "wait", "photo", "button-secondary"));
      elements.actionPanel.append(createButton("放弃拍摄", "giveUp", "photo"));
      return;
    }

    elements.actionPanel.append(createButton("举起相机", "raiseCamera", "photo", "button-major"));
    elements.actionPanel.append(createButton("再等一等", "wait", "photo", "button-secondary"));
    elements.actionPanel.append(createButton("放弃拍摄", "giveUp", "photo"));
    return;
  }

  if (gameState.mode === "FIELD_GUIDE") {
    if (gameState.previousMode === "START" || !gameState.previousMode) {
      elements.actionPanel.append(createButton("开始今天的观鸟", "start", "system", "button-major"));
    }

    if (gameState.previousMode && gameState.previousMode !== "START") {
      elements.actionPanel.append(createButton("返回", "back", "system"));
    }
    return;
  }

  if (gameState.mode === "SETTLEMENT") {
    elements.actionPanel.append(createButton("休息到明天清晨", "rest", "system", "button-major"));
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

function scheduleAutoCatalogueCompletion(speciesId, cardIds) {
  if (!speciesId || !Array.isArray(cardIds) || cardIds.length === 0) {
    return;
  }

  if (autoCatalogueCompletionTimerId && autoCatalogueCompletingSpeciesId === speciesId) {
    return;
  }

  if (autoCatalogueCompletionTimerId) {
    window.clearTimeout(autoCatalogueCompletionTimerId);
  }

  autoCatalogueCompletingSpeciesId = speciesId;
  autoCatalogueCompletionTimerId = window.setTimeout(() => {
    gameState.fieldGuide = markAutoCatalogueCompleted(gameState.fieldGuide, cardIds);
    autoCatalogueCompletionTimerId = null;
    autoCatalogueCompletingSpeciesId = null;
    render();
  }, 1120);
}

function renderFieldGuide() {
  let guide = gameState.fieldGuide;
  const discoveredSpecies = getDiscoveredSpecies(guide);
  normalizeFieldGuideSpeciesIndex(discoveredSpecies.length);
  const resetSaveButtonHtml = `
    <div class="field-guide-bottom-actions">
      <button class="field-guide-clear-button" type="button" data-action="resetSave">重置游戏存档</button>
    </div>
  `;

  if (discoveredSpecies.length === 0) {
    elements.detailPanel.innerHTML = renderFieldGuideEmptyPanel({
      resetSaveButtonHtml,
      isEntering: inlinePanelJustOpened === "fieldGuide"
    });
    return;
  }

  const species = discoveredSpecies[fieldGuideSpeciesIndex];
  let knowledgeState = getSpeciesKnowledgeState(guide, species.id);
  let isCataloguedSpecies = knowledgeState === "CATALOGUED";
  let canShowCollectedCards = knowledgeState === "SEEN" || isCataloguedSpecies;
  const collectedCardIds = getCollectedCardIds(guide);
  let collectedCardsForSpecies = canShowCollectedCards
    ? getCardsForSpecies(species.id).filter((card) => collectedCardIds.includes(card.id))
    : [];
  let pendingAutoCatalogueCardId = null;

  if (canShowCollectedCards) {
    const speciesCardIds = collectedCardsForSpecies.map((card) => card.id);
    pendingAutoCatalogueCardId = getPendingAutoCatalogueCardId(guide, speciesCardIds);

    if (pendingAutoCatalogueCardId && isCataloguedSpecies) {
      if (autoCatalogueCompletingSpeciesId !== species.id) {
        gameState.fieldGuide = markAutoCatalogueCompleted(gameState.fieldGuide, speciesCardIds);
        guide = gameState.fieldGuide;
      }
    }
  }

  const shouldRevealCataloguedPage = isCataloguedSpecies && species.id === recentlyCataloguedSpeciesId;
  const detailCard = fieldGuideDetailCardId
    ? collectedCardsForSpecies.find((card) => card.id === fieldGuideDetailCardId)
    : null;
  const detailSnapshots = fieldGuideDetailCardId
    ? getCollectedCardSnapshots(guide, fieldGuideDetailCardId)
    : [];
  const detailCollectedCard = fieldGuideDetailCardId
    ? getCollectedCardEntry(guide, fieldGuideDetailCardId)
    : null;

  if (fieldGuideDetailCardId && canShowCollectedCards && detailCard) {
    renderFieldGuideCardDetail(species, detailCard, detailSnapshots, detailCollectedCard, isCataloguedSpecies);
    return;
  }

  if (fieldGuideDetailCardId) {
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
  }

  const speciesTitle = isCataloguedSpecies ? species.name : "？？？";
  const speciesNumber = guide.discoveryOrder.indexOf(species.id) >= 0
    ? `#${guide.discoveryOrder.indexOf(species.id) + 1}`
    : "";
  const speciesSeenCount = getSpeciesSeenCount(guide, species.id);
  const speciesPhotoCount = getSpeciesPhotoCount(guide, species.id);
  const cataloguedAtTimeLabel = formatGuideAddedRealTime(getSpeciesCataloguedRealTimestamp(guide, species.id));
  const speciesMetaLines = [
    `见过 ${speciesSeenCount} 次 · 拍了 ${speciesPhotoCount} 张`,
    ...(isCataloguedSpecies ? [`加新于 ${cataloguedAtTimeLabel}`] : [])
  ];
  const speciesMetaHtml = speciesMetaLines.length > 0
    ? `<div class="field-guide-species-meta">${speciesMetaLines.map((line) => `<p class="field-guide-species-meta-line">${escapeHtml(line)}</p>`).join("")}</div>`
    : "";
  const shouldShowCatalogueButton = Boolean(
    pendingAutoCatalogueCardId
    && !isCataloguedSpecies
    && canShowCollectedCards
  );
  const speciesTitleHtml = isCataloguedSpecies
    ? `<span class="field-guide-bird-name${shouldRevealCataloguedPage ? " is-catalogue-reveal" : ""}">${escapeHtml(species.name)}</span>`
    : shouldShowCatalogueButton
      ? `<button class="field-guide-catalogue-button is-title-slot" type="button" data-action="catalogue-species" data-species-id="${escapeHtml(species.id)}">加新</button>`
      : escapeHtml(speciesTitle);
  const catalogueButtonHtml = "";
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
    const snapshots = getCollectedCardSnapshots(guide, card.id);
    const snapshotCount = snapshots.length;
    const collectedCardEntry = getCollectedCardEntry(guide, card.id);
    const displayTitle = getCardDisplayTitle(card);
    const displayDescription = getCardDisplayDescription(card);
    const showNewContentBadge = Boolean(collectedCardEntry && collectedCardEntry.hasNewCard === true);
    const showCrownBadge = shouldShowCardCrown(snapshots);
    const showSharedBadge = isCollectedCardSentToSister(guide, card.id);
    const snapshotCountHtml = snapshotCount > 0
      ? `<span class="field-guide-card-photo-count">已拍 ${snapshotCount} 张</span>`
      : "";
    const newContentBadgeHtml = showNewContentBadge
      ? `<span class="field-guide-card-new-marker">new</span>`
      : "";
    const crownBadgeHtml = showCrownBadge
      ? `<span class="field-guide-card-crown-marker" aria-label="包含数毛级照片" title="包含数毛级照片">♛</span>`
      : "";
    const sharedBadgeHtml = showSharedBadge
      ? `<span class="field-guide-card-shared-marker">已分享</span>`
      : "";

    return `
      <li class="field-guide-card is-collected">
        <button class="field-guide-card-button" type="button" data-card-id="${escapeHtml(card.id)}" aria-label="查看${escapeHtml(displayTitle)}的拍摄记录">
          <span class="field-guide-card-title-row">
            ${renderRarityBadge(card)}
            <strong class="field-guide-card-title">${escapeHtml(displayTitle)}</strong>
            ${newContentBadgeHtml}
          </span>
          <span class="field-guide-card-description">${escapeHtml(displayDescription)}</span>
          ${snapshotCountHtml}
        </button>
        ${crownBadgeHtml}
        ${sharedBadgeHtml}
      </li>
    `;
  });
  const cardListHtml = canShowCollectedCards && cardItems.length > 0
    ? `<ul class="field-guide-card-list">${cardItems.join("")}</ul>`
    : "";

  elements.detailPanel.innerHTML = renderFieldGuideListPanel({
    isEntering: inlinePanelJustOpened === "fieldGuide",
    pageTabsHtml: pageTabs.join(""),
    pagerClassName,
    prevButtonHtml,
    nextButtonHtml,
    speciesNumber,
    speciesTitle,
    speciesTitleHtml,
    speciesMetaHtml,
    speciesAppearance: species.appearance,
    speciesAppearanceRevealAttrs: "",
    speciesHeaderRevealAttrs: "",
    catalogueButtonHtml,
    cardListHtml,
    resetSaveButtonHtml,
    escapeHtml
  });

  if (shouldRevealCataloguedPage) {
    recentlyCataloguedSpeciesId = null;
  }
  return;
}

function getDiscoveredSpeciesCountForReset(guide) {
  if (!guide || typeof guide !== "object") {
    return 0;
  }

  const speciesSet = new Set();
  const heardSpeciesIds = Array.isArray(guide.heardSpeciesIds) ? guide.heardSpeciesIds : [];
  const seenSpeciesIds = Array.isArray(guide.seenSpeciesIds) ? guide.seenSpeciesIds : [];
  const cataloguedSpeciesIds = Array.isArray(guide.cataloguedSpeciesIds) ? guide.cataloguedSpeciesIds : [];

  heardSpeciesIds.forEach((speciesId) => speciesSet.add(speciesId));
  seenSpeciesIds.forEach((speciesId) => speciesSet.add(speciesId));
  cataloguedSpeciesIds.forEach((speciesId) => speciesSet.add(speciesId));

  return speciesSet.size;
}

function getKeepKeyStatusText(keyGroup) {
  const keys = Array.isArray(keyGroup) ? keyGroup : [];
  const isPresent = keys.some((key) => localStorage.getItem(key) !== null);
  return isPresent ? "已保留" : "暂未启用";
}

function renderResetSaveConfirm() {
  const guide = gameState.fieldGuide;
  const collectedCardsCount = guide && Array.isArray(guide.collectedCards)
    ? guide.collectedCards.length
    : 0;
  const discoveredSpeciesCount = getDiscoveredSpeciesCountForReset(guide);
  const testerStatusText = getKeepKeyStatusText(SAVE_RESET_REGISTRY.identity);
  const analyticsStatusText = getKeepKeyStatusText(SAVE_RESET_REGISTRY.infrastructure);

  elements.detailPanel.innerHTML = renderResetSaveConfirmPanel({
    isEntering: inlinePanelJustOpened === "fieldGuide",
    collectedCardsCount,
    discoveredSpeciesCount,
    testerStatusText,
    analyticsStatusText,
    escapeHtml
  });
}

function renderSettlement() {
  if (!isSettlementRevealed) {
    elements.detailPanel.innerHTML = `
      <section class="settlement-panel settlement-collapsed" data-action="revealSettlement" role="button" tabindex="0">
        <div class="settlement-collapsed-content">
          <h2 class="settlement-collapsed-title">今天的收获</h2>
          <p class="settlement-collapsed-hint">点击展开今天的记录</p>
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
  const emptyPhotoItem = `<li class="settlement-photo-card settlement-reveal" style="--reveal-delay: 1500ms">这次没有留下照片。</li>`;

  elements.detailPanel.innerHTML = `
    <h2 class="settlement-reveal" style="--reveal-delay: 0ms">今天的收获</h2>
    <p class="settlement-reveal" style="--reveal-delay: 240ms">照片数量：${battery.used} 张（已用电量 ${battery.usedPct}%）</p>
    <p class="settlement-reveal" style="--reveal-delay: 480ms">记录到的鸟：${foundSpeciesIds.length}</p>
    <p class="settlement-reveal" style="--reveal-delay: 720ms">听到的鸟：${gameState.sessionHeardSpeciesIds.length}</p>
    <p class="settlement-reveal" style="--reveal-delay: 960ms">新增笔记：${shownNewCardIds.length}</p>
    <h3 class="settlement-reveal" style="--reveal-delay: 1350ms">留下的照片</h3>
    <ul class="settlement-photo-list">${photoItems.join("") || emptyPhotoItem}</ul>
  `;
}

function renderPhotoDetail() {
  const bird = gameState.currentPhotoTarget;
  const behaviorState = getCurrentPhotoState(gameState.currentPhotoSequence);
  const phaseTextByKey = {
    DECISION: "你正在看它的动作，还没有举起相机。",
    FOCUS: "你已举起相机，正在对焦。",
    REPOSITION: "它暂时离开了取景位置。",
    LOST: "你失去了它的位置。",
    RESULT: "刚拍完一张照片，你可以继续跟焦，或者再等一等。"
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
      <p class="encounter-sub">我先这样记下它：</p>
      <h2 class="encounter-nickname">${escapeHtml(nickname)}</h2>
      <p class="encounter-sub">我还不知道它的名字。继续观察，看看能不能拍下来。</p>
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
    <h2>周围鸟点声景</h2>
    <p>当前鸟点：${currentSpot.name}</p>
    <ul class="spot-list">${optionItems.join("")}</ul>
    ${renderMapHtml()}
  `;
}

function renderStartSpotSelectDetail() {
  const spotItems = getStartSpotChoices().map((spot) => {
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
    <p>从已开放鸟点开始今天的观察。初始选点不会消耗回合。</p>
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

function isLiyaThreadCurrentlyOpen() {
  return activeOverlay === "messages" && messageView === "sisterChat";
}

function isElementFullyVisibleInContainer(element, container) {
  return isElementFullyVisibleInContainerUI(element, container);
}

function getVisibleLiyaReplyCardIds(container) {
  return getVisibleLiyaReplyCardIdsUI(container);
}

function autoMarkVisibleLiyaRepliesRead(container) {
  if (isApplyingVisibleLiyaAutoRead || !isLiyaThreadCurrentlyOpen()) {
    return;
  }

  const historyContainer = container || elements.detailPanel.querySelector(".message-chat-history");
  if (!historyContainer) {
    return;
  }

  const visibleCardIds = getVisibleLiyaReplyCardIds(historyContainer);
  if (visibleCardIds.length <= 0) {
    return;
  }

  const now = Date.now();
  const beforeByCardId = getQueueSnapshotsByCardIds(gameState.fieldGuide, visibleCardIds);
  const result = markDueSisterRepliesReadByCardIds(gameState.fieldGuide, visibleCardIds, now);
  if (!result || result.hasChanged !== true) {
    return;
  }

  gameState.fieldGuide = result.guide;
  syncViewedEventsFromReadTransitions(gameState.fieldGuide, visibleCardIds, beforeByCardId, now);
  isApplyingVisibleLiyaAutoRead = true;
  render();
  isApplyingVisibleLiyaAutoRead = false;
}

function clearLiyaLineAnimationTimers() {
  clearLiyaLineAnimationTimersUI();
}

function captureChatScrollState() {
  return captureChatScrollStateUI(elements.detailPanel);
}

function restoreChatScrollState(historyEl, previousState) {
  restoreChatScrollStateUI(historyEl, previousState);
}

function toSafeTimestamp(value) {
  if (Number.isFinite(value)) {
    return value;
  }

  const numericValue = typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const parsedTime = Date.parse(value || "");
  return Number.isFinite(parsedTime) ? parsedTime : null;
}

function getLiyaQueueItem(entry) {
  return entry && entry.liyaMessageQueueItem && typeof entry.liyaMessageQueueItem === "object" && !Array.isArray(entry.liyaMessageQueueItem)
    ? entry.liyaMessageQueueItem
    : null;
}

function getLiyaQueueReplyDueAt(entry) {
  const queueItem = getLiyaQueueItem(entry);

  if (!queueItem || queueItem.source !== "photo_reply" || queueItem.threadId !== "liya") {
    return null;
  }

  return toSafeTimestamp(queueItem.dueAt);
}

function getLiyaReplyDueAt(entry) {
  const queueDueAt = getLiyaQueueReplyDueAt(entry);
  if (Number.isFinite(queueDueAt)) {
    return queueDueAt;
  }

  return toSafeTimestamp(entry && entry.sisterReplyDueAt);
}

function getPendingUnreadLiyaReplyDueAt(entry, now = Date.now()) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const queueDueAt = getLiyaQueueReplyDueAt(entry);
  if (Number.isFinite(queueDueAt)) {
    const queueItem = getLiyaQueueItem(entry);
    const queueReadAt = toSafeTimestamp(queueItem && queueItem.readAt);
    const queueStatus = typeof (queueItem && queueItem.status) === "string" ? queueItem.status : "";
    const isQueueRead = queueStatus === "read" || Number.isFinite(queueReadAt);
    return !isQueueRead && queueDueAt > now ? queueDueAt : null;
  }

  const legacyDueAt = toSafeTimestamp(entry.sisterReplyDueAt);
  const needsRead = !Number.isFinite(toSafeTimestamp(entry.sisterReplyReadAt)) || entry.sisterKnowledgeUnlocked !== true;
  return Number.isFinite(legacyDueAt) && needsRead && legacyDueAt > now ? legacyDueAt : null;
}

function getLiyaGroupSortAt(entry, snapshot) {
  const sentToSisterAt = toSafeTimestamp(entry && entry.sentToSisterAt);
  if (Number.isFinite(sentToSisterAt)) {
    return sentToSisterAt;
  }

  const queueItem = getLiyaQueueItem(entry);
  const queueCreatedAt = toSafeTimestamp(queueItem && queueItem.createdAt);
  if (Number.isFinite(queueCreatedAt)) {
    return queueCreatedAt;
  }

  const replyDueAt = getLiyaReplyDueAt(entry);
  if (Number.isFinite(replyDueAt)) {
    return Math.max(0, replyDueAt - 30000);
  }

  const snapshotAt = toSafeTimestamp(snapshot && snapshot.realTimestamp);
  if (Number.isFinite(snapshotAt)) {
    return snapshotAt;
  }

  return 0;
}

function getLiyaReplySortAt(entry, groupSortAt) {
  const replyDueAt = getLiyaReplyDueAt(entry);
  if (Number.isFinite(replyDueAt)) {
    return replyDueAt;
  }

  const sentToSisterAt = toSafeTimestamp(entry && entry.sentToSisterAt);
  if (Number.isFinite(sentToSisterAt)) {
    return sentToSisterAt + 30000;
  }

  return groupSortAt + 30000;
}

function sortSisterPhotoMessages(messages) {
  const safeMessages = Array.isArray(messages) ? messages : [];

  return [...safeMessages].sort((left, right) => {
    const leftSortAt = Number.isFinite(left && left.sortAt)
      ? left.sortAt
      : Number.isFinite(toSafeTimestamp(left && left.time))
        ? toSafeTimestamp(left && left.time)
        : 0;
    const rightSortAt = Number.isFinite(right && right.sortAt)
      ? right.sortAt
      : Number.isFinite(toSafeTimestamp(right && right.time))
        ? toSafeTimestamp(right && right.time)
        : 0;
    if (leftSortAt !== rightSortAt) {
      return leftSortAt - rightSortAt;
    }

    const leftOrder = Number.isFinite(left && left.order) ? left.order : 0;
    const rightOrder = Number.isFinite(right && right.order) ? right.order : 0;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftKey = typeof (left && left._stableKey) === "string" ? left._stableKey : "";
    const rightKey = typeof (right && right._stableKey) === "string" ? right._stableKey : "";
    if (leftKey < rightKey) {
      return -1;
    }
    if (leftKey > rightKey) {
      return 1;
    }
    return 0;
  });
}

function getSentSisterPhotoMessages() {
  const collectedCards = gameState.fieldGuide && Array.isArray(gameState.fieldGuide.collectedCards)
    ? gameState.fieldGuide.collectedCards
    : [];

  const messages = collectedCards.flatMap((entry) => {
    if (!entry || entry.sentToSister !== true || !entry.cardId) {
      return [];
    }

    const card = getCardById(entry.cardId);
    if (!card) {
      return [];
    }

    const snapshots = getCollectedCardSnapshots(gameState.fieldGuide, card.id);
    const snapshot = snapshots[0] || null;
    const title = getCardDisplayTitle(card);
    const replyToCardTitle = typeof title === "string" && title.trim() ? title.trim() : "这张照片";
    const groupSortAt = getLiyaGroupSortAt(entry, snapshot);
    const sentAt = groupSortAt;
    const replyDueAt = getLiyaReplyDueAt(entry);
    const replySortAt = getLiyaReplySortAt(entry, groupSortAt);
    const knowledgeLines = getCollectedCardSisterKnowledge(gameState.fieldGuide, card.id);
    const replyText = getLiyaPhotoReplyText(card, snapshot, entry, knowledgeLines);
    const replyLines = replyText
      .split("\n")
      .map((line) => String(line || "").trim())
      .filter((line) => line.length > 0);
    const queueItem = getLiyaQueueItem(entry);
    const queuedMessageId = typeof (queueItem && queueItem.messageId) === "string" ? queueItem.messageId.trim() : "";
    const stableGroupKey = `${entry.cardId || card.id || "card"}_${groupSortAt}`;
    const photoMessage = {
      sender: "player",
      type: "polaroid",
      card,
      snapshot,
      title,
      time: sentAt,
      sortAt: sentAt,
      groupSortAt,
      order: 0,
      _stableKey: `${stableGroupKey}_0`
    };
    const textMessage = {
      sender: "player",
      type: "text",
      text: `我拍到了「${title}」`,
      time: sentAt,
      sortAt: sentAt + 1,
      groupSortAt,
      order: 1,
      _stableKey: `${stableGroupKey}_1`
    };
    const sisterReply = Number.isFinite(replyDueAt) && Date.now() >= replyDueAt
      ? [{
          sender: "sister",
          speaker: "liya",
          id: queuedMessageId || `${stableGroupKey}_2`,
          type: "text",
          source: "photo_reply",
          cardId: entry.cardId,
          text: replyText,
          lines: replyLines,
          replyToCardTitle,
          time: replyDueAt,
          sortAt: Number.isFinite(replySortAt) ? replySortAt : replyDueAt,
          groupSortAt,
          order: 2,
          _stableKey: `${stableGroupKey}_2`,
          isSisterReply: true,
          isUnread: hasUnreadLiyaPhotoReply(entry),
          isRead: !hasUnreadLiyaPhotoReply(entry)
        }]
      : [];

    return [photoMessage, textMessage, ...sisterReply];
  });

  return sortSisterPhotoMessages(messages);
}

// Override legacy static thread builders with initial-message-thread based builders.
function getSisterThreadMessages() {
  const initialMessages = normalizeInitialThreadMessages("liya");
  const runtimeMessages = getSentSisterPhotoMessages();
  return sortSisterPhotoMessages([...initialMessages, ...runtimeMessages]);
}

function getMomThreadMessages() {
  return normalizeInitialThreadMessages("mother");
}

function getMiaomiaoThreadMessages() {
  return normalizeInitialThreadMessages("miaomiao");
}

function getNextUnreadSisterReplyDueAt(now = Date.now()) {
  const collectedCards = gameState.fieldGuide && Array.isArray(gameState.fieldGuide.collectedCards)
    ? gameState.fieldGuide.collectedCards
    : [];
  const dueTimes = collectedCards
    .map((entry) => getPendingUnreadLiyaReplyDueAt(entry, now))
    .filter((dueAt) => Number.isFinite(dueAt));

  return dueTimes.length > 0 ? Math.min(...dueTimes) : null;
}

function scheduleSisterReplyRender() {
  if (sisterReplyTimerId) {
    window.clearTimeout(sisterReplyTimerId);
    sisterReplyTimerId = null;
  }

  const nextDueAt = getNextUnreadSisterReplyDueAt();
  if (!Number.isFinite(nextDueAt)) {
    return;
  }

  sisterReplyTimerId = window.setTimeout(() => {
    sisterReplyTimerId = null;
    syncDueLiyaAnalyticsEvents(Date.now());
    render();
  }, Math.max(0, nextDueAt - Date.now() + 50));
}


function renderMessagePanel() {
  const sisterMessages = getSisterThreadMessages();
  const momMessages = getMomThreadMessages();
  const miaomiaoMessages = getMiaomiaoThreadMessages();
  const threadStateById = {
    liya: {
      threadId: "liya",
      action: "openSisterChat",
      displayName: (getInitialThreadConfig("liya") && getInitialThreadConfig("liya").displayName) || "陈老师",
      avatarText: (getInitialThreadConfig("liya") && getInitialThreadConfig("liya").avatarText) || "陈",
      messages: sisterMessages,
      unread: hasUnreadLiyaMessages(gameState.fieldGuide) || hasUnreadInitialMessages("liya", gameState.fieldGuide)
    },
    mother: {
      threadId: "mother",
      action: "openMomChat",
      displayName: (getInitialThreadConfig("mother") && getInitialThreadConfig("mother").displayName) || "妈妈",
      avatarText: (getInitialThreadConfig("mother") && getInitialThreadConfig("mother").avatarText) || "妈",
      messages: momMessages,
      unread: hasUnreadInitialMessages("mother", gameState.fieldGuide)
    },
    miaomiao: {
      threadId: "miaomiao",
      action: "openMiaomiaoChat",
      displayName: (getInitialThreadConfig("miaomiao") && getInitialThreadConfig("miaomiao").displayName) || "苗苗（消息灵通）",
      avatarText: (getInitialThreadConfig("miaomiao") && getInitialThreadConfig("miaomiao").avatarText) || "苗",
      messages: miaomiaoMessages,
      unread: hasUnreadInitialMessages("miaomiao", gameState.fieldGuide)
    }
  };
  const threadOrder = getMessageThreadIds();
  const activeThreadId = getMessageThreadIdByView(messageView);
  renderMessagePanelUI({
    detailPanelEl: elements.detailPanel,
    inlinePanelJustOpened,
    pendingChatScrollRestoreState,
    shouldAutoScrollChatHistory,
    threadStateById,
    threadOrder,
    activeThreadId,
    escapeHtml,
    formatMessageTime,
    renderFieldGuideDetailPolaroid,
    isLiyaThreadOpen: isLiyaThreadCurrentlyOpen,
    onRequestRender: render,
    onLiyaMessageLinesComplete: ({ message, beforeRenderScrollState }) => {
      const now = Date.now();
      const targetCardIds = [message.cardId];
      const beforeByCardId = getQueueSnapshotsByCardIds(gameState.fieldGuide, targetCardIds);
      const result = markDueSisterRepliesReadByCardIds(gameState.fieldGuide, targetCardIds, now);
      if (result && result.hasChanged === true) {
        gameState.fieldGuide = result.guide;
        syncViewedEventsFromReadTransitions(gameState.fieldGuide, targetCardIds, beforeByCardId, now);
        pendingChatScrollRestoreState = beforeRenderScrollState;
        render();
      }
    },
    onAfterChatRendered: autoMarkVisibleLiyaRepliesRead,
    consumeAutoScrollChatHistory: () => {
      shouldAutoScrollChatHistory = false;
    }
  });
  pendingChatScrollRestoreState = null;
}

function syncDetailPanelPosition() {
  if (activeOverlay === "messages" || activeOverlay === "fieldGuide" || activeOverlay === "resetSaveConfirm") {
    if (elements.detailPanel.previousElementSibling !== elements.utilityActions) {
      elements.utilityActions.after(elements.detailPanel);
    }
    return;
  }

  if (elements.detailPanel.parentElement !== elements.detailLayout) {
    elements.detailLayout.insertBefore(elements.detailPanel, elements.logPanel);
  }
}

function renderDetailPanel() {
  syncDetailPanelPosition();
  const isResetSaveConfirmOpen = activeOverlay === "resetSaveConfirm";
  elements.detailPanel.classList.toggle("is-note-folder-shell", activeOverlay === "fieldGuide" || isResetSaveConfirmOpen || (gameState.mode === "FIELD_GUIDE" && activeOverlay !== "messages"));
  elements.detailPanel.classList.toggle("is-inline-panel", activeOverlay === "messages" || activeOverlay === "fieldGuide" || isResetSaveConfirmOpen);

  if (activeOverlay === "messages") {
    renderMessagePanel();
    inlinePanelJustOpened = null;
    return;
  }

  if (activeOverlay === "fieldGuide") {
    renderFieldGuide();
    inlinePanelJustOpened = null;
    return;
  }

  if (isResetSaveConfirmOpen) {
    renderResetSaveConfirm();
    inlinePanelJustOpened = null;
    return;
  }

  if (gameState.mode === "FIELD_GUIDE") {
    renderFieldGuide();
    inlinePanelJustOpened = null;
    return;
  }

  if (gameState.mode === "SETTLEMENT") {
    renderSettlement();
    inlinePanelJustOpened = null;
    return;
  }

  if (gameState.mode === "PHOTO") {
    renderPhotoDetail();
    inlinePanelJustOpened = null;
    return;
  }

  if (gameState.mode === "FIRST_ENCOUNTER") {
    renderFirstEncounterDetail();
    inlinePanelJustOpened = null;
    return;
  }

  if (gameState.mode === "START_SPOT_SELECT") {
    renderStartSpotSelectDetail();
    inlinePanelJustOpened = null;
    return;
  }

  if (gameState.mode === "SPOT_SELECT") {
    renderSpotSelectDetail();
    inlinePanelJustOpened = null;
    return;
  }

  renderDefaultDetail();
  inlinePanelJustOpened = null;
}

function getEventTextClassName() {
  const classNames = [];

  if (gameState.mode === "FIRST_ENCOUNTER") {
    classNames.push("is-new-bird-event");
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
  elements.turn.innerHTML = renderTimeAndBatteryStatus(gameState);
  renderStatusBlocks(currentSpot, mapInfo);
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
  applyRenderedFocusFrameSizes();
  setupFocusAnimationIfNeeded();
  scheduleSisterReplyRender();
}

function showFieldGuide() {
  if (gameState.mode === "SETTLEMENT") {
    isSettlementRevealed = false;
  }

  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
  gameState.previousMode = gameState.mode;
  gameState.mode = "FIELD_GUIDE";
  gameState.fieldGuide = loadFieldGuide();
  gameState.eventText = "你翻开笔记，查看亲眼见过的记录。";
}

function returnFromFieldGuide() {
  if (gameState.mode === "SETTLEMENT" || gameState.previousMode === "SETTLEMENT") {
    isSettlementRevealed = false;
  }

  gameState.mode = gameState.previousMode || "START";
  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
  delete gameState.previousMode;
}

function createRestStartState() {
  const nextState = createDefaultGameState();
  nextState.mode = "START";
  return nextState;
}

function clearResetRelatedTimers() {
  if (recentlyIdentifiedTimerId) {
    window.clearTimeout(recentlyIdentifiedTimerId);
    recentlyIdentifiedTimerId = null;
  }

  if (sisterReplyTimerId) {
    window.clearTimeout(sisterReplyTimerId);
    sisterReplyTimerId = null;
  }

  if (autoCatalogueCompletionTimerId) {
    window.clearTimeout(autoCatalogueCompletionTimerId);
    autoCatalogueCompletionTimerId = null;
  }

  autoCatalogueCompletingSpeciesId = null;
}

function resetTransientUiState() {
  clearLiyaLineAnimationTimers();
  clearResetRelatedTimers();
  clearActivePolaroid();
  stopFocusAnimation();
  stopFocusExitAnimation();
  clearFocusTimeoutState();

  isSettlementRevealed = false;
  activeOverlay = null;
  inlinePanelJustOpened = null;
  fieldGuideSpeciesIndex = 0;
  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
  activeMessagePreview = null;
  messageView = "list";
  shouldAutoScrollChatHistory = false;
  pendingChatScrollRestoreState = null;
  isApplyingVisibleLiyaAutoRead = false;
  recentlyCataloguedSpeciesId = null;
  recentlyIdentifiedCardId = null;
  lastEventTextRevealKey = "";
}

function openResetSaveConfirm() {
  clearLiyaLineAnimationTimers();
  resetSaveReturnOverlay = activeOverlay === "fieldGuide" ? "fieldGuide" : null;
  activeOverlay = "resetSaveConfirm";
  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
}

function performSaveReset() {
  resetStoredSave({ clearGameProgress: true });
  resetTransientUiState();
  resetSaveReturnOverlay = null;
  gameState = createRestStartState();
  gameState.fieldGuide = loadFieldGuide();
  hasShownOpeningMonologue = false;
  analyticsOpeningNarrativeSeenAt = null;
  analyticsOpeningNarrativeCompleted = false;
  analyticsOpeningNarrativeActive = false;
  applyStartModeNarration();
}

function handleSystemAction(action) {
  if (action === "start") {
    if (gameState.mode === "START" && gameState.eventText === OPENING_MONOLOGUE_TEXT) {
      trackOpeningNarrativeCompleted({ nextAction: "start" });
    }
    clearLiyaLineAnimationTimers();
    isSettlementRevealed = false;
    activeOverlay = null;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    gameState = startGame();
  }

  if (action === "rest") {
    clearLiyaLineAnimationTimers();
    isSettlementRevealed = false;
    activeOverlay = null;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    gameState = createRestStartState();
    applyStartModeNarration({ fromRest: true });
  }

  if (action === "fieldGuide") {
    clearLiyaLineAnimationTimers();
    activeOverlay = activeOverlay === "fieldGuide" ? null : "fieldGuide";
  }

  if (action === "back") {
    returnFromFieldGuide();
  }

  if (action === "resetSave" || action === "clearGuide") {
    openResetSaveConfirm();
  }

  if (action === "resetSaveCancel") {
    activeOverlay = resetSaveReturnOverlay === "fieldGuide" ? "fieldGuide" : null;
    resetSaveReturnOverlay = null;
  }

  if (action === "resetSaveConfirm") {
    performSaveReset();
  }

  if (action === "endGame") {
    isSettlementRevealed = false;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    gameState = endGame(gameState, "retreat");
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
  const isFieldGuideVisible = gameState.mode === "FIELD_GUIDE" || activeOverlay === "fieldGuide";

  if (!isFieldGuideVisible || discoveredSpecies.length <= 1) {
    return;
  }

  fieldGuideSpeciesIndex = (fieldGuideSpeciesIndex + direction + discoveredSpecies.length) % discoveredSpecies.length;
  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
  render();
}

elements.detailPanel.addEventListener("click", (event) => {
  const messageThreadItem = event.target.closest(".message-thread-item");

  if (messageThreadItem && messageThreadItem.dataset.action === "openSisterChat") {
    openMessageThread("liya");
    return;
  }

  if (messageThreadItem && messageThreadItem.dataset.action === "openMomChat") {
    openMessageThread("mother");
    return;
  }

  if (messageThreadItem && messageThreadItem.dataset.action === "openMiaomiaoChat") {
    openMessageThread("miaomiao");
    return;
  }

  const messageChatBackButton = event.target.closest(".message-chat-back");

  if (messageChatBackButton && messageChatBackButton.dataset.action === "backToMessageList") {
    clearLiyaLineAnimationTimers();
    messageView = "list";
    render();
    return;
  }

  const messageCloseButton = event.target.closest(".message-close-button, .message-back-button");

  if (messageCloseButton) {
    closeAnalyticsChatSession();
    clearLiyaLineAnimationTimers();
    activeOverlay = null;
    messageView = "list";
    render();
    return;
  }

  const fieldGuideClearButton = event.target.closest(".field-guide-clear-button");

  if (fieldGuideClearButton) {
    handleSystemAction(fieldGuideClearButton.dataset.action);
    render();
    return;
  }

  const resetSaveConfirmButton = event.target.closest(".reset-save-confirm__cancel, .reset-save-confirm__confirm");

  if (resetSaveConfirmButton) {
    handleSystemAction(resetSaveConfirmButton.dataset.action);
    render();
    return;
  }

  const detailBackButton = event.target.closest(".field-guide-detail-back");

  if (detailBackButton) {
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    render();
    return;
  }

  const snapshotButton = event.target.closest(".field-guide-snapshot-button");

  if (snapshotButton) {
    const snapshots = fieldGuideDetailCardId
      ? getCollectedCardSnapshots(gameState.fieldGuide, fieldGuideDetailCardId)
      : [];

    if (snapshotButton.dataset.action === "fieldGuidePrevSnapshot") {
      fieldGuideDetailSnapshotIndex = Math.max(0, fieldGuideDetailSnapshotIndex - 1);
    }

    if (snapshotButton.dataset.action === "fieldGuideNextSnapshot") {
      fieldGuideDetailSnapshotIndex = Math.min(Math.max(snapshots.length - 1, 0), fieldGuideDetailSnapshotIndex + 1);
    }

    render();
    return;
  }

  const identifyButton = event.target.closest(".field-guide-identify-button");

  if (identifyButton) {
    const cardId = identifyButton.dataset.cardId || fieldGuideDetailCardId;

    if (cardId) {
      gameState.fieldGuide = identifyCollectedCard(gameState.fieldGuide, cardId);
      recentlyIdentifiedCardId = cardId;

      if (recentlyIdentifiedTimerId) {
        window.clearTimeout(recentlyIdentifiedTimerId);
      }

      recentlyIdentifiedTimerId = window.setTimeout(() => {
        if (recentlyIdentifiedCardId === cardId) {
          recentlyIdentifiedCardId = null;
          render();
        }

        recentlyIdentifiedTimerId = null;
      }, 520);
    }

    render();
    return;
  }

  const sendButton = event.target.closest(".field-guide-send-button");

  if (sendButton) {
    const cardId = sendButton.dataset.cardId || fieldGuideDetailCardId;
    const discoveredSpecies = getDiscoveredSpecies(gameState.fieldGuide);
    const species = discoveredSpecies[fieldGuideSpeciesIndex] || null;
    const isCataloguedSpecies = species
      ? getSpeciesKnowledgeState(gameState.fieldGuide, species.id) === "CATALOGUED"
      : false;
    const card = species
      ? getCardsForSpecies(species.id).find((item) => item.id === cardId)
      : null;

    if (cardId && card && !isCollectedCardSentToSister(gameState.fieldGuide, cardId)) {
      const knowledgeLines = getSisterKnowledgeForCard(card, species, { isCatalogued: isCataloguedSpecies });
      gameState.fieldGuide = sendCollectedCardToSister(gameState.fieldGuide, cardId, knowledgeLines);
      const updatedEntry = getCollectedCardEntry(gameState.fieldGuide, cardId);
      const snapshots = getCollectedCardSnapshots(gameState.fieldGuide, cardId);
      const queueItem = createLiyaPhotoReplyQueueItem(card, snapshots[0] || null, updatedEntry);

      if (queueItem) {
        gameState.fieldGuide = setCollectedCardLiyaMessageQueueItem(gameState.fieldGuide, cardId, queueItem);
      }
    }

    render();
    return;
  }

  const fieldGuideCardButton = event.target.closest(".field-guide-card-button");

  if (fieldGuideCardButton) {
    const cardId = fieldGuideCardButton.dataset.cardId || null;
    if (cardId) {
      gameState.fieldGuide = markCollectedCardViewed(gameState.fieldGuide, cardId);
    }

    fieldGuideDetailCardId = cardId;
    fieldGuideDetailSnapshotIndex = 0;
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

function handleUtilityActionButton(button) {
  if (button.getAttribute("aria-disabled") === "true") {
    return false;
  }

  if (button.dataset.action === "messages") {
    syncDueLiyaAnalyticsEvents(Date.now());
    if (activeOverlay === "messages") {
      closeAnalyticsChatSession();
      clearLiyaLineAnimationTimers();
      activeOverlay = null;
      activeMessagePreview = null;
      messageView = "list";
    } else {
      openAnalyticsChatSession({ threadId: "messages", source: "toolbar" });
      activeMessagePreview = null;
      messageView = "list";
      activeOverlay = "messages";
      inlinePanelJustOpened = "messages";
    }
    render();
    return true;
  }

  if (button.dataset.action === "fieldGuide") {
    clearLiyaLineAnimationTimers();
    const wasFieldGuideContextOpen = activeOverlay === "fieldGuide" || activeOverlay === "resetSaveConfirm";
    const isOpeningFieldGuide = activeOverlay !== "fieldGuide";
    fieldGuideSpeciesIndex = 0;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    activeOverlay = activeOverlay === "fieldGuide" ? null : "fieldGuide";
    inlinePanelJustOpened = isOpeningFieldGuide ? "fieldGuide" : null;
    if (!wasFieldGuideContextOpen && activeOverlay === "fieldGuide") {
      trackFieldGuideOpened({ source: "toolbar" });
    }
    render();
    return true;
  }
  return false;
}

elements.statusGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".dashboard-card-button");

  if (!button) {
    return;
  }

  if (!handleUtilityActionButton(button)) {
    event.preventDefault();
  }
});

elements.utilityActions.addEventListener("click", (event) => {
  const button = event.target.closest(".dashboard-card-button");

  if (!button) {
    return;
  }

  if (!handleUtilityActionButton(button)) {
    event.preventDefault();
  }
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
    beginAnalyticsSession(action);
  }

  if (type === "photo") {
    gameState = handlePhotoAction(gameState, action, {
      capturedBehaviorState: capturedShootBehaviorState,
      capturedFocusAffix,
      ...focusSnapshotPayload
    });
  }

  syncDueLiyaAnalyticsEvents(Date.now());

  const latestPolaroidPhoto = isShootAction && gameState.photos.length > previousPhotoCount
    ? gameState.photos[gameState.photos.length - 1]
    : null;

  if (latestPolaroidPhoto && latestPolaroidPhoto.snapshot) {
    trackPhotoTaken(latestPolaroidPhoto);
  }

  if (!analyticsSessionEnded && isAnalyticsString(gameState.currentSpotId)) {
    analyticsSpotsVisitedInSession.add(gameState.currentSpotId);
  }

  if (shouldPlayFocusExit && gameState.mode === "PHOTO" && gameState.photoPhase === "RESULT") {
    startFocusExitAnimation(focusExitStartPosition, focusExitState);
  } else if (gameState.mode !== "PHOTO") {
    stopFocusExitAnimation();
    clearFocusTimeoutState();
  }

  if (previousMode !== "SETTLEMENT" && gameState.mode === "SETTLEMENT") {
    isSettlementRevealed = false;
    finishAnalyticsSession(type, action);
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

window.addEventListener("resize", () => {
  applyRenderedFocusFrameSizes();
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

applyStartModeNarration();
loadLiyaMessages();
render();
hideInitialLoadingMask();
