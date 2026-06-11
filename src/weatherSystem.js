import {
  WEATHER_SWITCH_PROB_PER_TURN,
  WEATHER_SWITCH_TURN_MAX,
  WEATHER_SWITCH_TURN_MIN,
  WEATHER_WEIGHTS
} from "../data/config.js";

const WEATHER_PROFILES = {
  CLEAR: {
    key: "CLEAR",
    label: "☀ 晴天",
    weatherKey: "weather_clear"
  },
  CLOUDY: {
    key: "CLOUDY",
    label: "☁ 阴天",
    weatherKey: "weather_cloudy"
  },
  RAIN: {
    key: "RAIN",
    label: "☂ 雨天",
    weatherKey: "weather_rain"
  },
  FOG: {
    key: "FOG",
    label: "〰 雾天",
    weatherKey: "weather_fog"
  }
};

const DEFAULT_WEATHER_KEY = "CLEAR";
const DEFAULT_CHANGE_TEXT = "天气有了变化。";

function getWeatherProfile(key) {
  return WEATHER_PROFILES[key] || WEATHER_PROFILES[DEFAULT_WEATHER_KEY];
}

function normalizeWeatherKey(key) {
  return WEATHER_PROFILES[key] ? key : DEFAULT_WEATHER_KEY;
}

function ensureWeatherState(state) {
  if (!state || typeof state !== "object") {
    return {
      current: DEFAULT_WEATHER_KEY,
      switched: false,
      initializedForDay: false
    };
  }

  if (!state.weather || typeof state.weather !== "object") {
    state.weather = {
      current: DEFAULT_WEATHER_KEY,
      switched: false,
      initializedForDay: false
    };
    return state.weather;
  }

  state.weather.current = normalizeWeatherKey(state.weather.current);
  state.weather.switched = state.weather.switched === true;
  state.weather.initializedForDay = state.weather.initializedForDay === true;
  return state.weather;
}

function getNumericConfigValue(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function pickWeightedWeatherKey(weights, excludedKey = "") {
  const candidates = Object.keys(WEATHER_PROFILES)
    .filter((key) => key !== excludedKey)
    .map((key) => ({
      key,
      weight: Math.max(0, Number(weights && weights[key]) || 0)
    }))
    .filter((item) => item.weight > 0);

  if (candidates.length <= 0) {
    return excludedKey && WEATHER_PROFILES[excludedKey] ? excludedKey : DEFAULT_WEATHER_KEY;
  }

  const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
  if (!(totalWeight > 0)) {
    return candidates[0].key;
  }

  let roll = Math.random() * totalWeight;
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= candidates[index].weight;
    if (roll <= 0) {
      return candidates[index].key;
    }
  }

  return candidates[candidates.length - 1].key;
}

export function createWeatherSystem(options = {}) {
  const eventSystem = options.eventSystem || null;
  const onWeatherChanged = typeof options.onWeatherChanged === "function"
    ? options.onWeatherChanged
    : null;
  const config = {
    switchTurnMin: getNumericConfigValue(
      options.config && options.config.switchTurnMin,
      WEATHER_SWITCH_TURN_MIN
    ),
    switchTurnMax: getNumericConfigValue(
      options.config && options.config.switchTurnMax,
      WEATHER_SWITCH_TURN_MAX
    ),
    switchProbPerTurn: getNumericConfigValue(
      options.config && options.config.switchProbPerTurn,
      WEATHER_SWITCH_PROB_PER_TURN
    ),
    weights: options.config && options.config.weights
      ? options.config.weights
      : WEATHER_WEIGHTS
  };

  function getCurrentProfile(state) {
    const weatherState = ensureWeatherState(state);
    return getWeatherProfile(weatherState.current);
  }

  function getCurrentLabel(state) {
    return getCurrentProfile(state).label || WEATHER_PROFILES[DEFAULT_WEATHER_KEY].label;
  }

  function getCurrentWeatherKey(state) {
    return getCurrentProfile(state).weatherKey || WEATHER_PROFILES[DEFAULT_WEATHER_KEY].weatherKey;
  }

  function getChangeText(fromKey, toKey) {
    const safeFromKey = normalizeWeatherKey(fromKey);
    const safeToKey = normalizeWeatherKey(toKey);

    if (safeToKey === "RAIN") {
      return "似乎开始下雨了。";
    }

    if (safeFromKey === "RAIN" && safeToKey === "CLEAR") {
      return "雨似乎停了。";
    }

    if (safeFromKey === "RAIN" && safeToKey === "CLOUDY") {
      return "雨停了，但天还阴着。";
    }

    if (safeFromKey === "CLEAR" && safeToKey === "CLOUDY") {
      return "天色有些阴沉。";
    }

    if (safeFromKey === "CLOUDY" && safeToKey === "CLEAR") {
      return "天气放晴了。";
    }

    if (safeToKey === "FOG") {
      return "起雾了，视野变差了。";
    }

    if (safeFromKey === "FOG" && safeToKey === "CLEAR") {
      return "雾散了。";
    }

    if (safeFromKey === "FOG" && safeToKey === "CLOUDY") {
      return "雾散了，但天还阴着。";
    }

    return DEFAULT_CHANGE_TEXT;
  }

  function initForSession(state) {
    const weatherState = ensureWeatherState(state);

    if (weatherState.initializedForDay === true) {
      return getCurrentProfile(state);
    }

    weatherState.current = pickWeightedWeatherKey(config.weights);
    weatherState.switched = false;
    weatherState.initializedForDay = true;
    return getCurrentProfile(state);
  }

  function trySwitch(state) {
    const weatherState = ensureWeatherState(state);
    const currentTurn = Number(state && state.currentTurn);

    if (weatherState.initializedForDay !== true) {
      return false;
    }

    if (state && state.mode === "SETTLEMENT") {
      return false;
    }

    if (weatherState.switched === true) {
      return false;
    }

    if (!Number.isFinite(currentTurn)) {
      return false;
    }

    if (currentTurn < config.switchTurnMin || currentTurn > config.switchTurnMax) {
      return false;
    }

    if (Math.random() > config.switchProbPerTurn) {
      return false;
    }

    const previousKey = normalizeWeatherKey(weatherState.current);
    const nextKey = pickWeightedWeatherKey(config.weights, previousKey);

    if (nextKey === previousKey) {
      return false;
    }

    weatherState.current = nextKey;
    weatherState.switched = true;

    const result = {
      fromKey: previousKey,
      toKey: nextKey,
      profile: getCurrentProfile(state),
      text: getChangeText(previousKey, nextKey)
    };

    if (eventSystem && typeof eventSystem.dispatch === "function") {
      eventSystem.dispatch({
        type: "WEATHER_CHANGE",
        text: result.text,
        priority: "high"
      });
    }

    if (onWeatherChanged) {
      onWeatherChanged(result, state);
    }

    return result;
  }

  return {
    initForSession,
    trySwitch,
    getCurrentProfile,
    getCurrentLabel,
    getCurrentWeatherKey,
    getChangeText
  };
}
