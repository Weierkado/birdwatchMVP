# AGENTS.md

你正在协助开发 HTML/CSS/JS 单体游戏 demo《认鸟手信》。

## 工作原则

1. 按模块化维护原则执行。
2. 只处理当前 prompt 明确指定的模块。
3. 不要顺手修其他问题；发现额外问题只记录，不修改。
4. 修改前先阅读 CODE_MAP.md，判断相关文件。
5. 不要每次全项目静态审计。
6. 如果 CODE_MAP.md 与实际代码冲突，以实际代码为准，并在结果里说明。
7. 优先做最小修改，避免重构。
8. 二测前以稳定为优先，不做大规模架构调整。
9. 不新增 console.log / debugger / alert。
10. 不改 localStorage key，除非 prompt 明确要求。

## 文件修改边界

纯样式任务：
- 优先只改 styles/style.css。
- src/main.js 只读确认 class，除非需要补精确 class。

渲染结构任务：
- 可改 src/main.js 和 styles/style.css。
- 不碰 storage / fieldGuide / gameSession，除非 prompt 明确允许。

数据兼容任务：
- 单独处理。
- 可改 src/storage.js、src/fieldGuide.js、src/main.js。
- 不和 UI 精修混在一轮做。

游戏流程任务：
- 单独处理。
- 修改前必须确认 action、state、render 的调用链。

## 完成后汇报

每次完成后说明：
1. 修改了哪些文件。
2. 每个文件改了什么。
3. 是否遵守 scope。
4. 是否发现额外问题但未修改。
5. git diff --check 是否通过。