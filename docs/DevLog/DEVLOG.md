# DEVLOG

## 2026-06-16

- 为探索阶段的【观察当前方向】【向左转】【向右转】补入“动作仪式感”过渡层：`src/main.js` 新增仅作用于探索态的 `isActionTransitioning` / `actionTransitionTimerId` 和随机延迟规则，点击后会先执行 `handleExploreAction()`、立即显示过渡文本、临时禁用行动按钮，再在延迟结束后统一 render；`listenDistant`、PHOTO / FOCUS / RESULT、天气、周围事件和小地图方向逻辑保持原语义不变。
- `src/encounterSystem.js` 的 `observeCurrentDirection()` 新增 `type: "bird" | "clue" | "empty"`，`src/gameSession.js` 在 observe 分支写入 `lastObserveResultType` 供顶层 UI 选择延迟时长；empty 结果会额外从 `data/spots.js` 的 `ambientDetails` 中拼接当前鸟点 × 朝向的环境细节，但观察日志仍只记录主结果文案，不把环境细节写入日志。
- 为现有三个鸟点补齐方向级环境细节池：`data/spots.js` 为 `pond_bank`、`garden_edge`、`old_tree_shadow` 增加 `ambientDetails`，`src/spotManager.js` 新增安全 fallback 的 `getRandomAmbientDetail(spotId, directionIndex)`；该改动只补探索态空观察的阅读体验，不新增鸟点、不修改 `speciesWeights`、默认起点、存档 key 或拍摄流程。
- 顶部 UI 改为稳定的探索态 / 拍摄态双态：`src/main.js` 新增仅用于顶栏判断的运行时语义 `isCameraRaisedForTopUi`，点击【举起相机】或【继续跟焦】后保持拍摄态顶栏，【再等一等】不再因为 `photoPhase` 回到 `DECISION` 而误切回探索态；退出 PHOTO、进入下一天、重开或重置时再统一清回探索态。本轮只修顶部 UI 判断，不修改 PHOTO / FOCUS / RESULT 状态机、存档 key 或拍照规则。
- 将探索态顶部右侧状态块改为正式“周边地图”承载位：探索态时顶栏右侧直接渲染小地图，拍摄态时仍渲染原有拍摄时机窗口；`syncObservationMapPresentation()` 改为同步全部 `[data-observation-map]` 实例，地图正前方标签额外高亮，位置卡同步收敛为只显示当前鸟点名称，不再显示 `当前鸟点 · 当前面向`。该调整只改变 UI 编排和显示文案，不改真实方向判断、天气系统或事件提示逻辑。
- 收束探索态顶部小地图视觉：`styles/style.css` 为顶栏地图块新增 `status-photo-timing.is-map` 样式，地图底色与拍摄态取景器表面色统一；移除旧内层深色渐变框、节点胶囊和中心竖胶囊，改为单层浅底、纯文字标签、中心十字，并通过 `.observation-map__item.is-front` 强化当前正前方向标签。本轮只改展示，不改旋转逻辑、文字正向逻辑或小地图数据来源。
- 精简主界面冗余展示：探索主界面默认隐藏【观察区域】详情块、【观察日志】、主界面额外【拍照时机】面板，以及玩家可见的【选择初始鸟点】列表；`detailPanel` 在默认探索态、PHOTO 和隐藏的初始鸟点选择态下直接收起，仅在 FIRST_ENCOUNTER、FIELD_GUIDE、SETTLEMENT、重置确认等仍需要内容的模式下显示。该调整不删除日志数据、起始鸟点 helper、Debug 用能力或 overlay 结构。
- 玩家从 START 开始当天观鸟时不再经过主界面的初始鸟点选择 UI：`src/main.js` 改为读取 `getStartSpotChoices()` 的首个可用鸟点并直接调用 `startGameAtSpot()` 进入默认地点；`START_SPOT_SELECT` 与 `startSpot` 相关底层 helper 仍保留为隐藏 fallback / 调试入口，不修改 `data/spots.js`、默认起点数据或 `gameSession.js` 的起点解析规则。

## 2026-06-12

- 仅更新 `docs/DevLog/DEVLOG.md`、`docs/DevLog/DEVLOG_CURRENT_STATUS.md`、`docs/DevLog/CODE_MAP.md`，同步当前仓库已落地实现但文档仍未跟上的状态；本轮不修改运行时代码、数据文件、样式文件或 `index.html`。
- 补记当前事件提示实现现状：此前文档写成 `.status-grid` 与 `.event-box` 之间存在独立 `#eventHint`，但实际代码已改为由 `src/main.js` 把 `src/eventSystem.js` 的 `getDisplayText()` / `isActive()` 渲染进顶部状态栏“周围事件”卡片，`index.html` 不再保留独立事件提示节点；当前高亮表现由状态卡 active 标记和一次性 pulse overlay 共同完成。
- 补记当前天气系统边界：`src/weatherSystem.js` 已接入运行时，`src/gameState.js` 新增 `weather.current / switched / initializedForDay`，`src/gameSession.js` 在 `startGameAtSpot()` 中幂等初始化当天天气、在 `advanceTurn()` 中尝试局内切换，并把 `weatherKey` 写入照片 snapshot；本次只同步文档，不改天气逻辑或回合语义。
- 补记当前 RESULT 页发妹妹按钮与说明文案现状：`src/main.js` 已接入 RESULT 页一键发妹妹入口，首次发送后保留 disabled「已发给妹妹」按钮；历史已发送照片再次拍到时不再显示按钮，而是在 RESULT 描述末尾补一句「之前也给妹妹发过这张。」；该链路复用现有 collected card / `liyaMessageQueueItem` 语义，不新增存档 key，也不改消息选择逻辑。
- 顶部状态栏移除独立“方向”状态格，当前位置改为合并显示 `当前鸟点 · 当前面向`；探索详情区下方同步把旧 `map-grid` 文本地图替换为独立 `observation-map-panel`，用盘面 90 度步进旋转、地点文字反向旋转和“上下更近、左右更远”的点位分布展示四向环境文案；本轮只改 UI 结构与动画，不改变真实方向判断、事件提示逻辑、天气系统或 PHOTO / FOCUS / RESULT。
- 为顶部“周围事件”状态格补充一次性褪色反馈：`src/eventSystem.js` 新增 pulse key，`src/main.js` 在每次新事件真正显示时重播 `is-event-pulse`，`styles/style.css` 用伪元素 overlay 实现约 1400ms 的连续 fade-out；本轮不改变事件文本显示时长、事件队列、cooldown、`scanSideEvents` 左右方向计算或 `WEATHER_CHANGE` 逻辑。
- `SETTLEMENT` 新增“整理今天的观察”展开区：`src/gameState.js` 为单局状态补入 `nightReviewStats.sentToSisterCount`，发送照片给妹妹时累加，结算页可手动展开夜晚整理文案总结当天照片、天气、加新和发妹妹数量；该补充只影响结算展示，不改变 `session_end` / survey flush、休息到明天、Liya queue 结构或存档 key。

## 2026-06-11

- 新增 `src/eventSystem.js` 作为轻量事件提示系统：在 `EXPLORE` 阶段根据当前左右侧活跃鸟实例生成短句提示，文案只显示“左侧 / 右侧”的声响、动静或鸟影，不显示正式鸟名；提示类型由 `data/species.js` 新增的可选 `hintType` 决定，基础参数由 `data/config.js` 新增 `EVENT_HINT_*` 常量统一配置。
- `index.html` 在 `.status-grid` 和 `.event-box` 之间新增独立 `#eventHint` 容器，`styles/style.css` 增加对应显隐、闪现和 reduced motion 样式；该提示块与主事件描述 `#eventText` 分离，不改原事件文本链路，不接入 bottom nav、overlay、消息或笔记 UI。
- `src/main.js` 初始化事件提示系统并注入 `gameSession`，同时在重新开始、切换到下一天、重置存档和开始新局时统一清理提示队列与冷却状态；未修改 analytics / survey、LocalStorage key、PHOTO / FOCUS / RESULT、消息系统或笔记系统。
- `src/gameSession.js` 新增 `setEventSystem()` 注入入口，并在 `EXPLORE` 阶段的“转向后推进回合”和“远听后前往新鸟点并落地”两个时机按概率触发侧向提示扫描；该扫描只补充轻量环境反馈，不改变回合推进、刷鸟、拍照、结算或问卷业务语义。
- 修复事件提示方向几乎总是显示“右侧”的问题：`scanSideEvents(state)` 现改为分别构造左侧与右侧候选，只在对应方向有鸟且通过同鸟点同方向冷却时入池，再从可用候选中随机选一侧；保留同一 `spotId + dirIndex` 冷却，不改触发阶段，也不把提示改成无方向文本。

## 2026-06-05

- 调整测试者入口与局后问卷展示：`Q0 / Q-pre` 改为结算面板内的轻量表单与单选卡片，隐藏开局时的工具按钮和行动按钮；局后问卷从旧 `Q1-Q11` 改为 `playtest2_driving_force_v1` 的 `Q1-Q12` 驱动力问卷，并新增 `birdwatch_playtest2_driving_survey_done` 作为本设备是否已完成该问卷的显示判断。
- 收口结算问卷 UI 与提交链路：问卷入口改为【填写反馈】和二级确认，问卷表单页只显示问卷内容和提交按钮；提交或跳过都会通过 `flush({ reason: "session_end", finalizeSession: true })` 完成本局上报，`payload.survey` 直接保存 `submitted / skipped / version / q1-q12 / interview_willing` 等字段，不再沿用旧的嵌套 `answers` 结构。
- 修复 Liya 聊天分句播放后的跳顶问题：消息面板新增 `data-scroll-anchor` 锚点和 thread 级滚动恢复状态，最后一句完成时提前处理已读并避免 completion 阶段重复 render；同时清理切换线程 / 关闭消息时的 pending scroll restore，避免跨线程复用滚动状态。
- 将发送照片后的 Liya 回复到期时间从固定 30 秒调整为 1-2 秒随机延迟：`sendCollectedCardToSister()` 和 queue item fallback 共用短延迟语义，仍保留 `sisterReplyDueAt`、queue item、红点、已读解锁和自动加新旧字段结构。
- 开局独白新增按段落淡入展示，FIRST_ENCOUNTER / 普通事件文本增加当前鸟点和鸟名相关词的 `event-emphasis` 加粗；结算【今天的收获】展开 reveal 改为只在首次展开时播放，后续返回或二次 render 不重播完整 reveal。
- 精简结算【今天的收获】视觉层级并统一暖色：折叠态去掉卡片套卡片结构，hover 从浅绿色改为浅杏色，展开正文和照片条目改为深棕 / 杏色调；不修改结算统计计算、NEW 判断、dayIndex 递增或 session_end 时机。
- 在手册 / 笔记底部新增【关闭手册】按钮：手册空态、鸟种列表页和卡牌详情页底部都会渲染该按钮，点击复用现有 `data-action="fieldGuide"` 关闭逻辑；不新增独立关闭状态，不修改手册数据结构或自动加新流程。
- 修复【打开笔记 / 收起笔记】按钮 active 状态下 `new` 标记消失的问题：`hasAnyNewCollectedCard(gameState.fieldGuide)` 现在同时作用于打开和收起两种文案，active 只影响按钮文案和 class，不改变 new 判定或清除时机。
- 调整 `data/liyaMessages.json` 中指定 `photo_reply` 文案，降低“交作业 / 老师 / 批改 / 加分 / 盖章 / 扣分”密度；保留 tags 中的小老师风味，但把清晰照、模糊偏边、重复同种、清晨和 6 条物种专属加新收尾改为更自然的现场感、共同拥有和不完美也值得留。
- 将【提前撤离并结算】从 `button-secondary` 改为默认弱化按钮样式，与【放弃拍摄】同级；只调整按钮 class，不修改 `retreat` action、提前结算功能、PHOTO / FOCUS / RESULT 状态机、analytics 或进入下一天逻辑。
- 本轮改动涉及问卷 UI / survey payload 字段、消息滚动与 Liya 回复延迟、手册入口、结算视觉和 Liya 文案；未修改鸟种 / 卡牌 / 鸟点数据、PHOTO / FOCUS / RESULT / REPOSITION / LOST 核心流程、对焦判定、所见即所得抽卡或 field guide 主存档结构。

## 2026-06-04

- 修复 analytics `local_fallback` 同页连续多局串局问题：`ANALYTICS_ENDPOINT` 为空时，`flush()` 仍生成完整 payload 并保留给开发检查，但现在会先保存 `lastPayload` 的副本，再清空当前内存 `events[]`；不发网络请求，不写 retry payload，不清 `tester_uuid`、`session_index` 或既有 retry cache。
- 接入 `Q0 / Q-pre` 测试者身份入口：新增独立 LocalStorage key `birdwatch_text_sim_tester_profile`，首次无 profile 时会在开局前先收集观鸟经验和可选昵称；`track()` / `flush().identity` / `session_start` 默认带上 `tester_id`、`tester_level`、`tester_level_text`，`resetSave({ clearGameProgress: true })` 也不会清掉这份 profile。
- 结算页接入 `Q1-Q11` 与 `interview_willing` 的最小闭环：进入 `SETTLEMENT` 时先记录 `session_end`，等玩家提交或跳过问卷后再 `flush()`，并把当前局问卷写入 `payload.survey`；“休息到明天清晨”在问卷决策前保持禁用，避免 survey 串到下一局。该改动不修改 analytics 顶层结构 `identity / session / events / survey`。
- CloudBase `analytics-ingest` 云函数改为把完整前端 analytics payload 写入固定集合 `analytics_payloads2`，并在顶层冗余保存 `session_id`、`tester_uuid`、`event_count`、`event_types`、`has_survey` 等筛选字段；随后修复 `server_ts` 使用 `command.serverDate()` 导致 `db_write_failed` 的问题，改为普通服务端时间 `new Date()`。
- 本轮实际改动集中在 analytics、测试者身份、局后问卷和 CloudBase 落库闭环；未修改 PHOTO / FOCUS / RESULT / REPOSITION / LOST 流程、对焦判定、图鉴主结构、消息 UI 语义或既有业务 LocalStorage key。

## 2026-06-03

- 顶部主标题从《认鸟手信》切换为动态游戏日文案 `裸辞之后，观鸟的第 x 天`：新增独立 LocalStorage key `birdwatch_text_sim_day_index`，默认第 1 天；仅在结算页点击【休息到明天清晨】时递增，刷新页面、打开消息、打开笔记、进入结算页本身都不会推进天数。
- 标题文案补充中文排版窄空格：动态标题与 HTML fallback 统一改为 `第 x 天`，仅调整显示文本，不改 dayIndex 存储 key、递增时机或其他 UI。
- 笔记中的“加新于 xx:xx”改为“加新于第 x 天”：在 `speciesRecords` 中追加 `cataloguedDayIndex`，首次加新时写入当日的观鸟日序号；旧存档缺失该字段时安全 fallback 为第 1 天；保留 `cataloguedRealTimestamp` / `autoCataloguedAt` 等现实时间字段，不改自动加新语义。
- 聊天详情页隐藏现实时间戳：不再渲染每条消息旁的 `00:34` 一类现实时间；底层时间字段、消息排序、未读逻辑、Liya 分句动画和 preview 最后一句逻辑不变。
- Liya 多句回复串行与滚动稳定性继续修正：未轮到启动的后续消息整条不预渲染，避免头像框或首句提前露出；最后一句完成时避免重复 render 导致跳顶；相邻两条回复之间增加很短的链路停顿，并用暂停锁阻止聊天页 render 抢先启动下一条。以上只修动画启动与滚动恢复，不改 queue item 结构、未读计数语义或消息选择逻辑。
- 修复打开/收起笔记会误清除【查看消息】未读数量的问题：根因是 `fieldGuide` toggle 路径误调用 `clearLiyaLineAnimationTimers()` 清空了 `liyaAnimatedLineCounts / animatingLiyaMessageIds` 等页面内存态；现已移除该误清理。该修复不写入已读字段，不改变 `sisterReplyReadAt / sisterKnowledgeUnlocked / queueItem.status / readAt` 语义。
- 【查看消息】按钮未读提示改为红色数量胶囊，并按“已投递且未读的 Liya 分句数”计数；旧 text 单行回复按 1 计数；同时把消息列表 preview 改为多行消息的最后一句。该改动不改变已读写入边界：打开消息列表不清未读，只有进入力娅聊天且到期回复真实可见时才写入已读。
- 针对窄屏手机端，修复【查看消息】按钮带未读胶囊时换成两行的问题：工具按钮内部改为强制单行的 inline-flex/nowrap 布局，未读胶囊与文字都禁止换行；在更窄屏下允许两个工具按钮整体改为单列，但单个按钮内部仍保持一行。
- 将【重置游戏存档】按钮从笔记界面移出，改放到主界面【观察日志】下方的独立底部区域；重置逻辑、确认流程、保留 tester uuid / analytics retry / session index 的行为不变，只做 UI 搬迁和新的点击接线。
- 本轮同步的是当前代码已实现状态：未修改 PHOTO / FOCUS / RESULT 主流程、对焦判定、LocalStorage 业务 key、消息队列数据结构、自动加新触发条件或 analytics 事件语义。
## 2026-06-02 playtest2 补充整理（Liya / 刷新规则 / 对焦 / 结算）

### 最新状态摘要
- 当前分支：`playtest2`
- 当前阶段：二测 / 三测前稳定性整理
- 本轮为 DevLog 补记；不改运行时代码。

### 本轮关键补记
1. **Liya 消息库加载链路修正**
- 聊天里妹妹回复的运行时数据源是 `data/liyaMessages.json`。
- `data/sisterKnowledge.js` 只负责图鉴 / 手册卡片详情里的“妹妹补充”，不驱动聊天回复。
- 本轮再次确认：问题更准确的描述不是“JSON 永久 fallback 锁死”，而是：
  - 启动时 `loadLiyaMessages()` 异步加载外部 JSON；
  - 首帧 `render()` 可能先触发 `ensureMessageData()`，同步落到 fallback；
  - 外部 JSON 后续能成功覆盖 fallback；
  - 但若加载完成后没有主动 render，UI 可能停留在旧文本 / fallback。
- 当前已按最小修改补上：
  - `src/liyaMessageSystem.js` 区分“当前已有可用数据”与“外部 JSON 是否已完成成功/失败决议”；
  - 保留同步 fallback，避免早期读取崩溃；
  - 外部 JSON 成功后可覆盖临时 fallback；
  - `src/main.js` 在 `loadLiyaMessages()` 完成后主动触发一次安全刷新；
  - 若消息面板已打开，则走保滚动刷新，不打断当前聊天滚动位置。
- 相关文件：`src/liyaMessageSystem.js`、`src/main.js`、`data/liyaMessages.json`

2. **初始未读消息、未读分隔线与红点语义收口**
- 启用妹妹初始已发未读消息：玩家初次进入游戏时，消息入口直接显示红点。
- 初始消息改为分句展示，并加入轻量颜文字，语义明确为：
  - 不认识的鸟先发给妹妹；
  - 不要自己偷偷查；
  - 妹妹来认。
- 聊天线程加入“以下为新消息”分隔线。
- 当前语义已收口为：
  - 红点：反映**实时 unread**；
  - 分隔线：反映**本次打开聊天时，哪些消息属于新消息**。
- 已修复：
  - 第一次打开消息后，初始消息能正确标记已读并清红点；
  - 不需要退出再打开才清红点；
  - 分隔线不会因为同一轮已读写入而立刻消失；
  - 聊天在已读刷新 / delayed render 后不跳顶。
- 相关文件：`data/initialMessages.js`、`src/main.js`、`src/ui/messagePanel.js`、`styles/style.css`

3. **Liya 多照片回复稳定性继续确认**
- 单条多行回复可后台自动推进，不依赖聊天面板保持打开。
- 连续发送多张照片时，多条回复按发送顺序串行播放：上一条完整说完后，下一条才开始。
- 已修复本轮确认过的问题：
  - 第二条回复只显示第一句；
  - 初次打开聊天后红点不消失；
  - delayed render 后聊天跳到最顶端。
- 当前明确未做、且仍列为高风险重构项：
  - `renderableMessages`
  - 分句级 `sortAt`
  - `lineDeliveredAts`
  - 玩家照片插入 Liya 分句中间的精确时间排序
- 相关文件：`src/main.js`、`src/ui/messagePanel.js`

4. **first_species 聊天文本改为按鸟种专属命中**
- 本轮再次确认：聊天里的“第一次把某种鸟发给妹妹 / 加新”文本，应改 `data/liyaMessages.json`，不是 `data/sisterKnowledge.js`。
- 当前数据已存在 6 条按 `conditions.speciesId + firstTimeSpecies` 命中的专属消息：
  - `sparrow`
  - `blackbird`
  - `kingfisher`
  - `mandarin_duck`
  - `red_billed_magpie`
  - `night_heron`
- 处理方式是**新增 speciesId 专属 first_species 消息**，通用 first_species 继续保留为兜底；未改消息选择算法。
- 文案目标已切到“妹妹认鸟 + 提示识别点 + 明确加新反馈”的口吻。
- 相关文件：`data/liyaMessages.json`

5. **聊天联系人备注与头像字同步调整**
- 联系人备注当前为：
  - `liya`：`妹宝（小鸟大王）`
  - `mother`：`妈妈 5.12`
  - `miaomiao`：`小苗 6.3`
- 妹妹头像显示字已从 `陈` 改为 `妹`。
- 生日格式统一为简约写法，不使用 `5月12日` / `6月3日` 或括号格式。
- 相关文件：`data/initialMessages.js`、`src/main.js`

6. **鸟类刷新规则：翠鸟 / 鸳鸯收口到池塘边**
- 当前规则已调整为：
  - 翠鸟和鸳鸯只在 `pond_bank` / 池塘边刷新；
  - 鸳鸯只在池塘边方向索引 `[0]`（`北侧芦苇`）刷新；
  - 翠鸟保留方向索引 `[3]`；
  - 翠鸟只在 `afternoon` / `dusk` 刷新。
- 实现方式保持数据驱动：
  - `speciesDirectionRules`
  - `speciesTimeRules`
- 时间过滤放在鸟生成流程，不把具体鸟种 id 写死在抽取函数里。
- 开局和切点生成已按实际到达回合传递时间上下文。
- 相关文件：`data/spots.js`、`src/birdManager.js`、`src/gameSession.js`

7. **对焦徽章入场范围收窄**
- 只调整了对焦徽章入场参数：
  - 收窄起点随机范围；
  - 收窄目标点范围；
  - 收窄弧线控制偏移。
- 保留不变：
  - `requestAnimationFrame` 动画链路
  - 入场延迟 / 时长
  - 对焦判定
  - snapshot 结构
  - steady-state focus runtime
- 目标是让徽章更像“从取景框边缘附近进入”，而不是从很远处飞入。
- 相关文件：`src/main.js`

8. **结算页仪式感增强继续保留**
- 当前 `SETTLEMENT` 视觉层已包含：
  - 暖黄色事件描述与左侧色条；
  - `今天的收获` 默认折叠；
  - `休息到明天清晨` 位于收获模块下方；
  - 两者延迟渐显；
  - 修复“留下的照片”鸟名后异常字符。
- 该部分仍属于 UI 层改动，不改变结算业务语义。
- 相关文件：`src/main.js`、`styles/style.css`

### 修正说明
- 修正旧认知 1：`data/sisterKnowledge.js` **不是**妹妹聊天回复数据源；它只影响图鉴 / 手册卡片详情。
- 修正旧认知 2：`liyaMessages.json` 当前工作区已确认为可解析 JSON；聊天显示旧文案的主要风险不再是“永久 fallback 锁死”，而是“早期 fallback 可见 + 外部消息库加载完成后缺少主动 UI 刷新”。
- 修正旧认知 3：图鉴卡片详情里的“妹妹补充”写入 `fieldGuide.collectedCards[].sisterKnowledge` 后，会作为存档内容继续复用；修改 `data/sisterKnowledge.js` 不会自动刷新旧卡片详情。

### 当前风险点
1. **聊天高耦合区**
- `src/main.js` 与 `src/ui/messagePanel.js` 仍是 Liya 消息高风险区域；连续多图、已读刷新、延迟渲染、滚动保持仍需回归。

2. **消息数据与存档复用**
- 聊天队列保存的是 `messageId + context`，不是完整 `lines`；同一 `messageId` 改文案后理论上可随重渲染生效。
- 图鉴补充保存的是完整 `sisterKnowledge` 文本；旧卡片不会自动吃到 `data/sisterKnowledge.js` 新文案。

3. **Analytics 边界**
- `CLIENT_VERSION` 仍只用于 analytics，不承担资源缓存失效职责。
- `resetSave` 默认只清游戏进度，不清 tester uuid / analytics retry / session index。

### 当前回归建议
1. **Liya 消息**
- 首次进入消息：红点出现，初始消息分句展示，“以下为新消息”位置正确。
- 首次打开后：红点按当前 unread 状态即时消失；分隔线保留到本次会话结束；聊天不跳顶。
- 连续发送 2~5 张照片：按顺序逐条回复，不交错，第二条不丢句。
- `liyaMessages.json` 加载完成后：UI 应吃到外置消息文案，不应长期停留在 fallback。

2. **图鉴 / 手册**
- 已发给妹妹的旧卡片补充文本是否来自存档，需与 `resetSave` 后新卡片做对照验证。

3. **刷新与对焦**
- 翠鸟仅在 `afternoon` / `dusk` 的 `pond_bank` 出现；
- 鸳鸯仅在 `pond_bank` `[0]` 出现；
- 对焦徽章入场应更靠近中心附近，不再大弧线远距飞入。

### 下一步建议
1. 先以当前状态做一次完整 playtest2 冒烟回归。
2. 冒烟重点优先级：
- Liya 消息加载与外置文案是否真实生效；
- 初始未读 / 红点 / 分隔线 / 滚动保持；
- first_species 六种鸟专属聊天文案；
- 翠鸟 / 鸳鸯刷新；
- 对焦入场体验；
- 结算页视觉链路。
3. C1/C2 级别的聊天排序重构继续后置，避免与当前稳定修复混提交。

## 2026-06-02 playtest2 最新开发记录

### 最新状态摘要
- 当前分支：`playtest2`
- 当前阶段：二测/三测前测试版本整理
- 本次仅补充开发交接文档，不修改运行时代码。

### 已完成
1. Analytics 测试基础
- 已接入/完善 `src/analytics.js`，并在 `data/config.js` 增加 `ANALYTICS_ENDPOINT`、`ANALYTICS_INGEST_TOKEN`、`CLIENT_VERSION`。
- `src/storage.js` 已包含 analytics 相关 localStorage key 管理（含 session_index / tester_uuid / retry payload）。
- 当 endpoint 为空时，走 `local_fallback`，不发网络请求。
- `resetSave` 保留 tester uuid / analytics retry / session index。
- 事件链路已覆盖：`session_start`、`photo_taken`、`session_end`、`chat_opened`、`chat_closed`、`sister_message_received`、`sister_message_viewed`、`field_guide_opened`、`opening_narrative_seen`、`opening_narrative_completed`。
- 说明：analytics 仍以 playtest2 测试为主，不建议整分支直接并入 `main`；建议按 commit 粒度 cherry-pick 并回归。

2. Liya 消息系统稳定性修复
- 同一条 Liya 多行回复已支持后台推进，不再依赖玩家打开聊天后才继续。
- 多条 Liya 回复已串行化：上一条完整结束后，下一条再开始；连续多张照片按发送顺序逐条回复。
- 修复点包含：第二条回复只出第一句、红点首次进入不消失、延迟 render 后聊天滚动跳顶。
- 强化消息滚动保持：用户接近底部时保持底部；用户在中段浏览历史时尽量保持原位置；禁止无条件回顶。
- 主要改动集中在 `src/main.js`、`src/ui/messagePanel.js`。
- 边界说明：
  - 未引入 `lineDeliveredAts` 持久化字段。
  - 未引入 `renderableMessages` 扁平化重构。
  - 未改 `src/storage.js` / `src/fieldGuide.js` / `src/analytics.js`。
  - 当前仍未完成“玩家消息插入 Liya 分句中间”的分句级精确时间排序（后续可选重构项）。

3. 结算页仪式感增强与细节修复
- `SETTLEMENT` 下事件描述改为暖黄色强调，左侧色条由绿色切换为暖黄色。
- 【今天的收获】增加淡黄色强调；【休息到明天清晨】移动至【今天的收获】下方，并使用黄色体系按钮。
- 【今天的收获】与【休息到明天清晨】保留 0.5s 延迟后渐显；渐显过程时长已调为原先 2 倍。
- 修复：`SETTLEMENT` 进入后【今天的收获】不再自动展开，仍需玩家手动点击展开。
- 修复：结算“留下的照片”鸟名后异常“路”字，改为自然分隔符（`·`）。
- 以上均为 UI/动效增强：未改变 `SETTLEMENT` 进入条件、rest action、`session_end`/flush、结算统计数据。

### 修改文件（本轮涉及的实现文件汇总）
- `src/main.js`
- `src/ui/messagePanel.js`
- `styles/style.css`

### 已知风险与注意事项
1. Liya 消息系统风险
- `src/main.js` 与 `src/ui/messagePanel.js` 存在较多消息状态联动，连续多图发送是高风险场景。
- 后续若做“玩家消息插入 Liya 分句中间”排序，不建议一次性引入 `renderableMessages`、分句级 `sortAt`、分句持久化字段；建议分步提交。

2. 滚动风险
- 聊天面板禁止在 delayed render / line complete / mark read 后跳到顶部。
- Liya 相关延迟 render 必须统一走“保滚动”入口，不允许无条件 `scrollTop = 0`。
- 自动吸底只应发生在用户原本接近底部时。

3. Analytics 风险
- endpoint 为空时必须继续 `local_fallback`。
- UI 动效延迟不得影响 `session_end` 触发与 flush。
- `sister_message_received` / `sister_message_viewed` 需持续防重复。
- `resetSave` 不应清除 tester uuid / retry / session index。

4. 分支策略风险
- `playtest2` 为测试分支，不建议整体 merge 到 `main`。
- 通用修复建议单独 commit 后 cherry-pick；analytics 测试配置进入 `main` 前需二次确认。

### 当前回归测试清单（建议）
1. 主流程
- 刷新页面 -> 开始今天的观鸟 -> 普通行动按钮 -> 对焦/拍照/发照片 -> 进入结算 -> 休息到明天清晨。

2. Liya 消息
- 单张照片：多行回复后台自动说完。
- 连续 2 张：第一条完整后第二条开始。
- 连续 5 张：按发送顺序逐条回复。
- 红点：第一次进入后可消失；有未读时不提前消失。
- 滚动：聊天不跳顶；第二次进入后也不延迟跳顶。

3. 结算页
- `SETTLEMENT` 描述框与左侧色条为暖黄色。
- 【今天的收获】淡黄色强调，默认折叠，点击后才展开。
- 【休息到明天清晨】位于【今天的收获】下方。
- 两者 0.5s 后渐显，且渐显过程较早期版本更慢。
- “留下的照片”不再出现异常“路”字。

4. Analytics
- `local_fallback` payload 可读且字段完整。
- `session_start` / `photo_taken` / `chat_opened` / `chat_closed` / `field_guide_opened` / `opening_narrative_seen` / `opening_narrative_completed` / `session_end` 正常。
- `sister_message_received` / `sister_message_viewed` 不重复。
- flush 不受结算动效延迟影响。

### 下一步计划
1. 先提交当前稳定点，避免继续叠加大改。
2. 执行一次完整 playtest2 冒烟回归。
3. 部署并验证 playtest2 测试链接。
4. 接入真实 analytics endpoint 前，先冻结并确认 `local_fallback` payload 字段。
5. C1/C2 消息排序重构暂缓：
- C1：先做“玩家照片+整条 Liya 回复”稳定排序键。
- C2：再做“分句级排序（玩家消息插入 Liya 分句中间）”。
6. 结算页视觉可继续微调，但建议与消息系统改动分开提交。
7. 下一轮用户测试前，优先回归主流程 / Liya 消息 / 结算 / analytics 四条主链路。

## 2026-05-27：手册 / 笔记 UI 渲染层抽离 M2

### 完成
- 已完成 Block M2：手册 / 笔记 UI 渲染层抽离。
- 新增 `src/ui/fieldGuidePanel.js`，承接手册 UI 渲染层（空态、列表、详情、拍立得详情块、照片翻页条与展示 helper）。
- `src/main.js` 已接入 `fieldGuidePanel.js`，并改为调用：
  - `renderFieldGuideEmptyPanel(...)`
  - `renderFieldGuideListPanel(...)`
  - `renderFieldGuideCardDetailPanel(...)`
  - `renderFieldGuideDetailPolaroidUI(...)`
  - `renderFieldGuideSnapshotNavUI(...)`
- `main.js` 已删除 / 收口对应重复实现，不再双份维护（含 `renderFieldGuideDetailCornerHtml`、`wrapNoteFolder` 本地定义删除；`renderFieldGuideDetailPolaroid`、`renderFieldGuideSnapshotNav` 收口为薄 wrapper）。

### 工程结构
- 本次为纯搬迁式模块化：UI 层优先、业务写入后置、行为不变优先。
- `src/main.js` 继续负责主入口、状态衔接、业务副作用与事件委托。
- `src/ui/messagePanel.js` 继续负责消息面板 UI 渲染层。
- `src/ui/fieldGuidePanel.js` 负责手册 / 笔记 UI 渲染层，不负责业务状态写入。
- 当前模块边界：
  - UI 模块不直接写业务状态、不直接写 localStorage。
  - UI 模块不 import `main.js`。
  - `main.js` 统一承接业务动作（含发送给妹妹、自动加新、红点/30秒相关业务语义）。

### 测试反馈
- 用户浏览器功能测试：通过。
- 覆盖反馈：打开/收起笔记、手册列表、卡牌详情、拍立得详情块、照片翻页条、发给妹妹按钮、已发送状态、妹妹补充显示正常；消息红点 / 30 秒回复、普通观察 / 拍照 / 对焦未受影响。
- Codex 环境检查：`git diff --check -- src/main.js src/ui/fieldGuidePanel.js` 通过，仅 CRLF warning。
- Codex 环境未执行浏览器交互测试。
- Codex 环境未执行 JS 语法检查（环境无 `node` 命令）。

### 保持不变
- 未改 `styles/style.css`、`data/*`、`src/fieldGuide.js`、`src/storage.js`、`src/liyaMessageSystem.js`、`src/ui/messagePanel.js`。
- 未改 queue item 结构、红点判断、30 秒机制、发给妹妹业务语义、fieldGuide 数据结构、localStorage key、UI 样式。
- 未新增 `console.log` / `debugger` / `alert`。

### 后续计划
- 建议先提交稳定点：`refactor: extract field guide panel ui module`。
- 暂不建议立刻继续深拆业务状态或事件委托。
- 如继续 UI 模块化，建议顺序：
  - M3：`src/ui/focusView.js`
  - M4：`src/ui/actionButtons.js`
  - M5：`src/ui/topStatusPanel.js`
  - M6：`src/ui/eventPanel.js`

## 2026-05-27：消息面板 UI 渲染层抽离 M1 / M1-b

### 完成
- 已完成 Block M1：新增 `src/ui/messagePanel.js`，开始纯搬迁式模块化。
- 已完成 Block M1 接线：`main.js` 使用 `renderMessagePanelUI(...)` 渲染消息面板。
- 已完成 Block M1-b 单源化收口：消息面板 UI 重复函数从 `main.js` 清理，`messagePanel.js` 成为消息 UI 单一实现来源。

### 工程结构
- `messagePanel.js` 只负责消息 UI 渲染与 UI 辅助（列表、线程、气泡、引用条、逐行动画调度、滚动与可见性辅助）。
- `main.js` 继续负责主入口调度、状态衔接和业务回调承接（含已读副作用、红点/30秒/queue 相关业务逻辑）。
- `messagePanel.js` 不负责业务状态写入，不负责 storage，不负责 fieldGuide 写入。
- 保留薄 wrapper（`main.js` -> `messagePanel.js`）用于稳定现有调用面：`isElementFullyVisibleInContainer`、`getVisibleLiyaReplyCardIds`、`clearLiyaLineAnimationTimers`、`captureChatScrollState`、`restoreChatScrollState`。

### 测试反馈
- 用户浏览器手测反馈：通过。
- Codex 环境检查：`git diff --check -- src/main.js src/ui/messagePanel.js` 通过，仅 CRLF 警告。
- 未执行自动化测试 / 单元测试。

### 保持不变
- 本次 M1 / M1-b 不改消息业务语义，不改数据结构，不改 UI 样式。
- 未改 queue item 结构、红点判断语义、30 秒到期机制、逐行动画节奏、聊天滚动行为、localStorage key。
- 未改动 `data/*`、`styles/style.css`、`src/fieldGuide.js`、`src/storage.js`、`src/liyaMessageSystem.js`、`src/liyaMessageDevTools.js`、`src/gameSession.js`、`message-editor.html`。

### 注意事项
- 拆分过程中曾出现一次 `main.js` 整文件写回触发编码污染（中文乱码）。
- 处理原则已固定：
  - 回滚到分支基线后重做；
  - 禁止整文件重写 `main.js`；
  - 仅使用小块 `apply_patch`；
  - 每次 patch 后检查中文与 diff；
  - 出现异常大 diff/编码污染立即停止。

### 后续计划
- 当前建议先提交稳定点，暂缓继续深拆。
- 如后续继续模块化，建议顺序：
  - M2：抽离 `fieldGuidePanel.js`
  - M3：抽离 `focusView.js`
  - M4：抽离 `actionButtons.js`
- 近期开发优先小补丁，不连续进行大拆分。

## 2026-05-26 信息系统：photo_reply 体验打磨与开局聊天设计同步

- `message-editor` 触发反查链路已可用，编辑器阶段基本收束，后续优先保障运行时体验闭环。
- `photo_reply` 方向补充：首次认鸟需使用 `speciesName`（不再把 `cardTitle` 当鸟名），普通回复通过近期 `sentMessageIds` 去重降低重复命中。
- 连续发送场景结论明确：聊天应按真实时间线显示；为降低阅读歧义，力娅回复需配轻量“回复照片”引用条。
- 可见即已读需求已明确：用户停留在力娅聊天且新消息完整可见时，应自动标记已读并清红点。
- 开始设计开局预设联系人与历史聊天（陈老师、妈妈、苗苗），默认历史已读，预留静态 `read=false` 能力。
- 当前仍未进入主动消息 / 不回复追问 / 全局 pending queue 阶段。

## 2026-05-25 信息系统：photo_reply MVP 阶段收口

- 新增 `docs/DevLog/LIYA_PHOTO_REPLY_SMOKE_TEST.md`，整理 A～I 手测清单与结果记录模板。
- 当前 photo_reply 主链路已具备：外置文本池、固定 messageId 的 entry queue、红点 queue 优先判断、旧字段 fallback 兼容。
- 本轮因环境缺少可用本地静态服务运行时与浏览器自动化入口，运行时手测项未执行，已如实记录为“未测”。
- 下一阶段目标保持为主动消息 / 行为感系统，但需先补齐运行时手测。

## 2026-05-25 信息系统：photo_reply 最小 pending queue

- 发给妹妹后固定 selected `messageId`，并在 collected card entry 上记录 `liyaMessageQueueItem`。
- 力娅聊天回复优先读取 queue item；旧字段继续负责 30 秒延迟、红点、已读、妹妹补充和自动加新。
- 补充开发态 queue 状态检查纯函数，可报告 missing queue item、无效 messageId、due/read 字段不一致和基础结构问题；检查工具只报告，不修复、不接 UI。
- 本阶段未做主动消息、全局 queue、红点迁移、已读主逻辑迁移或手册妹妹补充来源迁移。

## 2026-05-25

- 信息系统完成力娅消息外置化 Block 1～9：新增 `data/liyaMessages.json`、`src/liyaMessageSystem.js`、`src/liyaMessageDevTools.js` 和开发用 `message-editor.html`，聊天里的妹妹回复已最小接入新选择系统。
- `data/liyaMessages.json` 当前约 39 条 `photo_sent` 回复，支持 conditions、priority / specificity 和同层级稳定伪随机选择；编辑器支持导入、内存草稿编辑、校验、dev check 和导出 JSON。
- 旧 `data/sisterKnowledge.js` 仍保留，当前继续用于手册卡牌详情中的“妹妹的补充”；本阶段未实现主动消息、消息队列、随机延迟或 storyStage 推进。

## 2026-05-24

- 重构“加新”触发链：玩家点击【发给妹妹】后不再立即加新，妹妹回复到期并被玩家进入力娅聊天查看后，`markDueSisterRepliesRead()` 会在解锁妹妹补充的同时把对应 collectedCard 标记为 `pendingAutoCatalogue`，并记录 `autoCatalogueReadyAt`；进入对应鸟种页时自动调用既有 `handleCatalogueAction()` 播放加新 reveal，动画完成后写入 `autoCataloguedAt` 并清除 pending。
- 为自动加新增补兼容字段：`collectedCards` entry 兼容 `pendingAutoCatalogue / autoCatalogueReadyAt / autoCataloguedAt`，`storage.js` normalize 和旧 v3 迁移只补默认值，不新增 schemaVersion，不修改 LocalStorage key，不改 snapshot 结构。
- 手册内旧【为它加新】按钮不再渲染为必要入口，旧 action 处理仍保留为兼容路径；自动加新只在玩家进入对应鸟种页时处理，不会在消息已读瞬间自动跳转手册，也不会在手册首页批量加新。
- 调整消息 / 手册外部入口行为：每次从顶部入口打开消息都重置为消息列表，每次打开手册都重置为手册首页；消息内部进入聊天、手册内部进入鸟种 / 卡牌详情仍是内部导航，不作为下次外部入口状态保留。
- 修复 inline panel 入场动画重复播放：新增 `inlinePanelJustOpened` 这类临时 UI 状态，只在消息或手册从关闭 / 互斥切换到打开的当次 render 加 `is-inline-panel-entering`；探索 action、手册内部导航、消息内部导航和普通 render 更新不再重播整体入场动画。
- 将【查看消息】【打开手册】系统入口从顶部状态网格移到事件描述栏下方、主行动按钮上方，并让消息 / 手册 inline panel 跟随新入口区下方展开；原状态网格左侧两个位置改为静态信息块，当前显示“天气 / 晴天”和“周围事件 / 暂无事件”，不再是按钮。
- 更新 UI 色彩层级：新增当前调色 token，信息面板使用米白纸感，顶部【查看消息】为暖杏色，【打开手册】为浅绿色，new / 未读 / 红点统一为陶土橙；消息列表 / 聊天面板改为暖杏外容器、纸黄色标题栏、米白内容卡片和浅分隔线。
- 补充次要按钮浅绿色体系：起始鸟点选择、返回、探索转向、远听、等待、继续拍摄和提前撤离等普通操作使用 `button-secondary` 浅绿色；主推进按钮仍使用深绿色 `button-major`，关闭 / 放弃类中性按钮不重新归类。
- 本轮未修改 PHOTO / FOCUS / RESULT / REPOSITION / LOST 流程、拍照 / 对焦判定、所见即所得抽卡、电量消耗、回合推进、鸟种 / 卡牌数据、snapshot 数据结构或 LocalStorage key；新增状态均位于 collectedCard 层并做向后兼容。

## 2026-05-23

- 手册鸟种页“加新于”改为现实世界时间：新增并读取 `cataloguedRealTimestamp`，同日显示时分、跨日显示月日时分；旧存档缺失真实时间时显示 `—`，不再把游戏内“上午 / 下午 / 黄昏”当作加新时间。
- 短信 / 力娅聊天状态链改为延迟回复：`collectedCards` entry 兼容新增 `sentToSisterAt / sisterReplyDueAt / sisterReplyReadAt / sisterKnowledgeUnlocked`，点击【发给妹妹】时记录现实发送时间和 30 秒后到期时间；同 cardId 已发送时保持幂等，不重复覆盖发送时间、不重复生成发送状态。
- 力娅聊天中的玩家发送内容改为派生消息：每张已发给妹妹的卡牌渲染为一条玩家拍立得消息和一条独立文本消息 `我拍到了「xxx」`，两条消息使用同一现实时间；妹妹回复只在 `Date.now() >= sisterReplyDueAt` 后显示，不阻塞 UI，刷新后仍按 dueAt 判断。
- 未读提醒与妹妹补充解锁改为“看过回复后”生效：到期且未读的妹妹回复会让顶部【查看消息】和消息列表中力娅头像显示红点；玩家进入力娅聊天后才标记 `sisterReplyReadAt` 并置 `sisterKnowledgeUnlocked: true`；卡牌详情中的“妹妹的补充”不再仅因 `sentToSister` 立即显示。
- 聊天界面补充现实时间和历史滚动：每条文本 / 拍立得 / 妹妹回复消息都显示轻量现实时间；聊天历史区域增加最大高度和内部原生滚动，渲染后尽量滚到底部，不限制消息列表、聊天标题或整体页面自然滚动。
- 力娅聊天拍立得改为 chat variant：聊天拍立得复用详情页 HTML 但传入 `{ variant: "chat" }`，根节点增加 `is-chat-polaroid`，仅聊天 variant clamp badge scale；CSS 将拍立得作为右侧独立图片消息显示，去掉绿色气泡包裹，并建立 `message-content -> bubble -> chat-polaroid -> paper -> frame` 的明确宽度链。
- 顶部入口 badge 布局收窄影响范围：为【查看消息】/【打开手册】补充精确 label 与 `new` badge 结构，让 `new` 不参与按钮文字居中；未读红点使用独立 class，不影响手册卡牌、消息列表会话、状态 badge 等其他标记。
- 卡牌详情“妹妹的补充”左侧黄色标记宽度减半，保持颜色、位置、纸条背景和倾斜效果不变，仅降低过粗的视觉重量。
- 本轮未修改 PHOTO / FOCUS / RESULT / REPOSITION / LOST 流程、拍照 / 对焦判定、所见即所得抽卡、电量消耗、回合推进、snapshot 数据结构、鸟种 / 卡牌数据或 LocalStorage key；仅在 collectedCard 层做向后兼容字段补充，并调整短信 / 手册相关渲染与样式。
- 笔记文件夹外壳继续弱化：从“苔痕绿 / 浅苔痕绿 / 淡苔痕绿”逐步调到“极淡苔痕绿”，当前文件夹背景只承担非常轻的层级暗示；外壳保持纯色，不恢复纹理，不恢复粗糙边；“观察笔记”保持左上角文字，不再是 tab 小框。
- 卡牌详情页背景统一到鸟种页的大纸页体系：详情页根容器改为 `note-book-page note-card-detail-panel`，复用鸟种页同一套纸纹、粗糙边、padding 和外观比例，避免从鸟种页进入详情时出现明显外框跳变；`note-card-detail-panel:not(.note-book-page)::before` 只保留 fallback，当前详情页不会再叠加第二层详情纸纹。
- 卡牌详情页结构顺序整理为：卡片描述 -> `第 X 张照片 · 第 X 次拍到「卡名」 · 已留存 X 张` -> 妹妹的补充 -> 拍立得 + 右侧拍摄信息 -> snapshot 切换按钮 -> 发给妹妹 / 已发给妹妹。统计行属于卡片记录信息，移动到卡片描述之后、妹妹补充之前。
- 统计行文案统一使用阿拉伯数字格式，例如 `第 1 张照片 · 第 1 次拍到「晨光理羽」 · 已留存 2 张`；不再使用“第一张照片 / 第一次拍到”，缺失数据使用 `—` fallback，避免 `undefined / NaN / null` 出现在 UI。
- 详情页顶部卡片描述区域纸片化，并与外部 `field-guide-card` 保持同源：使用 `--note-card-bg`、`--note-card-border`、`--note-card-shadow` 和同源错位底层；保留状态 badge、卡牌标题和描述；不使用 SVG filter、不加粗糙边、不做强 hover，避免被误认为可点击按钮。
- 详情页照片区改为左侧拍立得、右侧拍摄信息的横向旁注布局：右侧信息包含拍摄时间、地点、电量、对焦；拍摄时间使用游戏内时间段，电量使用电池 UI，不再显示纯文本百分比；右侧信息不再使用四个白色信息块，也不再有大背景色块，每一行有独立轻微 rotate，整体更像拍立得旁边的手写旁注。
- 当前照片区关键 CSS 数值：默认 `.note-detail-photo-and-meta { gap: 46px; transform: translateX(-20px); }`；`max-width: 560px` 下为 `gap: 24px; transform: translateX(-16px);`；`max-width: 390px` 下为 `gap: 16px; transform: translateX(-12px);`。这些值用于拉开拍立得与右侧文字并平衡“左边缘 - 拍立得 - 文本描述 - 右边缘”的视觉重心；后续不建议继续单纯增大负位移，应改为优化两列布局、容器宽度和视觉重心。
- 卡牌详情页【返回笔记】按钮改为与手册页左右翻页按钮同源的轻量纸签按钮：更白、更小、偏直角、有轻微小阴影，不使用绿色行动色；使用 `.field-guide-detail-back.button-ghost` 单独控制，避免覆盖 `.field-guide-send-button`。
- 【发给妹妹】按钮边界保持不变：未发送状态仍是绿色行动按钮，已发送状态弱化显示；`.note-card-detail-panel .field-guide-send-button` 继续保护发送按钮样式，本轮不改变发送逻辑、短信逻辑或存档结构。
- 今日静态 QA：`git diff --check` 通过，仅有 LF/CRLF 提示；未发现新增 `console.log` / `debugger` / `alert`；`note-book-folder` 没有 `folder-texture.jpg` / `kraft-folder-texture.jpg` 引用，也没有使用 `paper-edge` / `paper-soft`；`note-book-page` 仍保留纸纹与 `paper-edge` 粗糙边；详情页结构顺序静态检查正确；右侧拍摄信息使用时间段、地点、电池 UI、对焦，并具备独立 rotate class。
- 仍需浏览器手测：页面是否正常打开、控制台是否有运行时报错；鸟种页进入详情页是否真的无视觉跳变；390px / 375px / 360px 下照片区是否保持同一行且无横向滚动；gap 增大后右侧信息是否贴近右边缘；snapshot 翻页后拍立得与右侧信息是否同步更新；返回笔记、发给妹妹、刷新后存档保持等交互路径；返回按钮移动端点击热区是否足够。
- 当前重点风险：照片区使用 `gap: 46px` 和 `translateX(-20px)`，窄屏虽有 clamp 和 media query，仍需真机 / 浏览器确认；详情页复用 `note-book-page` 后视觉上是否与鸟种页完全无跳变需要截图确认；如果继续觉得拍立得偏右，不应继续简单加大负位移；详情卡片描述颜色需要持续与外部卡牌列表保持一致，避免再次变得过白。

## 2026-05-22

- 顶部状态栏改为当前 UI 文案：左上角合并显示“当前时间 / 当前电量”，时间由既有剩余回合派生为“清晨 / 上午 / 中午 / 下午 / 黄昏”，电量仍使用原电池图标与消耗逻辑；右上角改为显示当前位置，原位置块改为“信息”占位按钮，原当前阶段块改为“笔记手册”入口按钮。
- 用户可见“图鉴”文案统一调整为“笔记”，并让“笔记手册”按钮复用原查看图鉴入口；仅修改 UI 文案与入口接线，不改 `fieldGuide` 内部命名、LocalStorage key、存档结构或查看/返回逻辑。
- 临时隐藏卡牌详情的“仔细辨认”入口、已辨认状态文案与鸟种身份色上色效果：通过 `ENABLE_CARD_IDENTIFY_UI = false` 控制 UI 暴露，保留 `isIdentified` 数据、辨认 helper、storage 迁移和鸟种色样式；笔记详情拍立得当前一律按拍摄瞬间行为状态色渲染。
- 为 `collectedCards` 增加独立的 `hasNewContent` 字段，用于表示“该卡有未查看的新照片 / 新内容”：新 cardId 或已有 cardId 新增有效 snapshot 时置为 true，玩家点击卡牌进入详情后通过 `markCollectedCardViewed()` 置为 false；旧存档缺失该字段时 normalize 为 false，避免旧卡批量显示 new。
- CATALOGUED / 笔记页已收集卡列表改为按 `hasNewContent` 显示小写 `new` 标签，不再复用 `isIdentified`；顶部“笔记手册”按钮也从 collectedCards 派生任意 new 状态并冒泡显示 `new`，所有 new 卡被点开查看后自动消失。
- 接入短信系统阶段性骨架：原“信息”入口改为“短信”，点击后在主详情区打开短信气泡界面；妹妹消息靠左、玩家消息靠右，当前不提供自由输入框、短信历史列表或未读红点。
- 为解决“未加新鸟无法选择照片发给妹妹”的循环死锁，SEEN 状态笔记页也显示已拍到的卡牌 / 照片并可进入详情；鸟种主标题仍为“？？？”，仍保留“为它加新”，发给妹妹不会自动加新。
- 卡牌详情新增“发给妹妹”入口：点击后只打开短信界面、生成玩家发送气泡和妹妹知识回复，不消耗回合或电量，不调用加新逻辑，不改变卡牌标题、拍立得 badge 文案或卡牌本体显示。
- `collectedCards` 增加 `sentToSister` 与 `sisterKnowledge`：同 cardId 所有 snapshots 共用妹妹补充文本；已发送后详情显示“妹妹的补充”和“已发给妹妹”，不再重复显示发送按钮；旧存档默认 `sentToSister: false`、`sisterKnowledge: []`。
- 新增 `data/sisterKnowledge.js` 配置化妹妹知识文本：支持按 cardId 配置专属回复，并提供 `NORMAL / INTERESTING / REMARKABLE / PRECIOUS` fallback；发送时生成一次写入 `sisterKnowledge`，render 时不随机、不覆盖已有补充。
- 顶部 UI 完成当前版本改版：左上角合并“当前时间 / 当前电量”，当前时间由剩余回合派生为清晨、上午、中午、下午、黄昏并带有渐进色；右上角显示位置；“短信”和“笔记手册”为按钮式 UI 块，后者接原查看笔记入口并显示 new 冒泡。
- 本次未修改 PHOTO / FOCUS / RESULT / REPOSITION / LOST 流程、卡牌抽取、对焦判定、snapshot 字段含义、snapshots 多照片结构、电量消耗、回合逻辑、鸟种数据或 LocalStorage key。

## 2026-05-21

- 完成 5.21 拍照丰富度完整链路同步：鸟实例创建时按 `BIRD_DISTANCE_DEFAULT_WEIGHTS` 固定抽取 `distance`，PHOTO / FIRST_ENCOUNTER 文案按 near / far 插入自然距离句，`snapshot.distance` 随拍摄记录写入；不改变 PHOTO / FOCUS / RESULT / REPOSITION / LOST 流程、飞走概率或抽卡逻辑。
- FOCUS 徽章接入距离缩放、每轮对焦随机缩放与轨迹旋转：`near / medium / far` 当前视觉缩放为 `1.7 / 1.0 / 0.5`，每个新 FOCUS 窗口 roll 一次 `BADGE_RANDOM_SCALE`，运动轨迹通过 `computeBadgeRotation()` 平滑限制在 ±30°；拍摄 snapshot 记录 `finalScale` 和 `badgeRotation`，动画拍立得与图鉴详情静态拍立得按 snapshot 定格回放，不改变 focusScore、合焦判定公式或 cardDraw。
- 拍立得定格徽章接入鸟种色卡和毛玻璃混合视觉：6 个鸟种补齐 `colorPalette`，定格后的动画拍立得与图鉴详情拍立得支持 `solid / horizontal-split / vertical-split / dot-pattern`；split scheme 在拍摄时写入有效 `snapshot.splitStop`，solid / dot-pattern 不持久化无效 splitStop；FOCUS moving badge 继续使用行为状态色，不接鸟种色。
- 图鉴收集结构升级为同 cardId 多照片：`collectedCards` 当前按 `{ cardId, snapshots, isIdentified }` 归一化，旧单数 `snapshot` 会迁移为 `snapshots: [snapshot]`，再次拍到同一 cardId 会 push 新照片并按 focusScore / focusAffix / realTimestamp 排序；LocalStorage key 继续使用现有 v3 key，不清空旧图鉴、不新增 schemaVersion。
- 图鉴卡牌详情页支持同卡多照片翻阅：CATALOGUED 卡牌列表读取 `snapshots[0]` 作为默认最佳照片，详情页通过临时 UI 状态 `fieldGuideDetailSnapshotIndex` 切换当前 snapshot；拍立得、对焦精度、日期、地点和 finalScale / badgeRotation / splitStop 回放会随当前照片刷新，单张或空 snapshot 保持旧 fallback。
- 修复 5.21 QA 后发现的初见泄露正式名问题：`data/species.js` 为鸟种增加 `firstEncounterAppearance`，`enterFirstEncounterMode()` 优先使用该字段，fallback 到 `appearance` 时保持容错；图鉴正式描述、nickname、加新流程和 FIRST_ENCOUNTER 分段 reveal 不变。
- 修复并统一对焦框视觉 / 判定尺寸：当前主界面、RESULT、动画拍立得和图鉴详情使用同一套固定 4:3 对焦框基准 `FOCUS_FRAME_VISUAL_SIZE = 40 x 30`，小容器下等比缩小；UI 绿色判断按实际渲染 frame 尺寸换算 normalized 命中框，scale / rotate 不参与判定，避免视觉框和拍照判定脱节。
- 调整乌鸫 FOCUS 停顿手感：将 blackbird NORMAL 轨迹的 `stutter` 降低到更轻的停顿比例，保留警觉停顿个性但减少“一顿一顿”的不连续感；不改变 focus duration、行为状态概率或 PHOTO 主流程。
- 完成一组 UI / UX 微调同步到当前实现：隐藏事件描述功能标题但保留语义；拍摄时机空状态不再显示 `[空]`，改为浅色静态四角取景框；周边地图节点去掉方括号，竖向连接字符 `│` 改为空白占位，地图 grid、箭头和方向逻辑不变。
- 调整按钮层级与探索按钮顺序：新增并使用 `button-accent` / `button-ghost`；“为它加新”使用 accent，“查看图鉴”入口使用 ghost；EXPLORE 中“提前撤离并结算”放到“查看图鉴”上方，且仍为默认次级按钮，不改 action、不推进回合。
- 修正 FIELD_GUIDE 按钮上下文：从 START 进入图鉴时保留“开始游戏”；从 EXPLORE / PHOTO 等游戏中状态进入图鉴时不显示“开始游戏”，只显示可返回原状态的“返回”；随后按 UI 要求将该顶部返回按钮改回默认次级按钮，卡牌详情内“返回图鉴”仍保持 `button-ghost`。
- FIRST_ENCOUNTER 详情面板改为叙事化临时称呼展示：读取 `species.nickname`，fallback 为“这只鸟”，不泄露正式鸟名；普通事件文本 `text-reveal` 动画增强，加新成功反馈改为薄荷绿语义；观察日志标题降权，FIRST_ENCOUNTER 分段间距略放开。
- 图鉴“为它加新”后增加一次性 CATALOGUED 内容 reveal：通过 `recentlyCataloguedSpeciesId` 标记本次刚加新的鸟种，只在对应图鉴页下一次渲染时对标题、说明和已收集卡牌做轻量逐行淡入；渲染后清空标记，普通打开图鉴、翻页、返回图鉴和卡牌详情不会反复重播。
- 修复 RESULT 阶段快速点击“继续跟焦”不跟手的问题：根因是旧实现把 `handlePhotoAction(..., "refocus")` 放在拍立得 quick-dismiss 的 timeout 回调里；当前改为 `startActivePolaroidDismiss()` 只启动上一张拍立得自清理退场，`refocus` 立即走原统一 action 分发并进入下一轮 FOCUS，不重复生成照片、不消耗电量、不改变 PHOTO / RESULT / FOCUS 业务语义。
- 两套拍立得增加照片质量视觉反馈：动画拍立得 `.focus-polaroid-*` 与图鉴详情静态拍立得 `.field-guide-detail-*` 共用 `snapshot.focusGrade` UI class helper；badge 使用毛玻璃样式并按“数毛 / 清晰 / 尚可 / 失焦”四档模糊，`数毛` 时皇冠 `♛` 显示在整张拍立得右上角而不是 badge 内；对焦框四角作为独立兄弟元素保持清晰。
- 本次为 UI / 动效 / 文档同步范围；未修改 `gameSession.js`、`focusEngine.js`、`focusSequence.js`、`photoSequence.js`、`cardDraw.js`、数据文件、LocalStorage key、存档结构、snapshot 字段、对焦判定、所见即所得抽卡、电量消耗或 PHOTO / FOCUS / RESULT / REPOSITION / LOST 核心流程。

## 2026-05-20

- 更新正式测试卡牌数据：`data/cards.js` 当前为 6 种鸟共 36 张卡，每种鸟包含 3 张 `NORMAL`、2 张 `INTERESTING`、1 张 `REMARKABLE`；不新增 `PRECIOUS`，不修改 `drawCard(speciesId, behaviorState)` 接口。
- FIELD_GUIDE 存档升级到 v3：新增 LocalStorage key `birdwatch_text_sim_field_guide_v3`，保留 v2 key；v3 标准结构为 `heardSpeciesIds / seenSpeciesIds / cataloguedSpeciesIds / collectedCards / discoveryOrder`，其中 `collectedCards` entry 为 `{ cardId, snapshot }`。
- 完成 v2 -> v3 迁移：旧字符串卡牌数组迁移为对象数组，加入指定 cardId 重映射表；夜鹭双 ID 迁移使用读取旧 id 后批量生成新 entry 的模式，避免原地交换覆盖。
- `fieldGuide.js` 适配 v3：`markSeen()` 同步维护 `discoveryOrder`，`markCatalogued()` 容错补齐 `seenSpeciesIds / discoveryOrder`，`addCard(fieldGuide, cardData, snapshot = null)` 支持按 cardId upsert，并在同卡多次拍摄时保留更高 `focusScore` 的 snapshot。
- PHOTO / FOCUS 按下快门时接入 `photo.snapshot`：UI 层在 shoot 分发前采样 moving badge 相对 `.focus-playfield` 的 `badgeRelX / badgeRelY`，计算展示用 `focusScore / focusGrade`；规则层在照片对象和 v3 图鉴卡牌 entry 中写入同一份 snapshot。
- 新增拍照后拍立得动画 MVP：shoot 后在稳定的 `document.body` overlay root 上覆盖原取景框位置显示一张临时拍立得，badge 文本来自 `photo.card.title`，位置来自 snapshot，日期来自 `realTimestamp`；停留约 1000ms 后右滑淡出，reduced motion 下改为短淡出。
- 主界面“拍摄时机”对焦框最终保留为固定居中的 4:3 四角 L 型框；合焦成功沿用旧绿色，未合焦沿用灰白；已移除对 moving badge 的视觉吸附跟随，不再设置动态 offset，避免视觉框与判定框不一致。
- FIELD_GUIDE 改为 discoveryOrder 私人记录图鉴：HEARD 不进入图鉴，空图鉴不暴露总数，SEEN 页只显示“？？？”、appearance 和“为它加新”，CATALOGUED 页只显示已收集卡牌和“已收集 X 张”，不再显示未获得卡槽或 `X / Y` 总量。
- FIELD_GUIDE CATALOGUED 页新增卡牌详情伪模态：已收集卡可点击，在 detailPanel 内显示“返回图鉴”、卡牌信息、拍摄上下文和静态拍立得记录；snapshot 为 null 的迁移旧卡显示“本卡无拍摄记录”且上下文字段为 `—`。
- 图鉴详情页最终排版为：返回图鉴 -> 卡牌信息 -> 拍摄上下文 -> 拍立得；详情页拍立得 frame 调整为 `width: min(220px, 76vw)`，对焦精度显示为单行如 `88% 清晰`。
- 低风险 UI 体验优化：FIELD_GUIDE 查看页 action 排列调整为“开始游戏 -> 返回 -> 图鉴内容 -> 清空图鉴”，其中“清空图鉴”移入图鉴内容底部并弱化显示；不改变图鉴数据或清空逻辑。
- 事件描述接入轻量文字出现效果，并加入 `lastEventTextRevealKey` / `getEventTextRevealKey()`，确保同一份事件文本在二次 render 时不会重复播放 reveal，修复 FOCUS shoot 后事件描述跳动两次的问题。
- FIRST_ENCOUNTER 新鸟文本最终采用“按中文句号分段 + 逐段淡入上移”的阅读节奏：不使用逐字打字机，不改原文案，不提前泄露正式鸟名；段落淡入时长约 520ms，段落 delay 按文本长度估算并支持 reduced motion 直接显示。
- “继续跟焦”在存在上一张拍立得时会先触发约 240ms 的轻量拍立得收起动画，再执行原 `refocus` action；不重复生成照片、不消耗电量、不改变 PHOTO / RESULT 业务语义。
- FOCUS 阶段“按下快门”按钮增加专用相机快门式样，仍沿用原按钮 action 和可用性判断，不影响其他按钮。
- 今日边界：未实现真 modal、相册视图、A/B `FIELD_GUIDE_SHOW_TOTAL` 或 `?showtotal=1`；未修改 `focusEngine`、`focusSequence`、PHOTO 主流程、抽卡逻辑、LocalStorage v2 原始数据或 snapshot 字段契约。

## 2026-05-18

- 新增 PHOTO / FOCUS 焦内序列系统第一阶段：`data/focusConfig.js` 为各鸟种、各外部行为状态补充 `sequence` 配置，新增 `src/focusSequence.js` 负责生成焦内状态段、按 elapsed 查询当前段、处理 `TRANSFER` 节点与安全 fallback。
- `gameState` 增加 `currentFocusSequence` 临时状态；进入 FOCUS 时按外部 `behaviorState` 生成焦内序列，moving badge 改为显示焦内可见状态 `NORMAL / INTERESTING / REMARKABLE`，序列从 badge 可见后开始计时。
- FOCUS 正常结束条件从固定 4 秒 timeout 改为焦内序列到达 `TRANSFER`；TRANSFER 触发既有离场动画，离场完成后推进外部 `photoSequence`，再进入既有 `REPOSITION` 或 `LOST` 流程。
- 对焦序列体感调参：`data/focusConfig.js` 中所有 `sequence.stateDurations` 的 `min / max` 整体翻倍；不改 `segmentCount`、权重、移动参数和 TRANSFER 逻辑。
- 接入“所见即所得”拍照稀有度第一阶段：按下快门瞬间捕获 moving badge 当前可见状态，`handlePhotoAction(..., { capturedBehaviorState })` 使用该状态调用 `drawCard`。
- `src/cardDraw.js` 从“行为状态影响稀有度权重”改为“行为状态直接决定稀有度卡池”：`NORMAL / INTERESTING / REMARKABLE` 分别只从对应 rarity 卡池抽取，同稀有度内仍随机；空池时保留安全 fallback。
- 接入对焦词缀第一版：按快门瞬间根据 badge 中心是否在对焦框内记录 `focusAffix = IN_FOCUS / BLUR`；失焦照片仍获得卡牌、仍解锁图鉴，事件与结算照片项显示“失焦”标签。
- 新增内部 `getPhotoScore(photo)` 预留失焦扣分规则：`BLUR` 按卡牌星级 -1 且下限 0；随后按当前版本要求移除结算 UI 中的单张分数和总分展示，只保留内部计算接口。
- 局内拍摄资源 UI 从“SD 卡”换皮为“电量”：不改 `MAX_PHOTOS`、`photos.length`、拍摄上限和结算触发机制；状态栏显示电池图形和百分比，结算显示“拍照数量：X 张（已用电量 XX%）”。
- 增加加载性能与首屏体验优化：`index.html` 补充真实 ES Module 依赖的 `modulepreload`，新增初始可见 loading 遮罩；`styles/style.css` 增加遮罩样式；`main.js` 首次 `render()` 后淡出并移除遮罩。
- 鸟种替换第一阶段完成：`data/species.js` 改为 6 种目标鸟 `kingfisher / sparrow / red_billed_magpie / mandarin_duck / blackbird / night_heron`，移除 `red_whiskered_bulbul / light_vented_bulbul`。
- `data/spots.js` 更新三个地点的 `speciesWeights`，只引用新 6 种鸟；`data/cards.js` 为每只鸟补齐 `NORMAL / INTERESTING / REMARKABLE` 三档占位卡牌，不新增 `PRECIOUS`，卡牌标题和描述不泄露正式鸟名。
- 本日改动保持既有边界：不修改 LocalStorage 结构，不修改 FIRST_ENCOUNTER / 图鉴加新结构，不接 analytics，不引入第三方库；鸟种替换阶段未改刷鸟逻辑，只更新数据。

## 2026-05-17

- 新增 PHOTO 对焦系统第一阶段：增加 `data/focusConfig.js` 和 `src/focusEngine.js`，以 `speciesId -> behaviorState` 组织对焦配置，支持 `still / drift_to_center / wander / jitter / bounce_hop / sweep` 等 pattern；对焦引擎只做纯计算，不访问 DOM、LocalStorage 或动画 API。
- `focusEngine` 导出 `getFocusConfig()`、`createFocusRuntime()`、`computeFocusPosition()`、`getFocusDistance()`、`getFocusAffix()`、`getFocusAffixDisplay()`、`isInGreenZone()`、`evaluateFocus()`，为后续 PHOTO UI 接入提供归一化坐标、距离、绿区和词缀判定。
- 接入 PHOTO 对焦 UI：顶部状态栏的“拍摄时机”块承载 `focus-playfield`，在对焦阶段显示固定 `focus-frame` 和移动的行为状态 `behavior-badge`；进入绿区时 `focus-frame.is-green` 高亮。下方“按下快门”保持普通按钮，不承载对焦 UI。
- 顶部状态栏布局改为 3 行 2 列：第一行“剩余回合 / SD 卡”，第二行“位置 / 拍摄时机”，第三行“当前阶段 / 拍摄时机”；原“鸟点”和“方向”合并为“位置”，显示 `当前鸟点 · 当前观察面名称`。
- PHOTO 流程拆分为子阶段 `photoPhase = DECISION / FOCUS / RESULT`：
  - `DECISION`：发现鸟或等待后观察判断，拍摄时机块显示空取景框 `[空]`，按钮为“举起相机 / 再等一等 / 放弃拍摄”。
  - `FOCUS`：举起相机后进入对焦，拍摄时机块显示移动 behavior badge 和固定对焦框，按钮为“按下快门 / 再等一等”。
  - `RESULT`：成功拍完一张且未结束观察时显示拍摄结果，拍摄时机块只显示静态对焦框，按钮为“继续跟焦 / 再等一等 / 放弃拍摄”。
- `handlePhotoAction()` 新增 `raiseCamera` 和 `refocus` action：二者只切换 PHOTO 子阶段，不推进 `photoSequence`、不抽卡、不消耗回合；`wait` 从任意 PHOTO 子阶段都会推进 `photoSequence` 并回到 `DECISION`。
- 成功按下快门后，如果 SD 卡未满且鸟未飞走，不再继续留在 `FOCUS`，而是进入 `RESULT`；拍摄结果仍使用原有抽卡逻辑和照片结构，不接入 focusAffix，不修改 `drawCard()`。
- PHOTO 事件描述增强为内部安全 `eventHtml`：发现鸟、等待后当前行为状态、RESULT 中“行为变成了 X”均使用现有 `behavior-badge` 样式显示 behaviorState，同时保留纯文本 `eventText` fallback；照片品质仍使用 `rarity-badge`，继续区分 `behaviorState` 和 `card.rarity`。
- 对焦动画生命周期完善：rAF 只在 `PHOTO + FOCUS` 时启动；进入 `DECISION`、`RESULT`、`SETTLEMENT` 或离开 PHOTO 时会停止并清理 UI 临时状态。
- 进入 FOCUS 时新增移动徽章入场表现：点击“举起相机”或“继续跟焦”后，badge 先延迟约 1.2 秒，再从取景框外随机方向沿轻微曲线平滑进入；入场完成后才交给 `focusEngine.evaluateFocus()` 持续驱动。
- FOCUS 按下快门后新增移动徽章离场表现：业务 shoot 立即执行并更新事件描述；若结果进入 `RESULT`，UI 临时保留当前 behavior badge，从当前位置无延迟沿曲线退到取景框外，离场结束后再显示 RESULT 静态对焦框。
- 对焦相关 CSS 增加 `.focus-playfield`、`.focus-frame`、`.focus-moving-badge`、`.focus-empty-label` 及入场/离场状态类；`focus-frame` 层级高于移动 badge，保证徽章经过中心时不遮挡对焦框边线。
- 新增“三状态初见 / 加新系统”数据层：图鉴存档 key 升级为 `birdwatch_text_sim_field_guide_v2`，默认结构改为 `heardSpeciesIds / seenSpeciesIds / cataloguedSpeciesIds / collectedCards`，不迁移旧测试存档。
- `fieldGuide.js` 新增 `markSeen()`、`markCatalogued()`、`isSeen()`、`isCatalogued()`、`getSpeciesKnowledgeState()`；`heardSpeciesIds` 只代表听到过，`collectedCards` 不再自动等同于见过或已加新。
- `data/species.js` 为当前 5 个鸟种补充 `appearance` 和 `nickname`，供首次遭遇钩子描述和未加新匿名称呼使用。
- `data/cards.js` 清理卡牌文案规范：`title / description` 不泄露正式鸟名，鸟种归属只由 `speciesId` 表达，UI 层根据知识状态决定是否显示正式鸟名。
- 接入新 mode `FIRST_ENCOUNTER`：首次发现 `UNKNOWN / HEARD` 鸟时先进入初次发现阶段，事件描述显示 `species.appearance`，只显示“继续”按钮；点击继续后调用 `markSeen()` 并进入 `PHOTO / DECISION`。
- PHOTO 命名规则接入知识状态：`SEEN` 使用 `species.nickname`，`CATALOGUED` 才显示 `species.name`；PHOTO 后续 `raiseCamera / wait / result / giveUp` 文案不泄露未加新的正式鸟名。
- 听声展示按知识状态匿名化：未知或只听过的鸟显示“某种鸟叫”，已见未加新显示 nickname，已加新才显示正式鸟名；底层远听功能和鸟点逻辑不变。
- FIELD_GUIDE 图鉴改为三状态渲染：`UNKNOWN / HEARD` 显示“未知鸟种”且不展示 appearance；`SEEN` 显示“？？？”、appearance 和“为它加新”按钮；`CATALOGUED` 显示正式鸟名和 appearance。
- 图鉴页内部新增“为它加新”按钮，点击后调用 `handleCatalogueAction()` -> `markCatalogued()`，当前页立即从“？？？”刷新为正式鸟名，按钮消失，并显示事件描述“你终于知道了它的名字——X。”。
- 当前阶段未接入 focusAffix、未修改抽卡权重、未修改照片对象结构、未新增图鉴积分或全毕业系统；三状态系统只改变遭遇命名、图鉴知识状态和加新显示。

## 2026-05-12

- 初始化纯文字观鸟模拟器 MVP 项目结构。
- 增加原生 HTML、CSS、JavaScript 模块。
- 增加鸟种、卡牌和配置数据文件。
- 跑通探索、发现、拍照、抽卡、SD 卡、图鉴和结算流程。
- 增加轻量鸟点切换：远处声景、候选鸟点、旅行回合消耗和按鸟点权重生成活动鸟。

## 2026-05-14

- 调整探索界面行动入口：隐藏“回头观察”“等待片刻”“静听”等旧按钮，保留内部 action 逻辑；将“向左转 / 向右转”固定为同一行显示。
- 重做“倾听远处的声音”：基于当前鸟点 `neighbors` 生成最多两个相邻鸟点的鸟鸣情报，每个鸟点最多透露 0-1 种鸟，并在听到鸟时更新图鉴 HEARD 状态。
- 新增 `DISTANT_LISTEN` 远听决策状态：远听后显示“前往 xxx”“观察当前方向”“再听一会”，支持重复远听刷新情报、移动消耗 `travelCost`、观察复用现有观察逻辑。
- 补充鸟点连通数据 `neighbors`，新增远听概率配置和相邻鸟点查询辅助函数。
- 调整周边地图为动态相对朝向地图：地图上方始终显示玩家当前面向；统一顶部状态栏、地图当前面向、转向事件描述的方向显示来源。
- 优化动态地图 UI：从 `<pre>` 文本地图改为 CSS Grid，并升级为带上下左右连接线和箭头的 5 列布局；左右方向与中心距离不再随宽屏大幅拉伸。
- 修复转向事件描述仍使用旧方向名的问题：`gameSession.js` 的方向显示改为复用 `getSurroundingSpotMap(state).facingName`。
- 修复同一方向多只同种鸟导致线索文本重复的问题：`birdManager.generateClues(state)` 对最终展示的 clue 文案做去重，不删除 `activeBirds`，不改变鸟实例生成规则。
- 统一卡牌稀有度显示：新增 `rarityDisplay` 工具，将卡牌品质显示为“寻常 / 有趣 / 精彩”，图鉴、结算和快门反馈复用统一 badge。
- 快门反馈支持内部生成的安全富文本 `eventHtml`，使卡牌稀有度在事件描述中以 badge 显示。
- 调整快门反馈文案：按下快门后事件描述显示“咔擦！获得【稀有度徽章】照片：照片标题 / 照片描述”；`eventText` 保持纯文本，日志不含 HTML。
- 修复结算显示：结算列表只显示鸟种、卡牌名、卡牌稀有度 badge 和 NEW 标记，不显示拍摄时机 `behaviorState`。
- 新增本局开始前已解锁 cardId 快照 `unlockedCardIdsAtRunStart`，修复清空图鉴后本局新卡 NEW 标注；同一个新 cardId 本局重复获得时仅首次显示 NEW。
- 中文化顶部状态栏阶段显示，新增“拍摄时机”状态块；非拍摄状态显示 `--`，拍摄状态显示当前 behaviorState 徽章。
- 调整页面信息层级：行动按钮后优先显示地图、结算、图鉴或拍照面板，观察日志移动到页面底部。
- 统一卡牌稀有度 badge 与拍摄时机状态 badge 的视觉配色，但保留 `rarity-badge` 与 `behavior-badge` 的语义区别。
- 强化关键节点按钮样式：为“开始游戏”“开始新游戏”“重新开始”添加 `button-major`，普通行动按钮样式保持不变。
- 增加 PHOTO 阶段轻量动效：点击“再等一等”后顶部拍摄时机 `behavior-badge` 跳动一次；点击“按下快门”时事件描述块局部白闪。
- 优化快门白闪手感：白闪提前到业务 action 分发前触发，且动画起始即最大亮度、快速淡出；白闪仅作用于事件描述块。
- 增加 SETTLEMENT 结算页逐行出现动效：标题、统计行、照片列表按延迟淡入上浮；NEW 卡牌项有柔和高光，NEW badge 有一次轻微弹出。
- 调整结算动效节奏：统计区逐行出现速度放慢，统计区与照片列表之间增加段落停顿；照片列表 stagger 延迟封顶，避免照片较多时拖太久。
- 结算统计文案更新为：拍照数量、记录鸟种、听到鸟种、新增图鉴、记录点数；NEW 判断仍复用 `unlockedCardIdsAtRunStart` 和本局首次显示逻辑。
- 所有新增 UI 动效均支持 `prefers-reduced-motion: reduce`，减少动态效果时内容直接可见。
- 迭代拍摄时机到照片品质的抽卡规则：`cardDraw.js` 改为先按 behaviorState 显式权重抽目标 `card.rarity`，再从对应鸟种和 rarity 的卡池中等概率抽具体卡。
- 当前抽卡权重调整为：`NORMAL` -> 90% NORMAL / 10% INTERESTING；`INTERESTING` -> 20% NORMAL / 70% INTERESTING / 10% REMARKABLE；`REMARKABLE` -> 10% INTERESTING / 90% REMARKABLE；`PRECIOUS` -> 100% PRECIOUS。
- 快门时机评价改为更短的口语化提示：高于时机显示“赚到了！”，低于时机显示“可惜！”，珍贵照片显示“太难得了！”，同级结果默认不显示提示，仅小概率显示“时机刚好！”。
- 为未来稀缺资源预留 `PRECIOUS / 珍贵`：`rarityDisplay.js` 支持 `rarity-precious`，`photoSequence.js` 的 `BEHAVIOR_STATE_DISPLAY` 支持 `state-precious`，CSS 增加紫色系 badge；但 `PHOTO_SEQUENCE_CONFIG.stateWeights` 未加入 PRECIOUS，普通流程不会随机生成珍贵状态。

## 2026-05-15

- 调整 SETTLEMENT 结算展开方式：进入结算后先显示“本局结算 / 点击展开本次记录”折叠态，玩家点击结算面板后才展开完整统计和照片列表，并播放原有逐行 reveal 动效。
- 强化结算折叠态视觉：增加居中标题、提示文字轻动效和向下箭头；展开后不重复播放，重新开始或进入下一局后恢复折叠态。
- 修正 PHOTO 中鸟飞走事件文案：飞离事件不再追加“本次观察结束。”，避免和整局结算混淆；`FLY_AWAY.hint` 更新为“鸟已飞离”。
- 重做 FIELD_GUIDE 图鉴 UI：从旧竖向列表改为按鸟种分页浏览；左右箭头切换鸟种，顶部显示分段横线页签，每页显示当前鸟种收集进度和卡牌槽位。
- 图鉴未知鸟种页显示“未知鸟种”和提示文案；未获得卡牌显示稀有度 badge + “？？？” + “尚未获得”，已获得卡牌显示稀有度、标题和描述。
- 多次微调图鉴视觉层级：翻页按钮改为紧凑楔形按钮，稀有度 badge 与卡牌标题同一行，卡牌背景改为接近地图的米色纸面，页签改为全宽长分段横线，并修复页签 / 翻页按钮 focus 后出现异常竖线的问题。
- 扩充 `data/cards.js`：每个鸟种整理为 6 张卡牌，包含 3 张 `NORMAL`、2 张 `INTERESTING`、1 张 `REMARKABLE`；统一 card id 命名为 `speciesId_rarity_序号`，不新增 `PRECIOUS`。
- 第一次测试前做低风险清理：删除旧版 `.guide-list` / `.guide-card` CSS；给规则层保留但 UI 未暴露的 `turnBack`、`listenFar`、`listen`、探索态 `wait` 等 action 添加说明注释。
- 修复列表缩进与背景层级：结算照片列表和鸟点列表显式覆盖 `.panel ul` 的默认缩进；鸟点卡片背景复用地图背景色 `#f7f1e4`，与父面板形成层次。
## 2026-05-27：消息体验、UI 扁平化与 main.js 模块化计划

### 完成
- 力娅 `photo_reply` 的 `lines` 多气泡渲染链路已接入，`message.text` 兼容保留，`message.lines` 用于新渲染。
- 顶部第一行布局调整为“左：位置；右：时间+电量”，不改数据逻辑与样式体系。

### 修复 / 补丁
- 聊天逐行播放期间接入滚动保持策略（near-bottom 保底、非底部保持相对阅读位置）。
- 聊天详情区高度扩大到约 1.5 倍并保留内部滚动。
- 力娅逐行延迟参数按目标翻倍：`BASE=500`、`CHAR_MULTIPLIER=70`、`MAX_CHAR_DELAY=1900`。

### 设计决策
- 力娅正在逐行动画回复时（且玩家在力娅聊天页）建议临时禁发：
  - 仅限该时刻；
  - UI 轻提示 + disabled；
  - 不写入存档/`localStorage`。
- UI 视觉方向确认：扁平、纸面、低饱和、少阴影、少描边、按钮靠底部厚度表达可点击感。

### 已知问题
- 三行消息边界：第三行出现后 `mark read -> render` 可能仍触发一次跳顶（时序型问题）。

### 下一步
- 先补“最后一行已读刷新滚动恢复”边界补丁并回归三行场景。
- 再推进 M1：消息面板 UI 纯搬迁至 `src/ui/messagePanel.js`（计划中，未落地）。
- 拆分阶段不改业务状态结构、不改 queue、不改红点与已读语义。

### 状态说明
- 本次记录以“已完成 / 已实现但待手测 / 已知问题 / 计划中”区分。
- Codex 环境未执行浏览器手测，未将未验证事项写为“测试通过”。
