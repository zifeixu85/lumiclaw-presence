# LumiClaw Presence

[English](README.md) | [简体中文](README.zh-CN.md) | [技术架构](ARCHITECTURE.zh-CN.md) | [路线图](ROADMAP.zh-CN.md) | [实现进度](IMPLEMENTATION-STATUS.zh-CN.md)

> 面向多品牌、多市场团队的 AI 原生全球品牌运营系统。

**状态：** Pre-alpha。M0/M1 已验收，M2 已达到 `EVIDENCE_READY`：代码通过了可重复工程验证，包括一次由 Owner 在本地完成的真实 DeepSeek Canary 和固定版本六成员 AgentTeams Mission。Owner UAT 仍待完成；不声明 Connector、外部平台动作、客户结果或生产就绪。

LumiClaw Presence 把一个业务目标转化为跨身份、品牌、产品、市场和公开账号的协同行动，在已批准的事实、权限与责任边界内执行，并把真实回应带回下一轮决策。

长期愿景是 **Global Presence OS**；当前类别是 **AI-native Global Brand Operations**；我们从 **Governed Public Presence Missions（可治理的品牌公开行动任务）** 切入，第一个任务是 **Global Campaign Activation & Response**。可复用的技术核心是内嵌的 **Governed Mission Runtime**，当前不把它声明成独立产品。

## 要解决的问题

生成内容和排程发布正在变得便宜。真正困难的是：

- 谁应该代表哪个品牌或产品发声；
- 不同市场和账号应该采取什么不同动作；
- 每条重要主张怎样绑定仍然有效的证据；
- 生产、独立审校、人工批准和执行怎样真正分权；
- 怎样证明外部平台实际做了什么；
- 不支持的动作和未知状态怎样诚实降级与对账；
- 真实回复怎样进入有作用域、可审阅的下一轮学习。

LumiClaw Presence 计划成为这条闭环的控制与学习层。Connector、排程器、模型和 Inbox Provider 均可替换。

## 产品层级

| 层级 | 定义 |
|---|---|
| 长期愿景 | Global Presence OS |
| 当前类别 | AI-native Global Brand Operations |
| 产品 | LumiClaw Presence |
| 第一能力表面 | Global SocialOps |
| 用户可见工作单元 | Governed Public Presence Mission |
| 第一可购买任务 | Global Campaign Activation & Response |
| 内嵌技术核心 | Governed Mission Runtime |
| 信任模块 | Presence Agent Flight Simulator |

愿景说明产品可以走到哪里，不代表完整企业套件已经实现。

## 首个受治理纵切面

首个 Hero 使用 **Release-to-Presence-to-Feedback** 闭环，让创始人身份和产品身份围绕一次真实发布或业务信号协同行动：

~~~text
真实 Release 或业务信号
→ 身份、产品、市场、账号与 Mandate
→ 有证据约束的 Claim
→ 专业 AgentTeams 成员
→ 独立生产与审校
→ 四个平台可编辑原生版本
→ Human Owner 精确批准
→ 受治理的直发或诚实 Native Handoff
→ Action Receipt 与真实 Response
→ 产品反馈、Issue 或 Disposition
→ 有作用域的 LearningProposal
→ 故障重放被拒绝
~~~

首个 Composer 与 Review 路径计划提供四个平台版本，并清楚区分执行语义：

| 平台 | 可编辑产物与 Preview | 执行路径 |
|---|---|---|
| Bluesky | 必过 | 官方 Direct 必过，并用 URI/CID 对账 |
| LinkedIn | 必过 | 用户驱动 Native Handoff 必过，并用 URL 对账 |
| 小红书 | 必过 | 用户驱动发布包 Handoff 必过，并用 URL 或批准证据对账 |
| X | 必过 | 官方 Direct 是 POC-GATED Canary；失败时显式降级为 Handoff，且不得阻塞 Hero |

Preview 可用不代表 Connector 已存在，也不代表当前账号允许 Direct。

Postiz 是独立 PoC 候选，不进入 Hero 关键路径；LumiClaw 不 Fork 或复制其源码。

## 核心合同

LumiClaw 计划拥有：

- Organization、Identity、Brand、Product、Market；
- ChannelAccount 与 AccountMandate；
- CampaignMission 与 ActivationUnit；
- Claim 与 Evidence；
- ArtifactRevision 与独立 AuditDecision；
- Human OwnerDecision；
- 短时、一次性 ActionGrant；
- CapabilitySnapshot 与 ActionReceipt；
- InteractionEvent、OutcomeSignal 与 Disposition；
- LearningProposal 与作用域 ApprovedMemory。

更换外部发布器后，这些业务对象和证据链不能消失。

## 安全与治理

- Producer 不能审校或批准自己的产物；
- Auditor 只能 PASS、FAIL 或 ESCALATE，不能静默改稿；
- Human Owner 批准精确版本、账号、动作和时间窗口；
- 确定性 Operator 不能修改批准内容或扩大授权；
- 平台能力按真实账号探测；
- HTTP 200 或队列 ID 不等于发布成功；
- 外部状态未知时先对账，不盲目重试；
- 观察只能生成 LearningProposal，不能静默修改已批准事实或共享 Skill；
- 密钥和私有账号数据不得进入 Prompt、公开 Fixture 或 Commit。

## Presence Agent Flight Simulator

计划中的信任模块会在扩大权限前重放冻结的历史输入并注入故障：

~~~text
Frozen Input
→ Historical Replay
→ Fault Injection
→ Readiness Report
→ Autonomy Envelope
→ Shadow
→ Canary
→ Scoped Permission Expansion
~~~

Replay 通过是工程证据，不是法律、文化、平台或业务安全认证。

## 产品边界

LumiClaw Presence 计划拥有受治理的全球品牌行动与学习，但不替代：

- 完整 CRM、销售 Pipeline 或收入预测；
- 付费媒体投放；
- 企业整体战略、定价或产品管理；
- 不受限制的自动评论、关注或私信；
- 人类法律与合规判断；
- 对业务结果负责的人类负责人。

项目不承诺曝光、涨粉、线索或收入。

## 计划技术架构

已选择的参考栈是 Node.js 24 LTS 与 TypeScript；`web` 使用 Next.js 16 与 `next-intl`，默认中文并支持英文；`api` 使用 Fastify 5，权威状态使用 PostgreSQL 17 与 Kysely；Docker Compose 是首个安装合同。

应用拆分为 `web`、`api`、`mission-worker` 和确定性的 `action-operator`。AgentTeams 通过 Runtime Adapter 运行在独立执行域，不是产品数据库、Secret Store 或发布 Operator。DeepSeek、EvoLink 与公开信号来源分别位于 `ModelProvider`、`MediaGenerationProvider` 和 `SignalProvider` 端口之后；发布侧另用 `PublishConnector` 与 `NativeHandoffAdapter` 合同。

发布排程持久化在 PostgreSQL，并显式保存 IANA 时区与错过执行策略。首期 `mission-worker` 使用 Lease 和可恢复 Job 领取到期 Occurrence；Host crontab 和进程内 Timer 不是真源。重复 Schedule 不能创建永久发布 Grant。

计划中的服务边界、Provider 端口、四平台 Preview 合同与交付 Gate 详见[技术架构](ARCHITECTURE.zh-CN.md)。

## 当前实现真相

**当前分支的工程验证候选（等待 Coordinator 复核与 Owner 验收）：**

- 已验收的 M0 Node/npm Workspace、Docker Compose/PostgreSQL/BlobStore 基础、双语 Next.js Shell、质量门禁与隔离 AgentTeams v1.2.0 Adapter Smoke；
- 租户约束的 Organization、Identity、Brand、Product、Market、ChannelAccount、AccountMandate 合同与 Migration；
- 版本化 CampaignBrief、GoalProfile、Claim/Evidence、ActivationPlan/ActivationUnit、ArtifactRevision、CapabilitySnapshot 与六角色 MissionContract，并提供 Canonical Digest；
- Fastify REST/OpenAPI Control API，以及 PostgreSQL 创建/保存/重开、Idempotency-Key、ETag 冲突、Snapshot 和租户隔离；
- 默认中文、支持英文的五主屏 M1 状态，以及 X、Bluesky、LinkedIn、小红书四种可编辑且结构不同的 Preview；
- PostgreSQL PublishingSchedule/ScheduleOccurrence，覆盖受约束 RRULE、IANA 时区、DST gap/fold、Misfire 与编辑失效；
- 固定 AgentTeams v1.2.0 Runtime Adapter，以及可重复的真实 Manager/Worker/Project/DAG/Task/ACK/Submit：恰好六个分权成员，包括只编排的 Leader 与独立 Auditor；
- PostgreSQL 权威 Mission、RoleContext、五个版本锁定 Skill、已接受 Runtime Payload、四平台不可变 Revision、独立 AuditDecision 历史、精确不可执行 Owner Review、重启对账、隔离、Trace、Ledger 与公开安全证据；
- DeepSeek 官方 `ModelProvider` 与可替换 `MediaGenerationProvider` 边界，覆盖结构化输出、超时/重试/限流/错误、脱敏、成本/延迟和 Content-addressed Rights Receipt；公开安全 Mock 继续明确标记 `MOCK_CONFORMANCE`；
- 一次由 Owner 本地控制的 DeepSeek Canary 完整经过真实六成员、八任务 AgentTeams 路径，形成 7 个脱敏且已接受的模型回执、5 个不可变 Revision、5 个 AuditDecision，最终状态为 `AWAITING_OWNER_REVIEW`，外部动作数为 0；这是工程验证，不是客户或业务验证；
- 默认中文、支持英文的 Mission/Review 流程、390px、14 个浏览器渲染 Storybook 状态，以及 UX-M1-001 两类准确且可操作的禁用原因；
- 不包含到期执行、Connector、真实平台动作、可执行 OwnerDecision、ActionGrant、ActionReceipt、真实 Provider 成熟度声明或真实客户数据。

**仍在规划：**

- ActionGrant、ActionReceipt 与 Capability Probe；
- Bluesky Direct、LinkedIn 与小红书 Handoff，以及分级准入的 X Direct Canary；
- EvoLink 真实 Canary 与隔离的 SignalProvider Adapter；
- Response Disposition 与作用域学习；
- Hosted Authentication、多租户 RLS 与生产 Web Surface。

旧私有原型存在部分工程资产，但不能写成当前产品已经实现。任何复用都将逐文件记录来源、License、语义变化和新测试。

## 实现顺序

1. SDD-000 交付基础：License 决策、Node Workspace、Docker Compose、PostgreSQL Migration、`next-intl`、Design Shell、CI 与隔离 AgentTeams Smoke；
2. Campaign Walking Skeleton、四平台可编辑 Preview、持久化 Schedule Editor 与 Capability/Constraint Fixture；
3. 经 DeepSeek 路由、Producer 与 Auditor 分离的六成员 AgentTeams SHADOW Mission；**工程证据已就绪。**
4. Release-to-Presence-to-Feedback Hero：精确批准、一次性 ActionGrant、ActionReceipt 与诚实故障降级；
5. 一个官方 Direct 路径加明确 Native Handoff；X Direct 只有 Canary Gate 通过才开启；
6. 一条真实 Response 进入已审阅 GitHub Issue、Outcome 或作用域 Learning，并完成一个隔离 SignalProvider PoC；
7. 下一 Mission 正确复用已批准学习；
8. Fresh Install、恢复、Provider Conformance，以及同条件单 Agent / 多 Agent 验证。

各阶段的用户结果和 Exit Criteria 维护在[公开路线图](ROADMAP.zh-CN.md)中；模块状态、Blocker、Evidence 与下一可执行任务以[实现进度表](IMPLEMENTATION-STATUS.zh-CN.md)为准。

## 本地运行

前置：Docker Desktop、Node.js `24.16.0`、npm `11.13.0`。

~~~bash
npm ci
npm run verify
docker compose up --build
~~~

打开 <http://127.0.0.1:3100>。默认界面为简体中文，英文路径为 `/en`。普通 Compose 路径只使用合成数据，不会执行任何外部社媒动作。真实 Provider UAT 使用独立的 Owner-only 协议，Key 不得进入 Git、`.env`、Shell History、Issue 或日志。

## 仓库范围

本仓库将保存公开产品代码、领域 Schema、可复用 Skill、Connector 契约、测试、示例和技术文档。

本仓库不会保存私有研究、内部决策稿、客户原始资料、私信、凭据、Token、账号数据或私有 Runtime Evidence。

## 开发与许可证

计划实现基线为 Node.js 24 LTS、TypeScript、ESM、npm workspaces、schema-first 合同和自动 Conformance Test。

LumiClaw Presence 采用 [Apache License 2.0](LICENSE)。依赖、资产、Provider、容器和旧工程迁移文件遵守[依赖与许可证政策](docs/DEPENDENCY-POLICY.zh-CN.md)。项目仍处于 Pre-alpha，不代表 Production-ready。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。
