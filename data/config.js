export const MAX_TURNS = 30;
export const MAX_PHOTOS = 15;
export const INITIAL_ACTIVE_BIRDS = 3;
export const ANALYTICS_ENDPOINT = "";

export const DIRECTIONS = ["北侧树篱", "东侧水边", "南侧草地", "西侧灌木"];

export const BIRD_STAY_TURNS = {
  min: 4,
  max: 8
};

export const DISTANT_LISTEN_CONFIG = {
  hearChance: 0.5,
  neighborLimit: 2
};

export const PHOTO_SEQUENCE_CONFIG = {
  minDecisions: 2,
  maxDecisions: 7,
  baseFlyAwayChance: 0.05,
  flyAwayChanceGrowth: 0.08,
  stateWeights: {
    NORMAL: 45,
    INTERESTING: 35,
    REMARKABLE: 12
  }
};

export const LOG_LIMIT = 12;

