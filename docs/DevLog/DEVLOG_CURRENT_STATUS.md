# DEVLOG_CURRENT_STATUS

更新时间：2026-06-20

本文档只记录当前版本仍然有效的事实、边界和维护提醒。历史流水账请看 `DEVLOG.md`，代码结构地图请看 `CODE_MAP.md`；不要把旧日期补充区里的历史描述直接当作当前状态。

## 2026-06-20 最新状态补充

- 当前探索 ritual 搜索 / 放大镜 overlay 已由最新本地提交重写为 CSS keyframes 驱动：`index.html` 继续保留 `#searchOverlay`、`#searchMover`、`#searchGlass` 静态宿主，`src/main.js` 的 `createSearchPlan()` 生成固定 5 个路径点并通过 CSS 变量写到 `#searchMover`，`styles/style.css` 的 `@keyframes searchMovePath` 负责多段移动，`searchGlassIdle` 负责可见期间的轻微 idle。
- 搜索 overlay 当前不再依赖旧 `searchOverlayRunId`、`activeSearchPlan`、`searchOverlayFrameId`、`searchTimerIds`、`isSearchOverlayActive`、递归 path timer、rAF 或 `is-idling` class；`syncSearchOverlayWithTransition()` 只做 guard hide，不允许在 render / sync 中自动重新 start overlay。
- `turnLeft` / `turnRight` / `observe` 的 ritual delay 仍是 UI-only 节奏包装：业务结果仍先通过 `handleExploreAction()` 落到 state，`getRitualDelay(action, state, searchPlan)` 复用 `searchPlan.totalMs`，`finishExploreRitualAction()` 在文本 render 前 hard hide 搜索 overlay、render 后再次 reset 兜底。不要把这层等待表现塞进 `gameSession.js`、存档层、消息 / 图鉴模块或 PHOTO / FOCUS / RESULT 状态机。
- 旧记录中关于搜索 overlay 仍依赖 runId / timer / rAF 回收，以及“第一次移动结束后卡住尚未修完”的描述作为历史保留，不再代表当前最新代码；但该动画仍建议继续做浏览器手动 QA，尤其是连续多次探索行动、打开底部 overlay 和进入 FIRST_ENCOUNTER / PHOTO / SETTLEMENT 后的残留检查。
- `Action Zone` 当前不是简单的单按钮壳层，而是由 `src/main.js` 在默认主操作外再包一层摇杆式输入层：`START`、`EXPLORE`、`FIRST_ENCOUNTER` 以及 `PHOTO DECISION / FOCUS / RESULT / REPOSITION / LOST` 会显示摇杆壳体；释放后仍统一走 `handleActionControlClick()` 和既有 `data-action` / `data-type` 分发，不新增业务 action。
- `shouldRenderJoystickShell()` 与 `getJoystickInputMode()` 当前是刻意拆开的两层判断：前者决定支持状态下是否继续显示摇杆壳体，后者决定当前能否拖拽输入。overlay 打开、tester profile 提示出现、主按钮 disabled 或探索态 ritual delay 期间，应保留 disabled 摇杆壳层而不是回退旧底栏布局；不要在后续清理时把两者重新并回同一个布尔开关。
- 主叙事后的 inline choices 当前可通过 `data-joystick-zone` 与摇杆方向联动高亮；`clearJoystickVisualState()` / `resetJoystickInputState()` 是导引线、pressed 状态、inline choice 高亮和 `body.is-dragging-joystick` 的统一回收入口。后续若继续调摇杆拖拽或视觉态，优先沿这条清理路径收口，不要在多处零散补 class。
- `Action Zone` 当前的导引线与残留横线防回归依赖样式约束：导引线只应在 `.action-panel.is-joystick-active` 时出现，`.joystick-handle` 需要继续屏蔽旧按钮伪元素与 generic `:active` / `border-bottom` 链路。不要仅靠 `.is-joystick-four-way` 或 `.is-joystick-vertical` 决定可见性，也不要把普通按钮按压样式重新漏到摇杆句柄上。
- 上述摇杆层只改输入壳层和视觉反馈，不改变探索 action、PHOTO / FOCUS / RESULT 状态机、field guide / collectedCards / snapshots、LocalStorage key 或 Liya queue 语义。

## 2026-06-19 最新状态补充

- `index.html` 当前主壳层是固定手机容器：`main.page.app-shell` 内部依次承载 `scene-bg`、`app-hud`、`app-event-strip`、`app-main-panel`、`app-content-area` 和 `app-action-zone`。桌面端壳体宽高锁定为 `390px × 844px` 并居中；移动端只在 `@media (max-width: 430px)` 下切到 `100vw × 100svh`。不要再用 `max-height` 条件把桌面低高窗口误判成移动端。
- `bottom-nav-host` 与 `tool-overlay-host` 当前虽然仍使用 `position: fixed`，但桌面态宽度受 `--app-width` 约束并与手机壳居中对齐；overlay 打开后也应限制在壳体宽度内，不应跟随浏览器宽度无限拉伸。
- `src/ui/toolOverlayShell.js` 当前负责 messages / fieldGuide / album 共用的 overlay 壳层，输出带返回按钮、标题栏和 scrim 的整壳层阅读面板；`activeOverlay` 的互斥语义不变，bottom nav 仍保留在 overlay 下方可见，不要把该壳层误改回底部抽屉式 sheet。
- 玩家主界面当前默认继续隐藏 legacy `status-grid` 与旧“周边环境”地图块：`START`、`EXPLORE`、`FIRST_ENCOUNTER` 以及 `PHOTO` 的 `DECISION / RESULT / REPOSITION / LOST` 都走 UI-only 收口，`PHOTO / FOCUS` 和 `SETTLEMENT` 仍保守排除在外。不要因为这些区块在 DOM 中仍存在，就误判它们是当前主界面应常驻显示的内容。
- `renderActions()` 当前已分成两层：`Action Zone` 只保留一个默认主操作按钮；`EXPLORE`、`FIRST_ENCOUNTER`、`PHOTO DECISION / RESULT / REPOSITION / LOST` 的其余行动通过 `#inlineChoicePanel` 跟随在主叙事文本后方，渲染为轻量文本选项。`DISTANT_LISTEN`、`SPOT_SELECT`、`SETTLEMENT` 仍保守保留既有按钮布局，不要把这套 inline choice 规则误套到所有状态。
- 主按钮与叙事层选项当前共用 `handleActionControlClick()` 和既有 `data-action` / `data-type` 分发；探索态 ritual delay、PHOTO action、RESULT 发妹妹、focus exit 动画与 analytics / survey 时序都没有因为这次 UI Shell 调整而改语义。后续若继续调 Action Zone 或 inline choices，只能改渲染位置和壳层样式，不要顺手改业务 action。

## 2026-06-18 最新状态补充

- 当前底部主导航由 `src/ui/bottomNav.js` 渲染为【观察 / 消息 / 笔记 / 相册】四项；相册是主游戏运行时 overlay，不是离线工具，也不是 `message-editor.html` 的一部分。
- `activeOverlay` 当前支持 `messages`、`fieldGuide`、`album`、`resetSaveConfirm` 与空值；`album` 使用独立的 `albumDetailCardId`、`albumDetailSnapshotIndex`、`albumPageIndex`，不要复用笔记详情的 `fieldGuideDetailCardId` / `fieldGuideDetailSnapshotIndex` 保存相册状态。
- 相册数据只读取既有 `fieldGuide.collectedCards` 与 snapshots，列表以 collected card 为单位展示，不把每张 snapshot 拆成新的持久化实体；本轮没有新增或修改 field guide key、collected card schema、snapshot schema 或 LocalStorage key。
- 相册详情复用既有卡牌详情、拍立得照片和发送妹妹链路；是否已发给妹妹以 collected card 上的 `sentToSister === true` 或 `liyaMessageQueueItem` 为准，不应新增 `albumSentToSister`、第二套 queue 或新的 Liya 已读语义。
- 笔记页当前仍是按鸟种翻页的观察笔记，不是照片相册；不要把相册缩略卡、相册分页或相册发送按钮重新塞回笔记鸟种页。

## 2026-06-16 最新状态补充

- `src/main.js` 当前为探索态三项主动作额外包了一层“动作仪式感”过渡：只对 `turnLeft`、`turnRight`、`observe` 先执行业务逻辑、再按结果延迟 render，并在过渡期间通过 `isActionTransitioning` 与 `.action-panel.is-transitioning` 禁止重复点击。`listenDistant`、PHOTO / FOCUS / RESULT、顶部拍摄态判断和 overlay 按钮不应误接入这层延迟。
- 当前探索动作的延迟时长依赖结果语义而不是固定等待：转向是短停顿；observe 会根据 `src/encounterSystem.js` 返回的 `type = bird / clue / empty` 选择不同 delay，其中 clue 最长、bird 最短。后续若要继续调节节奏，应优先改 `src/main.js` 的 ritual delay helper，不要把等待写进 `gameSession.js` 或 `encounterSystem.js` 里。
- `observeCurrentDirection()` 当前除 `found / bird / message` 外，还会返回 `type`；`src/gameSession.js` 会把该结果写入运行时 `lastObserveResultType`，并在 empty 时为 `eventText` 追加当前鸟点 × 朝向的环境细节。该字段只服务当前探索态 UI 节奏，不是存档结构，也不应扩展成 PHOTO / 远听 / 结算共用状态。
- `data/spots.js` 当前允许每个鸟点配置可选 `ambientDetails[directionIndex]` 文本池，`src/spotManager.js` 通过 `getRandomAmbientDetail()` 安全读取；缺少配置时必须 fallback 为空字符串，不能报错，也不要因为未来新增鸟点未补 ambient details 就阻断探索流程。
- 空观察追加的环境细节当前只属于当下阅读体验，不应写入观察日志；`gameState.logs` 仍只记录主结果句，避免把蜘蛛网、羽毛、水面涟漪这类方向细节误当成正式行动记录或持久化内容。
- 旧记录中关于“探索详情区下方独立 `observation-map-panel` 承载主界面周边地图”和“位置卡显示 `当前鸟点 · 当前面向`”的描述已不再代表当前版本。当前探索态右侧顶部状态块会直接渲染小地图，标题显示 `当前鸟点 · 周边环境`，左侧位置卡只显示当前鸟点名称；该地图仍只反映 `facingDirection`，不反向驱动方向、天气或事件判断。
- 探索态顶部小地图当前是极简样式：统一使用与拍摄态取景器相近的浅底色表面，移除旧内层深色渐变框、标签胶囊和中心竖胶囊，只保留四向文字、中心十字和正前方向标签强调；后续样式调整不应改动旋转步进、文字正向逻辑或 `currentSpot.directions` 数据来源。
- 顶部是否显示拍摄态不再依赖 `photoPhase !== "DECISION"` 一类阶段判断，而是依赖 `src/main.js` 中的运行时语义 `isCameraRaisedForTopUi` 与离场动画状态：看到鸟但还没举起相机时仍保持探索态，【再等一等】、`REPOSITION` 等返回非 FOCUS 子阶段时只要相机未放下，顶部仍保持拍摄态；只有退出 PHOTO、进入下一天、重开或重置时才回探索态。
- 主界面当前默认隐藏【观察区域】、【观察日志】、主界面额外【拍照时机】和玩家可见的【选择初始鸟点】；`detailPanel` 在默认探索态、PHOTO 和隐藏起点选择态下直接收起，`.log-panel` 也默认隐藏。不要把这些旧块误当成当前主界面仍应显示的信息层。
- `START_SPOT_SELECT`、`getStartSpotChoices()` 和 `startGameAtSpot()` 当前仍保留在代码中，但玩家从 START 点击【开始今天的观鸟】后会由 `src/main.js` 直接选取首个可用 start spot 进入默认地点，不再展示起点选择列表。后续不要在没有独立任务的情况下删除这些 helper，也不要误判“起点选择 UI 仍是当前正式入口”。

## 2026-06-12 最新状态补充

- 旧记录中关于独立 `#eventHint` 提示条和独立“方向”状态格的描述已不再代表当前版本。当前事件提示已并入顶部状态栏“周围事件”卡片，当前位置卡显示为 `当前鸟点 · 当前面向`，`index.html` 不再保留 `.status-grid` 与 `.event-box` 之间的独立提示节点，也不再保留 `#directionText`。
- `src/eventSystem.js` 当前是显示状态驱动的轻量系统：维护 active entry、队列、`spotId + dirIndex` 冷却和 `activePulseKey`，`scanSideEvents(state)` 在左右两侧候选中随机选取可触发方向；该系统不替代 `#eventText` 主事件描述，只向状态栏“周围事件”槽位提供短时文本。
- 顶部“周围事件”卡片当前的颜色反馈分为两层：`is-event-active` 只表示当前有短时提示文本，真正的暖色褪回默认效果由 `.status-mode.is-event-pulse::after` 的一次性 overlay 动画承担；`src/main.js` 通过 `getActivePulseKey()` 重播 pulse，但不改变事件文本生命周期、队列或 cooldown。
- 探索详情区当前使用独立 `observation-map-panel` 显示“周边地图”，不并入顶部 status-grid。该地图复用 `currentSpot.directions` 的四向文案，盘面随 `facingDirection` 以 90 度步进旋转，地点文字反向旋转保持正向，视觉分布为上下更近、左右更远；它只反映当前面向，不参与真实方向判断或事件计算。
- `src/weatherSystem.js` 当前已接入运行时，`gameState.weather` 维护 `current / switched / initializedForDay`；`startGameAtSpot()` 的 `initForSession()` 对同一天幂等，点击【开始今天的观鸟】不会重新 roll 天气，也不会把当天初始天气当成 `WEATHER_CHANGE` 提示。
- `advanceTurn()` 才会在允许回合窗口内调用 `weatherSystem.trySwitch()`；同一天内天气最多切换一次，局内天气变化通过同一个“周围事件”状态位提示，`SETTLEMENT` 不触发切换，照片 snapshot 会保留 `weatherKey`。
- RESULT 页当前已接入一键发妹妹 UI：本次刚发送显示 disabled「已发给妹妹」按钮；历史已发送照片再次拍到时不再显示按钮，但会在 RESULT 描述末尾补一句「之前也给妹妹发过这张。」；该状态复用现有 collected card 与 `liyaMessageQueueItem` 语义，不新增 LocalStorage key。
- `SETTLEMENT` 当前除“今天的收获”和继续动作外，还支持手动展开“整理今天的观察”区块；`gameState.nightReviewStats.sentToSisterCount` 只用于本局夜晚整理文案，不改变 Liya queue、问卷 flush、进入下一天或其他持久化语义。

## 2026-06-11 最新状态补充

- 当前 `EXPLORE` 阶段的轻量事件提示由顶部状态栏“周围事件”卡片承载，只显示“左侧 / 右侧有鸟类活动”的短时环境信息；它不替代 `#eventText` 主事件描述，也不参与消息、笔记、PHOTO / FOCUS / RESULT 或结算 UI。
- `src/eventSystem.js` 当前负责事件提示的文案池、队列、显隐定时器、同鸟点同方向冷却与左右候选选择；当左右两侧同时可触发时，必须在可用候选中随机选择，不能固定优先右侧或左侧。
- 事件提示目前只应在 `EXPLORE` 阶段由 `src/gameSession.js` 在转向后和远听落地后触发扫描；同一 `spotId + dirIndex` 仍保留冷却，左右都没有可用鸟时不应显示提示。
- `data/config.js` 当前新增 `EVENT_HINT_COOLDOWN_TURNS`、`EVENT_HINT_DISPLAY_MS`、`EVENT_HINT_FLASH_MS`、`EVENT_HINT_QUEUE_MAX` 四个提示参数；`data/species.js` 当前可选提供 `hintType` 元数据，但提示文案仍不应泄露正式鸟名。
- `src/main.js` 在这一块当前负责初始化、注入、状态栏渲染以及在开新局 / 下一天 / 重置时清理事件提示状态；这不代表 `main.js` 已把更多主流程迁出，也不应借此顺手改动 analytics、survey、消息队列、图鉴存档或 PHOTO / FOCUS / RESULT 状态机。

## 1. 当前总体状态

- 项目仍是 vanilla HTML/CSS/JS 网页游戏，入口为 `index.html` 加载 `src/main.js`。
- `src/main.js` 仍是运行时编排中心，负责初始化、数据加载、主状态流转、PHOTO / FOCUS / RESULT 渲染与事件分发；不能视为已经完全模块化。
- 已完成低风险拆分的模块包括 `src/utils/dom.js`、`src/utils/format.js`、`src/utils/config.js`、`src/core/saveManager.js`、`src/core/telemetryAdapter.js`，以及 UI 辅助模块 `src/ui/messagePanel.js`、`src/ui/fieldGuidePanel.js`、`src/ui/bottomNav.js`。
- `message-editor.html` 是三测前维护 `data/liyaMessages.json` 的独立内存编辑器，不写入项目文件、不写入 LocalStorage、不接入主游戏流程。
- `docs/design/DATA_SCHEMA_PLAN.md`、`docs/design/EDITOR_WORKBENCH_PLAN.md` 是设计规划，不代表运行时代码或数据结构已经实装。

## 2. 入口与配置

- `index.html` 当前只通过 `<script type="module" src="./src/main.js"></script>` 启动主游戏，`data/config.js` 通过模块 import 链路读取，不是单独 script 标签。
- `data/config.js` 中 `PLAYTEST_CONFIG` 当前默认关闭：`analyticsEnabled: false`、`surveyEnabled: false`、`openingSurveyEnabled: false`、`settlementSurveyEnabled: false`。
- Playtest 配置读取应优先使用 `src/utils/config.js` 中的 helper，不要在新代码里散落直接读取配置对象。
- 当前问卷版本为 `playtest2_driving_force_v1`。

## 3. Analytics / CloudBase / Survey

- analytics 运行时底层仍在 `src/analytics.js`，`src/core/telemetryAdapter.js` 只是适配层；不要写成 analytics runtime counters 已经完全迁移到 adapter。
- 默认 main 包不应发送 analytics，也不应显示 opening / settlement survey；需要通过 `PLAYTEST_CONFIG` 显式开启。
- CloudBase ingest 本地源码目录为 `cloudfunctions/analytics_ingest/`，线上函数名历史上使用 `analytics-ingest`，两者命名不一致是已知部署边界。
- 当前数据库集合使用 `analytics_payloads2`；后续查询、导出、看板不要继续基于旧的 `analytics_payloads`。
- Cloud function 当前使用普通服务端时间 `new Date()` 写入 `server_ts`，不要恢复为已出现兼容问题的 `command.serverDate()`。
- `Q0 / Q-pre` 测试者身份入口写入 `birdwatch_text_sim_tester_profile`，字段包括 `tester_id`、`tester_level`、`tester_level_text`、`updated_at`；该 profile 不进入 field guide 存档。
- 局后问卷一次性 gate 当前使用 `birdwatch_playtest2_driving_survey_done`；`birdwatch_text_sim_post_survey_status` 是历史兼容状态，代码中已标为 deprecated candidate。
- 局后问卷 payload 当前不应恢复旧的嵌套 `answers` 包装；提交或跳过后再 flush，避免进入 `SETTLEMENT` 时立刻 finalize 导致 survey 丢失。
- 局后问卷落库的提交 / 跳过路径仍建议继续做实机复核，尤其是 `has_survey`、`survey_submitted`、`survey_skipped` 与 `payload.survey` 字段。

## 4. LocalStorage 当前边界

- 正式图鉴 / 笔记存档当前 key 为 `birdwatch_text_sim_field_guide_v3`，`birdwatch_text_sim_field_guide_v2` 只作为迁移来源保留。
- 观察日标题使用独立 key `birdwatch_text_sim_day_index`，由 `src/core/saveManager.js` 读写；不要绑到局内回合、时间段、照片数量或面板开关。
- analytics / playtest 相关 key 包括 `birdwatch_text_sim_tester_uuid`、`birdwatch_text_sim_tester_profile`、`birdwatch_text_sim_analytics_retry`、`birdwatch_text_sim_session_index`、`birdwatch_playtest2_driving_survey_done`。
- `resetSave({ clearGameProgress: true })` 不应默认清除 tester profile / tester uuid，除非明确进入测试数据清理任务。
- 不要改 field guide 存档 key、snapshot 结构、图鉴已读语义或自动加新字段，除非单独设计迁移。

## 5. PHOTO / FOCUS / RESULT 主流程

- PHOTO / FOCUS / RESULT 仍由 `src/main.js` 与 `src/gameSession.js` 主链路维护；近期文档整理、工程拆分和编辑器规划都不代表该状态机已迁移。
- 不要修改拍照概率、稀有度逻辑、行为状态到卡牌抽取权重、对焦判定或所见即所得规则。
- `behaviorState` 与 `card.rarity` 是不同概念：前者影响拍摄时机 / 抽卡权重，后者影响实际卡牌品质显示。
- `PRECIOUS` 已有显示和结构预留，但普通流程是否生成必须以当前代码为准；不要把珍贵卡规划写成当前已完整上线。
- 事件文本和 UI reveal 的动画生命周期不要依赖每次 render 强制重播；二次 render、动画 cleanup、badge 离场不应改变业务语义。
- RESULT 页当前已接入发送给妹妹的 UI 分支：未发送条目显示正常发送按钮，本次刚发送显示 disabled「已发给妹妹」，历史已发送条目再次拍到时不再显示按钮而改为补充说明文案；不要把这个 UI 状态判断误并到 PHOTO / FOCUS / RESULT 主状态机里。

## 6. 图鉴 / 笔记 / 自动加新

- field guide 标准存档由 `src/storage.js` normalize，当前 v3 entry 会保留 collected card、species record、snapshot、Liya reply 与 sister knowledge 相关字段。
- `speciesRecords` 当前记录 `cataloguedDayIndex`，UI 显示“加新于第 N 天”；缺失该字段的旧存档 fallback 为第 1 天。
- 不要把“加新于”改回读取当前标题 dayIndex，也不要删除 `cataloguedRealTimestamp`、`autoCataloguedAt` 等现实时间字段。
- `pendingAutoCatalogue`、`markAutoCatalogueCompleted()` 与 `cataloguedDayIndex` 的语义仍属于图鉴 / 自动加新链路，不应由 Liya 消息系统接管。
- 图鉴入口当前使用分页图鉴，不要恢复旧的竖向全量图鉴列表。

## 7. Liya 消息系统

- 聊天运行时文本源为 `data/liyaMessages.json`；图鉴 / 手册里的“妹妹补充”仍来自 `data/sisterKnowledge.js` 与 collected card entry 中的 sister knowledge 字段。
- `src/liyaMessageSystem.js` 负责消息标准化、校验、conditions 匹配、priority / specificity 排序和稳定伪随机选择。
- `photo_reply` queue item 当前挂在 collected card entry 上，不是全局 pending queue；一张发给妹妹的 card 最多对应一条 `liyaMessageQueueItem`。
- 发给妹妹后的回复延迟当前为 1-2 秒随机延迟，旧记录中固定 30 秒延迟只作为历史保留。
- RESULT 页与图鉴详情页当前共用既有发送链路和 queue item 语义；不要为 RESULT 再引入第二套 sent 状态字段、重复 queue 或新的存档 key。
- 红点当前优先依据 queue / due / read 语义判断，旧字段 fallback 仍用于兼容旧存档；不要直接删除旧字段。
- 打开消息列表不等于全部已读；进入 Liya 聊天且到期回复真实可见后才应写入已读。
- `src/ui/messagePanel.js` 当前承接消息面板渲染、滚动锚点恢复、逐行动画 timer 清理、可见性判断等 UI 辅助；业务状态和存档结构仍不在该模块内。
- 当前未实现主动消息、不回复追问、全局 pending queue、上课 / 补习状态机、storyStage 推进和多联系人动态消息体系。

## 8. message-editor 当前边界

- `message-editor.html` 当前支持粘贴导入、编辑、实时校验、新增、复制、删除、导出 JSON 等内存工作流。
- 编辑器页面明确不写入本地文件、不写入 LocalStorage、不接入主游戏流程；导出的 JSON 仍需人工接入 `data/liyaMessages.json`。
- 不要把 message-editor 写成已经集成发布系统、编辑器工作台或主游戏内容管理后台。
- 如需继续做编辑器工程化，应先以 `docs/design/EDITOR_WORKBENCH_PLAN.md` 为规划依据，再单独实施。

## 9. UI 当前状态与维护边界

- 开局独白、首次遇见、普通事件文本和结算 reveal 的具体动画只影响展示，不改变鸟种识别、正式鸟名泄露边界或事件语义。
- 顶部状态栏“周围事件”当前承载轻量环境提示和天气变化短句；它不是独立 DOM 条，也不要把它扩展成正式事件描述、剧情提示或鸟名揭示入口。
- 顶部状态栏“天气”当前直接读取 `weatherSystem.getCurrentLabel(state)`；开始当天观鸟只应读取已初始化天气，不应在 UI 渲染层重新 roll 天气。
- 顶部工具按钮的 new / unread 标记应由实际图鉴新卡或 Liya 未读状态驱动，不要因按钮 active 状态误清。
- 聊天滚动恢复依赖 `messagePanel.js` 的锚点和容器滚动状态；不要退回只按 `scrollTop` 或距底距离恢复。
- 手册空态、鸟种列表页和卡牌详情页底部“关闭手册”复用 `data-action="fieldGuide"`，不要新增第二套关闭状态。
- `eventHtml` 只能用于内部生成的安全 HTML，不要直接拼接用户输入或外部数据。

## 10. 工程拆分当前边界

- `src/core/saveManager.js` 当前只封装部分 LocalStorage helper、观察日 key 和 driving survey done key，不是所有存档的唯一入口。
- `src/core/telemetryAdapter.js` 当前只封装 telemetry 调用入口，不代表 `src/analytics.js` 可删除。
- `src/utils/dom.js` 当前包含 HTML / 正则转义等小工具；`src/utils/format.js` 包含时间段、mode、卡牌标题描述、图鉴时间等格式化 helper。
- `src/ui/fieldGuidePanel.js` 只承接图鉴 UI HTML 片段，不接管 `src/fieldGuide.js` 的业务状态和存档规范。
- 后续拆分 `main.js` 时必须保持行为不变，尤其不要同轮修改 PHOTO / FOCUS / RESULT、消息队列、图鉴存档和 analytics payload。

## 11. 设计规划文档当前状态

- `docs/design/DATA_SCHEMA_PLAN.md` 是三测和后续编辑器工作台的数据结构规划，不生成实际 JSON，也不代表 data 目录已按这些 schema 改造。
- `docs/design/EDITOR_WORKBENCH_PLAN.md` 是编辑器工作台规划，不代表存在正式 `src/editor/*` runtime 模块或主游戏入口。
- 发布系统、posts、postComments、accountProgress 等仍是未来规划；不能写成已上线功能，也不能让点赞 / 粉丝成为当前核心数值系统。

## 12. 当前不要误改

- 不要修改 PHOTO / FOCUS / RESULT 流程、拍照概率、稀有度、对焦判定、所见即所得或自动加新。
- 不要把事件提示改成固定某一侧优先、无方向笼统提示，或借提示直接泄露正式鸟名；同鸟点同方向冷却仍应保留。
- 不要修改 `data/liyaMessages.json`、`data/sisterKnowledge.js`、图鉴 v3 存档结构或 LocalStorage key，除非任务明确要求并包含迁移策略。
- 不要恢复旧的固定 30 秒 Liya 回复描述，也不要恢复局后问卷 `Q1-Q11` / 嵌套 `answers` 的旧说法。
- 不要把文档规划写成代码现状；不确定内容标记为“待复核 / 历史遗留需复核”。
- 不要把 `message-editor.html` 接入主游戏、自动写回项目文件或写入浏览器存储。

## 13. 待复核事项

- 局后问卷提交与跳过两条路径的线上落库结果仍建议复核，确认 survey 字段、session_end 事件和连续两局 survey 不串。
- Liya 多行逐条动画、最后一行 mark read 后的聊天滚动恢复仍属于需要人工回归的高敏感路径。
- 历史记录里关于旧问卷版本、固定 30 秒回复、未创建模块的计划描述已经不代表当前版本，后续引用前需按代码复核。
