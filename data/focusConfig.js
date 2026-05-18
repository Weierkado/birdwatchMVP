const SPARROW_SEQUENCE = {
  safetyMs: 900,
  segmentCount: { min: 1, max: 3 },
  allowJump: true,
  stateWeights: {
    NORMAL: 50,
    INTERESTING: 40,
    REMARKABLE: 10
  },
  stateDurations: {
    NORMAL: { min: 520, max: 780 },
    INTERESTING: { min: 380, max: 620 },
    REMARKABLE: { min: 260, max: 420 }
  }
};

const RED_WHISKERED_BULBUL_SEQUENCE = {
  safetyMs: 950,
  segmentCount: { min: 1, max: 3 },
  allowJump: true,
  stateWeights: {
    NORMAL: 42,
    INTERESTING: 45,
    REMARKABLE: 13
  },
  stateDurations: {
    NORMAL: { min: 520, max: 820 },
    INTERESTING: { min: 420, max: 680 },
    REMARKABLE: { min: 280, max: 460 }
  }
};

const LIGHT_VENTED_BULBUL_SEQUENCE = {
  safetyMs: 1050,
  segmentCount: { min: 1, max: 3 },
  allowJump: false,
  stateWeights: {
    NORMAL: 48,
    INTERESTING: 40,
    REMARKABLE: 12
  },
  stateDurations: {
    NORMAL: { min: 620, max: 900 },
    INTERESTING: { min: 480, max: 720 },
    REMARKABLE: { min: 320, max: 500 }
  }
};

const BLACKBIRD_SEQUENCE = {
  safetyMs: 1100,
  segmentCount: { min: 1, max: 3 },
  allowJump: false,
  stateWeights: {
    NORMAL: 58,
    INTERESTING: 34,
    REMARKABLE: 8
  },
  stateDurations: {
    NORMAL: { min: 680, max: 980 },
    INTERESTING: { min: 520, max: 760 },
    REMARKABLE: { min: 360, max: 540 }
  }
};

const KINGFISHER_SEQUENCE = {
  safetyMs: 750,
  segmentCount: { min: 1, max: 3 },
  allowJump: true,
  stateWeights: {
    NORMAL: 35,
    INTERESTING: 42,
    REMARKABLE: 23
  },
  stateDurations: {
    NORMAL: { min: 420, max: 640 },
    INTERESTING: { min: 320, max: 520 },
    REMARKABLE: { min: 220, max: 380 }
  }
};

export const focusConfig = {
  red_whiskered_bulbul: {
    NORMAL: {
      pattern: "drift_to_center",
      layers: [
        { ax: 0.10, wx: 2.2, phix: 0.2, ay: 0.08, wy: 2.6, phiy: 0.7 },
        { ax: 0.04, wx: 6.4, phix: 1.1, ay: 0.04, wy: 5.8, phiy: 1.8 }
      ],
      enter: { x0: -0.35, y0: 0.18, decay: 1.4 },
      stutter: null,
      focus: { green: 0.32, perfect: 0.12 },
      sequence: RED_WHISKERED_BULBUL_SEQUENCE
    },
    INTERESTING: {
      pattern: "bounce_hop",
      hop: {
        distance: 0.38,
        pauseDuration: 1.2,
        tweenDuration: 0.22,
        pauseJitter: 0.03
      },
      layers: [],
      enter: null,
      stutter: null,
      focus: { green: 0.30, perfect: 0.11 },
      sequence: RED_WHISKERED_BULBUL_SEQUENCE
    },
    REMARKABLE: {
      pattern: "sweep",
      layers: [
        { ax: 0.45, wx: 1.8, phix: 0.0, ay: 0.10, wy: 3.4, phiy: 1.3 },
        { ax: 0.07, wx: 8.2, phix: 1.0, ay: 0.05, wy: 7.6, phiy: 0.4 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.28, perfect: 0.10 },
      sequence: RED_WHISKERED_BULBUL_SEQUENCE
    }
  },

  light_vented_bulbul: {
    NORMAL: {
      pattern: "wander",
      layers: [
        { ax: 0.13, wx: 1.7, phix: 0.4, ay: 0.10, wy: 1.9, phiy: 1.2 },
        { ax: 0.05, wx: 4.9, phix: 2.0, ay: 0.04, wy: 5.3, phiy: 0.3 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.33, perfect: 0.12 },
      sequence: LIGHT_VENTED_BULBUL_SEQUENCE
    },
    INTERESTING: {
      pattern: "jitter",
      layers: [
        { ax: 0.16, wx: 3.5, phix: 0.1, ay: 0.12, wy: 3.0, phiy: 0.8 },
        { ax: 0.07, wx: 9.0, phix: 1.4, ay: 0.06, wy: 8.2, phiy: 2.4 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.30, perfect: 0.11 },
      sequence: LIGHT_VENTED_BULBUL_SEQUENCE
    },
    REMARKABLE: {
      pattern: "sweep",
      layers: [
        { ax: 0.34, wx: 2.4, phix: 0.5, ay: 0.22, wy: 2.0, phiy: 1.0 },
        { ax: 0.08, wx: 7.5, phix: 1.5, ay: 0.06, wy: 6.8, phiy: 0.2 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.28, perfect: 0.10 },
      sequence: LIGHT_VENTED_BULBUL_SEQUENCE
    }
  },

  sparrow: {
    NORMAL: {
      pattern: "jitter",
      layers: [
        { ax: 0.15, wx: 3.0, phix: 0.0, ay: 0.12, wy: 2.7, phiy: 1.0 },
        { ax: 0.07, wx: 8.1, phix: 0.5, ay: 0.06, wy: 7.3, phiy: 2.1 },
        { ax: 0.04, wx: 15.3, phix: 1.2, ay: 0.03, wy: 13.8, phiy: 0.8 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.30, perfect: 0.12 },
      sequence: SPARROW_SEQUENCE
    },
    INTERESTING: {
      pattern: "bounce_hop",
      hop: {
        distance: 0.42,
        pauseDuration: 0.9,
        tweenDuration: 0.18,
        pauseJitter: 0.04
      },
      layers: [],
      enter: null,
      stutter: null,
      focus: { green: 0.28, perfect: 0.10 },
      sequence: SPARROW_SEQUENCE
    },
    REMARKABLE: {
      pattern: "bounce_hop",
      hop: {
        distance: 0.52,
        pauseDuration: 0.65,
        tweenDuration: 0.16,
        pauseJitter: 0.05
      },
      layers: [],
      enter: null,
      stutter: null,
      focus: { green: 0.26, perfect: 0.09 },
      sequence: SPARROW_SEQUENCE
    }
  },

  blackbird: {
    NORMAL: {
      pattern: "still",
      layers: [
        { ax: 0.06, wx: 1.3, phix: 0.6, ay: 0.05, wy: 1.1, phiy: 1.4 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.35, perfect: 0.14 },
      sequence: BLACKBIRD_SEQUENCE
    },
    INTERESTING: {
      pattern: "wander",
      layers: [
        { ax: 0.18, wx: 1.6, phix: 1.0, ay: 0.12, wy: 1.4, phiy: 0.4 },
        { ax: 0.04, wx: 5.4, phix: 0.2, ay: 0.04, wy: 4.8, phiy: 1.9 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.31, perfect: 0.12 },
      sequence: BLACKBIRD_SEQUENCE
    },
    REMARKABLE: {
      pattern: "drift_to_center",
      layers: [
        { ax: 0.16, wx: 2.6, phix: 0.5, ay: 0.13, wy: 2.1, phiy: 1.1 },
        { ax: 0.06, wx: 6.9, phix: 1.7, ay: 0.05, wy: 7.2, phiy: 0.8 }
      ],
      enter: { x0: 0.42, y0: -0.22, decay: 1.1 },
      stutter: null,
      focus: { green: 0.29, perfect: 0.10 },
      sequence: BLACKBIRD_SEQUENCE
    }
  },

  kingfisher: {
    NORMAL: {
      pattern: "still",
      layers: [
        { ax: 0.05, wx: 1.2, phix: 0.0, ay: 0.04, wy: 1.5, phiy: 0.9 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.34, perfect: 0.13 },
      sequence: KINGFISHER_SEQUENCE
    },
    INTERESTING: {
      pattern: "drift_to_center",
      layers: [
        { ax: 0.12, wx: 2.0, phix: 0.8, ay: 0.10, wy: 2.8, phiy: 1.6 },
        { ax: 0.05, wx: 7.0, phix: 1.2, ay: 0.04, wy: 6.2, phiy: 0.3 }
      ],
      enter: { x0: -0.48, y0: 0.10, decay: 1.8 },
      stutter: null,
      focus: { green: 0.29, perfect: 0.10 },
      sequence: KINGFISHER_SEQUENCE
    },
    REMARKABLE: {
      pattern: "sweep",
      layers: [
        { ax: 0.58, wx: 2.7, phix: 0.0, ay: 0.16, wy: 4.4, phiy: 0.5 },
        { ax: 0.12, wx: 10.0, phix: 1.1, ay: 0.05, wy: 8.4, phiy: 2.0 }
      ],
      enter: null,
      stutter: null,
      focus: { green: 0.24, perfect: 0.08 },
      sequence: KINGFISHER_SEQUENCE
    }
  }
};
