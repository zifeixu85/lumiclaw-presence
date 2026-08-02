# LumiClaw Presence 路线图

[English](ROADMAP.md) | [简体中文](ROADMAP.zh-CN.md)

这份路线图描述产品结果，不代表所有规划能力已经实现。当前实现真相以 [README](README.zh-CN.md) 为准。

## 开发方法

我们只建设一条连续 Campaign 旅程，并让它逐步变真：

~~~text
Campaign 初始化
→ Activation Plan
→ AgentTeams SHADOW
→ 独立审校
→ Owner 精确批准
→ 受治理的直发或 Native Handoff
→ Receipt 对账
→ Response Disposition
→ 作用域 Learning
→ 下一 Mission 复用
~~~

每个里程碑都是用户可见的纵向切片，产品 UI、领域合同、AgentTeams、治理、测试和证据同期交付。Seed、SHADOW、CONTROLLED_REAL 和 LIVE 状态始终明确标记。

## 当前开发顺序

### M0｜交付基础 · NOW

- 冻结首个真实 Campaign 输入和 Owner 基线；
- 建立应用壳、SDD、CI、依赖政策与 License 决策；
- 核验锁定的 AgentTeams Runtime，并完成新 Mission smoke；
- 用可点击原型走完五主屏旅程。

完成：仓库可安装、测试并打开带状态标记的产品壳；首个纵向 Spec 达到可开发状态。

### M1｜Campaign Walking Skeleton · NEXT

- 创建、保存并重新打开真实 CampaignBrief；
- 建模 Identity、Product、Market、AccountMandate、Claim/Evidence 与 ActivationUnit；
- 展示资料缺口、账号边界和有用的 Activation Plan；
- Web、API/CLI 和 AgentTeams Adapter 读取同一个 Mission State。

完成：一个真实 LumiClaw Campaign 可在没有隐藏 Demo 状态的前提下进入 Readiness。

### M2｜受治理的 SHADOW Campaign

- 在 AgentTeams 中运行一个 Mission Leader 与五个领域成员；Leader 只编排，不生成领域 Artifact；
- 分别生成 Founder 与 Product Account 产物；
- Producer 与 Independent Auditor 分权；
- 展示 Revision Diff、Audit Evidence、Owner Review、Shared State 与 Trace；
- 注入一个 Claim 故障并证明无外部动作。

完成：一个有效 Artifact 进入 Owner Review，一个错误 Artifact 被阻断并修订。

### M3｜受控真实激活

- 把精确 OwnerDecision 转成短时、一次性 ActionGrant；
- 执行前持久化 Outbox Attempt；
- 通过 Bluesky 官方路径发布并读取原生对象对账；
- 提供诚实 LinkedIn Native Handoff 与 URL 回填；
- 区分已发布、需用户动作、失败与未知状态。

完成：一个直发和一个 Handoff 都有真实 Receipt，且没有未授权或重复动作。

### M4｜Response 与 Learning 闭环

- 规范化一条真实或受控真实互动；
- Owner 决定 Outcome 与 Disposition；
- 审阅、接受、拒绝、限缩和回滚 LearningProposal；
- 第二 Mission 显示复用了哪条 ApprovedMemory。

完成：Mission 1 → Response → Learning Decision → Mission 2 可复验，且无跨账号或跨市场污染。

### M5｜可运行产品候选

- 集成完整五主屏 Web 旅程；
- 覆盖空、阻断、过期、撤销、未知、恢复和成功状态；
- 在同条件下比较单 Agent、最小团队和完整团队；
- 提供 Fresh Install、CI、Conformance、Evidence Export 和公开安全示例。

完成：新机器可按文档运行一个正常闭环和一个失败关闭闭环。

### M6｜外部校准与加固

- 设计伙伴使用自己的 Campaign 运行 SHADOW；
- 验证初始化时间、Owner 理解、隔离、恢复与非文案价值；
- 根据真实使用加固可靠性，而不是扩张平台数量。

完成：只有伙伴使用自己的目标、资料和决策协议，才标记 `EXTERNAL_CALIBRATED`。

## 产品阶段

| 阶段 | 产品结果 |
|---|---|
| Founder Brand Matrix | 一位 Owner 跨身份、产品、市场和账号运行受治理的 Campaign。 |
| Design Partner Operations | 团队和 Agency 通过 Workspace、角色、客户隔离和模板重复运行。 |
| Global Brand Operations Control Plane | 品牌、区域和代理商团队统一协调政策、审批、执行 Provider、Portfolio 与有限自治。 |
| Global Presence OS | 可扩展 Mission 与治理层覆盖更多公开和半公开 Presence Surface。 |

后续阶段是方向，不是当前实现声明。

## LumiClaw 自己拥有什么

LumiClaw 拥有业务语义与证据链：Brand Graph、Campaign Mission、Claim/Evidence、Role Context、ArtifactRevision、独立 Audit、OwnerDecision、Grant、Receipt、Outcome、作用域 Learning 与 Flight Conformance。

可以集成并替换的基础设施包括 AgentTeams、Web/数据库框架、官方平台 SDK、存储、队列、Secret Manager 和 Observability Backend。Postiz 保持独立部署的 PoC Adapter 候选，不进入关键路径，也不复制其源码。

## SDD 推进

每个里程碑使用一个 Epic SDD，并拆成约半天至三天可独立完成和验证的 Child Specs。Spec 必须写清用户结果、Journey 与 UI 状态、Domain/API 合同、AgentTeams 角色与 Skills、权限、依赖与 License、失败与回滚、Pass/Fail 验收、测试计划和证据成熟度。

使用 [SDD 模板](docs/specs/SPEC-TEMPLATE.md)。日期到达不等于完成，Exit Criteria 通过才算完成。
