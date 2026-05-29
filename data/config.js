export const MAX_TURNS = 30;
export const MAX_PHOTOS = 15;
export const INITIAL_ACTIVE_BIRDS = 3;

export const DIRECTIONS = ["北侧树篱", "东侧水边", "南侧草地", "西侧灌木"];

export const BIRD_STAY_TURNS = {
  min: 4,
  max: 8
};

export const BIRD_DISTANCE_DEFAULT_WEIGHTS = {
  near: 1,
  medium: 4,
  far: 3
};

export const BIRD_DISTANCE_SCALE = {
  near: 1.7,
  medium: 1.0,
  far: 0.5
};

export const BADGE_RANDOM_SCALE = {
  min: 0.85,
  max: 1.15
};

export const BADGE_ROTATION = {
  maxDegrees: 30,
  oscillationDegrees: 6,
  smoothing: 0.18
};

export const DISTANT_LISTEN_CONFIG = {
  hearChance: 0.5,
  neighborLimit: 2
};

/**
 * 全局合焦矩形框配置。
 *
 * 注意：
 * - 使用 focusEngine 的归一化坐标，不是 px。
 * - boxHalfWidth / boxHalfHeight 是中心矩形半宽半高。
 * - perfect 是内部保留参数；不要恢复旧的 px 绿区常量，除非整体重构坐标换算。
 */
export const CAMERA_FOCUS_CONFIG = {
  boxHalfWidth: 0.28,
  boxHalfHeight: 0.21,
  perfect: 0.12
};

export const PHOTO_SEQUENCE_CONFIG = {
  minDecisions: 2,
  maxDecisions: 6,
  baseFlyAwayChance: 0.05,
  flyAwayChanceGrowth: 0.06,
  stateWeights: {
    NORMAL: 50,
    INTERESTING: 35,
    REMARKABLE: 15
  }
};

export const PHOTO_SEQUENCE_CONFIG_BY_SPECIES = {
  kingfisher: {
    stateWeights: {
      NORMAL: 50,
      INTERESTING: 35,
      REMARKABLE: 15
    },
    minDecisions: 2,
    maxDecisions: 6,
    baseFlyAwayChance: 0.08,
    flyAwayChanceGrowth: 0.10
  },
  sparrow: {
    stateWeights: {
      NORMAL: 40,
      INTERESTING: 38,
      REMARKABLE: 22
    },
    minDecisions: 2,
    maxDecisions: 8,
    baseFlyAwayChance: 0.03,
    flyAwayChanceGrowth: 0.05
  },
  red_billed_magpie: {
    stateWeights: {
      NORMAL: 35,
      INTERESTING: 45,
      REMARKABLE: 20
    },
    minDecisions: 3,
    maxDecisions: 7,
    baseFlyAwayChance: 0.05,
    flyAwayChanceGrowth: 0.07
  },
  mandarin_duck: {
    stateWeights: {
      NORMAL: 60,
      INTERESTING: 30,
      REMARKABLE: 10
    },
    minDecisions: 2,
    maxDecisions: 6,
    baseFlyAwayChance: 0.04,
    flyAwayChanceGrowth: 0.05
  },
  blackbird: {
    stateWeights: {
      NORMAL: 50,
      INTERESTING: 35,
      REMARKABLE: 15
    },
    minDecisions: 2,
    maxDecisions: 7,
    baseFlyAwayChance: 0.07,
    flyAwayChanceGrowth: 0.09
  },
  night_heron: {
    stateWeights: {
      NORMAL: 65,
      INTERESTING: 25,
      REMARKABLE: 10
    },
    minDecisions: 3,
    maxDecisions: 8,
    baseFlyAwayChance: 0.03,
    flyAwayChanceGrowth: 0.04
  }
};

export const LOG_LIMIT = 12;

export const ANALYTICS_ENDPOINT = "";
export const ANALYTICS_INGEST_TOKEN = "";
export const CLIENT_VERSION = "5.28.0";

