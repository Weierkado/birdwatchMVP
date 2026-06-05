# 《认鸟手信》数据结构规划

## 1. 规划目标

本文不是立即实现方案，也不是迁移清单。它用于三测内容扩展、后续编辑器工作台、未来发布系统的结构规划。

当前阶段优先服务内容生产效率和叙事表达，不追求复杂数值系统。三测需要先把“世界更丰富”拆成可维护的数据域：鸟、鸟卡、地点、鸟点、遭遇、事件、天气、时间推进、夜晚想法、观鸟人、妹妹消息、发布反馈与玩家进度。

本文中的字段示例是规划草案，不代表当前代码已经实现，也不要求本轮修改任何运行时代码、数据文件、存档 key、analytics、survey 或 PHOTO / FOCUS / RESULT 流程。

## 2. 设计原则

### 2.1 叙事优先

数据结构应服务：

- 陈玉的自我重建。
- 陈力娅的表达与求助。
- 姐妹互救。
- “普通即特别”的主题。

鸟、照片、发布反馈和账号成长都不应变成孤立的刷数值目标。它们应帮助玩家理解陈玉如何重新看见城市、看见妹妹、也看见自己。

### 2.2 观鸟作为媒介

鸟、照片、卡牌、稀有度不是孤立收集品，而是触发消息、记忆、发布、人物关系变化的媒介。

同一只鸟可以在不同鸟点、天气、时间和叙事阶段中承担不同作用；同一张照片也可以同时服务图鉴、妹妹回复、夜晚想法和未来发布系统。

### 2.3 内容可编辑

未来需要支持非程序化编辑：

- 妹妹消息。
- 鸟种知识。
- 鸟点描述。
- 天气文本。
- 夜晚想法。
- 观鸟人事件。
- 发布评论。

编辑器应优先暴露内容字段、触发条件、依赖校验和预览能力，而不是暴露底层运行时状态。

### 2.4 渐进实现

三测只需要最小可用结构，不应一次性实装完整账号经营系统。

优先顺序建议是：先扩世界内容和触发条件，再补编辑器校验，再考虑发布反馈。账号、点赞、粉丝、商单等系统必须以轻量叙事反馈形式出现。

### 2.5 避免新 KPI 异化

点赞 / 粉丝 / 商单只能作为叙事反馈，不应成为新的优绩主义压力源。

如果未来出现账号成长，应优先使用定性阶段、评论语气、人物关系变化、陈玉自我叙述变化，而不是把玩家推向“更高数字 = 更正确”的单一目标。

## 3. 当前数据状态简述

当前需以代码为准。根据现有项目结构和开发文档，项目已有或可能已有以下数据类型：

- 鸟种数据：当前主要在 `data/species.js`，包含鸟种 id、名称、栖息地、线索、外观描述、首次遇见外观、未加新前昵称、色彩配置等。当前命名是 `species`，本文用 `birds` 描述未来数据域。
- 卡牌数据：当前主要在 `data/cards.js`，按鸟种关联卡牌和稀有度，服务拍照结果、图鉴和所见即所得表达。当前已预留珍贵卡方向，但三测是否启用需以代码和数据为准。
- 地点 / 鸟点：当前主要在 `data/spots.js`，包含鸟点描述、环境声、traits、移动消耗、相邻鸟点、方向文案、鸟种权重及部分规则。
- Liya 消息：当前主要在 `data/liyaMessages.json`，包含消息 id、说话人、类型、阶段、触发器、条件、优先级、冷却、是否可重复、文本行和 tags 等。具体运行时支持字段需以消息系统代码为准。
- 初始消息与妹妹知识：当前存在 `data/initialMessages.js` 和 `data/sisterKnowledge.js`，分别偏向初始会话和图鉴补充知识，不应与 `liyaMessages` 混成同一职责。
- 图鉴 / 笔记存档：当前存档结构需以 `src/storage.js`、图鉴模块和当前 DevLog 文档为准。规划新字段前应避免直接改动正式存档 key。
- analytics / survey 配置：当前测试、问卷和 analytics 相关配置主要由 `data/config.js` 控制。本文不规划 analytics payload 变更。

## 4. 推荐数据域总览

| 数据域 | 作用 | 三测是否需要 | 未来是否需要 | 建议文件位置 | 备注 |
|---|---|---|---|---|---|
| birds | 鸟种基础事实与叙事标签 | 需要 | 需要 | 短期沿用 `data/species.js`，未来可规划 `data/birds.js` | 表达“这种鸟是什么”，不表达“某张照片是什么”。 |
| birdCards | 鸟卡 / 照片结果模板 | 需要 | 需要 | 短期沿用 `data/cards.js`，未来可规划 `data/birdCards.js` | 表达可获得的照片叙事结果，不保存玩家实际照片。 |
| locations | 大地图区域 / 城市片区 | 建议需要 | 需要 | `data/locations.js` | 当前鸟点可先兼容，三测地图扩展后建议补区域层。 |
| spots | 具体观鸟点 | 需要 | 需要 | `data/spots.js` | 表达玩家可以移动和观鸟的位置。 |
| encounters | 遭遇规则 | 建议需要 | 需要 | `data/encounters.js` | 从鸟点权重中拆出后，可更清晰表达天气、时间、阶段条件。 |
| events | 叙事 / 系统事件 | 建议需要 | 需要 | `data/events.js` | 用于承接非鸟种本体的叙事触发。 |
| weather | 天气定义与文本 | 需要 | 需要 | `data/weather.js` | 三测丰富世界的关键入口。 |
| timeRules | 时间 / 天数推进规则 | 需要 | 需要 | `data/timeRules.js` | 可先只表达 day / timeOfDay / turn cost。 |
| nightThoughts | 夜晚想法 / 日终反思 | 建议需要 | 需要 | `data/nightThoughts.js` | 强化陈玉自我重建，不应只是结算奖励。 |
| birdwatchers | 其他观鸟人 / 城市人物 | 可选 | 需要 | `data/birdwatchers.js` | 用于扩世界，但三测可小规模验证。 |
| liyaMessages | 妹妹消息内容池 | 需要 | 需要 | `data/liyaMessages.json` | 继续作为核心叙事反馈源。 |
| posts | 玩家选择发布的照片记录 / 内容模板 | 可选 | 需要 | `data/posts.js` 或未来发布系统数据 | 三测可只做设计预留，不必完整实装。 |
| postComments | 发布后的评论池 | 可选 | 需要 | `data/postComments.js` | 评论应传达叙事反馈，不做流量 KPI。 |
| accountProgress | 账号叙事阶段 | 暂不必完整需要 | 需要 | `data/accountProgress.js` | 只建议定性阶段，不建议硬数值经营。 |
| playerProgress | 玩家进度与解锁状态 | 需要 | 需要 | 存档层，具体 key 以当前代码为准 | 不建议直接暴露给内容编辑器。 |
| editorWorkbench | 编辑器元数据、校验和预览配置 | 建议需要 | 需要 | `tools/`、编辑器配置或独立 schema 文档 | 不属于游戏运行时内容。 |

## 5. birds：鸟种基础数据

`birds` 应表达“这种鸟是什么”，而不是“某张照片是什么”。鸟种数据可以被遭遇、卡牌、图鉴、妹妹知识、发布系统共同引用。

建议字段：

```js
{
  id: "sparrow",
  displayName: "树麻雀",
  scientificName: "",
  aliases: [],
  family: "",
  order: "",
  appearance: "",
  firstEncounterAppearance: "",
  soundscape: "",
  personalityTags: [],
  commonness: "common",
  habitats: [],
  activeTime: [],
  seasons: [],
  liyaKnowledgeTags: [],
  narrativeTags: [],
  unlockStage: "test3",
  isPreciousEligible: false
}
```

三测现在就应有的字段：

- `id`：稳定引用 id。
- `displayName`：正式鸟名，用于加新后展示。
- `appearance`：常规观察 / 图鉴描述。
- `firstEncounterAppearance`：首次遇见时可不提前泄露正式鸟名的描述。
- `habitats`：与地点、鸟点、遭遇规则关联。
- `commonness`：内容层常见程度，不直接等同拍照概率。
- `activeTime`：用于清晨、白天、傍晚等时间条件。
- `unlockStage`：用于三测内容分批和编辑器筛选。

未来预留字段：

- `scientificName`、`family`、`order`：科普深度和编辑器检索。
- `aliases`：俗名、妹妹叫法、地方称呼。
- `personalityTags`：服务妹妹回复、夜晚想法、发布评论语气。
- `liyaKnowledgeTags`：连接妹妹知识库，不直接写长文本。
- `narrativeTags`：连接主题和人物弧线。
- `seasons`：用于长期版本的季节和迁徙。
- `isPreciousEligible`：只表示是否可产出珍贵卡，不表示已经有珍贵卡。

## 6. birdCards：鸟卡 / 照片结果模板

`birdCards` 表达“可能拍到的一种照片结果”。玩家实际拍到的照片应属于 snapshot / playerProgress，不应写回卡牌定义。

建议字段：

```js
{
  id: "sparrow_rooftop_normal",
  birdId: "sparrow",
  rarity: "NORMAL",
  title: "",
  description: "",
  stars: 1,
  photoMomentTags: [],
  compositionTags: [],
  weatherTags: [],
  timeTags: [],
  narrativeTags: [],
  unlockStage: "test3",
  isPrecious: false
}
```

三测现在就应有的字段：

- `id`：稳定卡牌 id。
- `birdId` / 当前兼容 `speciesId`：关联鸟种。
- `rarity`：普通、有趣、精彩、珍贵等结果层级。
- `title`、`description`：照片叙事文本。
- `stars`：展示层强度，不应单独驱动叙事价值。

未来预留字段：

- `photoMomentTags`：如觅食、停栖、回头、振翅。
- `compositionTags`：如远景、近景、逆光、遮挡。
- `weatherTags`、`timeTags`：天气 / 时间限定卡。
- `narrativeTags`：连接妹妹消息、夜晚想法和发布评论。
- `isPrecious`：珍贵卡标记，不能替代稀有度逻辑本身。

维护边界：

- 未加新前的卡牌标题和描述不应提前泄露正式鸟名。
- 卡牌定义不应保存玩家实际拍摄日期、鸟点、天气、对焦结果或发布状态。

## 7. locations 与 spots：地图区域与鸟点

`locations` 表达城市中的大区域，`spots` 表达玩家可以进入、移动、观鸟的具体点位。三测如果地图规模扩大，建议引入 `locations`，避免所有地图信息都堆在 `spots`。

`locations` 建议字段：

```js
{
  id: "old_town",
  name: "老城区",
  description: "",
  mapLabel: "",
  spotIds: [],
  unlockStage: "test3",
  moodTags: [],
  narrativeTags: []
}
```

`spots` 建议字段：

```js
{
  id: "community_gate",
  locationId: "old_town",
  name: "",
  description: "",
  soundscape: "",
  traits: [],
  travelCost: 1,
  neighbors: [],
  directions: {},
  speciesWeights: {},
  speciesDirectionRules: {},
  speciesTimeRules: {},
  weatherRules: {},
  eventPoolIds: []
}
```

三测现在就应有的字段：

- `spot.id`、`name`、`description`、`soundscape`：观鸟点基础体验。
- `traits`：连接鸟种、天气、事件。
- `travelCost`、`neighbors`、`directions`：移动与方向文案。
- `speciesWeights`：基础遭遇权重。
- `speciesTimeRules`：时间影响。

未来预留字段：

- `locationId`：当地图扩大后用于分组。
- `weatherRules`：天气影响鸟种、事件和描述。
- `eventPoolIds`：观鸟点可触发的非鸟类事件。
- `unlockConditions`：区域解锁条件，建议后续由事件 / playerProgress 控制。

## 8. encounters：遭遇规则

`encounters` 表达“什么情况下可能遇到什么”，用于把鸟点权重、方向、时间、天气、叙事阶段从单个 `spot` 中逐步拆出来。

建议字段：

```js
{
  id: "sparrow_morning_community_gate",
  birdId: "sparrow",
  spotId: "community_gate",
  weight: 10,
  directionRules: [],
  timeRules: [],
  weatherRules: [],
  playerConditions: [],
  firstEncounterEventId: "",
  focusProfileId: "",
  unlockStage: "test3"
}
```

三测现在就应有的字段：

- `birdId`、`spotId`：明确遭遇归属。
- `weight`：内容权重，不应混同卡牌稀有度。
- `timeRules`、`weatherRules`：三测丰富世界的关键条件。

未来预留字段：

- `playerConditions`：如已收到某条妹妹消息、已解锁某鸟点。
- `firstEncounterEventId`：首次遇见专属事件。
- `focusProfileId`：只引用对焦配置，不在遭遇数据中改对焦算法。

维护边界：

- 遭遇规则不应直接修改 PHOTO / FOCUS / RESULT 状态机。
- 拍照概率、稀有度逻辑和加新流程仍应由现有运行时规则控制，拆分前必须单独回归。

## 9. events：叙事 / 系统事件

`events` 表达非鸟种本体的叙事触发，包括环境小事、人物事件、地点事件、首次遇见包装、夜晚伏笔等。

建议字段：

```js
{
  id: "rain_under_eaves",
  type: "spot_event",
  trigger: "enter_spot",
  priority: 10,
  conditions: [],
  text: "",
  choices: [],
  sideEffectRefs: [],
  tags: []
}
```

三测现在就应有的字段：

- `id`、`type`、`trigger`：定位事件入口。
- `conditions`：天气、时间、地点、玩家阶段。
- `text`：事件正文。
- `priority`：解决多个事件同时可触发时的选择顺序。

未来预留字段：

- `choices`：如果未来加入轻量选择。
- `sideEffectRefs`：引用后续可审计的效果，不在文案中隐式改状态。
- `tags`：连接夜晚想法、妹妹消息和发布反馈。

## 10. weather 与 timeRules：环境和时间推进

天气与时间应先服务文本氛围、鸟类活动和叙事节奏，再考虑数值收益。

`weather` 建议字段：

```js
{
  id: "light_rain",
  displayName: "小雨",
  description: "",
  soundscape: "",
  visibilityModifier: "soft",
  birdActivityTags: [],
  spotTextOverrides: {},
  encounterModifiers: [],
  narrativeTags: []
}
```

`timeRules` 建议字段：

```js
{
  id: "test3_default_day",
  dayIndexRange: [1, 7],
  timeOfDayOrder: ["morning", "noon", "afternoon", "evening", "night"],
  turnCostRules: [],
  restTransitionText: "",
  unlockRules: []
}
```

三测现在就应有的字段：

- `weather.id`、`displayName`、`description`、`soundscape`。
- `weather.birdActivityTags` 或等价条件，用于影响遭遇池。
- `timeOfDayOrder`：明确一天中的阶段。
- `turnCostRules`：移动、观察、拍照等行为对时间的消耗。

未来预留字段：

- 天气预报、多日持续、季节、极端天气。
- 时间与妹妹作息、夜晚想法、发布反馈延迟的关联。
- 天气对照片视觉文本和评论语气的影响。

## 11. nightThoughts：夜晚想法

`nightThoughts` 是陈玉在一天结束后的自我整理，不应只是奖励结算。它适合承接白天看到的鸟、收到的妹妹消息、发布后的评论、没有说出口的担心。

建议字段：

```js
{
  id: "night_after_first_sparrow",
  stage: "test3_day1",
  conditions: [],
  text: "",
  relatedBirdIds: [],
  relatedMessageIds: [],
  relatedPostIds: [],
  emotionalTone: "quiet",
  nextDayHint: ""
}
```

三测现在就应有的字段：

- `id`、`stage`、`conditions`。
- `text`：夜晚想法正文。
- `relatedBirdIds`、`relatedMessageIds`：方便编辑器追踪来源。

未来预留字段：

- `relatedPostIds`：发布系统上线后关联。
- `emotionalTone`：用于 UI 表现和文本筛选。
- `nextDayHint`：轻量引导，不做强任务 KPI。

## 12. birdwatchers：观鸟人

`birdwatchers` 用于扩展城市世界和陈玉的人际观察。它不应抢走妹妹主线，也不应变成复杂 NPC 经营系统。

建议字段：

```js
{
  id: "retired_teacher",
  name: "",
  role: "local_birdwatcher",
  introductionText: "",
  spotAffinity: [],
  encounterConditions: [],
  adviceTags: [],
  eventIds: [],
  postCommentAuthorId: "",
  narrativeTags: []
}
```

三测现在可选字段：

- `id`、`name`、`role`。
- `introductionText`。
- `spotAffinity`、`encounterConditions`。

未来预留字段：

- `adviceTags`：观鸟提示。
- `eventIds`：人物事件。
- `postCommentAuthorId`：未来发布评论作者复用。

## 13. liyaMessages：妹妹消息

`liyaMessages` 仍是核心叙事反馈源。它应表达陈力娅如何回应陈玉的观察、照片、犹豫和恢复，而不是只承担任务提示。

建议字段：

```js
{
  id: "liya_sparrow_first_reply",
  speaker: "liya",
  type: "photo_reply",
  stage: "test3",
  trigger: "photo_captured",
  conditions: {},
  priority: 10,
  cooldown: 0,
  allowRepeat: false,
  lines: [],
  tags: [],
  emotionalTone: "warm",
  relatedBirdIds: [],
  relatedCardIds: [],
  followUpPolicy: "none"
}
```

三测现在就应有的字段：

- 当前 JSON 已有的 `id`、`speaker`、`type`、`stage`、`trigger`、`conditions`、`priority`、`cooldown`、`allowRepeat`、`lines`、`tags`。
- `conditions` 应尽量使用可校验字段，避免编辑器无法判断是否可触发。

未来预留字段：

- `emotionalTone`：妹妹语气。
- `relatedBirdIds`、`relatedCardIds`：编辑器反查引用。
- `followUpPolicy`：后续是否允许追问、隔天回响或夜晚回响。

维护边界：

- `liyaMessages` 不应替代 `sisterKnowledge`；前者是聊天 / 叙事回应，后者是图鉴补充知识。
- 不应把消息延迟、队列、选择逻辑写进内容字段后绕过运行时。

## 14. posts、postComments 与 accountProgress：发布系统

发布系统是未来方向，不应在规划中假装当前已经实装。它的职责是让陈玉把“普通的鸟、普通的照片、普通的生活”重新放到公共空间里，而不是让玩家刷流量。

`posts` 建议字段：

```js
{
  id: "post_001",
  sourcePhotoId: "",
  birdId: "sparrow",
  cardId: "",
  caption: "",
  createdAtDayIndex: 3,
  visibility: "public",
  moodTags: [],
  themeTags: [],
  commentPoolIds: []
}
```

`postComments` 建议字段：

```js
{
  id: "comment_sparrow_neighbor_001",
  poolId: "sparrow_ordinary_city",
  authorType: "stranger",
  authorId: "",
  tone: "gentle",
  conditions: [],
  lines: [],
  weight: 1,
  tags: []
}
```

`accountProgress` 建议字段：

```js
{
  id: "chenyu_account",
  stage: "quiet_start",
  unlockedThemes: [],
  audienceMood: "small_and_kind",
  trustBand: "low",
  milestoneIds: [],
  narrativeFlags: []
}
```

三测现在可选字段：

- `posts.sourcePhotoId`：引用玩家选择发布的照片。
- `posts.caption`：陈玉的表达。
- `postComments.lines`、`tone`：评论内容与语气。
- `accountProgress.stage`：定性账号阶段。

未来预留字段：

- `followersApprox`、`likesApprox` 只能作为模糊档位或叙事标签，不建议作为精确 KPI。
- `collaborationOffers` / 商单只应作为主题事件，不能成为主线目标。
- `audienceMood` 可表达“有人温柔地看见了她”，而不是“数据涨了”。

维护边界：

- 发布系统归发布系统，不应直接改鸟种基础数据。
- 评论池归 `postComments`，不应塞入鸟卡描述。
- 账号成长归 `accountProgress`，不应替代 `playerProgress` 的正式存档结构。

## 15. playerProgress：玩家进度

`playerProgress` 表达玩家当前玩到了哪里、见过什么、解锁了什么、保存了什么。它是运行时存档域，不是内容生产域。

建议字段方向：

```js
{
  schemaVersion: 1,
  dayIndex: 1,
  timeOfDay: "morning",
  currentSpotId: "",
  unlockedLocationIds: [],
  unlockedSpotIds: [],
  seenBirdIds: [],
  cataloguedBirdIds: [],
  collectedCardIds: [],
  photoSnapshots: [],
  readMessageIds: [],
  seenNightThoughtIds: [],
  publishedPostIds: [],
  narrativeFlags: {}
}
```

三测现在就应有的概念：

- 天数 / 时间阶段。
- 当前鸟点。
- 已见过 / 已加新鸟种。
- 已获得卡牌或照片 snapshot。
- 已读消息。
- 已解锁鸟点。

未来预留字段：

- `publishedPostIds`：发布系统上线后使用。
- `seenNightThoughtIds`：避免夜晚想法重复。
- `narrativeFlags`：少量主题阶段标记，避免把复杂剧情写死在多个数据文件中。

维护边界：

- 本文不建议修改当前 LocalStorage key。
- 正式存档迁移应单独设计、单独测试、单独记录 DevLog。
- 编辑器不应直接编辑玩家个人存档。

## 16. editorWorkbench：编辑器工作台

`editorWorkbench` 不是游戏运行时系统，而是未来内容生产、校验、预览和发布的工作台元数据。

编辑器未来应该编辑：

- 鸟种：基础描述、首次遇见描述、标签、栖息地、活跃时间。
- 鸟卡：标题、描述、稀有度、叙事标签、天气 / 时间标签。
- 地点与鸟点：地图文案、环境声、连接关系、鸟种权重、规则引用。
- 遭遇规则：鸟种、鸟点、天气、时间、阶段条件。
- 事件：事件文案、触发器、条件、优先级。
- 天气：展示文本、声音氛围、遭遇修正标签。
- 夜晚想法：文本、条件、关联鸟 / 消息 / 发布。
- 观鸟人：人物简介、出现条件、事件引用、评论作者信息。
- 妹妹消息：触发器、条件、文本行、语气、引用关系。
- 发布系统：帖子模板、评论池、账号叙事里程碑。

编辑器不应直接编辑：

- LocalStorage 正式存档。
- analytics payload。
- survey 字段。
- PHOTO / FOCUS / RESULT 状态机。
- 自动加新流程。
- 运行时 snapshot 原始结构。

建议工作台元数据：

```js
{
  schemaVersion: 1,
  domain: "birds",
  itemId: "sparrow",
  status: "draft",
  owner: "",
  updatedAt: "",
  validationRules: [],
  dependencyRefs: [],
  previewConfig: {},
  notes: ""
}
```

关键校验：

- `birdCards.birdId` 必须引用存在的鸟。
- `spots.speciesWeights` 中的鸟 id 必须存在。
- `encounters.spotId`、`encounters.birdId` 必须存在。
- `liyaMessages.conditions` 必须是运行时支持的条件。
- 未加新前文本不得泄露正式鸟名。
- `postComments.poolId` 必须能被帖子或评论池引用。
- 发布系统数值字段不得成为主线 KPI。

## 17. 字段归属边界

| 归属 | 应保存的数据 | 不应保存的数据 |
|---|---|---|
| 鸟 | 物种事实、外观、声音、栖息地、活跃时间、叙事标签 | 玩家某次拍照结果、是否已发布、点赞数 |
| 照片 / 卡牌 | 卡牌模板、稀有度、照片时刻描述、构图标签 | 鸟种科普全集、玩家账号阶段 |
| 玩家照片 snapshot | 实际拍到的鸟、卡牌、鸟点、时间、天气、对焦 / 结果摘要 | 全局鸟种定义、全局卡牌定义 |
| 地点 / 鸟点 | 地图文案、移动关系、环境声、遭遇权重、天气 / 时间规则引用 | 妹妹聊天正文、账号成长 |
| 消息 | 说话人、触发器、条件、文本、语气、引用鸟 / 卡牌 | 照片原始数据、运行时队列算法 |
| 发布系统 | 帖子、评论池、账号叙事阶段、公开表达主题 | 鸟种定义、PHOTO / FOCUS / RESULT 状态 |
| 玩家进度 | 解锁、已见、已读、已收集、已发布、叙事旗标 | 内容生产草稿、编辑器审批状态 |
| 编辑器 | 草稿状态、校验规则、依赖关系、预览配置 | 玩家个人存档、analytics、survey |

## 18. 三测最小可用字段与未来预留

三测建议优先具备：

- `birds`：`id`、`displayName`、`appearance`、`firstEncounterAppearance`、`habitats`、`commonness`、`activeTime`、`unlockStage`。
- `birdCards`：`id`、`birdId/speciesId`、`rarity`、`title`、`description`、`stars`。
- `spots`：`id`、`name`、`description`、`soundscape`、`traits`、`travelCost`、`neighbors`、`directions`、`speciesWeights`、`speciesTimeRules`。
- `weather`：`id`、`displayName`、`description`、`soundscape`、`birdActivityTags`。
- `timeRules`：`timeOfDayOrder`、`turnCostRules`、`restTransitionText`。
- `liyaMessages`：沿用当前核心字段，并强化可校验 conditions。
- `playerProgress`：只在实际实现时谨慎设计，不能本轮改存档。

未来预留但不建议三测一口气全做：

- 完整 `locations` 层级地图。
- 完整 `encounters` 独立规则表。
- 大量 `events` 事件系统。
- 完整 `birdwatchers` 人物系统。
- 发布系统的 `posts`、`postComments`、`accountProgress`。
- 编辑器审批流、多用户协作和自动发布管线。

## 19. 后续 5 个小提交建议

1. 先补 `weather` 与 `timeRules` 的设计样例文档，不接入运行时。
2. 梳理 `species/cards/spots/liyaMessages` 的字段实际使用清单，形成编辑器校验规则。
3. 为三测内容新增“鸟 / 鸟卡 / 鸟点 / 妹妹消息”制作模板，不改游戏逻辑。
4. 设计发布系统最小原型文档，只定义叙事边界和字段，不写实现。
5. 为编辑器工作台定义 preview / validation checklist，先服务人工内容校对。

## 20. 实施边界

本规划不改变以下内容：

- 不修改运行时代码。
- 不修改现有数据文件。
- 不修改 CSS 或 HTML。
- 不修改 LocalStorage key。
- 不修改 analytics 或 survey。
- 不修改 PHOTO / FOCUS / RESULT。
- 不修改消息队列。
- 不修改自动加新流程。

