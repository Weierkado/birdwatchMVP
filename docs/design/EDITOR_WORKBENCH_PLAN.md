# 《认鸟手信》编辑器工作台规划

## 1. 规划目标

编辑器工作台是内容生产工具，不是玩家功能。它的第一阶段目标是让作者可以直接编辑、预览、导入 / 导出关键文本内容，减少每次小文案调整都依赖 Codex 改代码的成本。

当前优先解决：

- Liya 消息难以总览、筛选、批量修订的问题。
- 鸟类知识、卡牌描述、鸟点文本需要稳定维护的问题。
- 触发条件不够可读，容易造成消息误触发或漏触发的问题。
- 三测内容扩容后，人工检查 id、引用、tag、trigger 的成本上升问题。

当前阶段不追求多人协作后台，不做服务器 CMS，不做权限系统，不直接写入运行时代码文件。编辑器产物应先通过导入 / 导出和校验流程进入内容生产闭环。

本文是规划文档，不代表编辑器工作台已经实现，也不要求本轮修改 `message-editor.html`、运行时代码、现有数据文件或存档结构。

## 2. 设计原则

### 2.1 作者友好

编辑器应服务非程序化内容维护。作者需要看到全局文本、按条件筛选、搜索、修改、预览和导出，而不是在 JSON / JS 文件里手动定位每一条内容。

### 2.2 运行时安全

编辑器生成的数据必须经过校验，避免破坏游戏运行。任何导出内容都应在进入 `data/` 前检查必填字段、引用完整性、枚举值、文本泄露边界和重复 id。

### 2.3 先文本，后系统

第一阶段优先解决文本编辑、触发条件可视化和内容预览，不先做复杂剧情图谱、完整状态机编辑或自动化内容生产系统。

### 2.4 渐进接入

优先支持 `liyaMessages`，再逐步支持 birds / birdCards / spots / events。每个数据域接入前都应先明确 schema、校验规则和运行时实际消费字段。

### 2.5 与 Codex 协作

编辑器用于日常内容编辑；Codex 仍用于结构改造、批量迁移、schema 调整、复杂检查和回归清单维护。编辑器不是为了取代 Codex，而是减少简单文案改动对 Codex 的依赖。

## 3. MVP 范围

第一版编辑器 MVP 明确以 Liya 消息编辑器为核心。

### MVP 必做

- 加载现有 Liya 消息数据。
- 以表格 / 卡片方式展示消息。
- 支持按 `trigger`、`birdId`、`rarity`、`toneTags`、`emotionTags` 搜索或筛选。
- 支持编辑消息正文。
- 支持编辑 tags。
- 支持编辑优先级 `priority`。
- 支持编辑 `once` / `cooldown` 等基础控制字段。
- 支持新增消息。
- 支持复制消息。
- 支持删除消息，但必须二次确认。
- 支持导出 JSON。
- 支持导入 JSON。
- 支持基础 schema 校验。
- 支持提示缺失 id、重复 id、缺失 text / lines、trigger 无效等问题。

### MVP 暂缓

- 复杂剧情图谱。
- 可视化状态机。
- 云端保存。
- 多人协作。
- 权限系统。
- AI 自动生成并直接写入。
- 完整 posts / accountProgress 编辑。
- 直接修改 `src/main.js` 或运行时代码。

## 4. 第一优先级：Liya 消息编辑器

Liya 消息是当前主要正反馈之一，也是三测内容扩展最容易膨胀的文本池，因此是最高优先级。

建议编辑器内部展示字段：

```js
{
  id: "liya_sparrow_first_catalogued",
  trigger: {},
  speaker: "liya",
  text: "",
  toneTags: [],
  knowledgeTags: [],
  emotionTags: [],
  followUpIds: [],
  cooldown: {},
  priority: 0,
  once: true
}
```

字段用途：

- `id`：稳定消息 id，用于运行时选择、引用、去重和校验。
- `trigger`：可读触发条件集合，不应要求作者直接写复杂 JS 表达式。
- `speaker`：说话人，MVP 主要是 `liya`，未来可扩展其他联系人。
- `text`：编辑器展示层的正文，可在导出时转换为当前运行时需要的 `lines` 结构。
- `toneTags`：语气标签，用于筛选和平衡文本语气。
- `knowledgeTags`：知识点标签，用于连接鸟类知识或图鉴补充。
- `emotionTags`：情绪标签，用于检查妹妹表达的节奏。
- `followUpIds`：后续消息引用，MVP 可只校验存在性，不实现复杂追问系统。
- `cooldown`：冷却或重复控制的可读表达，导出时需匹配运行时实际字段。
- `priority`：候选消息排序优先级。
- `once`：是否一次性触发，导出时可映射到当前运行时支持的 `allowRepeat` 或等价字段。

当前 `data/liyaMessages.json` 的实际字段仍以运行时代码为准。编辑器字段可以是作者友好的中间展示层，但导出前必须转换为运行时可消费结构。

### 4.1 触发条件编辑

触发条件应支持以下类型的可读配置：

- `birdId`
- `cardId`
- `rarity`
- `locationId`
- `spotId`
- `timeOfDay`
- `weather`
- `dayIndex` range
- `catalogued` / `seen` / `heard` 状态
- `repeatedPhotoCount`
- `unreadMessageCount`
- `afterMessageId`
- `narrativeFlag`

MVP 不一定全部实现，但字段设计应预留。触发条件必须可读、可校验、可预览，避免只允许作者填写复杂 JS 表达式。

### 4.2 语气标签

建议标签：

- `teacher`
- `childlike`
- `teasing`
- `proud`
- `worried`
- `lonely`
- `pretending_ok`
- `asking_for_attention`
- `knowledge_sharing`
- `comfort`

标签用途：

- 内容筛选。
- 检查妹妹语气是否过度重复。
- 未来辅助 AI 打磨时提供约束。
- 帮助作者平衡“求助”“撒娇”“知识分享”“装作没事”等状态。

这些标签不直接暴露给玩家。

### 4.3 文本预览

Liya 消息预览需要显示：

- 实际消息气泡。
- 分句效果预览。
- 可能的前置照片 / 卡牌信息。
- 触发原因摘要。
- 是否一次性。
- 优先级。
- tags 摘要。

预览不必完全复刻游戏 UI，但应尽量接近玩家看到的效果，尤其是多句气泡、换行、语气节奏和匿名阶段是否泄露正式鸟名。

### 4.4 质量检查

至少检查：

- `id` 唯一。
- `text` / `lines` 非空。
- `trigger` 至少有一个有效条件。
- `followUpIds` 指向存在消息。
- `toneTags` 合法。
- `knowledgeTags` 合法。
- `priority` 是数字。
- `cooldown` 格式合法。
- `once` 是布尔值。
- 同一 trigger 下是否有过多消息。
- 同一 `birdId` 是否缺少基础回复。
- 未加新 / 匿名阶段文本是否泄露正式鸟名。

## 5. 第二优先级：鸟种 / 卡牌 / 鸟点文本编辑器

第二优先级服务三测“丰富的世界”。这些编辑器应先聚焦文本和引用关系，不先重写遭遇系统。

### 5.1 birds 编辑

字段来源参考 `DATA_SCHEMA_PLAN.md`：

- `id`
- `displayName`
- `aliases`
- `appearance`
- `firstEncounterAppearance`
- `soundscape`
- `personalityTags`
- `habitats`
- `activeTime`
- `liyaKnowledgeTags`
- `narrativeTags`
- `unlockStage`
- `isPreciousEligible`

重点：

- 未 `catalogued` 前不能暴露 `displayName`。
- `appearance` / `firstEncounterAppearance` 是匿名阶段的核心文本。
- `id` 一旦进入运行时和存档引用，不应由编辑器随意改名。

### 5.2 birdCards 编辑

建议字段：

- `id`
- `birdId`
- `rarity`
- `title`
- `description`
- `photoText`
- `focusHint`
- `compositionTags`
- `timeTags`
- `moodTags`
- `liyaReactionTags`
- `postPotentialTags`
- `isPrecious`
- `unlockConditions`

重点：

- `rarity` 是照片状态，不是鸟种稀有度。
- 珍贵卡需要明确叙事条件，不建议纯概率化。
- 卡牌标题和描述在未加新前也不应泄露正式鸟名。
- `birdId` 必须引用存在的 birds / species 数据。

### 5.3 spots 编辑

建议字段：

- `id`
- `locationId`
- `name`
- `description`
- `soundscapeText`
- `encounterPool`
- `weatherModifiers`
- `timeModifiers`
- `unlockCondition`
- `birdwatcherEventIds`
- `narrativeTags`

重点：

- spot 是“倾听远处的声音”和世界厚度的主要入口。
- `soundscapeText` 需要可预览。
- `encounterPool` 和运行时当前 `speciesWeights` 的关系必须明确，不能导出运行时无法消费的数据。

## 6. 第三优先级：天气 / 夜晚想法 / 观鸟人事件

这些内容服务世界厚度和人物弧线，建议规划但不要求 MVP 实装。

### 6.1 weather 编辑

支持：

- `name`
- `description`
- `soundscapeModifier`
- `polaroidTone` 预览。
- `encounterModifiers`
- `liyaCommentTags`
- `moodTags`

天气编辑器应优先帮助作者检查“天气如何改变文本氛围”，而不是先做复杂数值模拟。

### 6.2 nightThoughts 编辑

支持：

- `trigger`
- `title`
- `body`
- `choices`
- `effects`
- `relatedBirdIds`
- `narrativeTags`

说明：

- `nightThoughts` 是陈玉内心变化的重要容器。
- 可以和未来“夜晚选择一张照片发布”连接。
- MVP 阶段不应把它做成复杂分支剧情树。

### 6.3 birdwatcher events 编辑

支持：

- `eventId`
- `NPC` / `author`
- `body`
- `choices`
- `effects`
- `valuesTags`
- `once`
- `priority`

说明：

- 观鸟人事件服务价值观和世界厚度。
- 不做复杂 NPC 好感系统。
- 事件效果应使用可审计引用，不应让作者直接写运行时代码。

## 7. 未来预留：发布系统内容编辑

发布系统编辑明确是未来预留，不是三测 MVP。

可规划内容：

- `posts`
- `postComments`
- `accountProgress` tuning

边界：

- 发布系统服务陈玉的表达和自我重建。
- 点赞 / 粉丝不应成为新 KPI。
- 评论池应强化“普通鸟也抵达了别人”。
- `accountProgress` 应以定性阶段、语气变化、主题解锁为主，不应做强数值经营。

## 8. 导入 / 导出设计

### 8.1 导入

支持：

- 从本地 JSON 文件导入。
- 粘贴 JSON 导入。
- 导入前校验。
- 导入后显示变更摘要。
- 导入后保留原数据备份提示。

导入不应直接写入项目文件系统。MVP 可以只在浏览器内存中编辑，再由作者导出文件。

### 8.2 导出

支持：

- 导出完整 JSON。
- 导出当前筛选结果。
- 导出变更 diff，作为未来预留。
- 导出前再次校验。
- 导出时明确目标运行时 schema。

### 8.3 文件格式

MVP 应直接读写当前运行时能消费的 JSON / JS 数据格式。若运行时仍使用 JS module 数据，编辑器可先导出 JSON，再由 Codex 或转换脚本同步。

不建议第一版直接修改源代码文件，不建议编辑器绕过 schema 校验。

## 9. 校验规则

通用校验：

- `id` 唯一。
- 必填字段非空。
- 引用存在。
- tag 合法。
- trigger 格式合法。
- rarity 合法。
- `birdId` 存在。
- `cardId` 存在。
- `spotId` 存在。
- `priority` 合法。
- `once` / boolean 字段合法。
- 文本长度提示。
- 未命名阶段是否泄露正式鸟名。
- followUp 是否形成循环。
- cooldown 是否合理。
- 同一触发条件是否过度拥挤。

域专属校验：

- Liya 消息：检查 trigger 是否被当前运行时支持。
- birds：检查 `firstEncounterAppearance` 是否可独立成立。
- birdCards：检查 `rarity` 与标题 / 描述是否匹配照片语义。
- spots：检查相邻点、方向文案和遭遇池是否一致。
- weather：检查天气 tag 是否被遭遇或文本引用。
- postComments：检查评论不会把发布系统推向流量 KPI。

## 10. 预览能力

规划预览：

- Liya 消息气泡预览。
- 分句动画预览。
- 卡牌 / 拍立得文本预览。
- 鸟点 soundscape 预览。
- 结算夜晚想法预览。
- 发布评论预览，未来预留。

预览不一定复用完整游戏 UI，但要尽量接近玩家看到的效果。预览只能读编辑器内存数据，不应触发游戏存档写入、analytics、survey 或消息队列。

## 11. 与运行时 data 文件的关系

编辑器不直接替代运行时。

建议流程：

1. 作者在编辑器中导入当前内容数据。
2. 作者编辑文本、tag、trigger 和 priority。
3. 编辑器执行 schema 校验和预览。
4. 作者导出 JSON。
5. 由人工、Codex 或后续转换脚本把导出结果同步到 `data/`。
6. 回到游戏执行回归测试。

边界：

- 不建议编辑器直接写 `src/main.js`。
- 不建议编辑器直接改 LocalStorage。
- 不建议编辑器绕过 schema 校验。
- 不建议编辑器直接改 analytics、survey 或测试开关。
- 如果运行时字段与编辑器字段不一致，必须有明确转换层。

## 12. 与 Codex 工作流的关系

Codex 适合：

- 创建编辑器基础页面。
- 编写 schema 校验器。
- 编写数据迁移脚本。
- 批量字段补齐。
- 生成测试数据。
- 检查引用完整性。
- 同步 DevLog / Code Map / 回归清单。

作者适合：

- 修改妹妹语气。
- 调整鸟类知识。
- 调整卡牌描述。
- 选择触发条件。
- 观察预览效果。
- 判断文本是否符合人物关系和主题。

编辑器减少的是日常小文本维护成本，不替代 Codex 对结构、迁移和复杂一致性检查的作用。

## 13. 推荐技术形态

结合当前项目是 vanilla HTML/CSS/JS，第一版建议：

- 扩展现有 `message-editor.html`，或在后续单独新建编辑器页面。
- 使用原生 JS。
- 使用本地 FileReader 导入。
- 使用 Blob 下载导出。
- 不接服务器。
- 不依赖构建工具。
- 不引入框架。
- 不写入本地文件系统。
- 不接云数据库。

当前最重要的是跑通“可视化编辑 -> 导出 -> 回填 data -> 游戏验证”的闭环。

## 14. 落地顺序

建议顺序：

1. 只读打开现有 Liya 消息 JSON。
2. 表格 / 卡片展示。
3. 搜索和筛选。
4. 编辑 text / tags / priority。
5. 导出 JSON。
6. 导入 JSON。
7. schema 校验。
8. 触发条件可视化。
9. 消息气泡预览。
10. 分句动画预览。
11. 扩展到 birds / cards / spots。
12. 扩展到 weather / nightThoughts。
13. 最后考虑 posts / comments。

每一步都应保持运行时行为不变，编辑器功能改动应与游戏逻辑改动分开提交。

## 15. 风险清单

必须持续关注：

1. 编辑器字段和运行时字段不一致。
2. 导出 JSON 后运行时无法消费。
3. 触发条件可视化过度复杂。
4. 作者误删重要消息。
5. id 重复导致运行时覆盖或触发异常。
6. 未命名阶段文本泄露正式鸟名。
7. AI 生成文本直接入库导致语气不稳定。
8. 编辑器过早扩成复杂 CMS。
9. 多数据域互相引用后校验不足。
10. 忘记回归游戏主流程。

缓解方式：

- 删除需要二次确认。
- 导出前必须校验。
- 保留导入前数据备份提示。
- 标记高风险字段，如 id、trigger、birdId、cardId。
- 每次 schema 调整都同步更新文档和回归清单。

## 16. 三测前推荐 MVP

三测前最小编辑器范围：

必须做：

- Liya 消息加载。
- Liya 消息总览。
- 搜索 / 筛选。
- 正文编辑。
- tags 编辑。
- priority 编辑。
- JSON 导出。
- JSON 导入。
- id / text / trigger 基础校验。

可以做：

- 消息气泡预览。
- 分句预览。
- card / bird 引用预览。
- trigger 可读摘要。

暂缓：

- 云端保存。
- 多人协作。
- 完整 birds / cards / spots 编辑。
- posts / comments 编辑。
- 复杂剧情图谱。
- 自动写入项目文件。
- 账号成长 tuning。

## 17. 明确不做

当前规划不做：

- 不生成实际编辑器代码。
- 不修改 `message-editor.html`。
- 不修改 `src/*`。
- 不修改 `data/*`。
- 不修改 `styles/*`。
- 不修改 `index.html`。
- 不修改 analytics。
- 不修改 survey。
- 不修改 PHOTO / FOCUS / RESULT。
- 不修改消息队列。
- 不修改自动加新。
- 不修改存档 key。

