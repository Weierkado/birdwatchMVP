/**
 * 卡牌资料。
 *
 * 维护边界：
 * - title / description 不应包含正式鸟名。
 * - rarity 必须和所见即所得状态对应。
 * - PRECIOUS 未来再接，不要现在混入普通卡池。
 */
export const cardList = [
  {
    id: "kingfisher_normal_01",
    speciesId: "kingfisher",
    rarity: "NORMAL",
    title: "枝头蓝影",
    description: "它停在水边枯枝上，身体小得像一块短暂停住的蓝光。",
    stars: 1
  },
  {
    id: "kingfisher_normal_02",
    speciesId: "kingfisher",
    rarity: "NORMAL",
    title: "入水准备",
    description: "它身体微微下倾，眼睛锁住水里的某个东西。",
    stars: 1
  },
  {
    id: "kingfisher_normal_03",
    speciesId: "kingfisher",
    rarity: "NORMAL",
    title: "临水回望",
    description: "它贴近水面转过头，喙尖像一枚细小的箭头。",
    stars: 1
  },
  {
    id: "kingfisher_interesting_01",
    speciesId: "kingfisher",
    rarity: "INTERESTING",
    title: "尖鸣过水",
    description: "你只听见一声尖锐的鸣叫从水面上方掠过，等抬头时已经看不见它了。",
    stars: 2
  },
  {
    id: "kingfisher_interesting_02",
    speciesId: "kingfisher",
    rarity: "INTERESTING",
    title: "贴水低掠",
    description: "它擦着水面飞过去，整个过程比一次心跳还短。",
    stars: 2
  },
  {
    id: "kingfisher_remarkable_01",
    speciesId: "kingfisher",
    rarity: "REMARKABLE",
    title: "入水一瞬",
    description: "它化成一道蓝色的线扎进水里，只留下扩散开的涟漪。",
    stars: 3
  },
  {
    id: "sparrow_normal_01",
    speciesId: "sparrow",
    rarity: "NORMAL",
    title: "灰褐羽纹",
    description: "它站在近处，背上的斑纹比想象中复杂得多。",
    stars: 1
  },
  {
    id: "sparrow_normal_02",
    speciesId: "sparrow",
    rarity: "NORMAL",
    title: "跳上矮枝",
    description: "它忽然跳上矮枝，侧过脸，像是在确认你有没有认真看它。",
    stars: 1
  },
  {
    id: "sparrow_normal_03",
    speciesId: "sparrow",
    rarity: "NORMAL",
    title: "脸颊黑斑",
    description: "它正面看着你，脸颊上一块清晰的黑色斑——你之前从来没注意过。",
    stars: 1
  },
  {
    id: "sparrow_interesting_01",
    speciesId: "sparrow",
    rarity: "INTERESTING",
    title: "沙浴翻身",
    description: "它躺进土窝里翻来翻去，灰褐羽毛沾上一层细土。",
    stars: 2
  },
  {
    id: "sparrow_interesting_02",
    speciesId: "sparrow",
    rarity: "INTERESTING",
    title: "翘尾起跳",
    description: "它把尾巴翘起来，连蹦三下，每一下都干脆得像踩在弹簧上。",
    stars: 2
  },
  {
    id: "sparrow_remarkable_01",
    speciesId: "sparrow",
    rarity: "REMARKABLE",
    title: "晨光理羽",
    description: "晨光斜斜照过来，它停在屋脊上慢慢梳羽，每一根棕黑色斑纹都被点亮。",
    stars: 3
  },
  {
    id: "red_billed_magpie_normal_01",
    speciesId: "red_billed_magpie",
    rarity: "NORMAL",
    title: "长尾垂落",
    description: "它停在枝上，长长的尾羽垂下来，像一条还没收起的蓝色绸带。",
    stars: 1
  },
  {
    id: "red_billed_magpie_normal_02",
    speciesId: "red_billed_magpie",
    rarity: "NORMAL",
    title: "红喙回首",
    description: "它转过头，那一点橙红色在蓝黑羽色之间格外醒目。",
    stars: 1
  },
  {
    id: "red_billed_magpie_normal_03",
    speciesId: "red_billed_magpie",
    rarity: "NORMAL",
    title: "树冠隐身",
    description: "它隐在树冠里，只露出一截蓝黑色的影子，几乎认不出是它。",
    stars: 1
  },
  {
    id: "red_billed_magpie_interesting_01",
    speciesId: "red_billed_magpie",
    rarity: "INTERESTING",
    title: "粗哑大鸣",
    description: "它从喉咙里挤出一阵粗哑的大叫，远远的山林都听见了。",
    stars: 2
  },
  {
    id: "red_billed_magpie_interesting_02",
    speciesId: "red_billed_magpie",
    rarity: "INTERESTING",
    title: "拖尾跨枝",
    description: "它从一根枝跳到另一根，尾巴还没跟上身子，在半空中拖出一道蓝弧。",
    stars: 2
  },
  {
    id: "red_billed_magpie_remarkable_01",
    speciesId: "red_billed_magpie",
    rarity: "REMARKABLE",
    title: "蓝旗展开",
    description: "它横掠过林缘，尾羽在空中展开，像一面慢慢铺开的旗。",
    stars: 3
  },
  {
    id: "mandarin_duck_normal_01",
    speciesId: "mandarin_duck",
    rarity: "NORMAL",
    title: "静水巡游",
    description: "它缓慢划过水面，像一件被水托住的装饰品。",
    stars: 1
  },
  {
    id: "mandarin_duck_normal_02",
    speciesId: "mandarin_duck",
    rarity: "NORMAL",
    title: "帆羽侧光",
    description: "它微微侧身，橙色帆羽在光里显得格外夸张。",
    stars: 1
  },
  {
    id: "mandarin_duck_normal_03",
    speciesId: "mandarin_duck",
    rarity: "NORMAL",
    title: "灰褐姿色",
    description: "它一身朴素的灰褐色，安静地划过水面——很难想象它和那身华丽是同一种。",
    stars: 1
  },
  {
    id: "mandarin_duck_interesting_01",
    speciesId: "mandarin_duck",
    rarity: "INTERESTING",
    title: "白须翻光",
    description: "它低头喝水，颊边那两缕白色胡须沾水之后翻起一点光。",
    stars: 2
  },
  {
    id: "mandarin_duck_interesting_02",
    speciesId: "mandarin_duck",
    rarity: "INTERESTING",
    title: "扑水起飞",
    description: "它扑棱着翅膀短促飞起，水珠从腹下扬起一片。",
    stars: 2
  },
  {
    id: "mandarin_duck_remarkable_01",
    speciesId: "mandarin_duck",
    rarity: "REMARKABLE",
    title: "水面炫耀",
    description: "它抬起身体，所有鲜艳的装饰都在水面上短暂亮了起来。",
    stars: 3
  },
  {
    id: "blackbird_normal_01",
    speciesId: "blackbird",
    rarity: "NORMAL",
    title: "黑影停步",
    description: "它停在灌丛边缘，全身像一块剪下来的黑影。",
    stars: 1
  },
  {
    id: "blackbird_normal_02",
    speciesId: "blackbird",
    rarity: "NORMAL",
    title: "黄喙抬头",
    description: "它忽然抬起头，橙黄色的喙像在黑色轮廓上点亮了一笔。",
    stars: 1
  },
  {
    id: "blackbird_normal_03",
    speciesId: "blackbird",
    rarity: "NORMAL",
    title: "枝间错认",
    description: "你以为高枝上是另一种鸟在叫，找过去才发现只是一团橙黄嘴的黑影。",
    stars: 1
  },
  {
    id: "blackbird_interesting_01",
    speciesId: "blackbird",
    rarity: "INTERESTING",
    title: "刨出蚯蚓",
    description: "它在落叶里翻翻找找，从泥里叼出一条蚯蚓——粉红色的，还在扭。",
    stars: 2
  },
  {
    id: "blackbird_interesting_02",
    speciesId: "blackbird",
    rarity: "INTERESTING",
    title: "侧目偷瞥",
    description: "它假装啄地，却斜着那只小眼一直在看你。",
    stars: 2
  },
  {
    id: "blackbird_remarkable_01",
    speciesId: "blackbird",
    rarity: "REMARKABLE",
    title: "高声啼鸣",
    description: "它在最高的枝头开始鸣唱，旋律拐了好几个弯，整个林子都安静下来听它。",
    stars: 3
  },
  {
    id: "night_heron_normal_01",
    speciesId: "night_heron",
    rarity: "NORMAL",
    title: "水边静立",
    description: "它驼着背站在水边，安静得像一块被遗忘的石头。",
    stars: 1
  },
  {
    id: "night_heron_normal_02",
    speciesId: "night_heron",
    rarity: "NORMAL",
    title: "树荫缩立",
    description: "它躲在水边一棵树下，灰白色身体几乎被树荫盖住。",
    stars: 1
  },
  {
    id: "night_heron_normal_03",
    speciesId: "night_heron",
    rarity: "NORMAL",
    title: "白冠垂背",
    description: "它的脖颈缩在双肩之间，几根白色冠羽从后脑垂到背上——只有这个季节才会有。",
    stars: 1
  },
  {
    id: "night_heron_interesting_01",
    speciesId: "night_heron",
    rarity: "INTERESTING",
    title: "缓伸长颈",
    description: "它忽然把脖子伸出来——比刚才看上去长了一倍——又慢慢缩回去。",
    stars: 2
  },
  {
    id: "night_heron_interesting_02",
    speciesId: "night_heron",
    rarity: "INTERESTING",
    title: "忽然张翼",
    description: "它突然展开翅膀，沉默的身体一下子从水边脱离出来。",
    stars: 2
  },
  {
    id: "night_heron_remarkable_01",
    speciesId: "night_heron",
    rarity: "REMARKABLE",
    title: "红眼注视",
    description: "它缓慢转动头部，那只红色的眼睛一直看着你。",
    stars: 3
  }
];
