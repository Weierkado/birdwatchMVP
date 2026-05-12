# 观鸟模拟器 · 项目开发约束文档

## 1. 当前开发阶段

当前阶段是：

```text
纯文字 HTML MVP
```

目标是验证核心玩法循环，不是制作完整商业 Demo。

## 2. 技术约束

必须使用：

- HTML
- CSS
- JavaScript
- LocalStorage
- VSCode Live Server

禁止使用：

- React
- Vue
- Svelte
- Vite
- TypeScript
- Webpack
- npm 依赖
- 后端服务
- 数据库
- Canvas
- WebGL

除非用户明确要求，否则不要引入构建工具。

## 3. 代码组织约束

项目必须保持模块化。

推荐目录结构：

```text
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
```

## 4. 模块职责

### 4.1 index.html

只负责页面结构。

不要在 HTML 里写复杂游戏逻辑。

### 4.2 styles/style.css

只负责样式。

可以做移动端竖屏适配，但不要引入 CSS 框架。

### 4.3 src/main.js

项目入口。

职责：

- 初始化游戏
- 绑定 UI 事件
- 调用 render
- 连接各个模块

不要把所有游戏规则都写在 main.js 里。

### 4.4 src/gameState.js

负责创建和重置游戏状态。

包含：

- 当前回合
- 最大回合数
- 当前方向
- 当前模式
- SD 卡照片列表
- 当前发现的鸟
- 日志
- 本局新增图鉴记录

### 4.5 src/gameSession.js

负责一局游戏的主流程。

包含：

- startGame
- endGame
- advanceTurn
- handleAction
- enterPhotoMode
- exitPhotoMode
- settlement

### 4.6 src/birdManager.js

负责局内鸟类实体。

包含：

- 生成活动鸟
- 更新鸟的停留回合
- 鸟移动
- 鸟飞走
- 获取当前方向附近的鸟
- 生成线索

### 4.7 src/encounterSystem.js

负责观察判定。

包含：

- 根据当前方向判断是否有鸟
- 根据线索强度判断是否发现鸟
- 处理观察失败或错过

### 4.8 src/photoSequence.js

负责拍照时机。

包含：

- 创建行为序列
- 获取当前行为阶段
- 等待推进行为阶段
- 判断是否飞走

### 4.9 src/cardDraw.js

负责抽卡。

包含：

- 根据 speciesId 和 behaviorState 选择卡池
- 随机抽取卡牌
- 返回 CardData

### 4.10 src/fieldGuide.js

负责图鉴。

包含：

- markHeard
- addCard
- getGuide
- getNewDiscoveries
- renderFieldGuideData

### 4.11 src/storage.js

负责 LocalStorage。

包含：

- saveFieldGuide
- loadFieldGuide
- clearFieldGuide

### 4.12 data/species.js

只存鸟种数据。

不要在这里写游戏逻辑。

### 4.13 data/cards.js

只存卡牌数据。

不要在这里写游戏逻辑。

### 4.14 data/config.js

只存配置数据。

例如：

- 最大回合数
- SD 卡容量
- 初始活动鸟数量
- 观察成功率
- 鸟停留回合范围

## 5. 数据与逻辑分离

禁止把具体鸟种和具体卡牌硬编码到逻辑模块中。

错误示例：

```js
if (speciesId === "red_whiskered_bulbul") {
  return "红耳鹎";
}
```

正确做法：

```js
const species = speciesList.find(item => item.id === speciesId);
return species.name;
```

## 6. UI 与游戏逻辑分离

UI 只负责：

- 显示状态
- 显示文字
- 显示按钮
- 接收点击

游戏规则必须放在 src 内的逻辑模块中。

错误示例：

```js
button.onclick = () => {
  gameState.turn -= 1;
  gameState.photos.push(...);
  localStorage.setItem(...);
};
```

正确示例：

```js
button.onclick = () => {
  const result = gameSession.handleAction("observe");
  render(result);
};
```

## 7. MVP 行为约束

第一版只做以下玩家行动：

- 观察当前方向
- 向左转
- 向右转
- 回头观察
- 静听
- 等待片刻

拍照模式只做：

- 按下快门
- 再等一等
- 放弃拍摄

不要添加额外复杂行动，除非用户确认。

## 8. 状态模式约束

游戏至少包含以下模式：

- "START"
- "EXPLORE"
- "PHOTO"
- "SETTLEMENT"
- "FIELD_GUIDE"

不要用大量布尔值控制主状态。

不推荐：

```js
isPlaying: true,
isPhotoMode: false,
isSettlement: false
```

推荐：

```js
mode: "EXPLORE"
```

## 9. 随机性约束

随机性要集中管理，避免散落在各个 UI 事件中。

可以暂时使用 Math.random()，但调用应集中在：

- birdManager.js
- encounterSystem.js
- cardDraw.js
- photoSequence.js

后续可以替换为 seed random。

## 10. LocalStorage 约束

LocalStorage 只保存跨局数据。

允许保存：

- 图鉴
- 已发现鸟种
- 已收集卡牌

不需要保存：

- 当前局中间状态
- 当前回合
- 当前正在拍照的鸟
- 临时日志

LocalStorage key 建议统一：

```js
const STORAGE_KEY = "birdwatch_text_sim_field_guide";
```

## 11. UI 风格约束

MVP UI 应该清晰、朴素、适合移动端竖屏。

风格方向：

- 自然观察笔记
- 轻量手帐
- 文字冒险

要求：

- 页面宽度适合手机
- 按钮足够大
- 文本易读
- 日志不要过长，最多显示最近若干条
- 状态信息固定在明显位置

## 12. 不要过早优化

第一版优先级：

```text
完整可玩流程 > 代码结构 > 简单样式 > 动画表现
```

不要为了美观牺牲结构清晰。

## 13. 每次修改要求

Codex 每次修改前必须先说明：

- 本次会修改哪些文件
- 每个文件的修改目的
- 是否会影响现有数据结构

除非用户明确要求，否则不要进行大规模无关重构。

## 14. 初学者友好要求

代码需要适合 HTML/JavaScript 初学者理解。

要求：

- 命名清晰
- 函数不要过长
- 复杂逻辑加注释
- 不使用晦涩语法
- 不使用过度抽象
- 不使用不必要的设计模式

## 15. 第一阶段完成定义

当满足以下条件时，第一阶段完成：

- Live Server 打开 index.html 后可运行
- 可以开始一局
- 可以完成 30 回合
- 可以观察、转向、静听、等待
- 可以发现鸟
- 可以进入拍照模式
- 可以拍照获得卡牌
- 可以等待更好时机
- 鸟会飞走
- 可以进入结算
- 可以查看本局照片
- 可以保存并查看图鉴
- 刷新后图鉴不会丢失
