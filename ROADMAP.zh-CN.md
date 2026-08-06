# LumiClaw Presence 路线图

[English](ROADMAP.md) | [简体中文](ROADMAP.zh-CN.md) | [技术架构](ARCHITECTURE.zh-CN.md) | [实现进度](IMPLEMENTATION-STATUS.zh-CN.md)

这份路线图描述产品结果，不代表所有规划能力已经实现。模块级进度见[实现进度表](IMPLEMENTATION-STATUS.zh-CN.md)；当前实现真相以 [README](README.zh-CN.md) 为准；计划技术边界见[技术架构](ARCHITECTURE.zh-CN.md)。

## 开发方法

我们只建设一条连续的 **Release-to-Presence-to-Feedback** 旅程，并让它逐步变真：

~~~text
Release 或业务信号
→ Campaign 初始化
→ Activation Plan
→ AgentTeams SHADOW
→ 独立审校
→ 四个平台可编辑 Revision
→ Owner 精确批准
→ 受治理的直发或 Native Handoff
→ Receipt 对账
→ Response Disposition
→ 作用域 Learning
→ 下一 Mission 复用
~~~

每个里程碑都是用户可见的纵向切片，产品 UI、领域合同、AgentTeams、治理、测试和证据同期交付。Seed、SHADOW、CONTROLLED_REAL 和 LIVE 状态始终明确标记。

## 当前开发顺序

### M0｜交付基础 · 已交付

- 冻结首个真实 Campaign 输入和 Owner 基线；
- 建立 Node.js 24 与 TypeScript Workspace，规划 Next.js 16 `web`、Fastify 5 `api`、`mission-worker` 与确定性 `action-operator` 边界；
- 建立 Docker Compose Skeleton、PostgreSQL 17 Migration 路径、Content-addressed Local Blob、SDD、CI、依赖政策与 License 决策；
- 建立 `next-intl` 默认中文、支持英文的 UI Shell、类型化双语 Message 一致性、Locale Route、Design Token 与五主屏 Route Skeleton；
- 让双语实现进度表、每 SDD Goal 与验收报告流程进入 CI；
- 核验锁定且隔离的 AgentTeams 外部 Runtime Profile，完成新 Mission Smoke，并确保其内部状态不成为产品真源；
- 用可点击低/高保真 Route 走完五主屏与四平台 Composer。

完成：仓库可通过文档中的 Compose 路径安装，Migration 与测试通过，带状态标记的产品壳可打开；首个纵向 Spec 达到可开发状态。

### M1｜Campaign Walking Skeleton · 已交付

- 使用 PostgreSQL 权威状态创建、保存并重新打开真实 CampaignBrief；
- 建模 Identity、Product、Market、AccountMandate、Claim/Evidence 与四个 ActivationUnit；
- 展示资料缺口、账号边界和有用的 Activation Plan；
- Web、API/CLI 和 AgentTeams Adapter 读取同一个 Mission State。
- 交付 X、Bluesky、LinkedIn 与小红书可编辑 Artifact、原生近似 Preview 和 Capability/Constraint Fixture。
- 保存带 IANA 时区的一次性或受约束重复排程，验证 DST/Misfire，本阶段不执行外部动作；

完成：一个真实 LumiClaw Campaign 可在没有隐藏 Demo 状态的前提下进入 Readiness，并重新打开四个平台 Revision。

### M2｜受治理的 SHADOW Campaign · EVIDENCE READY

- 在 AgentTeams 中运行一个 Mission Leader 与五个领域成员；Leader 只编排，不生成领域 Artifact；
- 通过 `ModelProvider` Port 与计划中的 DeepSeek V4 Gateway 路由模型任务；
- 为四个平台分别生成 Founder 与 Product Account 产物；
- Producer 与 Independent Auditor 分权；
- 把上传媒体或经 `MediaGenerationProvider` 生成的媒体纳入 immutable Revision，且不自动批准；
- 在 LumiClaw Control Plane 展示 Revision Diff、Audit Evidence、Owner Review、Shared State 与 Trace；
- 注入一个 Claim 或平台 Constraint 故障并证明无外部动作。

完成：六成员团队返回通过 digest 校验的 Artifact；一个有效 Revision 进入 Owner Review，一个错误 Revision 被阻断并修订。

当前分支以真实固定版本 AgentTeams Runtime 与 Owner 控制的本地 DeepSeek Canary 达到工程 Exit。M2 在 Owner UAT 被记录前保持 `EVIDENCE_READY`；不声明 EvoLink 真实成熟度、平台外部动作或外部用户结果。

### M3｜受控真实激活

- 把精确 OwnerDecision 转成短时、一次性 ActionGrant；
- 在独立、无 LLM 的 `action-operator` 执行前，原子持久化 Grant 与 Outbox 状态变更；
- 使用 PostgreSQL Lease 领取到期 Schedule Occurrence，完成重启恢复，并证明重复 Schedule 不持有永久 Grant；
- 通过 Bluesky 官方路径发布并读取原生对象对账；
- 提供诚实 LinkedIn Native Handoff 与 URL 回填；
- 提供诚实小红书发布包 Handoff，并通过 URL 或批准证据对账；
- 执行 X 官方 Direct PoC；只有 OAuth、Scope、预算、幂等、故障与读回 Gate 全部通过才开启有限 Canary，否则降级为 X Handoff；
- 区分已发布、Handoff 已对账、需用户动作、失败与未知状态。

完成：Bluesky Direct、LinkedIn Handoff 与小红书 Handoff 都有真实 Receipt，且没有未授权或重复动作。X Direct 可选，不得阻塞此 Exit。

### M4｜Response 与 Learning 闭环

- 规范化一条真实或受控真实互动；
- Owner 决定 Outcome 与 Disposition；
- 审阅、接受、拒绝、限缩和回滚 LearningProposal；
- 第二 Mission 显示复用了哪条 ApprovedMemory。
- 至少完成一个隔离、非关键路径的 `SignalProvider` PoC，并通过 Purpose、Provenance、Terms、Quarantine、Schema 与 Retention Gate。

完成：Mission 1 → Response → Learning Decision → Mission 2 可复验，且无跨账号或跨市场污染；第三方 Signal 不能绕过 Evidence Review。

### M5｜可运行产品候选

- 集成完整五主屏 Web 旅程；
- 覆盖四平台 Preview 与动作模式下的空、阻断、过期、撤销、未知、恢复和成功状态；
- 在同条件下比较单 Agent、最小团队和完整团队；
- 提供 Fresh Docker Install、备份恢复演练、CI、Provider/Connector Conformance、Evidence Export、视觉/可访问性检查和公开安全示例。

完成：新机器无需依赖开发者机器上的隐藏服务，即可按 Compose 文档运行一个正常闭环和一个失败关闭闭环。

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

可替换的集成包括：作为外部执行域的 AgentTeams；位于 `ModelProvider` 后的 DeepSeek；位于 `MediaGenerationProvider` 后的 EvoLink；位于 `SignalProvider` 后的公开来源；位于 `PublishConnector` 后的官方动作；以及位于 `NativeHandoffAdapter` 后的用户驱动完成路径。Web/数据库框架、存储、Secret Manager 与 Observability Backend 仍是基础设施选择。Postiz 保持独立部署的 PoC Adapter 候选，不进入关键路径，也不复制其源码。

## SDD 推进

每个里程碑使用一个 Epic SDD，并拆成约半天至三天可独立完成和验证的 Child Specs。每个有边界的 SDD 使用独立 Codex 对话与一个明确 Goal。Spec 必须写清用户结果、Journey 与 UI 状态、Domain/API 合同、AgentTeams 角色与 Skills、权限、依赖与 License、失败与回滚、Pass/Fail 验收、测试计划、Owner 可参与验收步骤和证据成熟度。

开始前必须读取并更新[实现进度表](IMPLEMENTATION-STATUS.zh-CN.md)。结束时使用[验收报告模板](docs/reports/ACCEPTANCE-REPORT-TEMPLATE.md)生成报告；在 Owner 必需验收尚未记录前只能标记 `EVIDENCE_READY`。使用 [SDD 模板](docs/specs/SPEC-TEMPLATE.md)。日期或聊天回复不等于完成，Exit Criteria 通过才算完成。
