# 认鸟手信 · 回归测试清单

## 0. 使用说明

- 小改动不一定跑全量，但必须跑相关模块。
- 结构拆分后至少跑核心 P0。
- 涉及 PHOTO / FOCUS / RESULT 必须全量跑拍照链路。
- 涉及消息必须跑 Liya 多句回复和滚动。
- 涉及存档必须跑刷新和重置。
- 涉及 analytics / survey 必须跑开关组合。

## 1. P0 最小冒烟回归

- [ ] 页面能加载，无白屏
- [ ] Console 无红色报错
- [ ] 默认 main 不显示【填写反馈】
- [ ] 默认 main 不发送 analytics 请求
- [ ] 点击开始游戏正常
- [ ] 能进入第 1 天
- [ ] 顶部标题显示“裸辞之后，观鸟的第 x 天”
- [ ] 事件文本正常显示
- [ ] 行动按钮正常出现
- [ ] 【查看消息】可打开/收起
- [ ] 【打开笔记】可打开/收起
- [ ] 【休息到明天清晨】结算时可点击

## 2. 开局与测试功能开关

### 默认关闭

配置：

- `analyticsEnabled=false`
- `surveyEnabled=false`
- `settlementSurveyEnabled=false`

检查：

- [ ] 无问卷入口
- [ ] 无 analytics 网络请求
- [ ] 不写 survey done
- [ ] 结算不被问卷阻塞

### 只开 analytics

配置：

- `analyticsEnabled=true`
- `surveyEnabled=false`

检查：

- [ ] `session_start` 上报
- [ ] `photo_taken` 上报
- [ ] `session_end` 上报
- [ ] `payload.survey` 为空或 null
- [ ] 不显示问卷

### analytics + survey 全开

配置：

- `analyticsEnabled=true`
- `surveyEnabled=true`
- `settlementSurveyEnabled=true`

检查：

- [ ] 显示【填写反馈】
- [ ] 二级确认面板正常
- [ ] 【再玩一会】不写 done
- [ ] 提交问卷写 survey payload
- [ ] 提交后写 done
- [ ] 后续不重复显示问卷

## 3. 观察与鸟点流程

- [ ] 初始地点正常
- [ ] 倾听远处声音正常
- [ ] 可前往远处鸟点
- [ ] 可观察当前方向
- [ ] 再听一会正常
- [ ] 鸟点名称和方向文案正常
- [ ] 行动后回合/电量变化正常

## 4. PHOTO_DECISION

- [ ] 发现鸟后进入拍摄决策
- [ ] 显示当前拍摄时机
- [ ] 【举起相机】可用
- [ ] 【再等一等】可用
- [ ] 【放弃拍摄】是弱化按钮
- [ ] 【提前撤离并结算】是弱化按钮
- [ ] 匿名阶段不泄露正式鸟名

## 5. PHOTO_FOCUS

- [ ] 举起相机后进入对焦
- [ ] 徽章延迟出现
- [ ] 徽章入场动画正常
- [ ] 对焦框显示正常
- [ ] 未合焦状态半透明
- [ ] 合焦状态为绿色
- [ ] 对焦框层级高于徽章
- [ ] 徽章未出现时快门无效
- [ ] 徽章出现后快门有效
- [ ] 4 秒超时正常
- [ ] 超时后进入飞离/寻找位置/放下相机分支
- [ ] rAF 不报错
- [ ] 连续进入 FOCUS 不残留上一只鸟的动画

## 6. RESULT / 拍立得

- [ ] 快门后白闪只覆盖取景器
- [ ] 徽章离场动画正常
- [ ] RESULT 阶段不显示移动徽章
- [ ] 拍立得出现正常
- [ ] 拍立得日期/地点/对焦框显示正常
- [ ] 拍立得时间色调正常
- [ ] 继续跟焦正常
- [ ] 再等一等正常
- [ ] 放弃拍摄正常

## 7. 自动加新 / 图鉴

- [ ] 首次拍到鸟后可加新
- [ ] 未命名前不泄露正式鸟名
- [ ] 加新 reveal 文案正常
- [ ] 图鉴 SEEN / CATALOGUED 状态正常
- [ ] 笔记 new badge 出现
- [ ] 打开笔记时 new badge 行为正常
- [ ] 收起笔记状态下 new badge 仍按状态显示
- [ ] new 被清除后不再显示
- [ ] 卡牌详情可打开
- [ ] snapshot 翻页正常
- [ ] 可发送照片给妹妹

## 8. 消息系统

- [ ] 查看消息按钮可打开/收起
- [ ] 未读数量显示正常
- [ ] 消息列表正常
- [ ] thread 可打开
- [ ] 初始消息已读正常
- [ ] Liya 回复延迟出现
- [ ] 多句 Liya 回复串行播放
- [ ] 不并行动画
- [ ] 最后一行不导致滚动跳到顶部
- [ ] 滚动恢复正常
- [ ] 未读分隔线正常
- [ ] 消息时间不显示现实时间
- [ ] 同时存在消息未读和笔记 new 时 UI 正常

## 9. 结算页

- [ ] 进入结算正常
- [ ] 今天的收获只保留单层外壳
- [ ] 今天的收获 hover 是浅杏色
- [ ] 今天的收获展开正文是深杏/棕色
- [ ] 今天的收获可展开/收起
- [ ] 【休息到明天清晨】可点击
- [ ] 【填写反馈】默认关闭时不显示
- [ ] 观察日志正常
- [ ] 重置游戏存档入口位置正常
- [ ] 休息到下一天后 dayIndex +1

## 10. 存档与刷新

- [ ] 刷新页面后图鉴存档保留
- [ ] 刷新页面后 dayIndex 保留
- [ ] 重置游戏存档正常
- [ ] 重置后 fieldGuide 清空
- [ ] 重置后不会破坏 tester uuid / analytics infrastructure，除非设计如此
- [ ] 旧 v2 存档迁移不报错

## 11. 移动端布局

检查宽度：

- 360px
- 375px
- 390px

项目：

- [ ] 无横向滚动
- [ ] 工具按钮不换行异常
- [ ] 消息面板可读
- [ ] 笔记面板可读
- [ ] PHOTO / FOCUS 可操作
- [ ] 结算页按钮可点击
- [ ] 问卷开启时布局正常

## 12. 修改类型对应回归建议

| 修改类型 | 必跑回归 |
| --- | --- |
| CSS 小改 | P0 + 相关页面 + 移动端 |
| 文案 JSON | 消息触发 + JSON parse |
| utils 拆分 | P0 + 完整一局 |
| saveManager | 存档与刷新 + 重置 |
| analytics | 三种开关组合 |
| survey | 三种开关组合 + 结算 |
| PHOTO / FOCUS | 全量拍照链路 |
| 消息系统 | 消息系统全量 |
| 图鉴 / 笔记 | 自动加新 + 图鉴全量 |
| 结算 | 结算页全量 |

## 13. 发布前检查

- [ ] config 默认关闭测试功能
- [ ] 不上传 docs 到静态测试站，除非需要
- [ ] 不上传 message-editor.html 给普通测试者，除非需要
- [ ] Network 无异常请求
- [ ] Console 无报错
- [ ] 完整跑一局
- [ ] 移动端打开正常
## 14. 工程拆分后专项回归

### 修改 `src/utils/dom.js` 后必须检查

- [ ] 页面无白屏
- [ ] 所有 HTML 文案正常显示
- [ ] 特殊字符不会破坏 HTML
- [ ] 消息 / 笔记 / 结算不出现转义异常

### 修改 `src/utils/format.js` 后必须检查

- [ ] 时间段文案正常
- [ ] 卡牌标题 / 描述正常
- [ ] 拍立得日期正常
- [ ] 加新日期正常
- [ ] 消息时间不会回归为显示现实时间

### 修改 `src/utils/config.js` 后必须检查

- [ ] 默认 main 不显示问卷
- [ ] 默认 main 不发送 analytics
- [ ] 只开 analytics 正常
- [ ] analytics + survey 全开正常
- [ ] survey 开启但 analytics 关闭时游戏不崩

### 修改 `src/core/saveManager.js` 后必须检查

- [ ] dayIndex 第 1 天 / 第 2 天 / 刷新后保持正常
- [ ] 重置存档后 dayIndex 行为正常
- [ ] 加新日期不会被当前天覆盖
- [ ] survey done 一次性逻辑正常
- [ ] 不影响 fieldGuide 主存档

### 修改 `src/core/telemetryAdapter.js` 后必须检查

- [ ] `analyticsEnabled=false` 时无请求
- [ ] `analyticsEnabled=true` 时 `session_start` / `photo_taken` / `session_end` 正常
- [ ] `chat_opened` / `chat_closed` 正常
- [ ] `sister_message_received` / `sister_message_viewed` 正常
- [ ] survey payload 正常
- [ ] flush 时机不变
