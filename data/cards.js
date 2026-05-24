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
    title: "低枝停蓝",
    description: "水边低枝轻轻下弯，小小的蓝绿色身体停在枝端，喙尖朝着水面。",
    stars: 1
  },
  {
    id: "kingfisher_normal_02",
    speciesId: "kingfisher",
    rarity: "NORMAL",
    title: "俯身看水",
    description: "身体压得很低，头比身子更先探出去，像在等水下某个细小动静。",
    stars: 1
  },
  {
    id: "kingfisher_normal_03",
    speciesId: "kingfisher",
    rarity: "NORMAL",
    title: "喙尖回侧",
    description: "它在水面上方侧过头，细长的喙把整张照片指向一片安静的水。",
    stars: 1
  },
  {
    id: "kingfisher_interesting_01",
    speciesId: "kingfisher",
    rarity: "INTERESTING",
    title: "短鸣离枝",
    description: "一声尖细的鸣叫刚响起，它已经从枝头弹出，翅尖擦过水边的风。",
    stars: 2
  },
  {
    id: "kingfisher_interesting_02",
    speciesId: "kingfisher",
    rarity: "INTERESTING",
    title: "贴水低掠",
    description: "蓝绿色的小影子贴着水面掠过，倒影还没连起来，身体已经飞到画面边缘。",
    stars: 2
  },
  {
    id: "kingfisher_remarkable_01",
    speciesId: "kingfisher",
    rarity: "REMARKABLE",
    title: "破水一刻",
    description: "喙尖先刺进水里，蓝绿色的身体紧跟着没入，只剩一圈刚被推开的涟漪。",
    stars: 3
  },
  {
    id: "sparrow_normal_01",
    speciesId: "sparrow",
    rarity: "NORMAL",
    title: "草边小立",
    description: "褐色小鸟站在草边，背上的细纹一层叠一层，比远看时清楚得多。",
    stars: 1
  },
  {
    id: "sparrow_normal_02",
    speciesId: "sparrow",
    rarity: "NORMAL",
    title: "矮枝停步",
    description: "它跳上矮枝后没有立刻飞走，只把脸侧过来，黑色小斑正好露在光里。",
    stars: 1
  },
  {
    id: "sparrow_normal_03",
    speciesId: "sparrow",
    rarity: "NORMAL",
    title: "脚边回头",
    description: "它在路边连跳几步，忽然停下回头，短短一秒里连眼神都变得具体。",
    stars: 1
  },
  {
    id: "sparrow_interesting_01",
    speciesId: "sparrow",
    rarity: "INTERESTING",
    title: "沙窝翻羽",
    description: "它把身体埋进浅浅的土窝里翻动，灰褐羽毛扬起一层很轻的尘。",
    stars: 2
  },
  {
    id: "sparrow_interesting_02",
    speciesId: "sparrow",
    rarity: "INTERESTING",
    title: "争粒停顿",
    description: "两只小鸟为一粒碎屑靠近又分开，画面停在其中一只警觉抬头的瞬间。",
    stars: 2
  },
  {
    id: "sparrow_remarkable_01",
    speciesId: "sparrow",
    rarity: "REMARKABLE",
    title: "晨光理羽",
    description: "晨光斜斜落在屋脊上，它低头梳理胸前羽毛，平常的褐色忽然有了层次。",
    stars: 3
  },
  {
    id: "red_billed_magpie_normal_01",
    speciesId: "red_billed_magpie",
    rarity: "NORMAL",
    title: "长尾压枝",
    description: "蓝黑色的身体停在枝间，长尾从身后垂下，把细枝压出一点弧度。",
    stars: 1
  },
  {
    id: "red_billed_magpie_normal_02",
    speciesId: "red_billed_magpie",
    rarity: "NORMAL",
    title: "红喙侧露",
    description: "它半藏在叶后转过头，嘴边那一点红从蓝黑羽色里亮出来。",
    stars: 1
  },
  {
    id: "red_billed_magpie_normal_03",
    speciesId: "red_billed_magpie",
    rarity: "NORMAL",
    title: "冠层半藏",
    description: "树冠遮住了大半身体，只留下一截蓝黑轮廓和晃动的尾羽。",
    stars: 1
  },
  {
    id: "red_billed_magpie_interesting_01",
    speciesId: "red_billed_magpie",
    rarity: "INTERESTING",
    title: "粗鸣抬首",
    description: "它站高了一点，仰头发出粗哑的叫声，长尾在身后稳稳垂着。",
    stars: 2
  },
  {
    id: "red_billed_magpie_interesting_02",
    speciesId: "red_billed_magpie",
    rarity: "INTERESTING",
    title: "跨枝拖尾",
    description: "身体已经落到下一根枝上，尾羽还在半空拖出一段弯弯的蓝黑弧线。",
    stars: 2
  },
  {
    id: "red_billed_magpie_remarkable_01",
    speciesId: "red_billed_magpie",
    rarity: "REMARKABLE",
    title: "林缘展尾",
    description: "它横掠过林缘，长尾在空中完整铺开，漂亮得干净，也带着一点锋利。",
    stars: 3
  },
  {
    id: "mandarin_duck_normal_01",
    speciesId: "mandarin_duck",
    rarity: "NORMAL",
    title: "静水慢游",
    description: "色彩复杂的水鸟慢慢划过池面，身后的水纹被拖成两条很细的线。",
    stars: 1
  },
  {
    id: "mandarin_duck_normal_02",
    speciesId: "mandarin_duck",
    rarity: "NORMAL",
    title: "帆羽侧亮",
    description: "它微微侧身，橙色羽片立在背上，被一小块斜光照亮。",
    stars: 1
  },
  {
    id: "mandarin_duck_normal_03",
    speciesId: "mandarin_duck",
    rarity: "NORMAL",
    title: "灰影贴岸",
    description: "一只灰褐色的水鸟贴着岸边滑过，颜色很淡，动作却和那些华丽羽片一样从容。",
    stars: 1
  },
  {
    id: "mandarin_duck_interesting_01",
    speciesId: "mandarin_duck",
    rarity: "INTERESTING",
    title: "低头饮水",
    description: "它把脸贴近水面，浅色脸纹和倒影短短碰在一起，又被水波拆开。",
    stars: 2
  },
  {
    id: "mandarin_duck_interesting_02",
    speciesId: "mandarin_duck",
    rarity: "INTERESTING",
    title: "扑水短起",
    description: "翅膀突然拍开水面，身体只离水一点点，细小水珠从腹下甩出。",
    stars: 2
  },
  {
    id: "mandarin_duck_remarkable_01",
    speciesId: "mandarin_duck",
    rarity: "REMARKABLE",
    title: "满色浮亮",
    description: "它抬起身体转向光里，脸纹、橙色羽片和水中倒影在同一瞬间亮起。",
    stars: 3
  },
  {
    id: "blackbird_normal_01",
    speciesId: "blackbird",
    rarity: "NORMAL",
    title: "灌丛停黑",
    description: "黑色身影停在灌丛边缘，只有橙黄色的嘴从阴影里分出来。",
    stars: 1
  },
  {
    id: "blackbird_normal_02",
    speciesId: "blackbird",
    rarity: "NORMAL",
    title: "黄喙抬头",
    description: "它从落叶里抬起头，嘴上的橙黄色让整个黑色轮廓忽然清楚。",
    stars: 1
  },
  {
    id: "blackbird_normal_03",
    speciesId: "blackbird",
    rarity: "NORMAL",
    title: "影里侧站",
    description: "树影遮住了身体边缘，它侧身站着，眼睛和嘴都只露出很小一点。",
    stars: 1
  },
  {
    id: "blackbird_interesting_01",
    speciesId: "blackbird",
    rarity: "INTERESTING",
    title: "翻叶得虫",
    description: "它用嘴拨开湿落叶，从泥边叼起一条细虫，立刻向后退了半步。",
    stars: 2
  },
  {
    id: "blackbird_interesting_02",
    speciesId: "blackbird",
    rarity: "INTERESTING",
    title: "侧目停啄",
    description: "啄地的动作停在半途，它斜过眼看向镜头，像是在判断要不要换地方。",
    stars: 2
  },
  {
    id: "blackbird_remarkable_01",
    speciesId: "blackbird",
    rarity: "REMARKABLE",
    title: "高枝鸣转",
    description: "黑色小影站到高枝上，圆润的鸣声一层层转开，连树下的风声都显得轻了。",
    stars: 3
  },
  {
    id: "night_heron_normal_01",
    speciesId: "night_heron",
    rarity: "NORMAL",
    title: "岸边久立",
    description: "灰蓝色的水边鸟缩着脖子站在岸边，水纹经过脚下，它也没有动。",
    stars: 1
  },
  {
    id: "night_heron_normal_02",
    speciesId: "night_heron",
    rarity: "NORMAL",
    title: "树荫缩颈",
    description: "树荫盖住了大半身体，它把脖子缩进肩里，只留出一段灰白轮廓。",
    stars: 1
  },
  {
    id: "night_heron_normal_03",
    speciesId: "night_heron",
    rarity: "NORMAL",
    title: "白羽垂背",
    description: "几根细白羽从后脑垂到背上，随着它轻微转身才被看见。",
    stars: 1
  },
  {
    id: "night_heron_interesting_01",
    speciesId: "night_heron",
    rarity: "INTERESTING",
    title: "缓伸长颈",
    description: "原本缩成一团的身体慢慢拉长，脖子向水面探出去，又一点点收回。",
    stars: 2
  },
  {
    id: "night_heron_interesting_02",
    speciesId: "night_heron",
    rarity: "INTERESTING",
    title: "忽然张翼",
    description: "安静的灰蓝身体突然张开双翼，水边那块沉默的轮廓一下变大。",
    stars: 2
  },
  {
    id: "night_heron_remarkable_01",
    speciesId: "night_heron",
    rarity: "REMARKABLE",
    title: "红眼回看",
    description: "它几乎没有移动身体，只慢慢转过头来，红色的眼睛正好对上镜头。",
    stars: 3
  }
];
