import { PHOTO_SEQUENCE_CONFIG } from "../data/config.js";

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
  PRECIOUS: {
    label: "珍贵",
    className: "state-precious",
    description: "这是极少遇见的珍贵瞬间。",
    hint: "未来高阶系统的稀缺窗口"
  },
  FLY_AWAY: {
    label: "飞离",
    className: "state-fly-away",
    description: "它察觉到动静，飞离了视野。",
    hint: "本次观察结束"
  }
};

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedBehaviorState() {
  const entries = Object.entries(PHOTO_SEQUENCE_CONFIG.stateWeights);
  const totalWeight = entries.reduce((sum, entry) => sum + entry[1], 0);
  let roll = Math.random() * totalWeight;

  for (const [behaviorState, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return behaviorState;
    }
  }

  return "NORMAL";
}

function createBehaviorSequence(maxDecisionCount) {
  const sequence = [];

  for (let index = 0; index < maxDecisionCount; index += 1) {
    sequence.push(pickWeightedBehaviorState());
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

export function createPhotoSequence() {
  const maxDecisionCount = randomNumber(
    PHOTO_SEQUENCE_CONFIG.minDecisions,
    PHOTO_SEQUENCE_CONFIG.maxDecisions
  );

  return {
    stepIndex: 0,
    decisionCount: 0,
    shutterCount: 0,
    maxDecisionCount,
    forcedFlyAway: false,
    behaviorSequence: createBehaviorSequence(maxDecisionCount)
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
  const nextDecisionCount = photoSequence.decisionCount + 1;

  if (nextDecisionCount >= photoSequence.maxDecisionCount) {
    return forceFlyAway({
      ...photoSequence,
      decisionCount: nextDecisionCount
    });
  }

  const flyAwayChance = PHOTO_SEQUENCE_CONFIG.baseFlyAwayChance
    + PHOTO_SEQUENCE_CONFIG.flyAwayChanceGrowth * nextDecisionCount;

  if (Math.random() < flyAwayChance) {
    return forceFlyAway({
      ...photoSequence,
      decisionCount: nextDecisionCount
    });
  }

  return {
    ...photoSequence,
    decisionCount: nextDecisionCount,
    stepIndex: Math.min(photoSequence.stepIndex + 1, photoSequence.behaviorSequence.length - 1)
  };
}

export function isBirdGone(photoSequence) {
  return getCurrentPhotoState(photoSequence) === "FLY_AWAY";
}
