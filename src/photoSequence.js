import { PHOTO_SEQUENCE_CONFIG, PHOTO_SEQUENCE_CONFIG_BY_SPECIES } from "../data/config.js";

export const BEHAVIOR_STATE_DISPLAY = {
  NORMAL: {
    label: "寻常",
    className: "state-normal",
    description: "它保持着普通姿态，适合安全记录。",
    hint: "稳定但价值较低"
  },
  INTERESTING: {
    label: "有趣",
    className: "state-interesting",
    description: "它出现了更有记录价值的行为。",
    hint: "可以考虑拍摄"
  },
  REMARKABLE: {
    label: "精彩",
    className: "state-remarkable",
    description: "这是难得的精彩瞬间！",
    hint: "高价值窗口，可能转瞬即逝"
  },
  FLY_AWAY: {
    label: "飞离",
    className: "state-fly-away",
    description: "它察觉到动静，飞离了视野。",
    hint: "鸟已飞离"
  }
};

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getPhotoSequenceConfig(speciesId) {
  const speciesConfig = PHOTO_SEQUENCE_CONFIG_BY_SPECIES[speciesId] || {};
  const stateWeights = speciesConfig.stateWeights || PHOTO_SEQUENCE_CONFIG.stateWeights;
  const minDecisions = Math.max(1, Math.floor(getNumber(
    speciesConfig.minDecisions,
    PHOTO_SEQUENCE_CONFIG.minDecisions
  )));
  const maxDecisions = Math.max(minDecisions, Math.floor(getNumber(
    speciesConfig.maxDecisions,
    PHOTO_SEQUENCE_CONFIG.maxDecisions
  )));

  return {
    minDecisions,
    maxDecisions,
    baseFlyAwayChance: getNumber(
      speciesConfig.baseFlyAwayChance,
      PHOTO_SEQUENCE_CONFIG.baseFlyAwayChance
    ),
    flyAwayChanceGrowth: getNumber(
      speciesConfig.flyAwayChanceGrowth,
      PHOTO_SEQUENCE_CONFIG.flyAwayChanceGrowth
    ),
    stateWeights: {
      NORMAL: Math.max(getNumber(stateWeights.NORMAL, 0), 0),
      INTERESTING: Math.max(getNumber(stateWeights.INTERESTING, 0), 0),
      REMARKABLE: Math.max(getNumber(stateWeights.REMARKABLE, 0), 0)
    }
  };
}

function pickWeightedBehaviorState(config) {
  const entries = Object.entries(config.stateWeights);
  const totalWeight = entries.reduce((sum, entry) => sum + entry[1], 0);

  if (totalWeight <= 0) {
    return "NORMAL";
  }

  let roll = Math.random() * totalWeight;

  for (const [behaviorState, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return behaviorState;
    }
  }

  return "NORMAL";
}

function createBehaviorSequence(maxDecisionCount, config) {
  const sequence = [];

  for (let index = 0; index < maxDecisionCount; index += 1) {
    sequence.push(pickWeightedBehaviorState(config));
  }

  sequence.push("FLY_AWAY");
  return sequence;
}

function forceFlyAway(photoSequence) {
  return {
    ...photoSequence,
    stepIndex: photoSequence.behaviorSequence.length - 1,
    forcedFlyAway: true
  };
}

export function createPhotoSequence(speciesId = "") {
  const config = getPhotoSequenceConfig(speciesId);
  const maxDecisionCount = randomNumber(
    config.minDecisions,
    config.maxDecisions
  );

  return {
    speciesId,
    config,
    stepIndex: 0,
    decisionCount: 0,
    shutterCount: 0,
    maxDecisionCount,
    forcedFlyAway: false,
    behaviorSequence: createBehaviorSequence(maxDecisionCount, config)
  };
}

export function getCurrentPhotoState(photoSequence) {
  return photoSequence.behaviorSequence[photoSequence.stepIndex] || "FLY_AWAY";
}

export function getRemainingDecisionCount(photoSequence) {
  return Math.max(photoSequence.maxDecisionCount - photoSequence.decisionCount, 0);
}

export function recordShutterDecision(photoSequence) {
  const nextSequence = {
    ...photoSequence,
    decisionCount: photoSequence.decisionCount + 1,
    shutterCount: photoSequence.shutterCount + 1,
    stepIndex: Math.min(photoSequence.stepIndex + 1, photoSequence.behaviorSequence.length - 1)
  };

  if (nextSequence.decisionCount >= nextSequence.maxDecisionCount) {
    return forceFlyAway(nextSequence);
  }

  return nextSequence;
}

export function advancePhotoSequence(photoSequence) {
  const config = photoSequence.config || getPhotoSequenceConfig(photoSequence.speciesId);
  const nextDecisionCount = photoSequence.decisionCount + 1;

  if (nextDecisionCount >= photoSequence.maxDecisionCount) {
    return forceFlyAway({
      ...photoSequence,
      decisionCount: nextDecisionCount
    });
  }

  const flyAwayChance = config.baseFlyAwayChance
    + config.flyAwayChanceGrowth * nextDecisionCount;

  if (Math.random() < flyAwayChance) {
    return forceFlyAway({
      ...photoSequence,
      decisionCount: nextDecisionCount
    });
  }

  return {
    ...photoSequence,
    config,
    decisionCount: nextDecisionCount,
    stepIndex: Math.min(photoSequence.stepIndex + 1, photoSequence.behaviorSequence.length - 1)
  };
}

export function isBirdGone(photoSequence) {
  return getCurrentPhotoState(photoSequence) === "FLY_AWAY";
}
