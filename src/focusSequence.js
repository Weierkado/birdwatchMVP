const FOCUS_STATES = ["NORMAL", "INTERESTING", "REMARKABLE"];

const FALLBACK_SEQUENCE_CONFIG = {
  safetyMs: 1000,
  segmentCount: { min: 1, max: 3 },
  allowJump: true,
  stateWeights: {
    NORMAL: 50,
    INTERESTING: 40,
    REMARKABLE: 10
  },
  stateDurations: {
    NORMAL: { min: 500, max: 800 },
    INTERESTING: { min: 400, max: 650 },
    REMARKABLE: { min: 280, max: 450 }
  }
};

function isFocusState(state) {
  return FOCUS_STATES.includes(state);
}

function getNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getInteger(value, fallback) {
  return Math.floor(getNumber(value, fallback));
}

function clampInteger(value, min, max) {
  return Math.min(Math.max(getInteger(value, min), min), max);
}

function getDurationRange(state, sequenceConfig) {
  const fallbackRange = FALLBACK_SEQUENCE_CONFIG.stateDurations[state] || FALLBACK_SEQUENCE_CONFIG.stateDurations.NORMAL;
  const durations = sequenceConfig.stateDurations || {};
  const range = durations[state] || fallbackRange;
  const min = Math.max(getInteger(range.min, fallbackRange.min), 1);
  const max = Math.max(getInteger(range.max, fallbackRange.max), min);

  return { min, max };
}

function randomIntegerBetween(min, max, rng) {
  const safeMin = getInteger(min, 0);
  const safeMax = Math.max(getInteger(max, safeMin), safeMin);
  return safeMin + Math.floor(rng() * (safeMax - safeMin + 1));
}

function createDurationSegment(state, sequenceConfig, rng) {
  const range = getDurationRange(state, sequenceConfig);

  return {
    state,
    durationMs: randomIntegerBetween(range.min, range.max, rng)
  };
}

function pickWeightedState(candidates, sequenceConfig, rng) {
  const weights = sequenceConfig.stateWeights || {};
  const weightedCandidates = candidates
    .map((state) => ({
      state,
      weight: Math.max(getNumber(weights[state], 0), 0)
    }))
    .filter((item) => item.weight > 0);
  const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    return "";
  }

  let threshold = rng() * totalWeight;
  for (const item of weightedCandidates) {
    threshold -= item.weight;
    if (threshold <= 0) {
      return item.state;
    }
  }

  return weightedCandidates[weightedCandidates.length - 1].state;
}

export function createSeededRandom(seed) {
  let value = getInteger(seed, 0) || 1;

  return function seededRandom() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function getSafeSequenceConfig(config, outerBehaviorState) {
  const source = config && config.sequence ? config.sequence : FALLBACK_SEQUENCE_CONFIG;
  const fallback = FALLBACK_SEQUENCE_CONFIG;
  const segmentCount = source.segmentCount || fallback.segmentCount;
  const safeOuterState = isFocusState(outerBehaviorState) ? outerBehaviorState : "NORMAL";
  const minSegmentCount = clampInteger(segmentCount.min, fallback.segmentCount.min, 8);
  const maxSegmentCount = Math.max(clampInteger(segmentCount.max, fallback.segmentCount.max, 8), minSegmentCount);

  return {
    safetyMs: Math.max(getInteger(source.safetyMs, fallback.safetyMs), 0),
    segmentCount: {
      min: minSegmentCount,
      max: maxSegmentCount
    },
    allowJump: source.allowJump !== false,
    stateWeights: source.stateWeights || fallback.stateWeights,
    stateDurations: source.stateDurations || fallback.stateDurations,
    outerBehaviorState: safeOuterState
  };
}

export function pickNextState(currentState, sequenceConfig, rng = Math.random) {
  const safeConfig = sequenceConfig || FALLBACK_SEQUENCE_CONFIG;
  const safeCurrentState = isFocusState(currentState) ? currentState : "NORMAL";
  let candidates = FOCUS_STATES;

  if (safeConfig.allowJump === false) {
    if (safeCurrentState === "NORMAL") {
      candidates = ["NORMAL", "INTERESTING"];
    } else if (safeCurrentState === "REMARKABLE") {
      candidates = ["INTERESTING", "REMARKABLE"];
    }
  }

  const pickedState = pickWeightedState(candidates, safeConfig, rng);
  return pickedState || safeCurrentState || "NORMAL";
}

export function generateFocusSequence(config, outerBehaviorState, seed = 0) {
  const sequenceConfig = getSafeSequenceConfig(config, outerBehaviorState);
  const rng = createSeededRandom(seed);
  const startState = sequenceConfig.outerBehaviorState;
  const minCount = Math.min(sequenceConfig.segmentCount.min, sequenceConfig.segmentCount.max);
  const maxCount = Math.max(sequenceConfig.segmentCount.min, sequenceConfig.segmentCount.max);
  const middleSegmentCount = randomIntegerBetween(minCount, maxCount, rng);
  const segments = [createDurationSegment(startState, sequenceConfig, rng)];

  for (let index = 0; index < middleSegmentCount; index += 1) {
    const previousState = segments[segments.length - 1].state;
    const nextState = pickNextState(previousState, sequenceConfig, rng);
    segments.push(createDurationSegment(nextState, sequenceConfig, rng));
  }

  if (segments[segments.length - 1].state !== "NORMAL") {
    segments.push(createDurationSegment("NORMAL", sequenceConfig, rng));
  }

  segments.push({ state: "TRANSFER", durationMs: 0 });

  const totalDurationMs = segments.reduce((sum, segment) => {
    return segment.state === "TRANSFER" ? sum : sum + Math.max(getInteger(segment.durationMs, 0), 0);
  }, 0);

  return {
    segments,
    safetyMs: sequenceConfig.safetyMs,
    totalDurationMs
  };
}

export function getFocusSequenceState(sequence, elapsedMs) {
  const segments = sequence && Array.isArray(sequence.segments) ? sequence.segments : [];
  const safeElapsedMs = Math.max(getNumber(elapsedMs, 0), 0);
  let cursorMs = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index] || {};

    if (segment.state === "TRANSFER") {
      return {
        state: "TRANSFER",
        segmentIndex: index,
        isTransfer: true,
        elapsedInSegmentMs: 0
      };
    }

    const durationMs = Math.max(getInteger(segment.durationMs, 0), 0);
    if (safeElapsedMs < cursorMs + durationMs) {
      return {
        state: isFocusState(segment.state) ? segment.state : "NORMAL",
        segmentIndex: index,
        isTransfer: false,
        elapsedInSegmentMs: safeElapsedMs - cursorMs
      };
    }

    cursorMs += durationMs;
  }

  return {
    state: "TRANSFER",
    segmentIndex: Math.max(segments.length - 1, 0),
    isTransfer: true,
    elapsedInSegmentMs: 0
  };
}
