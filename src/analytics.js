import { ANALYTICS_ENDPOINT } from "../data/config.js";

const BUILD_VERSION = "playtest-1";

let events = [];
let sessionId = "";
let sessionStartTime = 0;
let testerId = "";
let testerLevel = 0;
let testerLevelText = "";
let visitedSpotIds = new Set();
let hasSubmittedSession = false;

function createSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function resetAnalyticsSession() {
  events = [];
  sessionId = createSessionId();
  sessionStartTime = Date.now();
  visitedSpotIds = new Set();
  hasSubmittedSession = false;
}

export function setTesterProfile({ testerId: nextTesterId, testerLevel: nextTesterLevel, testerLevelText: nextTesterLevelText }) {
  testerId = typeof nextTesterId === "string" ? nextTesterId.trim() : "";
  testerLevel = Number(nextTesterLevel) || 0;
  testerLevelText = typeof nextTesterLevelText === "string" ? nextTesterLevelText : "";
}

export function clearTesterProfile() {
  setTesterProfile({
    testerId: "",
    testerLevel: 0,
    testerLevelText: ""
  });
}

export function getAnalyticsContext() {
  return {
    session_id: sessionId,
    tester_id: testerId,
    tester_level: testerLevel,
    tester_level_text: testerLevelText,
    build_version: BUILD_VERSION
  };
}

export function isPlaytestParticipant() {
  return testerId.trim() !== "" && testerLevel > 0;
}

export function isTesterProfileReady() {
  return testerId.trim() !== "" && testerLevel > 0 && testerLevelText.trim() !== "";
}

export function trackEvent(eventType, fields = {}) {
  try {
    const event = {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      ...getAnalyticsContext(),
      ...fields
    };

    events.push(event);
  } catch (err) {
    console.warn("[Analytics] 事件记录失败：", err.message);
  }
}

export function getAnalyticsEvents() {
  return events.slice();
}

export function getAnalyticsDurationMs() {
  if (!sessionStartTime) {
    return 0;
  }

  return Date.now() - sessionStartTime;
}

async function postAnalyticsPayload(payload, successMessage) {
  if (!ANALYTICS_ENDPOINT) {
    console.log("[Analytics] 本地模式，数据包如下：", payload);
    return { ok: true, local: true };
  }

  try {
    await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    console.log(successMessage);
    return { ok: true, opaque: true };
  } catch (err) {
    console.warn("[Analytics] 上报失败：", err.message);
    return { ok: false, error: err.message };
  }
}

export async function submitAnalyticsSession(extraPayload = {}) {
  if (hasSubmittedSession) {
    return { ok: true, skipped: true };
  }

  hasSubmittedSession = true;

  const payload = {
    payload_type: "session_events",
    ...getAnalyticsContext(),
    events: getAnalyticsEvents(),
    survey: {
      q0: testerLevel,
      q0_text: testerLevelText
    },
    survey_skipped: true,
    ...extraPayload
  };

  return postAnalyticsPayload(payload, "[Analytics] 已发送上报请求（no-cors 模式，无法读取响应）");
}

export async function submitAnalyticsSurvey(survey) {
  const payload = {
    payload_type: "survey_answer",
    ...getAnalyticsContext(),
    events: [],
    survey: {
      q0: testerLevel,
      q0_text: testerLevelText,
      ...survey,
      survey_completed: true,
      survey_skipped: false,
      submitted_at: new Date().toISOString()
    }
  };

  return postAnalyticsPayload(payload, "[Analytics] 已发送问卷上报请求（no-cors 模式，无法读取响应）");
}

export function markSpotVisited(spotId) {
  if (spotId) {
    visitedSpotIds.add(spotId);
  }
}

export function getVisitedSpotCount() {
  return visitedSpotIds.size;
}
