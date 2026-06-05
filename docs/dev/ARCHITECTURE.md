# 认鸟手信 · 当前工程架构说明

## 1. 项目定位

- 《认鸟手信》是一个 vanilla HTML/CSS/JavaScript 网页游戏，没有前端框架、构建步骤、TypeScript、Canvas 或 WebGL 主流程。
- 当前 main 分支已经合并二测功能，包括 Liya 消息、图鉴、结算、analytics、survey 和测试隔离开关。
- main 默认关闭测试功能：`PLAYTEST_CONFIG.analyticsEnabled`、`surveyEnabled`、`openingSurveyEnabled`、`settlementSurveyEnabled` 均应保持 `false`。
- 当前工程重点是稳定承接三测内容扩张和小步清扫，不是一次性大重构。

## 2. 入口与加载方式

- `index.html` 只直接执行 `src/main.js`：`<script type="module" src="./src/main.js"></script>`。
- 其余模块通过 ES module import 加载。
- `modulepreload` 只影响预取性能，不决定模块执行顺序。
- `data/config.js` 通过 import 进入依赖图；ES module 会先执行依赖模块，再执行依赖方。
- 新增模块时，如果希望优化首屏加载，可以考虑补充 `modulepreload`。
- 缺少 `modulepreload` 通常不影响功能正确性，但可能影响首屏加载性能。

## 3. 核心文件职责

| 文件 | 主要职责 | 内容生产入口 | 风险 | 注意事项 |
| --- | --- | --- | --- | --- |
| `src/main.js` | 页面级编排中心：DOM、渲染、UI 临时状态、FOCUS 动画、消息入口、图鉴入口、结算、survey、analytics 协调 | 否 | 高 | 当前最大结构风险，不能一次性大拆 |
| `src/gameSession.js` | 游戏业务状态机、回合推进、PHOTO 子阶段、拍照写入、结算进入 | 否 | 高 | 不访问 DOM；不要随意改 PHOTO / FOCUS / RESULT |
| `src/gameState.js` | 创建默认单局状态 | 否 | 中 | 默认字段变化会影响大量流程 |
| `src/birdManager.js` | 活动鸟生成、停留回合、线索强度、刷新规则 | 否 | 中 | 刷新规则改动会影响遭遇体验 |
| `src/encounterSystem.js` | 观察、静听、远听的发现逻辑 | 否 | 中 | 发现概率和远听语义需谨慎 |
| `src/photoSequence.js` | PHOTO 外部行为序列和行为状态推进 | 否 | 高 | 影响 rarity 来源和拍摄时机文案 |
| `src/focusEngine.js` | FOCUS 运动、对焦判定、视觉参数计算 | 否 | 高 | 与所见即所得和 snapshot 强相关 |
| `src/focusSequence.js` | FOCUS 内部可见状态时间轴 | 否 | 高 | 影响 FOCUS 手感和超时 |
| `src/fieldGuide.js` | 图鉴业务写入、加新、卡牌、Liya 已读、自动加新辅助 | 否 | 高 | 不要改存档结构和旧字段 fallback |
| `src/storage.js` | field guide 存档 normalize、v2 迁移、reset registry | 否 | 高 | 不改 LocalStorage key、不删迁移 |
| `src/analytics.js` | analytics session、events、flush、retry、tester profile | 否 | 中 | 不改 payload 顶层结构和 flush 时机 |
| `src/liyaMessageSystem.js` | 加载、校验、标准化和选择 `liyaMessages.json` | 否 | 中 | 不操作 DOM、不写存档 |
| `src/ui/messagePanel.js` | 消息列表、聊天线程、气泡、滚动恢复 UI 辅助 | 否 | 中 | 不应写业务状态和 LocalStorage |
| `src/ui/fieldGuidePanel.js` | 图鉴 / 笔记展示 HTML 片段 | 否 | 中 | 不应处理业务写入 |
| `data/config.js` | 全局调参、FOCUS/PHOTO 配置、playtest 开关、analytics endpoint | 部分 | 中 | main 默认测试开关必须关闭 |
| `data/cards.js` | 卡牌 / moment 数据 | 是 | 中 | 文案和 rarity 改动会影响抽卡结果感受 |
| `data/species.js` | 鸟种基础信息、昵称、正式名 | 是 | 中 | 匿名阶段不要提前泄露正式鸟名 |
| `data/spots.js` | 鸟点、方向、邻接、刷新权重、时间/方向限制 | 是 | 中 | direction index 和 neighbors 需要校验 |
| `data/focusConfig.js` | 各鸟种 FOCUS 手感参数 | 部分 | 高 | 改动需要完整 FOCUS 回归 |
| `data/initialMessages.js` | 静态联系人和初始消息 | 是 | 中 | 影响初始未读和分隔线 |
| `data/sisterKnowledge.js` | 图鉴卡片详情中的妹妹补充 | 是 | 中 | 不是聊天回复数据源 |
| `data/liyaMessages.json` | Liya photo_reply 聊天文本池 | 是 | 中 | 由 `liyaMessageSystem.js` fetch；适合编辑器维护 |

## 4. main.js 当前职责地图

- 初始化：创建 `gameState`，查询 DOM，创建 runtime 工具入口。
- 数据加载协调：读取静态 data 模块，调用 `loadLiyaMessages()` 后刷新 UI。
- 页面级状态：overlay、message view、field guide detail、settlement、FOCUS、analytics、survey draft 等顶层状态。
- action 分发：按按钮 `data-type` 分发到 `gameSession.js` 的业务 handler。
- PHOTO / FOCUS / RESULT UI 侧协调：FOCUS moving badge、rAF、快门瞬间捕获、对焦结果、拍立得 overlay。
- 消息入口：消息列表、thread 打开、红点、已读、分句动画、滚动恢复。
- 笔记 / 图鉴入口：图鉴页码、卡牌详情、snapshot 翻页、发送给妹妹、new badge、自动 reveal。
- 结算：今天的收获、展开动效、休息到明天清晨、dayIndex 推进。
- 问卷：开场 tester profile 和局后 survey 的 UI、draft、提交和跳过。
- analytics 协调：维护 main 层计数，调用 `track()` / `flush()`。
- UI 渲染：`render()` 总入口更新状态栏、事件文本、按钮、详情、日志。
- 工具函数：format、escape、random、clamp、timestamp、DOM helper 等混在 `main.js`。

`main.js` 是当前最大结构风险，但不能一次性大拆。后续应优先抽纯工具和 facade，避免重排核心流程。

## 5. 核心流程概览

### 5.1 开始游戏流程

- 初始为 `START`。
- 如果 `openingSurveyEnabled` 开启且 tester profile 未完成，会先显示 Q0 / Q-pre。
- 默认 main 中 opening survey 关闭，玩家直接看到开局独白或开始按钮。
- 点击开始后进入 `START_SPOT_SELECT`，选择初始鸟点后进入 `EXPLORE`。

### 5.2 观察与鸟点流程

- `spotManager.js` 负责鸟点查询、相邻鸟点和方向映射。
- `birdManager.js` 按鸟点权重、时间和方向规则生成活动鸟。
- `encounterSystem.js` 处理观察、静听、远听。
- `gameSession.js` 负责把这些业务结果写回 `gameState`。

### 5.3 PHOTO / FOCUS / RESULT 流程

- `gameSession.js` 决定 PHOTO 子阶段和拍照业务结果。
- `main.js` 负责 FOCUS moving badge、rAF、快门瞬间捕获、对焦判定数据捕获、拍立得 overlay。
- 快门捕获必须发生在业务 action 分发前。
- 这是高风险区，暂不拆。

### 5.4 自动加新流程

- 拍到照片后写入 field guide card / snapshot。
- 首次鸟种、识别、图鉴入册、Liya 回复、new badge 和自动 reveal 之间存在跨模块耦合。
- `fieldGuide.js` 提供业务写入和状态判断，`main.js` 仍协调 UI 和自动 reveal。
- 暂不拆。

### 5.5 消息系统流程

- `data/initialMessages.js` 提供静态初始消息。
- `data/liyaMessages.json` 提供 Liya photo_reply 文本池。
- `src/liyaMessageSystem.js` 负责加载、校验、标准化和选择消息。
- `src/ui/messagePanel.js` 负责消息 UI 片段与滚动辅助。
- `main.js` 仍负责分句动画、红点、已读转换、滚动恢复和 queue item 联动。
- 暂不拆消息队列。

### 5.6 笔记 / 图鉴流程

- `src/storage.js` 负责 normalize、v2 迁移、load/save。
- `src/fieldGuide.js` 负责 heard / seen / catalogued、collectedCards、sister reply、pendingAutoCatalogue 等业务状态。
- `src/ui/fieldGuidePanel.js` 负责部分展示 HTML。
- `main.js` 仍负责详情页、发送给妹妹、new badge、snapshot 翻页、自动 reveal。

### 5.7 结算流程

- `renderSettlement()` 渲染结算页。
- “今天的收获”由单层折叠容器展示，首次展开播放 reveal。
- `renderSettlementContinueAction()` 渲染“休息到明天清晨”和可选 survey 入口。
- `continueToNextDay()` 推进 `dayIndex`，清理 UI 临时态，回到 START。
- survey 开关关闭时不应阻塞结算或下一天。

### 5.8 analytics / survey 流程

- `data/config.js` 提供 `PLAYTEST_CONFIG`。
- `analyticsEnabled` 控制 analytics session、track、flush 和 retry。
- `surveyEnabled` 是问卷总开关。
- `openingSurveyEnabled` 控制开场 Q0 / Q-pre。
- `settlementSurveyEnabled` 控制结算页反馈问卷。
- main 默认全部关闭。
- 开启后可恢复二测问卷和埋点能力。

## 6. LocalStorage key 说明

| key | 用途 | 正式存档 | 是否可清理 | 风险说明 |
| --- | --- | --- | --- | --- |
| `birdwatch_text_sim_field_guide_v3` | 当前图鉴 / 笔记主存档 | 是 | 不能随意清 | 改 key 或结构会丢存档 |
| `birdwatch_text_sim_field_guide_v2` | 旧图鉴存档迁移来源 | 历史兼容 | 暂不删 | v2 到 v3 迁移仍依赖 |
| `birdwatch_text_sim_day_index` | 当前第几天标题与加新日期 | 是 | 不能随意清 | 影响标题和加新日期 |
| `birdwatch_text_sim_tester_uuid` | 测试设备匿名 UUID | 否 | 测试清理可清 | 普通重置默认保留 |
| `birdwatch_text_sim_tester_profile` | Q0 / Q-pre 测试者信息 | 否 | 测试清理可清 | survey 关闭时不应阻塞游戏 |
| `birdwatch_text_sim_session_index` | analytics session 序号 | 否 | 测试清理可清 | 清理会影响统计连续性 |
| `birdwatch_text_sim_analytics_retry` | analytics 失败缓存 | 否 | 可清 | 不影响普通游戏 |
| `birdwatch_text_sim_post_survey_status` | 旧局后问卷提交状态 | 否 | 暂不直接清 | `DEPRECATED_CANDIDATE`，待确认外部依赖 |
| `birdwatch_playtest2_driving_survey_done` | playtest2 driving survey 一次性完成标记 | 否 | 测试清理可清 | 是否纳入 reset registry 待确认 |

## 7. 当前可拆分区域

### P0 可先拆

- DOM 工具。
- format 工具。
- config helper。
- 一部分纯工具函数。

### P1 谨慎拆

- save manager facade。
- telemetry adapter。
- data loader。

### P2 暂不拆

- PHOTO / FOCUS / RESULT。
- 消息队列。
- 自动加新。
- 回合推进。
- field guide 存档迁移。

## 8. 当前废弃候选与保留项

### DEPRECATED_CANDIDATE

- `POST_SURVEY_STATUS_KEY`：旧问卷状态 key，当前一次性 gate 使用 `birdwatch_playtest2_driving_survey_done`。
- `hasSubmittedPostSurvey()`：审计未发现当前调用方，但旧读链路仍保留。
- `.message-time`：聊天详情当前不显示现实时间，但 class 和样式等待确认后再删。

### 暂时保留

- `SPOT_SELECT`：旧鸟点选择流程，注释说明保留给后续地图选点。
- `PRECIOUS`：未来预留 rarity / state 兼容分支。
- `clearFieldGuide()`：已 deprecated，但可能仍被旧入口或外部调试依赖。
- `field_guide_v2` migration：旧存档迁移兼容。
- `message-editor.html`：开发用 Liya 文案编辑器，不是正式游戏入口。

这些内容不能直接删，因为缺少完整外部依赖确认或仍承担兼容 / 预留职责。

## 9. 修改风险提示

- 不要随意改 PHOTO / FOCUS / RESULT。
- 不要改快门瞬间捕获数据。
- 不要改 `latestVisibleFocusState` / `latestFocusResult`。
- 不要改 Liya 消息队列时序。
- 不要改 LocalStorage key。
- 不要改 analytics payload 顶层结构。
- 不要改 survey 字段名。
- 不要让问卷默认显示。
- 不要让 main 默认发送 analytics。
## 10. 2026-06 工程拆分补充

### 10.1 新增工程辅助模块

#### `src/utils/dom.js`

- 职责：HTML escape、正则转义等轻量显示安全 helper。
- 不做：不读写 gameState，不读写 LocalStorage，不调用 analytics，不承接业务逻辑。
- 风险等级：低。

#### `src/utils/format.js`

- 职责：时间段、卡牌标题/描述、拍立得日期、消息时间、加新日期等纯展示格式化。
- 不做：不读写 DOM，不读写 gameState，不读写 LocalStorage，不承接业务判断。
- 风险等级：低到中。
- 注意：`getCardDisplayTitle()` / `getCardDisplayDescription()` 当前仍只属于展示格式化；如果未来依赖更复杂的图鉴状态，应该再考虑迁到语义更明确的 card display 模块。

#### `src/utils/config.js`

- 职责：统一读取 `PLAYTEST_CONFIG`，提供 `getPlaytestConfig()`、`isAnalyticsEnabled()`、`isSurveyEnabled()`、`isOpeningSurveyEnabled()`、`isSettlementSurveyEnabled()`、`getSurveyVersion()`。
- 不做：不直接改配置值，不承接业务流程。
- 风险等级：低。
- 注意：后续不要绕过这些 helper 到处散落读取 `PLAYTEST_CONFIG`。

#### `src/core/saveManager.js`

- 职责：轻量 LocalStorage facade。
- 当前只收口：`safeParseJson()`、`readLocalStorage()`、`writeLocalStorage()`、`removeLocalStorage()`、observation day index、playtest2 driving survey done。
- 不做：不处理 fieldGuide 主存档、不处理 v2 -> v3 迁移、不处理 `tester_uuid` / `session_index` / `analytics retry`。
- 风险等级：中。
- 注意：不得修改 LocalStorage key；fieldGuide 主存档迁移必须保持独立任务和完整回归。

#### `src/core/telemetryAdapter.js`

- 职责：轻量 analytics wrapper，供 `main.js` 调 `createTelemetrySession()`、`trackTelemetryEvent()`、`flushTelemetry()`、`setTelemetrySurvey()`、`clearTelemetrySurvey()` 等入口。
- 不做：不自行生成 session id，不自行计算 duration，不自行处理 retry 语义，不迁移 `main.js` 内的 analytics runtime counters。
- 风险等级：中。
- 注意：不得改事件名、payload、`session_start` / `session_end` / `flush` 时机。

### 10.2 main.js 当前剩余职责

- 虽然已经拆出一轮 `utils/*`、`saveManager-lite` 和 `telemetryAdapter-lite`，`main.js` 仍负责：
- 页面级编排
- action 分发
- PHOTO / FOCUS / RESULT UI 协调
- FOCUS rAF
- 消息队列时序
- Liya 分句动画调度
- 自动加新 reveal
- 图鉴详情交互
- 结算 UI
- survey UI
- analytics runtime counters

`main.js` 仍是高风险中心，不能因为新增 adapter 就误判为 analytics runtime 已完成迁移。

### 10.3 当前暂不拆区域

- PHOTO / FOCUS / RESULT
- 消息队列
- 自动加新
- 回合推进
- fieldGuide 主存档迁移
- analytics runtime counters
