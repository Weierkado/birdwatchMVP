import {
  clearCachedAnalyticsPayload,
  clearCurrentSessionSurvey,
  createAnalyticsSession,
  flush,
  getAnalyticsState,
  getCachedAnalyticsPayload,
  retryCachedAnalytics,
  setCurrentSessionSurvey,
  track
} from "../analytics.js";

export function createTelemetrySession(options) {
  return createAnalyticsSession(options);
}

export function trackTelemetryEvent(eventName, payload) {
  return track(eventName, payload);
}

export function flushTelemetry(options) {
  return flush(options);
}

export function setTelemetrySurvey(survey) {
  return setCurrentSessionSurvey(survey);
}

export function clearTelemetrySurvey() {
  return clearCurrentSessionSurvey();
}

export function getTelemetryState() {
  return getAnalyticsState();
}

export function getTelemetryCachedPayload() {
  return getCachedAnalyticsPayload();
}

export function clearTelemetryCachedPayload() {
  return clearCachedAnalyticsPayload();
}

export function retryCachedTelemetry(options) {
  return retryCachedAnalytics(options);
}
