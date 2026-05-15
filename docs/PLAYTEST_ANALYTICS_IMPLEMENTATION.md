# 测试版本埋点与服务器数据落地文档

## 1. 文档目的

本文档用于记录当前测试版本中，玩家测试流程、埋点系统、CloudBase 数据接收、数据库记录结构以及后续看板开发需要注意的字段与分析方向。

当前版本已经完成：

```text
测试入口
tester_id 输入
Q0 玩家身份分层
局内行为埋点
结算时批量上报
游后问卷 Q1–Q12
问卷提交上报
腾讯云 CloudBase 国内数据接收
```

本文档用于后续继续开发数据看板、导出数据、做统计分析时参考。

---

## 2. 当前测试版本整体流程

当前测试分支为：

```text
playtest-1
```

测试版入口流程为：

```text
打开游戏页面
↓
点击「参与测试 · 留下反馈」
↓
填写测试者 ID
↓
选择 Q0 玩家身份
↓
选择初始鸟点
↓
开始游戏
↓
正常游玩并产生局内行为数据
↓
进入本局结算
↓
结算时自动上报 session_events
↓
点击「填写测试反馈」
↓
提示玩家可以多玩几局，准备停下来时再填写
↓
点击「现在填写反馈」
↓
填写 Q1–Q12 游后问卷
↓
提交问卷
↓
上报 survey_answer
```

测试版中普通“开始游戏”入口已隐藏。测试目标是尽量保证每条测试数据都带有测试者身份信息，避免出现大量 `tester_id` 为空的记录。

---

## 3. 测试者身份逻辑

### 3.1 tester_id

玩家进入测试流程时需要填写一个测试者 ID。

当前文案含义：

```text
昵称 / 微信名 / 英文名都可以
```

用途：

```text
将同一玩家的多局行为数据和问卷反馈对应起来。
后续如果有高价值反馈，可以根据 ID 进行追访。
```

注意：

```text
tester_id 不公开展示
tester_id 不写入 LocalStorage
tester_id 只在当前页面生命周期内保留
刷新页面后需要重新输入
```

### 3.2 Q0 玩家身份分层

Q0 题目：

```text
你和观鸟的距离有多远？
```

选项与数值映射：

| tester_level | tester_level_text |
|---:|---|
| 1 | 不太了解观鸟这件事 |
| 2 | 了解观鸟，但还没开始实践 |
| 3 | 已经开始观鸟，还没有专业设备 |
| 4 | 已经投入专业设备，是认真的观鸟者 |

用途：

```text
后续所有问卷结果和行为数据都需要按 tester_level 分层分析。
尤其是画面感、找鸟难度、栖息地感知、规则理解等问题。
```

### 3.3 单次打开页面内的身份保留

当前实现规则：

```text
同一次打开页面期间，玩家只需要输入一次 tester_id 和 Q0。
如果回到开始界面后再次点击「参与测试 · 留下反馈」，会直接进入初始鸟点选择。
```

边界：

```text
刷新页面后 tester profile 清空，需要重新输入。
不使用 LocalStorage / sessionStorage / cookie。
```

这样可以避免测试者一局后回到首页还要重复输入，同时避免长期存储导致共用设备串号。

---

## 4. Analytics 前端模块概况

当前前端埋点模块位于：

```text
src/analytics.js
```

主要职责：

```text
维护当前页面生命周期内的 tester profile
维护当前局 session_id
记录本局 events
记录当前访问过的鸟点
在结算时上报 session_events
在问卷提交时上报 survey_answer
```

### 4.1 关键公共字段

每条事件都会尽量携带：

```text
event_type
timestamp
session_id
tester_id
tester_level
tester_level_text
build_version
```

当前版本号：

```text
build_version = playtest-1
```

### 4.2 session_id

每局游戏开始时生成新的 `session_id`。

规则：

```text
同一个玩家多局游戏会有多个 session_id
这些 session_id 通过同一个 tester_id 串联
```

### 4.3 resetAnalyticsSession

每次新局开始时重置本局 analytics 数据：

```text
清空 events
生成新 session_id
记录 sessionStartTime
清空 visitedSpotIds
```

但不会清空：

```text
tester_id
tester_level
tester_level_text
```

这是为了保证同一次页面生命周期内，玩家多局测试数据可以持续带同一个身份信息。

---

## 5. 数据上报端点

当前正式测试数据接收端已从 Google Apps Script 切换为腾讯云 CloudBase。

### 5.1 前端配置位置

```text
data/config.js
```

当前应配置为 CloudBase HTTP 路由地址：

```js
export const ANALYTICS_ENDPOINT = "https://birdwatch-playtest-d5c7a62967841-1433627820.ap-shanghai.app.tcloudbase.com/submitAnalytics";
```

旧的 Google Apps Script endpoint 不再作为国内测试主方案。

### 5.2 为什么弃用 Google Apps Script

原因：

```text
国内测试玩家大概率无法稳定访问 Google Apps Script / Google Sheets。
要求玩家使用 VPN 或手动导出文件会增加测试门槛。
目标玩家群体对技术操作不熟悉，不应增加额外步骤。
```

因此当前改为：

```text
GitHub Pages 静态网页
→ 腾讯云 CloudBase HTTP 路由
→ CloudBase 云函数
→ CloudBase 文档型数据库
```

实际测试已确认：

```text
不开 VPN 可以打开 GitHub Pages
不开 VPN 可以向 CloudBase 成功提交数据
CloudBase 数据库能看到新增记录
```

---

## 6. CloudBase 服务器落地结构

### 6.1 CloudBase 环境

环境名称：

```text
birdwatch-playtest
```

地域：

```text
上海
```

用途：

```text
接收测试版行为数据和问卷数据
```

### 6.2 云函数

云函数名称：

```text
submitAnalytics
```

运行环境：

```text
Nodejs 18.15
```

函数类型：

```text
普通函数
```

执行入口：

```text
index.main
```

职责：

```text
接收前端 POST 的 payload
解析 JSON
写入文档型数据库集合 analytics_payloads
```

### 6.3 HTTP 路由

默认域名：

```text
birdwatch-playtest-d5c7a62967841-1433627820.ap-shanghai.app.tcloudbase.com
```

路由路径：

```text
/submitAnalytics
```

完整接口地址：

```text
https://birdwatch-playtest-d5c7a62967841-1433627820.ap-shanghai.app.tcloudbase.com/submitAnalytics
```

路由配置：

```text
路由启用：开启
关联资源：云函数 submitAnalytics
路径透传：关闭
身份认证：关闭
```

说明：

```text
目前首测阶段为了让网页能直接提交数据，HTTP 路由未开启鉴权。
后续如果公开范围扩大，需要考虑添加简单 token 或其他防刷机制。
```

### 6.4 文档型数据库集合

集合名称：

```text
analytics_payloads
```

权限：

```text
当前为测试阶段配置。
前端不直接访问数据库，数据库写入由云函数完成。
```

数据结构：

```text
不是表格列结构。
每次上报保存为一条文档。
文档中包含完整 payload。
```

---

## 7. CloudBase 数据记录结构

每次上报会在 `analytics_payloads` 中新增一条文档。

文档外层字段大致如下：

```json
{
  "_id": "...",
  "received_at": "2026-05-15T15:37:45.919Z",
  "session_id": "...",
  "tester_id": "...",
  "tester_level": 2,
  "tester_level_text": "了解观鸟，但还没开始实践",
  "build_version": "playtest-1",
  "events_count": 28,
  "payload": {
    "...": "完整 payload"
  }
}
```

其中最重要的是：

```text
payload
```

当前采用“保存完整 payload”的策略，而不是在服务端拆成事件表。

原因：

```text
首测样本量小
实现简单
不容易丢字段
后续看板或导出时可以再展开
```

---

## 8. payload 类型

当前有两类核心 payload：

```text
session_events
survey_answer
```

建议后续看板开发时先按 `payload_type` 区分。

### 8.1 session_events

触发时机：

```text
玩家进入 SETTLEMENT 本局结算时
```

用途：

```text
记录一局游戏中的全部行为事件
```

结构示意：

```json
{
  "payload_type": "session_events",
  "session_id": "...",
  "tester_id": "DEV_YX",
  "tester_level": 2,
  "tester_level_text": "了解观鸟，但还没开始实践",
  "build_version": "playtest-1",
  "events": [
    {
      "event_type": "session_start",
      "timestamp": "...",
      "session_id": "...",
      "tester_id": "DEV_YX"
    }
  ],
  "survey": {},
  "survey_skipped": true
}
```

### 8.2 survey_answer

触发时机：

```text
玩家填写并提交 Q1–Q12 游后问卷时
```

用途：

```text
记录玩家的主观反馈
```

结构示意：

```json
{
  "payload_type": "survey_answer",
  "session_id": "...",
  "tester_id": "DEV_YX",
  "tester_level": 2,
  "tester_level_text": "了解观鸟，但还没开始实践",
  "build_version": "playtest-1",
  "events": [],
  "survey": {
    "q0": 2,
    "q0_text": "了解观鸟，但还没开始实践",
    "q1": 1,
    "q1_text": "有，很有画面感，感觉像真的在观鸟",
    "q2": 2,
    "q2_text": "有一点，还不错的感觉",
    "q9": 8,
    "q10": "...",
    "q11": "...",
    "q12": "...",
    "survey_completed": true,
    "survey_skipped": false,
    "submitted_at": "..."
  }
}
```

---

## 9. 当前已记录的行为事件

### 9.1 session_start

触发时机：

```text
玩家选择初始鸟点并正式进入 EXPLORE 时
```

字段：

```text
event_type = session_start
start_spot_id
max_turns
max_photos
timestamp
session_id
tester_id
tester_level
tester_level_text
build_version
```

用途：

```text
统计开局次数
记录初始鸟点选择
计算每局 session
```

---

### 9.2 observe_attempt

触发时机：

```text
玩家点击「观察当前方向」并完成观察判定后
```

字段：

```text
event_type = observe_attempt
found
species_id
spot_id
facing_direction
current_turn
timestamp
```

用途：

```text
计算找鸟命中率
分析玩家是否经常观察空方向
与 Q5 找鸟难易感受交叉
```

---

### 9.3 photo_enter

触发时机：

```text
玩家发现鸟并进入拍照阶段时
```

字段：

```text
event_type = photo_enter
species_id
spot_id
current_turn
sd_remain
timestamp
```

用途：

```text
统计实际进入拍照邂逅的次数
分析不同鸟种被发现和进入拍照的频率
```

---

### 9.4 photo_wait

触发时机：

```text
PHOTO 阶段玩家点击「再等一等」
```

字段：

```text
event_type = photo_wait
species_id
from_state
to_state
current_turn
timestamp
```

用途：

```text
分析玩家是否使用等待机制
分析行为状态变化路径
分析玩家是否在追求更好拍摄时机
```

---

### 9.5 photo_shoot

触发时机：

```text
玩家按下快门并获得照片时
```

字段：

```text
event_type = photo_shoot
species_id
behavior_state
card_id
card_rarity
is_new_card
spot_id
current_turn
sd_remain
shoot_index
timestamp
```

说明：

```text
behavior_state = 拍摄时机状态
card_rarity = 实际获得照片品质
二者不一定相同
```

用途：

```text
分析不同拍摄时机下玩家拍照行为
分析照片品质分布
分析各鸟种实际拍照次数
分析 NEW 卡牌获得情况
与 Q2 出红兴奋感交叉
```

---

### 9.6 photo_end

触发时机：

```text
离开 PHOTO 模式时
```

可能原因：

```text
fly_away
give_up
sd_full
```

字段：

```text
event_type = photo_end
species_id
exit_reason
photos_in_encounter
sd_remain
current_turn
timestamp
```

用途：

```text
分析玩家是否经常放弃拍摄
分析飞走导致的中断
分析 SD 卡满是否影响拍照选择
```

---

### 9.7 session_end

触发时机：

```text
游戏进入 SETTLEMENT 本局结算时
```

字段：

```text
event_type = session_end
reason
final_turn
total_photos
unique_species
spots_visited
duration_ms
timestamp
```

可能 reason：

```text
turns_exhausted
sd_full
retreat
unknown
```

用途：

```text
统计单局结束原因
分析回合与 SD 卡资源压力
计算平均单局时长
统计平均照片数、记录鸟种数、访问鸟点数
```

---

## 10. 游后问卷 Q1–Q12

问卷文本已与测试方案文档对齐。

### Q1 游戏画面感

题目：

```text
游戏的文字描述，有没有让你脑子里浮现出画面？
```

选项：

```text
1. 有，很有画面感，感觉像真的在观鸟
2. 有一点，偶尔会有画面感
3. 不太有，文字感比较强
4. 没有，感觉就是在读文字
```

---

### Q2 出红兴奋感

题目：

```text
当你拍到"精彩"照片的时候，有没有感到兴奋？
```

选项：

```text
1. 有！会有明显的惊喜感
2. 有一点，还不错的感觉
3. 没什么特别的感觉
4. 我这局没拍到精彩照片
```

---

### Q3 文字卡牌收集感

题目：

```text
你觉得收集这些文字卡牌有意思吗？
```

选项：

```text
1. 很有意思，看到新卡牌会有满足感
2. 还好，可以接受
3. 一般，没有特别的感觉
4. 没什么意思，不太吸引我
```

---

### Q4 全收集意愿

题目：

```text
游戏结束后，你有想继续拍齐所有卡牌的冲动吗？
```

选项：

```text
1. 很想，这是我继续玩的主要动力
2. 有一点想，可以再玩几局
3. 不太在意收集完整
4. 完全没有这个冲动
```

---

### Q5 找鸟难易感受

题目：

```text
找鸟的过程感觉怎么样？
```

选项：

```text
1. 太容易了，几乎每次都能找到
2. 刚刚好，有挑战感但不挫败
3. 有点难，经常找不到，有些挫败
4. 太难了，大部分时间都没找到鸟
```

---

### Q6 鸟种与栖息地关系感知

题目：

```text
你有没有感觉到不同的鸟偏好出现在不同的地方？
```

选项：

```text
1. 有，很明显，我会根据想找的鸟选择去哪里
2. 有一点感觉，但不是很清晰
3. 没有特别注意到
4. 没有，感觉鸟出现得很随机
```

---

### Q7 游玩深度意愿

题目：

```text
如果可以随时停下来，你大概会玩到哪个阶段觉得"差不多了"？
```

选项：

```text
1. 打完一局就不太想继续了
2. 打完几局之后就不想继续了
3. 图鉴收集到一半左右，感觉差不多了
4. 想把图鉴全部集齐再停
5. 没有想停的感觉，还想一直玩
```

---

### Q8 体力 / SD 卡数值感受

题目：

```text
在游戏中，哪个资源先让你感到紧张？
```

选项：

```text
1. SD 卡快满了，开始不敢随便拍
2. 回合数快用完了，开始着急
3. 两个都让我紧张过
4. 两个都没感到太大压力
5. 我不太确定这两个数值的意思
```

---

### Q9 推荐意愿（NPS）

题目：

```text
你有多大可能把这个游戏推荐给朋友？
```

评分：

```text
0–10
0 = 不可能
10 = 非常可能
```

---

### Q10 稀有度规则理解

题目：

```text
用你自己的话说：什么情况下会拍到"精彩"照片？（不需要完全准确，写你的理解就好）
```

placeholder：

```text
请在这里输入你的理解……
```

---

### Q11 希望增加的鸟种

题目：

```text
你最希望在游戏里看到哪种鸟？（可以说中文名、英文名或描述）
```

placeholder：

```text
请在这里输入……
```

---

### Q12 希望增加的内容

题目：

```text
你最希望游戏增加什么？
```

placeholder：

```text
请在这里输入……
```

---

## 11. 问卷必填规则

当前规则：

```text
Q1–Q9 必填
Q10–Q12 可选填
```

提交校验：

```text
如果 Q1–Q9 未完成，则显示温和提示：
还有几道选择题没有完成。
```

不使用浏览器 `alert`。

---

## 12. 看板开发建议

后续看板开发建议先从 CloudBase 导出 `analytics_payloads`，再在本地或数据处理脚本中拆成两张逻辑表：

```text
session_events
survey_answers
```

### 12.1 session_events 表

来源：

```text
payload_type = session_events
payload.events[]
```

建议每个 event 展开成一行。

推荐字段：

```text
received_at
session_id
tester_id
tester_level
tester_level_text
build_version
event_type
timestamp
species_id
spot_id
current_turn
facing_direction
found
behavior_state
card_rarity
card_id
is_new_card
sd_remain
from_state
to_state
exit_reason
photos_in_encounter
shoot_index
reason
duration_ms
total_photos
unique_species
spots_visited
raw_event_json
```

### 12.2 survey_answers 表

来源：

```text
payload_type = survey_answer
payload.survey
```

建议每份问卷一行。

推荐字段：

```text
received_at
session_id
tester_id
tester_level
tester_level_text
build_version
q0
q0_text
q1
q1_text
q2
q2_text
q3
q3_text
q4
q4_text
q5
q5_text
q6
q6_text
q7
q7_text
q8
q8_text
q9
q10
q11
q12
survey_completed
survey_skipped
submitted_at
raw_survey_json
```

---

## 13. 第一版看板建议页面

### 13.1 总览页

核心指标：

```text
测试玩家数：COUNT_DISTINCT(tester_id)
总局数：COUNT(session_start)
总问卷数：COUNT(survey_answer)
平均单局时长：AVG(session_end.duration_ms)
平均照片数：AVG(session_end.total_photos)
平均记录鸟种数：AVG(session_end.unique_species)
平均推荐分：AVG(q9)
```

推荐图表：

```text
tester_level 分布
session_end reason 分布
每局照片数分布
每局时长分布
NPS 分布
```

---

### 13.2 问卷结果页

重点图表：

```text
Q1 游戏画面感分布
Q2 出红兴奋感分布
Q3 文字卡牌收集感分布
Q4 全收集意愿分布
Q5 找鸟难易感受分布
Q6 栖息地关系感知分布
Q7 游玩深度意愿分布
Q8 资源压力感受分布
Q9 NPS 分布
Q10 规则理解开放文本列表
Q11 希望增加鸟种词频 / 列表
Q12 希望增加内容词频 / 列表
```

---

### 13.3 行为数据页

重点图表：

```text
观察命中率 = observe_attempt found true / observe_attempt 总数
各鸟种 photo_shoot 次数
各鸟种被拍照人数
behavior_state at shoot 分布
card_rarity 分布
photo_wait 次数分布
photo_end exit_reason 分布
session_end reason 分布
```

---

### 13.4 交叉分析页

建议交叉：

```text
Q5 找鸟难易感受 × observe_attempt 命中率
Q2 出红兴奋感 × photo_shoot 中 REMARKABLE 数量
Q4 全收集意愿 × session_count / 图鉴完成度
Q6 栖息地感知 × spot / species 分布
Q8 资源压力感受 × session_end reason
Q1 画面感 × tester_level
Q10 规则理解 × photo_wait 使用频率
```

---

## 14. 当前已验证事项

已验证：

```text
GitHub Pages 可在无 VPN 国内网络打开
CloudBase endpoint 可在无 VPN 国内网络提交成功
CloudBase analytics_payloads 能看到新增记录
tester_id 正确写入
tester_level 正确写入
session_events 能记录
survey_answer 能记录
Q1–Q12 能提交
```

---

## 15. 当前限制与后续优化

### 15.1 当前限制

```text
CloudBase 当前只保存完整 payload，没有拆表。
看板开发前需要先做一次数据展开。
HTTP 路由当前免鉴权，理论上存在被外部乱写风险。
tester_id 不持久化，刷新页面后需要重新输入。
问卷只在当前页面生命周期内控制重复提交，不做长期防重。
```

### 15.2 后续优化建议

优先级从高到低：

```text
1. 写一个数据导出 / 展开脚本，将 analytics_payloads 拆成 CSV
2. 建立 session_events.csv 和 survey_answers.csv
3. 做 Looker Studio / 飞书表格 / Excel 看板
4. 给 CloudBase endpoint 增加简单 token 校验
5. 如果测试规模扩大，考虑将服务端直接拆分写入 analytics_events / survey_answers 两个集合
6. 如果 GitHub Pages 国内访问不稳定，再迁移静态网页到 CloudBase 静态托管
```

---

## 16. 推荐提交记录

本阶段相关提交可参考：

```text
feat: add analytics MVP event tracking
fix: send analytics to Apps Script with no-cors
feat: add playtest entry and tester profile capture
feat: add playtest feedback preface flow
chore: switch analytics endpoint to CloudBase
feat: add post-playtest survey submission
fix: align playtest survey copy with testing plan
fix: keep tester profile during current page session
```

---

## 17. 后续看板开发的核心判断问题

看板最终不是为了“展示数据很多”，而是回答以下问题：

```text
1. 纯文字观鸟的画面感是否成立？
2. 拍到精彩照片是否能产生兴奋感？
3. 文字卡牌是否有收集动力？
4. 玩家是否想全收集？
5. 找鸟难度是否刚好？
6. 玩家是否感知到鸟种与栖息地关系？
7. 回合数和 SD 卡是否产生合适压力？
8. 玩家是否理解精彩照片来自拍摄时机，而不是纯随机？
9. 哪些鸟最吸引玩家？
10. 玩家希望后续增加什么内容？
```

首轮 20 人测试不追求统计显著性，重点看：

```text
趋势
极端值
开放题高频词
tester_level 分层差异
主观问卷与行为数据是否矛盾
```