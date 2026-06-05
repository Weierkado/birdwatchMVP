# 认鸟手信 · Codex 协作工作流

## 1. 基本原则

- 每次只做一个明确 scope。
- 不要顺手重构。
- 结构调整和行为修改分开提交。
- 先审计，再修改。
- 不确定废弃就标记，不删除。
- 运行时代码和文档变更分开。
- 小步提交，每次提交都能解释风险边界。
- 每次修改后都要给出回归场景。

## 2. 标准任务流程

1. 阅读相关文档：优先 `docs/DevLog/AGENTS.md`、`docs/DevLog/CODE_MAP.md`、`docs/dev/ARCHITECTURE.md`。
2. 确认允许修改文件。
3. 确认不要修改文件。
4. 搜索相关调用点，优先使用 `rg`。
5. 做最小补丁。
6. 运行静态检查，例如 `git diff --check`。
7. 输出修改文件列表。
8. 输出风险点。
9. 输出回归建议。

## 3. Prompt 必须包含的字段

- 背景。
- 目标。
- 允许修改。
- 不要修改。
- 硬性边界。
- 任务拆分。
- 验收场景。
- 验收标准。

## 4. 禁止事项

- 不整文件重写。
- 不新增第三方库。
- 不新增 `console.log` / `debugger` / `alert`。
- 不改 LocalStorage key。
- 不改 analytics payload 顶层结构。
- 不改 survey 字段名。
- 不改 PHOTO / FOCUS / RESULT。
- 不改消息队列。
- 不改自动加新。
- 不改回合推进。
- 不做无关 UI 改版。
- 不把问卷默认打开。
- 不把 analytics 默认打开。
- 不删除旧迁移逻辑。
- 不删除未来预留功能。

## 5. 常见任务分类

### 5.1 文档任务

- 只允许 docs diff。
- 不修改运行时代码、样式、数据或工具页面。
- 最终输出说明新增 / 修改了哪些文档。

### 5.2 CSS / UI 小修

- 优先只改 `styles/style.css`。
- 只有需要补 class 或结构时才最小修改 `src/main.js`。
- 不改业务状态和 LocalStorage。

### 5.3 文案数据任务

- 只改指定数据文件，例如 `data/liyaMessages.json` 或对应 JS 数据文件。
- 不同时做 UI、流程、analytics 或存档改动。
- JSON 任务必须确认可解析。

### 5.4 工具函数拆分

- 只做搬家，不改行为。
- 搬迁前后函数输入输出保持一致。
- 每次只拆一类：DOM、format、random、config helper。

### 5.5 存档封装

- 不改 key。
- 不改结构。
- 不改迁移。
- 新 facade 先包旧函数，不改变调用语义。

### 5.6 analytics 整理

- 不改事件名。
- 不改 payload 顶层结构。
- 不改 flush 时机。
- 不把 analytics 默认打开。

### 5.7 survey 整理

- 不改字段名。
- 不改题目。
- 不默认显示。
- 不改变一次性机制，除非任务明确要求。

## 6. 分支与提交建议

- `main`：稳定主开发。
- `playtest` / `test2`：二测归档或测试分支。
- `feature/xxx`：单项功能。
- `cleanup/xxx`：清扫和拆分。
- 每次小提交，不混大 scope。

提交信息建议：

- `docs: add regression checklist`
- `cleanup: mark deprecated survey status`
- `refactor: extract dom utils`
- `fix: keep field guide new badge in active state`
- `content: reduce Liya homework tone`

## 7. Codex 输出要求

每次完成任务，Codex 应输出：

- 修改文件。
- 做了什么。
- 没做什么。
- 风险点。
- 建议回归路径。
- 是否通过 `git diff --check`。
- 是否未执行浏览器手测；如未执行，必须明确说明。

## 8. 推荐 Prompt 模板

```text
背景：

目标：

允许修改：

不要修改：

硬性边界：

任务：

验收场景：

验收标准：
```
