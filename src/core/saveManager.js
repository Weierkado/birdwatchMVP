const OBSERVATION_DAY_INDEX_KEY = "birdwatch_text_sim_day_index";
const PLAYTEST2_DRIVING_SURVEY_DONE_KEY = "birdwatch_playtest2_driving_survey_done";

function normalizeObservationDayIndex(value) {
  const normalized = Number.parseInt(value, 10);
  if (!Number.isFinite(normalized) || normalized < 1) {
    return 1;
  }
  return normalized;
}

export function safeParseJson(value, fallback = null) {
  if (typeof value !== "string" || !value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function readLocalStorage(key, fallback = null) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorage(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readObservationDayIndex() {
  return normalizeObservationDayIndex(readLocalStorage(OBSERVATION_DAY_INDEX_KEY));
}

export function writeObservationDayIndex(dayIndex) {
  const safeDayIndex = normalizeObservationDayIndex(dayIndex);
  writeLocalStorage(OBSERVATION_DAY_INDEX_KEY, String(safeDayIndex));
  return safeDayIndex;
}

export function clearObservationDayIndex() {
  removeLocalStorage(OBSERVATION_DAY_INDEX_KEY);
}

export function hasDrivingSurveyDone() {
  return readLocalStorage(PLAYTEST2_DRIVING_SURVEY_DONE_KEY) === "1";
}

export function markDrivingSurveyDone() {
  return writeLocalStorage(PLAYTEST2_DRIVING_SURVEY_DONE_KEY, "1");
}

export function clearDrivingSurveyDone() {
  return removeLocalStorage(PLAYTEST2_DRIVING_SURVEY_DONE_KEY);
}
