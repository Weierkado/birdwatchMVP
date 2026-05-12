```md
# 观鸟模拟器 · 项目开发约束文档

## 1. 当前开发阶段

当前阶段是：

```text
纯文字 HTML MVP

目标是验证核心玩法循环，不是制作完整商业 Demo。

2. 技术约束

必须使用：

HTML
CSS
JavaScript
LocalStorage
VSCode Live Server

禁止使用：

React
Vue
Svelte
Vite
TypeScript
Webpack
npm 依赖
后端服务
数据库
Canvas
WebGL

除非用户明确要求，否则不要引入构建工具。

3. 代码组织约束

项目必须保持模块化。

推荐目录结构：

birdwatch-text-sim/
├─ index.html
├─ styles/
│  └─ style.css
├─ src/
│  ├─ main.js
│  ├─ gameState.js
│  ├─ gameSession.js
│  ├─ birdManager.js
│  ├─ encounterSystem.js
│  ├─ photoSequence.js
│  ├─ cardDraw.js
│  ├─ fieldGuide.js
│  └─ storage.js
├─ data/
│  ├─ species.js
│  ├─ cards.js
│  └─ config.js
├─ docs/
│  ├─ MVP_TEXT_DESIGN.md
│  ├─ PROJECT_CONSTRAINTS.md
│  └─ DEVLOG.md
└─ README.md
4. 模块职责
4.1 index.html

只负责页面结构。

不要在 HTML 里写复杂游戏逻辑。

4.2 styles/style.css

只负责样式。

可以做移动端竖屏适配，但不要引入 CSS 框架。

4.3 src/main.js

项目入口。

职责：

初始化游戏
绑定 UI 事件
调用 render
连接各个模块

不要把所有游戏规则都写在 main.js 里。

4.4 src/gameState.js

负责创建和重置游戏状态。

包含：

当前回合
最大回合数
当前方向
当前模式
SD 卡照片列表
当前发现的鸟
日志
本局新增图鉴记录
4.5 src/gameSession.js

负责一局游戏的主流程。

包含：

startGame
endGame
advanceTurn
handleAction
enterPhotoMode
exitPhotoMode
settlement
4.6 src/birdManager.js

负责局内鸟类实体。

包含：

生成活动鸟
更新鸟的停留回合
鸟移动
鸟飞走
获取当前方向附近的鸟
生成线索
4.7 src/encounterSystem.js

负责观察判定。

包含：

根据当前方向判断是否有鸟
根据线索强度判断是否发现鸟
处理观察失败或错过
4.8 src/photoSequence.js

负责拍照时机。

包含：

创建行为序列
获取当前行为阶段
等待推进行为阶段
判断是否飞走
4.9 src/cardDraw.js

负责抽卡。

包含：

根据 speciesId 和 behaviorState 选择卡池
随机抽取卡牌
返回 CardData
4.10 src/fieldGuide.js

负责图鉴。

包含：

markHeard
addCard
getGuide
getNewDiscoveries
renderFieldGuideData
4.11 src/storage.js

负责 LocalStorage。

包含：

saveFieldGuide
loadFieldGuide
clearFieldGuide
4.12 data/species.js

只存鸟种数据。

不要在这里写游戏逻辑。

4.13 data/cards.js

只存卡牌数据。

不要在这里写游戏逻辑。

4.14 data/config.js

只存配置数据。

例如：

最大回合数
SD 卡容量
初始活动鸟数量
观察成功率
鸟停留回合范围
5. 数据与逻辑分离

禁止把具体鸟种和具体卡牌硬编码到逻辑模块中。

错误示例：

if (speciesId === "red_whiskered_bulbul") {
  return "红耳鹎";
}

正确做法：

const species = speciesList.find(item => item.id === speciesId);
return species.name;
6. UI 与游戏逻辑分离

UI 只负责：

显示状态
显示文字
显示按钮
接收点击

游戏规则必须放在 src 内的逻辑模块中。

错误示例：

button.onclick = () => {
  gameState.turn -= 1;
  gameState.photos.push(...);
  localStorage.setItem(...);
};

正确示例：

button.onclick = () => {
  const result = gameSession.handleAction("observe");
  render(result);
};
7. MVP 行为约束

第一版只做以下玩家行动：

观察当前方向
向左转
向右转
回头观察
静听
等待片刻

拍照模式只做：

按下快门
再等一等
放弃拍摄

不要添加额外复杂行动，除非用户确认。

8. 状态模式约束

游戏至少包含以下模式：

"START"
"EXPLORE"
"PHOTO"
"SETTLEMENT"
"FIELD_GUIDE"

不要用大量布尔值控制主状态。

不推荐：

isPlaying: true,
isPhotoMode: false,
isSettlement: false

推荐：

mode: "EXPLORE"
9. 随机性约束

随机性要集中管理，避免散落在各个 UI 事件中。

可以暂时使用 Math.random()，但调用应集中在：

birdManager.js
encounterSystem.js
cardDraw.js
photoSequence.js

后续可以替换为 seed random。

10. LocalStorage 约束

LocalStorage 只保存跨局数据。

允许保存：

图鉴
已发现鸟种
已收集卡牌

不需要保存：

当前局中间状态
当前回合
当前正在拍照的鸟
临时日志

LocalStorage key 建议统一：

const STORAGE_KEY = "birdwatch_text_sim_field_guide";
11. UI 风格约束

MVP UI 应该清晰、朴素、适合移动端竖屏。

风格方向：

自然观察笔记
轻量手帐
文字冒险

要求：

页面宽度适合手机
按钮足够大
文本易读
日志不要过长，最多显示最近若干条
状态信息固定在明显位置
12. 不要过早优化

第一版优先级：

完整可玩流程 > 代码结构 > 简单样式 > 动画表现

不要为了美观牺牲结构清晰。

13. 每次修改要求

Codex 每次修改前必须先说明：

本次会修改哪些文件
每个文件的修改目的
是否会影响现有数据结构

除非用户明确要求，否则不要进行大规模无关重构。

14. 初学者友好要求

代码需要适合 HTML/JavaScript 初学者理解。

要求：

命名清晰
函数不要过长
复杂逻辑加注释
不使用晦涩语法
不使用过度抽象
不使用不必要的设计模式
15. 第一阶段完成定义

当满足以下条件时，第一阶段完成：

Live Server 打开 index.html 后可运行
可以开始一局
可以完成 30 回合
可以观察、转向、静听、等待
可以发现鸟
可以进入拍照模式
可以拍照获得卡牌
可以等待更好时机
鸟会飞走
可以进入结算
可以查看本局照片
可以保存并查看图鉴
刷新后图鉴不会丢失

---

# 3. `CODEX_INIT_PROMPT.md`

```md
# Codex 第一次执行指令

你是一名经验丰富的前端游戏工程师。请协助我从零初始化一个纯文字 HTML 观鸟模拟器 MVP 项目。

我目前不熟悉 HTML 项目开发，所以请使用清晰、简单、可维护的结构，不要引入复杂工具链。

## 一、项目目标

开发一个纯文字版观鸟模拟器，用于验证核心玩法循环：

```text
找鸟线索 → 选择观察方向 → 发现鸟 → 拍照时机选择 → 抽取卡牌 → 存入 SD 卡 → 更新图鉴 → 局后结算

这不是完整美术版游戏。当前不做 4×4 网格、翻牌动画、真实音频、地图、装备或复杂演出。

请优先阅读并遵守：

docs/MVP_TEXT_DESIGN.md
docs/PROJECT_CONSTRAINTS.md
二、技术要求

必须使用：

HTML
CSS
JavaScript
LocalStorage
VSCode Live Server

不要使用：

React
Vue
Svelte
Vite
TypeScript
npm
Webpack
Canvas
WebGL
后端服务

项目应能通过 VSCode Live Server 打开 index.html 直接运行。

三、请先创建项目结构

请创建以下文件结构：

birdwatch-text-sim/
├─ index.html
├─ styles/
│  └─ style.css
├─ src/
│  ├─ main.js
│  ├─ gameState.js
│  ├─ gameSession.js
│  ├─ birdManager.js
│  ├─ encounterSystem.js
│  ├─ photoSequence.js
│  ├─ cardDraw.js
│  ├─ fieldGuide.js
│  └─ storage.js
├─ data/
│  ├─ species.js
│  ├─ cards.js
│  └─ config.js
├─ docs/
│  ├─ MVP_TEXT_DESIGN.md
│  ├─ PROJECT_CONSTRAINTS.md
│  └─ DEVLOG.md
└─ README.md

如果 docs 文件已经存在，不要覆盖我的文档内容，只补充缺失文件。

四、模块职责

请按照以下职责实现，不要把所有代码塞进一个 script.js。

index.html

负责页面结构，引用 CSS 和 JS。

styles/style.css

负责移动端友好的基础样式。

风格方向：

自然观察笔记
朴素手帐
文字冒险
src/main.js

项目入口。

负责：

初始化
绑定按钮事件
调用渲染函数
连接其他模块
src/gameState.js

负责创建默认游戏状态。

状态至少包含：

mode
currentTurn
maxTurns
facingDirection
photos
logs
activeBirds
currentPhotoTarget
fieldGuide
src/gameSession.js

负责一局游戏流程。

需要支持：

startGame()
handleExploreAction(action)
handlePhotoAction(action)
endGame()
src/birdManager.js

负责鸟类实体。

需要支持：

initializeBirds()
updateBirds()
getBirdsInCurrentDirection()
generateClues()
src/encounterSystem.js

负责观察和发现判定。

需要支持：

observeCurrentDirection()
listen()
src/photoSequence.js

负责拍照时机。

需要支持：

createPhotoSequence()
getCurrentPhotoState()
advancePhotoSequence()
isBirdGone()
src/cardDraw.js

负责根据当前行为阶段抽卡。

需要支持：

drawCard(speciesId, behaviorState)
src/fieldGuide.js

负责图鉴数据。

需要支持：

markHeard(speciesId)
addCard(cardData)
getFieldGuide()
src/storage.js

负责 LocalStorage。

需要支持：

loadFieldGuide()
saveFieldGuide(fieldGuide)
clearFieldGuide()
data/species.js

存放鸟种数据。

第一版至少包含 5 种鸟：

红耳鹎
白头鹎
麻雀
乌鸫
翠鸟
data/cards.js

存放卡牌数据。

每种鸟至少 3 张卡：

普通卡
有趣卡
精彩卡
data/config.js

存放配置。

至少包括：

MAX_TURNS = 30
MAX_PHOTOS = 50
INITIAL_ACTIVE_BIRDS = 3
五、第一版玩法要求
探索状态

玩家可以点击：

开始游戏
观察当前方向
向左转
向右转
回头观察
静听
等待片刻
查看图鉴
拍照状态

玩家发现鸟后进入拍照状态。

玩家可以点击：

按下快门
再等一等
放弃拍摄

拍照时机包括：

NORMAL
INTERESTING
REMARKABLE
FLY_AWAY

不同阶段抽卡规则：

NORMAL：
只从 NORMAL 卡池抽。

INTERESTING：
从 INTERESTING + NORMAL 卡池抽。

REMARKABLE：
从 REMARKABLE + INTERESTING + NORMAL 卡池抽。
结算状态

一局结束后显示：

本局拍照数量
发现鸟种
新增卡牌
总星级
照片列表
重新开始按钮
查看图鉴按钮
六、UI 要求

页面应包含：

标题
当前状态
剩余回合
当前方向
SD 卡容量
事件描述
行动按钮
观察日志
图鉴 / 结算区域

按钮需要适合手机点击。

不要追求复杂美术，先保证可读、可玩、结构清晰。

七、重要约束

请严格遵守：

不要引入任何第三方库。
不要使用 npm。
不要使用框架。
不要把数据写死在逻辑里。
不要把游戏规则写在 HTML 按钮 onclick 内。
不要一次性加入未来功能。
不要实现 4×4 网格。
不要实现音频。
不要实现动画系统。
不要实现装备和地图。
代码要适合初学者阅读。
每个模块职责要清晰。
八、执行方式

在正式写代码前，请先输出：

1. 你将创建/修改的文件列表
2. 每个文件的职责
3. 你对 MVP 范围的理解

然后再开始生成代码。

九、第一轮完成标准

第一轮开发完成后，我应该能够：

用 VSCode Live Server 打开 index.html。
点击“开始游戏”。
进行探索。
转向、静听、观察。
发现鸟。
进入拍照流程。
选择拍照或等待。
获得卡牌。
完成一局并结算。
查看图鉴。
刷新页面后图鉴仍然存在。