import * as appConfig from "../../data/config.js";

const DEFAULT_SURVEY_VERSION = "playtest2_driving_force_v1";

export function getPlaytestConfig() {
  return appConfig.PLAYTEST_CONFIG || {};
}

export function isAnalyticsEnabled() {
  return Boolean(getPlaytestConfig().analyticsEnabled);
}

export function isSurveyEnabled() {
  return Boolean(getPlaytestConfig().surveyEnabled);
}

export function isOpeningSurveyEnabled() {
  const cfg = getPlaytestConfig();
  return Boolean(cfg.surveyEnabled && cfg.openingSurveyEnabled);
}

export function isSettlementSurveyEnabled() {
  const cfg = getPlaytestConfig();
  return Boolean(cfg.surveyEnabled && cfg.settlementSurveyEnabled);
}

export function getSurveyVersion(fallback = DEFAULT_SURVEY_VERSION) {
  const version = getPlaytestConfig().surveyVersion;
  return typeof version === "string" && version.trim() ? version.trim() : fallback;
}
