# DEVLOG

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
