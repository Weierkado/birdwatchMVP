import {
  ANALYTICS_ENDPOINT,
  ANALYTICS_INGEST_TOKEN,
  CLIENT_VERSION
} from "../data/config.js";
import { isAnalyticsEnabled as isPlaytestAnalyticsEnabled } from "./utils/config.js";

export const TESTER_UUID_KEY = "birdwatch_text_sim_tester_uuid";
export const TESTER_PROFILE_KEY = "birdwatch_text_sim_tester_profile";
export const ANALYTICS_RETRY_KEY = "birdwatch_text_sim_analytics_retry";
export const SESSION_INDEX_KEY = "birdwatch_text_sim_session_index";

const events = [];
let memoryTesterUuid = "";
let memorySessionIndex = 0;
let currentSession = null;
let currentSessionSurvey = null;
let lastPayload = null;
let lastFlushStatus = "idle";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function cloneSerializable(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return fallback;
  }
}

function clearCurrentSession() {
  currentSession = null;
}

function isAnalyticsEnabled() {
  return isPlaytestAnalyticsEnabled();
}

function normalizeSurveyPayload(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  return cloneSerializable(value, null);
}

function normalizeTesterLevel(value) {
  const level = Number.parseInt(value, 10);
  return [1, 2, 3, 4].includes(level) ? level : 0;
}

function normalizeTesterId(value) {
  if (!isNonEmptyString(value)) {
    return "";
  }

  return value.trim().slice(0, 40);
}

function normalizeTesterLevelText(value, testerLevel = 0) {
  if (testerLevel <= 0 || !isNonEmptyString(value)) {
    return "";
  }

  return value.trim();
}

function normalizeTesterProfile(value) {
  const source = isPlainObject(value) ? value : {};
  const testerLevel = normalizeTesterLevel(source.tester_level);
  const testerId = normalizeTesterId(source.tester_id);
  const testerLevelText = normalizeTesterLevelText(source.tester_level_text, testerLevel);
  const updatedAt = isNonEmptyString(source.updated_at)
    ? source.updated_at.trim()
    : "";

  return {
    tester_id: testerId,
    tester_level: testerLevel,
    tester_level_text: testerLevelText,
    updated_at: updatedAt
  };
}

function createRandomFragment(size = 12) {
  let result = "";
  while (result.length < size) {
    result += Math.random().toString(36).slice(2);
  }
  return result.slice(0, size);
}

function createFallbackUuid() {
  const nowPart = Date.now().toString(36);
  const randomPartA = createRandomFragment(8);
  const randomPartB = createRandomFragment(8);
  return `bw-${nowPart}-${randomPartA}-${randomPartB}`;
}

function createUuid() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch (error) {
    return createFallbackUuid();
  }

  return createFallbackUuid();
}

export function getTesterUuid() {
  const storedUuid = safeStorageGet(TESTER_UUID_KEY);
  if (isNonEmptyString(storedUuid)) {
    return storedUuid.trim();
  }

  if (isNonEmptyString(memoryTesterUuid)) {
    return memoryTesterUuid;
  }

  const nextUuid = createUuid();
  memoryTesterUuid = nextUuid;
  safeStorageSet(TESTER_UUID_KEY, nextUuid);
  return nextUuid;
}

export function getTesterProfile() {
  const rawProfile = safeStorageGet(TESTER_PROFILE_KEY);
  if (!isNonEmptyString(rawProfile)) {
    return normalizeTesterProfile(null);
  }

  try {
    return normalizeTesterProfile(JSON.parse(rawProfile));
  } catch (error) {
    return normalizeTesterProfile(null);
  }
}

export function saveTesterProfile(profile) {
  const normalizedProfile = normalizeTesterProfile(profile);
  safeStorageSet(TESTER_PROFILE_KEY, JSON.stringify(normalizedProfile));
  return normalizedProfile;
}

export function setCurrentSessionSurvey(survey) {
  if (!isAnalyticsEnabled()) {
    currentSessionSurvey = null;
    return currentSessionSurvey;
  }
  currentSessionSurvey = normalizeSurveyPayload(survey);
  return currentSessionSurvey;
}

export function getCurrentSessionSurvey() {
  return cloneSerializable(currentSessionSurvey, null);
}

export function clearCurrentSessionSurvey() {
  currentSessionSurvey = null;
}

function readSessionIndexFromStorage() {
  const rawValue = safeStorageGet(SESSION_INDEX_KEY);
  if (!isNonEmptyString(rawValue)) {
    return 0;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function writeSessionIndexToStorage(sessionIndex) {
  const safeIndex = Number.isFinite(sessionIndex) ? Math.max(0, Math.floor(sessionIndex)) : 0;
  safeStorageSet(SESSION_INDEX_KEY, String(safeIndex));
}

function getOrCreateCurrentSession() {
  if (currentSession) {
    return currentSession;
  }

  createAnalyticsSession();
  return currentSession;
}

export function createAnalyticsSession(options = {}) {
  if (!isAnalyticsEnabled()) {
    return null;
  }

  if (currentSession && options.forceNew !== true) {
    return {
      sessionId: currentSession.sessionId,
      sessionIndex: currentSession.sessionIndex,
      startedAt: currentSession.startedAt
    };
  }

  const storedSessionIndex = readSessionIndexFromStorage();
  memorySessionIndex = Math.max(memorySessionIndex, storedSessionIndex);
  const nextSessionIndex = memorySessionIndex + 1;
  memorySessionIndex = nextSessionIndex;
  writeSessionIndexToStorage(nextSessionIndex);

  const startedAt = isNonEmptyString(options.startedAt)
    ? options.startedAt.trim()
    : new Date().toISOString();

  currentSession = {
    sessionId: `${Date.now()}_${createRandomFragment(10)}`,
    sessionIndex: nextSessionIndex,
    startedAt
  };
  clearCurrentSessionSurvey();

  getTesterUuid();

  return {
    sessionId: currentSession.sessionId,
    sessionIndex: currentSession.sessionIndex,
    startedAt: currentSession.startedAt
  };
}

function getFetchErrorText(error, fallback = "unknown_error") {
  if (isNonEmptyString(error && error.message)) {
    return error.message;
  }

  return fallback;
}

function getIdentityFromOptions(options = {}) {
  const storedProfile = getTesterProfile();
  const testerLevel = Number.isFinite(options.testerLevel)
    ? normalizeTesterLevel(options.testerLevel)
    : storedProfile.tester_level;
  const testerLevelText = isNonEmptyString(options.testerLevelText)
    ? normalizeTesterLevelText(options.testerLevelText, testerLevel)
    : normalizeTesterLevelText(storedProfile.tester_level_text, testerLevel);
  const testerId = isNonEmptyString(options.testerId)
    ? normalizeTesterId(options.testerId)
    : storedProfile.tester_id;
  const userAgent = typeof navigator !== "undefined" && isNonEmptyString(navigator.userAgent)
    ? navigator.userAgent
    : "";

  return {
    tester_uuid: getTesterUuid(),
    tester_id: testerId,
    tester_level: testerLevel,
    tester_level_text: testerLevelText,
    client_version: CLIENT_VERSION,
    user_agent: userAgent
  };
}

function buildFlushPayload(options = {}) {
  const session = getOrCreateCurrentSession();
  const endedAt = isNonEmptyString(options.endedAt)
    ? options.endedAt.trim()
    : new Date().toISOString();
  const survey = options.survey === undefined
    ? getCurrentSessionSurvey()
    : normalizeSurveyPayload(options.survey);

  return {
    identity: getIdentityFromOptions(options),
    session: {
      session_id: session.sessionId,
      session_index: session.sessionIndex,
      started_at: session.startedAt,
      ended_at: endedAt
    },
    events: events.slice(),
    survey
  };
}

function hasAnalyticsEndpoint() {
  return isNonEmptyString(ANALYTICS_ENDPOINT);
}

function getPostHeaders() {
  const headers = {
    "Content-Type": "application/json; charset=utf-8"
  };

  if (isNonEmptyString(ANALYTICS_INGEST_TOKEN)) {
    headers.Authorization = `Bearer ${ANALYTICS_INGEST_TOKEN}`;
  }

  return headers;
}

function cacheAnalyticsPayload(payload) {
  safeStorageSet(ANALYTICS_RETRY_KEY, JSON.stringify(payload));
}

export function getCachedAnalyticsPayload() {
  const rawCache = safeStorageGet(ANALYTICS_RETRY_KEY);
  if (!isNonEmptyString(rawCache)) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawCache);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    safeStorageRemove(ANALYTICS_RETRY_KEY);
    return null;
  }
}

export function clearCachedAnalyticsPayload() {
  safeStorageRemove(ANALYTICS_RETRY_KEY);
}

export function getAnalyticsState() {
  const safeEvents = events.map((item) => ({ ...item }));
  const safeSession = currentSession
    ? {
        sessionId: currentSession.sessionId,
        sessionIndex: currentSession.sessionIndex,
        startedAt: currentSession.startedAt
      }
    : null;

  return {
    events: safeEvents,
    currentSession: safeSession,
    currentSessionSurvey: cloneSerializable(currentSessionSurvey, null),
    lastPayload: cloneSerializable(lastPayload, null),
    lastFlushStatus
  };
}

export function track(eventType, payload = {}) {
  if (!isAnalyticsEnabled()) {
    return null;
  }

  if (!isNonEmptyString(eventType)) {
    return null;
  }

  const safePayload = isPlainObject(payload) ? payload : {};
  const session = getOrCreateCurrentSession();
  const testerProfile = getTesterProfile();
  const event = {
    ...safePayload,
    event_type: eventType.trim(),
    timestamp: new Date().toISOString(),
    session_id: session.sessionId,
    tester_uuid: getTesterUuid(),
    tester_id: testerProfile.tester_id,
    tester_level: testerProfile.tester_level,
    tester_level_text: testerProfile.tester_level_text,
    session_index: session.sessionIndex
  };

  events.push(event);
  return { ...event };
}

export async function flush(options = {}) {
  if (!isAnalyticsEnabled()) {
    if (options.finalizeSession === true) {
      clearCurrentSessionSurvey();
      clearCurrentSession();
    }
    lastFlushStatus = "analytics_disabled";
    return { ok: true, skipped: true, reason: "analytics_disabled" };
  }

  if (events.length <= 0 && options.includeEmpty !== true) {
    if (options.finalizeSession === true) {
      clearCurrentSessionSurvey();
      clearCurrentSession();
    }
    lastFlushStatus = "skipped";
    return { ok: true, mode: "skipped", payload: null };
  }

  const payload = buildFlushPayload(options);
  lastPayload = cloneSerializable(payload, payload);

  if (!hasAnalyticsEndpoint()) {
    events.length = 0;
    clearCurrentSessionSurvey();
    if (options.finalizeSession === true) {
      clearCurrentSession();
    }
    lastFlushStatus = "local_fallback";
    return {
      ok: true,
      mode: "local_fallback",
      payload: cloneSerializable(payload, payload)
    };
  }

  if (typeof fetch !== "function") {
    cacheAnalyticsPayload(payload);
    lastFlushStatus = "failed_cached";
    return {
      ok: false,
      mode: "failed_cached",
      error: "fetch_unavailable"
    };
  }

  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: getPostHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }

    events.length = 0;
    clearCurrentSessionSurvey();
    if (options.finalizeSession === true) {
      clearCurrentSession();
    }
    clearCachedAnalyticsPayload();
    lastFlushStatus = "sent";
    return {
      ok: true,
      mode: "sent"
    };
  } catch (error) {
    cacheAnalyticsPayload(payload);
    if (options.finalizeSession === true) {
      events.length = 0;
      clearCurrentSessionSurvey();
      clearCurrentSession();
    }
    lastFlushStatus = "failed_cached";
    return {
      ok: false,
      mode: "failed_cached",
      error: getFetchErrorText(error)
    };
  }
}

export async function retryCachedAnalytics() {
  if (!isAnalyticsEnabled()) {
    lastFlushStatus = "analytics_disabled";
    return {
      ok: true,
      mode: "skipped",
      reason: "analytics_disabled"
    };
  }

  if (!hasAnalyticsEndpoint()) {
    return {
      ok: false,
      mode: "skipped",
      reason: "endpoint_empty"
    };
  }

  const cachedPayload = getCachedAnalyticsPayload();
  if (!cachedPayload) {
    return {
      ok: true,
      mode: "skipped",
      reason: "no_cache"
    };
  }

  if (typeof fetch !== "function") {
    lastFlushStatus = "retry_failed_cached";
    return {
      ok: false,
      mode: "failed_cached",
      error: "fetch_unavailable"
    };
  }

  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: getPostHeaders(),
      body: JSON.stringify(cachedPayload)
    });

    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }

    clearCachedAnalyticsPayload();
    lastPayload = cloneSerializable(cachedPayload, cachedPayload);
    lastFlushStatus = "retry_sent";
    return {
      ok: true,
      mode: "retry_sent"
    };
  } catch (error) {
    lastFlushStatus = "retry_failed_cached";
    return {
      ok: false,
      mode: "failed_cached",
      error: getFetchErrorText(error)
    };
  }
}

export const analytics = {
  get events() {
    return events.slice();
  },
  createAnalyticsSession,
  clearCurrentSessionSurvey,
  getCurrentSessionSurvey,
  getTesterProfile,
  getTesterUuid,
  getAnalyticsState,
  getCachedAnalyticsPayload,
  clearCachedAnalyticsPayload,
  saveTesterProfile,
  setCurrentSessionSurvey,
  track,
  flush,
  retryCachedAnalytics
};
