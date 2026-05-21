# DEVLOG_CURRENT_STATUS

## 2026-05-21 最新状态补充

以下为当前最新状态；旧记录中关于 `DECISION / REPOSITION / LOST` 仍显示 `[空]`、`RESULT` 中“继续跟焦”需等拍立得快速收起后才执行 refocus、FIELD_GUIDE 顶部始终显示“开始游戏 / 返回”、图鉴 `collectedCards` 仍是单数 `snapshot`、主合焦框视觉大小只由 `CAMERA_FOCUS_CONFIG` 决定的描述作为历史状态保留，不再代表当前版本。

### 当前 UI / 动效事实

- 事件描述标题当前为视觉隐藏的可访问性标题；事件正文仍保留原 `#eventText`、`aria-live` 和 reveal key 机制。普通事件文本 reveal 只在 `mode + photoPhase + eventText/eventHtml` 语义变化时播放，同一份文本的二次 render 不应重播。
- 拍摄时机空状态当前不显示 `[空]` 文案；非 FOCUS / 非 RESULT 的空状态显示浅色静态四角取景框，不启动 FOCUS rAF、不显示 moving badge、不改变对焦判定。
- 主界面对焦框当前使用 `main.js` 中的固定 4:3 基准 `FOCUS_FRAME_VISUAL_SIZE = 40 x 30`，所有取景框 / 拍立得 / 图鉴详情里的 frame 都以同一基准居中渲染，小容器下等比缩小；不要恢复百分比宽度、中心十字、中心点或用 CSS margin 修正判定。
- FOCUS 绿色状态和按快门采样当前由 `main.js` 按实际渲染 frame 尺寸换算 normalized 命中框；徽章的 `finalScale` / `badgeRotation` 只影响视觉 transform，不参与命中框、focusScore 或所见即所得 rarity。
- FOCUS moving badge 当前包含距离缩放、每轮 FOCUS runtime 随机缩放和轨迹旋转：`distance` 来自 bird 实例生命周期，`randomScale` 只存在于当前 FOCUS 窗口，`finalScale` / `badgeRotation` 会写入 snapshot 并用于拍立得回放。
- FOCUS moving badge 仍然使用焦内行为状态色；鸟种 `colorPalette` 只用于按下快门后的动画拍立得和图鉴详情静态拍立得，不应覆盖 NORMAL / INTERESTING / REMARKABLE 的玩法信号。
- `RESULT` 阶段“继续跟焦”当前是非阻塞式：如果上一张拍立得仍在画面中，UI 只启动 `startActivePolaroidDismiss()` 让其独立滑走并自清理；`refocus` action 会立即分发并进入下一轮 `PHOTO / FOCUS`，新一轮 FOCUS 的入场安全延迟照常开始。
- 拍立得 overlay root 和 shot 均为 `pointer-events: none`；退场 cleanup 只移除自身 DOM / timer，不触发整页 render，不应造成事件描述 reveal 重播。
- 动画拍立得 `.focus-polaroid-*` 与图鉴详情静态拍立得 `.field-guide-detail-*` 当前都按 `snapshot.focusGrade` 显示照片质量：badge 毛玻璃化，并按“数毛 / 清晰 / 尚可 / 失焦”四档只模糊 badge 本体；`数毛` 皇冠显示在整张拍立得右上角，不在 badge 内。对焦框四角和日期不参与模糊。
- 动画拍立得和图鉴详情静态拍立得当前还会回放 `snapshot.finalScale`、`snapshot.badgeRotation`、`snapshot.splitStop` 与鸟种 `colorPalette`；旧 snapshot 缺少这些字段时 UI 必须 fallback 到 `1 / 0 / palette.splitStop` 或默认样式。
- FIELD_GUIDE 的 action 区按钮按进入上下文渲染：从 `START` 或无 `previousMode` 进入时显示“开始游戏”；从 EXPLORE / PHOTO 等游戏中状态进入时不显示“开始游戏”，只显示默认次级样式的“返回”并回到 `previousMode`。卡牌详情内“返回图鉴”仍是 `button-ghost`。
- 图鉴“为它加新”后的 CATALOGUED 内容 reveal 由临时 UI 状态 `recentlyCataloguedSpeciesId` 控制，只在刚加新的当前鸟种页播放一次；普通打开图鉴、翻页、返回图鉴、进入或退出卡牌详情不应重播该 reveal。
- FIRST_ENCOUNTER 详情面板当前展示 `species.nickname` 作为临时称呼，fallback 为“这只鸟”；事件文本中的外观描述优先读取 `species.firstEncounterAppearance`，避免未加新阶段泄露正式鸟名，fallback 到 `species.appearance` 时保持容错。
- 图鉴卡牌详情当前可在同一 cardId 的多张 `snapshots` 间切换；`fieldGuideDetailSnapshotIndex` 是纯 UI 临时状态，不写入 LocalStorage，切换照片时拍立得、对焦精度、日期、地点等 snapshot meta 都应跟随当前 index 刷新。

### 当前边界补充

- 不要把拍立得质量视觉反馈写回 snapshot、fieldGuide 或 LocalStorage；`getPolaroidFocusGradeClass()` 和 `shouldShowPolaroidCrown()` 只用于 UI class / 皇冠显示。
- 不要把 FIELD_GUIDE 中从游戏内进入的“返回”改成开始新局入口；返回应恢复进入图鉴前的 mode，不推进回合、不触发观察、不重置游戏。
- 周边地图仍使用 CSS Grid；节点不显示方括号，竖向连接字符使用空白占位保留空间，不要恢复 `<pre>` 文本地图。
- FIELD_GUIDE 仍沿用 `birdwatch_text_sim_field_guide_v3` LocalStorage key，但当前标准 entry 已是 `{ cardId, snapshots, isIdentified }`；旧 `{ cardId, snapshot }` 只在 normalize / migration 中读取，不要恢复“同卡只保留一张照片”的覆盖逻辑。
- 当前 snapshot 契约在原有拍摄字段上包含 `distance`、`finalScale`、`badgeRotation`，split scheme 照片可包含 `splitStop`；solid / dot-pattern 不应依赖或持久化无效 splitStop，旧照片缺字段必须继续正常回放。

## 2026-05-20 最新状态补充

以下为当前最新状态；旧记录中关于 v2 图鉴、完整物种列表图鉴、未接 snapshot、拍立得未实现、对焦框视觉吸附等描述均作为历史状态保留，不再代表当前版本。

### 今日最终采用的核心变化

- `data/cards.js` 当前为 6 种鸟、36 张正式测试卡牌：`kingfisher`、`sparrow`、`red_billed_magpie`、`mandarin_duck`、`blackbird`、`night_heron` 每种鸟 6 张卡，结构固定为 3 `NORMAL`、2 `INTERESTING`、1 `REMARKABLE`；本轮无 `PRECIOUS` 卡。
- FIELD_GUIDE 存档已升级到 v3，当前 key 为 `birdwatch_text_sim_field_guide_v3`；v2 key `birdwatch_text_sim_field_guide_v2` 保留，不删除旧数据。
- v3 `fieldGuide` 标准结构为：
  - `heardSpeciesIds: string[]`
  - `seenSpeciesIds: string[]`
  - `cataloguedSpeciesIds: string[]`
  - `collectedCards: { cardId: string, snapshot: object | null }[]`
  - `discoveryOrder: string[]`
- `loadFieldGuide()` 当前读取顺序为：优先读 v3；不存在则读 v2、迁移为 v3 并写入 v3；v2 也不存在则返回 v3 空结构。保存只写 v3，不写回 v2。
- v2 -> v3 迁移会把旧 `collectedCards: string[]` 转成 `{ cardId, snapshot: null }[]`，并应用卡牌 id 重映射表；夜鹭交换式迁移使用旧 id -> 新 id 的批处理生成方式，避免原地覆盖。
- `markSeen()` 会同步维护 `discoveryOrder`；`markCatalogued()` 会容错补齐 `seenSpeciesIds` 和 `discoveryOrder`；`addCard(fieldGuide, cardData, snapshot = null)` 支持 v3 upsert，同 cardId 保留更高 `focusScore` 的 snapshot。
- PHOTO / FOCUS 按下快门时已生成 `photo.snapshot`，字段为 `turn / turnMax / spotId / batteryRemaining / batteryMax / focusAffix / badgeRelX / badgeRelY / capturedState / focusScore / focusGrade / realTimestamp`。
- snapshot 采样边界：DOM 坐标只在 `main.js` shoot 分发前读取 `.focus-playfield` 和 `.focus-moving-badge`；`gameSession.js` 不访问 DOM，只接收 payload 并在缺失时 fallback。
- 拍照后拍立得动画已接入：`showPolaroidShot(photo)` 使用 `photo.card` 与 `photo.snapshot` 创建临时视觉 DOM，挂载到 body 下稳定 overlay root，定位覆盖原 `.focus-playfield`，不再被 RESULT render 提前销毁。
- 拍立得动画当前时序：停留 `POLAROID_HOLD_MS = 1000`，滑出 `POLAROID_SLIDE_MS = 500`；普通模式右滑淡出，reduced motion 下保留 180ms 低刺激淡出。
- `RESULT` 阶段点击“继续跟焦”时，如果上一张拍立得仍在画面中，会先播放 `POLAROID_QUICK_DISMISS_MS = 240` 的快速收起动画，再执行原 `refocus`；该动画只属于 UI 层，不重复生成照片、不消耗电量。
- 主界面“拍摄时机”对焦框当前是固定居中的 4:3 四角 L 型框，无中心十字或中心点；`FOCUS` 显示 moving badge，`RESULT` 显示静态框，`DECISION / REPOSITION / LOST` 仍按既有规则显示 `[空]`。
- 对焦框视觉吸附已移除：不再根据 moving badge 偏移 `.focus-frame`，不再维护 offset / lerp / magnet 状态；视觉框与 `focusEngine` 中心判定重新一致。合焦成功仍通过 `.focus-frame.is-green` 使用旧绿色，未合焦保持灰白。
- FOCUS 阶段“按下快门”按钮当前有专用快门式样，仅改变视觉，不改变 action、可用性判断、拍照判定或电量消耗。
- 事件描述当前有轻量 reveal 机制，使用 `lastEventTextRevealKey` 避免同一事件文本因二次 render 重复播放动画；FIRST_ENCOUNTER 新鸟文本按中文句号分段，并逐段淡入上移显示，最终不使用逐字打字机效果。
- FIELD_GUIDE 当前已改为 discoveryOrder 私人记录图鉴：
  - HEARD 不进入图鉴。
  - 空图鉴显示“图鉴还是空白的。去野外，遇见你的第一只鸟。”，不暴露总数。
  - SEEN 页显示“？？？”、一次“已发现，但还不知道它的名字。”、appearance 和“为它加新”按钮，不显示卡牌区。
  - CATALOGUED 页显示正式鸟名、appearance、“已收集 X 张”和已收集卡牌；未获得卡不显示，不显示 `X / Y`。
  - 页签数量等于 `discoveryOrder.length`，翻页基于已发现鸟种数量。
- FIELD_GUIDE 查看页当前按钮排列为：顶部 action 区显示“开始游戏 / 返回”，图鉴内容块在其下方，“清空图鉴”位于图鉴内容底部且弱化显示；按钮功能不变。
- CATALOGUED 页已收集卡可点击进入 detailPanel 内部“卡牌详情伪模态”，不创建全屏 modal、不 append 到 body、不改变路由。
- 卡牌详情当前结构为：返回图鉴 -> 卡牌信息 -> 拍摄上下文 -> 静态拍立得。返回后保留原 `fieldGuideSpeciesIndex`，只清空页面级 `fieldGuideDetailCardId`。
- 卡牌详情静态拍立得使用独立 `.field-guide-detail-*` 样式，不触发拍照阶段动画；badge 文本来自 `card.title`，位置来自 `snapshot.badgeRelX / badgeRelY`，日期来自 `snapshot.realTimestamp`，对焦框颜色来自 `snapshot.focusAffix`。
- snapshot 为 null 的旧迁移卡详情会显示“本卡无拍摄记录”，卡牌标题、描述、稀有度仍正常，拍摄回合、地点、电量、对焦精度均显示 `—`。

### 当前关键边界

- 不要再把 FIELD_GUIDE 当作完整物种清单渲染；当前只从 `fieldGuide.discoveryOrder` 生成页面。
- 不要在 SEEN 页显示卡牌区，即使该 speciesId 已经拍到卡。
- 不要恢复主界面对焦框吸附跟随；判定和视觉都以中心固定框为准。
- 不要修改 `photo.snapshot` 字段名或 v3 LocalStorage 结构，后续功能应兼容 snapshot 为 null 的迁移旧卡。
- 拍立得动画与图鉴详情静态拍立得是两套 DOM / CSS：拍照阶段使用 `.focus-polaroid-*`，图鉴详情使用 `.field-guide-detail-*`。
- 当前环境仍不要运行 npm、node、python、浏览器或本地服务器。

## 2026-05-18 最新状态补充

以下为当前最新状态；旧记录中关于“SD 卡”、5 种旧鸟、加权抽卡、未接 focusAffix 的描述已作为历史状态保留，不再代表当前版本。

### 今日完成的核心变化

- PHOTO / FOCUS 已接入焦内序列：进入 FOCUS 时生成 `currentFocusSequence`，moving badge 按焦内序列实时显示 `寻常 / 有趣 / 精彩`，不再固定显示外部行为状态。
- 焦内序列从 badge 可见后开始播放；入场 delay 不消耗序列时间。序列到达 `TRANSFER` 后触发离场动画，并在离场完成后推进外部 `photoSequence`，再进入既有 `REPOSITION` 或 `LOST`。
- `data/focusConfig.js` 中焦内状态段时长已整体翻倍，用于放慢体感节奏；未改移动参数、权重和 TRANSFER 生成规则。
- 拍照结果已改为所见即所得：按下快门瞬间的 visible badge 状态决定 `drawCard(speciesId, capturedBehaviorState)` 使用的 rarity 卡池。
- `src/cardDraw.js` 当前按 `NORMAL / INTERESTING / REMARKABLE` 直接抽对应 rarity 卡池，不再使用跨稀有度混池权重；同稀有度内仍随机抽具体卡。
- 对焦词缀第一版已接入：badge 中心在对焦框内记录 `IN_FOCUS`，在框外记录 `BLUR`。失焦照片仍获得卡牌、仍解锁图鉴，事件和结算照片项显示“失焦”标签。
- 失焦扣分规则作为内部 helper 保留：`BLUR` 照片分数为基础星级 -1，下限 0；当前结算 UI 暂不显示单张分数或总分。
- 局内资源 UI 已从“SD 卡”换皮为“电量”：机制仍使用 `MAX_PHOTOS` 和 `photos.length`，每张照片消耗 1 次拍摄机会；状态栏显示电池图形和剩余百分比。
- 电量耗尽文案已替换为“电量耗尽，该整理照片了。”；不能继续拍摄时文案为“电量已耗尽，无法继续拍摄。”。
- 结算页当前显示“拍照数量：X 张（已用电量 XX%）”，不显示总分和单张照片分数；失焦标签保留。
- 首屏加载已优化：`index.html` 增加真实模块依赖的 `modulepreload`，并在 app 前放置默认可见 loading 遮罩；首次 `render()` 完成后由 `main.js` 淡出并移除。
- 鸟种数据已替换为 6 种：`kingfisher`、`sparrow`、`red_billed_magpie`、`mandarin_duck`、`blackbird`、`night_heron`。旧 `red_whiskered_bulbul` 和 `light_vented_bulbul` 已从 species、spot weights、cards 数据中移除。
- `data/spots.js` 继续通过 `speciesWeights` 控制地点出现权重；当前只更新权重数据，没有修改刷鸟逻辑。
- `data/cards.js` 当前为 6 种鸟各提供 `NORMAL / INTERESTING / REMARKABLE` 三张占位卡；不包含 `PRECIOUS`，卡牌标题和描述不直接泄露正式鸟名。

### 当前关键边界

- LocalStorage 结构未改；`collectedCards` 仍按 `card.id` 解锁，不写入 focusAffix。
- FIRST_ENCOUNTER、图鉴加新、PHOTO / FOCUS / RESULT / REPOSITION / LOST 的主流程仍保留。
- 外部 `photoSequence` 仍负责 DECISION 文案、进入 FOCUS 的初始状态、TRANSFER 后推进和飞走判断；焦内序列只属于 FOCUS 内部。
- 本日鸟种替换只改数据，不改 `birdManager`、`encounterSystem`、`spotManager` 的刷鸟算法。
- 没有引入第三方库，没有接 analytics，没有修改存档结构。

## 2026-05-17 最新状态补充

### 今日完成的核心变化

- 新增 PHOTO 对焦系统第一阶段：`data/focusConfig.js` 提供鸟种与行为状态的对焦配置，`src/focusEngine.js` 提供纯计算引擎。
- 对焦引擎保持无 DOM、无 LocalStorage、无 rAF 副作用，导出 `getFocusConfig`、`createFocusRuntime`、`computeFocusPosition`、`evaluateFocus` 等函数，供 UI 层后续接入。
- PHOTO 模式已从单阶段拆为三段式流程：`DECISION`、`FOCUS`、`RESULT`，仍保留 `state.mode = "PHOTO"`。
- 顶部状态栏已调整为 3 行 2 列布局：第一行“剩余回合 | SD 卡”，第二行“位置 | 拍摄时机”，第三行“当前阶段 | 拍摄时机”。
- 原“鸟点”和“方向”已合并为“位置”，显示为“当前鸟点 · 当前观察面”，方向文案继续来自鸟点 `directions[facingDirection]`。
- “拍摄时机”块成为对焦 UI 承载区：非 PHOTO / DECISION 显示 `[空]`，FOCUS 显示固定对焦框与移动 behavior badge，RESULT 只显示静态对焦框。

### PHOTO 三阶段流程现状

- `DECISION`：玩家发现鸟但尚未举起相机；按钮为“举起相机 / 再等一等 / 放弃拍摄”；拍摄时机块显示 `[空]`。
- `FOCUS`：玩家举起相机进入对焦玩法；按钮为“按下快门 / 再等一等”；拍摄时机块显示对焦框和移动 behavior badge。
- `RESULT`：玩家刚拍完一张照片；按钮为“继续跟焦 / 再等一等 / 放弃拍摄”；拍摄时机块只保留静态对焦框。

### PHOTO action 行为

- `raiseCamera`：仅在 `DECISION` 生效，进入 `FOCUS`，不推进行为序列，不抽卡，不消耗回合。
- `refocus`：仅在 `RESULT` 生效，重新进入 `FOCUS`，不推进行为序列，不抽卡，不消耗回合。
- `wait`：在 `DECISION` / `FOCUS` / `RESULT` 都会推进 `currentPhotoSequence`；鸟未飞走则回到 `DECISION`，鸟飞走则结束本次观察。
- `shoot`：仍沿用原拍照、抽卡、记录照片和结算逻辑；若拍摄后未进入结算，则进入 `RESULT`。
- `giveUp`：结束本次 PHOTO 观察并回到探索流程，同时清理 PHOTO 临时状态。

### 对焦 UI 与动画

- 对焦动画的 rAF 生命周期集中在 `main.js` 的 UI 临时状态中，不写入 `gameState`，不进入 LocalStorage。
- 常规对焦 rAF 只在 `state.mode === "PHOTO" && state.photoPhase === "FOCUS"` 时启动。
- 进入 FOCUS 时，moving behavior badge 先延迟约 1.0-1.5 秒，再从取景框外随机方向平滑进入；入场完成后交给 `focusEngine.evaluateFocus()` 持续驱动。
- FOCUS 按下快门后，业务逻辑立即执行并更新事件描述；UI 层临时保留 moving badge，播放约 550ms 的离场动画。
- 离场动画结束后切换为 RESULT 的静态对焦框视觉；离开 PHOTO、回到 DECISION、进入 RESULT、鸟飞走或结算时会清理相关 rAF 与临时状态。

### 文案与 badge 规则

- 行为状态 `behaviorState` 使用现有 `behavior-badge` 样式体系展示，包括 `state-normal`、`state-interesting`、`state-remarkable`、`state-precious`、`state-fly-away`。
- DECISION 首次发现鸟、等待后继续观察、RESULT 拍后提示中的行为状态，均保留 `eventText` 纯文本 fallback，并通过内部安全生成的 `eventHtml` 显示 behavior badge。
- 拍摄结果中的照片品质仍来自 `card.rarity`，继续使用 rarity 相关显示，不与 behaviorState 混用。

### 当前边界

- 尚未把 focus affix 写入照片结果。
- 尚未修改照片对象结构。
- 尚未修改 LocalStorage 结构。
- 尚未修改抽卡权重、`cardDraw`、图鉴、结算或 analytics。
- 对焦系统目前仍是 PHOTO UI 表现层，为后续把对焦结果接入照片品质或词缀预留接口。

### 三状态初见 / 加新系统

- 图鉴存档已进入 v2：`birdwatch_text_sim_field_guide_v2`。
- 当前 `fieldGuide` 标准结构为：
  - `heardSpeciesIds`：听到过，只代表听觉线索。
  - `seenSpeciesIds`：近距离见到过，但未必知道正式名字。
  - `cataloguedSpeciesIds`：已经在图鉴里完成“为它加新”，正式知道鸟名。
  - `collectedCards`：已收集卡牌，保持原有卡牌存储结构。
- `fieldGuide.js` 已提供三状态 helper：`markSeen()`、`markCatalogued()`、`isSeen()`、`isCatalogued()`、`getSpeciesKnowledgeState()`。
- `heardSpeciesIds` 不会被当成 `seen` 或 `catalogued`；`collectedCards` 也不会自动解锁鸟名。
- 当前 5 个鸟种均已补充 `appearance` 和 `nickname`：
  - `appearance` 用于首次近距离见到时的钩子描述。
  - `nickname` 用于已见未加新阶段的匿名指代。
- 卡牌文案规范已调整：`card.title` 和 `card.description` 不包含正式鸟名；鸟种归属只由 `speciesId` 表达。

### FIRST_ENCOUNTER 流程

- 新增 mode：`FIRST_ENCOUNTER`，中文显示为“初次发现”。
- 观察成功后会先根据 `getSpeciesKnowledgeState()` 判断：
  - `UNKNOWN / HEARD`：进入 `FIRST_ENCOUNTER`，显示 `species.appearance`，不显示正式鸟名，不创建 `photoSequence`。
  - `SEEN`：直接进入 `PHOTO / DECISION`，使用 `species.nickname`。
  - `CATALOGUED`：直接进入 `PHOTO / DECISION`，显示 `species.name`。
- `FIRST_ENCOUNTER` 只有“继续”按钮。
- 点击“继续”后调用 `markSeen()`，再进入 `PHOTO / DECISION`；此时拍摄时机块仍显示 `[空]`，不启动对焦动画。
- PHOTO 后续文案遵守命名规则：未加新不显示正式鸟名，已加新才显示正式鸟名。
- 听声文案已按知识状态匿名化：未知或只听过时显示“某种鸟叫”，已见未加新显示 nickname，已加新显示正式鸟名。

### FIELD_GUIDE 三状态渲染

- 图鉴分页结构保持不变，仍由 `fieldGuideSpeciesIndex` 控制当前页。
- 当前页按 `getSpeciesKnowledgeState(fieldGuide, species.id)` 渲染：
  - `UNKNOWN / HEARD`：标题显示“未知鸟种”，不显示正式名、nickname 或 appearance，不显示加新按钮。
  - `SEEN`：标题显示“？？？”，显示 appearance，显示“为它加新”按钮。
  - `CATALOGUED`：标题显示正式鸟名，显示 appearance，不显示加新按钮。
- “为它加新”按钮位于图鉴页内部，不在底部 actionPanel。
- 点击“为它加新”会调用 `handleCatalogueAction()`，内部使用 `markCatalogued()` 写入 `cataloguedSpeciesIds`，并确保该 speciesId 同时属于 `seenSpeciesIds`。
- 加新后当前图鉴页立即刷新，标题从“？？？”变为正式鸟名，按钮消失，事件描述显示“你终于知道了它的名字——鸟名。”。
- 当前阶段没有图鉴积分、全毕业状态或加新特效。

更新时间：2026-05-15

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
  - 包含状态栏、按钮、行动区、面板、动态地图、分页图鉴、行为状态徽章、卡牌稀有度徽章、NEW 标记、PHOTO 动效、SETTLEMENT 动效等样式。
  - 旧版竖向图鉴 `.guide-list / .guide-card` 样式已删除，当前图鉴样式统一使用 `.field-guide-*`。

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
  - 当前每个鸟种有 6 张卡牌：
    - 3 张 `NORMAL`
    - 2 张 `INTERESTING`
    - 1 张 `REMARKABLE`
  - 暂无 `PRECIOUS` 卡牌，但显示和抽卡结构已预留支持。
  - 当前 card id 命名格式为 `speciesId_rarity_序号`，例如 `kingfisher_normal_01`。
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

页面级 UI 临时状态在 `src/main.js` 中维护，不写入 `gameState` 或 LocalStorage：

- `isSettlementRevealed`
  - 控制 SETTLEMENT 折叠态是否已展开。
  - 新局、重新开始、进入新结算等场景会重置。

- `fieldGuideSpeciesIndex`
  - 控制 FIELD_GUIDE 当前显示哪个鸟种页。
  - 只用于 UI 翻页，不写入存档。

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

这些 action 在 `src/gameSession.js` 中已有保留说明注释，不要在未明确要求时删除。

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
- `FLY_AWAY.hint` 当前为“鸟已飞离”，避免和整局结束 / SETTLEMENT 混淆。

### FIELD_GUIDE

图鉴查看状态。

行动按钮：

- 返回
- 开始新游戏
- 清空图鉴

当前图鉴 UI：

- 按鸟种分页浏览，每次只显示一个鸟种页面。
- 顶部是一排全宽细长分段横线页签，数量等于 `speciesList.length`，当前页为绿色。
- 鸟名左右有紧凑楔形翻页按钮：`◀ / ▶`。
- 点击左右箭头只修改 `fieldGuideSpeciesIndex` 并重新渲染，不改变 `state.mode` 和图鉴数据。
- 每页显示当前鸟种收集进度：`已收集 X / Y`。
- 未听到且未收集的鸟种显示为“未知鸟种”，并显示提示：先在野外听见声音或拍下身影。
- 未获得卡牌显示稀有度 badge + `？？？` + `尚未获得`。
- 已获得卡牌显示稀有度 badge、卡牌标题和描述。
- 图鉴卡牌背景接近地图纸面色，卡牌列表会覆盖 `.panel ul` 默认缩进。

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

结算进入方式和展示：

- 进入 SETTLEMENT 后默认先显示折叠态面板。
- 折叠态核心文案：
  - `本局结算`
  - `点击展开本次记录`
- 玩家点击折叠态结算面板后，才渲染完整统计和照片列表。
- 展开后再次点击完整结算区域不会反复重播动画。
- 结算照片列表会覆盖 `.panel ul` 默认缩进，照片卡片应与结算内容主轴对齐。

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
- `renderFieldGuide()` 负责分页图鉴渲染，不再渲染旧版 `guide-list / guide-card`。
- `fieldGuideSpeciesIndex` 和 `isSettlementRevealed` 都是 `main.js` 页面级 UI 状态，不写入 LocalStorage。

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

当前 `FLY_AWAY.hint` 为“鸟已飞离”。

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

注意：`getFieldGuide(fieldGuide)` 当前未被 UI 主流程直接调用，但作为预留 API 暂不删除。

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

### FIELD_GUIDE 分页图鉴

- 图鉴页签使用 `.field-guide-page-tabs` / `.field-guide-page-tab`。
- 页签是不可聚焦的视觉指示，不参与点击切换。
- 翻页按钮使用 `.field-guide-nav-button`，保留 `:focus-visible` 可访问样式。
- 当前图鉴不再使用旧 `.guide-list` / `.guide-card`。

### START_SPOT_SELECT 鸟点选择

- 初始鸟点列表使用 `.spot-list.start-spot-select`。
- 鸟点子卡片使用 `.spot-option.start-spot-card`。
- `.panel .spot-list` 会覆盖 `.panel ul` 默认缩进，保证鸟点卡片与父面板内容对齐。
- `.spot-option` 当前复用地图背景色 `#f7f1e4`，与父面板形成层级。

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

列表对齐注意：

- `.panel ul` 仍为普通面板列表提供默认缩进。
- `.panel .field-guide-card-list`、`.panel .settlement-photo-list`、`.panel .spot-list` 会显式覆盖默认缩进。
- 不要全局重置所有 `ul / li`，避免影响观察日志等普通列表。

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
3. `SPOT_SELECT` 是旧的鸟点选择状态，目前 UI 主流程使用 `DISTANT_LISTEN`，但旧逻辑仍存在，并已在 `gameSession.js` 注释说明。
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
12. 不要恢复旧竖向图鉴列表；当前图鉴入口应继续使用分页图鉴。
