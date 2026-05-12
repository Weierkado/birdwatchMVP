# docs/UI_STYLE_GUIDE.md

# 观鸟模拟器 · UI Style Guide

## 1. 风格定位

本项目的 UI 风格参考方向为：

**明亮、圆润、友好、轻量游戏化的移动端学习/收集类应用风格。**

视觉关键词：

- 明亮
- 可爱但不过度幼稚
- 圆润
- 高可读性
- 强反馈
- 低压力
- 移动端友好
- 像一个轻量的自然观察练习 App
- 像一本被游戏化的观鸟手帐

不要做成：

- 写实野外摄影风
- 暗黑硬核生存风
- 复杂 RPG 面板风
- 传统网页表单风
- 过度拟物的纸张纹理
- 复杂插画堆叠
- 高饱和霓虹风

## 2. 设计目标

UI 应该帮助玩家快速理解当前状态：

1. 我在哪里？
2. 我现在面对哪里？
3. 附近有没有鸟？
4. 我现在应该观察、静听、转向，还是换鸟点？
5. 当前拍照时机好不好？
6. 我还剩多少回合？
7. SD 卡还剩多少？
8. 本局有什么收获？
9. 图鉴有什么新增？

视觉设计优先级：

    清晰 > 反馈 > 可爱 > 装饰

## 3. 整体视觉方向

整体界面应接近移动端 App，而不是传统网页。

推荐感觉：

    一款轻量、友好、明亮的观鸟练习小游戏。

页面应该有明显的卡片层级：

    主容器
    状态卡片
    地图卡片
    事件描述卡片
    行动按钮区
    日志卡片
    图鉴 / 结算卡片

所有元素尽量圆润、清晰、间距充足。

## 4. 色彩系统

### 4.1 主色

使用自然、明亮的绿色作为主色。

    --color-primary: #58CC02;
    --color-primary-dark: #46A302;
    --color-primary-light: #D7FFB8;

用途：

- 主要按钮
- 当前高亮
- 成功反馈
- 发现鸟类
- 图鉴新增

### 4.2 辅助色

使用天空蓝作为辅助色。

    --color-secondary: #1CB0F6;
    --color-secondary-dark: #1487C9;
    --color-secondary-light: #DDF4FF;

用途：

- 静听
- 方向提示
- 地图辅助信息
- 鸟点声景

### 4.3 警示色

使用橙色表达精彩、机会、稀有。

    --color-warning: #FF9600;
    --color-warning-dark: #D97706;
    --color-warning-light: #FFF0D6;

用途：

- 精彩时机
- 稀有卡牌
- 高价值行为
- 即将飞离提醒

### 4.4 危险 / 飞离色

使用柔和红色表达飞离、错过、失败。

    --color-danger: #FF4B4B;
    --color-danger-dark: #D93636;
    --color-danger-light: #FFE0E0;

用途：

- 鸟飞走
- SD 卡已满
- 错过机会
- 失败反馈

### 4.5 背景色

使用非常浅的暖色背景，避免纯白刺眼。

    --color-bg: #FFFDF7;
    --color-surface: #FFFFFF;
    --color-surface-soft: #F7F7F2;

### 4.6 文本色

    --color-text: #2B2B2B;
    --color-text-muted: #777777;
    --color-border: #E5E5DD;

## 5. 字体与排版

### 5.1 字体

优先使用系统字体。

    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      "PingFang SC",
      "Microsoft YaHei",
      sans-serif;

不要引入外部字体。

### 5.2 字号建议

    页面标题：24px / 28px
    区域标题：18px / 22px
    正文：15px / 18px
    辅助说明：13px / 14px
    按钮文字：16px / 18px
    状态数字：18px / 20px

移动端需要保证可读性，不要用太小的字。

### 5.3 文本风格

文案应该短、明确、有反馈。

推荐：

    你听到灌木里传来短促的鸣声。
    红耳鹎开始梳理羽毛。
    它振翅飞离了视野。

不推荐：

    系统检测到事件触发，状态已更新。

## 6. 布局规则

### 6.1 页面宽度

主内容区域适合移动端竖屏。

    .app {
      max-width: 480px;
      margin: 0 auto;
      padding: 16px;
    }

桌面端也保持手机宽度居中，不要横向铺满。

### 6.2 卡片样式

所有主要区域使用圆角卡片。

    .card {
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      border-radius: 20px;
      padding: 16px;
      box-shadow: 0 4px 0 rgba(0, 0, 0, 0.08);
    }

特点：

- 圆角明显
- 边框清晰
- 阴影不要模糊复杂
- 可以使用轻微的“下压式”阴影

### 6.3 间距

元素之间要留足呼吸空间。

    section {
      margin-bottom: 16px;
    }

按钮之间：

    gap: 10px;

不要让界面拥挤。

## 7. 按钮风格

按钮是整个 UI 的重点。

### 7.1 主按钮

用于：

- 开始游戏
- 按下快门
- 前往鸟点
- 继续

    .button-primary {
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 16px;
      padding: 14px 18px;
      font-size: 16px;
      font-weight: 700;
      box-shadow: 0 4px 0 var(--color-primary-dark);
    }

按下状态：

    .button-primary:active {
      transform: translateY(3px);
      box-shadow: 0 1px 0 var(--color-primary-dark);
    }

### 7.2 次按钮

用于：

- 静听
- 等待
- 查看图鉴
- 返回

    .button-secondary {
      background: var(--color-secondary-light);
      color: var(--color-secondary-dark);
      border: 2px solid var(--color-secondary);
      border-radius: 16px;
      padding: 12px 16px;
      font-weight: 700;
    }

### 7.3 危险 / 放弃按钮

用于：

- 放弃拍摄
- 清除图鉴
- 退出

    .button-danger {
      background: var(--color-danger-light);
      color: var(--color-danger-dark);
      border: 2px solid var(--color-danger);
      border-radius: 16px;
    }

### 7.4 按钮布局

移动端按钮推荐纵向排列：

    .action-buttons {
      display: grid;
      gap: 10px;
    }

同一层级的按钮可以使用双列，但不要超过两列。

## 8. 顶部状态栏

顶部状态栏需要清楚显示：

- 剩余回合
- SD 卡容量
- 当前鸟点
- 当前面向

推荐样式：

    剩余 18 / 30
    SD 7 / 15
    池塘岸边 · 面向北侧芦苇

可以做成小胶囊标签：

    .status-pill {
      background: var(--color-surface-soft);
      border: 2px solid var(--color-border);
      border-radius: 999px;
      padding: 6px 10px;
      font-weight: 700;
    }

## 9. 行为时机标签

内部状态仍然可以使用英文枚举，但 UI 必须显示中文。

### 9.1 状态映射

    const BEHAVIOR_STATE_DISPLAY = {
      NORMAL: {
        label: "寻常",
        className: "state-normal",
        description: "它保持着普通姿态，适合安全记录。",
        hint: "稳定但价值较低"
      },
      INTERESTING: {
        label: "有趣",
        className: "state-interesting",
        description: "它出现了更有记录价值的行为。",
        hint: "可以考虑拍摄"
      },
      REMARKABLE: {
        label: "精彩",
        className: "state-remarkable",
        description: "这是难得的精彩瞬间！",
        hint: "高价值窗口，可能转瞬即逝"
      },
      FLY_AWAY: {
        label: "飞离",
        className: "state-fly-away",
        description: "它察觉到动静，飞离了视野。",
        hint: "本次观察结束"
      }
    };

### 9.2 标签样式

    .behavior-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 14px;
      font-weight: 800;
    }

    .state-normal {
      background: #EEF2F3;
      color: #52616B;
    }

    .state-interesting {
      background: var(--color-secondary-light);
      color: var(--color-secondary-dark);
    }

    .state-remarkable {
      background: var(--color-warning-light);
      color: var(--color-warning-dark);
    }

    .state-fly-away {
      background: var(--color-danger-light);
      color: var(--color-danger-dark);
    }

## 10. 拍照界面

拍照界面是核心体验，需要比探索界面更有舞台感。

应该显示：

    你正在观察：红耳鹎

    当前时机：精彩
    它突然展开羽冠，转头鸣叫！
    这是难得的精彩瞬间，但可能转瞬即逝。

    本次观察已拍摄：2 张
    剩余判断机会：3
    SD 卡：8 / 15

    [按下快门]
    [再等一等]
    [放弃拍摄]

### 10.1 拍照卡片样式

    .photo-panel {
      border: 3px solid var(--color-primary);
      border-radius: 24px;
      background: white;
      padding: 18px;
    }

精彩状态时可以加醒目边框：

    .photo-panel.is-remarkable {
      border-color: var(--color-warning);
      background: linear-gradient(180deg, #FFFFFF 0%, #FFF8EA 100%);
    }

不要做复杂动画，第一版只做颜色变化即可。

## 11. 地图显示

地图不需要复杂图形，也不需要跟随玩家旋转。

推荐使用“卡片 + 文本地图”。

    周边地图

                [北侧芦苇]
                    ↑
                    │
    [水面开阔处] ← [池塘岸边] → [花园边缘方向]
                    │
                    ↓
                [石阶小路]

    当前位置：池塘岸边
    当前面向：北侧芦苇

    前方：北侧芦苇
    右侧：花园边缘方向
    后方：石阶小路
    左侧：水面开阔处

### 11.1 地图样式

    .map-card {
      background: #FFF9E8;
      border: 2px solid #E8DDBF;
      border-radius: 20px;
      padding: 14px;
    }

    .map-ascii {
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre;
      text-align: center;
    }

地图要清楚，不要装饰太多。

## 12. 鸟点选择界面

鸟点选择应该像选择课程关卡一样明确。

每个鸟点用一个大卡片按钮。

    溪流边
    水声较近，间或有尖细短促的叫声。

    特征：水边 / 鸟声较少 / 可能有惊喜
    移动消耗：2 回合

    [前往]

### 12.1 鸟点卡片

    .spot-option {
      background: white;
      border: 2px solid var(--color-border);
      border-radius: 20px;
      padding: 14px;
      box-shadow: 0 4px 0 rgba(0, 0, 0, 0.06);
    }

当前鸟点可以标注：

    当前所在

    .spot-current {
      border-color: var(--color-primary);
      background: var(--color-primary-light);
    }

## 13. 观察日志

日志应该像自然观察记录。

推荐显示最近 5–8 条，不要无限增长。

样式：

    .log-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .log-item {
      background: var(--color-surface-soft);
      border-radius: 12px;
      padding: 8px 10px;
      margin-bottom: 6px;
      font-size: 14px;
    }

重要日志可以加颜色：

    发现鸟类：绿色
    飞离 / 错过：红色
    听到鸟叫：蓝色
    拍到精彩：橙色

## 14. 图鉴界面

图鉴应该像收集册。

每个鸟种是一个卡片：

    红耳鹎
    状态：已发现
    已收集卡牌：2 / 3
    最高星级：★★★

状态颜色：

    未知：灰色
    听到：蓝色
    已发现：绿色

    .guide-entry {
      border: 2px solid var(--color-border);
      border-radius: 18px;
      background: white;
      padding: 14px;
    }

新增内容可以显示：

    NEW

    .badge-new {
      background: var(--color-warning);
      color: white;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 800;
    }

## 15. 结算界面

结算界面需要有成就感。

显示顺序：

1. 本局标题
2. 拍摄数量
3. 新发现鸟种
4. 新增卡牌
5. 总星级
6. 照片列表
7. 再来一局按钮
8. 查看图鉴按钮

样式应该轻松、奖励感强。

    .settlement-summary {
      background: var(--color-primary-light);
      border: 2px solid var(--color-primary);
      border-radius: 24px;
      padding: 18px;
    }

照片列表可以使用小卡片：

    .photo-result-card {
      border: 2px solid var(--color-border);
      border-radius: 16px;
      background: white;
      padding: 12px;
    }

## 16. 反馈规则

每次玩家行动后，界面应该有明确反馈。

### 16.1 观察成功

    你发现了红耳鹎！

使用绿色。

### 16.2 观察失败

    你仔细看了一会儿，但没有发现鸟影。

使用灰色。

### 16.3 听到鸟叫

    你听到右侧灌木里传来短促鸣声。

使用蓝色。

### 16.4 拍到照片

    咔嚓！你拍下了「梳理羽毛」★★。

使用绿色或橙色。

### 16.5 鸟飞走

    它察觉到动静，振翅飞离了视野。

使用红色。

## 17. 动画约束

当前阶段不做复杂动画。

允许：

- 按钮按下时轻微下压
- 卡片 hover / active 状态
- 状态颜色变化
- 简单淡入

不做：

- Canvas 动画
- 粒子效果
- 复杂翻牌动画
- 音频可视化
- 大量 JS 动画

## 18. 移动端适配

必须保证手机竖屏体验。

要求：

    body {
      margin: 0;
      min-height: 100vh;
    }

    button {
      min-height: 44px;
    }

避免：

- 很小的点击区域
- 横向滚动
- 太密集的文本
- 太多并排按钮

## 19. Codex 修改约束

当 Codex 执行 UI 美化时，必须遵守：

1. 不要修改核心游戏规则。
2. 不要修改 LocalStorage 数据结构。
3. 不要引入第三方库。
4. 不要使用 npm。
5. 不要使用框架。
6. 优先修改 `styles/style.css`。
7. 如需修改 JS，只允许增加 className 或改善渲染结构。
8. 不要删除已有功能。
9. 不要重构游戏状态流。
10. 保持代码适合初学者阅读。

## 20. 推荐执行顺序

UI 美化建议分阶段进行。

### Phase 1：基础视觉统一

- 背景色
- 字体
- 主容器宽度
- 卡片样式
- 按钮样式

### Phase 2：核心玩法界面

- 探索界面
- 拍照界面
- 行为状态标签
- SD 卡显示
- 地图卡片

### Phase 3：收集反馈

- 日志样式
- 图鉴样式
- 结算样式
- NEW 标签
- 稀有度星级样式

### Phase 4：轻量动效

- 按钮按下
- 卡片状态变化
- 拍照反馈
- 发现新鸟提示

当前优先做到 Phase 1 和 Phase 2。