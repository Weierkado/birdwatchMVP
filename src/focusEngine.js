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
  return {
    x: clamp(position.x, -1, 1),
    y: clamp(position.y, -1, 1)
  };
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

function createInitialHopState(seed) {
  return {
    mode: "pausing",
    phaseStart: 0,
    phaseEnd: 0,
    hopIndex: 0,
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
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
  const hopState = runtime.hopState || createInitialHopState(runtime.seed);
  runtime.hopState = hopState;

  if (hopState.phaseEnd <= hopState.phaseStart) {
    startPause(hopState, 0, settings);
  }

  if (t < hopState.phaseStart) {
    runtime.hopState = createInitialHopState(runtime.seed);
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
export function createFocusRuntime(config, seed = 0) {
  const safeConfig = config || FALLBACK_STATE_CONFIG;
  const safeSeed = normalizeSeed(seed);

  return {
    config: safeConfig,
    seed: safeSeed,
    startTime: 0,
    hopState: createInitialHopState(safeSeed),
    stutterState: {
      lastHoldTime: 0
    },
    previousBadgePosition: null,
    currentBadgeRotation: 0,
    rotationSeed: pseudoRandom(safeSeed, 97),
    rotationMaxSpeed: 0.08
  };
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
export function computeFocusPosition(runtime, t) {
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

  // still, wander, jitter, sweep, and unknown patterns all use layer motion.
  return clampPosition(position);
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
