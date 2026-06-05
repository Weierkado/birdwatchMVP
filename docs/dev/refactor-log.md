# 认鸟手信 · 工程拆分记录

## 2026-06 第一轮低风险拆分

### 已完成

- `src/utils/dom.js`
- `src/utils/format.js`
- `src/utils/config.js`
- `src/core/saveManager.js`
- `src/core/telemetryAdapter.js`

### 每个模块的边界

#### `src/utils/dom.js`

- 做什么：HTML escape、正则转义等轻量显示安全 helper。
- 不做什么：不读写 gameState，不读写 LocalStorage，不调用 analytics，不承接业务逻辑。

#### `src/utils/format.js`

- 做什么：时间段、卡牌标题/描述、拍立得日期、消息时间、加新日期等纯展示格式化。
- 不做什么：不读写 DOM，不读写 gameState，不读写 LocalStorage，不承接业务判断。

#### `src/utils/config.js`

- 做什么：统一读取 `PLAYTEST_CONFIG`，提供 analytics / survey / opening survey / settlement survey / survey version helper。
- 不做什么：不改变默认开关值，不承接业务流程。

#### `src/core/saveManager.js`

- 做什么：轻量 LocalStorage facade；当前只处理安全读写、observation day index、playtest2 driving survey done。
- 不做什么：不处理 fieldGuide 主存档、不处理 v2->v3 迁移、不处理 `tester_uuid` / `session_index` / `analytics retry`。

#### `src/core/telemetryAdapter.js`

- 做什么：轻量 analytics wrapper，供 `main.js` 通过统一入口调用 telemetry 能力。
- 不做什么：不迁移 `main.js` 中的 analytics runtime counters，不改事件名，不改 payload，不改 `session_start` / `session_end` / `flush` 时机。

### 保持不变

- PHOTO / FOCUS / RESULT 未动
- 消息队列未动
- 自动加新未动
- LocalStorage key 未改
- analytics payload 未改
- survey payload 未改
- UI 样式未改

### 手工回归

- dom / format 回归通过
- config helper 回归通过
- saveManager-lite 回归通过
- telemetryAdapter-lite 回归通过

### 后续建议

1. 先暂停继续深拆，保持当前已验证边界稳定。
2. 下一阶段优先做数据结构规则 / 编辑器规划，而不是直接继续拆高风险流程。
3. 如果继续拆代码，优先考虑 UI render 层，而不是 PHOTO / FOCUS / RESULT 或消息队列。
4. fieldGuide 主存档、analytics runtime counters、消息队列都需要独立任务和完整回归。
