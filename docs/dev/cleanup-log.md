# 清扫记录

## 2026-06-05 安全清扫 1

### 删除了什么

- 未删除运行时代码或样式。
- 原因：`docs/dev/audit-2026-06.md` 的“可以删除”分类明确为空，当前没有已被审计确认为可直接删除的内容。

### 为什么安全

- 本轮只添加注释和记录文档，不改变任何条件判断、函数返回值、CSS 属性、HTML 结构、LocalStorage key、analytics payload 或 survey 字段。
- `PHOTO / FOCUS / RESULT`、拍照概率、稀有度、加新流程、消息选择逻辑和图鉴存档结构未修改。

### 只是标记没有删除

- `src/main.js` 中 `POST_SURVEY_STATUS_KEY` 标记为 `DEPRECATED_CANDIDATE`：当前一次性问卷 gate 使用 `PLAYTEST2_DRIVING_SURVEY_DONE_KEY`，旧 key 仍保留以避免误伤历史兼容。
- `src/main.js` 中 `hasSubmittedPostSurvey()` 标记为 `DEPRECATED_CANDIDATE`：审计时未发现当前调用方，但旧 survey status 读链路仍保留。
- `styles/style.css` 中 `.message-time` 标记为 `DEPRECATED_CANDIDATE`：聊天详情当前不显示现实时间，但 class 与样式先保留，等待确认 UI 输出不再依赖。

### 需要后续确认

- `birdwatch_text_sim_post_survey_status` 是否仍被 reset 文案、历史数据检查或外部测试脚本读取。
- `.message-time` 是否还会由 `src/ui/messagePanel.js` 或旧消息 HTML 输出。
- `birdwatch_playtest2_driving_survey_done` 是否应纳入测试数据清理 registry。
- `SPOT_SELECT`、`PRECIOUS`、`clearFieldGuide()` 继续保留，等待独立确认任务。

### 回归测试结果

- 静态检查：`git diff --check` 通过。
- 启动检查：未执行；本机未找到 `python` / `py` / `node` 等可直接启动静态服务的运行时，且当前会话没有可用浏览器自动化工具。
- 一局完整流程：未执行；原因同上。
- PHOTO / FOCUS / RESULT：未执行；原因同上。
- 加新：未执行；原因同上。
- 消息：未执行；原因同上。
- 笔记 / 图鉴：未执行；原因同上。
- 结算：未执行；原因同上。
- 默认 main 不显示问卷：未执行浏览器验收；静态代码仍显示 `PLAYTEST_CONFIG.surveyEnabled` / `settlementSurveyEnabled` 默认关闭。
- 默认 main 不发送 analytics：未执行网络验收；静态代码仍显示 `PLAYTEST_CONFIG.analyticsEnabled` 默认关闭，`analytics.js` 入口会 no-op。
- 控制台无报错：未执行；原因同上。
