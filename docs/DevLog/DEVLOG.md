# DEVLOG

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
