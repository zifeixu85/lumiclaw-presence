# LumiClaw Presence 技术架构

[English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.zh-CN.md) | [README](README.zh-CN.md) | [路线图](ROADMAP.zh-CN.md)

> **状态：** 当前只有文档，全部为 `PLANNED`。本文定义计划中的参考架构；公开仓尚未交付下述服务、依赖、Connector 或部署。

## 架构目标

LumiClaw Presence 计划成为全球品牌运营的控制与学习层。架构把五类职责明确分开：

- LumiClaw 自己拥有的业务状态与证据；
- 通过 AgentTeams 完成的专业多 Agent 协作；
- 确定性的审校、批准与外部动作治理；
- 可替换的模型、媒体、信号与发布 Provider；
- 可编辑的平台原生产物，以及不夸大执行能力的近似预览。

首条参考旅程是 **Global Campaign Activation & Response**：让 Founder Identity 与 Product Identity 面向 X、Bluesky、LinkedIn 和小红书生成四份可编辑版本，再按每个真实账号当前可用的能力选择诚实执行路径。

## 计划中的系统拓扑

~~~mermaid
flowchart LR
    U["Owner / Reviewer"] --> W["web · Next.js 16"]
    W -->|"REST + SSE"| A["api · Fastify 5"]
    A --> DB[("PostgreSQL 17")]
    A --> BS["BlobStore Port"]
    A --> Q["Postgres Jobs + Action Outbox"]

    Q --> MW["mission-worker"]
    Q --> AO["action-operator · 无 LLM"]

    subgraph ExternalExecution["外部执行域"]
        AT["AgentTeams Runtime"]
    end

    MW --> RA["AgentTeams Runtime Adapter"]
    RA --> AT
    MW --> MP["ModelProvider"]
    MP --> DS["DeepSeek 官方 API"]
    MW --> MGP["MediaGenerationProvider"]
    MGP --> EV["EvoLink"]
    MW --> SP["SignalProvider"]
    SP --> SIG["官方 API / 分级准入 Provider"]

    AO --> SAG["Social Action Gateway"]
    SAG --> BSKY["Bluesky Direct"]
    SAG --> XD["X Direct Canary"]
    SAG --> HO["LinkedIn / 小红书 / X 降级 Handoff"]

    DB --> EE["Trace / Ledger / Evidence Export"]
~~~

Web 不保存平台 Token，也不直接调用发布 API。API 是所有客户端共享的 Control Plane。长任务和 Provider 调用由 `mission-worker` 完成；带特权的公开动作由独立、确定性的 `action-operator` 完成。

## 计划技术基线

| 范围 | 已选择基线 | 边界 |
|---|---|---|
| Runtime | Node.js 24 LTS、TypeScript、ESM、npm workspaces | 单一版本化 Monorepo；进入代码后锁定版本与镜像 digest |
| Web | Next.js 16、React 19.2、TanStack Query、React Hook Form | 只负责产品 UI 与同源入口；不在 Server Action 中建立第二条 Mutation 路径 |
| API | Fastify 5 | REST/OpenAPI、SSE、Session、授权、校验与 Control Plane Mutation |
| Database | PostgreSQL 17 | 唯一权威业务库 |
| 数据访问 | `pg`、Kysely、`node-pg-migrate` | 可审阅 SQL 与显式 Migration |
| 合同 | JSON Schema 与 Ajv | 跨进程合同真源与运行时校验 |
| 媒体存储 | `BlobStore` Port | 默认使用 Content-addressed Local FS Volume，后续支持 BYO S3-compatible Endpoint |
| UI 系统 | Tailwind CSS 与可访问 Headless Primitive | LumiClaw 自己拥有视觉系统与状态语言 |
| 质量 | Vitest、Testing Library、Storybook、Playwright、axe、MSW | Unit、Contract、状态矩阵、可访问性与 E2E 验证 |
| 安装 | Docker Compose | 首个可运行、可安装合同 |

这些是技术选择，不代表依赖已经安装或完成集成。

## 进程与部署边界

首个 Docker Compose 合同围绕四个应用进程和支持性基础设施规划：

| 进程 | 职责 | 明确不负责 |
|---|---|---|
| `web` | 五主屏产品旅程、可编辑 Composer、平台原生近似预览与 Review UI | 平台密钥、直发、权威领域 Mutation |
| `api` | Organization/Campaign API、Schema 校验、Revision、Decision、Capability/Receipt 查询、SSE | 长任务与外部平台动作 |
| `mission-worker` | Job、AgentTeams Dispatch/恢复、DeepSeek、EvoLink、信号接入、Capability Probe、Evidence Export | 社媒账号写凭据与批准动作执行 |
| `action-operator` | 验签并消费精确 ActionGrant、调用已批准 Connector、追加 Receipt 与对账记录 | LLM、AgentTeams、改稿、无关私有上下文 |
| `migrate` | 一次性执行并记录显式数据库 Migration | 提供应用流量 |
| `postgres` | 业务事实、Shared Mission State、Job、Outbox、Trace 与 Ledger | 大型 Provider Blob 与明文密钥；本地加密 Secret Broker 可使用独立受保护 Schema |
| `agentteams` | 可选 Compose Profile 或外部管理 Runtime | 产品数据库、Secret Store 或发布 Operator |

默认使用 PostgreSQL Job、Lease、Heartbeat、`FOR UPDATE SKIP LOCKED` 和 Action Outbox；Redis 不进入首期权威路径。AgentTeams 保持独立执行域，不能成为 Artifact、Task Event 或 Trace 的唯一副本。

## Control Plane 状态与受治理动作

PostgreSQL 计划作为唯一权威业务数据库。Revision 不可变，Decision、Grant、Receipt、Trace 和 Ledger 只追加，以保留完整证据链。较大的 Source Payload、媒体和 Evidence Export 通过 `BlobStore` Port 保存。

编辑与动作链如下：

~~~text
Local Draft
→ 用户显式 Save Revision
→ immutable ArtifactRevision
→ independent AuditDecision
→ exact OwnerDecision
→ signed / short-lived / single-use ActionGrant
→ deterministic Action Operator
→ append-only ActionReceipt
→ 外部状态未知时进入 Reconciliation
~~~

文本、媒体、顺序、封面、Alt Text 或 CTA 任一变化都会改变 digest。审校后再编辑必须重新审校；批准后再编辑会使旧 Decision 与未消费 Grant 失效。Queue ID 或 Provider HTTP 成功不能当作平台原生发布证据。

## AgentTeams 外部执行域

Hero 路径计划把每个 Mission 编译为六成员 AgentTeams 团队：

1. Presence Mission Leader；
2. Evidence & Claim Steward；
3. Campaign Planner；
4. Founder Identity Producer；
5. Product Account Producer；
6. Independent Auditor。

Leader 只编排，不生成领域 Artifact。Producer 与 Auditor 必须分离；AgentTeams 完成任务也不能签发 ActionGrant。Runtime Adapter 把 LumiClaw 的 `MissionContract`、`RoleContext`、`TaskContract` 与 `SkillLock` 转换为 AgentTeams 工作，再校验返回产物及输入 digest，写回 Control Plane。

AgentTeams 可通过外部 Endpoint 运行，也可使用可选且锁定版本的 Compose Profile。它内部的 Matrix、对象存储、Worker 与 Runtime State 不属于 LumiClaw 产品数据面。

## Provider 端口

读侧智能与写侧动作使用不同接口，避免数据 Provider 静默获得发布权限。

| Port | 首个计划 Provider | 合同边界 |
|---|---|---|
| `ModelProvider` | DeepSeek 官方 API | 结构化推理与 Tool Call；Schema 校验、角色路由、费用与模型快照仍由 LumiClaw 掌握 |
| `MediaGenerationProvider` | EvoLink | 异步图片/视频任务；结果下载、Hash、入库并经审校，不自动批准 |
| `SignalProvider` | 官方 API 优先；TikHub、Apify 或具体 RapidAPI Provider 仅在独立 PoC Gate 后接入 | 只读公开信号；必须校验 Purpose、Provenance、Terms、Retention、隔离区、PII 与 Schema |
| `PublishConnector` | Bluesky；X 仅在 Direct PoC Gate 后 | 精确批准的外部动作、账号能力与原生回执语义 |
| `NativeHandoffAdapter` | LinkedIn、小红书与 X 降级路径 | 用户在原生平台完成动作，并通过 URL 或批准证据对账 |

计划中的 DeepSeek 路由使用 `deepseek-v4-flash` 处理较低风险转换与归纳，使用 `deepseek-v4-pro` 处理规划、Evidence Stewardship、审校和高风险修订。EvoLink 可替换，不能成为 MediaAsset 真源。`SignalProvider` 只能产生 Claim Candidate，不能把第三方数据自行升级成已批准公开主张。

## 四平台可编辑 Composer

四个平台的产物都计划成为可编辑、可独立审校的 Revision。每张 Preview 必须显示目标 Identity/Account、Capability Snapshot 及采集时间、当前执行模式、约束错误，以及“平台原生渲染可能变化”的提示。

| 平台 | 计划中的可编辑预览 | 计划执行语义 | Hero Gate |
|---|---|---|---|
| Bluesky | Feed/Thread、Facets、Embed、Handle、文本与媒体 | 官方 API Direct，并用原生 URI/CID 对账 | **Direct 必过** |
| LinkedIn | 个人/企业身份、See more、链接卡与媒体 | 用户驱动 Native Handoff，回填 URL 对账 | **Handoff 必过** |
| 小红书 | Note 卡、标题/正文/话题、封面、轮播或视频 Poster | 下载/复制发布包、原生 App 完成、URL 或安全截图回填 | **Handoff 必过** |
| X | Feed/Thread、媒体 Grid、加权字符约束与 Alt Text | 只有 OAuth、Scope、预算、故障、幂等和读回 Gate 全部通过后才官方 Direct，否则显式 Handoff | Preview 必过；Direct 是 **POC-GATED Canary**，不得阻塞 Hero |

Preview 可用不代表 Connector 已存在、账号有对应 Scope 或允许服务端自动化。能力不支持或过期时必须显式降级。本期排除 X 自动回复、点赞、关注、批量 Repost 和 DM，也不使用 Cookie、私有 API 或浏览器自动化为小红书发布。

## 计划设计工作流

`DESIGN.md` 与 UI State Contract 是统一规范。Pencil 计划作为 Foundations、Components、五主屏、四平台 Preview 与 Hero 状态矩阵的高保真视觉真源。Open Design 只用于两条有边界的交互 HTML Spike：多平台 Composer，以及 Audit → Approval → Receipt；两种工具的导出都不直接成为生产代码。Next.js/React 仍是实现真源，Storybook 与 Playwright 使用同一状态合同验证截图、交互路径和可访问性。

## 计划中的仓库结构

~~~text
apps/
  web/
  api/
  mission-worker/
  action-operator/
packages/
  domain/
  db/
  mission-compiler/
  runtime-agentteams/
  governance/
  execution/
  providers/
  observability/
skills/
conformance/
examples/
  lumiclaw-global-campaign/
infra/
  compose/
docs/
  architecture/
  design/
  specs/
scripts/
test/
~~~

这是目标布局。只有对应里程碑已有可开发 Spec 和验证标准时，才会加入目录。

## 交付 Gate

架构必须通过里程碑 Exit 形成证据，不能由本文直接宣称完成：

- M0 建立 Compose Skeleton、数据库 Migration、设计合同与平台 Route；
- M1 交付 Campaign Walking Skeleton、四平台可编辑 Preview 与 Capability Fixture；
- M2 接入 DeepSeek，并运行六成员 AgentTeams SHADOW Mission 与独立 Auditor；
- M3 必须通过 Bluesky Direct、LinkedIn Handoff 与小红书 Handoff；X Direct 保持分级准入 Canary；
- M4 完成一条 Response/Learning 闭环，并隔离验证至少一个非关键路径 `SignalProvider` PoC；
- M5 验证 Fresh Docker Install、备份恢复、Provider Conformance、Evidence Export 与完整状态矩阵；
- M6 先与真实设计伙伴校准 SHADOW 使用，再扩大自治或多租户声明。

完整 Exit Criteria 与顺序见[路线图](ROADMAP.zh-CN.md)。
