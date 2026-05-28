/**
 * 模块职责：
 * - 纯计算 FOCUS 阶段徽章的归一化位置和合焦结果。
 * - position 以 { x: 0, y: 0 } 为中心，通常落在 [-1, 1] 附近。
 *
 * 维护边界：
 * - 不访问 DOM，不读写 LocalStorage，不管理 rAF。
 * - main.js 负责把归一化坐标转换成像素并渲染 moving badge。
 */
import { BADGE_ROTATION, CAMERA_FOCUS_CONFIG } from "../data/config.js";
import { focusConfig } from "../data/focusConfig.js";

const FALLBACK_STATE_CONFIG = {
  pattern: "still",
  layers: [
    { ax: 0.08, wx: 1.8, phix: 0.0, ay: 0.06, wy: 1.6, phiy: 0.7 }
  ],
  enter: null,
  stutter: null,
  focus: { green: 0.32, perfect: 0.12 }
};
const POSITION_LIMIT = 1;
const PATTERN_ANCHOR_LIMIT = 0.82;
const GLIDE_SOFT_LIMIT = 0.9;

const AFFIX_DISPLAY = {
  BLUR: {
    key: "BLUR",
    label: "丢焦",
    description: "焦点偏离明显，照片质量受到影响。"
  },
  OK: {
    key: "OK",
    label: "尚可",
    description: "焦点落在可接受范围内，照片可以记录。"
  },
  PERFECT: {
    key: "PERFECT",
    label: "毕业",
    description: "焦点非常准确，抓到了理想瞬间。"
  }
};

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function normalizeTime(t) {
  return Math.max(Number(t) || 0, 0);
}

function normalizeSeed(seed) {
  const numberSeed = Number(seed);
  if (!Number.isFinite(numberSeed)) {
    return 0;
  }

  return Math.floor(numberSeed);
}

function pseudoRandom(seed, index) {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getLayerValue(layer, key, fallback = 0) {
  const value = layer && Number(layer[key]);
  return Number.isFinite(value) ? value : fallback;
}

function computeLayerPosition(config, t) {
  const position = { x: 0, y: 0 };
  const layers = Array.isArray(config.layers) ? config.layers : [];

  layers.forEach((layer) => {
    position.x += getLayerValue(layer, "ax") * Math.sin(
      getLayerValue(layer, "wx") * t + getLayerValue(layer, "phix")
    );
    position.y += getLayerValue(layer, "ay") * Math.sin(
      getLayerValue(layer, "wy") * t + getLayerValue(layer, "phiy")
    );
  });

  return position;
}

function clampPosition(position) {
  const safeX = Number(position && position.x);
  const safeY = Number(position && position.y);
  return {
    x: clamp(Number.isFinite(safeX) ? safeX : 0, -POSITION_LIMIT, POSITION_LIMIT),
    y: clamp(Number.isFinite(safeY) ? safeY : 0, -POSITION_LIMIT, POSITION_LIMIT)
  };
}

function clampAnchorPosition(position) {
  const safe = clampPosition(position);
  return {
    x: clamp(safe.x, -PATTERN_ANCHOR_LIMIT, PATTERN_ANCHOR_LIMIT),
    y: clamp(safe.y, -PATTERN_ANCHOR_LIMIT, PATTERN_ANCHOR_LIMIT)
  };
}

function sanitizeInitialPosition(position) {
  if (!position || typeof position !== "object") {
    return null;
  }

  const x = Number(position.x);
  const y = Number(position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return clampPosition({ x, y });
}

function getNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getRange(minValue, maxValue, fallbackMin, fallbackMax) {
  const safeMin = getNumber(minValue, fallbackMin);
  const safeMax = getNumber(maxValue, fallbackMax);
  return safeMin <= safeMax ? [safeMin, safeMax] : [safeMax, safeMin];
}

function randomBetween(seed, index, minValue, maxValue) {
  return lerp(minValue, maxValue, pseudoRandom(seed, index));
}

function createVectorFromAngle(angle) {
  const safeAngle = getNumber(angle, 0);
  return {
    x: Math.cos(safeAngle),
    y: Math.sin(safeAngle)
  };
}

function normalizeVector(vector, fallback = { x: 1, y: 0 }) {
  const x = getNumber(vector && vector.x, fallback.x);
  const y = getNumber(vector && vector.y, fallback.y);
  const length = Math.sqrt(x * x + y * y);
  if (length <= 0.000001) {
    return { ...fallback };
  }

  return { x: x / length, y: y / length };
}

function rotateVector(vector, angle) {
  const safeVector = normalizeVector(vector);
  const safeAngle = getNumber(angle, 0);
  const cosAngle = Math.cos(safeAngle);
  const sinAngle = Math.sin(safeAngle);
  return {
    x: safeVector.x * cosAngle - safeVector.y * sinAngle,
    y: safeVector.x * sinAngle + safeVector.y * cosAngle
  };
}

function easeOutCubic(value) {
  const amount = clamp(value, 0, 1);
  return 1 - ((1 - amount) * (1 - amount) * (1 - amount));
}

function createPatternAnchor(seed, index, amplitude = 0.6) {
  const safeAmplitude = Math.max(0, getNumber(amplitude, 0.6));
  return clampAnchorPosition({
    x: (pseudoRandom(seed, index) * 2 - 1) * safeAmplitude,
    y: (pseudoRandom(seed, index + 1) * 2 - 1) * safeAmplitude
  });
}

function createHopPoint(seed, index, distance) {
  return {
    x: (pseudoRandom(seed, index * 2) * 2 - 1) * distance,
    y: (pseudoRandom(seed, index * 2 + 1) * 2 - 1) * distance
  };
}

function easeInOut(value) {
  const amount = clamp(value, 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function getHopSettings(config) {
  const hop = config.hop || {};

  return {
    distance: Math.max(Number(hop.distance) || 0.4, 0),
    pauseDuration: Math.max(Number(hop.pauseDuration) || 1.0, 0.01),
    tweenDuration: Math.max(Number(hop.tweenDuration) || 0.2, 0.01),
    pauseJitter: Math.max(Number(hop.pauseJitter) || 0, 0)
  };
}

function createInitialHopState(seed, initialPosition = null) {
  const initial = clampPosition(initialPosition || { x: 0, y: 0 });
  return {
    mode: "pausing",
    phaseStart: 0,
    phaseEnd: 0,
    hopIndex: 0,
    from: { ...initial },
    to: { ...initial },
    current: { ...initial },
    seed
  };
}

function startPause(hopState, now, settings) {
  hopState.mode = "pausing";
  hopState.phaseStart = now;
  hopState.phaseEnd = now + settings.pauseDuration;
  hopState.from = { ...hopState.current };
  hopState.to = { ...hopState.current };
}

function startTween(hopState, now, settings) {
  hopState.mode = "tweening";
  hopState.phaseStart = now;
  hopState.phaseEnd = now + settings.tweenDuration;
  hopState.from = { ...hopState.current };
  hopState.hopIndex += 1;
  hopState.to = createHopPoint(hopState.seed, hopState.hopIndex, settings.distance);
}

function prepareHopState(runtime, t, settings) {
  const hopState = runtime.hopState || createInitialHopState(runtime.seed, runtime.initialPosition);
  runtime.hopState = hopState;

  if (hopState.phaseEnd <= hopState.phaseStart) {
    startPause(hopState, 0, settings);
  }

  if (t < hopState.phaseStart) {
    runtime.hopState = createInitialHopState(runtime.seed, runtime.initialPosition);
    startPause(runtime.hopState, 0, settings);
    return runtime.hopState;
  }

  let guard = 0;
  while (t >= hopState.phaseEnd && guard < 100) {
    if (hopState.mode === "pausing") {
      startTween(hopState, hopState.phaseEnd, settings);
    } else {
      hopState.current = { ...hopState.to };
      startPause(hopState, hopState.phaseEnd, settings);
    }
    guard += 1;
  }

  return hopState;
}

function computeBounceHopPosition(runtime, t) {
  const settings = getHopSettings(runtime.config);
  const hopState = prepareHopState(runtime, t, settings);

  if (hopState.mode === "tweening") {
    const progress = (t - hopState.phaseStart) / (hopState.phaseEnd - hopState.phaseStart);
    const amount = easeInOut(progress);
    hopState.current = {
      x: lerp(hopState.from.x, hopState.to.x, amount),
      y: lerp(hopState.from.y, hopState.to.y, amount)
    };
    return clampPosition(hopState.current);
  }

  const jitter = settings.pauseJitter;
  const position = {
    x: hopState.current.x + jitter * Math.sin(17.0 * t + runtime.seed),
    y: hopState.current.y + jitter * Math.sin(13.0 * t + runtime.seed * 0.5)
  };

  return clampPosition(position);
}

function getDartSettings(config) {
  const dart = config && typeof config.dart === "object" ? config.dart : {};
  const [idleMin, idleMax] = getRange(dart.idleMin, dart.idleMax, 0.6, 1.4);
  return {
    idleMin: Math.max(idleMin, 0.08),
    idleMax: Math.max(idleMax, Math.max(idleMin, 0.08)),
    dartDist: Math.max(getNumber(dart.dartDist, 0.35), 0.05),
    dartDuration: Math.max(getNumber(dart.dartDuration, 0.22), 0.05),
    anchorJitter: Math.max(getNumber(dart.anchorJitter, 0.04), 0),
    settleDuration: Math.max(getNumber(dart.settleDuration, 0.10), 0.02)
  };
}

function createInitialDartState(seed, initialPosition = null) {
  const anchor = initialPosition
    ? clampAnchorPosition(initialPosition)
    : createPatternAnchor(seed, 301, 0.55);
  return {
    mode: "idle",
    phaseStart: 0,
    phaseEnd: 0,
    phaseIndex: 0,
    anchor,
    from: { ...anchor },
    to: { ...anchor },
    seed
  };
}

function getDartIdleDuration(state, settings) {
  return randomBetween(state.seed, 310 + state.phaseIndex * 7, settings.idleMin, settings.idleMax);
}

function getDartDirection(state) {
  const angle = randomBetween(state.seed, 312 + state.phaseIndex * 7, 0, Math.PI * 2);
  return createVectorFromAngle(angle);
}

function getDartDistance(state, settings) {
  return randomBetween(
    state.seed,
    314 + state.phaseIndex * 7,
    settings.dartDist * 0.7,
    settings.dartDist * 1.3
  );
}

function startDartIdle(state, now, settings) {
  state.mode = "idle";
  state.phaseStart = now;
  state.phaseEnd = now + getDartIdleDuration(state, settings);
  state.from = { ...state.anchor };
  state.to = { ...state.anchor };
}

function startDartMove(state, now, settings) {
  const direction = getDartDirection(state);
  const distance = getDartDistance(state, settings);
  const nextAnchor = clampAnchorPosition({
    x: state.anchor.x + direction.x * distance,
    y: state.anchor.y + direction.y * distance
  });

  state.mode = "dart";
  state.phaseStart = now;
  state.phaseEnd = now + settings.dartDuration;
  state.from = { ...state.anchor };
  state.to = nextAnchor;
}

function startDartSettle(state, now, settings) {
  state.mode = "settle";
  state.phaseStart = now;
  state.phaseEnd = now + settings.settleDuration;
  state.anchor = clampAnchorPosition(state.to);
}

function prepareDartState(runtime, t, settings) {
  const state = runtime.dartState || createInitialDartState(runtime.seed, runtime.initialPosition);
  runtime.dartState = state;

  if (state.phaseEnd <= state.phaseStart) {
    startDartIdle(state, 0, settings);
  }

  if (t < state.phaseStart) {
    runtime.dartState = createInitialDartState(runtime.seed, runtime.initialPosition);
    startDartIdle(runtime.dartState, 0, settings);
    return runtime.dartState;
  }

  let guard = 0;
  while (t >= state.phaseEnd && guard < 100) {
    state.phaseIndex += 1;
    if (state.mode === "idle") {
      startDartMove(state, state.phaseEnd, settings);
    } else if (state.mode === "dart") {
      startDartSettle(state, state.phaseEnd, settings);
    } else {
      startDartIdle(state, state.phaseEnd, settings);
    }
    guard += 1;
  }

  return state;
}

function computeDartPosition(runtime, t) {
  const settings = getDartSettings(runtime.config);
  const state = prepareDartState(runtime, t, settings);

  if (state.mode === "dart") {
    const progress = (t - state.phaseStart) / Math.max(state.phaseEnd - state.phaseStart, 0.0001);
    const amount = easeOutCubic(progress);
    return clampPosition({
      x: lerp(state.from.x, state.to.x, amount),
      y: lerp(state.from.y, state.to.y, amount)
    });
  }

  const jitterScale = state.mode === "settle" ? 0.28 : 1;
  const jitter = settings.anchorJitter * jitterScale;
  const baseIndex = 320 + state.phaseIndex * 5;
  return clampPosition({
    x: state.anchor.x + jitter * Math.sin(13.0 * t + pseudoRandom(state.seed, baseIndex) * Math.PI * 2),
    y: state.anchor.y + jitter * Math.sin(17.0 * t + pseudoRandom(state.seed, baseIndex + 1) * Math.PI * 2)
  });
}

function getFreezeBurstSettings(config) {
  const burst = config && typeof config.burst === "object" ? config.burst : {};
  const [freezeMin, freezeMax] = getRange(burst.freezeMin, burst.freezeMax, 2.4, 4.0);
  const [burstMin, burstMax] = getRange(burst.burstMin, burst.burstMax, 0.4, 0.7);
  return {
    freezeMin: Math.max(freezeMin, 0.2),
    freezeMax: Math.max(freezeMax, Math.max(freezeMin, 0.2)),
    burstMin: Math.max(burstMin, 0.08),
    burstMax: Math.max(burstMax, Math.max(burstMin, 0.08)),
    burstDist: Math.max(getNumber(burst.burstDist, 0.28), 0.05)
  };
}

function createInitialFreezeBurstState(seed, initialPosition = null) {
  const direction = createVectorFromAngle(randomBetween(seed, 401, 0, Math.PI * 2));
  const anchor = initialPosition
    ? clampAnchorPosition(initialPosition)
    : createPatternAnchor(seed, 403, 0.62);
  return {
    mode: "freeze",
    phaseStart: 0,
    phaseEnd: 0,
    phaseIndex: 0,
    direction,
    anchor,
    from: { ...anchor },
    to: { ...anchor },
    seed
  };
}

function startFreeze(state, now, settings) {
  state.mode = "freeze";
  state.phaseStart = now;
  state.phaseEnd = now + randomBetween(
    state.seed,
    410 + state.phaseIndex * 7,
    settings.freezeMin,
    settings.freezeMax
  );
  state.from = { ...state.anchor };
  state.to = { ...state.anchor };
}

function startBurst(state, now, settings) {
  const distance = randomBetween(
    state.seed,
    412 + state.phaseIndex * 7,
    settings.burstDist * 0.85,
    settings.burstDist * 1.15
  );
  const target = clampAnchorPosition({
    x: state.anchor.x + state.direction.x * distance,
    y: state.anchor.y + state.direction.y * distance
  });

  state.mode = "burst";
  state.phaseStart = now;
  state.phaseEnd = now + randomBetween(
    state.seed,
    414 + state.phaseIndex * 7,
    settings.burstMin,
    settings.burstMax
  );
  state.from = { ...state.anchor };
  state.to = target;
}

function updateFreezeDirection(state) {
  const deltaAngle = randomBetween(state.seed, 418 + state.phaseIndex * 7, -0.55, 0.55);
  state.direction = normalizeVector(rotateVector(state.direction, Math.PI + deltaAngle));
}

function prepareFreezeBurstState(runtime, t, settings) {
  const state = runtime.freezeBurstState || createInitialFreezeBurstState(runtime.seed, runtime.initialPosition);
  runtime.freezeBurstState = state;

  if (state.phaseEnd <= state.phaseStart) {
    startFreeze(state, 0, settings);
  }

  if (t < state.phaseStart) {
    runtime.freezeBurstState = createInitialFreezeBurstState(runtime.seed, runtime.initialPosition);
    startFreeze(runtime.freezeBurstState, 0, settings);
    return runtime.freezeBurstState;
  }

  let guard = 0;
  while (t >= state.phaseEnd && guard < 100) {
    state.phaseIndex += 1;
    if (state.mode === "freeze") {
      startBurst(state, state.phaseEnd, settings);
    } else {
      state.anchor = clampAnchorPosition(state.to);
      updateFreezeDirection(state);
      startFreeze(state, state.phaseEnd, settings);
    }
    guard += 1;
  }

  return state;
}

function computeFreezeBurstPosition(runtime, t) {
  const settings = getFreezeBurstSettings(runtime.config);
  const state = prepareFreezeBurstState(runtime, t, settings);

  if (state.mode === "burst") {
    const progress = (t - state.phaseStart) / Math.max(state.phaseEnd - state.phaseStart, 0.0001);
    const amount = easeOutCubic(progress);
    return clampPosition({
      x: lerp(state.from.x, state.to.x, amount),
      y: lerp(state.from.y, state.to.y, amount)
    });
  }

  const drift = Math.min(0.018, Math.max(0.004, settings.burstDist * 0.03));
  const index = 430 + state.phaseIndex * 3;
  return clampPosition({
    x: state.anchor.x + drift * Math.sin(1.1 * t + pseudoRandom(state.seed, index) * Math.PI * 2),
    y: state.anchor.y + drift * Math.sin(0.9 * t + pseudoRandom(state.seed, index + 1) * Math.PI * 2)
  });
}

function getGlideSettings(config) {
  const glide = config && typeof config.glide === "object" ? config.glide : {};
  const [velocityMin, velocityMax] = getRange(glide.flowVelocityMin, glide.flowVelocityMax, 0.06, 0.09);
  const [reverseMin, reverseMax] = getRange(glide.flowReverseMin, glide.flowReverseMax, 2.5, 4.5);
  return {
    flowVelocityMin: Math.max(velocityMin, 0.01),
    flowVelocityMax: Math.max(velocityMax, Math.max(velocityMin, 0.01)),
    flowReverseMin: Math.max(reverseMin, 0.25),
    flowReverseMax: Math.max(reverseMax, Math.max(reverseMin, 0.25))
  };
}

function createInitialGlideState(seed, initialFlowStart = null) {
  const direction = createVectorFromAngle(randomBetween(seed, 501, 0, Math.PI * 2));
  const flowStart = clampPosition(initialFlowStart || { x: 0, y: 0 });
  return {
    segmentStart: 0,
    segmentEnd: 0,
    segmentIndex: 0,
    direction: normalizeVector(direction),
    velocity: 0.07,
    flowStart: { ...flowStart },
    flow: { ...flowStart },
    seed
  };
}

function computeGlideFlowAt(state, t) {
  const duration = Math.max(t - state.segmentStart, 0);
  return {
    x: state.flowStart.x + state.direction.x * state.velocity * duration,
    y: state.flowStart.y + state.direction.y * state.velocity * duration
  };
}

function startGlideSegment(state, now, settings, isFirst) {
  if (!isFirst) {
    const angleOffset = randomBetween(state.seed, 510 + state.segmentIndex * 5, -0.35, 0.35);
    state.direction = normalizeVector(rotateVector({
      x: -state.direction.x,
      y: -state.direction.y
    }, angleOffset));
  }

  state.velocity = randomBetween(
    state.seed,
    511 + state.segmentIndex * 5,
    settings.flowVelocityMin,
    settings.flowVelocityMax
  );
  const segmentDuration = randomBetween(
    state.seed,
    512 + state.segmentIndex * 5,
    settings.flowReverseMin,
    settings.flowReverseMax
  );
  state.segmentStart = now;
  state.segmentEnd = now + segmentDuration;
}

function prepareGlideState(runtime, t, settings) {
  const state = runtime.glideState || createInitialGlideState(runtime.seed, runtime.initialGlideFlowStart);
  runtime.glideState = state;

  if (state.segmentEnd <= state.segmentStart) {
    startGlideSegment(state, 0, settings, true);
  }

  if (t < state.segmentStart) {
    runtime.glideState = createInitialGlideState(runtime.seed, runtime.initialGlideFlowStart);
    startGlideSegment(runtime.glideState, 0, settings, true);
    return runtime.glideState;
  }

  let guard = 0;
  while (t >= state.segmentEnd && guard < 100) {
    state.flow = computeGlideFlowAt(state, state.segmentEnd);
    state.flowStart = { ...state.flow };
    state.segmentIndex += 1;
    startGlideSegment(state, state.segmentEnd, settings, false);
    guard += 1;
  }

  state.flow = computeGlideFlowAt(state, t);
  return state;
}

function applyGlideSoftBounds(position) {
  const x = getNumber(position && position.x, 0);
  const y = getNumber(position && position.y, 0);
  const soft = Math.max(GLIDE_SOFT_LIMIT, 0.4);

  return {
    x: soft * Math.tanh(x / soft),
    y: soft * Math.tanh(y / soft)
  };
}

function computeGlidePosition(runtime, t, basePosition) {
  const settings = getGlideSettings(runtime.config);
  const state = prepareGlideState(runtime, t, settings);
  const base = clampPosition(basePosition);
  return clampPosition(applyGlideSoftBounds({
    x: base.x + state.flow.x,
    y: base.y + state.flow.y
  }));
}

function applyEnterDrift(position, config, t) {
  const enter = config.enter;
  if (!enter) {
    return position;
  }

  const decay = Math.max(Number(enter.decay) || 0, 0);
  const scale = Math.exp(-decay * t);

  return {
    x: position.x + (Number(enter.x0) || 0) * scale,
    y: position.y + (Number(enter.y0) || 0) * scale
  };
}

function getStutteredTime(runtime, t) {
  const config = runtime.config || FALLBACK_STATE_CONFIG;
  const stutter = config.stutter;
  if (!stutter) {
    return t;
  }

  const interval = Math.max(Number(stutter.interval) || 0, 0);
  const holdDuration = Math.max(Number(stutter.holdDuration) || 0, 0);

  if (interval <= 0 || holdDuration <= 0) {
    return t;
  }

  const cycleTime = t % interval;
  if (cycleTime > holdDuration) {
    return t;
  }

  if (!runtime.stutterState) {
    runtime.stutterState = { lastHoldTime: 0 };
  }

  runtime.stutterState.lastHoldTime = t - cycleTime;
  return runtime.stutterState.lastHoldTime;
}

export function getFocusConfig(speciesId, behaviorState) {
  const speciesConfig = focusConfig[speciesId] || null;

  if (!speciesConfig) {
    return FALLBACK_STATE_CONFIG;
  }

  const safeBehaviorState = behaviorState === "FLY_AWAY" ? "NORMAL" : behaviorState;
  return speciesConfig[safeBehaviorState] || speciesConfig.NORMAL || FALLBACK_STATE_CONFIG;
}

/**
 * 创建一次 FOCUS 阶段的运动运行时。
 *
 * 注意：
 * - 这里只保存运动计算所需状态，不负责 UI，也不负责拍照结算。
 */
export function createFocusRuntime(config, seed = 0, options = {}) {
  const safeConfig = config || FALLBACK_STATE_CONFIG;
  const safeSeed = normalizeSeed(seed);
  const initialPosition = sanitizeInitialPosition(options && options.initialPosition);
  const initialGlideFlowStart = initialPosition
    ? clampPosition({
      x: initialPosition.x - computeLayerPosition(safeConfig, 0).x,
      y: initialPosition.y - computeLayerPosition(safeConfig, 0).y
    })
    : null;

  const runtime = {
    config: safeConfig,
    seed: safeSeed,
    initialPosition,
    initialGlideFlowStart,
    positionOffset: { x: 0, y: 0 },
    startTime: 0,
    hopState: createInitialHopState(safeSeed, initialPosition),
    dartState: createInitialDartState(safeSeed, initialPosition),
    freezeBurstState: createInitialFreezeBurstState(safeSeed, initialPosition),
    glideState: createInitialGlideState(safeSeed, initialGlideFlowStart),
    stutterState: {
      lastHoldTime: 0
    },
    previousBadgePosition: null,
    currentBadgeRotation: 0,
    rotationSeed: pseudoRandom(safeSeed, 97),
    rotationMaxSpeed: 0.08
  };

  if (initialPosition) {
    const baseAtStart = computePatternPosition(runtime, 0);
    runtime.positionOffset = {
      x: initialPosition.x - baseAtStart.x,
      y: initialPosition.y - baseAtStart.y
    };
  }

  return runtime;
}

export function computeBadgeRotation(runtime, t, displayPosition) {
  const safeRuntime = runtime || createFocusRuntime(FALLBACK_STATE_CONFIG, 0);
  const safePosition = displayPosition || { x: 0, y: 0 };
  const previousPosition = safeRuntime.previousBadgePosition || safePosition;
  const maxDegrees = Math.max(Number(BADGE_ROTATION.maxDegrees) || 30, 0);
  const oscillationDegrees = Math.max(Number(BADGE_ROTATION.oscillationDegrees) || 0, 0);
  const smoothing = clamp(Number(BADGE_ROTATION.smoothing) || 0.18, 0, 1);
  const maxSpeed = Math.max(Number(safeRuntime.rotationMaxSpeed) || 0.08, 0.001);
  const dx = (Number(safePosition.x) || 0) - (Number(previousPosition.x) || 0);
  const trajectoryRotation = clamp(dx / maxSpeed, -1, 1) * maxDegrees;
  const seed = Number(safeRuntime.rotationSeed) || 0;
  const oscillationRotation = oscillationDegrees * Math.sin(0.9 * normalizeTime(t) + seed * 1.7);
  const targetRotation = clamp(trajectoryRotation + oscillationRotation, -maxDegrees, maxDegrees);
  const previousRotation = Number.isFinite(safeRuntime.currentBadgeRotation)
    ? safeRuntime.currentBadgeRotation
    : targetRotation;
  const currentRotation = lerp(previousRotation, targetRotation, smoothing);

  safeRuntime.previousBadgePosition = { ...safePosition };
  safeRuntime.currentBadgeRotation = currentRotation;

  return currentRotation;
}

/**
 * 根据 pattern / layers / t 计算徽章位置。
 *
 * 返回：
 * - 归一化坐标，不是 px。
 */
function computePatternPosition(runtime, t) {
  const safeRuntime = runtime || createFocusRuntime(FALLBACK_STATE_CONFIG, 0);
  const config = safeRuntime.config || FALLBACK_STATE_CONFIG;
  safeRuntime.config = config;
  const time = getStutteredTime(safeRuntime, normalizeTime(t));
  const pattern = config.pattern || "still";

  // x and y are normalized camera offsets. The center of focus is { x: 0, y: 0 }.
  if (pattern === "bounce_hop") {
    return computeBounceHopPosition(safeRuntime, time);
  }

  let position = computeLayerPosition(config, time);

  if (pattern === "drift_to_center") {
    position = applyEnterDrift(position, config, time);
  }

  if (pattern === "dart") {
    return computeDartPosition(safeRuntime, time);
  }

  if (pattern === "freeze_burst") {
    return computeFreezeBurstPosition(safeRuntime, time);
  }

  if (pattern === "glide") {
    return computeGlidePosition(safeRuntime, time, position);
  }

  // still, wander, jitter, sweep, and unknown patterns all use layer motion.
  return clampPosition(position);
}

export function computeFocusPosition(runtime, t) {
  const safeRuntime = runtime || createFocusRuntime(FALLBACK_STATE_CONFIG, 0);
  const rawPosition = computePatternPosition(safeRuntime, t);
  const offset = safeRuntime.positionOffset || { x: 0, y: 0 };
  return clampPosition({
    x: rawPosition.x + (Number(offset.x) || 0),
    y: rawPosition.y + (Number(offset.y) || 0)
  });
}

export function getFocusDistance(position) {
  const safePosition = position || { x: 0, y: 0 };
  const x = Number(safePosition.x) || 0;
  const y = Number(safePosition.y) || 0;
  return Math.sqrt(x * x + y * y);
}

function getFocusNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getFocusBoxSize(config) {
  return {
    halfWidth: Math.max(getFocusNumber(CAMERA_FOCUS_CONFIG.boxHalfWidth, FALLBACK_STATE_CONFIG.focus.green), 0),
    halfHeight: Math.max(getFocusNumber(CAMERA_FOCUS_CONFIG.boxHalfHeight, FALLBACK_STATE_CONFIG.focus.green * 0.65), 0)
  };
}

/**
 * 当前主合焦判定：中心矩形命中。
 *
 * 注意：
 * - 矩形半宽半高来自 CAMERA_FOCUS_CONFIG。
 * - 鸟种配置里的 focus.green 只作为历史 fallback，不再是主判定框大小来源。
 */
export function isInFocusBox(position, config) {
  const safePosition = position || { x: 0, y: 0 };
  const x = Number(safePosition.x) || 0;
  const y = Number(safePosition.y) || 0;
  const boxSize = getFocusBoxSize(config);

  return Math.abs(x) <= boxSize.halfWidth && Math.abs(y) <= boxSize.halfHeight;
}

export function getFocusAffix(distance, config) {
  const safeDistance = Math.max(Number(distance) || 0, 0);
  const green = Math.max(getFocusNumber(CAMERA_FOCUS_CONFIG.boxHalfWidth, FALLBACK_STATE_CONFIG.focus.green), 0);
  const perfect = Math.max(getFocusNumber(CAMERA_FOCUS_CONFIG.perfect, FALLBACK_STATE_CONFIG.focus.perfect), 0);

  // The smaller the distance, the closer the sight is to the focus center.
  if (safeDistance < perfect) {
    return "PERFECT";
  }

  if (safeDistance < green) {
    return "OK";
  }

  return "BLUR";
}

/**
 * 将位置转换为内部对焦词缀。
 *
 * 注意：
 * - PERFECT / OK / BLUR 仍作为内部细分保留。
 * - 当前 UI 第一版只把 OK / PERFECT 折叠为 IN_FOCUS 语义，不要直接暴露“毕业”。
 */
export function getFocusAffixFromPosition(position, config) {
  const safeConfig = config || FALLBACK_STATE_CONFIG;
  const distance = getFocusDistance(position);
  const perfect = Math.max(getFocusNumber(CAMERA_FOCUS_CONFIG.perfect, FALLBACK_STATE_CONFIG.focus.perfect), 0);

  if (distance < perfect) {
    return "PERFECT";
  }

  if (isInFocusBox(position, safeConfig)) {
    return "OK";
  }

  return "BLUR";
}

export function getFocusAffixDisplay(affix) {
  return AFFIX_DISPLAY[affix] || AFFIX_DISPLAY.BLUR;
}

/**
 * UI 绿框判定入口。
 *
 * 注意：
 * - 传 position 时走中心矩形判定。
 * - 传 number 是历史距离判定兼容路径，新增逻辑应优先传 position。
 */
export function isInGreenZone(positionOrDistance, config) {
  if (typeof positionOrDistance !== "number") {
    return isInFocusBox(positionOrDistance, config);
  }

  const green = Math.max(getFocusNumber(CAMERA_FOCUS_CONFIG.boxHalfWidth, FALLBACK_STATE_CONFIG.focus.green), 0);
  return Math.max(Number(positionOrDistance) || 0, 0) < green;
}

export function evaluateFocus(runtime, t) {
  const safeRuntime = runtime || createFocusRuntime(FALLBACK_STATE_CONFIG, 0);
  safeRuntime.config = safeRuntime.config || FALLBACK_STATE_CONFIG;
  const position = computeFocusPosition(safeRuntime, t);
  const distance = getFocusDistance(position);
  const affix = getFocusAffixFromPosition(position, safeRuntime.config);

  return {
    position,
    distance,
    affix,
    affixDisplay: getFocusAffixDisplay(affix),
    isGreen: isInFocusBox(position, safeRuntime.config)
  };
}
