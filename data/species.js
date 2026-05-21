/**
 * 鸟种基础资料。
 *
 * 维护边界：
 * - appearance 用于初见和图鉴观察文本。
 * - nickname 用于未加新阶段显示，不能泄露正式鸟名。
 */
export const speciesList = [
  {
    id: "kingfisher",
    name: "翠鸟",
    habitat: "水边",
    clue: "水面上方闪过一线蓝绿，随后传来尖细短促的鸣声。",
    appearance: "它比你想象的小——全身蓝绿，但只有拇指那么宽。你注意到它停在水面上方的枯枝时，它已经走了：一道蓝光消失进水里，留下一圈涟漪。你才意识到刚才那不是光线反射。",
    firstEncounterAppearance: "一道蓝绿色的影子贴着水面掠过，停下时像一小块发亮的宝石。",
    nickname: "那只蓝得像光一样的小鸟",
    colorPalette: {
      primary: "#1a6db8",
      secondary: "#d96820",
      textColor: "#f0ede5",
      scheme: "horizontal-split",
      splitStop: 55,
      splitStopJitter: 10
    }
  },
  {
    id: "sparrow",
    name: "麻雀",
    habitat: "草地",
    clue: "草地边缘有细碎的啾啾声，几片草叶轻轻晃动。",
    appearance: "你以为你认识麻雀。但你说不出它背上的斑纹是什么样的——棕色与黑色交织，每根羽毛单独描绘，没有两只完全相同的。你只是从来没仔细看过。",
    firstEncounterAppearance: "一只小小的褐色鸟影落在视野里，背上有细碎的斑纹，动作很快。",
    nickname: "那只背上有斑纹的小鸟",
    colorPalette: {
      primary: "#7a5a28",
      secondary: "#2a2520",
      tertiary: "#f0ede5",
      textColor: "#f0ede5",
      scheme: "dot-pattern",
      dotDensity: "medium"
    }
  },
  {
    id: "red_billed_magpie",
    name: "红嘴蓝鹊",
    habitat: "林缘",
    clue: "树冠间有长尾掠过，蓝黑色影子在枝叶后一闪。",
    appearance: "尾巴比身体长两倍。落下时先落尾巴——整个过程像一面蓝色的旗帜慢慢展开，然后它转过头，你看到那抹橙红色的嘴。杭州山边的林子里并不难遇见它，但第一次遇见时你还是会说不出话来。",
    firstEncounterAppearance: "一只长尾鸟从枝间掠过，尾羽拖得很长，嘴边有一抹醒目的红。",
    nickname: "那只拖着长尾巴的蓝鸟",
    colorPalette: {
      primary: "#c82020",
      secondary: "#3e5078",
      textColor: "#f0ede5",
      scheme: "horizontal-split",
      splitStop: 19,
      splitStopJitter: 10
    }
  },
  {
    id: "mandarin_duck",
    name: "鸳鸯",
    habitat: "水面",
    clue: "水面上传来轻轻拨水声，一团鲜艳的影子慢慢滑过。",
    appearance: "雄性脸颊有两缕白色胡须，橙色帆羽竖起来像船帆。这些装饰唯一的功能是让雌性选择它——完全没有实际用途。它带着这一身炫耀的行头在水面上游，慢得像个展示品。",
    firstEncounterAppearance: "水面上有一只色彩复杂的水鸟缓缓游过，橙色的羽片在光里很显眼。",
    nickname: "那只像展示品一样的水鸟",
    colorPalette: {
      primary: "#c85a10",
      secondary: "#7a5a28",
      textColor: "#f0ede5",
      scheme: "horizontal-split",
      splitStop: 50,
      splitStopJitter: 10
    }
  },
  {
    id: "blackbird",
    name: "乌鸫",
    habitat: "树影",
    clue: "阴影里传来低沉圆润的叫声，落叶被拨开了一点。",
    appearance: "全身黑色，但喙是橙黄色——像涂了一圈唇膏。叫声能模仿至少十种其他鸟的鸣叫。这就是为什么你在林子里听到很多种声音，但找来找去只找到了一只乌鸫。",
    firstEncounterAppearance: "一只通体偏黑的鸟停在阴影边缘，橙黄色的嘴一闪而过。",
    nickname: "那只橙黄色嘴巴的黑鸟",
    colorPalette: {
      primary: "#2a2520",
      textColor: "#e8a02f",
      scheme: "solid"
    }
  },
  {
    id: "night_heron",
    name: "夜鹭",
    habitat: "水边",
    clue: "水边有个灰白影子一动不动，像是站了很久。",
    appearance: "白天它驼着背站在水边一动不动，很多人以为它是假的——直到你注意到它的眼睛是红色的，而且它一直在看你。",
    firstEncounterAppearance: "一只灰蓝色的水边鸟缩着脖子站在岸边，姿态安静得像一块石头。",
    nickname: "那只红眼睛的水边鸟",
    colorPalette: {
      primary: "#3a4a5e",
      secondary: "#f0ede5",
      textColor: "#f0ede5",
      scheme: "solid"
    }
  }
];
