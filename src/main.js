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
import { BADGE_RANDOM_SCALE, BADGE_ROTATION, BIRD_DISTANCE_SCALE, CAMERA_FOCUS_CONFIG, LOG_LIMIT } from "../data/config.js";
import { createDefaultGameState } from "./gameState.js";
import { clearFieldGuide, loadFieldGuide } from "./storage.js";
import { BEHAVIOR_STATE_DISPLAY, getCurrentPhotoState } from "./photoSequence.js";
import { endGame, handleCatalogueAction, handleDistantListenAction, handleExploreAction, handleFirstEncounterAction, handlePhotoAction, handleSpotSelectAction, startGame, startGameAtSpot } from "./gameSession.js";
import { getCardCaptureCount, getCollectedCardEntry, getCollectedCardIds, getCollectedCardSnapshots, getCollectedCardSisterKnowledge, getSpeciesCataloguedAtTimeLabel, getSpeciesKnowledgeState, getSpeciesPhotoCount, getSpeciesSeenCount, hasCollectedCardNewContent, identifyCollectedCard, isCollectedCardSentToSister, markCollectedCardViewed, sendCollectedCardToSister } from "./fieldGuide.js";
import { createRarityBadgeHtml } from "./rarityDisplay.js";
import { getAllSpots, getCurrentSpot, getSpotById, getSurroundingSpotMap } from "./spotManager.js";
import { getFocusConfig, createFocusRuntime, evaluateFocus, computeBadgeRotation, getFocusAffixDisplay, getFocusDistance } from "./focusEngine.js";
import { getFocusSequenceState } from "./focusSequence.js";

let gameState = createDefaultGameState();
let isSettlementRevealed = false;
let fieldGuideSpeciesIndex = 0;
let fieldGuideDetailCardId = null;
let fieldGuideDetailSnapshotIndex = 0;
let activeOverlay = null;
let activeMessagePreview = null;
let recentlyCataloguedSpeciesId = null;
let recentlyIdentifiedCardId = null;
let recentlyIdentifiedTimerId = null;
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
const FOCUS_OFFSET_X_RATIO = 0.42;
const FOCUS_OFFSET_Y_RATIO = 0.34;
const ENABLE_CARD_IDENTIFY_UI = false;
const FOCUS_FRAME_VISUAL_SIZE = {
  width: 40,
  height: 30
};
const FOCUS_FRAME_CONTAINER_PADDING = 32;

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
    SETTLEMENT: "本局结算",
    FIELD_GUIDE: "笔记查看",
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

function renderFieldGuideDetailCornerHtml() {
  return `
    <span class="field-guide-detail-corner corner-tl"></span>
    <span class="field-guide-detail-corner corner-tr"></span>
    <span class="field-guide-detail-corner corner-bl"></span>
    <span class="field-guide-detail-corner corner-br"></span>
  `;
}

function renderFieldGuideDetailPolaroid(card, snapshot, isIdentified, displayTitle = card.title) {
  const shouldUseIdentifyUi = ENABLE_CARD_IDENTIFY_UI && isIdentified;
  const identifyingClass = ENABLE_CARD_IDENTIFY_UI && recentlyIdentifiedCardId === card.id ? " is-identifying" : "";

  if (!snapshot) {
    return `
      <div class="field-guide-detail-polaroid${identifyingClass}">
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
  const finalScale = getSnapshotFinalScale(snapshot);
  const badgeRotation = getSnapshotBadgeRotation(snapshot);
  const species = getSpeciesById(card.speciesId);
  const badgeColorStyle = shouldUseIdentifyUi
    ? buildSpeciesBadgeStyle(species, snapshot)
    : buildBehaviorBadgeStyle(getSnapshotBehaviorState(snapshot, card));
  const inlineBadgeStyle = [
    `left: ${badgeRelX}%`,
    `top: ${badgeRelY}%`,
    `transform: translate(-50%, -50%) rotate(${badgeRotation}deg) scale(${finalScale})`,
    badgeColorStyle
  ].filter(Boolean).join("; ");

  return `
    <div class="field-guide-detail-polaroid${identifyingClass}">
      <div class="field-guide-detail-polaroid-paper">
        <div class="field-guide-detail-polaroid-frame">
          <div class="field-guide-detail-focus-area ${focusClassName}" style="${getFocusFrameStyle()}">
            ${renderFieldGuideDetailCornerHtml()}
          </div>
          <div class="${badgeClassName}" style="${inlineBadgeStyle};">${escapeHtml(displayTitle)}</div>
        </div>
        <div class="field-guide-detail-date">${formatPolaroidDate(snapshot.realTimestamp)}</div>
        ${crownHtml}
      </div>
    </div>
  `;
}

function clampFieldGuideDetailSnapshotIndex(snapshotCount) {
  if (snapshotCount <= 0) {
    fieldGuideDetailSnapshotIndex = 0;
    return;
  }

  fieldGuideDetailSnapshotIndex = Math.max(0, Math.min(fieldGuideDetailSnapshotIndex, snapshotCount - 1));
}

function renderFieldGuideSnapshotNav(snapshotCount) {
  if (snapshotCount <= 1) {
    return "";
  }

  const prevDisabled = fieldGuideDetailSnapshotIndex <= 0 ? " disabled" : "";
  const nextDisabled = fieldGuideDetailSnapshotIndex >= snapshotCount - 1 ? " disabled" : "";

  return `
    <div class="field-guide-snapshot-nav" aria-label="照片翻阅">
      <button class="field-guide-snapshot-button" type="button" data-action="fieldGuidePrevSnapshot"${prevDisabled} aria-label="上一张照片">◀</button>
      <span class="field-guide-snapshot-page">${fieldGuideDetailSnapshotIndex + 1} / ${snapshotCount}</span>
      <button class="field-guide-snapshot-button" type="button" data-action="fieldGuideNextSnapshot"${nextDisabled} aria-label="下一张照片">▶</button>
    </div>
  `;
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
  const sisterKnowledgeHtml = sisterKnowledge.length > 0
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

  elements.detailPanel.innerHTML = wrapNoteFolder(`
    <section class="field-guide-detail-view note-book-page note-card-detail-panel" aria-label="${escapeHtml(displayTitle)}卡牌详情">
      <div class="field-guide-detail-toolbar">
        <button class="field-guide-detail-back button-ghost" type="button" data-action="fieldGuideDetailBack">◀ 返回笔记</button>
      </div>
      <section class="field-guide-detail-card-info">
        <div class="field-guide-card-title-row">
          ${renderRarityBadge(card)}
          <h2 class="field-guide-detail-card-title">${escapeHtml(displayTitle)}</h2>
        </div>
        <p class="field-guide-detail-card-description">${escapeHtml(displayDescription)}</p>
        ${identifyRowHtml}
      </section>
      ${detailStatsHtml}
      ${sisterKnowledgeHtml}
      <div class="note-detail-photo-section">
        <div class="note-detail-photo-and-meta">
          <div class="note-detail-polaroid-wrap">
            ${renderFieldGuideDetailPolaroid(card, snapshot, isIdentified, displayTitle)}
          </div>
          <div class="field-guide-detail-capture-meta" aria-label="拍摄信息">
            <span class="field-guide-detail-capture-meta-item note-detail-photo-meta-row note-detail-photo-meta-row-time"><span class="field-guide-detail-capture-label">拍摄时间：</span><span class="field-guide-detail-capture-value">${escapeHtml(captureTimeText)}</span></span>
            <span class="field-guide-detail-capture-meta-item note-detail-photo-meta-row note-detail-photo-meta-row-location"><span class="field-guide-detail-capture-label">地点：</span><span class="field-guide-detail-capture-value">${escapeHtml(spotText)}</span></span>
            <span class="field-guide-detail-capture-meta-item note-detail-photo-meta-row note-detail-photo-meta-row-battery"><span class="field-guide-detail-capture-label">电量：</span><span class="field-guide-detail-capture-value">${batteryHtml}</span></span>
            <span class="field-guide-detail-capture-meta-item note-detail-photo-meta-row note-detail-photo-meta-row-focus"><span class="field-guide-detail-capture-label">对焦：</span><span class="field-guide-detail-capture-value">${escapeHtml(focusText)}</span></span>
          </div>
        </div>
      </div>
      ${renderFieldGuideSnapshotNav(safeSnapshots.length)}
      ${sendToSisterHtml}
    </section>
  `);
}

function wrapNoteFolder(innerHtml) {
  return `
    <div class="note-book-folder">
      <div class="note-book-folder-tab" aria-hidden="true">观察笔记 / 给妹妹力娅的观鸟手册</div>
      <div class="note-book-folder-inner">
        ${innerHtml}
      </div>
    </div>
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

  focusRuntime = createFocusRuntime(config, seed);
  focusStartedAt = performance.now();
  focusBadgeRandomScale = rollBadgeRandomScale();
  latestBadgeRotation = 0;
  latestFocusKey = focusKey;
  latestVisibleFocusState = getCurrentVisibleFocusState();
  focusEnterFrom = createFocusEnterFrom();
  focusEnterCurve = createFocusEnterCurve();
  focusEnterTarget = evaluateFocus(
    createFocusRuntime(config, seed),
    0
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
  const isFieldGuideOpen = activeOverlay === "fieldGuide";
  const fieldGuideButtonText = isFieldGuideOpen ? "收起手册" : "打开手册";
  const shouldShowFieldGuideNewBadge = !isFieldGuideOpen && hasAnyNewCollectedCard(gameState.fieldGuide);

  elements.mode.innerHTML = shouldShowFieldGuideNewBadge
    ? `<span class="dashboard-card-button-text">${fieldGuideButtonText}</span><span class="dashboard-new-badge">new</span>`
    : `<span class="dashboard-card-button-text">${fieldGuideButtonText}</span>`;
  elements.spot.textContent = isMessagesOpen ? "关闭消息" : "查看消息";
  elements.spot.dataset.action = "messages";
  elements.spot.removeAttribute("aria-disabled");
  elements.sdCard.textContent = `${currentSpot.name} · ${mapInfo.facingName}`;
  elements.direction.textContent = mapInfo.facingName;
}

function renderActions() {
  elements.actionPanel.innerHTML = "";

  if (gameState.mode === "START") {
    elements.actionPanel.append(createButton("开始游戏", "start", "system", "button-major"));
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
      <button class="field-guide-clear-button" type="button" data-action="clearGuide">清空笔记</button>
    </div>
  `;

  if (discoveredSpecies.length === 0) {
    elements.detailPanel.innerHTML = wrapNoteFolder(`
      <section class="field-guide-page field-guide-empty note-book-page">
        <h2>笔记</h2>
        <p class="field-guide-empty-title">笔记还是空白的。</p>
        <p class="field-guide-empty-desc">去野外，遇见你的第一只鸟。</p>
        ${clearGuideButtonHtml}
      </section>
    `);
    return;
  }

  const species = discoveredSpecies[fieldGuideSpeciesIndex];
  const knowledgeState = getSpeciesKnowledgeState(guide, species.id);
  const isCataloguedSpecies = knowledgeState === "CATALOGUED";
  const canShowCollectedCards = knowledgeState === "SEEN" || isCataloguedSpecies;
  const shouldRevealCataloguedPage = isCataloguedSpecies && species.id === recentlyCataloguedSpeciesId;
  const collectedCardIds = getCollectedCardIds(guide);
  const collectedCardsForSpecies = canShowCollectedCards
    ? getCardsForSpecies(species.id).filter((card) => collectedCardIds.includes(card.id))
    : [];
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
  const cataloguedAtTimeLabel = getSpeciesCataloguedAtTimeLabel(guide, species.id) || "旧记录";
  const speciesMetaLines = [
    `见过 ${speciesSeenCount} 次 · 拍了 ${speciesPhotoCount} 张`,
    ...(isCataloguedSpecies ? [`加新于 ${cataloguedAtTimeLabel}`] : [])
  ];
  const revealAttrs = (order) => {
    if (!shouldRevealCataloguedPage) {
      return "";
    }

    return ` field-guide-reveal" style="--field-guide-reveal-delay: ${Math.min(order * 80, 720)}ms`;
  };
  const speciesMetaHtml = speciesMetaLines.length > 0
    ? `<div class="field-guide-species-meta${revealAttrs(1)}">${speciesMetaLines.map((line) => `<p class="field-guide-species-meta-line">${escapeHtml(line)}</p>`).join("")}</div>`
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
    const snapshotCount = getCollectedCardSnapshots(guide, card.id).length;
    const displayTitle = getCardDisplayTitle(card);
    const displayDescription = getCardDisplayDescription(card);
    const showNewContentBadge = isCataloguedSpecies && hasCollectedCardNewContent(guide, card.id);
    const snapshotCountHtml = snapshotCount > 0
      ? `<span class="field-guide-card-photo-count">已拍 ${snapshotCount} 张</span>`
      : "";
    const newContentBadgeHtml = showNewContentBadge
      ? `<span class="field-guide-card-new-marker">new</span>`
      : "";

    return `
      <li class="field-guide-card is-collected${revealAttrs(3 + index)}">
        <button class="field-guide-card-button" type="button" data-card-id="${escapeHtml(card.id)}" aria-label="查看${escapeHtml(displayTitle)}的拍摄记录">
          <span class="field-guide-card-title-row">
            ${renderRarityBadge(card)}
            <strong class="field-guide-card-title">${escapeHtml(displayTitle)}</strong>
            ${newContentBadgeHtml}
          </span>
          <span class="field-guide-card-description">${escapeHtml(displayDescription)}</span>
          ${snapshotCountHtml}
        </button>
      </li>
    `;
  });
  const cardListHtml = canShowCollectedCards && cardItems.length > 0
    ? `<ul class="field-guide-card-list">${cardItems.join("")}</ul>`
    : "";

  elements.detailPanel.innerHTML = wrapNoteFolder(`
    <section class="field-guide-page note-book-page">
      <div class="field-guide-page-tabs" aria-label="笔记页数">${pageTabs.join("")}</div>
      <div class="${pagerClassName}">
        ${prevButtonHtml}
        <div class="field-guide-species-header${revealAttrs(0)}">
          ${speciesNumber ? `<div class="field-guide-species-number">${escapeHtml(speciesNumber)}</div>` : ""}
          <h2 class="field-guide-species-title">${escapeHtml(speciesTitle)}</h2>
        </div>
        ${nextButtonHtml}
      </div>
      ${speciesMetaHtml}
      <p class="field-guide-appearance${revealAttrs(2)}">${escapeHtml(species.appearance)}</p>
      ${catalogueButtonHtml}
      ${cardListHtml}
      ${clearGuideButtonHtml}
    </section>
  `);

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
    <p class="settlement-reveal" style="--reveal-delay: 960ms">新增笔记：${shownNewCardIds.length}</p>
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

function renderMessagePanel() {
  const threadHtml = activeMessagePreview && activeMessagePreview.type === "sharedPhoto"
    ? [
      `
      <div class="message-row message-row-player">
        <p class="message-bubble message-bubble-player">我拍到了一张照片，你帮我看看？</p>
      </div>
      `,
      ...normalizeKnowledgeLines(activeMessagePreview.knowledgeLines).map((line) => `
        <div class="message-row message-row-sister">
          <p class="message-bubble message-bubble-sister">${escapeHtml(line)}</p>
        </div>
      `)
    ].join("")
    : `
      <div class="message-row message-row-sister">
        <p class="message-bubble message-bubble-sister">你可以把拍到的照片发给我看看。</p>
      </div>
      <div class="message-row message-row-sister">
        <p class="message-bubble message-bubble-sister">我不一定马上知道答案，但我会尽量帮你一起认。</p>
      </div>
    `;

  elements.detailPanel.innerHTML = `
    <section class="message-panel" aria-label="短信">
      <header class="message-header">
        <p class="message-contact">妹妹</p>
        <h2>短信</h2>
      </header>
      <div class="message-thread" aria-label="短信内容">
        ${threadHtml}
      </div>
    </section>
  `;
}

function renderDetailPanel() {
  elements.detailPanel.classList.toggle("is-note-folder-shell", activeOverlay === "fieldGuide" || (gameState.mode === "FIELD_GUIDE" && activeOverlay !== "messages"));

  if (activeOverlay === "messages") {
    renderMessagePanel();
    return;
  }

  if (activeOverlay === "fieldGuide") {
    renderFieldGuide();
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
  gameState.eventText = "你翻开笔记，查看你亲眼见过的记录。";
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

function handleSystemAction(action) {
  if (action === "start") {
    isSettlementRevealed = false;
    activeOverlay = null;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    gameState = startGame();
  }

  if (action === "fieldGuide") {
    activeOverlay = activeOverlay === "fieldGuide" ? null : "fieldGuide";
  }

  if (action === "back") {
    returnFromFieldGuide();
  }

  if (action === "clearGuide") {
    clearFieldGuide();
    gameState.fieldGuide = loadFieldGuide();
    fieldGuideSpeciesIndex = 0;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
    gameState.eventText = "笔记已经清空。";
  }

  if (action === "endGame") {
    isSettlementRevealed = false;
    fieldGuideDetailCardId = null;
    fieldGuideDetailSnapshotIndex = 0;
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
  const messageBackButton = event.target.closest(".message-back-button");

  if (messageBackButton) {
    activeOverlay = null;
    render();
    return;
  }

  const fieldGuideClearButton = event.target.closest(".field-guide-clear-button");

  if (fieldGuideClearButton) {
    handleSystemAction(fieldGuideClearButton.dataset.action);
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
      activeMessagePreview = {
        type: "sharedPhoto",
        cardId,
        knowledgeLines: getCollectedCardSisterKnowledge(gameState.fieldGuide, cardId)
      };
      activeOverlay = "messages";
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

elements.statusGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".dashboard-card-button");

  if (!button) {
    return;
  }

  if (button.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    return;
  }

  if (button.dataset.action === "messages") {
    if (activeOverlay === "messages") {
      activeOverlay = null;
    } else {
      activeMessagePreview = null;
      activeOverlay = "messages";
    }
    render();
    return;
  }

  if (button.dataset.action === "fieldGuide") {
    activeOverlay = activeOverlay === "fieldGuide" ? null : "fieldGuide";
    render();
    return;
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

render();
hideInitialLoadingMask();
