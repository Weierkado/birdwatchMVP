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
import {
  BADGE_RANDOM_SCALE,
  BADGE_ROTATION,
  BIRD_DISTANCE_SCALE,
  CAMERA_FOCUS_CONFIG,
  LOG_LIMIT
} from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import {
  hasDrivingSurveyDone,
  markDrivingSurveyDone,
  readObservationDayIndex,
  clearObservationDayIndex as removeObservationDayIndex,
  writeObservationDayIndex
} from "./core/saveManager.js";
import { getTesterProfile, getTesterUuid, saveTesterProfile } from "./analytics.js";
import {
  clearTelemetrySurvey,
  createTelemetrySession,
  flushTelemetry,
  setTelemetrySurvey,
  trackTelemetryEvent
} from "./core/telemetryAdapter.js";
import { SAVE_RESET_REGISTRY, loadFieldGuide, resetSave as resetStoredSave, saveFieldGuide } from "./storage.js";
import { BEHAVIOR_STATE_DISPLAY, getCurrentPhotoState } from "./photoSequence.js";
import { endGame, handleCatalogueAction, handleDistantListenAction, handleExploreAction, handleFirstEncounterAction, handlePhotoAction, handleSpotSelectAction, setEventSystem, setWeatherSystem, startGame, startGameAtSpot } from "./gameSession.js";
import { createEventSystem } from "./eventSystem.js";
import { createWeatherSystem } from "./weatherSystem.js";
import { getCardCaptureCount, getCollectedCardEntry, getCollectedCardSnapshots, getCollectedCardSisterKnowledge, getPendingAutoCatalogueCardId, getSpeciesKnowledgeState, getSpeciesPhotoCount, getSpeciesSeenCount, hasUnreadLiyaMessages, hasUnreadLiyaPhotoReply, identifyCollectedCard, isCollectedCardSentToSister, isCollectedCardSisterKnowledgeUnlocked, markAutoCatalogueCompleted, markCollectedCardViewed, markDueSisterRepliesReadByCardIds, sendCollectedCardToSister, setCollectedCardLiyaMessageQueueItem } from "./fieldGuide.js";
import { createRarityBadgeHtml } from "./rarityDisplay.js";
import { getAllSpots, getCurrentSpot, getSpotById, getSurroundingSpotMap } from "./spotManager.js";
import { getFocusConfig, createFocusRuntime, evaluateFocus, computeBadgeRotation, getFocusAffixDisplay, getFocusDistance } from "./focusEngine.js";
import { getFocusSequenceState } from "./focusSequence.js";
import { getLiyaMessageById, loadLiyaMessages, selectLiyaMessages } from "./liyaMessageSystem.js";
import {
  captureChatScrollState as captureChatScrollStateUI,
  clearLiyaLineAnimationTimers as clearLiyaLineAnimationTimersUI,
  getDeliveredUnreadLineCount as getDeliveredUnreadLineCountUI,
  getVisibleLiyaReplyCardIds as getVisibleLiyaReplyCardIdsUI,
  isElementFullyVisibleInContainer as isElementFullyVisibleInContainerUI,
  renderMessagePanel as renderMessagePanelUI,
  startLiyaMessageLineAnimation as startLiyaMessageLineAnimationUI,
  restoreChatScrollState as restoreChatScrollStateUI
} from "./ui/messagePanel.js";
import {
  renderFieldGuideDetailContent,
  renderFieldGuideDetailPolaroid as renderFieldGuideDetailPolaroidUI,
  renderFieldGuideJournalPanel,
  renderFieldGuideOverlayView,
  renderResetSaveConfirmPanel,
  renderFieldGuideSnapshotNav as renderFieldGuideSnapshotNavUI
} from "./ui/fieldGuidePanel.js";
import { renderBottomNav as renderBottomNavUI } from "./ui/bottomNav.js";
import { renderToolOverlayShell as renderToolOverlayShellUI } from "./ui/toolOverlayShell.js";
import { escapeHtml, escapeRegExp } from "./utils/dom.js";
import {
  getSurveyVersion,
  isAnalyticsEnabled as isPlaytestAnalyticsEnabled,
  isOpeningSurveyEnabled,
  isSettlementSurveyEnabled
} from "./utils/config.js";
import {
  formatMessageTime,
  formatPolaroidDate,
  getCardDisplayDescription,
  getCardDisplayTitle,
  getModeDisplay,
  getTimeOfDayClassName,
  getTimeOfDayLabel
} from "./utils/format.js";

let gameState = createDefaultGameState();
let isSettlementRevealed = false;
let fieldGuideSpeciesIndex = 0;
let fieldGuideDetailCardId = null;
let fieldGuideDetailSnapshotIndex = 0;
let activeOverlay = null;
let resetSaveReturnOverlay = null;
let inlinePanelJustOpened = null;
let lastRenderedToolOverlayType = null;
let activeMessagePreview = null;
let messageView = "list";
let lastOpenedMessageThreadId = "";
let shouldAutoScrollChatHistory = false;
let recentlyCataloguedSpeciesId = null;
let recentlyIdentifiedCardId = null;
let recentlyIdentifiedTimerId = null;
let sisterReplyTimerId = null;
let liyaReplyChainTimerId = null;
let liyaReplyChainPauseActive = false;
let autoCatalogueCompletionTimerId = null;
let autoCatalogueCompletingSpeciesId = null;
let settlementRevealTimerId = null;
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
let isCameraRaisedForTopUi = false;
let focusExitFrom = null;
let focusExitTo = null;
let focusExitCurve = null;
let focusExitBehaviorState = null;
let focusExitReason = "";
let activePolaroidEl = null;
let activePolaroidTimerIds = [];
let polaroidOverlayRoot = null;
let activeLiyaReplyAnimationKey = null;
let liyaAutoReadSkipOnceCardIds = new Set();
let pendingInitialThreadReadAfterOpenId = null;
let messageUnreadDividerSnapshot = null;
let lastEventTextRevealKey = "";
let lastRenderedEventPulseKey = 0;
let observationMapRotationDeg = 0;
let lastObservationMapFacingDirection = null;
let lastRenderedObservationMapRotationDeg = null;
let resultJustSentToSisterPhotoId = null;
let isActionTransitioning = false;
let actionTransitionTimerId = null;
let isSettlementSummaryExpanded = false;
let settlementReviewExpanded = false;
let hasPlayedSettlementSummaryReveal = false;
let shouldAnimateSettlementSummaryReveal = false;
let hasShownOpeningMonologue = false;
let hasPlayedOpeningMonologueReveal = false;
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
let analyticsPreparedSessionForStart = false;
let observationDayIndex = 1;
let testerProfileDraft = null;
let testerProfileValidationMessage = "";
let postSessionSurveyDraft = null;
let postSessionSurveyResolved = false;
let postSessionSurveySubmitting = false;
let postSessionSurveyFlushPromise = null;
let postSessionSurveyUiState = "idle";
let settlementRestSubmitting = false;

const FOCUS_ENTER_DELAY_MS = 1200;
const FOCUS_ENTER_DURATION_MS = 700;
const FOCUS_EXIT_DURATION_MS = 550;
const LIYA_REPLY_CHAIN_GAP_MS = 280;
const LIYA_REPLY_DELAY_MIN_MS = 1000;
const LIYA_REPLY_DELAY_MAX_MS = 2000;
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
const RITUAL_EXPLORE_ACTIONS = new Set(["turnLeft", "turnRight", "observe"]);
const RITUAL_DELAY_RANGES = {
  turn: [400, 750],
  empty: [700, 1000],
  clue: [1200, 1700],
  bird: [500, 850]
};
const OPENING_MONOLOGUE_SEGMENT_REVEAL_MS = 920;
const OPENING_MONOLOGUE_SEGMENT_DELAY_MS = 1360;
const FOCUS_OFFSET_X_RATIO = 0.42;
const FOCUS_OFFSET_Y_RATIO = 0.34;
const FOCUS_ENTER_TARGET_RANGE_X = 0.102 / FOCUS_OFFSET_X_RATIO;
const FOCUS_ENTER_TARGET_RANGE_Y = 0.085 / FOCUS_OFFSET_Y_RATIO;
const CAPTURE_FOCUS_UI_SCALE = 1.22;
const ENABLE_CARD_IDENTIFY_UI = false;
const OBSERVATION_MAP_INITIAL_ROTATIONS = [0, -90, -180, -270];
const OBSERVATION_MAP_ROTATION_STEP_DEG = 90;
const OBSERVATION_MAP_DIRECTION_COUNT = 4;
const FOCUS_FRAME_VISUAL_SIZE = {
  width: 40,
  height: 30
};
const FOCUS_FRAME_CONTAINER_PADDING = 32;
const OPENING_MONOLOGUE_TEXT = `我想出来走走。

辞职以后，觉得时间突然变得很空，
空得让我不知道该把自己放在哪里。

妹妹一直对观鸟很感兴趣，但她现在应该用功读书才对。

她一直想让我拍一些大城市的小鸟给她看看，
现在终于有满足她愿望的机会了。`;
const REST_TRANSITION_TEXT = `睡了个好觉，感觉精神多了。

收拾一下，今天也去看看鸟吧。`;
const START_DAY_PROMPT_TEXT = "准备好了就出发吧。";
const OPENING_NARRATIVE_ID = "opening_v1";
const TESTER_PROFILE_PROMPT_TEXT = "测试前先问两个小问题。";
const TESTER_ID_MAX_LENGTH = 40;
const TESTER_LEVEL_OPTIONS = [
  { value: 1, text: "并不了解观鸟" },
  { value: 2, text: "对观鸟感兴趣但还没开始观鸟" },
  { value: 3, text: "有观鸟经验但没有专业设备" },
  { value: 4, text: "有专业观鸟设备" }
];
// DEPRECATED_CANDIDATE: legacy post-survey status; current one-shot gate uses the playtest2 driving survey done key.
const POST_SURVEY_STATUS_KEY = "birdwatch_text_sim_post_survey_status";
const SURVEY_TEXT_LIMITS = {
  q2OtherText: 120,
  q3OtherText: 120,
  q10OtherText: 120,
  q11MotivationMoment: 800,
  q12AnythingElse: 800
};
const SURVEY_Q1_OPTIONS = [
  { value: 1, key: "continue_1", text: "完全不想继续" },
  { value: 2, key: "continue_2", text: "不太想继续" },
  { value: 3, key: "continue_3", text: "有一点想继续" },
  { value: 4, key: "continue_4", text: "一般，可玩可不玩" },
  { value: 5, key: "continue_5", text: "比较想继续" },
  { value: 6, key: "continue_6", text: "很想继续" },
  { value: 7, key: "continue_7", text: "非常想继续，想知道后面还有什么" }
];
const SURVEY_Q2_OPTIONS = [
  { key: "bird_knowledge", text: "想认识更多鸟" },
  { key: "collection", text: "想继续收集 / 补全图鉴" },
  { key: "sister_chat", text: "想继续和妹妹聊天" },
  { key: "sisters_story", text: "想知道姐姐和妹妹后面会发生什么" },
  { key: "better_photo", text: "想拍到更好的照片 / 更高稀有度" },
  { key: "explore_places", text: "想探索更多地点" },
  { key: "no_reason", text: "暂时没有特别想继续的原因" },
  { key: "other", text: "其他" }
];
const SURVEY_Q3_OPTIONS = [
  { value: 1, key: "person_want_interact", text: "她像一个有性格的人，我愿意继续和她互动" },
  { value: 2, key: "some_charm_not_enough", text: "她有一些可爱 / 有趣的地方，但还不够让我在意" },
  { value: 3, key: "functional_npc", text: "她主要像一个识别鸟名和给提示的功能 NPC" },
  { value: 4, key: "no_impression", text: "我对她没有明显印象" },
  { value: 5, key: "other", text: "其他" }
];
const SURVEY_Q4_OPTIONS = [
  { value: 1, key: "boost_1", text: "完全没有增强" },
  { value: 2, key: "boost_2", text: "基本没有增强" },
  { value: 3, key: "boost_3", text: "有一点增强" },
  { value: 4, key: "boost_4", text: "一般" },
  { value: 5, key: "boost_5", text: "比较增强" },
  { value: 6, key: "boost_6", text: "明显增强" },
  { value: 7, key: "boost_7", text: "非常增强，我会期待她的回复" }
];
const SURVEY_Q5_OPTIONS = [
  { value: 1, key: "clear_and_motivating", text: "很清楚，并且这层关系让我更想继续玩" },
  { value: 2, key: "roughly_understand_no_emotion", text: "大致理解，但还没有明显情感投入" },
  { value: 3, key: "vague_helper_sister", text: "有点模糊，只知道有个妹妹在帮我认鸟" },
  { value: 4, key: "do_not_understand", text: "不太理解她们是什么关系 / 为什么要聊天" }
];
const SURVEY_Q6_OPTIONS = [
  { value: 1, key: "ritual_new_bird", text: "很有仪式感，像是真的认识了一只新鸟" },
  { value: 2, key: "some_achievement", text: "有一点成就感，但流程还可以更强" },
  { value: 3, key: "normal_unlock", text: "只是普通解锁图鉴，没有特别感觉" },
  { value: 4, key: "too_troublesome", text: "流程有点麻烦，反而影响节奏" },
  { value: 5, key: "did_not_notice", text: "没太注意到这个过程" }
];
const SURVEY_Q7_OPTIONS = [
  { value: 1, key: "like_immersive", text: "很喜欢，让我更有代入感" },
  { value: 2, key: "acceptable_weak", text: "可以接受，但感觉不强" },
  { value: 3, key: "troublesome_want_direct_name", text: "有点麻烦，我更想直接知道鸟名" },
  { value: 4, key: "did_not_notice", text: "没注意到这个设计" }
];
const SURVEY_Q8_OPTIONS = [
  { value: 1, key: "observing_waiting_bird", text: "我觉得自己真的在观察和等待鸟的状态" },
  { value: 2, key: "some_operation_minigame", text: "有一定操作感，但更多像小游戏" },
  { value: 3, key: "only_want_result", text: "我主要是为了拿结果，不太在意拍照过程" },
  { value: 4, key: "breaks_rhythm_or_stressful", text: "有点打断节奏或让我紧张" },
  { value: 5, key: "do_not_understand", text: "不太理解拍照时该做什么" }
];
const SURVEY_Q9_OPTIONS = [
  { value: 1, key: "retry_1", text: "不愿意，失败后想放弃" },
  { value: 2, key: "retry_2", text: "不太愿意" },
  { value: 3, key: "retry_3", text: "有一点愿意" },
  { value: 4, key: "retry_4", text: "看情况" },
  { value: 5, key: "retry_5", text: "比较愿意" },
  { value: 6, key: "retry_6", text: "很愿意" },
  { value: 7, key: "retry_7", text: "非常愿意，我会想再试一次拍得更好" }
];
const SURVEY_Q10_OPTIONS = [
  { value: 1, key: "bird_collection", text: "鸟类收集游戏" },
  { value: 2, key: "photo_observation", text: "拍照 / 观察玩法游戏" },
  { value: 3, key: "sisters_narrative", text: "关于姐妹和妹妹的叙事游戏" },
  { value: 4, key: "relaxing_city_nature", text: "放松的城市自然探索游戏" },
  { value: 5, key: "not_sure", text: "不太确定" },
  { value: 6, key: "other", text: "其他" }
];

const elements = {
  page: document.querySelector(".page"),
  gameTitle: document.querySelector("#gameTitle"),
  mode: document.querySelector("#modeText"),
  turn: document.querySelector("#turnText"),
  spot: document.querySelector("#spotText"),
  sdCard: document.querySelector("#sdCardText"),
  photoTiming: document.querySelector("#photoTimingText"),
  eventText: document.querySelector("#eventText"),
  statusGrid: document.querySelector(".status-grid"),
  actionPanel: document.querySelector("#actionPanel"),
  logList: document.querySelector("#logList"),
  detailPanel: document.querySelector("#detailPanel")
};

const speciesById = new Map(speciesList.map((species) => [species.id, species]));
const eventSystem = createEventSystem({
  defaultText: "暂无事件",
  onDisplayChange() {
    render();
  },
  getSpeciesById(speciesId) {
    return speciesById.get(speciesId) || null;
  }
});

const weatherSystem = createWeatherSystem({
  eventSystem
});

setEventSystem(eventSystem);
setWeatherSystem(weatherSystem);
weatherSystem.initForSession(gameState);

function clearEventHintState() {
  eventSystem.clear();
}

const resetActions = document.createElement("section");
resetActions.className = "reset-actions";
resetActions.setAttribute("aria-label", "存档操作");

const toolOverlayRoot = document.createElement("div");
toolOverlayRoot.className = "tool-overlay-host";
toolOverlayRoot.setAttribute("aria-live", "off");

const bottomNavRoot = document.createElement("nav");
bottomNavRoot.className = "bottom-nav-host";
bottomNavRoot.setAttribute("aria-label", "主导航");

function normalizeObservationDayIndex(value) {
  const normalized = Number.parseInt(value, 10);
  if (!Number.isFinite(normalized) || normalized < 1) {
    return 1;
  }
  return normalized;
}

function loadObservationDayIndex() {
  return readObservationDayIndex();
}

function saveObservationDayIndex(dayIndex) {
  const safeDayIndex = normalizeObservationDayIndex(dayIndex);
  observationDayIndex = safeDayIndex;
  writeObservationDayIndex(safeDayIndex);
  return safeDayIndex;
}

function resetObservationDayIndex() {
  observationDayIndex = 1;
  removeObservationDayIndex();
}

function getObservationDayTitle() {
  return `裸辞之后，观鸟的第\u2009${normalizeObservationDayIndex(observationDayIndex)}\u2009天`;
}

function renderGameTitle() {
  if (!elements.gameTitle) {
    return;
  }
  elements.gameTitle.textContent = getObservationDayTitle();
}

function normalizeTesterDraftId(value) {
  return typeof value === "string" ? value.trim().slice(0, TESTER_ID_MAX_LENGTH) : "";
}

function getTesterLevelOption(level) {
  return TESTER_LEVEL_OPTIONS.find((item) => item.value === level) || null;
}

function getSavedTesterProfile() {
  return getTesterProfile();
}

function isTesterProfileCompatible(profile) {
  if (!profile || typeof profile !== "object") {
    return false;
  }

  const option = getTesterLevelOption(profile.tester_level);
  if (!option) {
    return false;
  }

  return profile.tester_level_text === option.text;
}

function hasCompletedTesterProfile() {
  const profile = getSavedTesterProfile();
  return typeof profile.updated_at === "string"
    && profile.updated_at.trim().length > 0
    && isTesterProfileCompatible(profile);
}

function shouldShowTesterProfilePrompt() {
  return isOpeningSurveyEnabled() && gameState.mode === "START" && !hasCompletedTesterProfile();
}

function ensureTesterProfileDraft() {
  if (testerProfileDraft) {
    return testerProfileDraft;
  }

  const savedProfile = getSavedTesterProfile();
  testerProfileDraft = {
    testerId: normalizeTesterDraftId(savedProfile.tester_id),
    testerLevel: isTesterProfileCompatible(savedProfile) ? String(savedProfile.tester_level) : ""
  };
  return testerProfileDraft;
}

function updateTesterProfileDraft(nextValue = {}) {
  const previousDraft = ensureTesterProfileDraft();
  testerProfileDraft = {
    testerId: Object.prototype.hasOwnProperty.call(nextValue, "testerId")
      ? normalizeTesterDraftId(nextValue.testerId)
      : previousDraft.testerId,
    testerLevel: Object.prototype.hasOwnProperty.call(nextValue, "testerLevel")
      ? String(nextValue.testerLevel || "").trim()
      : previousDraft.testerLevel
  };
}

function saveTesterProfileAndContinue(profile) {
  saveTesterProfile({
    tester_id: normalizeTesterDraftId(profile && profile.tester_id),
    tester_level: profile && profile.tester_level,
    tester_level_text: profile && profile.tester_level_text,
    updated_at: new Date().toISOString()
  });
  testerProfileDraft = null;
  testerProfileValidationMessage = "";
  applyStartModeNarration();
}

function trimSurveyText(value, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, maxLength);
}

function getSurveySingleOption(options, value) {
  const numericValue = Number.parseInt(value, 10);
  return options.find((item) => item.value === numericValue) || null;
}

function getSurveyMultiSelectedOptions(options, selectedKeys) {
  const safeKeys = Array.isArray(selectedKeys) ? selectedKeys : [];
  const keySet = new Set(safeKeys.filter((item) => typeof item === "string" && item.trim()));
  return options.filter((item) => keySet.has(item.key));
}

function createEmptyPostSessionSurveyAnswers() {
  return {
    submitted: true,
    skipped: false,
    version: getSurveyVersion(),
    submitted_at: "",
    q1_continue_intent: null,
    q2_continue_reasons: [],
    q2_other: "",
    q3_sister_feeling: null,
    q3_other: "",
    q4_sister_motivation_boost: null,
    q5_sisters_relationship_understanding: null,
    q6_catalogue_feeling: null,
    q7_unknown_name_design: null,
    q8_photo_gameplay_feeling: null,
    q9_retry_after_photo: null,
    q10_game_identity: null,
    q10_other: "",
    q11_motivation_moment: "",
    q12_anything_else: "",
    interview_willing: false
  };
}

function createDefaultPostSessionSurveyDraft() {
  return {
    q1: "",
    q2Values: [],
    q2OtherText: "",
    q3: "",
    q3OtherText: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
    q8: "",
    q9: "",
    q10: "",
    q10OtherText: "",
    q11MotivationMoment: "",
    q12AnythingElse: "",
    interviewWilling: false
  };
}

function normalizePostSurveyStatus(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    submitted: value.submitted === true,
    submitted_at: typeof value.submitted_at === "string" ? value.submitted_at.trim() : "",
    session_id: typeof value.session_id === "string" ? value.session_id.trim() : "",
    tester_uuid: typeof value.tester_uuid === "string" ? value.tester_uuid.trim() : "",
    tester_id: typeof value.tester_id === "string" ? value.tester_id.trim() : "",
    tester_level: Number.isFinite(Number(value.tester_level)) ? Number.parseInt(value.tester_level, 10) : 0
  };
}

function loadPostSurveyStatus() {
  try {
    const rawValue = window.localStorage.getItem(POST_SURVEY_STATUS_KEY);
    if (!rawValue) {
      return null;
    }

    return normalizePostSurveyStatus(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

// DEPRECATED_CANDIDATE: no current caller found in audit; keep until legacy survey status usage is confirmed absent.
function hasSubmittedPostSurvey() {
  const status = loadPostSurveyStatus();
  return Boolean(status && status.submitted === true);
}

function hasCompletedDrivingSurvey() {
  if (!isSettlementSurveyEnabled()) {
    return false;
  }

  return hasDrivingSurveyDone();
}

function markDrivingSurveyCompleted() {
  if (!isSettlementSurveyEnabled()) {
    return;
  }

  markDrivingSurveyDone();
}

function savePostSurveyStatus() {
  const profile = getSavedTesterProfile();
  const status = {
    submitted: true,
    submitted_at: new Date().toISOString(),
    session_id: currentAnalyticsSession && typeof currentAnalyticsSession.sessionId === "string"
      ? currentAnalyticsSession.sessionId
      : "",
    tester_uuid: getTesterUuid(),
    tester_id: profile.tester_id,
    tester_level: profile.tester_level
  };

  try {
    window.localStorage.setItem(POST_SURVEY_STATUS_KEY, JSON.stringify(status));
  } catch {}

  return status;
}

function resetPostSessionSurveyState() {
  postSessionSurveyDraft = createDefaultPostSessionSurveyDraft();
  postSessionSurveyResolved = false;
  postSessionSurveySubmitting = false;
  postSessionSurveyFlushPromise = null;
  postSessionSurveyUiState = "idle";
  settlementRestSubmitting = false;
}

function ensurePostSessionSurveyDraft() {
  if (!postSessionSurveyDraft) {
    postSessionSurveyDraft = createDefaultPostSessionSurveyDraft();
  }
  return postSessionSurveyDraft;
}

function updatePostSessionSurveyDraft(nextDraft = {}) {
  const currentDraft = ensurePostSessionSurveyDraft();
  postSessionSurveyDraft = {
    ...currentDraft,
    ...nextDraft,
    q2Values: Object.prototype.hasOwnProperty.call(nextDraft, "q2Values")
      ? [...nextDraft.q2Values]
      : [...currentDraft.q2Values]
  };
}

function buildPostSessionSurveyPayload() {
  const draft = ensurePostSessionSurveyDraft();
  const answers = createEmptyPostSessionSurveyAnswers();
  const q1Option = getSurveySingleOption(SURVEY_Q1_OPTIONS, draft.q1);
  const q2Options = getSurveyMultiSelectedOptions(SURVEY_Q2_OPTIONS, draft.q2Values).slice(0, 2);
  const q3Option = getSurveySingleOption(SURVEY_Q3_OPTIONS, draft.q3);
  const q4Option = getSurveySingleOption(SURVEY_Q4_OPTIONS, draft.q4);
  const q5Option = getSurveySingleOption(SURVEY_Q5_OPTIONS, draft.q5);
  const q6Option = getSurveySingleOption(SURVEY_Q6_OPTIONS, draft.q6);
  const q7Option = getSurveySingleOption(SURVEY_Q7_OPTIONS, draft.q7);
  const q8Option = getSurveySingleOption(SURVEY_Q8_OPTIONS, draft.q8);
  const q9Option = getSurveySingleOption(SURVEY_Q9_OPTIONS, draft.q9);
  const q10Option = getSurveySingleOption(SURVEY_Q10_OPTIONS, draft.q10);

  answers.submitted_at = new Date().toISOString();
  answers.q1_continue_intent = q1Option ? q1Option.value : null;
  answers.q2_continue_reasons = q2Options.map((item) => item.key);
  answers.q2_other = draft.q2Values.includes("other")
    ? trimSurveyText(draft.q2OtherText, SURVEY_TEXT_LIMITS.q2OtherText)
    : "";
  answers.q3_sister_feeling = q3Option ? q3Option.key : null;
  answers.q3_other = draft.q3 === "5" || draft.q3 === 5 || draft.q3 === "other"
    ? trimSurveyText(draft.q3OtherText, SURVEY_TEXT_LIMITS.q3OtherText)
    : "";
  answers.q4_sister_motivation_boost = q4Option ? q4Option.value : null;
  answers.q5_sisters_relationship_understanding = q5Option ? q5Option.key : null;
  answers.q6_catalogue_feeling = q6Option ? q6Option.key : null;
  answers.q7_unknown_name_design = q7Option ? q7Option.key : null;
  answers.q8_photo_gameplay_feeling = q8Option ? q8Option.key : null;
  answers.q9_retry_after_photo = q9Option ? q9Option.value : null;
  answers.q10_game_identity = q10Option ? q10Option.key : null;
  answers.q10_other = draft.q10 === "6" || draft.q10 === 6 || draft.q10 === "other"
    ? trimSurveyText(draft.q10OtherText, SURVEY_TEXT_LIMITS.q10OtherText)
    : "";
  answers.q11_motivation_moment = trimSurveyText(draft.q11MotivationMoment, SURVEY_TEXT_LIMITS.q11MotivationMoment);
  answers.q12_anything_else = trimSurveyText(draft.q12AnythingElse, SURVEY_TEXT_LIMITS.q12AnythingElse);
  answers.interview_willing = draft.interviewWilling === true;
  return answers;
}

function buildSkippedPostSessionSurveyPayload() {
  return {
    submitted: false,
    skipped: true,
    version: getSurveyVersion()
  };
}

async function submitPostSessionSurvey() {
  if (!isSettlementSurveyEnabled()) {
    return { ok: true, skipped: true, reason: "settlement_survey_disabled" };
  }

  if (postSessionSurveyFlushPromise) {
    return postSessionSurveyFlushPromise;
  }

  postSessionSurveySubmitting = true;
  const surveyPayload = buildPostSessionSurveyPayload();
  setTelemetrySurvey(surveyPayload);
  savePostSurveyStatus();

  postSessionSurveyFlushPromise = flushTelemetry({
    reason: "session_end",
    survey: surveyPayload,
    finalizeSession: true
  }).finally(() => {
    postSessionSurveySubmitting = false;
  });

  try {
    await postSessionSurveyFlushPromise;
    markDrivingSurveyCompleted();
    postSessionSurveyResolved = true;
    postSessionSurveyUiState = "idle";
    render();
  } finally {
    postSessionSurveyFlushPromise = null;
  }
}

async function skipPostSessionSurvey() {
  if (!isSettlementSurveyEnabled()) {
    return { ok: true, skipped: true, reason: "settlement_survey_disabled" };
  }

  if (postSessionSurveyFlushPromise) {
    return postSessionSurveyFlushPromise;
  }

  postSessionSurveySubmitting = true;
  const surveyPayload = buildSkippedPostSessionSurveyPayload();
  setTelemetrySurvey(surveyPayload);

  postSessionSurveyFlushPromise = flushTelemetry({
    reason: "session_end",
    survey: surveyPayload,
    finalizeSession: true
  }).finally(() => {
    postSessionSurveySubmitting = false;
  });

  try {
    await postSessionSurveyFlushPromise;
    markDrivingSurveyCompleted();
    postSessionSurveyResolved = true;
    postSessionSurveyUiState = "idle";
    render();
  } finally {
    postSessionSurveyFlushPromise = null;
  }
}

async function flushSettlementSessionWithoutSurvey() {
  if (postSessionSurveyFlushPromise) {
    return postSessionSurveyFlushPromise;
  }

  const surveyPayload = isSettlementSurveyEnabled() && !hasCompletedDrivingSurvey()
    ? buildSkippedPostSessionSurveyPayload()
    : null;
  if (surveyPayload && isPlaytestAnalyticsEnabled()) {
    setTelemetrySurvey(surveyPayload);
  } else {
    clearTelemetrySurvey();
  }
  return flushTelemetry({
    reason: "session_end",
    survey: surveyPayload,
    finalizeSession: true
  });
}

observationDayIndex = loadObservationDayIndex();
elements.detailLayout = elements.detailPanel.parentElement;
elements.logPanel = elements.logList.closest(".log-panel");
elements.detailLayout.after(resetActions);
elements.resetActions = resetActions;
document.body.append(toolOverlayRoot, bottomNavRoot);
elements.toolOverlayRoot = toolOverlayRoot;
elements.bottomNavRoot = bottomNavRoot;

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
elements.spot = replaceStatusEntryWithInfo(elements.spot, "天气", weatherSystem.getCurrentLabel(gameState));

function normalizeObservationMapDirection(value) {
  const normalized = Number.parseInt(value, 10);

  if (!Number.isFinite(normalized)) {
    return 0;
  }

  return ((normalized % OBSERVATION_MAP_DIRECTION_COUNT) + OBSERVATION_MAP_DIRECTION_COUNT) % OBSERVATION_MAP_DIRECTION_COUNT;
}

function getObservationMapDirectionDelta(previousDirection, nextDirection) {
  const diff = (nextDirection - previousDirection + OBSERVATION_MAP_DIRECTION_COUNT) % OBSERVATION_MAP_DIRECTION_COUNT;

  if (diff === 1) {
    return 1;
  }

  if (diff === OBSERVATION_MAP_DIRECTION_COUNT - 1) {
    return -1;
  }

  if (diff === 2) {
    return 2;
  }

  return 0;
}

function getObservationMapVisualQuarter(angleDeg) {
  if (!Number.isFinite(angleDeg)) {
    return 0;
  }

  return normalizeObservationMapDirection(
    Math.round(angleDeg / OBSERVATION_MAP_ROTATION_STEP_DEG)
  );
}

function getObservationMapItemDistanceToken(itemRotation) {
  const visualQuarter = getObservationMapVisualQuarter(itemRotation);

  return visualQuarter === 0 || visualQuarter === 2
    ? "var(--observation-map-distance-y)"
    : "var(--observation-map-distance-x)";
}

function isObservationMapItemFront(itemRotation) {
  return getObservationMapVisualQuarter(itemRotation) === 0;
}

// 观察地图只跟随真实方向变化，不能反向驱动 gameState 或事件判断。
function syncObservationMapRotationState(direction) {
  const normalizedDirection = normalizeObservationMapDirection(direction);

  if (lastObservationMapFacingDirection === null) {
    observationMapRotationDeg = OBSERVATION_MAP_INITIAL_ROTATIONS[normalizedDirection] || 0;
    lastObservationMapFacingDirection = normalizedDirection;
    return;
  }

  const delta = getObservationMapDirectionDelta(lastObservationMapFacingDirection, normalizedDirection);

  if (delta === 1) {
    observationMapRotationDeg -= OBSERVATION_MAP_ROTATION_STEP_DEG;
  } else if (delta === -1) {
    observationMapRotationDeg += OBSERVATION_MAP_ROTATION_STEP_DEG;
  } else if (delta === 2) {
    observationMapRotationDeg -= OBSERVATION_MAP_ROTATION_STEP_DEG * 2;
  }

  lastObservationMapFacingDirection = normalizedDirection;
}

function updateObservationMapRotation(mapRoot, rotationDeg) {
  if (!mapRoot) {
    return;
  }

  const items = mapRoot.querySelectorAll(".observation-map__item");

  items.forEach((item) => {
    const baseAngle = Number.parseFloat(item.dataset.mapAngle || "0");
    const itemRotation = rotationDeg + (Number.isFinite(baseAngle) ? baseAngle : 0);
    const labelRotation = -itemRotation;
    const itemDistance = getObservationMapItemDistanceToken(itemRotation);

    item.style.setProperty("--item-rotation", `${itemRotation}deg`);
    item.style.setProperty("--label-rotation", `${labelRotation}deg`);
    item.style.setProperty("--item-distance", itemDistance);
    item.classList.toggle("is-front", isObservationMapItemFront(itemRotation));
  });
}

function syncObservationMapPresentation() {
  const mapRoots = Array.from(document.querySelectorAll("[data-observation-map]"));

  if (mapRoots.length <= 0) {
    lastRenderedObservationMapRotationDeg = observationMapRotationDeg;
    return;
  }

  let renderedRotation = observationMapRotationDeg;

  mapRoots.forEach((mapRoot) => {
    const targetRotation = Number.parseFloat(mapRoot.dataset.targetRotation || `${observationMapRotationDeg}`);
    const initialRotation = Number.parseFloat(mapRoot.dataset.initialRotation || `${targetRotation}`);
    const safeTargetRotation = Number.isFinite(targetRotation) ? targetRotation : observationMapRotationDeg;
    const safeInitialRotation = Number.isFinite(initialRotation) ? initialRotation : safeTargetRotation;
    const shouldAnimate = mapRoot.dataset.animate === "true" && safeInitialRotation !== safeTargetRotation;

    mapRoot.classList.add("is-no-transition");
    updateObservationMapRotation(mapRoot, shouldAnimate ? safeInitialRotation : safeTargetRotation);
    void mapRoot.offsetWidth;
    mapRoot.classList.remove("is-no-transition");

    if (shouldAnimate) {
      updateObservationMapRotation(mapRoot, safeTargetRotation);
    }

    mapRoot.dataset.initialRotation = `${safeTargetRotation}`;
    renderedRotation = safeTargetRotation;
  });

  lastRenderedObservationMapRotationDeg = renderedRotation;
}

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

function normalizeCaptureBehaviorState(value) {
  if (value === "NORMAL" || value === "INTERESTING" || value === "REMARKABLE") {
    return value;
  }

  return null;
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

  if (shouldShowTesterProfilePrompt()) {
    gameState.eventText = TESTER_PROFILE_PROMPT_TEXT;
    gameState.eventHtml = "";
    analyticsOpeningNarrativeActive = false;
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

function getCurrentWeatherLabel(state = gameState) {
  if (!weatherSystem || typeof weatherSystem.getCurrentLabel !== "function") {
    return "☀ 晴天";
  }

  return weatherSystem.getCurrentLabel(state);
}

function isCaptureTopUiActive() {
  return isCameraRaisedForTopUi || isFocusExiting;
}

function syncCameraRaisedTopUiStateAfterAction(type, action) {
  if (gameState.mode !== "PHOTO") {
    isCameraRaisedForTopUi = false;
    return;
  }

  if (type !== "photo") {
    return;
  }

  if ((action === "raiseCamera" || action === "refocus") && gameState.photoPhase === "FOCUS") {
    isCameraRaisedForTopUi = true;
  }
}

function getNightReviewSentToSisterCount(state = gameState) {
  const count = state
    && state.nightReviewStats
    && Number(state.nightReviewStats.sentToSisterCount);

  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function incrementNightReviewSentToSisterCount() {
  if (!gameState.nightReviewStats || typeof gameState.nightReviewStats !== "object") {
    gameState.nightReviewStats = { sentToSisterCount: 0 };
  }

  const currentCount = Number(gameState.nightReviewStats.sentToSisterCount);
  gameState.nightReviewStats.sentToSisterCount = (Number.isFinite(currentCount) ? currentCount : 0) + 1;
}

function getNightReviewSummary(state = gameState) {
  const photos = state && Array.isArray(state.photos) ? state.photos : [];
  const photoCount = photos.length;
  const photographedSpeciesCount = new Set(
    photos
      .map((photo) => photo && photo.speciesId)
      .filter(Boolean)
  ).size;
  const newCardCount = state && Array.isArray(state.sessionNewCards)
    ? state.sessionNewCards.length
    : 0;
  const sentToSisterCount = getNightReviewSentToSisterCount(state);

  return {
    weatherLabel: getCurrentWeatherLabel(state),
    photoCount,
    photographedSpeciesCount,
    newCardCount,
    sentToSisterCount
  };
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

  trackTelemetryEvent("chat_opened", {
    chat_session_id: analyticsCurrentChatSession.chatSessionId,
    unread_count_at_open: unreadCountAtOpen,
    preceding_event: precedingEvent,
    thread_id: threadId,
    source
  });
}

function closeAnalyticsChatSession() {
  if (!currentAnalyticsSession || analyticsSessionEnded || !analyticsCurrentChatSession) {
    return false;
  }

  const durationMs = Math.max(0, Date.now() - analyticsCurrentChatSession.openedAt);
  analyticsChatTotalMs += durationMs;

  trackTelemetryEvent("chat_closed", {
    chat_session_id: analyticsCurrentChatSession.chatSessionId,
    duration_ms: durationMs,
    messages_viewed_in_chat: analyticsCurrentChatSession.messagesViewedInChat || 0,
    thread_id: analyticsCurrentChatSession.threadId || ""
  });

  analyticsCurrentChatSession = null;
  return true;
}

function prepareAnalyticsSessionForStart() {
  if (!isPlaytestAnalyticsEnabled()) {
    analyticsPreparedSessionForStart = false;
    return null;
  }

  const session = createTelemetrySession({ forceNew: true });
  analyticsPreparedSessionForStart = true;
  return session;
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

  trackTelemetryEvent("field_guide_opened", {
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
  if (!isPlaytestAnalyticsEnabled()) {
    return;
  }

  if (analyticsOpeningNarrativeActive) {
    return;
  }

  if (!analyticsPreparedSessionForStart) {
    prepareAnalyticsSessionForStart();
  }

  const seenAt = Date.now();
  const source = isAnalyticsString(options.source) ? options.source : "unknown";
  const mode = isAnalyticsString(gameState && gameState.mode) ? gameState.mode : "unknown";

  trackTelemetryEvent("opening_narrative_seen", {
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
  if (!isPlaytestAnalyticsEnabled()) {
    return;
  }

  if (!analyticsOpeningNarrativeActive || analyticsOpeningNarrativeCompleted) {
    return;
  }

  const now = Date.now();
  const nextAction = isAnalyticsString(options.nextAction) ? options.nextAction : "unknown";
  const secondsOnPage = Number.isFinite(analyticsOpeningNarrativeSeenAt)
    ? Math.max(0, Math.round((now - analyticsOpeningNarrativeSeenAt) / 1000))
    : null;

  trackTelemetryEvent("opening_narrative_completed", {
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
    : (isAnalyticsString(context.photoId) ? context.photoId : (cardId ? `legacy_card:${cardId}` : ""));

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

  trackTelemetryEvent("sister_message_received", {
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

  trackTelemetryEvent("sister_message_viewed", {
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
  if (!isPlaytestAnalyticsEnabled()) {
    resetPostSessionSurveyState();
    resetAnalyticsSessionRuntime();
    analyticsPreparedSessionForStart = false;
    return;
  }

  if (currentAnalyticsSession && !analyticsSessionEnded) {
    return;
  }

  resetPostSessionSurveyState();
  resetAnalyticsSessionRuntime();
  currentAnalyticsSession = analyticsPreparedSessionForStart
    ? createTelemetrySession()
    : createTelemetrySession({ forceNew: true });
  analyticsPreparedSessionForStart = false;
  analyticsSessionStartedAt = Date.now();
  analyticsSessionEnded = false;

  if (isAnalyticsString(startSpotId)) {
    analyticsSpotsVisitedInSession.add(startSpotId);
  }

  trackTelemetryEvent("session_start", {
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

  closeAnalyticsChatSession();

  const durationMs = analyticsSessionStartedAt
    ? Math.max(0, Date.now() - analyticsSessionStartedAt)
    : null;
  const sessionEndedAt = Date.now();
  const chatTotalMs = analyticsChatTotalMs;
  const isLast30sChatOpened = Number.isFinite(analyticsLastChatOpenedAt)
    ? Math.max(0, sessionEndedAt - analyticsLastChatOpenedAt) <= 30000
    : false;

  trackTelemetryEvent("session_end", {
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
  const photoId = isAnalyticsString(photo.id)
    ? photo.id
    : (isAnalyticsString(snapshot.photoId) ? snapshot.photoId : `${isAnalyticsString(photo.card && photo.card.id) ? photo.card.id : "photo"}_${now}`);

  trackTelemetryEvent("photo_taken", {
    photo_id: photoId,
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
    <span class="focus-frame" style="${getFocusFrameStyle(getScaledFocusFrameVisualSize(CAPTURE_FOCUS_UI_SCALE))}" aria-hidden="true">
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

function clearMessageUnreadDividerSnapshot() {
  messageUnreadDividerSnapshot = null;
}

function getThreadMessagesForUnreadSnapshot(threadId) {
  if (threadId === "liya") {
    return getSisterThreadMessages();
  }
  if (threadId === "mother") {
    return getMomThreadMessages();
  }
  if (threadId === "miaomiao") {
    return getMiaomiaoThreadMessages();
  }
  return [];
}

function captureMessageUnreadDividerSnapshot(threadId) {
  const messages = getThreadMessagesForUnreadSnapshot(threadId);
  const firstUnreadMessage = messages.find((message) => (
    message
    && message.isUnread === true
    && typeof message.id === "string"
    && message.id.trim()
  ));
  messageUnreadDividerSnapshot = firstUnreadMessage
    ? {
        threadId,
        messageId: firstUnreadMessage.id.trim()
      }
    : null;
}

function getUnreadDividerMessageIdForThread(threadId) {
  if (
    !messageUnreadDividerSnapshot
    || messageUnreadDividerSnapshot.threadId !== threadId
    || typeof messageUnreadDividerSnapshot.messageId !== "string"
  ) {
    return "";
  }
  return messageUnreadDividerSnapshot.messageId.trim();
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

function getUnreadInitialMessagesCount(fieldGuide) {
  return getMessageThreadIds().reduce((count, threadId) => (
    count + normalizeInitialThreadMessages(threadId).reduce((threadCount, message) => (
      threadCount + getDeliveredUnreadLineCountUI(message)
    ), 0)
  ), 0);
}

function getUnreadLiyaReplyLineCount(fieldGuide, now = Date.now()) {
  return getSentSisterPhotoMessages()
    .filter((message) => (
      message
      && message.sender === "sister"
      && message.source === "photo_reply"
      && message.isUnread === true
      && Number.isFinite(toSafeTimestamp(message.time))
      && toSafeTimestamp(message.time) <= now
    ))
    .reduce((count, message) => count + getDeliveredUnreadLineCountUI(message), 0);
}

function getUnreadMessagesCount(fieldGuide, now = Date.now()) {
  return getUnreadInitialMessagesCount(fieldGuide) + getUnreadLiyaReplyLineCount(fieldGuide, now);
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
  captureMessageUnreadDividerSnapshot(threadId);
  pendingInitialThreadReadAfterOpenId = hasUnreadInitialMessages(threadId, gameState.fieldGuide)
    ? threadId
    : null;
  clearPendingChatScrollRestoreState();
  lastOpenedMessageThreadId = threadId;
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
      const lines = text
        .split("\n")
        .map((line) => String(line || "").trim())
        .filter((line) => line.length > 0);
      const isRead = isInitialMessageRead(message, gameState && gameState.fieldGuide);

      return {
        id: typeof message.id === "string" ? message.id : `${threadId}_initial_${index}`,
        sender: normalizeInitialMessageSender(message.speaker),
        type: "text",
        source: "initial_seed",
        threadId,
        text,
        lines,
        time: timestamp,
        sortAt: timestamp,
        order: 0,
        isRead,
        isUnread: !isRead,
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

function createLiyaReplyDueAt(createdAt) {
  const baseTime = Number.isFinite(createdAt) ? createdAt : Date.now();
  const delayRange = Math.max(0, LIYA_REPLY_DELAY_MAX_MS - LIYA_REPLY_DELAY_MIN_MS);
  return baseTime + LIYA_REPLY_DELAY_MIN_MS + Math.floor(Math.random() * (delayRange + 1));
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
    const dueAt = Number.isFinite(entry.sisterReplyDueAt) ? entry.sisterReplyDueAt : createLiyaReplyDueAt(createdAt);
    const cardId = card.id || entry.cardId || "";
    const speciesId = card.speciesId || "";
    const photoId = isAnalyticsString(snapshot && snapshot.photoId)
      ? snapshot.photoId
      : "";

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
      photoId,
      cardId,
      speciesId,
      context: {
        eventName: "photo_sent",
        photoId,
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

function captureCollectedCardReplyState(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    sentToSister: entry.sentToSister === true,
    sentToSisterAt: Number.isFinite(entry.sentToSisterAt) ? entry.sentToSisterAt : null,
    sisterReplyDueAt: Number.isFinite(entry.sisterReplyDueAt) ? entry.sisterReplyDueAt : null,
    sisterReplyReadAt: Number.isFinite(entry.sisterReplyReadAt) ? entry.sisterReplyReadAt : null,
    sisterKnowledgeUnlocked: entry.sisterKnowledgeUnlocked === true,
    pendingAutoCatalogue: entry.pendingAutoCatalogue === true,
    autoCatalogueReadyAt: Number.isFinite(entry.autoCatalogueReadyAt) ? entry.autoCatalogueReadyAt : null,
    autoCataloguedAt: Number.isFinite(entry.autoCataloguedAt) ? entry.autoCataloguedAt : null,
    sisterKnowledge: Array.isArray(entry.sisterKnowledge) ? [...entry.sisterKnowledge] : [],
    liyaMessageQueueItem: entry.liyaMessageQueueItem
      ? JSON.parse(JSON.stringify(entry.liyaMessageQueueItem))
      : null
  };
}

function restoreCollectedCardReplyState(entry, replyState) {
  if (!entry || !replyState) {
    return;
  }

  entry.sentToSister = replyState.sentToSister === true;
  entry.sentToSisterAt = replyState.sentToSisterAt;
  entry.sisterReplyDueAt = replyState.sisterReplyDueAt;
  entry.sisterReplyReadAt = replyState.sisterReplyReadAt;
  entry.sisterKnowledgeUnlocked = replyState.sisterKnowledgeUnlocked === true;
  entry.pendingAutoCatalogue = replyState.pendingAutoCatalogue === true;
  entry.autoCatalogueReadyAt = replyState.autoCatalogueReadyAt;
  entry.autoCataloguedAt = replyState.autoCataloguedAt;
  entry.sisterKnowledge = Array.isArray(replyState.sisterKnowledge) ? [...replyState.sisterKnowledge] : [];
  entry.liyaMessageQueueItem = replyState.liyaMessageQueueItem
    ? JSON.parse(JSON.stringify(replyState.liyaMessageQueueItem))
    : null;
}

function sendCollectedCardEntryToSister(cardId, options = {}) {
  if (typeof cardId !== "string" || !cardId.trim()) {
    return false;
  }

  const card = getCardById(cardId);
  const existingEntry = getCollectedCardEntry(gameState.fieldGuide, cardId);

  if (!card || !existingEntry || existingEntry.sentToSister === true) {
    return false;
  }

  const replyStateBeforeSend = captureCollectedCardReplyState(existingEntry);
  const species = card.speciesId ? getSpeciesById(card.speciesId) : null;
  const isCataloguedSpecies = species
    ? getSpeciesKnowledgeState(gameState.fieldGuide, species.id) === "CATALOGUED"
    : false;
  const knowledgeLines = getSisterKnowledgeForCard(card, species, { isCatalogued: isCataloguedSpecies });

  gameState.fieldGuide = sendCollectedCardToSister(gameState.fieldGuide, cardId, knowledgeLines);

  const updatedEntry = getCollectedCardEntry(gameState.fieldGuide, cardId);
  const snapshots = getCollectedCardSnapshots(gameState.fieldGuide, cardId);
  const queueSnapshot = options.snapshot || snapshots[0] || null;
  const queueItem = createLiyaPhotoReplyQueueItem(card, queueSnapshot, updatedEntry);

  if (!queueItem) {
    restoreCollectedCardReplyState(updatedEntry, replyStateBeforeSend);
    saveFieldGuide(gameState.fieldGuide);
    return false;
  }

  gameState.fieldGuide = setCollectedCardLiyaMessageQueueItem(gameState.fieldGuide, cardId, queueItem);
  incrementNightReviewSentToSisterCount();
  return true;
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

function getScaledFocusFrameVisualSize(scale = 1) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    width: FOCUS_FRAME_VISUAL_SIZE.width * safeScale,
    height: FOCUS_FRAME_VISUAL_SIZE.height * safeScale
  };
}

function getFocusFrameSizeForContainerRect(containerRect, scale = 1) {
  const visualSize = getScaledFocusFrameVisualSize(scale);
  if (!containerRect || containerRect.width <= 0 || containerRect.height <= 0) {
    return { ...visualSize };
  }

  const maxWidth = Math.max(1, containerRect.width - FOCUS_FRAME_CONTAINER_PADDING);
  const maxHeight = Math.max(1, containerRect.height - FOCUS_FRAME_CONTAINER_PADDING);
  const fitScale = Math.min(
    1,
    maxWidth / visualSize.width,
    maxHeight / visualSize.height
  );

  return {
    width: Math.max(1, visualSize.width * fitScale),
    height: Math.max(1, visualSize.height * fitScale)
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
  const frameScale = frameEl.classList.contains("focus-frame") ? CAPTURE_FOCUS_UI_SCALE : 1;
  const size = getFocusFrameSizeForContainerRect(
    containerRect || (containerEl ? containerEl.getBoundingClientRect() : null),
    frameScale
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

function renderTextWithEmphasis(text, terms = []) {
  const rawText = String(text ?? "");
  const uniqueTerms = [...new Set(
    (Array.isArray(terms) ? terms : [])
      .map((term) => String(term ?? "").trim())
      .filter(Boolean)
  )].sort((left, right) => right.length - left.length);

  if (!uniqueTerms.length) {
    return escapeHtml(rawText);
  }

  const pattern = new RegExp(uniqueTerms.map((term) => escapeRegExp(term)).join("|"), "g");
  let result = "";
  let lastIndex = 0;
  let match = pattern.exec(rawText);

  while (match) {
    const matchedText = match[0];
    const startIndex = match.index;
    result += escapeHtml(rawText.slice(lastIndex, startIndex));
    result += `<strong class="event-emphasis">${escapeHtml(matchedText)}</strong>`;
    lastIndex = startIndex + matchedText.length;
    match = pattern.exec(rawText);
  }

  result += escapeHtml(rawText.slice(lastIndex));
  return result;
}

function getEventTextEmphasisTerms() {
  const terms = [];
  const currentSpot = getCurrentSpot(gameState);

  if (currentSpot && typeof currentSpot.name === "string" && currentSpot.name.trim()) {
    terms.push(currentSpot.name.trim());
  }

  const currentBird = gameState.currentPhotoTarget;
  const speciesId = currentBird && typeof currentBird.speciesId === "string"
    ? currentBird.speciesId.trim()
    : "";

  if (speciesId) {
    const visibleSpeciesName = getSpeciesPhotoDisplayName(speciesId);
    if (visibleSpeciesName) {
      terms.push(visibleSpeciesName);
    }

    const species = getSpeciesById(speciesId);
    if (species) {
      if (typeof species.nickname === "string" && species.nickname.trim()) {
        terms.push(species.nickname.trim());
      }
      if (typeof species.name === "string" && species.name.trim()) {
        terms.push(species.name.trim());
      }
    }
  }

  return terms;
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

function getJournalSpecies(fieldGuide) {
  return getDiscoveredSpecies(fieldGuide).filter((species) => {
    const knowledgeState = getSpeciesKnowledgeState(fieldGuide, species.id);
    return knowledgeState === "SEEN" || knowledgeState === "CATALOGUED";
  });
}

function getHeardOnlySpeciesCount(fieldGuide) {
  if (!fieldGuide || typeof fieldGuide !== "object") {
    return 0;
  }

  const heardSpeciesIds = Array.isArray(fieldGuide.heardSpeciesIds) ? fieldGuide.heardSpeciesIds : [];
  return heardSpeciesIds.filter((speciesId) => getSpeciesKnowledgeState(fieldGuide, speciesId) === "HEARD").length;
}

function getCollectedCardItemsForSpecies(fieldGuide, speciesId) {
  return getCardsForSpecies(speciesId)
    .map((card) => ({
      card,
      entry: getCollectedCardEntry(fieldGuide, card.id),
      snapshots: getCollectedCardSnapshots(fieldGuide, card.id)
    }))
    .filter((item) => item.entry);
}

function getJournalSnapshotCount(collectedItems) {
  return collectedItems.reduce((total, item) => total + (Array.isArray(item.snapshots) ? item.snapshots.length : 0), 0);
}

function getBestJournalFocusScore(collectedItems) {
  let bestScore = null;

  collectedItems.forEach((item) => {
    (Array.isArray(item.snapshots) ? item.snapshots : []).forEach((snapshot) => {
      if (snapshot && Number.isFinite(snapshot.focusScore)) {
        bestScore = bestScore === null ? snapshot.focusScore : Math.max(bestScore, snapshot.focusScore);
      }
    });
  });

  return bestScore;
}

function hasHighQualityJournalSnapshot(collectedItems) {
  return collectedItems.some((item) => (Array.isArray(item.snapshots) ? item.snapshots : []).some((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    const focusGrade = typeof snapshot.focusGrade === "string" ? snapshot.focusGrade : "";
    return snapshot.focusAffix === "IN_FOCUS"
      || (Number.isFinite(snapshot.focusScore) && snapshot.focusScore >= 70)
      || focusGrade.includes("清晰")
      || focusGrade.includes("数毛");
  }));
}

function hasNotableJournalRecord(collectedItems) {
  return collectedItems.some((item) => {
    const rarity = item.card && typeof item.card.rarity === "string" ? item.card.rarity : "";
    if (["INTERESTING", "REMARKABLE", "PRECIOUS"].includes(rarity)) {
      return true;
    }

    return (Array.isArray(item.snapshots) ? item.snapshots : []).some((snapshot) => {
      const capturedState = snapshot && typeof snapshot.capturedState === "string" ? snapshot.capturedState : "";
      return ["INTERESTING", "REMARKABLE", "PRECIOUS"].includes(capturedState);
    });
  });
}

function hasSentJournalRecord(collectedItems) {
  return collectedItems.some((item) => Boolean(
    item.entry
    && (item.entry.sentToSister === true || item.entry.liyaMessageQueueItem)
  ));
}

function getDisplayFamiliarityScore(fieldGuide, speciesId, options = {}) {
  const knowledgeState = getSpeciesKnowledgeState(fieldGuide, speciesId);
  const isCataloguedSpecies = knowledgeState === "CATALOGUED";
  const collectedItems = Array.isArray(options.collectedItems)
    ? options.collectedItems
    : getCollectedCardItemsForSpecies(fieldGuide, speciesId);
  const photoCount = getSpeciesPhotoCount(fieldGuide, speciesId);
  const snapshotCount = getJournalSnapshotCount(collectedItems);
  let score = 0;

  if (knowledgeState === "SEEN" || isCataloguedSpecies) {
    score += 1;
  }

  if (photoCount > 0 || collectedItems.length > 0 || snapshotCount > 0) {
    score += 1;
  }

  if (photoCount > 1 || collectedItems.length > 1 || snapshotCount > 1) {
    score += 1;
  }

  if (hasHighQualityJournalSnapshot(collectedItems)) {
    score += 1;
  }

  if (isCataloguedSpecies || hasSentJournalRecord(collectedItems) || hasNotableJournalRecord(collectedItems)) {
    score += 1;
  }

  if (!isCataloguedSpecies) {
    score = Math.min(score, 2);
  }

  return Math.max(0, Math.min(5, score));
}

function getJournalSpeciesDisplayName(species, isCataloguedSpecies) {
  function normalizeJournalNickname(name) {
    return String(name || "").replace(/^那只/, "").trim();
  }

  if (isCataloguedSpecies) {
    return normalizeJournalNickname(species.name);
  }

  return normalizeJournalNickname(
    species.unidentifiedName
    || species.nicknameBeforeCatalogued
    || species.hintName
    || species.nickname
    || "还没认出的鸟"
  );
}

function getFirstSentence(text, fallback = "") {
  const safeText = typeof text === "string" ? text.trim() : "";
  if (!safeText) {
    return fallback;
  }

  const sentenceEndIndex = safeText.indexOf("。");
  if (sentenceEndIndex >= 0) {
    return safeText.slice(0, sentenceEndIndex + 1);
  }

  return safeText;
}

function getJournalGrowthSentence(familiarityScore) {
  if (familiarityScore >= 5) {
    return "你觉得自己已经认识它了。";
  }

  if (familiarityScore >= 4) {
    return "你越来越熟悉它的小动作。";
  }

  if (familiarityScore >= 3) {
    return "你已经能猜到它下一次会从哪里冒出来。";
  }

  if (familiarityScore >= 2) {
    return "你开始能分辨它常待的地方。";
  }

  return "你还只是记得它出现过。";
}

function buildJournalObservationParagraphs(species, options = {}) {
  const isCataloguedSpecies = options.isCataloguedSpecies === true;
  const displayName = options.displayName || getJournalSpeciesDisplayName(species, isCataloguedSpecies);
  const collectedItems = Array.isArray(options.collectedItems) ? options.collectedItems : [];
  const familiarityScore = Number.isFinite(options.familiarityScore) ? options.familiarityScore : 0;
  const speciesSeenCount = Math.max(0, getSpeciesSeenCount(gameState.fieldGuide, species.id));
  const speciesPhotoCount = Math.max(0, getSpeciesPhotoCount(gameState.fieldGuide, species.id));
  const snapshotCount = getJournalSnapshotCount(collectedItems);
  const bestFocusScore = getBestJournalFocusScore(collectedItems);
  const hasSentRecord = hasSentJournalRecord(collectedItems);
  const habitatText = species.habitat || "它出现的地方";
  const baseSentence = isCataloguedSpecies
    ? getFirstSentence(species.appearance, `${displayName}已经被你认真记进了笔记。`)
    : `${displayName}还没有被完全认出来，你只记得它常在${habitatText}附近出现，动作很快。`;

  let recordSentence = "你还只是记得它出现过，笔记里留着一点很轻的印象。";
  if (speciesPhotoCount > 0 || snapshotCount > 0) {
    recordSentence = speciesPhotoCount > 1 || snapshotCount > 1
      ? "你已经为它留下过不止一次影像记录，回看时能慢慢补上更多细节。"
      : "你已经为它留下过一张照片，虽然不必在这里翻看，笔记里还是记得那一刻。";
  } else if (speciesSeenCount > 1) {
    recordSentence = "你已经在野外不止一次遇见它，印象比第一次更稳了一点。";
  }

  if (bestFocusScore !== null && bestFocusScore >= 85) {
    recordSentence = "有一张照片清楚到足够提醒你它当时的姿态。";
  } else if (bestFocusScore !== null && bestFocusScore >= 70) {
    recordSentence = "有一张照片比之前清楚得多，轮廓和动作都更容易回想起来。";
  }

  const paragraphs = [
    baseSentence,
    recordSentence,
    getJournalGrowthSentence(familiarityScore)
  ];

  if (hasSentRecord) {
    paragraphs.splice(2, 0, "你也把其中一张发给妹妹看过，这条记录因此多了一点回声。");
  }

  return paragraphs.slice(0, 4);
}

function completePendingAutoCatalogueForJournal(fieldGuide, journalSpecies) {
  let guide = fieldGuide;

  journalSpecies.forEach((species) => {
    const knowledgeState = getSpeciesKnowledgeState(guide, species.id);
    if (knowledgeState !== "CATALOGUED") {
      return;
    }

    const speciesCardIds = getCollectedCardItemsForSpecies(guide, species.id).map((item) => item.card.id);
    const pendingAutoCatalogueCardId = getPendingAutoCatalogueCardId(guide, speciesCardIds);
    if (pendingAutoCatalogueCardId && autoCatalogueCompletingSpeciesId !== species.id) {
      guide = markAutoCatalogueCompleted(guide, speciesCardIds);
    }
  });

  return guide;
}

function buildJournalEntries(fieldGuide) {
  const journalSpecies = getJournalSpecies(fieldGuide);

  return journalSpecies.map((species) => {
    const knowledgeState = getSpeciesKnowledgeState(fieldGuide, species.id);
    const isCataloguedSpecies = knowledgeState === "CATALOGUED";
    const collectedItems = getCollectedCardItemsForSpecies(fieldGuide, species.id);
    const familiarityScore = getDisplayFamiliarityScore(fieldGuide, species.id, { collectedItems });
    const displayName = getJournalSpeciesDisplayName(species, isCataloguedSpecies);

    return {
      speciesId: species.id,
      displayName,
      isCatalogued: isCataloguedSpecies,
      familiarityScore,
      familiarityMax: 5,
      paragraphs: buildJournalObservationParagraphs(species, {
        isCataloguedSpecies,
        displayName,
        collectedItems,
        familiarityScore
      }),
      dailySupplementText: "等晚上整理照片时，也许会再添上一句。",
      isRecentlyCatalogued: isCataloguedSpecies && species.id === recentlyCataloguedSpeciesId
    };
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

  return renderFieldGuideDetailContent({
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
}

function getCurrentResultPhoto() {
  if (gameState.mode !== "PHOTO" || gameState.photoPhase !== "RESULT" || gameState.photos.length <= 0) {
    return null;
  }

  const photo = gameState.photos[gameState.photos.length - 1];
  return photo && photo.card && photo.card.id ? photo : null;
}

function hasSentAnyPhotoOfSpecies(fieldGuide, speciesId) {
  if (typeof speciesId !== "string" || !speciesId.trim()) {
    return false;
  }

  const guide = fieldGuide && Array.isArray(fieldGuide.collectedCards)
    ? fieldGuide
    : { collectedCards: [] };

  return guide.collectedCards.some((entry) => {
    if (!entry || typeof entry.cardId !== "string" || !entry.cardId) {
      return false;
    }

    const card = getCardById(entry.cardId);
    return card
      && card.speciesId === speciesId
      && (entry.sentToSister === true || Boolean(entry.liyaMessageQueueItem));
  });
}

function getCurrentResultShareTarget() {
  const photo = getCurrentResultPhoto();

  if (!photo || !photo.card || !photo.card.id) {
    return null;
  }

  const card = getCardById(photo.card.id) || photo.card;
  if (!card || !card.id) {
    return null;
  }

  const entry = getCollectedCardEntry(gameState.fieldGuide, card.id);
  if (!entry) {
    return null;
  }

  const species = card.speciesId ? getSpeciesById(card.speciesId) : null;
  const knowledgeState = species
    ? getSpeciesKnowledgeState(gameState.fieldGuide, species.id)
    : "UNKNOWN";
  const resultPhotoId = typeof photo.id === "string" && photo.id
    ? photo.id
    : (photo.snapshot && typeof photo.snapshot.photoId === "string" ? photo.snapshot.photoId : "");
  const alreadySent = entry.sentToSister === true || Boolean(entry.liyaMessageQueueItem);
  const justSentInThisResult = Boolean(resultPhotoId) && resultJustSentToSisterPhotoId === resultPhotoId;
  const hasSentSpeciesBefore = species && species.id
    ? hasSentAnyPhotoOfSpecies(gameState.fieldGuide, species.id)
    : true;

  return {
    photo,
    snapshot: photo.snapshot || null,
    resultPhotoId,
    card,
    entry,
    species,
    knowledgeState,
    alreadySent,
    justSentInThisResult,
    buttonLabel: hasSentSpeciesBefore ? "跟妹妹分享" : "给妹妹认一认！",
    buttonClassName: hasSentSpeciesBefore ? "button-secondary" : "button-liya-identify"
  };
}

function createResultSentButton(label = "已发给妹妹") {
  const button = createButton(label, "", "resultShare", "button-secondary button-liya-sent-pressed");
  button.disabled = true;
  button.setAttribute("aria-disabled", "true");
  button.removeAttribute("data-action");
  return button;
}

function getResultPreviouslySharedNote() {
  const resultShareTarget = getCurrentResultShareTarget();

  if (!resultShareTarget || !resultShareTarget.alreadySent || resultShareTarget.justSentInThisResult) {
    return "";
  }

  return "之前也给妹妹发过这张。";
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
    return { x: -1.25, y: randomBetween(-0.35, 0.35) };
  }

  if (side === 1) {
    return { x: 1.25, y: randomBetween(-0.35, 0.35) };
  }

  if (side === 2) {
    return { x: randomBetween(-0.45, 0.45), y: -1.25 };
  }

  return { x: randomBetween(-0.45, 0.45), y: 1.25 };
}

function createFocusEnterCurve() {
  return {
    x: randomBetween(-0.12, 0.12),
    y: randomBetween(-0.10, 0.10)
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
    : getFocusFrameSizeForContainerRect(playfieldRect, CAPTURE_FOCUS_UI_SCALE);

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

function handleEventStatusAnimationEnd(event) {
  if (!event || event.animationName !== "event-status-pulse-fade") {
    return;
  }

  if (elements.mode) {
    elements.mode.classList.remove("is-event-pulse");
  }
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
  const isCaptureTopUi = isCaptureTopUiActive();
  const modeItem = elements.mode.closest(".status-item");
  const spotItem = elements.spot.closest(".status-item");
  const photoTimingItem = elements.photoTiming.closest(".status-item");
  const locationItem = elements.sdCard.closest(".status-item");
  const locationLabel = locationItem ? locationItem.querySelector(".status-label") : null;
  const photoTimingLabel = photoTimingItem ? photoTimingItem.querySelector(".status-label") : null;
  const eventHintText = eventSystem.getDisplayText("暂无事件");
  const hasActiveEventHint = eventSystem.isActive();
  const eventPulseKey = eventSystem.getActivePulseKey();

  if (locationLabel) {
    locationLabel.textContent = "位置";
  }

  if (elements.statusGrid) {
    elements.statusGrid.classList.toggle("is-capture-top", isCaptureTopUi);
  }

  if (modeItem) {
    modeItem.classList.toggle("is-event-active", !isCaptureTopUi && hasActiveEventHint);
  }

  if (spotItem) {
    spotItem.classList.remove("status-location");
  }

  if (photoTimingItem) {
    if (photoTimingLabel) {
      photoTimingLabel.textContent = isCaptureTopUi
        ? "拍摄时机"
        : `${currentSpot.name} · 周边环境`;
    }

    photoTimingItem.classList.toggle("is-map", !isCaptureTopUi);
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

  elements.mode.innerHTML = `
    <span class="status-label">周围事件</span>
    <span class="status-value">${escapeHtml(eventHintText)}</span>
  `;
  elements.spot.innerHTML = `
    <span class="status-label">天气</span>
    <span class="status-value">${escapeHtml(getCurrentWeatherLabel(gameState))}</span>
  `;
  elements.sdCard.textContent = currentSpot.name;

  if (modeItem) {
    if (!isCaptureTopUi && hasActiveEventHint && eventPulseKey !== lastRenderedEventPulseKey) {
      restartCssAnimation(modeItem, "is-event-pulse");
    } else if (isCaptureTopUi || !hasActiveEventHint) {
      modeItem.classList.remove("is-event-pulse");
    }
  }

  lastRenderedEventPulseKey = !isCaptureTopUi && hasActiveEventHint ? eventPulseKey : 0;
}

function getStartSpotChoices() {
  const allSpots = getAllSpots();
  const startSpots = allSpots.filter((spot) => spot.isStartSpot === true);

  return startSpots.length > 0 ? startSpots : allSpots;
}

function getDefaultStartSpotChoice() {
  return getStartSpotChoices()[0] || null;
}

function renderActions() {
  elements.actionPanel.classList.remove("is-settlement-hidden");
  elements.actionPanel.hidden = false;
  elements.actionPanel.innerHTML = "";

  if (gameState.mode === "START") {
    if (shouldShowTesterProfilePrompt()) {
      elements.actionPanel.hidden = true;
      return;
    }
    elements.actionPanel.append(createButton("开始今天的观鸟", "start", "system", "button-major"));
    return;
  }

  if (gameState.mode === "START_SPOT_SELECT") {
    elements.actionPanel.hidden = true;
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
      createButton("提前撤离并结算", "retreat", "explore")
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
      const resultShareTarget = getCurrentResultShareTarget();
      elements.actionPanel.append(createButton("继续跟焦", "refocus", "photo", "button-major"));
      if (resultShareTarget && resultShareTarget.justSentInThisResult) {
        elements.actionPanel.append(createResultSentButton());
      } else if (resultShareTarget && !resultShareTarget.alreadySent) {
        elements.actionPanel.append(createButton(resultShareTarget.buttonLabel, "sendToSisterResult", "resultShare", resultShareTarget.buttonClassName));
      }
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
    elements.actionPanel.classList.add("is-settlement-hidden");
    elements.actionPanel.hidden = false;
    return;
  }

}

function renderLogs() {
  if (elements.logPanel) {
    elements.logPanel.hidden = true;
  }
  elements.logList.innerHTML = "";
}

function renderLogsLegacy() {
  elements.logList.innerHTML = "";
  // 日志是历史记录，允许保留当时的 nickname / 真名差异；结算会按当前图鉴状态统一显示。
  gameState.logs.slice(0, LOG_LIMIT).forEach((logText) => {
    const item = document.createElement("li");
    item.innerHTML = renderLogTextHtml(logText);
    elements.logList.append(item);
  });
}

function renderResetActions() {
  const shouldShowResetButton = !isToolOverlayVisible();
  elements.resetActions.hidden = !shouldShowResetButton;

  if (!shouldShowResetButton) {
    elements.resetActions.innerHTML = "";
    return;
  }

  elements.resetActions.innerHTML = `
    <button class="field-guide-clear-button reset-save-button" type="button" data-action="resetSave">重置游戏存档</button>
  `;
}

function getObservationMapDirectionName(currentSpot, directionIndex) {
  if (!currentSpot || !currentSpot.directions) {
    return "未记录";
  }

  const label = currentSpot.directions[normalizeObservationMapDirection(directionIndex)];
  return typeof label === "string" && label.trim()
    ? label.trim()
    : "未记录";
}

function renderObservationMapItem(label, position, baseAngle, initialRotationDeg) {
  const safeLabel = typeof label === "string" && label.trim()
    ? label.trim()
    : "未记录";
  const itemRotation = initialRotationDeg + baseAngle;
  const labelRotation = -itemRotation;
  const itemDistance = getObservationMapItemDistanceToken(itemRotation);

  return `
    <div
      class="observation-map__item observation-map__item--${position}"
      data-map-angle="${baseAngle}"
      style="--item-rotation: ${itemRotation}deg; --label-rotation: ${labelRotation}deg; --item-distance: ${itemDistance};"
    >
      <span class="observation-map__label">${escapeHtml(safeLabel)}</span>
    </div>
  `;
}

function renderMapHtml() {
  return `
    <section class="observation-map-panel" aria-label="周边地图">
      ${renderObservationMapWindowOnly()}
    </section>
  `;
}

function renderObservationMapWindowOnly() {
  const mapInfo = getSurroundingSpotMap(gameState);
  const currentSpot = mapInfo.currentSpot;
  const initialRotationDeg = lastRenderedObservationMapRotationDeg === null
    ? observationMapRotationDeg
    : lastRenderedObservationMapRotationDeg;
  const shouldAnimate = lastRenderedObservationMapRotationDeg !== null
    && initialRotationDeg !== observationMapRotationDeg;

  return `
    <div
      class="observation-map__field"
      data-observation-map
      data-initial-rotation="${initialRotationDeg}"
      data-target-rotation="${observationMapRotationDeg}"
      data-animate="${shouldAnimate ? "true" : "false"}"
    >
      ${renderObservationMapItem(getObservationMapDirectionName(currentSpot, 0), "north", 0, initialRotationDeg)}
      ${renderObservationMapItem(getObservationMapDirectionName(currentSpot, 1), "east", 90, initialRotationDeg)}
      ${renderObservationMapItem(getObservationMapDirectionName(currentSpot, 2), "south", 180, initialRotationDeg)}
      ${renderObservationMapItem(getObservationMapDirectionName(currentSpot, 3), "west", -90, initialRotationDeg)}

      <div class="observation-map__center">
        <span class="observation-map__center-dot" aria-hidden="true"></span>
      </div>
    </div>
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
  const journalSpecies = getJournalSpecies(guide);
  const heardOnlyCount = getHeardOnlySpeciesCount(guide);

  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;

  gameState.fieldGuide = completePendingAutoCatalogueForJournal(guide, journalSpecies);
  guide = gameState.fieldGuide;

  const entries = buildJournalEntries(guide);
  normalizeFieldGuideSpeciesIndex(entries.length);
  const currentEntry = entries[fieldGuideSpeciesIndex] || null;
  const shouldShowPager = entries.length > 1;
  const prevButtonHtml = shouldShowPager
    ? '<button class="field-guide-nav-button field-guide-nav-prev" type="button" data-action="fieldGuidePrev" aria-label="上一页">←</button>'
    : "";
  const nextButtonHtml = shouldShowPager
    ? '<button class="field-guide-nav-button field-guide-nav-next" type="button" data-action="fieldGuideNext" aria-label="下一页">→</button>'
    : "";
  const shouldClearRecentCatalogued = entries.some((entry) => entry.isRecentlyCatalogued);
  const emptyDescription = heardOnlyCount > 0
    ? "你听见过一些声音，但还没有真正看清它们。"
    : "还没有哪只鸟真正留在你的笔记里。等你看清它们，再慢慢写下来。";
  const basePanelHtml = renderFieldGuideJournalPanel({
    entries,
    currentEntry,
    currentIndex: fieldGuideSpeciesIndex,
    totalCount: entries.length,
    pagerClassName: shouldShowPager ? "field-guide-pager" : "field-guide-pager is-single-page",
    prevButtonHtml,
    nextButtonHtml,
    recordedSpeciesCount: entries.length,
    emptyTitle: "观察笔记",
    emptyDescription,
    escapeHtml
  });

  elements.detailPanel.innerHTML = renderFieldGuideOverlayView({
    basePanelHtml
  });

  if (shouldClearRecentCatalogued) {
    recentlyCataloguedSpeciesId = null;
  }
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
    collectedCardsCount,
    discoveredSpeciesCount,
    testerStatusText,
    analyticsStatusText,
    escapeHtml
  });
}

function showDetailPanel() {
  elements.detailPanel.hidden = false;
}

function hideDetailPanel() {
  elements.detailPanel.innerHTML = "";
  elements.detailPanel.hidden = true;
}

function setDetailPanelSettlementState(isSettlement) {
  elements.detailPanel.classList.toggle("detail-panel--settlement", isSettlement);
}

function renderSettlementLegacy() {
  setDetailPanelSettlementState(true);
  scheduleSettlementReveal();

  if (!isSettlementRevealed) {
    elements.detailPanel.innerHTML = `
      <section class="settlement-summary settlement-summary--pending" aria-hidden="true"></section>
    `;
    return;
  }

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

function renderSurveySingleChoiceList(questionKey, options, selectedValue) {
  return options.map((option) => {
    const inputId = `${questionKey}_${option.value}`;
    const checked = String(selectedValue) === String(option.value) ? " checked" : "";
    return `
      <label class="survey-choice-card" for="${inputId}">
        <input id="${inputId}" type="radio" name="${questionKey}" value="${option.value}"${checked}>
        <span>${escapeHtml(option.text)}</span>
      </label>
    `;
  }).join("");
}

function renderSurveyMultiChoiceList(questionKey, options, selectedValues) {
  const selectedSet = new Set(Array.isArray(selectedValues) ? selectedValues : []);
  return options.map((option) => {
    const inputId = `${questionKey}_${option.key}`;
    const checked = selectedSet.has(option.key) ? " checked" : "";
    return `
      <label class="survey-choice-card" for="${inputId}">
        <input id="${inputId}" type="checkbox" name="${questionKey}" value="${option.key}"${checked}>
        <span>${escapeHtml(option.text)}</span>
      </label>
    `;
  }).join("");
}

function renderPostSessionSurveySection() {
  const draft = ensurePostSessionSurveyDraft();
  const isSubmitting = postSessionSurveySubmitting === true;
  const submitLabel = isSubmitting ? "正在提交…" : "提交反馈";
  const q2Hint = draft.q2Values.length >= 2 ? "已选满 2 项" : "最多选择 2 项";
  const q2OtherDisabled = draft.q2Values.includes("other") ? "" : " disabled";
  const q3OtherDisabled = draft.q3 === "5" ? "" : " disabled";
  const q10OtherDisabled = draft.q10 === "6" ? "" : " disabled";

  return `
    <section class="post-session-survey">
      <div class="post-session-survey__header">
        <h3>体验问卷</h3>
      </div>
      <div class="post-session-survey__question">
        <h4>Q1. 玩完这次测试后，你有多想继续玩下去？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q1", SURVEY_Q1_OPTIONS, draft.q1)}
        </div>
      </div>
      <div class="post-session-survey__question">
        <h4>Q2. 你最想继续玩的原因是什么？</h4>
        <p class="post-session-survey__hint">${q2Hint}</p>
        <div class="post-session-survey__choices">
          ${renderSurveyMultiChoiceList("survey_q2", SURVEY_Q2_OPTIONS, draft.q2Values)}
        </div>
        <textarea class="post-session-survey__textarea" name="survey_q2_other_text" rows="3" maxlength="${SURVEY_TEXT_LIMITS.q2OtherText}" placeholder="其他原因，可不填"${q2OtherDisabled}>${escapeHtml(draft.q2OtherText)}</textarea>
      </div>
      <div class="post-session-survey__question">
        <h4>Q3. 你对“妹妹”这个角色的感受更接近哪一种？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q3", SURVEY_Q3_OPTIONS, draft.q3)}
        </div>
        <textarea class="post-session-survey__textarea" name="survey_q3_other_text" rows="3" maxlength="${SURVEY_TEXT_LIMITS.q3OtherText}" placeholder="其他感受，可不填"${q3OtherDisabled}>${escapeHtml(draft.q3OtherText)}</textarea>
      </div>
      <div class="post-session-survey__question">
        <h4>Q4. 妹妹的回复是否增强了你继续拍鸟 / 认鸟的动力？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q4", SURVEY_Q4_OPTIONS, draft.q4)}
        </div>
      </div>
      <div class="post-session-survey__question">
        <h4>Q5. 你是否理解当前“姐姐和妹妹”的关系？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q5", SURVEY_Q5_OPTIONS, draft.q5)}
        </div>
      </div>
      <div class="post-session-survey__question">
        <h4>Q6. 当一只“不认识的鸟”被妹妹认出来，并写进笔记 / 图鉴时，你的感受更接近哪一种？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q6", SURVEY_Q6_OPTIONS, draft.q6)}
        </div>
      </div>
      <div class="post-session-survey__question">
        <h4>Q7. 你觉得“先不知道鸟名，再通过妹妹确认”的设计怎么样？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q7", SURVEY_Q7_OPTIONS, draft.q7)}
        </div>
      </div>
      <div class="post-session-survey__question">
        <h4>Q8. 这次拍照玩法给你的感受更接近哪一种？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q8", SURVEY_Q8_OPTIONS, draft.q8)}
        </div>
      </div>
      <div class="post-session-survey__question">
        <h4>Q9. 拍照成功或失败之后，你是否愿意再尝试？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q9", SURVEY_Q9_OPTIONS, draft.q9)}
        </div>
      </div>
      <div class="post-session-survey__question">
        <h4>Q10. 玩完后，你觉得这款游戏更像什么？</h4>
        <div class="post-session-survey__choices">
          ${renderSurveySingleChoiceList("survey_q10", SURVEY_Q10_OPTIONS, draft.q10)}
        </div>
        <textarea class="post-session-survey__textarea" name="survey_q10_other_text" rows="3" maxlength="${SURVEY_TEXT_LIMITS.q10OtherText}" placeholder="其他理解，可不填"${q10OtherDisabled}>${escapeHtml(draft.q10OtherText)}</textarea>
      </div>
      <div class="post-session-survey__question">
        <h4>Q11. 这次测试里，最让你有继续动力的一刻是什么？如果有让你失去动力的时刻，也可以一起写下来。</h4>
        <p class="post-session-survey__hint">可以是一张照片、一次加新、一句妹妹回复、一次拍照成功 / 失败、一个鸟类描述、某个界面、某段剧情，或者其他任何瞬间。</p>
        <textarea class="post-session-survey__textarea" name="survey_q11_motivation_moment" rows="5" maxlength="${SURVEY_TEXT_LIMITS.q11MotivationMoment}" placeholder="按真实感受填写即可，也可以留空">${escapeHtml(draft.q11MotivationMoment)}</textarea>
      </div>
      <div class="post-session-survey__question">
        <h4>Q12. 还有什么想说的？都可以写下来。</h4>
        <textarea class="post-session-survey__textarea" name="survey_q12_anything_else" rows="4" maxlength="${SURVEY_TEXT_LIMITS.q12AnythingElse}" placeholder="可留空">${escapeHtml(draft.q12AnythingElse)}</textarea>
      </div>
      <label class="post-session-survey__interview">
        <input type="checkbox" name="survey_interview_willing"${draft.interviewWilling === true ? " checked" : ""}>
        <span>愿意参加 15 分钟访谈</span>
      </label>
      <p class="post-session-survey__interview-note">如果你愿意，我们之后可能会单独联系你聊聊体验。这个选项完全自愿。</p>
      <div class="post-session-survey__actions">
        <button class="button-major settlement-survey-submit" type="button" data-action="submitSurvey"${isSubmitting ? " disabled" : ""}>${submitLabel}</button>
      </div>
    </section>
  `;
}

function renderSettlementSurveyEntry() {
  if (!isSettlementSurveyEnabled()) {
    return "";
  }

  if (hasCompletedDrivingSurvey()) {
    return "";
  }

  if (postSessionSurveyUiState === "confirm") {
    return `
      <section class="settlement-survey-entry settlement-survey-entry--confirm">
        <h3>填写反馈</h3>
        <p>※本问卷仅可填写一次，可以在对内容有足够体验了之后再进行填写哦</p>
        <div class="settlement-survey-entry__actions">
          <button class="button-major" type="button" data-action="confirmSurveyEntry">继续填写</button>
          <button class="button-secondary" type="button" data-action="dismissSurveyEntry">再玩一会</button>
        </div>
      </section>
    `;
  }

  if (postSessionSurveyUiState === "form") {
    return renderPostSessionSurveySection();
  }

  return "";
}

function renderSettlementContinueAction() {
  const shouldShowSurvey = isSettlementSurveyEnabled() && !hasCompletedDrivingSurvey();
  const isDisabled = settlementRestSubmitting || postSessionSurveySubmitting;
  const buttonLabel = settlementRestSubmitting ? "正在进入下一天…" : "休息到明天清晨";
  const shouldShowSurveyEntryButton = shouldShowSurvey && postSessionSurveyUiState === "idle";
  const shouldShowNightReviewButton = !settlementReviewExpanded;

  return `
    <div class="settlement-actions settlement-summary--revealed">
      ${shouldShowNightReviewButton ? `<button class="button-secondary settlement-night-review-button" type="button" data-action="startNightReview" data-type="system"${isDisabled ? " disabled" : ""}>整理今天的观察</button>` : ""}
      <button class="button-major settlement-action-button" type="button" data-action="rest" data-type="system"${isDisabled ? " disabled" : ""}>${buttonLabel}</button>
      ${shouldShowSurveyEntryButton ? '<button class="button-secondary settlement-survey-entry__button" type="button" data-action="openSurveyEntry">填写反馈</button>' : ""}
    </div>
  `;
}

function renderSettlement() {
  setDetailPanelSettlementState(true);
  scheduleSettlementReveal();

  if (!isSettlementRevealed) {
    elements.detailPanel.innerHTML = `
      <section class="settlement-summary settlement-summary--pending" aria-hidden="true"></section>
    `;
    return;
  }

  if (isSettlementSurveyEnabled() && postSessionSurveyUiState === "form") {
    elements.detailPanel.innerHTML = renderPostSessionSurveySection();
    return;
  }

  if (isSettlementSurveyEnabled() && postSessionSurveyUiState === "confirm") {
    elements.detailPanel.innerHTML = renderSettlementSurveyEntry();
    return;
  }

  if (!isSettlementSummaryExpanded) {
    elements.detailPanel.innerHTML = `
      <section class="settlement-summary settlement-summary--revealed settlement-summary--collapsed settlement-collapsed" data-action="revealSettlement" role="button" tabindex="0">
        <div class="settlement-collapsed-content">
          <h2 class="settlement-collapsed-title">今天的收获</h2>
          <p class="settlement-collapsed-hint">点击展开今天的记录</p>
          <div class="settlement-collapsed-arrow" aria-hidden="true">↓</div>
        </div>
      </section>
      ${renderSettlementSurveyEntry()}
      ${renderSettlementContinueAction()}
    `;
    return;
  }

  const shouldAnimateExpandedSummary = shouldAnimateSettlementSummaryReveal;
  shouldAnimateSettlementSummaryReveal = false;
  const foundSpeciesIds = [...new Set(gameState.photos.map((photo) => photo.speciesId))];
  const battery = getBatteryInfo(gameState);
  const shownNewCardIds = [];
  const photoItems = gameState.photos.map((photo, index) => {
    const cardWasUnlockedBefore = gameState.unlockedCardIdsAtRunStart.includes(photo.card.id);
    const shouldShowNew = !cardWasUnlockedBefore && !shownNewCardIds.includes(photo.card.id);
    const revealDelay = 1500 + Math.min(index * 85, 1100);
    const className = shouldAnimateExpandedSummary
      ? (shouldShowNew
        ? "settlement-photo-card settlement-reveal is-new-card"
        : "settlement-photo-card settlement-reveal")
      : (shouldShowNew
        ? "settlement-photo-card is-new-card"
        : "settlement-photo-card");
    const displayName = getSpeciesNameForSettlement(gameState, photo.speciesId);
    const revealStyle = shouldAnimateExpandedSummary ? ` style="--reveal-delay: ${revealDelay}ms"` : "";

    if (shouldShowNew) {
      shownNewCardIds.push(photo.card.id);
    }

    return `<li class="${className}"${revealStyle}><strong>${displayName}</strong> 路 ${photo.card.title} ${renderRarityBadge(photo.card)}${renderFocusAffixBadge(photo.focusAffix)} ${shouldShowNew ? renderNewBadge() : ""}</li>`;
  });
  const emptyPhotoItem = shouldAnimateExpandedSummary
    ? `<li class="settlement-photo-card settlement-reveal" style="--reveal-delay: 1500ms">这次没有留下照片。</li>`
    : `<li class="settlement-photo-card">这次没有留下照片。</li>`;
  const summaryRevealClass = shouldAnimateExpandedSummary ? " settlement-reveal" : "";
  const summaryRevealDelay = (delay) => (shouldAnimateExpandedSummary ? ` style="--reveal-delay: ${delay}ms"` : "");
  const nightReviewContent = settlementReviewExpanded ? renderNightReviewContent() : "";

  elements.detailPanel.innerHTML = `
    <section class="settlement-summary settlement-summary--revealed">
      <h2 class="${summaryRevealClass.trim()}"${summaryRevealDelay(0)}>今天的收获</h2>
      <p class="${summaryRevealClass.trim()}"${summaryRevealDelay(240)}>照片数量：${battery.used} 张（已用电量 ${battery.usedPct}%）</p>
      <p class="${summaryRevealClass.trim()}"${summaryRevealDelay(480)}>记录到的鸟：${foundSpeciesIds.length}</p>
      <p class="${summaryRevealClass.trim()}"${summaryRevealDelay(720)}>听到的鸟：${gameState.sessionHeardSpeciesIds.length}</p>
      <p class="${summaryRevealClass.trim()}"${summaryRevealDelay(960)}>新增笔记：${shownNewCardIds.length}</p>
      <h3 class="${summaryRevealClass.trim()}"${summaryRevealDelay(1350)}>留下的照片</h3>
      <ul class="settlement-photo-list">${photoItems.join("") || emptyPhotoItem}</ul>
    </section>
    ${renderSettlementSurveyEntry()}
    ${nightReviewContent}
    ${renderSettlementContinueAction()}
  `;
}

function renderNightReviewContent() {
  const summary = getNightReviewSummary(gameState);
  const lines = [
    "晚上整理照片时，你又想起白天听见的那些动静。",
    summary.weatherLabel
      ? `今天最后的天气是：${summary.weatherLabel}。`
      : "天色慢慢暗下来，白天的声音也安静了。",
    summary.photoCount > 0
      ? `今天留下了 ${summary.photoCount} 张照片。${summary.photographedSpeciesCount > 0 ? `里面有 ${summary.photographedSpeciesCount} 种鸟的影子。` : ""}`
      : "今天没有留下照片，但你还是听见了不少动静。",
    summary.sentToSisterCount > 0
      ? `你给妹妹发去了 ${summary.sentToSisterCount} 张照片，不知道她会先注意到哪一张。`
      : "今天还没有给妹妹发照片。有些照片，也许明天再给她看。",
    summary.newCardCount > 0
      ? `有 ${summary.newCardCount} 张照片已经记进了笔记里。`
      : "今天就先到这里。"
  ];

  if (summary.newCardCount > 0) {
    lines.push("今天就先到这里。");
  }

  const lineHtml = lines.map((line, index) => {
    return `<p class="settlement-night-review__line" style="--night-review-delay: ${index * 240}ms">${escapeHtml(line)}</p>`;
  }).join("");

  return `
    <section class="settlement-night-review" aria-label="夜晚整理">
      <div class="settlement-night-review__eyebrow">夜晚整理</div>
      ${lineHtml}
    </section>
  `;
}

function renderPhotoDetail() {
  hideDetailPanel();
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
  `;
}

function renderStartSpotSelectDetail() {
  hideDetailPanel();
}

function renderTesterProfileDetail() {
  const draft = ensureTesterProfileDraft();
  const optionHtml = TESTER_LEVEL_OPTIONS.map((option) => {
    const inputId = `testerLevel_${option.value}`;
    const isSelected = draft.testerLevel === String(option.value);
    return `
      <label class="tester-profile-choice-card" for="${inputId}">
        <input id="${inputId}" type="radio" name="tester_level" value="${option.value}"${isSelected ? " checked" : ""}>
        <span>${escapeHtml(option.text)}</span>
      </label>
    `;
  }).join("");
  const errorHtml = testerProfileValidationMessage
    ? `<p class="tester-profile-form-error" role="alert">${escapeHtml(testerProfileValidationMessage)}</p>`
    : "";
  const isSubmitDisabled = !getTesterLevelOption(Number.parseInt(draft.testerLevel, 10));

  elements.detailPanel.innerHTML = `
    <section class="tester-profile-panel" aria-label="测试者信息">
      <div class="tester-profile-panel__intro">
        <h2>测试前先问两个小问题</h2>
      </div>
      <div class="tester-profile-form">
        <div class="tester-profile-field">
          <span class="tester-profile-field__label">你的观鸟经验更接近哪一种？</span>
          <div class="tester-profile-choice-list">
            ${optionHtml}
          </div>
        </div>
        <label class="tester-profile-field" for="testerIdInput">
          <span class="tester-profile-field__label">怎么称呼您？</span>
          <input
            id="testerIdInput"
            class="tester-profile-input"
            type="text"
            maxlength="${TESTER_ID_MAX_LENGTH}"
            placeholder="称呼 / 姓名 / 代号都可以"
            value="${escapeHtml(draft.testerId)}"
          >
        </label>
        <p class="tester-profile-field__hint">可不填，最多 ${TESTER_ID_MAX_LENGTH} 个字符。</p>
        ${errorHtml}
        <button class="button-major tester-profile-submit" type="button" data-action="testerProfileSubmit"${isSubmitDisabled ? " disabled" : ""}>开始测试</button>
      </div>
    </section>
  `;
}

function renderDefaultDetail() {
  hideDetailPanel();
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

  let visibleCardIds = getVisibleLiyaReplyCardIds(historyContainer);
  if (visibleCardIds.length <= 0) {
    liyaAutoReadSkipOnceCardIds.clear();
    return;
  }

  if (liyaAutoReadSkipOnceCardIds.size > 0) {
    visibleCardIds = visibleCardIds.filter((cardId) => {
      if (!liyaAutoReadSkipOnceCardIds.has(cardId)) {
        return true;
      }
      liyaAutoReadSkipOnceCardIds.delete(cardId);
      return false;
    });
    if (liyaAutoReadSkipOnceCardIds.size > 0) {
      liyaAutoReadSkipOnceCardIds.clear();
    }
  }
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
  renderPreservingMessageScroll(captureChatScrollState());
  isApplyingVisibleLiyaAutoRead = false;
}

function clearLiyaLineAnimationTimers() {
  clearLiyaLineAnimationTimersUI();
  activeLiyaReplyAnimationKey = null;
  liyaAutoReadSkipOnceCardIds.clear();
}

function clearPendingChatScrollRestoreState() {
  pendingChatScrollRestoreState = null;
}

function captureChatScrollState() {
  return captureChatScrollStateUI(elements.detailPanel);
}

function restoreChatScrollState(historyEl, previousState) {
  restoreChatScrollStateUI(historyEl, previousState);
}

function renderPreservingMessageScroll(previousState = null) {
  const currentThreadId = getMessageThreadIdByView(messageView);
  if (activeOverlay === "messages" && currentThreadId) {
    const nextState = previousState || captureChatScrollState();
    if (
      nextState
      && (
        !pendingChatScrollRestoreState
        || pendingChatScrollRestoreState.threadId !== currentThreadId
      )
    ) {
      pendingChatScrollRestoreState = nextState;
    }
  }
  render();
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
          isRead: !hasUnreadLiyaPhotoReply(entry),
          queueCreatedAt: toSafeTimestamp(queueItem && queueItem.createdAt),
          queueDueAt: toSafeTimestamp(queueItem && queueItem.dueAt),
          queueMessageId: queuedMessageId || "",
          queueCardId: entry.cardId || ""
        }]
      : [];

    return [photoMessage, textMessage, ...sisterReply];
  });

  return sortSisterPhotoMessages(messages);
}

function handleLiyaMessageLinesComplete(message, beforeRenderScrollState = null, options = {}) {
  if (!message || !message.cardId) {
    return;
  }

  const shouldRender = options.skipRender !== true;
  if (shouldRender) {
    liyaAutoReadSkipOnceCardIds.add(message.cardId);
  }
  const now = Date.now();
  const targetCardIds = [message.cardId];
  const beforeByCardId = getQueueSnapshotsByCardIds(gameState.fieldGuide, targetCardIds);
  const result = markDueSisterRepliesReadByCardIds(gameState.fieldGuide, targetCardIds, now);
  if (result && result.hasChanged === true) {
    gameState.fieldGuide = result.guide;
    syncViewedEventsFromReadTransitions(gameState.fieldGuide, targetCardIds, beforeByCardId, now);
  }
  if (shouldRender) {
    renderPreservingMessageScroll(beforeRenderScrollState || captureChatScrollState());
  }
}

function handleLiyaReplyAnimationPlaybackComplete(message, beforeRenderScrollState = null, options = {}) {
  const completedKey = getLiyaReplyAnimationKey(message);
  if (activeLiyaReplyAnimationKey && completedKey && activeLiyaReplyAnimationKey === completedKey) {
    activeLiyaReplyAnimationKey = null;
  }

  if (isLiyaThreadCurrentlyOpen()) {
    handleLiyaMessageLinesComplete(message, beforeRenderScrollState, {
      skipRender: options.skipCompletionRender === true
    });
  }

  if (liyaReplyChainTimerId) {
    window.clearTimeout(liyaReplyChainTimerId);
    liyaReplyChainTimerId = null;
  }
  liyaReplyChainPauseActive = true;
  liyaReplyChainTimerId = window.setTimeout(() => {
    liyaReplyChainTimerId = null;
    liyaReplyChainPauseActive = false;
    startDueLiyaReplyLineAnimations(Date.now());
  }, LIYA_REPLY_CHAIN_GAP_MS);
  scheduleSisterReplyRender();
}

function getLiyaReplyAnimationKey(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return "";
  }

  const cardId = typeof message.cardId === "string" ? message.cardId : "";
  const messageId = typeof message.id === "string" ? message.id : "";
  const queueDueAt = toSafeTimestamp(message.queueDueAt);
  const dueAt = Number.isFinite(queueDueAt) ? queueDueAt : toSafeTimestamp(message.time);
  return `${cardId}:${messageId}:${Number.isFinite(dueAt) ? dueAt : ""}`;
}

function compareLiyaReplyQueueOrder(left, right) {
  const leftCreatedAt = Number.isFinite(toSafeTimestamp(left && left.queueCreatedAt))
    ? toSafeTimestamp(left.queueCreatedAt)
    : 0;
  const rightCreatedAt = Number.isFinite(toSafeTimestamp(right && right.queueCreatedAt))
    ? toSafeTimestamp(right.queueCreatedAt)
    : 0;
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  const leftDueAt = Number.isFinite(toSafeTimestamp(left && left.queueDueAt))
    ? toSafeTimestamp(left.queueDueAt)
    : Number.MAX_SAFE_INTEGER;
  const rightDueAt = Number.isFinite(toSafeTimestamp(right && right.queueDueAt))
    ? toSafeTimestamp(right.queueDueAt)
    : Number.MAX_SAFE_INTEGER;
  if (leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  const leftCardId = typeof (left && left.cardId) === "string" ? left.cardId : "";
  const rightCardId = typeof (right && right.cardId) === "string" ? right.cardId : "";
  if (leftCardId < rightCardId) {
    return -1;
  }
  if (leftCardId > rightCardId) {
    return 1;
  }

  const leftMessageId = typeof (left && left.id) === "string" ? left.id : "";
  const rightMessageId = typeof (right && right.id) === "string" ? right.id : "";
  if (leftMessageId < rightMessageId) {
    return -1;
  }
  if (leftMessageId > rightMessageId) {
    return 1;
  }
  return 0;
}

function startDueLiyaReplyLineAnimations(now = Date.now()) {
  if (activeLiyaReplyAnimationKey) {
    return false;
  }

  if (isLiyaThreadCurrentlyOpen()) {
    return false;
  }

  const sisterMessages = getSentSisterPhotoMessages();
  const dueMessages = sisterMessages
    .filter((message) => {
      if (
        !message
        || message.sender !== "sister"
        || message.source !== "photo_reply"
        || message.speaker !== "liya"
        || message.isRead !== false
        || !Array.isArray(message.lines)
        || message.lines.length <= 1
      ) {
        return false;
      }

      const dueAt = Number.isFinite(toSafeTimestamp(message.queueDueAt))
        ? toSafeTimestamp(message.queueDueAt)
        : toSafeTimestamp(message.time);
      return Number.isFinite(dueAt) ? dueAt <= now : true;
    })
    .sort(compareLiyaReplyQueueOrder);

  for (let index = 0; index < dueMessages.length; index += 1) {
    const message = dueMessages[index];
    if (!message) {
      continue;
    }

    const messageKey = getLiyaReplyAnimationKey(message);
    const started = startLiyaMessageLineAnimationUI(message, {
      lines: message.lines,
      onProgress: () => {
        if (isLiyaThreadCurrentlyOpen()) {
          renderPreservingMessageScroll(captureChatScrollState());
          return;
        }
        render();
      },
      onComplete: ({ message: completedMessage }) => {
        handleLiyaReplyAnimationPlaybackComplete(completedMessage || message, captureChatScrollState());
      }
    });

    if (started) {
      if (messageKey) {
        activeLiyaReplyAnimationKey = messageKey;
      }
      return true;
    }
  }

  return false;
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
    const now = Date.now();
    syncDueLiyaAnalyticsEvents(now);
    startDueLiyaReplyLineAnimations(now);
    renderPreservingMessageScroll(captureChatScrollState());
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
      displayName: (getInitialThreadConfig("liya") && getInitialThreadConfig("liya").displayName) || "妹宝（小鸟大王）",
      avatarText: (getInitialThreadConfig("liya") && getInitialThreadConfig("liya").avatarText) || "妹",
      messages: sisterMessages,
      unread: hasUnreadLiyaMessages(gameState.fieldGuide) || hasUnreadInitialMessages("liya", gameState.fieldGuide)
    },
    mother: {
      threadId: "mother",
      action: "openMomChat",
      displayName: (getInitialThreadConfig("mother") && getInitialThreadConfig("mother").displayName) || "妈妈 5.12",
      avatarText: (getInitialThreadConfig("mother") && getInitialThreadConfig("mother").avatarText) || "妈",
      messages: momMessages,
      unread: hasUnreadInitialMessages("mother", gameState.fieldGuide)
    },
    miaomiao: {
      threadId: "miaomiao",
      action: "openMiaomiaoChat",
      displayName: (getInitialThreadConfig("miaomiao") && getInitialThreadConfig("miaomiao").displayName) || "小苗 6.3",
      avatarText: (getInitialThreadConfig("miaomiao") && getInitialThreadConfig("miaomiao").avatarText) || "苗",
      messages: miaomiaoMessages,
      unread: hasUnreadInitialMessages("miaomiao", gameState.fieldGuide)
    }
  };
  const threadOrder = getMessageThreadIds();
  const activeThreadId = getMessageThreadIdByView(messageView);
  const renderedChatThreadId = activeThreadId || lastOpenedMessageThreadId || "";
  const unreadDividerMessageId = activeThreadId
    ? getUnreadDividerMessageIdForThread(activeThreadId)
    : "";
  const canStartLiyaMessageLineAnimation = ({ message }) => {
    const key = getLiyaReplyAnimationKey(message);
    if (liyaReplyChainPauseActive) {
      return false;
    }
    return !activeLiyaReplyAnimationKey || !key || activeLiyaReplyAnimationKey === key;
  };
  const onLiyaMessageLineAnimationStarted = ({ message }) => {
    const key = getLiyaReplyAnimationKey(message);
    if (key) {
      activeLiyaReplyAnimationKey = key;
    }
  };
  renderMessagePanelUI({
    detailPanelEl: elements.detailPanel,
    pendingChatScrollRestoreState,
    shouldAutoScrollChatHistory,
    threadStateById,
    threadOrder,
    activeThreadId,
    renderedChatThreadId,
    unreadDividerMessageId,
    escapeHtml,
    formatMessageTime,
    renderFieldGuideDetailPolaroid,
    isLiyaThreadOpen: isLiyaThreadCurrentlyOpen,
    onRequestRender: (previousState = null) => {
      renderPreservingMessageScroll(previousState || captureChatScrollState());
    },
    onLiyaMessageFinalProgress: ({ message, beforeRenderScrollState }) => {
      handleLiyaMessageLinesComplete(message, beforeRenderScrollState);
    },
    canStartLiyaMessageLineAnimation,
    onLiyaMessageLineAnimationStarted,
    onLiyaMessageLinesComplete: ({ message, beforeRenderScrollState, completionHandledInProgress }) => {
      handleLiyaReplyAnimationPlaybackComplete(message, beforeRenderScrollState, {
        skipCompletionRender: completionHandledInProgress === true
      });
    },
    onAfterChatRendered: (historyEl) => {
      const shouldMarkInitialRead = activeThreadId
        && pendingInitialThreadReadAfterOpenId
        && activeThreadId === pendingInitialThreadReadAfterOpenId;
      if (shouldMarkInitialRead) {
        const targetThreadId = pendingInitialThreadReadAfterOpenId;
        const beforeRenderScrollState = captureChatScrollState();
        pendingInitialThreadReadAfterOpenId = null;
        window.requestAnimationFrame(() => {
          if (activeOverlay !== "messages" || getMessageThreadIdByView(messageView) !== targetThreadId) {
            return;
          }
          if (markInitialThreadMessagesRead(targetThreadId)) {
            renderPreservingMessageScroll(beforeRenderScrollState);
          }
        });
      }
      autoMarkVisibleLiyaRepliesRead(historyEl);
    },
    onChatHistoryScroll: autoMarkVisibleLiyaRepliesRead,
    consumeAutoScrollChatHistory: () => {
      shouldAutoScrollChatHistory = false;
    },
    consumePendingChatScrollRestoreState: () => {
      clearPendingChatScrollRestoreState();
    }
  });
}

function getBottomNavActiveOverlay() {
  if (activeOverlay === "resetSaveConfirm") {
    return "fieldGuide";
  }
  return activeOverlay || "";
}

function isToolOverlayVisible() {
  return activeOverlay === "messages" || activeOverlay === "fieldGuide" || activeOverlay === "resetSaveConfirm";
}

function getToolOverlayOptions() {
  const currentOverlayType = getBottomNavActiveOverlay() || null;
  const isEntering = Boolean(currentOverlayType && currentOverlayType !== lastRenderedToolOverlayType);

  if (activeOverlay === "messages") {
    return {
      type: "messages",
      title: "消息",
      subtitle: "和重要的人保持联系",
      ariaLabel: "消息面板",
      hideHeader: true,
      flushChrome: true,
      isEntering
    };
  }

  if (activeOverlay === "fieldGuide" || activeOverlay === "resetSaveConfirm") {
    return {
      type: "fieldGuide",
      title: activeOverlay === "resetSaveConfirm" ? "笔记" : "观察笔记",
      subtitle: activeOverlay === "resetSaveConfirm" ? "确认重置前再检查一次" : "翻看今天遇见过的鸟",
      ariaLabel: activeOverlay === "resetSaveConfirm" ? "笔记重置确认面板" : "观察笔记面板",
      hideHeader: true,
      flushChrome: true,
      isEntering
    };
  }

  return null;
}

function renderBottomNav() {
  elements.bottomNavRoot.innerHTML = renderBottomNavUI({
    activeOverlay: getBottomNavActiveOverlay(),
    hasUnreadMessages: getUnreadMessagesCount(gameState.fieldGuide) > 0,
    unreadMessageCount: getUnreadMessagesCount(gameState.fieldGuide),
    hasNewFieldGuideContent: hasAnyNewCollectedCard(gameState.fieldGuide)
  });
}

function syncDetailPanelPosition() {
  const overlayOptions = getToolOverlayOptions();

  if (!overlayOptions) {
    elements.toolOverlayRoot.innerHTML = "";
    if (elements.detailPanel.parentElement !== elements.detailLayout) {
      elements.detailLayout.insertBefore(elements.detailPanel, elements.logPanel);
    }
    if (elements.resetActions.parentElement !== document.body) {
      elements.detailLayout.after(elements.resetActions);
    }
    document.body.classList.remove("has-tool-overlay-open");
    if (elements.page) {
      elements.page.classList.remove("is-under-tool-overlay");
    }
    lastRenderedToolOverlayType = null;
    return;
  }

  elements.toolOverlayRoot.innerHTML = renderToolOverlayShellUI(overlayOptions);
  const overlayContent = elements.toolOverlayRoot.querySelector("[data-tool-overlay-content]");

  if (overlayContent) {
    overlayContent.append(elements.detailPanel);
    overlayContent.append(elements.resetActions);
  }

  document.body.classList.add("has-tool-overlay-open");
  if (elements.page) {
    elements.page.classList.add("is-under-tool-overlay");
  }
  lastRenderedToolOverlayType = overlayOptions.type;
}

function renderDetailPanel() {
  syncDetailPanelPosition();
  showDetailPanel();
  const isResetSaveConfirmOpen = activeOverlay === "resetSaveConfirm";
  const isTesterProfilePromptVisible = gameState.mode === "START" && shouldShowTesterProfilePrompt();
  const isSettlementDetailVisible = !activeOverlay && gameState.mode === "SETTLEMENT";
  if (activeOverlay !== "messages") {
    clearPendingChatScrollRestoreState();
  }
  elements.detailPanel.classList.toggle("is-note-folder-shell", activeOverlay === "fieldGuide" || isResetSaveConfirmOpen || (gameState.mode === "FIELD_GUIDE" && activeOverlay !== "messages"));
  elements.detailPanel.classList.toggle("is-inline-panel", activeOverlay === "messages" || activeOverlay === "fieldGuide" || isResetSaveConfirmOpen);
  elements.detailPanel.classList.toggle("is-tester-profile-panel", isTesterProfilePromptVisible && !activeOverlay);
  elements.detailPanel.classList.toggle("is-tool-overlay-panel", isToolOverlayVisible());
  setDetailPanelSettlementState(isSettlementDetailVisible);

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

  if (gameState.mode === "START" && shouldShowTesterProfilePrompt()) {
    renderTesterProfileDetail();
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

  if (gameState.mode === "SETTLEMENT") {
    classNames.push("is-settlement-reveal");
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

function splitEventTextByParagraph(text) {
  const paragraphs = String(text || "")
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [String(text || "")];
}

function isOpeningMonologueEvent() {
  return gameState.mode === "START"
    && !gameState.eventHtml
    && gameState.eventText === OPENING_MONOLOGUE_TEXT;
}

function renderFirstEncounterEventText(shouldAnimate, eventTextRevealKey) {
  if (!shouldAnimate && elements.eventText.dataset.revealKey === eventTextRevealKey) {
    return;
  }

  const segments = splitEventTextByChinesePeriod(gameState.eventText);
  const emphasisTerms = getEventTextEmphasisTerms();
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
    paragraph.innerHTML = renderTextWithEmphasis(segment, emphasisTerms);
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

function renderOpeningMonologueEventText(shouldAnimate, eventTextRevealKey) {
  if (!shouldAnimate && elements.eventText.dataset.revealKey === eventTextRevealKey) {
    return;
  }

  const segments = splitEventTextByParagraph(gameState.eventText);
  const emphasisTerms = getEventTextEmphasisTerms();
  const shouldRevealSegments = shouldAnimate && !hasPlayedOpeningMonologueReveal && !prefersReducedMotion();

  elements.eventText.dataset.revealKey = eventTextRevealKey;
  elements.eventText.textContent = "";

  segments.forEach((segment, index) => {
    const line = document.createElement("span");
    const segmentClassNames = ["event-text-segment", "event-text-segment--opening"];
    if (shouldRevealSegments) {
      segmentClassNames.push("is-revealing");
    }
    line.className = segmentClassNames.join(" ");
    line.innerHTML = renderTextWithEmphasis(segment, emphasisTerms);
    elements.eventText.append(line);

    if (shouldRevealSegments) {
      line.style.setProperty("--segment-delay", `${index * OPENING_MONOLOGUE_SEGMENT_DELAY_MS}ms`);
      line.style.setProperty("--segment-duration", `${OPENING_MONOLOGUE_SEGMENT_REVEAL_MS}ms`);
    }
  });

  if (shouldRevealSegments) {
    hasPlayedOpeningMonologueReveal = true;
  }
}

function renderEventText(shouldAnimate, eventTextRevealKey) {
  const eventBox = elements.eventText.closest(".event-box");
  if (eventBox) {
    eventBox.classList.toggle("is-settlement-event", gameState.mode === "SETTLEMENT");
  }

  elements.eventText.className = getEventTextClassName();

  if (isOpeningMonologueEvent()) {
    elements.eventText.classList.add("is-opening-monologue");
    renderOpeningMonologueEventText(shouldAnimate, eventTextRevealKey);
    return;
  }

  if (gameState.mode === "FIRST_ENCOUNTER" && !gameState.eventHtml) {
    renderFirstEncounterEventText(shouldAnimate, eventTextRevealKey);
    return;
  }

  delete elements.eventText.dataset.revealKey;
  const resultSharedNote = getResultPreviouslySharedNote();
  if (gameState.eventHtml) {
    elements.eventText.innerHTML = resultSharedNote
      ? `${gameState.eventHtml}<br><br>${escapeHtml(resultSharedNote)}`
      : gameState.eventHtml;
  } else {
    const eventText = resultSharedNote
      ? `${gameState.eventText}\n\n${resultSharedNote}`
      : gameState.eventText;
    elements.eventText.innerHTML = renderTextWithEmphasis(eventText, getEventTextEmphasisTerms());
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
  syncObservationMapRotationState(gameState.facingDirection);
  if (gameState.mode !== "PHOTO") {
    clearActivePolaroid();
  }

  renderGameTitle();
  elements.turn.innerHTML = renderTimeAndBatteryStatus(gameState);
  renderStatusBlocks(currentSpot, mapInfo);
  elements.photoTiming.innerHTML = isCaptureTopUiActive()
    ? renderPhotoTimingStatus()
    : renderObservationMapWindowOnly();
  const eventTextRevealKey = getEventTextRevealKey();
  const shouldRevealEventText = eventTextRevealKey !== lastEventTextRevealKey;

  if (shouldRevealEventText) {
    lastEventTextRevealKey = eventTextRevealKey;
  }
  renderEventText(shouldRevealEventText, eventTextRevealKey);

  renderActions();
  renderResetActions();
  renderDetailPanel();
  syncObservationMapPresentation();
  renderBottomNav();
  renderLogs();
  applyRenderedFocusFrameSizes();
  setupFocusAnimationIfNeeded();
  scheduleSisterReplyRender();
}

function showFieldGuide() {
  if (gameState.mode === "SETTLEMENT") {
    isSettlementRevealed = false;
    isSettlementSummaryExpanded = false;
  }

  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
  gameState.previousMode = gameState.mode;
  gameState.mode = "FIELD_GUIDE";
  gameState.fieldGuide = loadFieldGuide();
  gameState.eventText = "我翻开笔记，查看亲眼见过的记录。";
}

function returnFromFieldGuide() {
  if (gameState.mode === "SETTLEMENT" || gameState.previousMode === "SETTLEMENT") {
    isSettlementRevealed = false;
    isSettlementSummaryExpanded = false;
  }

  gameState.mode = gameState.previousMode || "START";
  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
  delete gameState.previousMode;
}

function createRestStartState() {
  const nextState = createDefaultGameState();
  weatherSystem.initForSession(nextState);
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

  if (liyaReplyChainTimerId) {
    window.clearTimeout(liyaReplyChainTimerId);
    liyaReplyChainTimerId = null;
  }
  liyaReplyChainPauseActive = false;

  if (autoCatalogueCompletionTimerId) {
    window.clearTimeout(autoCatalogueCompletionTimerId);
    autoCatalogueCompletionTimerId = null;
  }

  if (settlementRevealTimerId) {
    window.clearTimeout(settlementRevealTimerId);
    settlementRevealTimerId = null;
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
  isCameraRaisedForTopUi = false;

  isSettlementRevealed = false;
  isSettlementSummaryExpanded = false;
  hasPlayedSettlementSummaryReveal = false;
  shouldAnimateSettlementSummaryReveal = false;
  activeOverlay = null;
  inlinePanelJustOpened = null;
  fieldGuideSpeciesIndex = 0;
  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
  activeMessagePreview = null;
  messageView = "list";
  clearMessageUnreadDividerSnapshot();
  shouldAutoScrollChatHistory = false;
  pendingChatScrollRestoreState = null;
  isApplyingVisibleLiyaAutoRead = false;
  recentlyCataloguedSpeciesId = null;
  recentlyIdentifiedCardId = null;
  lastEventTextRevealKey = "";
  hasPlayedOpeningMonologueReveal = false;
  settlementReviewExpanded = false;
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
  resetObservationDayIndex();
  resetTransientUiState();
  clearEventHintState();
  resetAnalyticsSessionRuntime();
  resetSaveReturnOverlay = null;
  gameState = createRestStartState();
  gameState.fieldGuide = loadFieldGuide();
  hasShownOpeningMonologue = false;
  analyticsOpeningNarrativeSeenAt = null;
  analyticsOpeningNarrativeCompleted = false;
  analyticsOpeningNarrativeActive = false;
  analyticsPreparedSessionForStart = false;
  clearTelemetrySurvey();
  resetPostSessionSurveyState();
  applyStartModeNarration();
}

function submitTesterProfile() {
  const draft = ensureTesterProfileDraft();
  const testerLevel = Number.parseInt(draft.testerLevel, 10);
  const selectedOption = getTesterLevelOption(testerLevel);

  if (!selectedOption) {
    testerProfileValidationMessage = "请先选择一项观鸟经验。";
    render();
    return;
  }

  saveTesterProfileAndContinue({
    tester_id: draft.testerId,
    tester_level: selectedOption.value,
    tester_level_text: selectedOption.text
  });
  render();
}

async function continueToNextDay() {
  if (settlementRestSubmitting) {
    return;
  }

  settlementRestSubmitting = true;
  render();

  try {
    if (postSessionSurveyResolved !== true) {
      await flushSettlementSessionWithoutSurvey();
      postSessionSurveyResolved = true;
    }
    clearLiyaLineAnimationTimers();
    if (settlementRevealTimerId) {
      window.clearTimeout(settlementRevealTimerId);
      settlementRevealTimerId = null;
    }
    isSettlementRevealed = false;
    isSettlementSummaryExpanded = false;
    settlementReviewExpanded = false;
    hasPlayedSettlementSummaryReveal = false;
    shouldAnimateSettlementSummaryReveal = false;
    activeOverlay = null;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    isCameraRaisedForTopUi = false;
    saveObservationDayIndex(observationDayIndex + 1);
    clearTelemetrySurvey();
    resetPostSessionSurveyState();
    clearEventHintState();
    gameState = createRestStartState();
    applyStartModeNarration({ fromRest: true });
  } finally {
    settlementRestSubmitting = false;
    render();
  }
}

function startNightReview() {
  if (gameState.mode !== "SETTLEMENT") {
    return;
  }

  if (settlementRevealTimerId) {
    window.clearTimeout(settlementRevealTimerId);
    settlementRevealTimerId = null;
  }

  settlementReviewExpanded = true;
}

function randomInt(min, max) {
  const safeMin = Math.ceil(Number(min) || 0);
  const safeMax = Math.floor(Number(max) || safeMin);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function getExploreTransitionText(state, action) {
  if (action === "turnLeft") {
    return "你缓缓转向左侧……";
  }

  if (action === "turnRight") {
    return "你缓缓转向右侧……";
  }

  if (action === "observe") {
    const directionName = getSurroundingSpotMap(state).facingName;
    return directionName
      ? `你驻足凝视，细细打量${directionName}……`
      : "你驻足凝视，细细打量眼前的环境……";
  }

  return "";
}

function getRitualDelay(action, state) {
  if (action === "turnLeft" || action === "turnRight") {
    return randomInt(...RITUAL_DELAY_RANGES.turn);
  }

  const resultType = state && state.lastObserveResultType;
  const range = RITUAL_DELAY_RANGES[resultType] || RITUAL_DELAY_RANGES.empty;
  return randomInt(...range);
}

function setActionTransitioning(value) {
  isActionTransitioning = value === true;
  elements.actionPanel.classList.toggle("is-transitioning", isActionTransitioning);
  elements.actionPanel.querySelectorAll("button").forEach((button) => {
    button.disabled = isActionTransitioning;
  });
}

function finishExploreRitualAction(previousMode, action) {
  actionTransitionTimerId = null;
  setActionTransitioning(false);
  syncDueLiyaAnalyticsEvents(Date.now());

  if (!analyticsSessionEnded && isAnalyticsString(gameState.currentSpotId)) {
    analyticsSpotsVisitedInSession.add(gameState.currentSpotId);
  }

  if (previousMode !== "SETTLEMENT" && gameState.mode === "SETTLEMENT") {
    if (settlementRevealTimerId) {
      window.clearTimeout(settlementRevealTimerId);
      settlementRevealTimerId = null;
    }
    isSettlementRevealed = false;
    isSettlementSummaryExpanded = false;
    settlementReviewExpanded = false;
    hasPlayedSettlementSummaryReveal = false;
    shouldAnimateSettlementSummaryReveal = false;
    finishAnalyticsSession("explore", action);
  }

  render();
}

function handleExploreRitualAction(action) {
  if (isActionTransitioning || !RITUAL_EXPLORE_ACTIONS.has(action)) {
    return true;
  }

  const previousMode = gameState.mode;
  const transitionText = getExploreTransitionText(gameState, action);
  gameState.eventHtml = "";
  gameState = handleExploreAction(gameState, action);
  const delay = getRitualDelay(action, gameState);

  setActionTransitioning(true);
  if (transitionText) {
    delete elements.eventText.dataset.revealKey;
    elements.eventText.textContent = transitionText;
  }

  actionTransitionTimerId = window.setTimeout(() => {
    finishExploreRitualAction(previousMode, action);
  }, delay);
  return true;
}

function handleSystemAction(action) {
  if (action === "observe") {
    handleBottomNavAction("observe", "system");
    return;
  }

  if (action === "start") {
    if (shouldShowTesterProfilePrompt()) {
      return;
    }
    if (gameState.mode === "START" && gameState.eventText === OPENING_MONOLOGUE_TEXT) {
      trackOpeningNarrativeCompleted({ nextAction: "start" });
    }
    clearLiyaLineAnimationTimers();
    if (settlementRevealTimerId) {
      window.clearTimeout(settlementRevealTimerId);
      settlementRevealTimerId = null;
    }
    isSettlementRevealed = false;
    isSettlementSummaryExpanded = false;
    settlementReviewExpanded = false;
    hasPlayedSettlementSummaryReveal = false;
    shouldAnimateSettlementSummaryReveal = false;
    activeOverlay = null;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    isCameraRaisedForTopUi = false;
    clearEventHintState();
    const defaultStartSpot = getDefaultStartSpotChoice();
    if (defaultStartSpot) {
      gameState = startGameAtSpot(defaultStartSpot.id, gameState);
      beginAnalyticsSession(defaultStartSpot.id);
    } else {
      gameState = startGame(gameState);
    }
  }

  if (action === "rest") {
    return;
  }

  if (action === "fieldGuide") {
    handleBottomNavAction("fieldGuide", "fieldGuide");
    return;
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
    if (settlementRevealTimerId) {
      window.clearTimeout(settlementRevealTimerId);
      settlementRevealTimerId = null;
    }
    isSettlementRevealed = false;
    isSettlementSummaryExpanded = false;
    settlementReviewExpanded = false;
    hasPlayedSettlementSummaryReveal = false;
    shouldAnimateSettlementSummaryReveal = false;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    isCameraRaisedForTopUi = false;
    gameState = endGame(gameState, "retreat");
  }
}

function revealSettlement() {
  if (gameState.mode !== "SETTLEMENT" || isSettlementRevealed) {
    return;
  }

  if (settlementRevealTimerId) {
    window.clearTimeout(settlementRevealTimerId);
    settlementRevealTimerId = null;
  }

  isSettlementRevealed = true;
  render();
}

function expandSettlementSummary() {
  if (gameState.mode !== "SETTLEMENT" || !isSettlementRevealed || isSettlementSummaryExpanded) {
    return;
  }

  isSettlementSummaryExpanded = true;
  shouldAnimateSettlementSummaryReveal = !hasPlayedSettlementSummaryReveal;
  hasPlayedSettlementSummaryReveal = true;
  render();
}

function scheduleSettlementReveal() {
  if (gameState.mode !== "SETTLEMENT" || isSettlementRevealed || settlementRevealTimerId) {
    return;
  }

  settlementRevealTimerId = window.setTimeout(() => {
    settlementRevealTimerId = null;
    revealSettlement();
  }, 500);
}

function turnFieldGuidePage(direction) {
  const journalSpecies = getJournalSpecies(gameState.fieldGuide);
  const isFieldGuideVisible = gameState.mode === "FIELD_GUIDE" || activeOverlay === "fieldGuide";

  if (!isFieldGuideVisible || journalSpecies.length <= 1) {
    return;
  }

  fieldGuideSpeciesIndex = (fieldGuideSpeciesIndex + direction + journalSpecies.length) % journalSpecies.length;
  fieldGuideDetailCardId = null;
  fieldGuideDetailSnapshotIndex = 0;
  render();
}

if (elements.mode) {
  elements.mode.addEventListener("animationend", handleEventStatusAnimationEnd);
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
    clearPendingChatScrollRestoreState();
    messageView = "list";
    render();
    return;
  }

  const messageCloseButton = event.target.closest(".message-close-button, .message-back-button");

  if (messageCloseButton) {
    closeAnalyticsChatSession();
    clearLiyaLineAnimationTimers();
    clearPendingChatScrollRestoreState();
    clearMessageUnreadDividerSnapshot();
    activeOverlay = null;
    messageView = "list";
    render();
    return;
  }

  const nightReviewButton = event.target.closest(".settlement-night-review-button");
  if (nightReviewButton && nightReviewButton.dataset.action === "startNightReview") {
    startNightReview();
    render();
    return;
  }

  const settlementActionButton = event.target.closest(".settlement-action-button");
  if (settlementActionButton && settlementActionButton.dataset.action === "rest") {
    void continueToNextDay();
    return;
  }

  const testerProfileButton = event.target.closest(".tester-profile-submit");
  if (testerProfileButton && testerProfileButton.dataset.action === "testerProfileSubmit") {
    submitTesterProfile();
    return;
  }

  const settlementSurveyEntryButton = event.target.closest(".settlement-survey-entry__button, .settlement-survey-entry .button-major, .settlement-survey-entry .button-secondary");
  if (settlementSurveyEntryButton && settlementSurveyEntryButton.dataset.action === "openSurveyEntry") {
    if (!isSettlementSurveyEnabled()) {
      return;
    }
    postSessionSurveyUiState = "confirm";
    render();
    return;
  }

  if (settlementSurveyEntryButton && settlementSurveyEntryButton.dataset.action === "confirmSurveyEntry") {
    if (!isSettlementSurveyEnabled()) {
      return;
    }
    postSessionSurveyUiState = "form";
    render();
    return;
  }

  if (settlementSurveyEntryButton && settlementSurveyEntryButton.dataset.action === "dismissSurveyEntry") {
    if (!isSettlementSurveyEnabled()) {
      return;
    }
    postSessionSurveyUiState = "idle";
    render();
    return;
  }

  const settlementSurveyButton = event.target.closest(".settlement-survey-submit, .settlement-survey-cancel");
  if (settlementSurveyButton && settlementSurveyButton.dataset.action === "submitSurvey") {
    if (!isSettlementSurveyEnabled()) {
      return;
    }
    void submitPostSessionSurvey();
    render();
    return;
  }

  if (settlementSurveyButton && settlementSurveyButton.dataset.action === "cancelSurvey") {
    if (!isSettlementSurveyEnabled()) {
      return;
    }
    void skipPostSessionSurvey();
    render();
    return;
  }

  const fieldGuideClearButton = event.target.closest(".field-guide-clear-button");

  if (fieldGuideClearButton) {
    handleSystemAction(fieldGuideClearButton.dataset.action);
    render();
    return;
  }

  const fieldGuideCloseBottomButton = event.target.closest(".field-guide-close-bottom");

  if (fieldGuideCloseBottomButton) {
    handleSystemAction(fieldGuideCloseBottomButton.dataset.action);
    render();
    return;
  }

  const resetSaveConfirmButton = event.target.closest(".reset-save-confirm__cancel, .reset-save-confirm__confirm");

  if (resetSaveConfirmButton) {
    handleSystemAction(resetSaveConfirmButton.dataset.action);
    render();
    return;
  }

  const detailDismissButton = event.target.closest(".field-guide-card-modal-scrim, .field-guide-detail-back");

  if (detailDismissButton) {
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
    if (cardId && !isCollectedCardSentToSister(gameState.fieldGuide, cardId)) {
      sendCollectedCardEntryToSister(cardId);
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

  expandSettlementSummary();
});

elements.resetActions.addEventListener("click", (event) => {
  const fieldGuideClearButton = event.target.closest(".field-guide-clear-button");

  if (!fieldGuideClearButton) {
    return;
  }

  handleSystemAction(fieldGuideClearButton.dataset.action);
  render();
});

elements.detailPanel.addEventListener("keydown", (event) => {
  const collapsedSettlement = event.target.closest(".settlement-collapsed");

  if (!collapsedSettlement || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  event.preventDefault();
  expandSettlementSummary();
});

function closeMessageOverlay() {
  closeAnalyticsChatSession();
  clearLiyaLineAnimationTimers();
  clearPendingChatScrollRestoreState();
  clearMessageUnreadDividerSnapshot();
  activeOverlay = null;
  activeMessagePreview = null;
  messageView = "list";
  lastOpenedMessageThreadId = "";
}

function handleBottomNavAction(action, source = "bottomNav") {
  if (action === "observe") {
    if (activeOverlay === "messages") {
      closeMessageOverlay();
    } else if (isToolOverlayVisible()) {
      activeOverlay = null;
      resetSaveReturnOverlay = null;
    }
    render();
    return true;
  }

  if (action === "messages") {
    syncDueLiyaAnalyticsEvents(Date.now());
    if (activeOverlay === "messages") {
      closeMessageOverlay();
    } else {
      if (activeOverlay === "fieldGuide" || activeOverlay === "resetSaveConfirm") {
        resetSaveReturnOverlay = null;
      }
      openAnalyticsChatSession({ threadId: "messages", source });
      activeMessagePreview = null;
      messageView = "list";
      lastOpenedMessageThreadId = "";
      activeOverlay = "messages";
      inlinePanelJustOpened = "messages";
    }
    render();
    return true;
  }

  if (action === "fieldGuide") {
    if (activeOverlay === "messages") {
      closeAnalyticsChatSession();
      clearPendingChatScrollRestoreState();
      clearMessageUnreadDividerSnapshot();
    }
    const wasFieldGuideContextOpen = activeOverlay === "fieldGuide" || activeOverlay === "resetSaveConfirm";
    const isOpeningFieldGuide = !wasFieldGuideContextOpen;
    fieldGuideSpeciesIndex = 0;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    activeOverlay = wasFieldGuideContextOpen ? null : "fieldGuide";
    resetSaveReturnOverlay = null;
    inlinePanelJustOpened = isOpeningFieldGuide ? "fieldGuide" : null;
    if (!wasFieldGuideContextOpen && activeOverlay === "fieldGuide") {
      trackFieldGuideOpened({ source });
    }
    render();
    return true;
  }

  return false;
}

elements.bottomNavRoot.addEventListener("click", (event) => {
  const button = event.target.closest(".bottom-nav__button");

  if (!button) {
    return;
  }

  if (!handleBottomNavAction(button.dataset.action, "bottomNav")) {
    event.preventDefault();
  }
});

elements.toolOverlayRoot.addEventListener("click", (event) => {
  const scrim = event.target.closest(".tool-overlay-scrim");

  if (!scrim) {
    return;
  }

  if (!handleBottomNavAction(scrim.dataset.action, "overlayScrim")) {
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
  if (action === "sendToSisterResult") {
    const resultShareTarget = getCurrentResultShareTarget();

    if (resultShareTarget && !resultShareTarget.alreadySent) {
      const didSend = sendCollectedCardEntryToSister(resultShareTarget.card.id, {
        snapshot: resultShareTarget.snapshot
      });

      if (didSend) {
        resultJustSentToSisterPhotoId = resultShareTarget.resultPhotoId || null;
      }
    }

    render();
    return;
  }

  if (gameState.mode === "PHOTO" && gameState.photoPhase === "RESULT") {
    resultJustSentToSisterPhotoId = null;
  }

  if (type === "testerProfile") {
    if (action === "testerProfileSubmit") {
      submitTesterProfile();
    }
    return;
  }

  if (isActionTransitioning) {
    return;
  }

  if (type === "explore" && RITUAL_EXPLORE_ACTIONS.has(action)) {
    handleExploreRitualAction(action);
    return;
  }

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
    isSettlementSummaryExpanded = false;
    clearEventHintState();
    gameState = startGameAtSpot(action, gameState);
    beginAnalyticsSession(action);
  }

  if (type === "photo") {
    gameState = handlePhotoAction(gameState, action, {
      capturedBehaviorState: capturedShootBehaviorState,
      capturedFocusAffix,
      ...focusSnapshotPayload
    });
  }

  syncCameraRaisedTopUiStateAfterAction(type, action);
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
    if (settlementRevealTimerId) {
      window.clearTimeout(settlementRevealTimerId);
      settlementRevealTimerId = null;
    }
    isSettlementRevealed = false;
    isSettlementSummaryExpanded = false;
    settlementReviewExpanded = false;
    hasPlayedSettlementSummaryReveal = false;
    shouldAnimateSettlementSummaryReveal = false;
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

function handleDetailPanelInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement) && !(target instanceof HTMLTextAreaElement)) {
    return;
  }

  if (target.id === "testerIdInput") {
    updateTesterProfileDraft({ testerId: target.value });
    if (target.value !== testerProfileDraft.testerId) {
      target.value = testerProfileDraft.testerId;
    }
    return;
  }

  if (target.name === "tester_level" && target instanceof HTMLInputElement) {
    updateTesterProfileDraft({ testerLevel: target.value });
    if (testerProfileValidationMessage) {
      testerProfileValidationMessage = "";
    }
    render();
    return;
  }

  if (!target.name.startsWith("survey_")) {
    return;
  }

  const draft = ensurePostSessionSurveyDraft();

  if (target.name === "survey_q1" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({ q1: target.value });
    return;
  }

  if (target.name === "survey_q2" && target instanceof HTMLInputElement) {
    const currentValues = Array.isArray(draft.q2Values) ? draft.q2Values : [];
    if (target.checked) {
      if (target.value === "no_reason") {
        updatePostSessionSurveyDraft({ q2Values: ["no_reason"] });
        render();
        return;
      }
      const filteredValues = currentValues.filter((item) => item !== "no_reason");
      if (filteredValues.includes(target.value)) {
        return;
      }
      if (filteredValues.length >= 2) {
        target.checked = false;
        return;
      }
      updatePostSessionSurveyDraft({ q2Values: [...filteredValues, target.value] });
      render();
      return;
    }
    updatePostSessionSurveyDraft({
      q2Values: currentValues.filter((item) => item !== target.value)
    });
    render();
    return;
  }

  if (target.name === "survey_q2_other_text" && target instanceof HTMLTextAreaElement) {
    updatePostSessionSurveyDraft({ q2OtherText: target.value });
    return;
  }

  if (target.name === "survey_q3" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({
      q3: target.value,
      q3OtherText: target.value === "5" ? draft.q3OtherText : ""
    });
    render();
    return;
  }

  if (target.name === "survey_q3_other_text" && target instanceof HTMLTextAreaElement) {
    updatePostSessionSurveyDraft({ q3OtherText: target.value });
    return;
  }

  if (target.name === "survey_q4" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({ q4: target.value });
    return;
  }

  if (target.name === "survey_q5" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({ q5: target.value });
    return;
  }

  if (target.name === "survey_q6" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({ q6: target.value });
    return;
  }

  if (target.name === "survey_q6_note" && target instanceof HTMLTextAreaElement) {
    return;
  }

  if (target.name === "survey_q7" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({ q7: target.value });
    return;
  }

  if (target.name === "survey_q8" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({ q8: target.value });
    return;
  }

  if (target.name === "survey_q9" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({ q9: target.value });
    return;
  }

  if (target.name === "survey_q9_note" && target instanceof HTMLTextAreaElement) {
    return;
  }

  if (target.name === "survey_q10" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({
      q10: target.value,
      q10OtherText: target.value === "6" ? draft.q10OtherText : ""
    });
    render();
    return;
  }

  if (target.name === "survey_q10_other_text" && target instanceof HTMLTextAreaElement) {
    updatePostSessionSurveyDraft({ q10OtherText: target.value });
    return;
  }

  if (target.name === "survey_q11_motivation_moment" && target instanceof HTMLTextAreaElement) {
    updatePostSessionSurveyDraft({ q11MotivationMoment: target.value });
    return;
  }

  if (target.name === "survey_q12_anything_else" && target instanceof HTMLTextAreaElement) {
    updatePostSessionSurveyDraft({ q12AnythingElse: target.value });
    return;
  }

  if (target.name === "survey_interview_willing" && target instanceof HTMLInputElement) {
    updatePostSessionSurveyDraft({ interviewWilling: target.checked });
  }
}

elements.detailPanel.addEventListener("input", handleDetailPanelInput);
elements.detailPanel.addEventListener("change", handleDetailPanelInput);

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

resetPostSessionSurveyState();
applyStartModeNarration();
loadLiyaMessages().then(() => {
  if (activeOverlay === "messages") {
    renderPreservingMessageScroll(captureChatScrollState());
    return;
  }
  render();
});
startDueLiyaReplyLineAnimations(Date.now());
render();
hideInitialLoadingMask();
