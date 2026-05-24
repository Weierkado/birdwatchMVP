# 《认鸟手信》代码地图

更新时间：2026-05-24

本文档是开发维护用代码地图，不是玩法设计案或用户文档。后续改动前先用本文件判断相关模块，再读取必要代码；如果本文档和实际代码冲突，以实际代码为准，并同步更新本文件。

## 0. 项目形态与维护约束

- 项目是原生 HTML / CSS / JavaScript 的文字观鸟游戏 demo。
- 没有 `package.json`，没有 npm、构建工具、框架、TypeScript、后端、数据库、Canvas 或 WebGL。
- 运行方式：用 VSCode Live Server 或等价静态服务打开 `index.html`。
- 跨局持久化只通过 LocalStorage 中的笔记 / field guide 数据完成。
- 当前仓库根目录没有 `AGENTS.md`；可读到的项目协作说明在 `docs/DevLog/AGENTS.md`，但该文件当前存在编码显示异常。实际工作仍按用户提供的项目说明与本代码地图执行。

## 1. 目录结构

- `index.html`
  - 页面静态骨架。
  - 引入 `styles/style.css` 和 `src/main.js`。
  - 包含 SVG 纸张滤镜、loading mask、状态栏、事件描述、行动按钮区、详情区和观察日志区。

- `styles/style.css`
  - 全部视觉样式。
  - 覆盖全局 token、状态栏、系统入口、消息面板、笔记文件夹、纸页、卡牌、FOCUS 取景框、拍立得、结算、地图、按钮、动画和响应式规则。

- `src/`
  - 游戏状态、流程、遭遇、拍照、对焦、抽卡、笔记存档、UI 渲染等模块。

- `data/`
  - 鸟种、卡牌、鸟点、全局配置、FOCUS 手感配置、妹妹回复文本。

- `assets/ui/`
  - `paper-texture.jpg` 当前用于内部纸页 / 纸片纹理。
  - `kraft-folder-texture.jpg` 存在但当前不应恢复到笔记文件夹外壳。

- `docs/DevLog/`
  - 开发日志、当前状态说明、代码地图、提示词和协作说明。

## 2. 当前核心玩法链路

主流程：

1. `START`
2. `START_SPOT_SELECT`
3. `EXPLORE`
4. `FIRST_ENCOUNTER` 或 `PHOTO`
5. `PHOTO` 子阶段
6. `SETTLEMENT`

主要循环：

- 选择鸟点。
- 探索阶段观察 / 转向 / 静听 / 远听 / 等待。
- 发现鸟后，如果是首次近距离看见该鸟种，先进入 `FIRST_ENCOUNTER`。
- 继续后进入 `PHOTO`。
- FOCUS 中拍照，按可见行为状态抽卡，并按可见位置判断对焦质量。
- 写入本局照片、笔记卡牌和 LocalStorage。
- 电量用尽或回合结束后进入结算。

## 3. 入口与 UI 编排

相关文件：`src/main.js`、`index.html`、`styles/style.css`

`src/main.js` 负责：

- 创建并持有页面级 `gameState`。
- 查询 DOM，创建运行时 `.utility-actions` 系统入口区。
- 渲染状态栏、事件描述、行动按钮、详情面板、观察日志。
- 分发按钮点击到 `gameSession.js` 的 handler。
- 渲染 `FIELD_GUIDE`、`SETTLEMENT`、`PHOTO`、`FIRST_ENCOUNTER`、`START_SPOT_SELECT`、`SPOT_SELECT`、默认探索详情。
- 管理消息 / 笔记 inline panel 的互斥打开、关闭、位置移动和一次性入场动画。
- 管理 FOCUS rAF、可见状态捕获、对焦结果捕获、拍立得 overlay 生命周期。
- 管理图鉴 / 笔记页码、卡牌详情、snapshot 翻页、发送给妹妹、自动加新 reveal。

`main.js` 关键页面级状态：

- `fieldGuideSpeciesIndex`：当前笔记鸟种页。
- `fieldGuideDetailCardId` / `fieldGuideDetailSnapshotIndex`：卡牌详情和照片翻页。
- `activeOverlay`：`messages` / `fieldGuide` inline panel。
- `messageView`：消息列表、力娅聊天、妈妈聊天。
- `inlinePanelJustOpened`：只控制打开当次入场动画，render 后清理。
- `recentlyCataloguedSpeciesId`：本次加新 reveal。
- `sisterReplyTimerId`：妹妹延迟回复到期后的 render 定时器。
- `autoCatalogueCompletionTimerId`：自动加新动画完成后的落地定时器。
- `latestVisibleFocusState`：拍摄瞬间所见行为状态，决定抽卡 rarity。
- `latestFocusResult`：拍摄瞬间对焦位置 / 质量。
- `focusBadgeRandomScale`、`latestBadgeRotation`：FOCUS runtime 视觉值，只写入 snapshot，不写入 gameState。

维护边界：

- `main.js` 可以做 UI 和动画生命周期，但核心规则应放在业务模块。
- shoot 点击必须在调用 `handlePhotoAction()` 前捕获可见 badge 状态、对焦结果、距离缩放、旋转等所见即所得数据。
- `latestVisibleFocusState` 决定抽卡 rarity；不能用外部 `photoSequence` 当前状态替代。
- `latestFocusResult` / DOM frame 换算必须和实际渲染的固定 4:3 取景框一致。
- 消息 / 笔记内页导航不应设置 `inlinePanelJustOpened`，避免每次 render 重播整体入场动画。

## 4. 游戏状态与业务状态机

相关文件：`src/gameState.js`、`src/gameSession.js`

`src/gameState.js`

- `createDefaultGameState()` 创建单局状态。
- 默认字段包括 `mode`、`currentTurn`、`maxTurns`、`currentSpotId`、`availableSpotOptions`、`facingDirection`、`directions`、`maxPhotos`、`photos`、`logs`、`activeBirds`、`currentPhotoTarget`、`currentPhotoSequence`、`currentFocusSequence`、`photoPhase`、`distantListenOptions`、`fieldGuide`、`sessionNewCards`、`sessionHeardSpeciesIds`、`unlockedCardIdsAtRunStart`、`eventText`、`eventHtml`。

`src/gameSession.js` 导出：

- `startGame()`
- `startGameAtSpot(spotId)`
- `handleExploreAction(state, action)`
- `handleDistantListenAction(state, action)`
- `handleSpotSelectAction(state, spotId)`
- `handleFirstEncounterAction(state, action)`
- `handleCatalogueAction(state, speciesId)`
- `handlePhotoAction(state, action, options = {})`
- `endGame(state)`

主模式：

- `START`
- `START_SPOT_SELECT`
- `EXPLORE`
- `DISTANT_LISTEN`
- `FIRST_ENCOUNTER`
- `PHOTO`
- `SETTLEMENT`
- `FIELD_GUIDE`
- `SPOT_SELECT`：旧鸟点选择流程，当前主流程不暴露，保留给后续地图选点。

PHOTO 子阶段：

- `DECISION`
- `FOCUS`
- `RESULT`
- `REPOSITION`
- `LOST`

PHOTO action 规则：

- `DECISION`：`raiseCamera`、`wait`、`giveUp`
- `FOCUS`：`shoot`、`timeout`
- `RESULT`：`refocus`、`wait`、`giveUp`
- `REPOSITION`：`reposition`
- `LOST`：`putDownCamera`

维护边界：

- `gameSession.js` 不访问 DOM。
- `handlePhotoAction("shoot")` 使用 UI 传入的 `capturedBehaviorState`、`capturedFocusAffix` 和 snapshot 视觉参数。
- 拍照成功才消耗电量：即向 `state.photos` 写入照片。
- `REPOSITION` 表示鸟离开当前取景位置但仍在视野；`LOST` 表示本次已经失去位置。
- `handleCatalogueAction()` 仍是加新写入入口，当前可被自动加新流程复用。

## 5. 鸟点、鸟实例与遭遇

相关文件：`data/spots.js`、`src/spotManager.js`、`src/birdManager.js`、`src/encounterSystem.js`

`data/spots.js`

- 当前鸟点：`pond_bank`、`garden_edge`、`old_tree_shadow`。
- 每个鸟点包含 `name`、`description`、`speciesWeights`、`directions`、`neighbors`。
- `speciesWeights` 控制生成权重；0 或缺失表示不出现。
- `directions` 是当前鸟点四个观察面的文案，不是鸟种固定配置。

`src/spotManager.js`

- 查询所有 / 当前 / 相邻鸟点。
- 生成相对朝向地图：`front / right / back / left`。
- `pickWeightedSpecies(speciesWeights)` 按鸟点权重返回鸟种数据。

`src/birdManager.js`

- `initializeBirds(currentSpot)` 生成初始活动鸟。
- `updateBirds(state)` 扣减 `stayTurns` 并补足活动鸟数量。
- bird 实例字段：`instanceId`、`speciesId`、`distance`、`directionIndex`、`stayTurns`、`clueStrength`。
- `distance` 在 bird 实例创建时 roll，一次遭遇内不应在 wait / refocus / reposition 中重 roll。
- `generateClues(state)` 只生成当前方向线索文本，不删除鸟实例。

`src/encounterSystem.js`

- `observeCurrentDirection(state)`：观察当前方向，按 `clueStrength` 提升发现概率。
- `listen(state)`：当前方向静听，提升当前方向第一只鸟的线索强度。
- `listenDistantSounds(state)`：只检查相邻鸟点，返回远听线索和听到的 speciesId。

## 6. 外部行为序列与焦内序列

相关文件：`src/photoSequence.js`、`src/focusSequence.js`、`data/config.js`、`data/focusConfig.js`

`src/photoSequence.js`

- 生成 PHOTO 外部行为序列，用于 `DECISION` / `RESULT` 文案和进入 FOCUS 的起始状态。
- 状态：`NORMAL`、`INTERESTING`、`REMARKABLE`、`FLY_AWAY`。
- `PRECIOUS` 当前不在实际外部行为序列实现中。
- `advancePhotoSequence()` 根据决策次数和飞走概率推进。
- `recordShutterDecision()` 在拍照后推进外部序列。

`src/focusSequence.js`

- 生成 FOCUS 内部可见状态时间轴。
- 可见状态：`NORMAL`、`INTERESTING`、`REMARKABLE`。
- 首段等于进入 FOCUS 时的外部行为状态。
- 中间段按 FOCUS sequence 配置生成。
- 末尾补 `NORMAL` 并追加 `TRANSFER`。
- `TRANSFER` 只用于触发离场 / 转移，不应显示为 badge。

维护边界：

- 外部行为状态决定进入 FOCUS 的起点和拍照窗口文案。
- FOCUS 内部 visible state 决定按快门瞬间抽卡 rarity。
- 不要把 `photoSequence` 当前状态和 `focusSequence` 当前 visible state 混用。

## 7. 对焦、位置、缩放与拍照质量

相关文件：`src/focusEngine.js`、`data/focusConfig.js`、`data/config.js`、`src/main.js`

`src/focusEngine.js`

- 纯计算模块，不访问 DOM / LocalStorage，不管理 rAF。
- 使用归一化位置，中心为 `{ x: 0, y: 0 }`。
- 支持 `still`、`wander`、`jitter`、`sweep`、`drift_to_center`、`bounce_hop` 等配置形态。
- `evaluateFocus()` 返回 `position`、`distance`、`affix`、`affixDisplay`、`isGreen`。
- `computeBadgeRotation()` 根据显示轨迹平滑旋转。
- 主合焦判定使用 `CAMERA_FOCUS_CONFIG.boxHalfWidth / boxHalfHeight` 的矩形框。

`data/focusConfig.js`

- 每个鸟种、每个行为状态的 FOCUS 手感配置。
- 包含运动 layers、enter、stutter、hop、sequence 参数。

`data/config.js`

- `CAMERA_FOCUS_CONFIG`：全局对焦框和 perfect 阈值。
- `BIRD_DISTANCE_DEFAULT_WEIGHTS`、`BIRD_DISTANCE_SCALE`、`BADGE_RANDOM_SCALE`、`BADGE_ROTATION`：拍照视觉丰富度参数。
- `PHOTO_SEQUENCE_CONFIG`、`PHOTO_SEQUENCE_CONFIG_BY_SPECIES`：外部行为序列参数。

维护边界：

- 视觉取景框由 `main.js` 的 `FOCUS_FRAME_VISUAL_SIZE` 渲染，并按实际 DOM frame 换算为命中框。
- 不要只改 CSS 或只改配置；视觉变绿和按快门结果必须共用同一实际 frame 换算。
- scale / rotate 只影响视觉，不参与合焦判定、focusScore 或抽卡。
- `focusConfig.focus` 只作为历史 fallback，不是当前主判定框来源。

## 8. 抽卡与稀有度展示

相关文件：`src/cardDraw.js`、`src/rarityDisplay.js`、`data/cards.js`

`src/cardDraw.js`

- `drawCard(speciesId, behaviorState)` 执行所见即所得抽卡。
- `NORMAL` 只优先抽 `NORMAL` 卡池。
- `INTERESTING` 只优先抽 `INTERESTING` 卡池。
- `REMARKABLE` 只优先抽 `REMARKABLE` 卡池。
- 如果目标池为空，fallback 到该鸟种任意卡，再 fallback 到全局任意卡，避免崩溃。
- 当前实现不使用跨稀有度权重混池。

`src/rarityDisplay.js`

- `getRarityDisplay(raritySource)`
- `createRarityBadgeHtml(raritySource)`
- 支持 card 对象、rarity 字符串、stars 数字。
- `PRECIOUS` 仅保留展示支持，当前卡牌数据无普通流程投放。

`data/cards.js`

- 当前 6 种鸟，每种 6 张卡：3 张 `NORMAL`、2 张 `INTERESTING`、1 张 `REMARKABLE`。
- 卡牌 `title` / `description` 不应泄露正式鸟名。

## 9. 笔记 / Field Guide 数据

相关文件：`src/fieldGuide.js`、`src/storage.js`

`src/storage.js`

- 当前 LocalStorage key：`birdwatch_text_sim_field_guide_v3`。
- 仍兼容读取旧 `birdwatch_text_sim_field_guide_v2` 并迁移到 v3。
- `createDefaultFieldGuide()` 当前结构：
  - `heardSpeciesIds`
  - `seenSpeciesIds`
  - `cataloguedSpeciesIds`
  - `collectedCards`
  - `discoveryOrder`
  - `speciesRecords`
  - `seenCounts`
  - `photoCountBySpecies`
  - `captureCountByCardId`
- normalize 会去重字符串数组、合并重复 cardId、过滤坏 snapshot、排序 snapshots、补齐新增字段。

`collectedCards` 当前 entry 标准结构：

- `cardId`
- `snapshots`
- `isIdentified`
- `hasNewContent`
- `hasNewCard`
- `sentToSister`
- `sentToSisterAt`
- `sisterReplyDueAt`
- `sisterReplyReadAt`
- `sisterKnowledgeUnlocked`
- `pendingAutoCatalogue`
- `autoCatalogueReadyAt`
- `autoCataloguedAt`
- `sisterKnowledge`

`speciesRecords` 当前 entry 标准结构：

- `speciesId`
- `encounterCount`
- `cataloguedAtTimeLabel`
- `cataloguedRealTimestamp`

`src/fieldGuide.js`

- 维护 `UNKNOWN / HEARD / SEEN / CATALOGUED` 知识状态。
- `markHeard()` 只记录听到。
- `markSeen()` 记录近距离看见，并维护 `discoveryOrder`。
- `markCatalogued()` 完成加新，写入 `cataloguedAtTimeLabel` 和现实时间 `cataloguedRealTimestamp`。
- `addCard()` 增加或更新 collected card，追加 snapshot，按 focusScore / focusAffix / realTimestamp 排序。
- `markCollectedCardViewed()` 清除 `hasNewContent` 和 `hasNewCard`。
- `sendCollectedCardToSister()` 写入发送状态、30 秒回复到期时间和妹妹知识文本。
- `hasUnreadSisterReplies()` 根据已发送、回复到期、未读 / 未解锁派生红点。
- `markDueSisterRepliesRead()` 只在进入力娅聊天且回复到期后写入已读 / 解锁，并设置 `pendingAutoCatalogue`。
- `getPendingAutoCatalogueCardId()` 和 `markAutoCatalogueCompleted()` 支撑自动加新 reveal 后落地。

维护边界：

- heard 不等于 seen。
- seen 不等于 catalogued。
- collectedCards 不反推 seen。
- 未加新不能泄露正式鸟名。
- 不要恢复 `collectedCard.snapshot` 单数结构；旧单数 snapshot 只允许存在于读取迁移兼容里。
- 不要改 LocalStorage key，除非任务明确要求。

## 10. 笔记 UI 与自动加新

相关文件：`src/main.js`、`styles/style.css`、`src/fieldGuide.js`、`data/sisterKnowledge.js`

笔记入口：

- 运行时创建的 `.utility-actions` 位于事件描述栏下方、主行动按钮上方。
- 顶部状态网格中的原入口位置当前是静态信息块：天气 / 周围事件。
- 消息和笔记 inline panel 互斥。
- 每次从外部入口打开笔记，会回到笔记首页；内部翻页和卡牌详情不算外部入口。

笔记首页 / 鸟种页：

- 按 `speciesList` 分页。
- `UNKNOWN` / `HEARD` / `SEEN` / `CATALOGUED` 决定标题、正式名、外观和卡牌可见度。
- `SEEN` 也显示已拍卡牌，便于发送给妹妹；但主标题仍不泄露正式名。
- `CATALOGUED` 显示正式名和加新信息。
- `renderFieldGuide()` 在进入对应鸟种页时检查 pending 自动加新，只处理当前鸟种相关卡牌，不在首页批量处理。

卡牌详情页：

- 根容器当前使用 `note-book-page note-card-detail-panel`，复用鸟种页大纸页。
- 结构顺序：返回按钮、卡片描述、统计行、妹妹补充、照片 + 右侧拍摄信息、snapshot 翻页、发送 / 已发送状态。
- snapshot 翻页读取同一 cardId 的 `snapshots`，不重新 roll 任何视觉参数。
- 当前 `ENABLE_CARD_IDENTIFY_UI = false`，识别按钮和身份色暂停显示；相关 helper 保留。

自动加新流程：

1. 卡牌详情点击发送给妹妹。
2. `sendCollectedCardToSister()` 写入发送时间和 30 秒回复到期。
3. 回复到期后，消息入口和力娅线程显示未读红点。
4. 进入力娅聊天后，`markDueSisterRepliesRead()` 解锁妹妹知识，并设置 `pendingAutoCatalogue`。
5. 玩家进入对应鸟种页时，`renderFieldGuide()` 复用 `handleCatalogueAction()` 触发加新 reveal。
6. 动画完成后，`scheduleAutoCatalogueCompletion()` 调用 `markAutoCatalogueCompleted()` 清除 pending 并写入完成时间。

维护边界：

- 不要在消息已读瞬间自动跳转笔记。
- 不要在笔记首页批量处理所有 pending。
- 不要让同一已 catalogued 或已 `autoCataloguedAt` 的卡重复播放加新动画。

## 11. 消息系统与妹妹知识

相关文件：`src/main.js`、`src/fieldGuide.js`、`data/sisterKnowledge.js`、`styles/style.css`

`data/sisterKnowledge.js`

- `SISTER_KNOWLEDGE_BY_CARD`：按 cardId 配置专属回复。
- `SISTER_KNOWLEDGE_FALLBACK`：按 `NORMAL / INTERESTING / REMARKABLE / PRECIOUS` fallback。
- 发送时读取并写入 `collectedCard.sisterKnowledge`；render 阶段只读存档，不随机生成。

消息 UI：

- 消息列表包含力娅和妈妈线程。
- 力娅聊天由 `collectedCards` 派生，不持久化单独消息数组。
- 玩家消息包括拍立得图片消息和紧随其后的文本消息，两者共用 `sentToSisterAt`。
- 妹妹回复只在 `Date.now() >= sisterReplyDueAt` 后可见。
- 打开消息列表本身不会清红点；进入力娅聊天且有到期回复才清红点并解锁知识。
- 聊天拍立得调用 `renderFieldGuideDetailPolaroid(..., { variant: "chat" })`，只在 chat variant 中 clamp badge scale。

维护边界：

- 不要把妹妹补充恢复为“发送后立即可见”。
- 卡牌详情的“妹妹的补充”只在 `sisterKnowledgeUnlocked === true` 且有知识文本时显示。
- 聊天拍立得样式应限定在 message/chat class 下，避免污染笔记详情和拍照回放。

## 12. 数据文件

`data/species.js`

- 当前鸟种：`kingfisher`、`sparrow`、`red_billed_magpie`、`mandarin_duck`、`blackbird`、`night_heron`。
- 字段包含正式名、nickname、线索、外观、初见外观、颜色、距离分布等。
- `nickname` 和 `firstEncounterAppearance` 不应泄露正式鸟名。
- `colorPalette` 当前作为未来身份色恢复入口保留；FOCUS moving badge 和当前拍立得仍使用行为状态色。

`data/cards.js`

- 卡牌数据。
- rarity 必须和所见即所得状态对应。
- 文案不应泄露正式鸟名。

`data/spots.js`

- 鸟点、权重、观察面、邻居。

`data/config.js`

- 回合、电量、初始活动鸟、方向名。
- 鸟停留回合、距离权重、距离缩放、badge 随机缩放、旋转参数。
- 远听参数、全局合焦框、外部行为序列参数、日志长度。

`data/focusConfig.js`

- 各鸟种 FOCUS 手感。

`data/sisterKnowledge.js`

- 妹妹回复文本配置。

## 13. 样式结构

相关文件：`styles/style.css`

主要样式区域：

- `:root`：全局纸张、墨色、状态色、按钮、消息、笔记 token。
- `.status-grid` / `.status-item`：顶部状态布局。
- `.utility-actions`：运行时系统入口区。
- `.message-panel`：消息列表和聊天。
- `.action-panel` / `.action-row` / button variants：行动按钮。
- `.focus-playfield` / `.focus-frame` / `.focus-moving-badge`：FOCUS 取景。
- `.focus-polaroid-*`：拍照后 overlay 拍立得。
- `.note-book-folder` / `.note-book-page`：笔记文件夹和内部纸页。
- `.field-guide-*`：鸟种页、卡牌列表、卡牌详情、snapshot 翻页。
- `.sister-knowledge-*`：妹妹补充纸片。
- `.settlement-*`：结算折叠 / 展开与 reveal。
- `.text-map` / `.map-*`：相对朝向地图。
- `.rarity-*`、`.state-*`、`.focus-affix-badge`、`.new-badge`：badge。
- `@media`：移动端消息、照片详情、笔记文件夹、地图适配。
- `@media (prefers-reduced-motion: reduce)`：动画降级。

维护边界：

- `.message-panel.is-inline-panel-entering` 和 `.note-book-folder.is-inline-panel-entering` 才播放整体入场动画，不要挂回常驻 panel class。
- `note-book-folder` 当前是纯色极淡苔痕绿方向，不使用外壳纹理和粗糙边。
- `note-book-page` 保留纸纹与 `paper-edge` 粗糙边。
- `button-major` 是主推进按钮；`button-secondary` 是普通操作按钮；消息 / 笔记入口有独立 token。

## 14. 结算与日志

相关文件：`src/main.js`、`src/gameSession.js`

结算：

- `SETTLEMENT` 初始显示折叠面板。
- 点击或键盘激活后展开完整统计和照片列表。
- 统计包括拍照数量、电量使用、记录鸟种、听到鸟种、新增笔记。
- NEW 判断来自本局开始时的 `unlockedCardIdsAtRunStart` 和本局照片中的新 cardId，只影响结算 UI。
- 结算按当前 catalogued 状态统一显示鸟名。

日志：

- `LOG_LIMIT` 控制保留数量。
- 日志是历史记录，可保留当时 nickname / 真名差异。
- 失焦标签可以出现在日志 / 结算里。

## 15. 常见维护风险

1. 不要把外部 `photoSequence` 和焦内 `focusSequence` 混淆。
2. 不要恢复跨稀有度混池抽卡。
3. 不要让未加新鸟泄露正式名。
4. 不要让 heard / collectedCards 影响 seen。
5. 不要把 `focusConfig.focus` 当作主判定框来源。
6. 不要让 rAF 在离开 FOCUS 后残留。
7. 不要让 scale / rotate / 视觉偏移影响合焦判定。
8. 不要恢复旧“SD 卡”作为当前 UI 主文案；当前顶部使用电量 UI。
9. 不要在 FOCUS 阶段恢复“再等一等”按钮。
10. 不要把事件文本 reveal 写成每次 render 强制重播。
11. 不要让拍立得 quick-dismiss 阻塞 `refocus`。
12. 不要让拍立得 cleanup 触发整页 render。
13. 不要把照片质量皇冠放进 badge 内；皇冠表示整张照片的“数毛”级别。
14. 不要让 FOCUS moving badge 接入鸟种 `colorPalette`。
15. 不要在 render 或回放时重新 roll `randomScale`、`badgeRotation`、`splitStop`。
16. 不要恢复同 cardId 只保留最佳单张 snapshot。
17. 不要把消息已读改成打开消息列表即清除。
18. 不要把自动加新改成消息已读瞬间完成或首页批量完成。

## 16. 扩展入口

新增鸟种：

- `data/species.js`
- `data/cards.js`
- `data/spots.js`
- `data/focusConfig.js`
- 必要时调整 `data/config.js` 的行为序列参数。

调整鸟出现率：

- `data/spots.js`

调整鸟外部行为：

- `data/config.js`
- `src/photoSequence.js`

调整 FOCUS 手感：

- `data/focusConfig.js`

调整合焦框：

- `data/config.js` 的 `CAMERA_FOCUS_CONFIG`
- `src/main.js` 的 `FOCUS_FRAME_VISUAL_SIZE`
- `styles/style.css` 中视觉框样式

调整距离 / 缩放 / 旋转：

- `data/config.js`

调整笔记 / 自动加新数据：

- `src/fieldGuide.js`
- `src/storage.js`
- `src/main.js`

调整消息和妹妹回复：

- `data/sisterKnowledge.js`
- `src/main.js`
- `src/fieldGuide.js`

调整 UI 排版：

- 优先 `styles/style.css`
- 需要结构 class 时再读 / 改 `src/main.js`

## 17. QA 快速检查清单

1. Live Server 打开 `index.html` 无白屏。
2. 选择初始鸟点后进入 `EXPLORE`。
3. 转向、观察、静听、等待、远听可用。
4. FIRST_ENCOUNTER 不泄露正式名，继续后进入 PHOTO。
5. PHOTO `DECISION` 能举起相机、等待、放弃。
6. FOCUS 中 moving badge 出现，状态会切换。
7. 框内拍摄显示合焦，框外拍摄显示失焦。
8. 拍照 rarity 等于按下快门瞬间可见状态。
9. RESULT 中继续跟焦不重复耗电，旧拍立得可滑走。
10. timeout 后进入 REPOSITION 或 LOST。
11. REPOSITION 能寻找位置回到 DECISION。
12. LOST 能放下相机回到 EXPLORE。
13. 电量用尽进入 SETTLEMENT。
14. 结算折叠态可展开，NEW 只按本局新卡显示。
15. 笔记入口和消息入口在 `.utility-actions`，互斥打开。
16. 打开消息列表不清力娅红点；进入力娅聊天才清到期回复红点。
17. 发送卡牌给妹妹后 30 秒回复到期。
18. 妹妹补充只在查看到期回复后显示。
19. 查看力娅回复后，进入对应鸟种页触发自动加新 reveal。
20. 自动加新完成后刷新不重复播放。
21. 同 cardId 多张照片可在详情翻页，视觉参数稳定回放。
22. 移动端消息、笔记详情、照片 + 信息区无横向溢出。

## 18. 力娅消息系统 / 信息系统外置文本

本节记录 Block 1～9 后的信息系统现状，供后续继续开发主动消息、消息队列或剧情条件前定位职责。当前仍是静态页面原生 ES module 结构，没有新增构建工具。

### 新旧文本来源分工

`data/liyaMessages.json`

- 新的力娅聊天回复文本池，当前主要用于玩家把照片发给妹妹后，力娅在聊天线程中的回复文本。
- 数据使用事件卡结构：`id / speaker / type / stage / trigger / conditions / delay / priority / cooldown / allowRepeat / lines / tags`。
- 当前主要事件是 `trigger.event = "photo_sent"`，由 `selectLiyaMessages("photo_sent", photoContext, options)` 选择。
- 当前文本池约 39 条，覆盖首次新鸟、重复同种鸟、模糊、清晰、构图、清晨、黄昏、小老师、撒娇和轻量关系推进等回复。
- `delay / cooldown` 当前只是数据字段，正式运行时仍沿用既有 30 秒回复逻辑，不消费这些字段。

`data/sisterKnowledge.js`

- 旧的妹妹补充文本来源，当前仍用于手册卡牌详情页中的“妹妹的补充”。
- 发送给妹妹时旧 `sisterKnowledge` 仍会写入 collectedCard entry，卡牌详情渲染仍读取该字段。
- 显示条件仍受 `sisterKnowledgeUnlocked === true` 控制：玩家必须进入力娅聊天查看到期回复后才会解锁。
- 不要误删，不要误认为它已经完全废弃。
- 不要把聊天回复来源和手册妹妹补充来源混为一谈。

### 正式接入点

`src/main.js`

- 启动末尾预加载 `loadLiyaMessages()`；加载失败时由消息系统 fallback，不阻塞游戏启动。
- `createLiyaPhotoContext(card, snapshot, entry)` 构造轻量照片上下文，包括 `speciesId / cardId / cardTitle / timeOfDay / quality / composition / locationId / firstTimeSpecies / repeatSpecies / storyStage`，以及用于稳定选择的 `sentToSisterAt / realTimestamp / cardIndex` 等已有字段。
- `getLiyaPhotoReplyText(card, snapshot, entry, fallbackLines)` 调用 `selectLiyaMessages("photo_sent", photoContext, { stage, maxResults: 1, sentMessageIds: [] })`，并把 message `lines` 拼成现有聊天文本格式。
- `getSentSisterPhotoMessages()` 派生力娅聊天线程时，妹妹回复文本优先来自新系统；如果新系统异常或没有可用 lines，仍回落到旧知识文本 fallback。
- `sendCollectedCardToSister()`、30 秒延迟、红点、已读解锁、自动加新和聊天 UI 流程未被新系统替换。

### 消息选择模块

`src/liyaMessageSystem.js`

- 负责加载 `data/liyaMessages.json`，提供内部 fallback 数据。
- 提供 `loadLiyaMessages()`、`getLiyaMessageState()`、`getLiyaMessageById()`、`selectLiyaMessages()`、`validateLiyaMessageData()`、`normalizeLiyaMessage()`。
- 校验顶层结构、id 唯一性和非空 lines；标准化字段，避免 undefined / null 进入 UI。
- conditions 当前只支持 `firstTimeSpecies / repeatSpecies / speciesId / timeOfDay / quality / composition`；未知 condition 视为不匹配，避免误触发剧情。
- 选择规则：先匹配 event、stage、conditions、allowRepeat，再按 priority、condition specificity 分层；同 priority + 同 specificity 的候选使用稳定 seed hash 做伪随机选择。
- 稳定选择不使用 `Math.random()`，不使用 `Date.now()`，不新增存档字段；同一照片 / 同一 context 刷新后选择结果应保持稳定。
- 本模块不操作 DOM，不读写 LocalStorage，不修改 game state，不管理消息队列。

### 开发工具

`src/liyaMessageDevTools.js`

- 只用于开发态消息命中自检，不接入正式游戏流程。
- 提供模拟 `photoContext`、命中预览、unknown condition 检查、`uncoveredByDevContexts` 分析和纯文本报告格式化。
- `selectLiyaMessagesFromList(messages, eventName, context, options)` 用于编辑器草稿数据，规则应与正式 `selectLiyaMessages()` 保持一致。
- 不操作 DOM，不读写 LocalStorage，不修改游戏 state。

`message-editor.html`

- 开发用力娅消息编辑器，不是正式游戏入口。
- 支持加载 / 导入 `liyaMessages.json`、内存草稿编辑、实时校验、dev check、搜索筛选、复制 JSON、导出 `liyaMessages.json` 文件。
- 编辑只发生在浏览器内存中；导出只是浏览器下载文件，不会自动写回项目里的 `data/liyaMessages.json`。
- 不要把该页面挂到 `index.html` 或正式游戏入口。
- 不要让编辑器写 LocalStorage / sessionStorage / indexedDB。

### 当前未实现和不要误改的边界

- 当前没有主动消息队列。
- 当前没有 pendingMessages 运行时。
- 当前没有“不回复追问”。
- 当前没有随机延迟。
- 当前没有上课 / 补习状态机。
- 当前没有 storyStage 推进。
- 当前没有把手册“妹妹的补充”切到 `data/liyaMessages.json`。
- 不要删除 `data/sisterKnowledge.js`。
- 不要把聊天回复和手册妹妹补充合并为同一个来源，除非后续任务明确设计迁移方案。
