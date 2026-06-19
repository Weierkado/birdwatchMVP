# 《认鸟手信》代码地图

更新时间：2026-06-19

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
  - 当前以 `main.page.app-shell` 作为固定手机壳根容器，内部包含 `scene-bg`、`app-hud`、`app-event-strip`、`app-main-panel`、`app-content-area`、`app-action-zone`、`detailPanel`、`log-panel` 和 `inlineChoicePanel` 等静态节点。
  - `detailPanel` 与 `.log-panel` 节点当前仍保留在 DOM 中，但主界面默认探索态已不再持续显示“观察区域”“观察日志”“主界面额外拍照时机”或“选择初始鸟点”内容。
  - 顶部“周围事件”“天气”“位置”等状态卡通过 `src/main.js` 在运行时改写对应节点内容；当前没有 `.status-grid` 与 `.event-box` 之间的独立 `#eventHint` 节点，也没有独立 `#directionText` 状态格。
  - `#inlineChoicePanel` 当前位于 `#eventText` 之后，只承载主叙事后的轻量行动选项，不写业务状态。

- `styles/style.css`
  - 主游戏全局样式。
  - 覆盖固定手机壳、HUD / Event Strip / Main Panel / Action Zone、四项底部导航、overlay 壳层、消息面板、笔记文件夹、相册、纸页、卡牌、FOCUS 取景框、拍立得、结算、地图、状态栏事件高亮、RESULT 发妹妹按钮、inline choices、动画和响应式规则。
  - 离线编辑器样式当前内联在 `message-editor.html`，不写入主样式。

- `src/`
  - 主游戏运行时模块：状态、流程、天气、遭遇、事件提示、拍照、对焦、抽卡、笔记存档、UI 编排、analytics 包装等。

- `src/ui/`
  - 主游戏 UI 片段模块。
  - `bottomNav.js` 负责底部【观察 / 消息 / 笔记 / 相册】主导航按钮 HTML 与 active / unread / new 状态展示。
  - `messagePanel.js` 负责消息面板展示和聊天动画 UI。
  - `fieldGuidePanel.js` 负责笔记 / 图鉴页面 HTML 片段，并提供相册 overlay 外壳与复用的卡牌详情片段。
  - `toolOverlayShell.js` 负责 messages / fieldGuide / album 共用的 overlay 壳层 HTML，不负责 overlay 数据读写或 `activeOverlay` 业务状态。

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
2. 玩家主入口当前由 `src/main.js` 直接选择默认 start spot 并进入 `EXPLORE`
3. `FIRST_ENCOUNTER` 或 `PHOTO`
4. `PHOTO` 子阶段
5. `SETTLEMENT`

保留模式：

- `START_SPOT_SELECT`：起始鸟点选择的隐藏 fallback / 调试态；底层 helper 与 mode 仍保留，但玩家主界面当前不展示该选择列表。
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
- `turnLeft`、`turnRight`、`observe` 当前不是即时刷新：`src/main.js` 会先预执行探索逻辑，再根据动作或 observe 结果类型插入一小段过渡延迟，期间禁用探索行动按钮；`listenDistant` 不使用这层延迟。
- 转向后或远听落地后，可能补充一次独立事件提示扫描；该提示只反映左右侧是否有鸟类活动，不改变主事件文本链路。
- 一天开始时会先确定当天天气；当天探索过程中只允许在指定回合窗口内最多切换一次天气，天气变化短句复用“周围事件”状态卡显示。
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
- 渲染固定手机壳内的 HUD、Event Strip、主叙事、inline choices、Action Zone、详情面板、底部导航和观察日志。
- 将 `eventSystem.getDisplayText()` / `isActive()` 渲染进顶部状态栏“周围事件”卡片，并同步“天气”卡片内容。
- 管理顶部“周围事件”卡片的一次性 pulse 褪色反馈重播。
- 管理顶部探索态 / 拍摄态双态：探索态右侧状态块显示小地图，拍摄态显示拍摄时机窗口，并用运行时语义 `isCameraRaisedForTopUi` 保持“相机举起后直到真正退出拍摄前都维持拍摄态顶栏”。
- 分发按钮点击到 `gameSession.js` 的 handler，并为探索态 `turnLeft / turnRight / observe` 包一层 ritual delay：先预执行 `handleExploreAction()`，即时显示过渡文本、锁住行动按钮，再在随机延迟结束后统一 render。
- 通过 `isLegacyStatusGridSuppressed()` / `shouldRenderLegacyObservationMap()` 等 UI-only helper，在 `START`、`EXPLORE`、`FIRST_ENCOUNTER` 和 `PHOTO` 的 `DECISION / RESULT / REPOSITION / LOST` 收起 legacy `status-grid` 与旧“周边环境”地图块；`PHOTO / FOCUS` 与 `SETTLEMENT` 当前保守排除在外。
- 管理主叙事后的 `inlineChoicePanel`：`EXPLORE`、`FIRST_ENCOUNTER`、`PHOTO DECISION / RESULT / REPOSITION / LOST` 当前通过轻量文本选项提供普通行动；`Action Zone` 只保留默认主操作。两者共用同一套 `data-action` / `data-type` 点击分发，不改业务 action 语义。
- 编排 `FIELD_GUIDE`、`SETTLEMENT`、`PHOTO`、`FIRST_ENCOUNTER`、`START_SPOT_SELECT`、`SPOT_SELECT` 和默认探索详情。
- 在玩家主界面默认隐藏“观察区域”“观察日志”“主界面额外拍照时机”“选择初始鸟点”这些旧块；`detailPanel` 只在 FIRST_ENCOUNTER、FIELD_GUIDE、SETTLEMENT、重置确认、tester profile 等真正需要内容的状态下展开。
- 管理消息 / 笔记 / 相册 overlay 的互斥打开、关闭、位置移动和入场动画，并把 `detailPanel` 挂载到共用 `toolOverlayShell` 内容区。
- 管理 FOCUS rAF、可见状态捕获、对焦结果捕获、拍立得 overlay 生命周期。
- 管理图鉴 / 笔记页码、笔记卡牌详情、相册列表 / 详情、snapshot 翻页、发送给妹妹、RESULT 页发妹妹按钮状态、自动加新 reveal。
- 管理详情区独立观察地图的旋转状态、标签反向旋转和展示同步。
- 管理 `SETTLEMENT` 中“整理今天的观察”展开区。
- 初始化 `src/eventSystem.js`，向 `gameSession.js` 注入事件提示扫描能力，并在开新局 / 下一天 / 重置时清理提示状态。
- 初始化 `src/weatherSystem.js`，向 `gameSession.js` 注入天气生命周期能力，并在启动时读取当天天气标签。
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
- `albumDetailCardId` / `albumDetailSnapshotIndex` / `albumPageIndex`：相册详情、相册照片翻页和相册分页。
- `activeOverlay`：`messages` / `fieldGuide` / `album` / `resetSaveConfirm` overlay 或空值。
- `messageView`：消息列表、Liya 聊天、妈妈聊天等视图。
- `inlinePanelJustOpened`：只控制打开当次入场动画，render 后清理。
- `inlineChoicePanel`：主叙事下方轻量选项宿主，不进 gameState、不写 LocalStorage。
- `recentlyCataloguedSpeciesId`：本次加新 reveal。
- `sisterReplyTimerId`：Liya 延迟回复到期后的 render 定时器。
- `autoCatalogueCompletionTimerId`：自动加新动画完成后的落地定时器。
- `lastRenderedEventPulseKey`：顶部“周围事件”卡片上一次已播放的 pulse key。
- `latestVisibleFocusState`：拍摄瞬间所见行为状态，决定抽卡 rarity。
- `latestFocusResult`：拍摄瞬间对焦位置 / 质量。
- `focusBadgeRandomScale` / `latestBadgeRotation`：FOCUS runtime 视觉值，只写入 snapshot，不写入 gameState。
- `isCameraRaisedForTopUi`：仅供顶栏双态判断的运行时语义，不写入存档，不替代 `gameState.photoPhase`。
- `isActionTransitioning` / `actionTransitionTimerId`：探索态 ritual delay 的页面级过渡锁；只控制探索主动作的临时禁点和延迟 render，不进入 `gameState` 或 LocalStorage。
- `observationMapRotationDeg` / `lastObservationMapFacingDirection` / `lastRenderedObservationMapRotationDeg`：观察地图旋转盘面的 UI 状态。
- `settlementReviewExpanded`：`SETTLEMENT` 里“整理今天的观察”是否已展开。

维护边界：

- `main.js` 可以做 UI 和动画生命周期，但核心规则应放在业务模块。
- 玩家主入口当前由 `handleSystemAction("start")` 直接选取 `getStartSpotChoices()` 的首个可用 start spot 并调用 `startGameAtSpot()`；不要误把隐藏的 `START_SPOT_SELECT` 当成当前正式玩家链路，也不要在没有独立任务时删除其底层 helper。
- shoot 点击必须在调用 `handlePhotoAction()` 前捕获可见 badge 状态、对焦结果、距离缩放、旋转等所见即所得数据。
- `latestVisibleFocusState` 决定抽卡 rarity，不能用外部 `photoSequence` 当前状态替代。
- `latestFocusResult` / DOM frame 换算必须和实际渲染的固定 4:3 取景框一致。
- 探索动作 ritual delay 当前是 UI 层节奏包装，不要把定时等待塞进 `gameSession.js`、`encounterSystem.js` 或天气 / 事件提示系统。
- 观察地图只跟随真实 `facingDirection` 变化，不能反向驱动 gameState、事件提示或天气判断。
- “周围事件”卡片的 pulse 只是瞬时视觉反馈，不应拿它承载队列、cooldown 或事件文本生命周期。
- 消息 / 笔记 / 相册内页导航不应设置 `inlinePanelJustOpened`，避免每次 render 重播整体入场动画。

## 4. 游戏状态与业务状态机

相关文件：`src/gameState.js`、`src/gameSession.js`、`src/weatherSystem.js`

`src/gameState.js`

- `createDefaultGameState()` 创建单局状态。
- 默认字段包括 `mode`、`currentTurn`、`maxTurns`、`currentSpotId`、`availableSpotOptions`、`facingDirection`、`directions`、`maxPhotos`、`photos`、`logs`、`activeBirds`、`currentPhotoTarget`、`currentPhotoSequence`、`currentFocusSequence`、`photoPhase`、`distantListenOptions`、`fieldGuide`、`sessionNewCards`、`sessionHeardSpeciesIds`、`unlockedCardIdsAtRunStart`、`nightReviewStats`、`weather`、`eventText`、`eventHtml` 等。
- `nightReviewStats` 当前至少保存 `sentToSisterCount`，用于 `SETTLEMENT` 的“整理今天的观察”文案统计，不替代消息队列或跨局存档。
- `weather` 当前保存 `current / switched / initializedForDay`，用于区分“新的一天的初始天气”与“当天探索过程中的中途天气变化”。

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
- `setWeatherSystem(system)`
- `endGame(state)`

主模式：

- `START`
- `EXPLORE`
- `DISTANT_LISTEN`
- `FIRST_ENCOUNTER`
- `PHOTO`
- `SETTLEMENT`
- `FIELD_GUIDE`
- `SPOT_SELECT`
- `START_SPOT_SELECT`（保留但当前玩家主界面隐藏）

PHOTO action 规则：

- `DECISION`：`raiseCamera`、`wait`、`giveUp`
- `FOCUS`：`shoot`、`timeout`
- `RESULT`：`refocus`、`wait`、`giveUp`
- `REPOSITION`：`reposition`
- `LOST`：`putDownCamera`

维护边界：

- `gameSession.js` 不访问 DOM。
- `handleExploreAction(state, action)` 当前仍是即时业务推进函数：转向 / 观察的真实状态变化先发生，再由 `src/main.js` 决定是否延迟 render；不要为了节奏包装把它改成异步状态机。
- 侧向事件提示扫描通过注入的 `eventSystem` 触发，只在 `EXPLORE` 阶段转向后与远听落地后按概率补充执行；不要在 `PHOTO`、`FOCUS`、`RESULT`、`SETTLEMENT` 或 overlay 流程里复用它。
- 天气通过注入的 `weatherSystem` 管理：`startGameAtSpot()` 对同一天做幂等初始化，`advanceTurn()` 才允许尝试局内切换；不要在“开始今天的观鸟”按钮、状态栏渲染或结算流程里重新 roll 当天天气。
- `handlePhotoAction("shoot")` 使用 UI 传入的 `capturedBehaviorState`、`capturedFocusAffix` 和 snapshot 视觉参数。
- 拍照成功才消耗电量，即向 `state.photos` 写入照片。
- 照片 snapshot 当前会补写 `weatherKey`，用于保留拍摄时的天气标签；不要在 UI 层另起一套天气记录字段。
- `REPOSITION` 表示鸟离开当前取景位置但仍在视野；`LOST` 表示本次已经失去位置。
- `handleCatalogueAction()` 仍是加新写入口，可被自动加新流程复用。
- observe 分支当前会把 `observeCurrentDirection()` 的 `type` 写入运行时 `state.lastObserveResultType`，并在 empty 时把环境细节拼进 `eventText`；该字段只给顶层 UI 选择延迟使用，不是持久化存档字段。

## 5. 鸟点、鸟实例与遭遇

相关文件：`data/spots.js`、`src/spotManager.js`、`src/birdManager.js`、`src/encounterSystem.js`

`data/spots.js`

- 当前鸟点数据包含 `name`、`description`、`speciesWeights`、`directions`、`neighbors` 等。
- 当前还允许配置可选 `ambientDetails[directionIndex]` 文本池，供空观察时追加环境细节；缺省时必须安全 fallback，不影响探索主流程。
- `speciesWeights` 控制生成权重；0 或缺失表示不出现。
- `directions` 是当前鸟点四个观察面的文案，不是鸟种固定配置。

`src/spotManager.js`

- 查询所有 / 当前 / 相邻鸟点。
- 生成相对朝向地图：`front`、`right`、`back`、`left`。
- 当前下方观察地图 UI 不再直接渲染旧的 `front / right / back / left` 文本格，而是复用 `currentSpot.directions` 的绝对方向文案，再由 `src/main.js` 按 `facingDirection` 做 90 度旋转展示。
- 当前探索态主界面的小地图已从详情区收口到顶部右侧状态块，详情区默认不再持续显示独立地图面板。
- `getRandomAmbientDetail(spotId, directionIndex)` 当前负责从 `ambientDetails` 中安全随机取一条环境细节；未来新增鸟点即使没有配置该字段，也不应报错。
- `pickWeightedSpecies(speciesWeights)` 按鸟点权重返回鸟种数据。

`src/birdManager.js`

- 初始化和更新活动鸟。
- 管理鸟实例停留回合、行为状态和位置更新。

`src/encounterSystem.js`

- 基于当前状态和鸟点数据生成遭遇。
- `observeCurrentDirection(state)` 当前除 `found / bird / message` 外，还会返回 `type = "bird" | "clue" | "empty"`；该类型用于探索态 ritual delay 时长与 empty 结果的环境细节追加。
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
- `renderAlbumPanel(options = {})`
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
- 笔记页当前是按鸟种翻页的观察笔记，不承载相册缩略卡列表。
- 自动加新流程仍由主运行时和 fieldGuide 业务字段控制；离线 `message-editor.html` 不改变自动加新逻辑。

## 10A. 相册 UI 与照片详情

相关文件：`src/main.js`、`src/ui/bottomNav.js`、`src/ui/fieldGuidePanel.js`、`src/fieldGuide.js`、`styles/style.css`

当前 UI 事实：

- 底部主导航由 `src/ui/bottomNav.js` 渲染为【观察 / 消息 / 笔记 / 相册】四项；active 状态由 `src/main.js` 的 `activeOverlay` 传入。
- 相册是 `activeOverlay = "album"` 的主游戏运行时 overlay，与消息、笔记和重置确认面板互斥。
- 相册列表读取 `gameState.fieldGuide.collectedCards`，以 collected card 为单位展示卡牌级缩略项，按最新 snapshot 时间排序并通过 `albumPageIndex` 分页。
- 相册详情通过 `renderFieldGuideCardDetail()` 复用既有卡牌详情、拍立得照片、snapshot 翻页和“发送妹妹”按钮片段，但使用独立的 `albumBack`、`albumSnapshotPrev`、`albumSnapshotNext`、`albumSendToSister` action。
- 相册详情状态使用 `albumDetailCardId` / `albumDetailSnapshotIndex`，不复用笔记详情的 `fieldGuideDetailCardId` / `fieldGuideDetailSnapshotIndex`。
- 相册空态文案为“还没有照片”，只表示当前 collected card / snapshot 为空，不触发自动加新或数据修复。

职责边界：

- 相册不新增 LocalStorage key，不修改 field guide v3 schema、collected card schema 或 snapshot schema。
- 相册不把每张 snapshot 拆成新的持久化实体；当前列表单位是 collected card。
- 相册发送妹妹复用 `sendCollectedCardEntryToSister()` 和 collected card 上既有 `sentToSister` / `liyaMessageQueueItem` 语义，不新增 `albumSentToSister` 或第二套 queue。
- `src/ui/fieldGuidePanel.js` 只提供相册外壳和复用 HTML 片段，不负责写入 fieldGuide、选择 Liya 回复、保存 LocalStorage 或改变消息已读状态。

## 11. 消息系统与妹妹知识

### 11.1 运行时消息入口

相关文件：`src/main.js`、`src/ui/messagePanel.js`、`src/fieldGuide.js`

- 消息列表包含 Liya 和妈妈等线程。
- 打开消息列表不应直接清红点；进入 Liya 聊天且有到期回复时才按当前已读链路处理。
- 消息、笔记和相册 overlay 互斥，并共用 `src/ui/toolOverlayShell.js` 的整壳层阅读面板。
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
- 图鉴详情页、相册详情页与 RESULT 页发送当前复用同一套 collected card / `liyaMessageQueueItem` 语义，不应再引入第二套 sent 标记。
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
  - 包含描述、环境声、traits、移动消耗、相邻鸟点、方向文案、可选 `ambientDetails`、鸟种权重及部分规则。

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
- 固定壳层当前由 `.page`、`.app-shell`、`.scene-bg`、`.app-hud`、`.app-event-strip`、`.app-main-panel`、`.app-content-area`、`.app-action-zone` 共同组成；桌面端锁定 `390px × 844px`，移动端只在 `@media (max-width: 430px)` 下切到 `100vw × 100svh`。
- `.bottom-nav-host` 与 `.tool-overlay-host` 当前虽然仍使用 `position: fixed`，但桌面态宽度会收口到 `--app-width` 并居中；不要恢复成直接跟随 viewport 的 `100vw` overlay / nav 布局。
- 底部主导航当前使用 `.bottom-nav-*` 相关样式并按四项布局；窄屏规则需要保持在基础规则之后，避免被默认网格覆盖。
- `Action Zone` 当前主要使用 `.app-action-zone`、`.action-panel--solo`、`.action-panel--focus`、`.action-panel--choices` 等样式，只承担单个默认主操作；主叙事后的轻量选项使用 `.app-content-area .inline-choice-panel`、`.inline-choice`、`.inline-choice-pip`、`.inline-choice-text`，不要把两套样式重新揉回同一组多按钮底栏。
- 相册当前使用 `.album-panel`、`.album-grid`、`.album-card`、`.album-pagination`、`.album-empty` 等样式；这些样式只负责相册展示，不应驱动存档、发送状态或消息队列。
- 主叙事当前通过 `.app-content-area .event-box.main-narrative:not(.is-settlement-event)` 等父级限定去掉旧浅底卡片感；这类规则只应作用于主游戏 Shell 内容区，不要误伤 messages / fieldGuide / album overlay 内部卡片。
- “周围事件”状态卡当前没有独立 `#eventHint` 样式块；短时提示文字仍由 `.status-mode.is-event-active` 标识，但真正的暖色瞬时褪色反馈通过 `.status-mode.is-event-pulse::after` 的 overlay 动画承担。
- 探索详情区当前使用 `.observation-map-panel`、`.observation-map__field`、`.observation-map__item`、`.observation-map__label` 等样式绘制独立观察地图，不再使用旧 `.map-grid` / `.map-node` / `.map-connector` 文本地图布局。
- 顶部探索态小地图当前额外使用 `.status-photo-timing.is-map` 作为容器，并通过 `--viewfinder-surface-bg`、`.observation-map__item.is-front`、中心十字和无胶囊文字标签收口为极简样式；这些样式只改视觉，不改方向语义。
- 探索态 ritual delay 当前通过 `.action-panel.is-transitioning button` 临时降透明度并禁点；这层样式只服务探索主动作，不应用于 bottom nav、overlay 或拍摄态按钮。
- `SETTLEMENT` 当前包含 `.settlement-night-review*` 一组夜晚整理样式；它是结算展示补充，不是 survey 或消息系统入口。
- RESULT 页发妹妹按钮状态当前使用 `button-liya-identify` 与 `button-liya-sent-pressed` 等局部样式；不要为该状态再拆新的全局按钮系统。
- `message-editor.html` 的离线编辑器样式当前内联在该页面内。
- 仓库当前没有 `styles/message-editor.css`；不要在 CODE_MAP 中写成已存在。
- 不要为编辑器改动主游戏 `styles/style.css`，除非任务明确要求。

## 14. 结算、Survey 与 Analytics

### 14.1 结算 UI

相关文件：`src/main.js`

- `SETTLEMENT` 负责局末结算展示。
- “今天的收获”由 collapsed / reveal 机制控制，首次展开播放完整 reveal。
- “整理今天的观察”当前是可选手动展开的补充区块，内容来自本局运行时统计，不改变 rest、survey 或 `session_end` / flush 链路。
- “提前撤离并结算”按钮在行动层级上应保持弱化，不应提升为主行动。
- “休息到明天清晨”与局后问卷 / flush 时机有关；问卷未决前应按当前代码控制可用性。

### 14.1A 天气与状态栏提示

相关文件：`src/main.js`、`src/weatherSystem.js`、`src/gameSession.js`、`src/gameState.js`

- `src/weatherSystem.js` 是轻量天气模块，不接管主状态机，只负责当天天气初始化、局内一次性切换和天气标签读取。
- 初始天气只在新的一天建立时确定；同一天再次点击【开始今天的观鸟】只读取已初始化天气，不应再次 roll，也不应触发 `WEATHER_CHANGE` 提示。
- 局内天气变化文案通过 `eventSystem.dispatch()` 复用顶部“周围事件”状态卡，不替换 `#eventText` 主事件描述。
- `src/main.js` 当前把“天气”卡片渲染到状态栏，并在拍照结果 / 结算以外的正常渲染路径中持续显示当前天气标签。

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
- 主界面当前默认隐藏 `.log-panel`，但 `gameState.logs` 仍持续累积，不能把“日志块隐藏”误写成“日志数据已删除”。
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
- 不要把顶部状态栏“周围事件”当主事件文本使用，也不要让它泄露正式鸟名、剧情结论或固定偏向某一侧。
- 不要恢复跨稀有度混池抽卡。
- 不要让未加新鸟泄露正式名。
- 不要让 heard / collectedCards 影响 seen。
- 不要让 rAF 在离开 FOCUS 后残留。
- 不要在 render 或动画回收时重新 roll snapshot 视觉参数。
- 不要把消息已读改成“打开消息列表即清”。
- 不要把自动加新改成消息已读瞬间完成或首页批量完成。
- 不要只依赖 `scrollTop` 恢复聊天滚动，应保留 anchor-based restore。
- 不要让 final progress 和 complete 都强制刷新聊天，导致分句动画重复或跳动。
- 不要把探索动作 ritual delay 扩散到 `listenDistant`、PHOTO / FOCUS / RESULT、overlay 按钮或系统按钮；当前只应包裹 `turnLeft / turnRight / observe`。
- 不要把空观察追加的 `ambientDetails` 写进 `gameState.logs`，否则日志会混入临场阅读细节并污染后续恢复或展示。
- 不要把 `saveManager.js` 当完整存档系统。
- 不要把 `telemetryAdapter.js` 当完整 analytics 模块化。
- 不要把 `message-editor.html` 当主游戏运行时。
- 不要把 `docs/design` 规划写成已实现功能。
- 不要把普通重置按钮重新塞回笔记内容页。
- 不要恢复旧 survey payload 的 `answers` 包裹结构。
- 不要把聊天回复和手册妹妹补充合并为同一来源。
- 不要删除 `data/sisterKnowledge.js`，除非有明确迁移任务并完成验证。
- 不要把相册状态写进笔记详情状态；`albumDetailCardId` / `albumDetailSnapshotIndex` 与 `fieldGuideDetailCardId` / `fieldGuideDetailSnapshotIndex` 应保持分离。
- 不要为相册新增第二套已发送字段、第二套 Liya queue 或新的 LocalStorage key；相册详情应继续复用 collected card 上的 `sentToSister` / `liyaMessageQueueItem`。
- 不要把相册缩略列表塞回笔记鸟种页；笔记负责观察记录，相册负责照片缩略与照片详情入口。

## 18. 扩展入口

- 调整固定手机壳 / 移动端全屏切换：
  - 静态骨架：`index.html` 的 `main.page.app-shell`
  - 样式节点：`styles/style.css` 的 `.page`、`.app-shell`、`.scene-bg` 以及移动端 `@media (max-width: 430px)`
  - 宿主约束：`.bottom-nav-host`、`.tool-overlay-host`
  - 维护边界：只改壳层尺寸、定位和响应式约束，不要顺手改业务状态、按钮逻辑或 overlay 数据流

- 调整 overlay 壳层统一样式：
  - UI 片段：`src/ui/toolOverlayShell.js`
  - 编排入口：`src/main.js` 的 `activeOverlay` / `inlinePanelJustOpened`
  - 样式节点：`styles/style.css` 的 `.tool-overlay-*`
  - 维护边界：只改返回按钮、标题栏、scrim 和壳层布局，不要顺手改 message / fieldGuide / album 各自的数据读写

- 调整底部主导航：
  - UI 片段：`src/ui/bottomNav.js`
  - 状态来源：`src/main.js` 的 `activeOverlay`、未读消息数、笔记 new 标记
  - 样式节点：`styles/style.css` 的 `.bottom-nav-*`
  - 维护边界：只改导航展示和 action 分发，不要顺手改 overlay 数据状态或消息已读语义

- 调整主叙事后的 inline choices / Action Zone 分工：
  - UI 编排：`src/main.js` 的 `renderActions()`、`appendInlineChoices()`、`clearInlineChoices()`、`handleActionControlClick()`
  - 静态宿主：`index.html` 的 `#inlineChoicePanel`
  - 样式节点：`styles/style.css` 的 `.app-action-zone`、`.action-panel--*`、`.inline-choice*`
  - 维护边界：只改行动入口的呈现层级和壳层样式，不要顺手改 `turnLeft` / `turnRight` / `observe`、PHOTO action、ritual delay、发妹妹或其他业务 action 语义

- 调整相册入口、列表或照片详情：
  - UI 编排：`src/main.js` 的 album overlay、`albumDetailCardId`、`albumDetailSnapshotIndex`、`albumPageIndex`、`renderAlbum*()` helper
  - HTML 片段：`src/ui/fieldGuidePanel.js` 的 `renderAlbumPanel()` 与复用详情片段
  - 数据来源：`src/fieldGuide.js` 的 collected card / snapshot 读取 helper
  - 样式节点：`styles/style.css` 的 `.album-*`
  - 维护边界：不新增相册存档 key，不拆改 snapshot schema，不引入第二套发送妹妹状态

- 调整探索阶段事件提示：
  - 逻辑入口：`src/eventSystem.js`
  - 触发注入：`src/main.js`、`src/gameSession.js`
  - 文案类型：`data/species.js` 的 `hintType`
  - 基础参数：`data/config.js` 中 `EVENT_HINT_*`
  - 展示节点与样式：`src/main.js` 的状态栏“周围事件”渲染与 pulse 重播、`styles/style.css` 的 `.status-mode.is-event-active` 与 `.status-mode.is-event-pulse::after`

- 调整下方观察地图 UI：
  - 逻辑入口：`src/main.js` 中 observation map 相关 helper
  - 文案来源：`data/spots.js` 的 `directions`
  - 当前面向来源：`gameState.facingDirection` 与 `src/spotManager.js` 的 `getSurroundingSpotMap()`
  - 样式节点：`styles/style.css` 的 `.observation-map-panel` / `.observation-map__*`
  - 维护边界：只改 UI 旋转、布局和动画，不要顺手改真实方向判断、事件提示或天气逻辑

- 调整顶部探索态 / 拍摄态双态：
  - 逻辑入口：`src/main.js` 的 `isCaptureTopUiActive()`、`syncCameraRaisedTopUiStateAfterAction()`、`renderStatusBlocks()`、`renderPhotoTimingStatus()`
  - 运行时语义：`isCameraRaisedForTopUi`
  - 维护边界：只修顶栏显示语义与主界面编排，不要顺手改 `handlePhotoAction()` 的子阶段状态机

- 调整探索动作 ritual delay 与空观察环境细节：
  - UI 节奏入口：`src/main.js` 的 `handleExploreRitualAction()`、`getExploreTransitionText()`、`getRitualDelay()`、`isActionTransitioning`
  - 业务结果入口：`src/gameSession.js` 的 `handleExploreAction()` observe 分支
  - 遭遇结果类型：`src/encounterSystem.js` 的 `observeCurrentDirection()`
  - 环境细节数据：`data/spots.js` 的 `ambientDetails`
  - 读取 helper：`src/spotManager.js` 的 `getRandomAmbientDetail()`
  - 维护边界：只改探索态 turn / observe 的节奏包装和 empty 文本补充，不要顺手改 listenDistant、天气、事件提示、拍摄状态机或日志持久化语义

- 调整天气系统：
  - 逻辑入口：`src/weatherSystem.js`
  - 状态注入：`src/main.js`、`src/gameSession.js`
  - 状态字段：`src/gameState.js` 的 `weather.current / switched / initializedForDay`
  - 拍照落档：`src/gameSession.js` 的 snapshot `weatherKey`

- 调整 RESULT 页发妹妹按钮与说明文案：
  - UI 编排与瞬时状态：`src/main.js`
  - 已发送 / queue item 语义：`src/fieldGuide.js`
  - 文案来源：RESULT 行动按钮与 `getResultPreviouslySharedNote()`
  - 维护边界：RESULT、笔记详情和相册详情应共用 collected card 上的发送状态，不要新增第二套 Liya queue

- 调整 `SETTLEMENT` 夜晚整理展示：
  - UI 编排与展开状态：`src/main.js`
  - 本局统计字段：`src/gameState.js` 的 `nightReviewStats.sentToSisterCount`
  - 维护边界：只补充结算展示，不要改 survey flush、Liya queue 或 next day 流程

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
2. 在桌面宽屏下确认手机壳保持约 `390px × 844px` 并居中，HUD / Event Strip / Main Panel / Action Zone / Bottom Nav / overlay 不随浏览器宽度横向拉伸。
3. 在窄屏下确认只在 `@media (max-width: 430px)` 命中时切到 `100vw × 100svh`，且不出现横向滚动。
4. 完成从 START 直接进入默认初始鸟点 `EXPLORE` 的基础链路，并确认玩家主界面不再显示【选择初始鸟点】。
5. 检查 `START`、`EXPLORE`、`FIRST_ENCOUNTER`、`PHOTO DECISION / RESULT / REPOSITION / LOST`，确认 legacy `status-grid` 与旧“周边环境”地图块保持隐藏，主叙事不再带旧浅底卡片。
6. 在 `EXPLORE` 阶段确认 `#inlineChoicePanel` 跟随在主叙事文本后方，提供【观察当前方向 / 向左转 / 向右转 / 聆听周围鸟点 / 提前撤离并结算】等轻量选项，而 `Action Zone` 只保留默认主操作。
7. 在 `EXPLORE` 阶段多次转向，确认【向左转 / 向右转】先显示过渡文本、延迟约 400-750ms 后才刷新方向和顶部小地图，且延迟期间行动按钮不可重复点击。
8. 在 `EXPLORE` 阶段多次观察，确认【观察当前方向】会先显示过渡文本，再按 `bird / clue / empty` 呈现不同节奏；empty 会另起一段环境细节，clue 不追加，bird 延迟结束后仍进入原有 FIRST_ENCOUNTER / PHOTO 流程。
9. 在 `EXPLORE` 阶段多次转向和远听落地，确认顶部状态栏“周围事件”只在左右侧有可用鸟时出现提示，左右都有鸟时不会固定只出右侧，同鸟点同方向仍受冷却控制，且每次新提示都会重播一次暖色渐隐反馈。
10. 触发 FIRST_ENCOUNTER，确认未提前泄露正式鸟名。
11. 新的一天建立后确认天气先初始化一次；随后点击【开始今天的观鸟】不重新 roll，当天探索进入允许回合窗口后天气仍可最多切换一次，并通过“周围事件”提示短句反馈。
12. 进入 PHOTO，覆盖 DECISION / FOCUS / RESULT / REPOSITION / LOST。
13. 拍摄态点击【再等一等】后，顶部仍保持拍摄态；点击【放弃拍摄】或真正退出 PHOTO 后才回探索态。
14. FOCUS 拍照时确认所见即所得：可见行为状态、对焦位置、缩放、旋转写入 snapshot，且 snapshot 同时保留 `weatherKey`。
15. 成功拍照才消耗电量。
16. RESULT 页首次发送给妹妹后显示 disabled「已发给妹妹」；历史已发送照片再次拍到时不显示按钮，但会补一句「之前也给妹妹发过这张。」。
17. 加新写入 field guide，并记录正确 `cataloguedDayIndex`。
18. 笔记列表、卡牌详情、照片翻页和底部关闭按钮正常。
19. 底部导航显示【观察 / 消息 / 笔记 / 相册】四项；切换消息、笔记、相册时 overlay 互斥，返回观察后 detail panel 收起。
20. 相册空态、列表分页、卡牌级缩略项、详情页、snapshot 翻页和关闭相册正常；相册不应改变笔记鸟种页内容。
21. 相册详情发送妹妹后应与 RESULT / 笔记详情共用已发送状态，不能重复生成 Liya queue。
22. 发送照片给 Liya 后，1-2 秒到期回复；不要按旧 30 秒预期测试。
23. Liya 聊天红点、已读、分句动画、滚动恢复正常。
24. 结算页 collapsed / reveal 正常；“整理今天的观察”可手动展开且不影响问卷与继续下一天。

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
