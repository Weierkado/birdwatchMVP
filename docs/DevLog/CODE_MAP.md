# 《认鸟手信》代码地图

更新时间：2026-06-11

本文档是代码结构地图，不是 DevLog、需求文档或玩法设计案。它回答当前有哪些重要文件和模块、各自负责什么、不负责什么、核心流程如何流转、哪些边界不能误改，以及新增功能应从哪里下手。

如果本文档与实际代码冲突，以实际代码为准，并同步更新本文档。历史开发流水记录见 `DEVLOG.md`；当前状态边界见 `DEVLOG_CURRENT_STATUS.md`。

## 0. 项目形态与维护约束

- 项目是原生 HTML / CSS / JavaScript 的文字观鸟网页游戏 demo。
- 前端主运行时没有根级 `package.json`、npm 构建工具、框架、TypeScript、Canvas 或 WebGL。
- 仓库包含 `cloudfunctions/analytics_ingest/package.json`，该 package 只属于 CloudBase analytics ingest 云函数，不属于前端静态运行时。
- 主游戏运行方式是通过静态服务器打开 `index.html`，例如 VSCode Live Server 或等价本地静态服务。
- 跨局持久化主要通过 LocalStorage 中的 field guide / 笔记数据和少量辅助 key 完成。
- 修改前优先根据本代码地图定位相关模块，再读取必要代码；不要每次全项目静态审计。
- 不要新增 `console.log`、`debugger`、`alert`；不要修改 LocalStorage key，除非任务明确要求并完成迁移设计。

## 1. 目录结构

- `index.html`
  - 主游戏静态页面骨架。
  - 引入 `styles/style.css` 和 `src/main.js`。
  - 包含主游戏容器、loading、状态栏、独立事件提示条 `#eventHint`、事件描述、行动按钮、详情区、观察日志等静态节点。

- `styles/style.css`
  - 主游戏全局样式。
  - 覆盖 token、状态栏、系统入口、消息面板、笔记文件夹、纸页、卡牌、FOCUS 取景框、拍立得、结算、地图、事件提示、按钮、动画和响应式规则。
  - 离线编辑器样式当前内联在 `message-editor.html`，不写入主样式。

- `src/`
  - 主游戏运行时模块：状态、流程、遭遇、事件提示、拍照、对焦、抽卡、笔记存档、UI 编排、analytics 包装等。

- `src/ui/`
  - 主游戏 UI 片段模块。
  - `messagePanel.js` 负责消息面板展示和聊天动画 UI。
  - `fieldGuidePanel.js` 负责笔记 / 图鉴页面 HTML 片段。

- `src/utils/`
  - 轻量通用 helper。
  - 当前包含 DOM / 字符串安全 helper、展示格式化 helper、playtest config 读取 helper。

- `src/core/`
  - 当前是轻量 facade / helper 层。
  - `saveManager.js` 只收口少量 LocalStorage 读写。
  - `telemetryAdapter.js` 只包装 analytics 调用，不是完整 analytics 模块迁移。

- `data/`
  - 鸟种、卡牌、鸟点、全局配置、FOCUS 配置、初始消息、妹妹知识、Liya 消息池等内容数据。

- `assets/ui/`
  - UI 纹理资源。
  - `paper-texture.jpg` 用于内部纸页 / 纸片纹理。
  - `kraft-folder-texture.jpg` 存在，但不要误恢复为笔记文件夹外壳纹理，除非后续视觉任务明确要求。

- `cloudfunctions/analytics_ingest/`
  - CloudBase analytics ingest 云函数。
  - 写入集合 `analytics_payloads2`，并保留完整前端 payload。

- `docs/DevLog/`
  - 开发日志、当前状态、代码地图、提示词和协作说明。

- `docs/dev/`
  - 工程审计、架构、工作流、清扫记录、回归清单等开发辅助文档。

- `docs/design/`
  - 设计与规划文档。
  - `DATA_SCHEMA_PLAN.md` 和 `EDITOR_WORKBENCH_PLAN.md` 是规划，不代表运行时已经实现这些 schema 或完整 CMS。

- `message-editor.html`
  - 离线 Liya 消息编辑器工具。
  - 不是主游戏入口，不挂到 `index.html`，不写入 `data/liyaMessages.json`。

## 2. 当前核心玩法链路

主流程：

1. `START`
2. `START_SPOT_SELECT`
3. `EXPLORE`
4. `FIRST_ENCOUNTER` 或 `PHOTO`
5. `PHOTO` 子阶段
6. `SETTLEMENT`

保留模式：

- `DISTANT_LISTEN`：远听 / 倾听相关流程。
- `FIELD_GUIDE`：笔记 / 图鉴查看。
- `SPOT_SELECT`：保留给地图选点的旧流程或扩展入口，当前主流入口以实际代码为准。

PHOTO 子阶段：

- `DECISION`
- `FOCUS`
- `RESULT`
- `REPOSITION`
- `LOST`

主循环：

- 选择鸟点。
- 在探索阶段观察、转向、静听、远听或等待。
- 转向后或远听落地后，可能补充一次独立事件提示扫描；该提示只反映左右侧是否有鸟类活动，不改变主事件文本链路。
- 发现鸟后，若是首次近距离看见该鸟种，先进入 `FIRST_ENCOUNTER`。
- 继续后进入 `PHOTO`。
- FOCUS 中拍照，按可见行为状态抽卡，并按可见位置判断对焦质量。
- 写入本局照片、笔记卡牌和 LocalStorage。
- 电量用尽或回合结束后进入结算。

## 3. 入口与 UI 编排

相关文件：`src/main.js`、`index.html`、`styles/style.css`

`src/main.js` 当前仍是页面级编排中心，负责：

- 创建并持有页面级 `gameState`。
- 查询 DOM，创建运行时 `.utility-actions` 和底部 `.reset-actions` 等系统入口。
- 渲染状态栏、事件描述、行动按钮、详情面板、观察日志。
- 渲染并维护独立 `#eventHint` 事件提示条。
- 分发按钮点击到 `gameSession.js` 的 handler。
- 编排 `FIELD_GUIDE`、`SETTLEMENT`、`PHOTO`、`FIRST_ENCOUNTER`、`START_SPOT_SELECT`、`SPOT_SELECT` 和默认探索详情。
- 管理消息 / 笔记 inline panel 的互斥打开、关闭、位置移动和入场动画。
- 管理 FOCUS rAF、可见状态捕获、对焦结果捕获、拍立得 overlay 生命周期。
- 管理图鉴 / 笔记页码、卡牌详情、snapshot 翻页、发送给妹妹、自动加新 reveal。
- 初始化 `src/eventSystem.js`，向 `gameSession.js` 注入事件提示扫描能力，并在开新局 / 下一天 / 重置时清理提示状态。
- 通过 `src/core/telemetryAdapter.js` 调用大部分 analytics 底层函数。

`src/main.js` 已经不再直接持有部分 DOM escape、展示格式化、playtest config helper，但仍保留：

- PHOTO / FOCUS / RESULT UI 协调。
- FOCUS rAF。
- 消息队列时序。
- 自动加新 reveal。
- 图鉴详情交互。
- 结算 / survey UI。
- analytics runtime counters。
- tester identity / profile 相关调用仍需按实际代码区分是否直接来自 `src/analytics.js`。

关键页面级状态：

- `fieldGuideSpeciesIndex`：当前笔记鸟种页。
- `fieldGuideDetailCardId` / `fieldGuideDetailSnapshotIndex`：卡牌详情和照片翻页。
- `activeOverlay`：`messages` / `fieldGuide` inline panel。
- `messageView`：消息列表、Liya 聊天、妈妈聊天等视图。
- `inlinePanelJustOpened`：只控制打开当次入场动画，render 后清理。
- `recentlyCataloguedSpeciesId`：本次加新 reveal。
- `sisterReplyTimerId`：Liya 延迟回复到期后的 render 定时器。
- `autoCatalogueCompletionTimerId`：自动加新动画完成后的落地定时器。
- `latestVisibleFocusState`：拍摄瞬间所见行为状态，决定抽卡 rarity。
- `latestFocusResult`：拍摄瞬间对焦位置 / 质量。
- `focusBadgeRandomScale` / `latestBadgeRotation`：FOCUS runtime 视觉值，只写入 snapshot，不写入 gameState。

维护边界：

- `main.js` 可以做 UI 和动画生命周期，但核心规则应放在业务模块。
- shoot 点击必须在调用 `handlePhotoAction()` 前捕获可见 badge 状态、对焦结果、距离缩放、旋转等所见即所得数据。
- `latestVisibleFocusState` 决定抽卡 rarity，不能用外部 `photoSequence` 当前状态替代。
- `latestFocusResult` / DOM frame 换算必须和实际渲染的固定 4:3 取景框一致。
- 消息 / 笔记内页导航不应设置 `inlinePanelJustOpened`，避免每次 render 重播整体入场动画。

## 4. 游戏状态与业务状态机

相关文件：`src/gameState.js`、`src/gameSession.js`

`src/gameState.js`

- `createDefaultGameState()` 创建单局状态。
- 默认字段包括 `mode`、`currentTurn`、`maxTurns`、`currentSpotId`、`availableSpotOptions`、`facingDirection`、`directions`、`maxPhotos`、`photos`、`logs`、`activeBirds`、`currentPhotoTarget`、`currentPhotoSequence`、`currentFocusSequence`、`photoPhase`、`distantListenOptions`、`fieldGuide`、`sessionNewCards`、`sessionHeardSpeciesIds`、`unlockedCardIdsAtRunStart`、`eventText`、`eventHtml` 等。

`src/gameSession.js` 导出：

- `startGame()`
- `startGameAtSpot(spotId)`
- `handleExploreAction(state, action)`
- `handleDistantListenAction(state, action)`
- `handleSpotSelectAction(state, spotId)`
- `handleFirstEncounterAction(state, action)`
- `handleCatalogueAction(state, speciesId)`
- `handlePhotoAction(state, action, options = {})`
- `setEventSystem(system)`
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
- `SPOT_SELECT`

PHOTO action 规则：

- `DECISION`：`raiseCamera`、`wait`、`giveUp`
- `FOCUS`：`shoot`、`timeout`
- `RESULT`：`refocus`、`wait`、`giveUp`
- `REPOSITION`：`reposition`
- `LOST`：`putDownCamera`

维护边界：

- `gameSession.js` 不访问 DOM。
- 侧向事件提示扫描通过注入的 `eventSystem` 触发，只在 `EXPLORE` 阶段转向后与远听落地后按概率补充执行；不要在 `PHOTO`、`FOCUS`、`RESULT`、`SETTLEMENT` 或 overlay 流程里复用它。
- `handlePhotoAction("shoot")` 使用 UI 传入的 `capturedBehaviorState`、`capturedFocusAffix` 和 snapshot 视觉参数。
- 拍照成功才消耗电量，即向 `state.photos` 写入照片。
- `REPOSITION` 表示鸟离开当前取景位置但仍在视野；`LOST` 表示本次已经失去位置。
- `handleCatalogueAction()` 仍是加新写入口，可被自动加新流程复用。

## 5. 鸟点、鸟实例与遭遇

相关文件：`data/spots.js`、`src/spotManager.js`、`src/birdManager.js`、`src/encounterSystem.js`

`data/spots.js`

- 当前鸟点数据包含 `name`、`description`、`speciesWeights`、`directions`、`neighbors` 等。
- `speciesWeights` 控制生成权重；0 或缺失表示不出现。
- `directions` 是当前鸟点四个观察面的文案，不是鸟种固定配置。

`src/spotManager.js`

- 查询所有 / 当前 / 相邻鸟点。
- 生成相对朝向地图：`front`、`right`、`back`、`left`。
- `pickWeightedSpecies(speciesWeights)` 按鸟点权重返回鸟种数据。

`src/birdManager.js`

- 初始化和更新活动鸟。
- 管理鸟实例停留回合、行为状态和位置更新。

`src/encounterSystem.js`

- 基于当前状态和鸟点数据生成遭遇。
- 不负责 UI 渲染和 LocalStorage。

维护边界：

- `DATA_SCHEMA_PLAN.md` 中的 future `locations` / `encounters` 是规划，不是当前运行时已完成拆分。
- 不要把地点扩展规划写成当前数据结构事实。

## 6. 外部行为序列与焦内序列

相关文件：`src/photoSequence.js`、`src/focusSequence.js`

- `photoSequence.js` 描述鸟在相机外或准备拍摄阶段的行为序列。
- `focusSequence.js` 描述进入 FOCUS 后取景框内的表现序列。
- 两者都不应直接写 DOM 或 LocalStorage。
- 外部行为状态和焦内可见状态不能混用；拍照抽卡应使用拍摄瞬间 UI 捕获的可见行为状态。

维护边界：

- 不要混淆 `photoSequence` 与 `focusSequence`。
- 不要用外部行为序列的当前状态替代 FOCUS 中实际可见 badge。

## 7. 对焦、位置、缩放与拍照质量

相关文件：`src/focusEngine.js`、`data/focusConfig.js`

- `focusEngine.js` 负责对焦几何、中心判定和质量结果。
- `data/focusConfig.js` 提供 FOCUS 手感配置。
- FOCUS 视觉位置、缩放、旋转等在 UI 层捕获后写入 snapshot。

维护边界：

- 对焦框视觉位置必须与 `focusEngine` 中心判定保持一致。
- 不要恢复主界面对焦框吸附跟随。
- 不要在 render 或动画 cleanup 时重新 roll snapshot 视觉参数。
- 离开 FOCUS 后必须清理 rAF，避免后台残留动画。

## 8. 抽卡与稀有度展示

相关文件：`src/cardDraw.js`、`data/cards.js`

- `data/cards.js` 定义卡牌 id、关联鸟种、rarity、标题、描述、stars 等。
- `cardDraw.js` 按可见行为状态、对焦质量和当前规则抽取卡牌。
- rarity 是照片结果层级，不是鸟种稀有度。

维护边界：

- 不要恢复跨稀有度混池抽卡。
- 未加新前，卡牌标题和描述不应提前泄露正式鸟名。
- `heard` / `collectedCards` 不应影响 `seen` 的语义。

## 9. 笔记 / Field Guide 数据

相关文件：`src/storage.js`、`src/fieldGuide.js`

LocalStorage：

- 当前主 field guide key 是 `birdwatch_text_sim_field_guide_v3`。
- `src/storage.js` 保留 v2 -> v3 迁移：`FIELD_GUIDE_KEY_V2` 到 `FIELD_GUIDE_KEY_V3`。
- 不要修改 key，除非有明确迁移任务。

`speciesRecords`：

- 维护单个鸟种的 seen / heard / catalogued 等记录。
- 当前包含 `cataloguedDayIndex`，用于固定记录该鸟实际加新发生在第几天。
- `cataloguedRealTimestamp` 仍可作为兼容历史数据保留，但不再作为“加新于”的主展示文案。

`markCatalogued()`：

- 首次加新时写入 `cataloguedDayIndex`。
- 重复加新不应覆盖已有 `cataloguedDayIndex`。

图鉴展示：

- “加新于”当前通过 `formatGuideAddedDayIndex(getSpeciesCataloguedDayIndex(...))` 渲染为第几天。
- 不要改回现实时间，也不要用当前标题 dayIndex 替代实际 catalogued day。

## 10. 笔记 UI 与自动加新

相关文件：`src/ui/fieldGuidePanel.js`、`src/main.js`、`src/fieldGuide.js`

`src/ui/fieldGuidePanel.js` 负责：

- `wrapNoteFolder(innerHtml, options = {})`
- `renderFieldGuideBottomCloseButton()`
- `renderFieldGuideEmptyPanel(options = {})`
- `renderFieldGuideListPanel(options = {})`
- `renderResetSaveConfirmPanel(options = {})`
- `renderFieldGuideDetailCornerHtml()`
- `renderFieldGuideSnapshotNav(snapshotCount, snapshotIndex)`
- `renderFieldGuideDetailPolaroid(options = {})`
- `renderFieldGuideCardDetailPanel(options = {})`

职责边界：

- 只负责展示拼装，不负责 fieldGuide 初始化、normalize、collected / sent / sisterKnowledge / pendingAutoCatalogue 写入。
- 不负责 `sendCollectedCardToSister`、`markDueSisterRepliesReadByCardIds`、LocalStorage save/load、auto catalogue、photo_reply 选择、gameSession / focus / photo / card draw 业务流程。

当前 UI 事实：

- 手册空态、鸟种列表页和卡牌详情页底部都会输出“关闭手册”按钮。
- `src/main.js` 捕获 `.field-guide-close-bottom` 后复用 `data-action="fieldGuide"` 关闭。
- 工具栏笔记按钮 `new` 标记由 `hasAnyNewCollectedCard(gameState.fieldGuide)` 决定；active 状态只改变文案和 class。
- 自动加新流程仍由主运行时和 fieldGuide 业务字段控制；离线 `message-editor.html` 不改变自动加新逻辑。

## 11. 消息系统与妹妹知识

### 11.1 运行时消息入口

相关文件：`src/main.js`、`src/ui/messagePanel.js`、`src/fieldGuide.js`

- 消息列表包含 Liya 和妈妈等线程。
- 打开消息列表不应直接清红点；进入 Liya 聊天且有到期回复时才按当前已读链路处理。
- 消息和笔记 inline panel 互斥。
- 聊天滚动恢复由 `src/ui/messagePanel.js` 的 anchor-based restore 支撑，不要只依赖旧的 `scrollTop` 或 distance-from-bottom。
- Liya 多行分句动画存在 UI 调度和链路暂停锁；不要让 final progress 和 complete 都强制刷新聊天导致重复动画或跳动。

### 11.2 Liya photo_reply 文本来源

相关文件：`data/liyaMessages.json`、`src/liyaMessageSystem.js`、`data/sisterKnowledge.js`

`data/liyaMessages.json`

- 当前 Liya 聊天回复文本池。
- 数据结构使用 `id / speaker / type / stage / trigger / conditions / delay / priority / cooldown / allowRepeat / lines / tags`。
- 当前主要事件是 `trigger.event = "photo_sent"`。

`src/liyaMessageSystem.js`

- 负责加载 `data/liyaMessages.json`。
- 提供 fallback、normalize、validate、select。
- 主要导出包括 `getLiyaMessageState()`、`getLiyaMessageById()`、`selectLiyaMessages()`、`createLiyaSelectionSeed()`、`hashStringToUint32()`、`validateLiyaMessageData()`、`normalizeLiyaMessage()`。
- conditions 当前以实际代码支持为准，不支持的 condition 不应误触发剧情。

`data/sisterKnowledge.js`

- 仍用于手册卡牌详情页“妹妹的补充”或 fallback。
- 不要删除。
- 不要把聊天回复来源和手册妹妹补充来源混成同一个数据源，除非后续任务明确设计迁移方案。

### 11.3 queue item / 已读 / 红点

相关文件：`src/fieldGuide.js`、`src/storage.js`、`src/main.js`

`liyaMessageQueueItem`

- 当前挂在 collected card entry 上。
- 是局部 `photo_reply` queue item，不是全局 pending queue。
- 负责固定“发送给妹妹后那条回复”的 `messageId`，避免刷新或文本池排序变化后重选另一条回复。
- 结构包含 `id / source / threadId / speaker / messageId / status / createdAt / dueAt / deliveredAt / readAt / cardId / speciesId / context / effects`。

当前不负责：

- 主动消息。
- 不回复追问。
- 全局 pending queue。
- 随机延迟主逻辑。
- 手册妹妹补充来源。

旧字段仍是兼容逻辑的重要来源，不要删除：

- `sentToSister`
- `sentToSisterAt`
- `sisterReplyDueAt`
- `sisterReplyReadAt`
- `sisterKnowledgeUnlocked`
- `sisterKnowledge`

Liya 回复到期时间：

- 当前 `src/main.js` 和 `src/fieldGuide.js` 中均使用 1-2 秒随机延迟常量。
- 不要恢复或继续书写旧的 30 秒到期描述。

维护注意：

- `deliveredAt` 当前不应在 render 阶段写回，避免渲染产生存档副作用。
- `liyaAutoReadSkipOnceCardIds` 用于避免最后一行完成后的自动可见已读立即二次处理同一张卡；离开消息面板或清理 Liya 动画时应一并清空。

### 11.4 messagePanel.js UI 职责

相关文件：`src/ui/messagePanel.js`

负责：

- 消息列表 UI。
- 聊天线程 UI。
- 聊天气泡与 photo_reply 多行分句气泡。
- 引用条展示。
- 逐行动画 UI 调度。
- 聊天滚动辅助与可见性辅助。

不负责：

- 业务状态推进。
- LocalStorage 写入。
- queue 结构与消息选择业务。
- 红点规则与已读语义。

模块边界：

- UI 模块不直接写业务状态。
- UI 模块不直接写 LocalStorage。
- UI 模块不 import `main.js`；业务副作用由 `main.js` 回调 / 事件委托承接。

### 11.5 message-editor.html 离线工具

相关文件：`message-editor.html`

- 当前是离线 Liya 消息编辑器。
- 支持加载 / 导入 / 粘贴导入 / 搜索筛选 / 实时编辑 / 校验 / 预览 / 新增 / 复制 / 删除 / 导出。
- 编辑只发生在浏览器内存中。
- 导出只是下载 JSON。
- 不写回 `data/liyaMessages.json`。
- 不接入主游戏入口。
- 不写 LocalStorage / sessionStorage / indexedDB。
- 当前实现集中在单 HTML 内；仓库中没有 `src/editor/*` 或 `styles/message-editor.css`。

## 12. 数据文件

- `data/species.js`
  - 鸟种基础数据。
  - 当前字段包括 id、名称、栖息地、线索、外观、首次遇见外观、未加新前昵称、可选 `hintType`、色彩配置等，以实际代码为准。

- `data/cards.js`
  - 卡牌数据。
  - 关联鸟种、rarity、标题、描述、stars。
  - 卡牌文案不应在未加新前泄露正式鸟名。

- `data/spots.js`
  - 鸟点数据。
  - 包含描述、环境声、traits、移动消耗、相邻鸟点、方向文案、鸟种权重及部分规则。

- `data/config.js`
  - 全局配置与 `PLAYTEST_CONFIG`。
  - 当前也承载 `EVENT_HINT_COOLDOWN_TURNS`、`EVENT_HINT_DISPLAY_MS`、`EVENT_HINT_FLASH_MS`、`EVENT_HINT_QUEUE_MAX` 等轻量事件提示参数。
  - 读取应优先通过 `src/utils/config.js` helper。

- `data/focusConfig.js`
  - FOCUS 手感配置。

- `data/initialMessages.js`
  - 初始联系人和初始消息。

- `data/sisterKnowledge.js`
  - 手册 / 图鉴中“妹妹的补充”来源或兼容 fallback，不等同于 Liya 聊天回复池。

- `data/liyaMessages.json`
  - Liya 聊天 photo_reply 文本池。
  - 可通过离线 `message-editor.html` 编辑导出后人工回填，但运行时不会自动读取编辑器草稿状态。

## 13. 样式结构

- 主游戏样式全部在 `styles/style.css`。
- 事件提示条 `#eventHint` 的显隐、闪现和 reduced motion 样式也集中在 `styles/style.css`，不要为了轻量提示再单开全局样式文件。
- `message-editor.html` 的离线编辑器样式当前内联在该页面内。
- 仓库当前没有 `styles/message-editor.css`；不要在 CODE_MAP 中写成已存在。
- 不要为编辑器改动主游戏 `styles/style.css`，除非任务明确要求。

## 14. 结算、Survey 与 Analytics

### 14.1 结算 UI

相关文件：`src/main.js`

- `SETTLEMENT` 负责局末结算展示。
- “今天的收获”由 collapsed / reveal 机制控制，首次展开播放完整 reveal。
- “提前撤离并结算”按钮在行动层级上应保持弱化，不应提升为主行动。
- “休息到明天清晨”与局后问卷 / flush 时机有关；问卷未决前应按当前代码控制可用性。

### 14.2 Survey

相关文件：`src/main.js`、`data/config.js`、`src/utils/config.js`

- 当前局后问卷版本以实际代码为准，当前为 `playtest2_driving_force_v1`。
- 当前题目范围以实际代码为准，当前为 `Q1-Q12`。
- 问卷一次性展示由 `birdwatch_playtest2_driving_survey_done` 判断。
- `birdwatch_text_sim_post_survey_status` 仍存在于代码中用于旧提交状态记录，不代表当前主 done key。
- `buildPostSessionSurveyPayload()` 当前直接返回 survey payload 字段本体，不再包一层 `answers`。
- `buildSkippedPostSessionSurveyPayload()` 只写 skipped 相关字段。
- `SETTLEMENT` 先 `track("session_end")`，再由提交 / 跳过 / 继续下一天触发 `flush({ finalizeSession: true })`。
- 不要恢复为进入结算立刻 flush，也不要恢复旧的 `answers` 包裹结构。

### 14.3 Analytics

相关文件：`src/analytics.js`、`src/core/telemetryAdapter.js`、`cloudfunctions/analytics_ingest/`

`src/analytics.js`

- 维护事件队列、上报、tester profile、session survey 缓存、local fallback 等底层行为。
- `lastPayload` 需要在清空前保存副本，避免同页连续多局丢 payload。

`src/core/telemetryAdapter.js`

- 当前是 telemetryAdapter-lite。
- 包装 `createTelemetrySession()`、`trackTelemetryEvent()`、`flushTelemetry()`、`setTelemetrySurvey()`、`clearTelemetrySurvey()` 等调用。
- 不管理 runtime counters。
- 不改变 payload、event name 或 flush timing。

`cloudfunctions/analytics_ingest/`

- 接收前端完整 analytics payload。
- 写入集合 `analytics_payloads2`。
- 顶层冗余写入 `session_id / tester_uuid / event_count / event_types / has_survey / payload` 等筛选字段。
- `server_ts` 使用普通服务端时间 `new Date()`；不要恢复为 `command.serverDate()`。

### 14.4 观察日志

- 观察日志由主流程追加，用于展示玩家行动和观察结果。
- 失焦、拍照、加新、结算相关日志应保持与当前业务语义一致。

## 15. 工程辅助模块

### 15.1 `src/utils/dom.js`

当前导出：

- `escapeHtml(value)`
- `escapeRegExp(value)`

职责：

- 轻量字符串安全 helper。
- 不读写 gameState、LocalStorage 或 analytics。

### 15.2 `src/utils/format.js`

当前导出：

- `getTimeOfDayLabel(state)`
- `getTimeOfDayClassName(label)`
- `getModeDisplay(mode)`
- `getCardDisplayTitle(card)`
- `getCardDisplayDescription(card)`
- `formatPolaroidDate(timestamp)`
- `formatGuideAddedRealTime(timestamp)`
- `formatMessageTime(timestamp)`
- `formatGuideAddedDayIndex(dayIndex)`

职责：

- 展示格式化。
- 不承接业务判断，不读写 gameState / LocalStorage。

### 15.3 `src/utils/config.js`

当前导出：

- `getPlaytestConfig()`
- `isAnalyticsEnabled()`
- `isSurveyEnabled()`
- `isOpeningSurveyEnabled()`
- `isSettlementSurveyEnabled()`
- `getSurveyVersion(fallback)`

职责：

- 统一读取 `PLAYTEST_CONFIG`。
- 后续不要绕过这些 helper 散落直读配置。

### 15.4 `src/core/saveManager.js`

当前导出：

- `safeParseJson(value, fallback)`
- `readLocalStorage(key, fallback)`
- `writeLocalStorage(key, value)`
- `removeLocalStorage(key)`
- `readObservationDayIndex()`
- `writeObservationDayIndex(dayIndex)`
- `clearObservationDayIndex()`
- `hasDrivingSurveyDone()`
- `markDrivingSurveyDone()`
- `clearDrivingSurveyDone()`

职责：

- saveManager-lite。
- 只收口安全 LocalStorage helper、`birdwatch_text_sim_day_index` 和 `birdwatch_playtest2_driving_survey_done`。
- 不管理 fieldGuide 主存档、v2 -> v3 迁移、tester uuid、session index 或 analytics retry。

### 15.5 `src/core/telemetryAdapter.js`

当前导出：

- `createTelemetrySession(options)`
- `trackTelemetryEvent(eventName, payload)`
- `flushTelemetry(options)`
- `setTelemetrySurvey(survey)`
- `clearTelemetrySurvey()`
- `getTelemetryState()`
- `getTelemetryCachedPayload()`
- `clearTelemetryCachedPayload()`
- `retryCachedTelemetry(options)`

职责：

- telemetryAdapter-lite。
- 包装 analytics 底层调用。
- 不管理 runtime counters，不改变 payload 结构和 flush 时机。

## 16. 设计与规划文档

- `docs/design/DATA_SCHEMA_PLAN.md`
  - 三测与未来数据结构规划。
  - 不是当前运行时 schema 实现。

- `docs/design/EDITOR_WORKBENCH_PLAN.md`
  - 编辑器工作台规划。
  - 不是完整 CMS 实现。

维护边界：

- 不要把规划字段写成当前数据文件已经存在。
- 不要把未来发布系统写成已经接入主游戏。

## 17. 常见维护风险

- 不要混淆 `photoSequence` 与 `focusSequence`。
- 不要把 `#eventHint` 当主事件文本使用，也不要让它泄露正式鸟名、剧情结论或固定偏向某一侧。
- 不要恢复跨稀有度混池抽卡。
- 不要让未加新鸟泄露正式名。
- 不要让 heard / collectedCards 影响 seen。
- 不要让 rAF 在离开 FOCUS 后残留。
- 不要在 render 或动画回收时重新 roll snapshot 视觉参数。
- 不要把消息已读改成“打开消息列表即清”。
- 不要把自动加新改成消息已读瞬间完成或首页批量完成。
- 不要只依赖 `scrollTop` 恢复聊天滚动，应保留 anchor-based restore。
- 不要让 final progress 和 complete 都强制刷新聊天，导致分句动画重复或跳动。
- 不要把 `saveManager.js` 当完整存档系统。
- 不要把 `telemetryAdapter.js` 当完整 analytics 模块化。
- 不要把 `message-editor.html` 当主游戏运行时。
- 不要把 `docs/design` 规划写成已实现功能。
- 不要把普通重置按钮重新塞回笔记内容页。
- 不要恢复旧 survey payload 的 `answers` 包裹结构。
- 不要把聊天回复和手册妹妹补充合并为同一来源。
- 不要删除 `data/sisterKnowledge.js`，除非有明确迁移任务并完成验证。

## 18. 扩展入口

- 调整探索阶段事件提示：
  - 逻辑入口：`src/eventSystem.js`
  - 触发注入：`src/main.js`、`src/gameSession.js`
  - 文案类型：`data/species.js` 的 `hintType`
  - 基础参数：`data/config.js` 中 `EVENT_HINT_*`
  - 展示节点与样式：`index.html` 的 `#eventHint`、`styles/style.css`

- 调整 Liya 聊天回复文本：
  - 编辑源：`data/liyaMessages.json`
  - 离线工具：`message-editor.html`
  - 选择规则：`src/liyaMessageSystem.js`，仅当需要改匹配 / 排序 / 去重规则时修改。

- 调整手册“妹妹的补充”：
  - `data/sisterKnowledge.js`

- 调整离线编辑器工具：
  - `message-editor.html`
  - 只有实际新增 `src/editor/*` 或 `styles/message-editor.css` 后，才在本文档补充这些文件。

- 调整 test config / analytics / survey 开关：
  - `data/config.js`
  - 读取统一经 `src/utils/config.js`。

- 调整 dayIndex / driving survey done 存取：
  - `src/core/saveManager.js`

- 调整 analytics 调用入口：
  - `src/core/telemetryAdapter.js`
  - 底层实现仍在 `src/analytics.js`。

- 调整 CloudBase ingest：
  - `cloudfunctions/analytics_ingest/`

- 调整消息面板 UI：
  - `src/ui/messagePanel.js`
  - 不应在该模块写业务状态或 LocalStorage。

- 调整笔记 / 图鉴 UI 片段：
  - `src/ui/fieldGuidePanel.js`
  - 不应在该模块写 fieldGuide 数据。

## 19. QA 快速检查清单

核心游戏：

1. 打开 `index.html`，确认主游戏正常启动。
2. 完成从 START 到 START_SPOT_SELECT，再到 EXPLORE 的基础链路。
3. 在 `EXPLORE` 阶段多次转向和远听落地，确认 `#eventHint` 只在左右侧有可用鸟时出现，左右都有鸟时不会固定只出右侧，同鸟点同方向仍受冷却控制。
4. 触发 FIRST_ENCOUNTER，确认未提前泄露正式鸟名。
5. 进入 PHOTO，覆盖 DECISION / FOCUS / RESULT / REPOSITION / LOST。
6. FOCUS 拍照时确认所见即所得：可见行为状态、对焦位置、缩放、旋转写入 snapshot。
7. 成功拍照才消耗电量。
8. 加新写入 field guide，并记录正确 `cataloguedDayIndex`。
9. 笔记列表、卡牌详情、照片翻页和底部关闭按钮正常。
10. 发送照片给 Liya 后，1-2 秒到期回复；不要按旧 30 秒预期测试。
11. Liya 聊天红点、已读、分句动画、滚动恢复正常。
12. 结算页 collapsed / reveal 正常；问卷未决时结算行动按当前逻辑禁用或开放。

离线内容工具：

1. 打开 `message-editor.html`。
2. 默认加载或手动导入 `data/liyaMessages.json`。
3. 搜索 / 筛选 / 编辑 / trigger 非法输入 / 新增 / 复制 / 删除 / 导出 / 再导入。
4. 确认不会影响 `index.html` 主游戏。
5. 确认只下载 JSON，不写回 `data/liyaMessages.json`。

config / analytics / survey：

1. 默认 main 不显示问卷、不发送 analytics。
2. `analyticsEnabled=true` 时事件恢复。
3. `surveyEnabled + settlementSurveyEnabled` 时问卷路径正常。
4. survey 开启但 analytics 关闭时 no-op 不崩。
5. `session_start / photo_taken / chat_opened / chat_closed / field_guide_opened / sister_message_received / sister_message_viewed / session_end` 正常。
6. payload 结构不变。

saveManager：

1. dayIndex 第 1 天 / 第 2 天 / 刷新保留 / 重置行为正常。
2. driving survey done 一次性逻辑正常。
