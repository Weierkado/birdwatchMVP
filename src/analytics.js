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
  testerId = "";
  testerLevel = 0;
  testerLevelText = "";
  visitedSpotIds = new Set();
  hasSubmittedSession = false;
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

export async function submitAnalyticsSession(extraPayload = {}) {
  if (hasSubmittedSession) {
    return { ok: true, skipped: true };
  }

  hasSubmittedSession = true;

  const payload = {
    ...getAnalyticsContext(),
    events: getAnalyticsEvents(),
    survey: {},
    survey_skipped: true,
    ...extraPayload
  };

  if (!ANALYTICS_ENDPOINT) {
    console.log("[Analytics] 本地模式，数据包如下：", payload);
    return { ok: true, local: true };
  }

  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return { ok: response.ok, status: response.status };
  } catch (err) {
    console.warn("[Analytics] 上报失败：", err.message);
    return { ok: false, error: err.message };
  }
}

export function markSpotVisited(spotId) {
  if (spotId) {
    visitedSpotIds.add(spotId);
  }
}

export function getVisitedSpotCount() {
  return visitedSpotIds.size;
}
