# DEVLOG_CURRENT_STATUS

更新时间：2026-05-14

本文档用于给后续 GPT / Codex 说明当前项目结构、接口边界和最新实现状态。后续开发指令应优先参考本文档，避免基于旧设计做判断。

## 项目定位

本项目是一个纯文字 HTML 观鸟模拟器 MVP，用于验证核心玩法循环：

找鸟线索 -> 选择观察方向 -> 发现鸟 -> 拍照时机选择 -> 抽卡 -> SD 卡 -> 图鉴 -> 结算。

当前约束仍然是：

- 使用原生 HTML + CSS + JavaScript。
- 不使用 React / Vue。
- 不引入第三方库。
- 不修改 LocalStorage 结构，除非明确要求。
- 当前环境约束下不要运行 npm、node、python、浏览器或本地服务器。
- 数据和逻辑分离：鸟种、卡牌、配置、鸟点放在 `data/`，规则逻辑放在 `src/`。

## 文件结构概览

### 根目录

- `index.html`
  - 页面 DOM 结构。
  - 引入 `styles/style.css` 和 `src/main.js`。
  - 当前包含：标题、顶部状态栏、事件描述、行动按钮、详情面板、观察日志。

- `styles/style.css`
  - 全部 UI 样式。
  - 包含状态栏、按钮、行动区、面板、动态地图、行为状态徽章、卡牌稀有度徽章、NEW 标记、PHOTO 动效、SETTLEMENT 动效等样式。

### data

- `data/config.js`
  - 全局配置：
    - `MAX_TURNS = 30`
    - `MAX_PHOTOS = 15`
    - `INITIAL_ACTIVE_BIRDS = 3`
    - `DIRECTIONS`
    - `BIRD_STAY_TURNS`
    - `DISTANT_LISTEN_CONFIG`
    - `PHOTO_SEQUENCE_CONFIG`
    - `LOG_LIMIT`
  - `PHOTO_SEQUENCE_CONFIG.stateWeights` 只包含 `NORMAL / INTERESTING / REMARKABLE`，没有 `PRECIOUS`。

- `data/species.js`
  - 鸟种数据。
  - 每个鸟种包含 `id`、`name`、`habitat`、`clue`。

- `data/cards.js`
  - 卡牌数据。
  - 每张卡包含：
    - `id`
    - `speciesId`
    - `rarity`
    - `title`
    - `description`
    - `stars`
  - 当前已有 `NORMAL / INTERESTING / REMARKABLE` 卡牌。
  - 暂无 `PRECIOUS` 卡牌，但显示和抽卡结构已预留支持。
  - 注意：`rarity` 和 `stars` 都保留，不要删除或改成中文字符串。

- `data/spots.js`
  - 鸟点数据。
  - 每个鸟点包含：
    - `id`
    - `name`
    - `description`
    - `soundscape`
    - `traits`
    - `travelCost`
    - `neighbors`
    - `directions`
    - `speciesWeights`
  - `directions` 约定：
    - `0` = 绝对北
    - `1` = 绝对东
    - `2` = 绝对南
    - `3` = 绝对西
  - 玩家可见方向文案应使用当前鸟点 `directions[facingDirection]` 对应的观察面名称，不应直接显示旧的“北 / 东 / 南 / 西”。

## 当前 gameState 结构

`src/gameState.js` 的 `createDefaultGameState()` 返回当前局状态。

核心字段：

- `mode`
  - 内部英文状态，不要改成中文。
  - 当前已使用状态：
    - `START`
    - `START_SPOT_SELECT`
    - `EXPLORE`
    - `DISTANT_LISTEN`
    - `SPOT_SELECT`
    - `PHOTO`
    - `FIELD_GUIDE`
    - `SETTLEMENT`

- `currentTurn`
- `maxTurns`
- `currentSpotId`
- `availableSpotOptions`
- `facingDirection`
- `directions`
- `maxPhotos`
- `photos`
- `logs`
- `activeBirds`
- `currentPhotoTarget`
- `currentPhotoSequence`
- `distantListenOptions`
- `fieldGuide`
- `sessionNewCards`
- `sessionHeardSpeciesIds`
- `unlockedCardIdsAtRunStart`
- `eventText`
- `eventHtml`

注意：

- `distantListenOptions` 是当前局临时状态，不写入 LocalStorage。
- `unlockedCardIdsAtRunStart` 是本局开始前图鉴已拥有 cardId 快照，用于结算 NEW 判断，不写入 LocalStorage。
- `eventHtml` 只用于内部生成的安全富文本事件描述，例如快门反馈里的稀有度徽章。

## 状态流转概览

### START

初始状态。

UI 行动：

- 开始游戏
- 查看图鉴

点击开始游戏后进入 `START_SPOT_SELECT`。

### START_SPOT_SELECT

选择初始鸟点。

特点：

- 初始选点不消耗回合。
- 调用 `startGameAtSpot(spotId)`。
- 在这里记录 `unlockedCardIdsAtRunStart`。

### EXPLORE

主要探索状态。

当前显示的行动按钮：

- 观察当前方向
- 向左转
- 向右转
- 倾听远处的声音
- 查看图鉴
- 提前撤离并结算

当前隐藏但内部逻辑仍保留的旧 action：

- `turnBack`
- `listen`
- `listenFar`
- `wait`

转向说明：

- `turnLeft / turnRight / turnBack` 仍走 `turnDirection(state, offset)`。
- 转向事件描述使用 `getSurroundingSpotMap(state).facingName`，与顶部方向和地图当前面向保持一致。
- 转向事件会调用 `generateClues(state)`。
- `generateClues(state)` 会对最终展示 clue 文案做去重，避免同方向多只同种鸟导致同一句线索重复显示。

### DISTANT_LISTEN

远听决策状态。

进入方式：

- 在 `EXPLORE` 点击“倾听远处的声音”。
- 消耗 1 回合。
- 根据当前鸟点 `neighbors` 生成最多两个远处鸟点的声音情报。
- 更新 `distantListenOptions`。
- 听到具体鸟种时调用 `markHeard()`。

状态下显示的行动按钮：

- 前往某个远处鸟点
- 观察当前方向
- 再听一会

行为：

- 前往某鸟点：
  - 切换 `currentSpotId`
  - 刷新 `activeBirds`
  - 清空 `distantListenOptions`
  - 设置 `mode = "EXPLORE"`
  - 消耗目标鸟点 `travelCost`

- 观察当前方向：
  - 清空 `distantListenOptions`
  - 回到 `EXPLORE`
  - 复用现有 `handleExploreAction(state, "observe")`

- 再听一会：
  - 不切换鸟点
  - 不退出 `DISTANT_LISTEN`
  - 重新生成远听结果
  - 消耗 1 回合
  - 回合耗尽时通过 `advanceTurn()` 进入结算

### PHOTO

拍照时机状态。

进入方式：

- 在 `EXPLORE` 观察当前方向并成功发现鸟。

行动按钮：

- 按下快门
- 再等一等
- 放弃拍摄

当前顶部“拍摄时机”状态块显示当前 behaviorState：

- `NORMAL` -> 寻常
- `INTERESTING` -> 有趣
- `REMARKABLE` -> 精彩
- `PRECIOUS` -> 珍贵（已预留显示支持，但普通流程不会随机生成）
- `FLY_AWAY` -> 飞离

注意：

- 拍摄时机来自 behaviorState，不是 card.rarity。
- `PRECIOUS` 已加入 `BEHAVIOR_STATE_DISPLAY`，但没有加入 `PHOTO_SEQUENCE_CONFIG.stateWeights`。
- 点击“再等一等”后，顶部行为状态徽章会跳动一次。
- 点击“按下快门”后，事件描述块会局部白闪一次；白闪提前在业务 action 分发前触发，不是全屏白闪。

### FIELD_GUIDE

图鉴查看状态。

行动按钮：

- 返回
- 开始新游戏
- 清空图鉴

### SETTLEMENT

结算状态。

行动按钮：

- 重新开始
- 查看图鉴

结算统计显示：

- 拍照数量：`photos.length / maxPhotos`
- 记录鸟种：本局照片里的 unique species 数量
- 听到鸟种：`sessionHeardSpeciesIds.length`
- 新增图鉴：结算中实际显示 NEW 的新 cardId 数量
- 记录点数：本局照片 `card.stars` 总和

结算照片列表显示：

- 鸟种名称
- 卡牌名称
- 卡牌稀有度 badge
- NEW 标记

结算不显示拍摄时机 `behaviorState`。

结算页面有轻量逐行出现动效：

- 标题淡入上浮。
- 统计行逐行淡入上浮。
- 照片列表稍后快速渐显。
- NEW 卡牌项有柔和高光，NEW badge 有一次轻微弹出。
- 动效支持 `prefers-reduced-motion: reduce`，减少动态效果时内容直接可见。

## 主要模块职责

### src/main.js

UI 渲染和按钮事件分发。

职责：

- 维护当前页面级 `gameState`。
- 查询 DOM 元素。
- 渲染顶部状态栏。
- 渲染行动按钮。
- 渲染事件描述。
- 渲染日志。
- 渲染详情面板：
  - 图鉴
  - 结算
  - 拍照面板
  - 初始鸟点选择
  - 旧 SPOT_SELECT 面板
  - 默认观察区域 / 地图
- 根据按钮 `dataset.type` 分发到对应 handler：
  - `system`
  - `explore`
  - `distantListen`
  - `spot`
  - `startSpot`
  - `photo`

重要 UI 规则：

- `state.mode` 只在内部使用英文枚举。
- 顶部阶段显示通过 `getModeDisplay(mode)` 中文化。
- 顶部“拍摄时机”通过 `getCurrentPhotoState(currentPhotoSequence)` 显示 behavior badge。
- 事件描述优先使用 `eventHtml`，否则使用 `eventText`。
- `eventHtml` 只应由内部安全函数生成，不应拼接用户输入。
- PHOTO 动效只由 `photo/wait` 和 `photo/shoot` 触发：
  - `wait`：render 后重启动画 `.behavior-badge.is-pulsing`。
  - `shoot`：业务 action 分发前重启动画 `.event-box.is-shutter-flashing`。
- `renderSettlement()` 会为结算标题、统计行、照片项写入 `settlement-reveal` 和 `--reveal-delay`。

### src/gameSession.js

核心一局流程和 action 处理。

主要导出：

- `startGame()`
- `startGameAtSpot(spotId)`
- `handleExploreAction(state, action)`
- `handleDistantListenAction(state, action)`
- `handleSpotSelectAction(state, spotId)`
- `handlePhotoAction(state, action)`
- `endGame(state)`

内部关键函数：

- `advanceTurn(state, turnCost = 1)`
  - 推进回合。
  - 调用 `updateBirds(state)`。
  - 回合耗尽时进入结算。

- `enterPhotoMode(state, bird)`
  - 进入 `PHOTO`。
  - 设置 `currentPhotoTarget` 和 `currentPhotoSequence`。

- `updateDistantListenResult(state, introText)`
  - 调用 `listenDistantSounds(state)`。
  - 更新 `eventText`、`distantListenOptions`。
  - 对听到的鸟调用 `recordHeardSpecies()`。

- `getShutterMessage(card)`
  - 快门反馈纯文本，用于 `eventText` 和日志。
  - 当前格式：
    - `咔擦！${momentComment}获得${rarityDisplay.label}照片：${title}`
    - `${description}`
  - `momentComment` 是短提示，可为空；为空时第一行自然显示为 `咔擦！获得...`。

- `getShutterMessageHtml(card)`
  - 快门反馈富文本，用于 `eventHtml`。
  - 当前格式：
    - `咔擦！${momentComment}获得${createRarityBadgeHtml(card)}照片：<strong>${title}</strong><br>${description}`
  - 快门提示规则：
    - 实际照片品质高于拍摄时机：`赚到了！`
    - 实际照片品质低于拍摄时机：`可惜！`
    - 实际照片品质等于拍摄时机：默认无提示，约 25% 显示 `时机刚好！`
    - `PRECIOUS` 照片：`太难得了！`

### src/encounterSystem.js

观察和听声规则。

导出：

- `observeCurrentDirection(state)`
- `listen(state)`
- `listenDistantSounds(state)`

当前远听规则：

- 只使用相邻鸟点。
- 不显示当前鸟点前/左/右/后声音信息。
- 每个相邻鸟点独立判断。
- 每个鸟点最多显示 0-1 种鸟。
- 听到鸟时返回 `heardSpeciesId`。

### src/spotManager.js

鸟点查询、地图数据和权重抽取。

导出：

- `getAllSpots()`
- `getSpotById(spotId)`
- `getCurrentSpot(state)`
- `getAvailableSpotOptions(currentSpotId)`
- `getNeighborSpots(currentSpotId, limit = 2)`
- `getSurroundingSpotMap(state)`
- `pickWeightedSpecies(speciesWeights)`

当前地图规则：

- 地图是相对朝向地图，不是北向地图。
- `front = directions[facingDirection]`
- `right = directions[(facingDirection + 1) % 4]`
- `back = directions[(facingDirection + 2) % 4]`
- `left = directions[(facingDirection + 3) % 4]`
- 地图中心使用 `currentSpot.name`。
- 顶部方向、地图当前面向、转向事件描述都使用 `facingName`。

### src/birdManager.js

活动鸟生成和更新。

导出：

- `initializeBirds(currentSpot)`
- `updateBirds(state)`
- `getBirdsInCurrentDirection(state)`
- `generateClues(state)`
- `getSpeciesById(speciesId)`

当前活动鸟字段：

- `instanceId`
- `speciesId`
- `directionIndex`
- `stayTurns`
- `clueStrength`

注意：

- `activeBirds` 允许同一个 `speciesId` 在同一个 `directionIndex` 同时存在多只。
- `generateClues(state)` 不删除鸟实例，只对最终展示 clue 文案去重。

### src/photoSequence.js

拍照时机状态机。

导出：

- `BEHAVIOR_STATE_DISPLAY`
- `createPhotoSequence()`
- `getCurrentPhotoState(photoSequence)`
- `getRemainingDecisionCount(photoSequence)`
- `recordShutterDecision(photoSequence)`
- `advancePhotoSequence(photoSequence)`
- `isBirdGone(photoSequence)`

内部 behaviorState：

- `NORMAL`
- `INTERESTING`
- `REMARKABLE`
- `PRECIOUS`：仅预留显示支持，不进入当前随机生成权重。
- `FLY_AWAY`

UI 文案在 `BEHAVIOR_STATE_DISPLAY`。

当前随机生成机制：

- `pickWeightedBehaviorState()` 只读取 `PHOTO_SEQUENCE_CONFIG.stateWeights`。
- `data/config.js` 中当前 `stateWeights` 只有 `NORMAL / INTERESTING / REMARKABLE`。
- 不要把 `PRECIOUS` 加入当前随机权重，除非明确要求投放珍贵状态。

### src/cardDraw.js

抽卡规则。

导出：

- `drawCard(speciesId, behaviorState)`

当前流程：

1. 根据 `behaviorState` 取显式权重表。
2. 先按权重抽取目标照片品质 `rarity`。
3. 再从 `speciesId + rarity` 的卡池中等概率抽具体 card。
4. 如果目标 rarity 卡池为空，按该 behaviorState 的权重从高到低查找可用 rarity。
5. 如果仍无可用 rarity，则 fallback 到该 `speciesId` 任意卡牌。
6. 如果该鸟种完全没有卡牌，返回 `null`。

当前权重：

- `NORMAL`
  - 90% -> `NORMAL`
  - 10% -> `INTERESTING`

- `INTERESTING`
  - 20% -> `NORMAL`
  - 70% -> `INTERESTING`
  - 10% -> `REMARKABLE`

- `REMARKABLE`
  - 10% -> `INTERESTING`
  - 90% -> `REMARKABLE`
  - 0% -> `NORMAL`

- `PRECIOUS`
  - 100% -> `PRECIOUS`
  - 当前无 `PRECIOUS` 卡时会 fallback，不会报错。

注意：

- 抽卡使用 card.rarity。
- 不要把 behaviorState 和 card.rarity 混为一谈。
- `drawCard(speciesId, behaviorState)` 接口保持不变。

### src/rarityDisplay.js

卡牌稀有度显示工具。

导出：

- `getRarityDisplay(raritySource)`
- `createRarityBadgeHtml(raritySource)`

支持传入：

- card 对象
- `rarity` 字符串
- `stars` 数值

显示规则：

- `NORMAL` 或 1 -> 寻常
- `INTERESTING` 或 2 -> 有趣
- `REMARKABLE` 或 3 -> 精彩
- `PRECIOUS` 或 >= 4 -> 珍贵

注意：

- `rarity-badge` 用于卡牌稀有度。
- `behavior-badge` 用于拍摄时机。
- 两者颜色可接近，但语义不能混用。
- `createRarityBadgeHtml("PRECIOUS")` 会生成 `rarity-precious` badge。

### src/fieldGuide.js

图鉴数据更新。

导出：

- `markHeard(fieldGuide, speciesId)`
- `addCard(fieldGuide, cardData)`
- `getFieldGuide(fieldGuide)`

会调用 `saveFieldGuide(fieldGuide)`。

### src/storage.js

LocalStorage 读写。

当前图鉴结构：

- `heardSpeciesIds`
- `collectedCards`

不要随意修改 LocalStorage 结构。

## UI 当前结构

### index.html

页面顺序：

1. 标题
2. 顶部状态栏
3. 事件描述
4. 行动按钮
5. 详情面板
6. 观察日志

顶部状态栏包含：

- 当前阶段
- 剩余回合
- 鸟点
- 方向
- SD 卡
- 拍摄时机

CSS 通过 order 排成三行：

- 第一行：剩余回合 + SD 卡
- 第二行：鸟点 + 方向
- 第三行：当前阶段 + 拍摄时机

### 详情面板优先级

`renderDetailPanel()` 根据 mode 选择：

- `FIELD_GUIDE` -> 图鉴
- `SETTLEMENT` -> 本局结算
- `PHOTO` -> 拍照面板
- `START_SPOT_SELECT` -> 初始鸟点选择
- `SPOT_SELECT` -> 旧远处声景 / 鸟点选择面板
- 其他 -> 默认观察区域和动态地图

观察日志已移动到页面底部。

## 样式状态

### 按钮

普通按钮：

- 默认浅绿色背景。

关键节点按钮：

- class：`button-major`
- 使用范围：
  - 开始游戏
  - 开始新游戏
  - 重新开始
- 当前颜色：
  - 背景 `#5E8C61`
  - 白字
  - 阴影 `#456B48`

不要把普通行动按钮改成 `button-major`。

### 地图

- 地图使用 `.text-map` 外层。
- 地图内部使用 `.map-grid`、`.map-node`、`.map-connector-*`。
- 当前为带连接线和箭头的相对朝向地图：
  - 上方 = `front`
  - 左侧 = `left`
  - 中心 = `currentSpot.name`
  - 右侧 = `right`
  - 下方 = `back`
- 不要退回 `<pre>` 空格对齐。

### 徽章

拍摄时机：

- `behavior-badge`
- `state-normal`
- `state-interesting`
- `state-remarkable`
- `state-precious`
- `state-fly-away`

卡牌稀有度：

- `rarity-badge`
- `rarity-normal`
- `rarity-interesting`
- `rarity-remarkable`
- `rarity-precious`

NEW 标记：

- `new-badge`

### 动效

PHOTO：

- `.behavior-badge.is-pulsing`
  - 点击“再等一等”后播放。
  - 用于提示行为状态序列已经推进。

- `.event-box.is-shutter-flashing::after`
  - 点击“按下快门”时播放。
  - 只作用于事件描述块。
  - 起始即最大亮度，快速淡出。

SETTLEMENT：

- `.settlement-reveal`
  - 标题、统计行、照片项淡入上浮。

- `.settlement-photo-card.is-new-card`
  - NEW 卡牌项高光。

- `.settlement-photo-card.is-new-card .new-badge`
  - NEW badge 弹出。

所有新增动效都应保留 `prefers-reduced-motion: reduce` 兼容。

## 结算 NEW 判断

本局开始时：

- `startGameAtSpot()` 从当前 `fieldGuide.collectedCards` 记录 `unlockedCardIdsAtRunStart`。

结算时：

- 如果 `photo.card.id` 不在 `unlockedCardIdsAtRunStart`，则视为本局新卡。
- 同一个新 cardId 本局重复获得，只第一次显示 NEW。
- `renderSettlement()` 使用 `shownNewCardIds` 控制本局重复新卡只显示一次 NEW。

这只影响 UI，不写入 LocalStorage。

## 注意事项和后续开发建议

1. 不要把 `state.mode` 改成中文，UI 中文化只在 `main.js` 渲染层处理。
2. 不要删除旧 action 的内部逻辑，除非明确要求。
3. `SPOT_SELECT` 是旧的鸟点选择状态，目前 UI 主流程使用 `DISTANT_LISTEN`，但旧逻辑仍存在。
4. `DISTANT_LISTEN` 地图只显示当前鸟点相对地图，不显示远听结果。
5. 远听结果只应显示在事件描述或远听相关 UI 中。
6. `eventHtml` 只能用于内部生成的安全 HTML，不要直接拼接用户输入或外部数据。
7. 拍摄时机 behaviorState 和卡牌稀有度 card.rarity 是不同概念：
   - behaviorState 决定抽卡权重表。
   - card.rarity / stars 决定实际卡牌品质显示。
8. `REMARKABLE` 拍摄时机现在不会抽到 `NORMAL` 照片。
9. `PRECIOUS` 已预留显示和抽卡结构，但普通流程不会随机生成该 behaviorState。
10. LocalStorage 图鉴结构不要改。
11. 当前环境不要运行 npm、node、python、浏览器或服务器。
