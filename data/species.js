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
    appearance: "它比你想象的小，停在水边低枝上时，身体只是一小团蓝绿。喙很尖，头却显得大，整只鸟像随时要向水里俯冲。你刚看清它的轮廓，它已经贴着水面飞走，只在原处留下一圈细小的涟漪。",
    firstEncounterAppearance: "一道蓝绿色的影子贴着水面掠过，停下时才显出一只很小的鸟。",
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
    clue: "草地边有细碎的啾啾声，几片草叶轻轻晃动。",
    appearance: "你原本以为这种小鸟没什么可看的。靠近以后才发现，它背上的褐色斑纹一层压着一层，脸颊和喉间也有清楚的深色记号。它跳起来很轻，每次停下都抬头看一眼，像把整个草地的动静都放在心上。",
    firstEncounterAppearance: "一只小小的褐色鸟影落在草地边，轻快地跳了两下，又抬头看你。",
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
    appearance: "它的尾羽长得不合比例，停下时还在枝叶间轻轻摆动。蓝黑色的身体藏在树冠里，嘴边那一点红却很难忽略。它移动得从容，落脚前总像先判断好了距离，漂亮得很锋利，也很警觉。",
    firstEncounterAppearance: "一只长尾鸟从枝间掠过，蓝黑色影子后面拖着很长的尾羽，嘴边有一抹红。",
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
    appearance: "它从水面上慢慢滑过，颜色多得不像真实的水鸟。脸侧有浅色的纹路，橙色羽片在背上竖起，随着水波轻轻晃动。可它并不只是在展示，低头拨水、转身避开倒影时，又显得很日常。",
    firstEncounterAppearance: "水面上有一只色彩复杂的水鸟缓缓滑过，橙色羽片在光里一闪。",
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
    appearance: "你先听见几段圆润的声音，以为树影里藏着不止一只鸟。找过去以后，只看见一团黑色停在落叶边，橙黄色的嘴把它从阴影里点了出来。它低头翻动叶片，又忽然侧过眼看你，像早就知道你在那里。",
    firstEncounterAppearance: "一只黑色鸟影停在阴影边缘，橙黄色的嘴一闪而过。",
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
    appearance: "它缩着脖子站在水边，背微微拱起，很久都不换姿势。灰蓝色的身体和岸边石头混在一起，只有红色的眼睛偶尔露出一点光。等你意识到它不是石头时，它已经安静地看了你很久。",
    firstEncounterAppearance: "一只灰蓝色的水边鸟缩着脖子站在岸边，安静得像一块石头。",
    nickname: "那只红眼睛的水边鸟",
    colorPalette: {
      primary: "#3a4a5e",
      secondary: "#f0ede5",
      textColor: "#f0ede5",
      scheme: "solid"
    }
  }
];
