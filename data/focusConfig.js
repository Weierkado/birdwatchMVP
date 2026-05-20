/**
 * FOCUS 手感配置。
 *
 * 维护边界：
 * - pattern / layers 决定 moving badge 的运动。
 * - stutter 决定停顿感。
 * - sequence 决定 FOCUS 内可见状态变化。
 * - focus 字段仅作历史 fallback；主合焦框大小来自 data/config.js 的 CAMERA_FOCUS_CONFIG。
 */
const AMP_SCALE = 200;

function layer(ampX, ampY, freqX, freqY, phix = 0, phiy = 0.8) {
  return {
    ax: ampX / AMP_SCALE,
    wx: freqX,
    phix,
    ay: ampY / AMP_SCALE,
    wy: freqY,
    phiy
  };
}

function stutter(chance) {
  if (!chance) {
    return null;
  }

  return {
    interval: Math.max(0.45, 1.8 - chance * 4),
    holdDuration: Math.max(0.08, chance * 0.8)
  };
}

function sequence(safetyMs, segmentMin, segmentMax, allowJump, weights, durations) {
  return {
    // safetyMs：焦内序列的安全缓冲；segmentCount：中间段数量范围。
    safetyMs,
    segmentCount: { min: segmentMin, max: segmentMax },
    // allowJump=false 时限制相邻状态变化；stateWeights / stateDurations 控制可见状态概率与时长。
    allowJump,
    stateWeights: {
      NORMAL: weights[0],
      INTERESTING: weights[1],
      REMARKABLE: weights[2]
    },
    stateDurations: {
      NORMAL: { min: durations.NORMAL[0], max: durations.NORMAL[1] },
      INTERESTING: { min: durations.INTERESTING[0], max: durations.INTERESTING[1] },
      REMARKABLE: { min: durations.REMARKABLE[0], max: durations.REMARKABLE[1] }
    }
  };
}

const KINGFISHER_DURATIONS = {
  NORMAL: [800, 1500],
  INTERESTING: [600, 1200],
  REMARKABLE: [500, 900]
};

const SPARROW_DURATIONS = {
  NORMAL: [900, 1600],
  INTERESTING: [700, 1300],
  REMARKABLE: [600, 1000]
};

const RED_BILLED_MAGPIE_DURATIONS = {
  NORMAL: [1100, 2000],
  INTERESTING: [900, 1600],
  REMARKABLE: [700, 1200]
};

const MANDARIN_DUCK_DURATIONS = {
  NORMAL: [1400, 2800],
  INTERESTING: [1100, 2000],
  REMARKABLE: [900, 1600]
};

const BLACKBIRD_DURATIONS = {
  NORMAL: [1000, 1800],
  INTERESTING: [800, 1400],
  REMARKABLE: [600, 1100]
};

const NIGHT_HERON_DURATIONS = {
  NORMAL: [1600, 3200],
  INTERESTING: [1200, 2200],
  REMARKABLE: [900, 1600]
};

export const focusConfig = {
  kingfisher: {
    NORMAL: {
      pattern: "jitter",
      layers: [
        layer(70, 35, 2.2, 1.6, 0.2, 0.7)
      ],
      enter: null,
      stutter: stutter(0.15),
      focus: { green: 0.29, perfect: 0.10 },
      sequence: sequence(800, 1, 3, true, [55, 32, 13], KINGFISHER_DURATIONS)
    },
    INTERESTING: {
      pattern: "jitter",
      layers: [
        layer(90, 45, 2.8, 2.0, 0.1, 0.9)
      ],
      enter: null,
      stutter: stutter(0.10),
      focus: { green: 0.26, perfect: 0.09 },
      sequence: sequence(700, 2, 4, true, [30, 45, 25], KINGFISHER_DURATIONS)
    },
    REMARKABLE: {
      pattern: "sweep",
      layers: [
        layer(125, 25, 1.3, 3.2, 0.0, 0.5),
        layer(22, 15, 4.0, 2.8, 1.1, 2.0)
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.22, perfect: 0.08 },
      sequence: sequence(600, 2, 4, true, [18, 27, 55], KINGFISHER_DURATIONS)
    }
  },

  sparrow: {
    NORMAL: {
      pattern: "wander",
      layers: [
        layer(55, 35, 0.7, 0.5, 0.0, 1.0)
      ],
      enter: null,
      stutter: stutter(0.22),
      focus: { green: 0.31, perfect: 0.12 },
      sequence: sequence(1000, 2, 4, true, [50, 35, 15], SPARROW_DURATIONS)
    },
    INTERESTING: {
      pattern: "wander",
      layers: [
        layer(65, 40, 0.9, 0.7, 0.4, 1.2)
      ],
      enter: null,
      stutter: stutter(0.15),
      focus: { green: 0.29, perfect: 0.10 },
      sequence: sequence(800, 2, 4, true, [28, 47, 25], SPARROW_DURATIONS)
    },
    REMARKABLE: {
      pattern: "bounce_hop",
      hop: {
        distance: 0.42,
        pauseDuration: 0.72,
        tweenDuration: 0.16,
        pauseJitter: 0.08
      },
      layers: [
        layer(70, 50, 1.2, 1.0, 0.1, 0.8),
        layer(20, 20, 2.5, 2.0, 1.4, 2.2)
      ],
      enter: null,
      stutter: stutter(0.08),
      focus: { green: 0.27, perfect: 0.09 },
      sequence: sequence(700, 2, 3, true, [18, 27, 55], SPARROW_DURATIONS)
    }
  },

  red_billed_magpie: {
    NORMAL: {
      pattern: "drift_to_center",
      layers: [
        layer(80, 30, 0.4, 0.6, 0.2, 0.7)
      ],
      enter: { x0: -0.36, y0: 0.16, decay: 1.2 },
      stutter: stutter(0.05),
      focus: { green: 0.32, perfect: 0.12 },
      sequence: sequence(1200, 2, 4, false, [55, 35, 10], RED_BILLED_MAGPIE_DURATIONS)
    },
    INTERESTING: {
      pattern: "wander",
      layers: [
        layer(90, 38, 0.6, 0.8, 0.5, 1.1)
      ],
      enter: null,
      stutter: stutter(0.05),
      focus: { green: 0.30, perfect: 0.11 },
      sequence: sequence(1000, 2, 4, false, [28, 52, 20], RED_BILLED_MAGPIE_DURATIONS)
    },
    REMARKABLE: {
      pattern: "sweep",
      layers: [
        layer(110, 30, 0.8, 0.5, 0.0, 0.9),
        layer(15, 12, 2.0, 1.5, 1.1, 1.8)
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.27, perfect: 0.10 },
      sequence: sequence(1000, 3, 5, false, [22, 33, 45], RED_BILLED_MAGPIE_DURATIONS)
    }
  },

  mandarin_duck: {
    NORMAL: {
      pattern: "drift_to_center",
      layers: [
        layer(28, 14, 0.15, 0.12, 0.3, 1.0)
      ],
      enter: { x0: -0.18, y0: 0.04, decay: 1.8 },
      stutter: null,
      focus: { green: 0.37, perfect: 0.14 },
      sequence: sequence(1500, 1, 3, false, [65, 25, 10], MANDARIN_DUCK_DURATIONS)
    },
    INTERESTING: {
      pattern: "wander",
      layers: [
        layer(42, 20, 0.22, 0.18, 0.5, 1.3)
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.35, perfect: 0.13 },
      sequence: sequence(1200, 2, 4, false, [32, 52, 16], MANDARIN_DUCK_DURATIONS)
    },
    REMARKABLE: {
      pattern: "wander",
      layers: [
        layer(38, 18, 0.22, 0.16, 0.1, 0.8),
        layer(12, 8, 1.5, 1.2, 1.4, 2.1)
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.33, perfect: 0.12 },
      sequence: sequence(1000, 2, 4, false, [22, 32, 46], MANDARIN_DUCK_DURATIONS)
    }
  },

  blackbird: {
    NORMAL: {
      pattern: "wander",
      layers: [
        layer(55, 40, 0.8, 0.6, 0.6, 1.4)
      ],
      enter: null,
      stutter: stutter(0.28),
      focus: { green: 0.33, perfect: 0.13 },
      sequence: sequence(1000, 2, 4, false, [55, 35, 10], BLACKBIRD_DURATIONS)
    },
    INTERESTING: {
      pattern: "wander",
      layers: [
        layer(68, 48, 1.1, 0.8, 1.0, 0.4)
      ],
      enter: null,
      stutter: stutter(0.20),
      focus: { green: 0.30, perfect: 0.11 },
      sequence: sequence(800, 2, 4, false, [28, 52, 20], BLACKBIRD_DURATIONS)
    },
    REMARKABLE: {
      pattern: "jitter",
      layers: [
        layer(78, 52, 1.5, 1.1, 0.5, 1.1),
        layer(18, 12, 3.0, 2.5, 1.7, 0.8)
      ],
      enter: null,
      stutter: stutter(0.10),
      focus: { green: 0.28, perfect: 0.10 },
      sequence: sequence(700, 2, 4, false, [18, 32, 50], BLACKBIRD_DURATIONS)
    }
  },

  night_heron: {
    NORMAL: {
      pattern: "still",
      layers: [
        layer(14, 8, 0.12, 0.10, 0.0, 0.9)
      ],
      enter: null,
      stutter: stutter(0.05),
      focus: { green: 0.38, perfect: 0.15 },
      sequence: sequence(1500, 1, 3, false, [65, 25, 10], NIGHT_HERON_DURATIONS)
    },
    INTERESTING: {
      pattern: "drift_to_center",
      layers: [
        layer(28, 15, 0.22, 0.18, 0.4, 1.2)
      ],
      enter: { x0: 0.16, y0: -0.08, decay: 1.6 },
      stutter: stutter(0.08),
      focus: { green: 0.36, perfect: 0.14 },
      sequence: sequence(1200, 2, 3, false, [33, 52, 15], NIGHT_HERON_DURATIONS)
    },
    REMARKABLE: {
      pattern: "wander",
      layers: [
        layer(48, 28, 0.5, 0.6, 0.2, 1.0),
        layer(10, 8, 2.0, 1.8, 1.2, 2.0)
      ],
      enter: null,
      stutter: stutter(0.05),
      focus: { green: 0.32, perfect: 0.12 },
      sequence: sequence(1000, 2, 4, false, [18, 37, 45], NIGHT_HERON_DURATIONS)
    }
  }
};
