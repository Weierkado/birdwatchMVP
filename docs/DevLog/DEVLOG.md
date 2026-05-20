# DEVLOG

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
