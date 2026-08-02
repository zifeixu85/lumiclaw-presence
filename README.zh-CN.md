# LumiClaw Presence

[English](README.md) | [简体中文](README.zh-CN.md) | [路线图](ROADMAP.zh-CN.md)

> 面向多品牌、多市场团队的 AI 原生全球品牌运营系统。

**状态：** Pre-alpha，目前只有文档。产品方向已经冻结，首个可运行纵向切片正在构建。除非明确标注，以下能力均为规划。

LumiClaw Presence 把一个业务目标转化为跨身份、品牌、产品、市场和公开账号的协同行动，在已批准的事实、权限与责任边界内执行，并把真实回应带回下一轮决策。

长期愿景是 **Global Presence OS**；第一能力表面是 **Global SocialOps**；第一个可购买任务是 **Global Campaign Activation & Response**。

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
| 第一可购买任务 | Global Campaign Activation & Response |
| 治理运行时 | Presence Governance & Execution Runtime |
| 信任模块 | Presence Agent Flight Simulator |

愿景说明产品可以走到哪里，不代表完整企业套件已经实现。

## 首个计划纵切面

第一条纵向切面将围绕一项真实 LumiClaw Campaign，让创始人身份和产品身份协同行动：

~~~text
真实 Campaign 目标
→ 身份、产品、市场、账号与 Mandate
→ 有证据约束的 Claim
→ 专业 AgentTeams 成员
→ 独立生产与审校
→ Human Owner 精确批准
→ 一个官方 Connector 直发
→ 一个诚实 Native Handoff
→ 真实 Response、Outcome 与 Disposition
→ 有作用域的 LearningProposal
→ 故障重放被拒绝
~~~

计划中的参考路径：

- 使用官方 API 的 LumiClaw 自有 Bluesky Connector；
- 当前账号能力连接和验证完成前，LinkedIn 使用用户驱动 Native Handoff。

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

## 当前实现真相

**已经实现：**

- 公开仓；
- 中英文产品文档。

**仍在规划：**

- 新领域合同；
- AgentTeams Campaign Runtime；
- ActionGrant、ActionReceipt 与 Capability Probe；
- Bluesky 直发与 LinkedIn Handoff；
- Response Disposition、作用域学习与 Flight Replay；
- Web 产品面。

旧私有原型存在部分工程资产，但不能写成当前产品已经实现。任何复用都将逐文件记录来源、License、语义变化和新测试。

## 实现顺序

1. 领域 Schema、canonical digest 与 Conformance Fixture；
2. Producer 与 Auditor 分离的 AgentTeams SHADOW Mission；
3. Replay 与故障拒绝；
4. Human Decision → 单次 ActionGrant → ActionReceipt；
5. 一个官方直发 Connector 与一个 Native Handoff；
6. 一条真实 Response → Outcome → Scoped Learning；
7. 下一 Mission 正确复用已批准学习；
8. 同条件下比较单 Agent 与多 Agent。

各阶段的用户结果、Exit Criteria、产品 Horizon 和 SDD 推进方式维护在[公开路线图](ROADMAP.zh-CN.md)中。

## 仓库范围

本仓库将保存公开产品代码、领域 Schema、可复用 Skill、Connector 契约、测试、示例和技术文档。

本仓库不会保存私有研究、内部决策稿、客户原始资料、私信、凭据、Token、账号数据或私有 Runtime Evidence。

## 开发与许可证

实现基线为 Node.js 20+、ESM、npm workspaces、schema-first 合同和自动 Conformance Test。

根 License 尚未选择。在加入 License 前，本仓只是公开源码仓而不是开源发行版，暂不接收代码贡献。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。
