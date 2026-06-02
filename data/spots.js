/**
 * 鸟点配置。
 *
 * 维护边界：
 * - speciesWeights 是地点遭遇权重，0 或缺失表示不在该地点出现。
 * - directions 只是地点观察面文案；鸟实例生成后再随机分配方向。
 */
export const spotList = [
  {
    id: "pond_bank",
    name: "池塘边",
    description: "水面开阔，岸边有几根低枝，偶尔能看到快速掠过的鸟影。",
    soundscape: "水声之间夹着尖细鸣声，远处草丛里还有几声细碎的啾啾声。",
    traits: ["水边", "开阔", "机会少但特别"],
    travelCost: 2,
    isStartSpot: false,
    neighbors: ["garden_edge", "old_tree_shadow"],
    directions: {
      0: "芦苇滩",
      1: "林下径",
      2: "石阶边",
      3: "开阔水"
    },
    speciesDirectionRules: {
      kingfisher: [3],
      mandarin_duck: [0]
    },
    speciesTimeRules: {
      kingfisher: ["afternoon", "dusk"]
    },
    speciesWeights: {
      kingfisher: 20,
      mandarin_duck: 8,
      night_heron: 18,
      sparrow: 20,
      blackbird: 12,
      red_billed_magpie: 0
    }
  },
  {
    id: "garden_edge",
    name: "公园广场",
    description: "树篱、草地和低矮灌木交错，是适合练习观察的安静角落。",
    soundscape: "近处有细碎啾声，树篱里偶尔传来清亮短鸣。",
    traits: ["树篱", "草地", "入门"],
    travelCost: 1,
    isStartSpot: true,
    neighbors: ["pond_bank", "old_tree_shadow"],
    directions: {
      0: "矮树篱",
      1: "开花灌木",
      2: "林下径",
      3: "草地边"
    },
    speciesWeights: {
      sparrow: 32,
      blackbird: 24,
      red_billed_magpie: 18,
      night_heron: 0,
      kingfisher: 0,
      mandarin_duck: 0
    }
  },
  {
    id: "old_tree_shadow",
    name: "林间小路",
    description: "高树遮住阳光，地面铺满落叶，适合寻找安静活动的鸟。",
    soundscape: "阴影深处有低沉圆润的叫声，落叶间传来轻轻翻动声。",
    traits: ["树影", "落叶", "安静"],
    travelCost: 2,
    isStartSpot: false,
    neighbors: ["pond_bank", "garden_edge"],
    directions: {
      0: "高树梢",
      1: "花坛边",
      2: "落叶地面",
      3: "幽暗林下"
    },
    speciesWeights: {
      blackbird: 26,
      red_billed_magpie: 22,
      sparrow: 24,
      night_heron: 10,
      kingfisher: 0,
      mandarin_duck: 0
    }
  }
];
