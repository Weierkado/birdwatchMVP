export const spotList = [
  {
    id: "pond_bank",
    name: "池塘岸边",
    description: "水面开阔，岸边有几根低枝，偶尔能看到快速掠过的鸟影。",
    soundscape: "水声之间夹着尖细鸣声，远处草丛还有几声麻雀叫。",
    traits: ["水边", "开阔", "机会少但特别"],
    travelCost: 2,
    neighbors: ["garden_edge", "old_tree_shadow"],
    directions: {
      0: "北侧芦苇",
      1: "花园边缘方向",
      2: "石阶小路",
      3: "水面开阔处"
    },
    speciesWeights: {
      red_whiskered_bulbul: 1,
      light_vented_bulbul: 1,
      sparrow: 2,
      blackbird: 1,
      kingfisher: 5
    }
  },
  {
    id: "garden_edge",
    name: "花园边缘",
    description: "树篱、草地和低矮灌木交错，是适合练习观察的安静角落。",
    soundscape: "近处有细碎啾声，树篱里偶尔传来清亮短鸣。",
    traits: ["树篱", "草地", "入门"],
    travelCost: 1,
    neighbors: ["pond_bank", "old_tree_shadow"],
    directions: {
      0: "矮树篱",
      1: "开花灌木",
      2: "池塘岸边方向",
      3: "草地边缘"
    },
    speciesWeights: {
      red_whiskered_bulbul: 3,
      light_vented_bulbul: 3,
      sparrow: 5,
      blackbird: 1,
      kingfisher: 0
    }
  },
  {
    id: "old_tree_shadow",
    name: "老树阴影",
    description: "高树遮住阳光，地面铺满落叶，适合寻找安静活动的鸟。",
    soundscape: "阴影深处有低沉圆润的叫声，落叶间传来轻轻翻动声。",
    traits: ["树影", "落叶", "安静"],
    travelCost: 2,
    neighbors: ["garden_edge", "pond_bank"],
    directions: {
      0: "高树冠层",
      1: "花园边缘方向",
      2: "落叶地面",
      3: "幽暗林下"
    },
    speciesWeights: {
      red_whiskered_bulbul: 2,
      light_vented_bulbul: 1,
      sparrow: 1,
      blackbird: 5,
      kingfisher: 0
    }
  }
];
