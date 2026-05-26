# DEVLOG_CURRENT_STATUS

## 2026-05-27 手册 / 笔记 UI 模块化（M2）当前状态

### 已完成
- Block M1：消息面板 UI 渲染层抽离（`src/ui/messagePanel.js`）已完成。
- Block M1-b：messagePanel.js 单源化收口已完成。
- Block M2：手册 / 笔记 UI 渲染层抽离已完成，新增 `src/ui/fieldGuidePanel.js`。
- `src/main.js` 已接入 `fieldGuidePanel.js`，并改为调用：
  - `renderFieldGuideEmptyPanel(...)`
  - `renderFieldGuideListPanel(...)`
  - `renderFieldGuideCardDetailPanel(...)`
  - `renderFieldGuideDetailPolaroidUI(...)`
  - `renderFieldGuideSnapshotNavUI(...)`
- `main.js` 已删除或收口对应重复实现，不再双份维护：
  - 已删除本地定义：`renderFieldGuideDetailCornerHtml`、`wrapNoteFolder`
  - 已删除旧实现体并保留薄 wrapper：`renderFieldGuideDetailPolaroid`、`renderFieldGuideSnapshotNav`
  - `renderFieldGuideCardDetail`、`renderFieldGuide` 内旧大段手册 HTML 模板已替换为模块输出调用

### 当前模块边界
- `src/main.js` 负责：
  - 主 render 调度、页面状态管理、状态衔接
  - fieldGuide 读取和写入、storage 保存、事件委托
  - `fieldGuideDetailSnapshotIndex` 等 UI 状态衔接
  - `sendCollectedCardToSister`、liyaMessageQueueItem 写入、sisterKnowledge 解锁副作用
  - 自动加新、红点 / 30 秒机制 / queue 结构相关业务逻辑
- `src/ui/messagePanel.js` 负责：
  - 消息面板 UI、消息列表 / 聊天线程、聊天气泡、photo_reply 多行分气泡、引用条
  - 逐行动画 UI 调度、聊天滚动辅助、可见性辅助
- `src/ui/fieldGuidePanel.js` 负责：
  - 手册空态、手册列表、卡牌详情、拍立得详情块、照片翻页条等手册 UI HTML 拼装
  - 手册展示 helper
- `fieldGuidePanel.js` 不负责：
  - fieldGuide 业务写入、`sendCollectedCardToSister`、`markDueSisterRepliesReadByCardIds`
  - localStorage save/load、auto catalogue、photo_reply 选择、gameSession/focus/photo/card draw 业务流程

### 已检查通过
- `git diff --check -- src/main.js src/ui/fieldGuidePanel.js`：通过。
- 备注：仅 CRLF warning，无语法块损坏提示。

### 已手测通过
- 用户浏览器功能测试：通过。
- 覆盖反馈：打开/收起笔记、手册列表、卡牌详情、拍立得详情块、照片翻页条、发给妹妹按钮、已发送状态、妹妹补充正常；消息红点 / 30 秒回复、普通观察 / 拍照 / 对焦未受影响。

### 注意事项
- Codex 环境未执行浏览器交互测试。
- Codex 环境未执行 JS 语法检查（环境无 `node` 命令）。

### 保持不变
- 未改动：`styles/style.css`、`data/*`、`src/fieldGuide.js`、`src/storage.js`、`src/liyaMessageSystem.js`、`src/ui/messagePanel.js`。
- 未改变：queue item 结构、红点判断、30 秒机制、发给妹妹业务语义、fieldGuide 数据结构、localStorage key、UI 样式、消息系统、对焦 / 拍照逻辑。
- 未新增：`console.log` / `debugger` / `alert`。

### 后续计划
- 建议先提交稳定点：`refactor: extract field guide panel ui module`。
- 暂缓继续深拆业务状态与事件委托。
- 后续如继续 UI 拆分，建议顺序：
  - M3：`src/ui/focusView.js`
  - M4：`src/ui/actionButtons.js`
  - M5：`src/ui/topStatusPanel.js`
  - M6：`src/ui/eventPanel.js`

## 2026-05-27 消息面板模块化（M1 / M1-b）当前状态

### 已完成
- Block M1：消息面板 UI 渲染层抽离已完成，新增 `src/ui/messagePanel.js`。
- Block M1 接线已完成：`src/main.js` 通过 `renderMessagePanelUI` 调用消息面板渲染。
- Block M1-b：messagePanel.js 单源化收口已完成。
- 已从 `src/main.js` 删除并单源到 `src/ui/messagePanel.js` 的重复函数：
  - `renderChatHistoryV2`
  - `scheduleLiyaMessageLineAnimation`
  - `getRenderableMessageLines`
  - `shouldAnimateLiyaMessageLines`
  - `renderLineBubbleHtml`
  - `renderMessageAvatar`
  - `getSisterThreadPreview`
  - `renderMessageCloseButton`
- 已清理 legacy / unused：
  - `renderMessagePanelLegacyUnused`
  - `getSisterThreadMessagesLegacyUnused`
  - `getMomThreadMessagesLegacyUnused`
  - `getSisterThreadPreviewLegacyUnused`
- 已清理无引用旧本地状态 / 常量 / 函数：
  - `liyaLineAnimationTimers`
  - `animatingLiyaMessageIds`
  - `liyaAnimatedLineCounts`
  - `LIYA_MSG_BASE_DELAY`
  - `LIYA_MSG_CHAR_MULTIPLIER`
  - `LIYA_MSG_MAX_CHAR_DELAY`
  - `getLiyaLineDelay`
  - `isNearBottom`

### 当前模块边界
- `src/main.js` 负责：
  - 主 render 调度与页面状态管理
  - 线程数据组装（fieldGuide / initial messages）
  - 业务回调承接（含 `markDueSisterRepliesReadByCardIds`）
  - 红点 / 30 秒机制 / queue 结构相关业务逻辑
  - 事件委托与系统动作分发
- `src/ui/messagePanel.js` 负责：
  - 消息面板、消息列表、聊天线程 UI 渲染
  - 聊天气泡 HTML、photo_reply 多行分气泡、引用条
  - 逐行动画 UI 调度与计时器状态
  - 聊天滚动辅助与可见性辅助
- 仍保留于 `main.js` 的薄 wrapper（转调 `messagePanel.js`）：
  - `isElementFullyVisibleInContainer`
  - `getVisibleLiyaReplyCardIds`
  - `clearLiyaLineAnimationTimers`
  - `captureChatScrollState`
  - `restoreChatScrollState`

### 已检查通过
- `git diff --check -- src/main.js src/ui/messagePanel.js`：通过。
- 备注：存在 CRLF 警告，无语法块损坏提示。

### 已手测通过
- 用户浏览器手测反馈：通过。
- 覆盖重点：消息入口、消息列表、力娅聊天、photo_reply、多行气泡、逐行动画、引用条、红点、已读时机、聊天滚动。

### 保持不变
- 未改动：`data/*`、`styles/style.css`、`src/fieldGuide.js`、`src/storage.js`、`src/liyaMessageSystem.js`、`src/liyaMessageDevTools.js`、`src/gameSession.js`、`message-editor.html`。
- 未改变：queue item 结构、红点判断语义、30 秒到期机制、逐行动画节奏、聊天滚动行为、UI 样式、localStorage key。
- 未新增：`console.log` / `debugger` / `alert`。

### 注意事项
- 本次拆分曾出现一次 `src/main.js` 整文件写回导致编码污染（中文乱码）的阻塞事件。
- 处理策略已固定：
  - 先回滚到分支最新提交版本；
  - 再用小块 `apply_patch` 继续；
  - 禁止整文件重写 `main.js`；
  - 每次 patch 后检查中文与 diff 异常；
  - 若再出现编码污染或异常大 diff，立即停止。

### 后续计划
- M1 阶段已阶段性完成，建议先提交稳定点。
- 暂缓继续深拆，近期优先小补丁。
- 若后续继续拆分，建议顺序：
  - M2：`fieldGuidePanel.js`
  - M3：`focusView.js`
  - M4：`actionButtons.js`

## 2026-05-24 文本资产分层迭代与回归 QA 状态

本轮围绕《认鸟手信》的玩家可见文本资产完成了一次分层审计、分层重写、流程文案轻量统一和回归 QA。项目仍是原生 HTML / CSS / JavaScript demo；本轮文本工作没有引入 React / Vue / 第三方库，也没有改变 LocalStorage key、状态机、action、DOM 结构、CSS class 或核心业务流程。

### 1. 文本资产审计

已完成一次只读文本资产审计，覆盖 `data/species.js`、`data/cards.js`、`data/sisterKnowledge.js`、`data/spots.js`、`src/main.js`、`src/gameSession.js`、`src/birdManager.js`、`src/encounterSystem.js`、`index.html`、`styles/style.css`。

审计范围包括鸟种层文本、卡牌层文本、妹妹回复文本、流程事件文本、UI 静态文案、地点与声景文本、正式鸟名泄露风险、“笔记 / 手册 / 图鉴”命名统一风险、文本重复和口吻不统一问题。

审计发现并已在后续轮次处理的关键问题：

- `sparrow.appearance` 曾提前泄露“麻雀”。
- `blackbird.appearance` 曾提前泄露“乌鸫”。
- `pond_bank.soundscape` 曾提前泄露“麻雀”。
- 妹妹回复偏科普 / 认鸟老师感，人物声线不足。
- 玩家可见文案中存在“手册 / 图鉴 / 笔记”命名不统一风险。

### 2. 已完成的文本修改分层

#### `data/species.js`：鸟种层文本重写

已完成 6 种鸟的 `appearance` 和 `firstEncounterAppearance` 重写，修复未加新阶段正式鸟名提前泄露问题。未修改 `id`、`name`、`habitat`、`nickname`、`clue`、`colorPalette`。

当前 species 层职责：

- `firstEncounterAppearance`：第一次看见一只还叫不出名字的鸟。短、鲜明、匿名、有钩子。
- `appearance`：SEEN 阶段笔记页可见的观察描述。可以更完整，但仍不能出现正式鸟名。
- `nickname`：未加新阶段使用的匿名称呼。
- `name`：CATALOGUED / 已加新后正式揭示的鸟名。

当前匿名边界：`firstEncounterAppearance`、`appearance`、`nickname`、`clue` 均不包含正式鸟名。

#### `data/spots.js`：地点声景泄露修复

已仅修改 `pond_bank.soundscape`，修复其中“麻雀”提前泄露问题，改为匿名声景描述。未修改 `spotId`、`name`、`description`、`traits`、`directions`、`speciesWeights`、地点结构或地图逻辑。

#### `data/cards.js`：36 张卡牌文本重写

已检查全部 36 张卡牌，修改 31 张卡牌标题，修改 36 张卡牌描述。未修改 `id`、`speciesId`、`rarity`、`stars`、卡牌数量、卡牌结构或卡牌顺序。

当前卡牌结构仍为：6 种鸟，每种鸟 6 张卡，每种鸟固定为 3 张 `NORMAL`、2 张 `INTERESTING`、1 张 `REMARKABLE`。当前 6 种鸟为 `kingfisher`、`sparrow`、`red_billed_magpie`、`mandarin_duck`、`blackbird`、`night_heron`。当前没有 `PRECIOUS` 卡牌。

当前 cards 层职责：

- 卡牌 `title` / `description` 不是鸟种介绍，而是一张具体照片瞬间。
- `NORMAL`：日常观察，普通但值得看。
- `INTERESTING`：行为变化，动作更明确，有一点性格。
- `REMARKABLE`：高光瞬间，时机、动作或光线刚好成立。

当前匿名边界：卡牌 `title` / `description` 不出现正式鸟名，已检查不包含“翠鸟 / 麻雀 / 红嘴蓝鹊 / 鸳鸯 / 乌鸫 / 夜鹭”。

#### `data/sisterKnowledge.js`：妹妹回复文本重写

已检查并修改 6 条 cardId 专属回复，检查并修改 4 条 rarity fallback 回复。未修改 key、cardId、fallback key、数据结构或导出函数。

当前 sisterKnowledge 层职责：妹妹陈力娅如何回应姐姐发来的照片，并把照片变成认鸟、聊天和关系推进。

当前力娅回复声线：

- 有“小老师模式”。
- 有轻微“小孩模式”底色。
- 可以有少量讨好、撒娇、试探。
- 不百科化。
- 不 AI 助手化。
- 不成人化理论表达。
- 不每条都叫“姐”。
- 不直接讲“鸟代表自由”，但可以隐约让自由投射浮现。

当前角色基准：陈力娅不是“懂鸟的妹妹”，也不是单纯等待被拯救的小孩。她是一个还没办法离开学校、家庭和补习班的孩子，先在鸟身上看见了自己想要的自由。她把鸟的世界分享给姐姐陈玉，不是为了炫耀自己懂得多，而是因为她不想再一个人看见。

当前 fallback 层级：

- `NORMAL`：普通照片也值得看，强调轮廓、站位、平常状态。
- `INTERESTING`：行为变化与前摇，强调动作被截住、下次多等半秒。
- `REMARKABLE`：高光瞬间与情绪连接，更兴奋，有羡慕和“下次先发我”的关系试探。
- `PRECIOUS`：预留珍贵瞬间，更认真、更珍惜，不剧透主线。

匿名边界：fallback 回复不出现正式鸟名，cardId 专属回复也未出现正式鸟名。

#### 流程事件文本轻量润色

已完成流程层玩家可见文案润色，涉及 `src/gameSession.js`、`src/main.js`、`src/birdManager.js`、`src/encounterSystem.js`、`index.html`。

`src/gameSession.js` 修改范围：开始、远听、初见、拍照、等待、鸟飞远、电量耗尽、结算、自动加新揭示文本。

`src/main.js` 修改范围：玩家可见“手册”统一为“笔记”，结算文案润色，照片详情文案润色，初见提示润色，力娅默认消息轻量调整。

`src/birdManager.js` / `src/encounterSystem.js` 修改范围：探索失败反馈、远听反馈、静听反馈，避免正式鸟名提前出现。

`index.html` 修改范围：首屏标题改为《认鸟手信》方向；slogan 改为“把城市里的每一只鸟，寄给想念的人”；初始事件文案改为正式 demo 方向。

本轮未修改 action、状态机、数据结构、LocalStorage key、CSS class、DOM 结构、自动加新流程、延迟回复机制、抽卡逻辑、对焦判定逻辑。

### 3. 自动加新 reveal 判断修复

只读 QA 后发现一个 P1 风险：

- `src/gameSession.js` 中正式揭示文案已改为“你终于把它写进了笔记：${species.name}。”
- `src/main.js` 中 `getEventTextClassName()` 仍匹配旧文案“你终于知道了它的名字”。
- 这可能导致 `is-catalogue-reveal` class 不生效，从而影响自动加新 reveal 视觉样式和 CSS content，例如“✦ 加新完成 ✦”。

已完成修复：

- 修改了 `src/main.js`。
- 修复 `getEventTextClassName()` 中自动加新 reveal 的文案匹配。
- 当前可匹配新文案“你终于把它写进了笔记”。
- 已保留旧文案兼容“你终于知道了它的名字”。
- 未重构函数。
- 未修改 `is-catalogue-reveal` class 名。
- 未修改自动加新流程。

### 4. 只读 QA 结论

已完成一轮只读文本链路回归 QA。总体结论：

- 当前文本链路整体连贯。
- `species -> cards -> sisterKnowledge -> 笔记 / 消息 / 自动加新` 的匿名边界基本成立。
- 卡牌文本没有提前泄露正式鸟名。
- 玩家可见“手册 / 图鉴”已基本统一为“笔记”。

QA 风险结果：

- P0：0 个。
- P1：1 个，已修复。
- P2：4 个，可后续优化。

已修复的 P1：自动加新 reveal 的字符串判断仍匹配旧文案，可能导致 reveal 样式失效。

剩余 P2：

- 注释中仍有旧称“图鉴”，非玩家可见，可后续整理。
- 部分按钮略长，例如“从这里开始：${spot.name}”“倾听远处的声音”“提前撤离并结算”。
- CSS reveal 文案“※ 新的鸟影”与“写进笔记”体系略有风格差。
- 目前只有部分 cardId 专属妹妹回复，其余依赖 rarity fallback，照片对应精度有限。

### 5. 当前必须保留的关键边界

#### 不要改内部 fieldGuide 命名

玩家可见文案统一为“笔记”，但内部仍沿用 `fieldGuide` 和 `birdwatch_text_sim_field_guide_v3`。不要为了文案统一重命名内部变量、函数或 LocalStorage key。

#### 不要提前泄露正式鸟名

正式鸟名只应出现在 `species.name`、CATALOGUED / 已加新后、自动加新正式揭示文本、已加新后的笔记标题、已加新逻辑确认后的结算展示。

正式鸟名不应出现在 `firstEncounterAppearance`、`appearance`、`nickname`、`clue`、卡牌 `title`、卡牌 `description`、fallback 妹妹回复、未知 / 未加新阶段流程文本、无条件显示的地点声景。

#### 不要混淆 behaviorState 和 card.rarity

项目中存在两套相似概念：

- `behaviorState`：拍摄时机 / 行为状态。
- `card.rarity`：卡牌稀有度 / 照片品质。

二者都可能显示“寻常 / 有趣 / 精彩 / 珍贵”，但语义不同：“当前时机”语境下是 `behaviorState`，“获得照片”语境下是 `card.rarity`。不要把两者合并或混用。

#### 不要破坏妹妹回复机制

当前机制：发给妹妹 -> 延迟到期 -> 进入力娅聊天并看到回复 -> `sisterKnowledgeUnlocked = true` -> 卡牌详情显示“妹妹的补充” -> 可触发 `pendingAutoCatalogue` -> 进入对应鸟种页自动加新。

不要改回“发送后立即显示妹妹补充”。不要改回“手动为它加新”为主流程。不要让妹妹回复直接绕过消息已读逻辑。

#### 不要重写自动加新流程

当前自动加新流程应保持：玩家发给妹妹 -> 看见到期回复 -> 设置 `pendingAutoCatalogue` -> 玩家进入对应鸟种页 -> 触发 `handleCatalogueAction()` -> 播放 reveal -> `markAutoCatalogueCompleted()`。

已知 reveal 判断兼容新旧文案：

- “你终于把它写进了笔记”
- “你终于知道了它的名字”

### 6. 后续 TODO

#### 浏览器手测

优先手测路径：

1. 初次发现任意鸟：确认没有提前出现正式鸟名。
2. 拍照结果：确认事件文本、卡牌标题、描述自然。
3. 打开笔记：确认 SEEN / CATALOGUED 两种状态正常。
4. 发给妹妹：确认消息延迟出现。
5. 力娅回复：确认回复出现后解锁“妹妹的补充”。
6. 自动加新：进入对应鸟种页后，确认 reveal / 加新完成效果触发。
7. 结算页：确认统一为“观察记录 / 笔记”体系。
8. 移动端：确认按钮和长事件文本没有撑开或拥挤。

#### P2 后续优化

可后续处理：

- 统一非玩家可见注释中的“图鉴”旧称。
- 评估是否压缩长按钮：“从这里开始：${spot.name}”“倾听远处的声音”“提前撤离并结算”。
- 评估 CSS reveal 文案：“※ 新的鸟影”“✦ 加新完成 ✦”。
- 逐步补充更多 cardId 专属妹妹回复，优先每种鸟的 REMARKABLE 卡、代表性的 INTERESTING 卡和玩家高频容易拍到的 NORMAL 卡。

## 2026-05-24 最新状态补充

以下为当前消息入口、手册入口、自动加新和 UI 颜色层级的最新状态；旧记录中关于“进入消息 / 手册会保留上次内部页”“玩家手动点击为它加新才完成加新”的描述作为历史保留，不再代表当前版本。

### 自动加新当前状态

- `collectedCards` entry 当前在妹妹回复字段基础上，兼容新增 `pendingAutoCatalogue / autoCatalogueReadyAt / autoCataloguedAt`。这些字段属于 collectedCard 层，不属于 snapshot；旧存档缺失时 normalize 为 `false` 或 `null`，LocalStorage key 仍是 `birdwatch_text_sim_field_guide_v3`。
- 玩家进入力娅聊天并查看到已到期妹妹回复时，`markDueSisterRepliesRead()` 除了写入 `sisterReplyReadAt` 和 `sisterKnowledgeUnlocked`，还会在尚未自动加新的卡牌上设置 `pendingAutoCatalogue = true` 与 `autoCatalogueReadyAt = Date.now()`。
- 自动加新只在玩家进入对应鸟种页时触发：`renderFieldGuide()` 查找该鸟种已收集卡牌中的 pending 项，复用既有 `handleCatalogueAction()` 完成 catalogued 写入并显示原有加新 reveal；动画完成后调用 `markAutoCatalogueCompleted()` 写入 `autoCataloguedAt` 并清除 pending。
- 手册首页不会批量处理 pending，加新不会在消息已读瞬间自动跳转手册；同一鸟种已 catalogued 或已 `autoCataloguedAt` 的卡牌不会重复播放加新动画。
- 当前不要恢复“仅靠手动【为它加新】按钮完成加新”的入口模型。旧 handler 可作为兼容 fallback 保留，但玩家可见流程应是“发给妹妹 -> 查看回复 -> 进入对应鸟种页自动加新”。

### 消息 / 手册入口当前状态

- 【查看消息】【打开手册】当前渲染在事件描述栏下方、主行动按钮上方的 `.utility-actions` 区域；消息 / 手册 inline panel 也跟随该区域下方展开。原顶部状态网格中的两个入口位置不再是按钮，当前作为静态信息块显示“天气 / 晴天”和“周围事件 / 暂无事件”。
- 每次从外部入口打开消息时，`messageView` 重置为消息列表；每次从外部入口打开手册时，`fieldGuideSpeciesIndex / fieldGuideDetailCardId / fieldGuideDetailSnapshotIndex` 重置到手册首页状态。消息聊天、手册详情和左右翻页仍是内部导航。
- inline panel 入场动画当前只在关闭 / 互斥切换到打开的当次 render 播放。`inlinePanelJustOpened` 是纯 UI 临时状态，不写入存档；探索行动、手册内部导航、消息内部导航和普通 render 更新不应重播整体 panel 入场动画。

### 当前颜色与按钮层级

- 当前 UI 色彩 token 已统一到米白纸感和低饱和按钮层级：信息面板使用 `--panel-bg / --panel-border / --panel-text / --panel-muted`；消息入口使用暖杏色 token；手册入口与次要按钮使用浅绿色 token；new / 未读 / 红点使用陶土橙 `--accent-new`。
- 消息面板当前是暖杏外容器 + 纸黄色 header + 米白列表 / 聊天内容卡片；这只改变消息 UI 视觉层级，不改变消息派生、红点、延迟回复或已读逻辑。
- `button-major` 仍代表最突出的主推进按钮；`button-secondary` 当前用于起始鸟点、返回、探索转向、远听、等待、继续拍摄、提前撤离等普通操作；不要把主推进按钮批量降级为 secondary，也不要把关闭 / 放弃类中性按钮重新归类为高权重按钮。

## 2026-05-23 最新状态补充

以下为当前笔记 / 卡牌详情页的最新状态；旧记录中关于卡牌详情页仍是独立白色面板、照片信息仍是四宫格信息块、文件夹外壳仍为较强绿色或 tab 小框的描述，仅作为历史记录保留。

以下同样覆盖 2026-05-22 旧记录中“发给妹妹后短信界面立即显示回复、妹妹知识立即补充到卡牌详情”的描述；该描述作为历史保留，不再代表当前版本。

### 短信 / 力娅聊天当前状态

- `collectedCards` entry 当前在原有 `cardId / snapshots / isIdentified / hasNewContent / sentToSister / sisterKnowledge` 基础上，兼容新增 `sentToSisterAt / sisterReplyDueAt / sisterReplyReadAt / sisterKnowledgeUnlocked`。这些字段属于 collectedCard 层，不属于 snapshot；旧存档缺失时 normalize 为 `null` 或 `false`，LocalStorage key 仍是 `birdwatch_text_sim_field_guide_v3`。
- 【发给妹妹】当前只记录发送状态，不自动打开短信、不自动进入力娅聊天、不推进回合、不消耗电量。首次发送会写入 `sentToSisterAt = Date.now()`、`sisterReplyDueAt = sentToSisterAt + 30000`、`sisterReplyReadAt = null`、`sisterKnowledgeUnlocked = false`；已发送卡牌再次触发时保持幂等。
- 力娅聊天不持久化一份独立消息数组，而是从 `collectedCards` 派生：每张已发送卡牌显示玩家拍立得消息和紧随其后的文本 `我拍到了「xxx」`，两条消息共用 `sentToSisterAt`；妹妹回复只在 `Date.now() >= sisterReplyDueAt` 后可见，显示时间使用 `sisterReplyDueAt`。
- 未读规则当前为：存在已发送、回复已到期、且 `sisterReplyReadAt` 为空或 `sisterKnowledgeUnlocked !== true` 的卡牌时，顶部【查看消息】和消息列表中力娅头像显示红点。打开消息列表不算已读，只有进入力娅聊天且回复已到期时，才写入 `sisterReplyReadAt` 并将 `sisterKnowledgeUnlocked` 置为 `true`。
- 卡牌详情中的“妹妹的补充”当前只在 `sisterKnowledgeUnlocked === true` 且存在 `sisterKnowledge` 时显示；仅发送给妹妹、或回复已到期但玩家尚未进入力娅聊天查看，都不会提前显示妹妹补充。
- 聊天历史区域当前有最大高度并在内部滚动；每条聊天消息显示现实时间。力娅聊天里的拍立得使用 `renderFieldGuideDetailPolaroid(..., { variant: "chat" })`，根节点带 `is-chat-polaroid`，badge scale 只在 chat variant 中 clamp，拍立得作为右侧独立图片消息显示，不再包进玩家绿色文本气泡。
- 维护边界：不要把 `sisterKnowledgeUnlocked` 退回为 `sentToSister` 的派生显示；不要把妹妹回复改回发送后立即可见；不要把聊天拍立得样式写成全局 `.field-guide-detail-*` 覆盖，避免影响手册详情页和拍照回放。

### 笔记文件夹外壳

- “打开笔记”后的外层文件夹背景当前使用非常弱的低饱和灰绿色方向，可称为“极淡苔痕绿”。它只承担文件夹外壳的轻层级暗示，不应抢内部浅纸页、卡牌纸片、拍立得和妹妹补充区。
- 文件夹外壳保持纯色：不引用 `folder-texture.jpg`，不引用 `kraft-folder-texture.jpg`，不使用外壳纹理伪元素，也不恢复粗糙边。
- `note-book-folder` 不使用 `paper-edge` / `paper-soft`；粗糙边只保留在内部纸页 / 特定纸条等既定范围。
- “观察笔记”当前是左上角文字，不是可点击 tab，也没有背景框、边框或小框形态。

### 卡牌详情页背景与结构

- 卡牌详情页根容器当前为 `note-book-page note-card-detail-panel`，目的是与鸟种页共用同一张大纸页的纸纹、粗糙边、padding 和外观比例。
- `note-card-detail-panel:not(.note-book-page)::before` 只作为 fallback。当前实际详情页不会额外叠加第二层详情纸纹，避免纸纹变脏或面板感过重。
- 卡牌详情页大结构顺序当前应保持为：卡片描述 -> `第 X 张照片 · 第 X 次拍到「卡名」 · 已留存 X 张` -> 妹妹的补充 -> 拍立得 + 右侧拍摄信息 -> snapshot 切换按钮 -> 发给妹妹 / 已发给妹妹。
- 统计行属于卡片记录信息，不属于拍立得旁注；它必须位于卡片描述之后、妹妹补充之前。
- 统计行使用阿拉伯数字格式，例如 `第 1 张照片 · 第 1 次拍到「晨光理羽」 · 已留存 2 张`；缺失数据显示 `—`，不要出现 `undefined / NaN / null`。

### 卡片描述与按钮视觉

- 详情页顶部卡片描述区域当前应与外部 `field-guide-card` 同源：背景使用 `--note-card-bg`，边框使用 `--note-card-border`，阴影使用 `--note-card-shadow`，错位底层与外部卡牌同源。
- 详情页卡片描述保留轻微倾斜，但不使用 SVG filter、不加粗糙边、不做强 hover，避免让玩家误以为它是按钮。
- 【返回笔记】按钮当前由 `.field-guide-detail-back.button-ghost` 单独控制，方向是更白、更小、有轻微小阴影的纸签按钮；它不应使用绿色 action 色，也不应覆盖发给妹妹按钮。
- 【发给妹妹】按钮仍是绿色行动按钮；`.note-card-detail-panel .field-guide-send-button` 继续保护其未发送状态样式，已发送状态仍应弱化显示。

### 详情页照片区

- 卡牌详情页照片区当前采用横向结构：左侧拍立得，右侧为拍摄时间 / 地点 / 电量 / 对焦。
- 右侧拍摄信息是纵向旁注，不再使用四个白色信息块，也不再有大背景色块。每一行都有独立轻微 rotate；电池 UI 跟随“电量”行一起倾斜。
- 拍摄时间使用当前游戏内时间段，不显示旧的“第 X 回合”；电量使用电池 UI，不显示纯文本百分比；对焦沿用现有 `focusScore / focusGrade` 展示逻辑。
- 当前关键布局数值：默认 `.note-detail-photo-and-meta { gap: 46px; transform: translateX(-20px); }`；`max-width: 560px` 下为 `gap: 24px; transform: translateX(-16px);`；`max-width: 390px` 下为 `gap: 16px; transform: translateX(-12px);`。
- 这些数值用于拉开拍立得与右侧文字，并让“左边缘 - 拍立得 - 文本描述 - 右边缘”的视觉间距更平衡。后续如果仍觉得拍立得偏右，不建议继续单纯增大负位移，应改为调整两列布局策略、容器宽度或视觉重心。

### 今日静态 QA 与待手测

- 已做静态 QA：`git diff --check` 通过，仅有 LF/CRLF 提示；未发现新增 `console.log` / `debugger` / `alert`；文件夹外壳保持纯色且没有外壳纹理引用；`note-book-folder` 不使用 `paper-edge` / `paper-soft`；`note-book-page` 仍保留纸纹与 `paper-edge`；详情页根容器已是 `note-book-page note-card-detail-panel`；详情页不会叠加第二层详情纸纹；详情页结构顺序静态看正确；右侧拍摄信息使用时间段、地点、电池 UI、对焦，并具备独立 rotate class；返回按钮样式不会覆盖发给妹妹按钮。
- 仍需浏览器手测：页面能否正常打开、是否白屏、控制台是否有运行时报错；鸟种页进入详情页是否无明显视觉跳变；390px / 375px / 360px 下照片区是否仍同一行且无横向滚动；gap 增大后右侧信息是否过于贴近右边缘；snapshot 翻页后拍立得和右侧信息是否同步更新；返回笔记、发给妹妹、刷新后存档保持等交互路径；返回按钮在移动端点击热区是否足够。
- 当前重点风险：照片区 `gap: 46px` 与 `translateX(-20px)` 仍需浏览器确认；详情页复用 `note-book-page` 后的视觉连续性需要截图确认；返回按钮变小后的移动端可点性需手测；详情卡片描述颜色需持续与外部卡牌列表保持一致。

## 2026-05-22 最新状态补充

以下为当前最新状态；旧记录中关于“图鉴”作为用户可见文案、拍立得定格后直接使用鸟种身份色、`collectedCards` 仅包含 `{ cardId, snapshots, isIdentified }` 的描述作为历史保留，不再代表当前版本。

- 当前用户可见入口与页面文案统一使用“笔记”，但内部模块、变量、函数和 LocalStorage key 仍沿用 `fieldGuide` / `birdwatch_text_sim_field_guide_v3`，不要为了文案同步去重命名内部结构。
- 顶部状态栏当前为 UI 派生显示：左上角合并“当前时间 / 当前电量”，当前时间由剩余回合映射为“清晨 / 上午 / 中午 / 下午 / 黄昏”并使用从清晨到黄昏逐渐偏红的颜色；右上角显示当前位置；“短信”和“笔记手册”为按钮式 UI 块，笔记手册复用原查看笔记入口。
- 拍照丰富度当前已接通距离、随机缩放和轨迹旋转：bird instance 创建时固定 roll `distance: near | medium | far`，near / far 可进入自然语言距离文本，medium 不额外提示；`finalScale = distanceScale * randomScale`，`badgeRotation` 基于轨迹方向平滑计算并 clamp。`distance / finalScale / badgeRotation` 都写入 snapshot 并用于动画拍立得和笔记详情回放，不参与 focusScore、cardDraw、飞走或合焦判定。
- 对焦框当前为固定 4:3 基准并已缩小到较克制尺寸，视觉中心不变；视觉变绿和按快门判定都依赖同一实际渲染 frame 换算，`scale / rotate` 不参与判定。
- `collectedCards` 当前标准 entry 为 `{ cardId, snapshots, isIdentified, hasNewContent, sentToSister, sisterKnowledge }`：`isIdentified` 仍保留用于未来辨认功能，`hasNewContent` 独立表示该 cardId 有玩家未点开查看的新内容，`sentToSister / sisterKnowledge` 只服务短信补充知识；这些字段都属于 collectedCard 层，不属于 snapshot。
- storage normalize / load 仍沿用 v3 key，不新增 schemaVersion；旧 `{ cardId, snapshot }` 会迁移为多照片结构，缺失 `isIdentified / hasNewContent / sentToSister` 时归一化为 false，缺失 `sisterKnowledge` 时归一化为 `[]`，坏 snapshot 过滤和 snapshots 排序仍保留。
- 当前“仔细辨认”UI 与已辨认状态通过 `ENABLE_CARD_IDENTIFY_UI = false` 暂停显示；不要删除 `isIdentified`、`identifyCollectedCard()`、`isCollectedCardIdentified()` 或相关迁移逻辑。笔记详情拍立得当前一律使用拍摄瞬间行为状态色，不因 `isIdentified` 显示鸟种身份色。
- CATALOGUED / 笔记页卡牌列表的 `new` 现在只表示 `hasNewContent === true`，不表示未辨认；玩家点击卡牌进入详情时调用 `markCollectedCardViewed()` 清除该卡 new 并保存。顶部“笔记手册”上的 `new` 由 `collectedCards` 中是否存在任意 `hasNewContent === true` 派生，不应写入额外手册级字段。
- 短信系统当前是“拍鸟 -> 发给妹妹 -> 知识补充写回卡牌详情”的轻量桥梁：短信入口打开气泡界面，卡牌详情中的“发给妹妹”会把配置化文本写入 `sisterKnowledge`，同 cardId 只发送一次；短信不会自动加新，玩家仍需回笔记手动点击“为它加新”。
- SEEN 状态现在也显示当前鸟种已拍到的卡牌 / 照片，避免未加新鸟无法选择照片发送；但鸟种主标题仍为“？？？”，`CATALOGUED` 前不应把鸟种身份层当作已知。卡牌表现层标题、描述和拍立得 badge 文本不受 `sentToSister` 控制。
- `data/sisterKnowledge.js` 当前提供妹妹知识配置：先查 cardId 专属文本，再按卡牌 rarity fallback；发给妹妹时生成一次并保存到 collectedCard，后续 render 只读取存档，不随机、不重复覆盖。
- 当前 snapshot 关键字段包括 `distance`、`finalScale`、`badgeRotation`、可选 `splitStop`、`focusScore / focusGrade / focusAffix`、`badgeRelX / badgeRelY`。这些字段用于照片回放和展示，不要把它们改成短信、加新、辨认或抽卡判断条件。

### 当前核心循环

- 小循环：拍鸟 -> 生成 snapshot / collectedCard -> 笔记手册出现 new -> 玩家进入笔记查看卡牌 -> 卡牌 new 消失 -> 玩家可点击“发给妹妹” -> 短信界面显示气泡回复 -> 妹妹知识补充到卡牌详情 -> 若是初见鸟，玩家仍需回笔记手动“为它加新”。
- 大循环规划：地图完成 -> 触发姐妹主线短信 -> 推动叙事 -> 解锁下一个地图。当前大循环尚未完整实现。

### 后续 TODO

- 短信历史持久化与未读短信 new 冒泡。
- 地图完成后触发姐妹主线短信，并由主线短信推动地图解锁。
- 妹妹知识文本扩写到更多 cardId，并继续美化笔记中的“妹妹的补充”区域。
- 是否恢复“仔细辨认”与鸟种身份色上色需要后续设计决策。
- 顶部 UI 移动端排版、对焦框尺寸、near scale、rotation 参数继续实机微调。
- 旧存档迁移回归测试，重点覆盖 `snapshots / isIdentified / hasNewContent / sentToSister / sisterKnowledge`。

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

## 当前信息系统状态：力娅消息外置化 Block 1～14B

### 已完成内容

- 新增 `data/liyaMessages.json` 作为力娅聊天回复外置文本池，当前约 39 条 `photo_sent` message。
- 新增 `src/liyaMessageSystem.js`，负责加载、fallback、校验、标准化、conditions 匹配、priority / specificity 排序和同层级稳定伪随机选择。
- `src/main.js` 已完成正式聊天回复的最小接入：力娅聊天里的妹妹回复文本优先来自 `selectLiyaMessages("photo_sent", photoContext, options)`。
- `createLiyaPhotoContext()` 已支持 `speciesId / cardId / cardTitle / timeOfDay / quality / composition / locationId / firstTimeSpecies / repeatSpecies / storyStage`，并补充 `sentToSisterAt / realTimestamp / cardIndex` 等稳定 seed 字段。
- 新增 `src/liyaMessageDevTools.js`，支持开发态命中自检、unknown condition 检查、`uncoveredByDevContexts` 和纯文本报告。
- 新增 `message-editor.html`，已从只读总览升级为开发用内存草稿编辑器，支持导入 JSON、编辑、实时校验、dev check、复制 JSON 和导出 `liyaMessages.json` 文件。
- Block 8 已把 `data/liyaMessages.json` 扩充到 39 条，覆盖首次新鸟、重复鸟、模糊、清晰、构图、清晨、黄昏、小老师式表扬、轻微吐槽、撒娇 / 讨好和轻量关系推进。
- Block 9 已让同 priority + 同 specificity 的候选使用稳定 seed hash 选择，不使用 `Math.random()` 或 `Date.now()`，不新增存档字段。

### Block 12：photo_reply 最小 pending queue 已完成

已完成：

- 发给妹妹时在旧字段写入成功后固定 selected `messageId`。
- 在对应 collected card entry 上创建 `entry.liyaMessageQueueItem`。
- 力娅聊天回复优先使用 queue item 的 `messageId` 读取 `data/liyaMessages.json` 文本。
- 旧存档没有 queue item、或 messageId 找不到对应消息时，继续走旧即时选择并 fallback 到旧 `sisterKnowledge`。
- `markDueSisterRepliesRead()` 仍按旧逻辑写 `sisterReplyReadAt / sisterKnowledgeUnlocked / pendingAutoCatalogue`，并同步 queue item `status = "read"` 与 `readAt`。
- `storage.js` normalize 会保留并清洗 `liyaMessageQueueItem`，旧存档缺失时为 `null`。
- `src/liyaMessageDevTools.js` 提供 `analyzeLiyaQueueItems()` 和 `formatLiyaQueueAnalysisReport()`，用于开发态只读检查 collectedCards 中的 queue item 状态一致性。

当前 queue item 的边界：

- 只服务 `photo_reply`。
- 暂时挂在 collected card entry 上，不是全局 pending queue。
- 一张发给妹妹的 card 最多对应一条 `photo_reply` queue item。
- `deliveredAt` 暂不写回，避免 render 阶段产生存档副作用。
- 红点已迁移为 queue 优先判断，旧字段 fallback。
- 手册“妹妹的补充”仍走 `data/sisterKnowledge.js` 和 `entry.sisterKnowledge`。
- queue 检查工具只报告 missing queue item、无效 messageId、due/read 字段不一致、基础结构问题等，不自动修复存档。

### 当前正式流程

1. 玩家在卡牌详情点击【发给妹妹】。
2. 仍使用原有 `sendCollectedCardToSister()` 写入 `sentToSister / sentToSisterAt / sisterReplyDueAt` 等状态。
3. 回复仍按既有 30 秒延迟到期。
4. 到期未读回复由 queue 优先判断触发红点；旧存档无 queue item 时回落旧字段判断。
5. 玩家进入力娅聊天后才查看回复、清红点并触发 `sisterReplyReadAt / sisterKnowledgeUnlocked`。
6. 聊天里的妹妹回复文本优先来自 `entry.liyaMessageQueueItem.messageId` 指向的 `data/liyaMessages.json` message；旧存档没有 queue item 时继续走即时选择 fallback。
7. 手册卡牌详情中的“妹妹的补充”仍来自旧 `data/sisterKnowledge.js` 写入的 `collectedCard.sisterKnowledge`。
8. 查看回复后解锁妹妹补充和自动加新逻辑保持不变。

### 当前仍未实现

- 主动消息。
- 不回复追问。
- 全局 pending queue。
- pendingMessages 运行时队列。
- 已读主逻辑迁移到 queue。
- 随机延迟。
- 随机 / 区间延迟。
- 上课 / 补习状态机。
- storyStage 推进。
- cooldown 运行时消费。
- sentMessageIds 持久化。
- 手册“妹妹的补充”迁移到 `data/liyaMessages.json`。
- message-editor 自动写回项目文件或接入正式游戏入口。

### 下一步建议

- 先用 `analyzeLiyaQueueItems()` 做 collectedCards 中 queue 状态检查，避免后续迁移基于不一致存档继续开发。
- 再考虑红点判断迁移到 queue，但不要和主动消息同轮混做。
- 主动消息应在红点 / 队列基础稳定后再做，建议先写状态设计文档，明确触发条件、去重、已读、红点和与现有 30 秒回复的边界。
- 如果要迁移手册妹妹补充，需单独设计 `sisterKnowledge` 与 `liyaMessages.json` 的关系，不要直接删除 `data/sisterKnowledge.js`。

## 当前阶段结论：力娅 photo_reply 消息系统 MVP

### 已完成

- 外置文本池：`data/liyaMessages.json`（约 39 条 `photo_sent`）。
- 消息选择系统：`src/liyaMessageSystem.js`（conditions / priority / specificity / 稳定伪随机）。
- 开发工具链：`src/liyaMessageDevTools.js` 与 `message-editor.html`（导入、编辑、校验、触发反查、导出）。
- photo_reply queue：发送后在 entry 上固定 `liyaMessageQueueItem.messageId`，聊天优先读 queue。
- 红点判断已迁移为 queue 优先，旧字段 fallback 兼容（`sisterReplyDueAt / sisterReplyReadAt`）。

### 当前仍保留的旧逻辑

- 30 秒延迟仍沿用既有流程与旧字段时序。
- 已读解锁仍由 `markDueSisterRepliesRead()` 维护 `sisterReplyReadAt / sisterKnowledgeUnlocked / pendingAutoCatalogue`。
- 手册妹妹补充仍来自 `data/sisterKnowledge.js` 和 `entry.sisterKnowledge`。
- 自动加新仍走旧逻辑，不由新消息系统接管。

### 当前未实现

- 主动消息。
- 不回复追问。
- 全局 pending queue。
- 随机 / 区间延迟。
- 上课 / 补习状态机。
- storyStage 推进。

### Block 15 手测状态

- 本轮已新增手测清单文档：`docs/DevLog/LIYA_PHOTO_REPLY_SMOKE_TEST.md`。
- 受环境限制（无可用 `python/node/php` 静态服务运行时，且无本地浏览器自动化入口），运行时 A～I 手测项本轮均标记为“未测”。

### 下一步建议

- 在可用 `http://localhost` 测试环境完成 A～I 手测项后，再确认是否进入主动消息 MVP 设计。
- 若手测暴露问题，先修复 photo_reply 主链路，再推进行为感系统扩展。

## 今日状态补充：力娅消息系统与开局聊天记录（2026-05-26）

### 已完成 / 已进入稳定阶段

- `message-editor` 触发情况反查已完成，文本生产工具链基本收束（导入、草稿编辑、校验、命中预览、触发反查、导出）。
- `photo_reply` MVP 主链路已形成：外置文本池、queue 固定 `messageId`、红点 queue 优先、旧字段 fallback。
- 首次鸟种认鸟与普通回复语义已明确区分：认鸟文案使用 `speciesName`，普通照片评价可使用 `cardTitle`。
- 运行时近期去重方向已明确：通过最近 `sentMessageIds` 降低普通高优先级文案重复命中。

### 今日发现 / 修复方向

1. 连续发送照片时，聊天应按真实时间线排序，不应强制“一张照片一条回复”分组。
2. 真实时间线下，力娅回复需要轻量引用条：`↳ 回复你的照片：「{cardTitle}」`，减少阅读歧义。
3. 玩家停留在力娅聊天页且新消息完整可见时，应自动视为已读，避免无意义红点残留。
4. 首次认鸟必须显示 `speciesName`，不能把 `cardTitle`（照片名）当鸟名。
5. 普通回复重复率偏高时，应依赖近期去重而不是单条超高 priority 长期压制。

### 开局静态聊天记录设计

- 预设联系人：陈老师、妈妈、苗苗（消息灵通）。
- 叙事用途：力娅拍鸟委托与姐妹关系、妈妈家庭压力、苗苗职场悬念与“那件事”伏笔。
- 默认历史消息为已读（不开局红点）；预留 `read=false` 静态消息能力。
- 静态历史消息边界：不参与 `photo_reply` queue、不参与 30 秒延迟、不触发自动加新、不解锁妹妹补充。

### 当前仍未实现

- 主动消息。
- 不回复追问。
- 全局 pending queue。
- 随机 / 区间延迟。
- 上课 / 补习状态。
- storyStage 推进。
- 多联系人动态消息体系。
- 静态消息 `read=false` 的正式文案投放（当前仅能力预留）。
## 2026-05-27 当前状态补充：消息体验、UI 扁平化与拆分计划

### 已完成
- 力娅 `photo_reply` 多行 `lines` 分气泡渲染已接入运行时：多行按多个气泡显示，`message.text` 兼容保留，`message.lines` 用于多气泡渲染。
- 单行 `lines` 仍是单气泡；旧消息仅 `text` 时仍走单气泡 fallback。
- 引用条仅在同条消息第一气泡显示一次；玩家拍立得消息、玩家“我拍到了”文本、妈妈/苗苗/静态消息链路不变。
- 顶部第一行布局已微调：左侧位置，右侧时间+电量（仅布局顺序调整，不改数据与样式体系）。

### 已实现但待手测
- 未读且首次查看的多行 `photo_reply` 逐行动画：第一行立即出现，后续按延迟逐条显示；已读消息不重复播放；刷新后已读不重复播放。
- 动画状态仅页面内存态（不写 `localStorage` / `gameState`）。
- 聊天滚动保持策略已接入：渲染前记录容器滚动状态，渲染后按 near-bottom 或相对位移恢复；不操作 `window` 滚动。
- 聊天详情区高度扩大到原来的约 1.5 倍，并保留内部滚动与小屏上限。
- 力娅逐行消息间隔参数已调整为翻倍目标：`500 / 70 / 1900`（BASE / MULTIPLIER / MAX）。
- UI 扁平化视觉语言已实现一版：顶部信息去卡片感、事件栏保留短绿条、按钮改底部厚度体系、消息/笔记面板去外阴影、入口按钮 idle/active 颜色分层。

### 已发现问题
- 三行消息场景下，最后一行出现后触发 `mark read -> render` 仍可能出现“聊天回到顶部”的边界风险。
- 根因判断：最后一行后的已读刷新 render 与滚动恢复时序竞争，导致恢复基准可能被覆盖。

### 待补丁
- 最后一行出现并触发 `mark read` 前后，强制使用同一份聊天滚动快照做恢复：
  - 用户在底部：保持底部阅读；
  - 用户在历史位置：保持当前阅读位置；
  - 仅操作聊天容器，不操作 `window`。
- 补丁完成后补做三行消息专门回归（第三行出现瞬间、红点消失瞬间、重进聊天）。

### 设计决策
- 当“力娅正在逐行动画回复”且玩家位于力娅聊天页时，建议暂时限制继续发送（UI 级临时态，不写存档）：
  - 仅限制该时刻，不扩展为“所有未读都禁发”；
  - 可用按钮 disabled + 轻提示（如“力娅正在回复…”/“等力娅说完再发吧。”）；
  - 目的：避免上下文错位与连续发送导致理解负担。

### 待实现
- “力娅说话时临时禁发”尚未接入运行时（仅有设计决策，未落代码）。

### 后续计划
- `main.js` 体量过大（已接近/超过 4k 行）导致定位与改动成本上升，下一阶段优先做消息面板 UI 层纯搬迁：
  - 计划文件：`src/ui/messagePanel.js`（计划中，尚未创建）。
  - M1 范围：消息列表/线程渲染、多气泡渲染、引用条、聊天滚动辅助、逐行动画调度与 timer 清理、可见判断 UI 辅助。
  - 暂不拆：业务状态、存档结构、queue 结构、红点判定、已读语义、fieldGuide 业务模块。
  - 验收：行为不变（消息列表、线程打开、photo_reply、逐行动画、红点消失链路均保持）。

### 测试状态
- Codex 环境未执行浏览器手测；当前仅完成静态检查与用户目测反馈汇总。
