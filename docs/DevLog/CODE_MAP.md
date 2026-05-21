# 《认鸟手信》代码地图

本文档供未来开发、QA、调参、接入新系统时快速理解代码结构。它不是用户文档，也不是玩法设计案，而是开发者维护文档。

## 1. 当前版本核心定位

当前项目是原生 HTML / CSS / JavaScript 的文字观鸟游戏验证版。

核心系统包括：

- PHOTO 多阶段流程
- FOCUS 焦内序列
- 所见即所得抽卡
- 对焦词缀：正常 / 失焦
- 拍照丰富度：距离、缩放、旋转、鸟种色与多照片回放
- 图鉴三状态与“为它加新”
- 电量 UI
- 6 种鸟的数据、卡牌、鸟点权重和 FOCUS 参数

## 2. 目录结构概览

- `index.html`
  - 页面入口 DOM。
  - 引入 `styles/style.css` 和 `src/main.js`。

- `styles/`
  - UI 样式。
  - 包含状态栏、按钮、图鉴、地图、拍摄时机、拍立得、结算等视觉层。

- `src/`
  - 业务规则、UI 渲染、状态机、抽卡、图鉴、对焦计算等 JS 模块。

- `data/`
  - 鸟种、卡牌、鸟点、全局配置、FOCUS 手感配置。

- `docs/DevLog/`
  - 开发日志、当前状态说明和本代码地图。

## 3. 入口与渲染层

相关文件：`src/main.js`

职责：

- DOM 渲染。
- action 分发。
- FOCUS 动画生命周期。
- moving badge 渲染。
- `latestVisibleFocusState` 捕获。
- `latestFocusResult` / `capturedFocusAffix` 捕获。
- FOCUS 固定 4:3 frame 尺寸渲染与实际 DOM frame 命中换算。
- FOCUS badge 的距离缩放、runtime 随机缩放、轨迹旋转和 snapshot 回放样式。
- 鸟种色卡 badge 样式生成，用于拍立得和图鉴详情的定格回放。
- 图鉴卡牌详情多照片翻阅 UI。
- observation log 渲染。
- loading mask 隐藏。
- 事件文本 reveal key 控制，避免同一事件文本因二次 render 重播。
- 拍立得 overlay / 质量视觉反馈 / 自清理退场动画。

维护边界：

- `main.js` 是 UI 层，不应承载核心业务规则。
- UI 点击只负责把 action 分发给 `handleExploreAction()`、`handlePhotoAction()` 等业务函数。
- shoot 点击瞬间捕获是所见即所得关键点：必须在分发 `handlePhotoAction()` 前读取 visible badge 状态和对焦结果。
- `latestVisibleFocusState` 是拍摄结果 rarity 的来源，不要用外部 `photoSequence` 当前状态替代它。
- `latestFocusResult.isGreen` / focus affix 决定正常或失焦；失焦不阻止拍摄，也不改变 rarity。
- `latestFocusResult` 需要和实际渲染的固定 4:3 frame 一致；不要只改 CSS 或只改判定配置。
- `focusBadgeRandomScale`、`latestBadgeRotation`、`fieldGuideDetailSnapshotIndex` 都是 UI runtime 状态，不应写入 gameState 或 LocalStorage。
- 日志是历史记录，可以保留当时 nickname / 真名差异；结算则按当前图鉴状态统一显示。
- 拍立得退场动画是 UI 生命周期，不应阻塞 `refocus` action，也不应在 cleanup 中触发整页 render。

## 4. 业务状态机

相关文件：`src/gameSession.js`

职责：

- EXPLORE / PHOTO / SETTLEMENT 等主模式切换。
- `handleExploreAction()`：探索阶段 action。
- `handlePhotoAction()`：PHOTO 子阶段 action。
- 拍照、等待、转移、飞走、结算进入。

PHOTO 子阶段：

- `DECISION`
- `FOCUS`
- `RESULT`
- `REPOSITION`
- `LOST`

PHOTO 子阶段按钮规则：

- DECISION：
  - 举起相机
  - 再等一等
  - 放弃拍摄

- FOCUS：
  - 按下快门

- RESULT：
  - 继续跟焦
  - 再等一等
  - 放弃拍摄

- REPOSITION：
  - 寻找位置

- LOST：
  - 放下相机

维护边界：

- `gameSession.js` 不访问 DOM。
- 不负责 FOCUS 每帧动画，不负责具体对焦运动计算。
- `shoot` 使用 UI 传入的 `capturedBehaviorState` 决定 `drawCard()` 的 rarity。
- `capturedFocusAffix` 只影响正常 / 失焦标签和内部展示数据，不改变 rarity。
- `REPOSITION` 表示鸟离开当前取景位置但仍在视野。
- `LOST` 表示本次已经失去位置。
- 不要直接从焦内 `TRANSFER` 跳回 EXPLORE。

## 5. 外部行为序列 vs 焦内序列

### 外部行为序列

相关文件：`src/photoSequence.js`

职责：

- 决定 DECISION / RESULT 文案中的当前外部行为状态。
- 决定进入 FOCUS 时焦内序列的起始状态。
- 决定 wait / TRANSFER 后是否进入 `FLY_AWAY`。
- 不负责 FOCUS 内 badge 的实时状态变化。

外部状态：

- `NORMAL`
- `INTERESTING`
- `REMARKABLE`
- `FLY_AWAY`

`TRANSFER` 不属于 `photoSequence.js`。

### 焦内序列

相关文件：`src/focusSequence.js`

职责：

- FOCUS 内部可见状态序列。
- 决定 moving badge 当前显示什么状态。
- 按下快门时 visible state 决定卡牌 rarity。
- `TRANSFER` 是焦内结束节点，不是外部行为状态，不应显示为 badge。

文字流程：

外部 `behaviorState`
→ 进入 FOCUS
→ 生成 `focusSequence`
→ badge 显示 visible state
→ shoot 捕获 visible state
→ `drawCard()` 指定 rarity

## 6. 对焦系统

相关文件：

- `src/focusEngine.js`
- `data/focusConfig.js`
- `data/config.js`

`src/focusEngine.js`：

- 纯计算模块。
- 使用 normalized position。
- 支持 pattern / layers / stutter / hop 等运动计算。
- `isInFocusBox()` / `isInGreenZone()` 负责合焦判定。
- `evaluateFocus()` 返回 position、distance、affix、isGreen。
- `computeBadgeRotation()` 根据显示位置轨迹计算平滑旋转角，不访问 DOM / window / LocalStorage。

`data/focusConfig.js`：

- 各鸟种 FOCUS 手感参数。
- movement pattern。
- layers。
- stutter。
- sequence 参数。

`data/config.js`：

- `CAMERA_FOCUS_CONFIG` 保留全局合焦矩形和分数阈值配置。
- `BIRD_DISTANCE_DEFAULT_WEIGHTS` / `BIRD_DISTANCE_SCALE` / `BADGE_RANDOM_SCALE` / `BADGE_ROTATION` 是拍照丰富度参数。

维护边界：

- 主视觉合焦框当前由 `main.js` 的固定 4:3 `FOCUS_FRAME_VISUAL_SIZE` 渲染，并按实际 DOM frame 换算为 normalized 命中框；不要把 CSS 视觉框和命中框拆成两套尺寸。
- `focusConfig.focus` 只是历史 fallback，不是主判定框来源。
- 失焦 / 正常不改变 rarity。
- `main.js` 负责把归一化坐标转成像素显示。
- badge 的 scale / rotate 只改变视觉，不参与合焦框命中、focusScore 或 badgeRelX / badgeRelY 中心采样。

## 7. 所见即所得与卡牌

相关文件：

- `src/cardDraw.js`
- `data/cards.js`

`src/cardDraw.js`：

- `drawCard(speciesId, behaviorState)`。
- `NORMAL` 只抽 `NORMAL` 卡池。
- `INTERESTING` 只抽 `INTERESTING` 卡池。
- `REMARKABLE` 只抽 `REMARKABLE` 卡池。
- 同 rarity 内随机抽具体卡。
- fallback 只用于防止空卡池崩溃。

`data/cards.js`：

- 卡牌数据。
- `title` / `description` 不应泄露正式鸟名。
- `rarity` 必须和所见即所得状态对应。

两条轴：

- badge 状态 → 卡牌稀有度。
- badge 位置 → 正常 / 失焦。
- `snapshot.focusGrade` 只用于展示照片质量；当前在动画拍立得和图鉴详情静态拍立得中映射为 badge 四档模糊和“数毛”皇冠，不参与抽卡、判定或存档迁移。
- `snapshot.distance` / `snapshot.finalScale` / `snapshot.badgeRotation` / `snapshot.splitStop` 只用于照片丰富度回放；旧 snapshot 缺字段时 UI 需要 fallback。
- 鸟种色卡来自 `data/species.js` 的 `colorPalette`，只作用于拍照后的定格拍立得和图鉴详情拍立得；FOCUS moving badge 不使用鸟种色。

## 8. 图鉴与加新

相关文件：

- `src/fieldGuide.js`
- `src/storage.js`
- `data/species.js`

`src/fieldGuide.js`：

- 维护 `UNKNOWN / HEARD / SEEN / CATALOGUED`。
- `markSeen()` 会维护 `discoveryOrder`。
- `markCatalogued()` 代表完成“为它加新”。
- `collectedCards` 当前标准 entry 是 `{ cardId, snapshots, isIdentified }`。
- `addCard()` 对同一 cardId push 新 snapshot，并按 focusScore / focusAffix / realTimestamp 排序；不再覆盖旧照片。
- `getCollectedCardSnapshots()` 返回浅拷贝数组，`getBestCollectedCardSnapshot()` 返回排序后的首张照片。

`src/storage.js`：

- 当前仍沿用 `birdwatch_text_sim_field_guide_v3` key。
- normalize / load 会兼容旧 `{ cardId, snapshot }`，迁移为 `{ cardId, snapshots: [snapshot] }`。
- 坏 snapshot 会被过滤；snapshot 为 null 会归一化为 `snapshots: []`。
- 保存时输出当前 `snapshots` 结构，不新增 schemaVersion。

`src/main.js` 中的 FIELD_GUIDE UI：

- 从 `START` 进入图鉴时 action 区可显示“开始游戏”。
- 从 EXPLORE / PHOTO 等游戏中状态进入图鉴时 action 区只显示“返回”，并依赖 `gameState.previousMode` 回到进入前状态。
- 卡牌详情伪模态使用 `fieldGuideDetailCardId`，详情内“返回图鉴”只清空该 UI 状态，不改变图鉴存档。
- 卡牌详情通过 `fieldGuideDetailSnapshotIndex` 翻阅同一 cardId 的多张照片；拍立得、对焦精度、日期和地点都读取当前 snapshot。
- 刚点击“为它加新”后，`recentlyCataloguedSpeciesId` 只负责本次 CATALOGUED 页 reveal，不属于业务状态或存档字段。

`data/species.js`：

- `name`：正式鸟名。
- `appearance`：初见 / 图鉴观察文本。
- `firstEncounterAppearance`：FIRST_ENCOUNTER 专用外观文本，不泄露正式鸟名。
- `nickname`：未加新阶段显示，不能泄露正式鸟名。
- `colorPalette`：拍立得 / 图鉴详情定格 badge 的鸟种色卡。

维护边界：

- heard 不等于 seen。
- seen 不等于 catalogued。
- collectedCards 不等于 seen。
- 未加新不能泄露正式名。
- 结算按当前 catalogued 状态统一显示鸟名。
- 图鉴详情静态拍立得使用 `.field-guide-detail-*`，拍照后动画拍立得使用 `.focus-polaroid-*`；两套 DOM / CSS 不要混用。
- 不要恢复 `collectedCard.snapshot` 单数结构；旧单数 snapshot 只应存在于迁移兼容读取中。

## 9. 遭遇与地图

相关文件：

- `data/spots.js`
- `src/birdManager.js`
- `src/encounterSystem.js`
- `src/spotManager.js`

`data/spots.js`：

- 鸟点配置。
- `speciesWeights` 控制地点遭遇权重。
- 0 或缺失表示不在该地点出现。
- `directions` 是观察面文案，不是固定鸟种配置。

`src/birdManager.js`：

- `activeBirds` 生成和更新。
- `initializeBirds()`。
- `updateBirds()`。
- 按地点权重选择鸟种。
- bird 实例创建时抽取并固定 `distance: near | medium | far`；wait / refocus / reposition 不应重新 roll。

`src/encounterSystem.js`：

- 当前方向观察。
- 发现概率与观察结果。
- 远听结果。

`src/spotManager.js`：

- 当前鸟点查询。
- 相邻鸟点。
- 相对方向地图。

## 10. 电量 UI

相关文件：

- `data/config.js`
- `src/main.js`
- `src/gameSession.js`

说明：

- 机制仍基于 `MAX_PHOTOS / photos.length`。
- 顶部 UI 是复古电池格数。
- 顶部不显示百分比。
- 结算可以显示已用电量统计。
- 举起相机、TRANSFER、REPOSITION、LOST 不消耗电量。
- 只有成功拍照并记录照片才消耗电量。

## 11. 观察日志与结算

相关文件：

- `src/main.js`
- `src/gameSession.js`

说明：

- observation log 是历史记录，可以保留当时 nickname / 真名差异。
- settlement 是整理视角，要按当前图鉴状态统一鸟名。
- 失焦标签可以在日志 / 结算里显示。
- 结算不显示分数。

## 12. 当前 6 种鸟

- `kingfisher`：快、难、爆发。
- `sparrow`：中等、不规律。
- `red_billed_magpie`：横向扫掠、优雅。
- `mandarin_duck`：慢、稳定。
- `blackbird`：警觉、停顿。
- `night_heron`：慢、静、稳定。

## 13. 常见维护风险

1. 不要把外部 `photoSequence` 和焦内 `focusSequence` 混淆。
2. 不要恢复跨稀有度抽卡。
3. 不要让未加新鸟泄露正式名。
4. 不要让 heard / collectedCards 影响 seen。
5. 不要把 `focusConfig.focus` 当作主判定框来源。
6. 不要让 rAF 在离开 FOCUS 后残留。
7. 不要让吸附 / 视觉偏移影响判定框公平性。
8. 不要恢复“SD 卡”文案。
9. 不要在 FOCUS 阶段恢复“再等一等”按钮。
10. 不要出现“本次观察结束”。
11. 不要把事件文本 reveal 写成每次 render 强制重播；必须以 reveal key 判断语义是否变化。
12. 不要让拍立得 quick-dismiss 阻塞 `refocus`，也不要让拍立得 cleanup 触发整页 render。
13. 不要把照片质量皇冠放进 badge 内；当前皇冠表示整张照片的“数毛”级别，应定位在拍立得右上角。
14. 不要让 FOCUS moving badge 接入鸟种 `colorPalette`；它必须继续显示行为状态色。
15. 不要在 render 或图鉴回放时重新 roll `randomScale`、`badgeRotation` 或 `splitStop`；这些值应在 FOCUS runtime / 拍摄瞬间确定。
16. 不要只用 `CAMERA_FOCUS_CONFIG` 或 CSS 百分比调整视觉框；当前绿色判定依赖实际渲染 frame 尺寸与 centered normalized position 的一致性。
17. 不要恢复同 cardId 只保留最佳单张 snapshot；当前图鉴需要保留并翻阅所有 snapshots。

## 14. 后续扩展入口

新增鸟种：

- `data/species.js`
- `data/cards.js`
- `data/spots.js`
- `data/focusConfig.js`
- `src/photoSequence.js`

调整鸟出现率：

- `data/spots.js`

调整鸟外部行为：

- `src/photoSequence.js`

调整 FOCUS 手感：

- `data/focusConfig.js`

调整合焦框大小：

- `src/main.js` 的 `FOCUS_FRAME_VISUAL_SIZE`，并确认实际 DOM frame 命中换算仍与视觉尺寸一致。

调整距离 / 缩放 / 旋转参数：

- `data/config.js`

调整鸟种定格色卡：

- `data/species.js` 的 `colorPalette`

调整卡牌文本：

- `data/cards.js`

调整图鉴状态：

- `src/fieldGuide.js`

调整 PHOTO 流程：

- `src/gameSession.js`
- `src/main.js`

调整 UI 排版：

- `src/main.js`
- `styles/style.css`

## 15. QA 快速检查清单

1. 清空图鉴后遇到新鸟。
2. FIRST_ENCOUNTER 后进入 DECISION。
3. FOCUS 中 badge 状态切换。
4. 寻常 / 有趣 / 精彩分别拍照，结果一致。
5. 框内拍摄正常，框外拍摄失焦。
6. 不拍等 TRANSFER，进入 REPOSITION 或 LOST。
7. REPOSITION 寻找位置回 DECISION。
8. LOST 放下相机回 EXPLORE。
9. 电量耗尽进入结算。
10. 加新前后同一鸟结算显示统一真名。
11. RESULT 中快速点击“继续跟焦”：应立即进入下一轮 FOCUS，上一张拍立得同时滑走且不重复拍照 / 耗电。
12. 图鉴从 START 与从 EXPLORE 进入的按钮差异：START 可显示“开始游戏”，游戏中进入只显示“返回”并回到原状态。
13. 图鉴详情静态拍立得与拍照后动画拍立得都检查 `focusGrade` 四档模糊；`数毛` 皇冠应在整张拍立得右上角，对焦角点保持清晰。
14. near / medium / far 拍照：FOCUS badge 尺寸应有差异，snapshot 回放保持拍摄瞬间的 finalScale。
15. FOCUS badge 左右移动时应有平滑旋转，拍照后动画拍立得和图鉴详情应按 `badgeRotation` 定格。
16. split scheme 鸟种的拍立得 badge 应按 snapshot.splitStop 稳定回放；solid / dot-pattern 不应依赖 splitStop。
17. 同一 cardId 拍多张照片：图鉴详情应显示页码和翻页按钮，拍立得、日期、地点、对焦精度随照片切换。
18. 对焦框在 DECISION / FOCUS / RESULT / 拍立得 / 图鉴详情中应保持同一固定 4:3 基准；徽章视觉中心在框内时 UI 变绿，按快门结果一致。
