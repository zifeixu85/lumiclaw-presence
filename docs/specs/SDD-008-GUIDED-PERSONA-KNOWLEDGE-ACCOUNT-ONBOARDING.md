# SDD-008 — Guided Persona, Knowledge and Account Onboarding

> Status: `SPEC_READY`
> Milestone: `M5`
> Proposed progress module ID: `M5-06`（待 Coordinator 在实现提交中登记；本文不改变 canonical progress）
> Owner: LumiClaw Presence 产品/设计 Owner
> Goal objective: 冻结并实现本地资料到 Owner 批准 Authoritative KnowledgeSnapshot 的权威入口
> Target evidence maturity: `ENGINEERING_VERIFIED`
> Acceptance report: `docs/reports/acceptance/SDD-008-ACCEPTANCE.md`
> Last updated: `2026-08-22`

## 1. User problem and outcome

本地 Owner 不应先理解 Campaign、Prompt 或 Agent 配置。首次打开产品只输入显示名称，随后按步骤建立可复用的人设、企业/产品知识、X/小红书账号运营档案、市场/内容语言/时区，并导入多份 Markdown、纯文本和自由文字。最终可见结果不是“文件上传成功”，而是一份来源可追溯、冲突已处理、由 Owner 精确批准的 `AuthoritativeKnowledgeSnapshot`。

本 SDD 完成时 Onboarding 到达 `KNOWLEDGE_APPROVED_NEEDS_GOAL`；持续目标由 SDD-009 独占，避免 Onboarding 和 Campaign brief 同时成为 Goal 真源。

## 2. Current state

- `main` 已有 PostgreSQL、BlobStore、稳定 locale code 与 Campaign 基础，可复用。
- PR #7 / SDD-006 已实现本地显示名称、无远端注册、`.md`/`.txt` ingest、digest/blob/PG 持久化和生产 UX Shell；它是本 SDD 的收敛基础，不是已存在于 `main` 的依赖事实。
- PR #7 把身份、企业、产品和账号压缩为一组通用字段；没有版本化 Persona、AccountOperatingProfile、KnowledgeItem/Conflict 或批准 Snapshot。
- PR #6 / SDD-005 的公共 Market Pack 是 fixture 驱动的建议来源，不是用户权威知识。
- 当前 Agent 输入仍可来自内置 `DEMO_SEED`；没有“只有批准 Snapshot 才可编译”的门。

因此，`IMPLEMENTED` 仅限上述基础；本文件新增合同均为 `PLANNED`，直至验收报告证明。

## 3. Scope

### In scope

- 本地匿名 Owner Profile，仅存显示名称和本机 owner ID；不做远端注册。
- 七步流程：显示名称 → 创始人/个人人设 → 企业与产品 → 知识来源 → X 账号档案 → 小红书账号档案 → Market/Content Locale/Time Zone 与 Snapshot 审阅。
- 多份 UTF-8 `.md`/`.txt`、单文件和多文件选择、自由文字来源；保存原始 bytes digest、Blob ref、提取文本、来源标签与版本。
- 版本化 Persona、Organization、Product 和 AccountOperatingProfile；X 与小红书档案分开建模。
- 将来源归一为 KnowledgeItem，显示来源绑定、矛盾、缺口和优先级，要求 Owner 对冲突作出明确选择。
- 冻结、批准、替代 `AuthoritativeKnowledgeSnapshot`；只允许批准 Snapshot 进入下游编译。
- 中英文 UI 文案、断点续填、乐观并发、幂等提交、旧 PR #7 本地资料的非破坏迁移。

### Out of scope

- OperatingGoal、7/30 日计划和 Mission 编译；由 SDD-009 负责。
- PDF、DOCX、音频/语音、OCR、网页抓取、向量数据库、通用 RAG。
- Agent 自动修改 Owner 真源、自动解决冲突或把公共 Market Pack 提升为权威资料。
- 账号 OAuth、Cookie、密码、access token、自动发布能力探测。

### Existing behavior that must not change

- `zh-CN` 默认 UI locale，`en` 为第二 locale；UI locale 不等于 Content Locale。
- BlobStore content-addressing、tenant/owner 隔离、PR #7 已有资料不得静默丢失。
- 公共 Campaign/fixture 路径仍可读；不得把私有资料写入 public fixture、Git 或公开 Evidence。

## 4. User journey and UI states

1. 首次打开显示本地欢迎页，Owner 输入显示名称；系统不要求邮箱、密码或云账号。
2. Owner 分步填写人设（声音、观点、禁区、第一人称关系）、企业与产品（事实、受众、价值、已批准 claim/证据）。
3. Owner 可批量添加 `.md`/`.txt`，也可输入一条或多条自由文字；每个来源先显示文件名、大小、digest、解析状态和可删除状态。
4. Owner 分别建立 X 与小红书账号运营档案：显示名/handle、账号角色、目标受众、语气、内容支柱、禁区、CTA、频率、内容语言、目标市场；不收 Secret。
5. Owner 选择 Target Market、Content Locale、IANA Time Zone；系统将公共 Market 信息清楚标为“建议”，不能覆盖 Owner 输入。
6. Review 页面按 Persona/Organization/Product/Account/Claim/Evidence 分组展示知识项、来源和冲突。冲突未处理时显示 `NEEDS_OWNER_DECISION`。
7. Owner 批准 exact draft digest 后得到 `APPROVED` Snapshot；页面显示版本、来源数量、批准时间、digest 和“下一步：建立持续目标”。

状态必须覆盖 `EMPTY`、`DRAFT`、`PARSING`、`PARSE_FAILED`、`NEEDS_OWNER_DECISION`、`READY_FOR_APPROVAL`、`APPROVED`、`SUPERSEDED` 和可恢复 `LOAD_FAILED`。浏览器刷新、API/数据库重启后回到相同 server state；本地未提交输入只标为 UI draft，不冒充已保存。

## 5. Domain and API contracts

### Versioned objects

- `LocalOwner { ownerId, displayName, createdAt, updatedAt }`。
- `OnboardingSession { id, ownerId, state, currentStep, rowVersion }`；完成状态为 `KNOWLEDGE_APPROVED_NEEDS_GOAL`。
- `SourceDocument` 与 immutable `SourceDocumentRevision { mediaType, byteSize, blobDigest, blobRef, extractedTextDigest, status }`。
- 自由文字必须保存为 `SourceDocumentRevision(sourceKind=OWNER_AUTHORED_TEXT)`，不能只塞入 Profile 字段。
- `PersonaProfileRevision`、`OrganizationKnowledgeRevision`、`ProductKnowledgeRevision`。
- `AccountOperatingProfileRevision { platformCode, producerMandates[], handleOrDisplayName, audience, voice, contentPillars, prohibitedTopics, ctaPolicy, cadenceHint, contentLocale, targetMarket }`；`producerMandates` 首版可包含 `FOUNDER_VOICE`、`PRODUCT_EXPERTISE`，同一账号可由 Owner 明确承载两种 mandate；`platformCode` 首版只允许 `X`、`XIAOHONGSHU`。
- `KnowledgeItem { kind, normalizedValue, sourceRevisionIds[], ownerAuthority, sensitivity }`。
- `KnowledgeConflict { itemIds[], reasonCode, ownerResolution, state }`。
- immutable `KnowledgeSnapshot { id, version, state, sourceRevisionDigests[], profileRevisionDigests[], itemBindings[], conflictDecisions[], canonicalDigest, approvedBy, approvedAt }`。

`KnowledgeSnapshot.state` 只允许 `DRAFT | NEEDS_OWNER | APPROVED | SUPERSEDED`。批准以 canonical JSON digest 和当前 `rowVersion` 为条件；任何来源/profile 变化只创建新 Draft，并将旧 Snapshot 保留为可追溯历史。旧 `APPROVED` 在新 Snapshot 批准前仍可读，但 UI 必须显示其不含最新修改；下游任务只能绑定一个明确 Snapshot ID/digest。

### API and migration

- `GET/PATCH /api/local-owner`
- `GET/PUT /api/onboarding/session`，要求 `If-Match`/row version 和 idempotency key。
- `POST /api/knowledge/sources`、`POST /api/knowledge/sources/text`、`GET/DELETE /api/knowledge/sources/:id`
- `PUT /api/profiles/persona|organization|product|accounts/:platform`
- `GET /api/knowledge/snapshots/draft`、`POST /api/knowledge/snapshots/resolve-conflict`、`POST /api/knowledge/snapshots/approve`

迁移必须新建版本表、外键、owner boundary、唯一 idempotency constraint 和 digest constraint；不得原地改写已有 PR #7 source bytes。升级 adapter 将已有 `local_materials` 映射为 `SourceDocumentRevision`，无法可靠推断的通用字段保留为 owner-authored legacy source 并要求 Review，不能自动宣称已批准。

稳定错误码包括 `SOURCE_TYPE_PLANNED`、`SOURCE_INVALID_UTF8`、`SOURCE_TOO_LARGE`、`SOURCE_DIGEST_MISMATCH`、`KNOWLEDGE_CONFLICT_UNRESOLVED`、`SNAPSHOT_STALE`、`SNAPSHOT_APPROVAL_DIGEST_MISMATCH`、`OWNER_BOUNDARY_VIOLATION`。数据库持久化 stable code，不保存翻译 label。

## 6. AgentTeams and Skills

本 SDD 不启动 AgentTeams。它只定义 SDD-009/007 可消费的批准输入：

- Agent 或 Skill 只能读取 `KnowledgeSnapshot(APPROVED)` 的 immutable RoleContext projection；不能读取 Onboarding draft、原始 Blob 路径或浏览器状态。
- Snapshot 对每个 item 保留 source binding；敏感原文默认只投影必要摘录和 digest。
- Agent 观察只能形成后续 `LearningProposal`，不能修改本 SDD 的 Profile、KnowledgeItem 或 Snapshot。
- PR #6 Market resolver 若接入，classification 为 `INTEGRATE` 的非权威 suggestion provider，并标记 source/license/version/expiry。

## 7. Dependencies and reuse decision

| 组件 | 决定 | 版本/来源/许可证 | 边界与替换成本 |
|---|---|---|---|
| PR #7 local ingest/UX | `INTEGRATE` | 收敛时固定 commit；本仓 Apache-2.0 | 复用 Blob/PG/页面骨架；不复制其通用领域模型 |
| PostgreSQL/BlobStore | `INTEGRATE` | 仓库锁定版本/Apache-compatible | PostgreSQL 是真源，BlobStore 只保存 bytes |
| 内置 UTF-8 MD/TXT extraction | `BUILD` | Node 标准能力 | 不引入 parser；未来 extractor 通过 `SourceExtractor` 接口替换 |
| PR #6 Market Pack | `POC-GATED` | 若合并，固定 commit/source manifest | 只产 suggestion；移除不影响 Owner Snapshot |
| PDF/DOCX/audio extractor | `LATER-REPLACE` | 未选择 | 统一返回 `SOURCE_TYPE_PLANNED` |

不引入 Postiz、AGPL 代码、浏览器扩展或未经审查的文档 parser。所有新增依赖需要 license/NOTICE 记录和 lockfile review。

## 8. Failure, recovery, and rollback

- 非 UTF-8、扩展名伪造、超限、空文件、路径穿越、重复 digest 均 fail closed；重复文件可复用 blob 但创建明确 binding，不覆盖来源元数据。
- 上传中断不创建可批准 Revision；孤立 blob 只能由有审计的 GC 处理。
- 并发编辑返回 `SNAPSHOT_STALE` 并展示差异，不 last-write-wins。
- 删除被批准 Snapshot 引用的来源只创建新 Draft；历史 Snapshot 及 digest 保留。
- 冲突、缺失 X/XHS 账号档案、无来源或 digest 不符均阻断批准。
- API/PG 重启后根据 PostgreSQL 恢复 session 与 draft；Blob 缺失进入 `SOURCE_BLOB_MISSING`，不能用提取缓存冒充原文。
- rollback 首选应用 forward-fix；版本回退只读新表并保留数据。迁移前备份和 exact restore 命令必须进入验收报告，禁止 destructive down migration 删除资料。

## 9. Acceptance criteria

- [ ] Fresh local install 只要求显示名称，且没有远端注册网络请求。
- [ ] Owner 分步保存 Persona、Organization/Product、X/XHS Account profiles 和 market/locale/time zone，刷新后保持。
- [ ] 至少导入 2 份 MD、1 份 TXT 和 2 条自由文字，Snapshot 显示全部 source/digest binding。
- [ ] 人为冲突在 Owner 选择前阻断批准，选择后进入 exact-digest approval。
- [ ] 批准后只有 immutable `APPROVED` Snapshot 可供下游读取；编辑产生新 Draft，不覆盖旧版本。
- [ ] PDF、DOCX、audio 均返回本地化 `SOURCE_TYPE_PLANNED`，且不创建 blob/profile 假成功。
- [ ] 跨 owner/source ID、digest tamper、stale ETag 和 secret-shaped 字段均被拒绝并留下脱敏审计。
- [ ] API/PG 重启恢复同一 session、sources 和 Snapshot；无重复 Revision。
- [ ] PR #7 legacy source 的升级演练不丢 bytes/digest，且不会自动 APPROVED。
- [ ] 机器证据包含 migration manifest、API contract results、fixture digests、secret scan 和中英文截图。

## 10. Test plan

- Schema/unit：stable enums、canonicalization、digest、MD/TXT UTF-8、free-text revision、conflict resolution。
- DB/API integration：migration up、legacy adapter、idempotency、ETag、owner isolation、approved/superseded transitions、blob missing。
- Security：MIME/extension mismatch、path traversal、oversize、malformed UTF-8、cross-owner ID、secret-shaped field、log/trace scan。
- Web E2E：zh-CN/en 七步流程、错误/空/恢复状态、刷新续填、无注册网络请求。
- Restart：API 与 PostgreSQL 分别中断/恢复，验证不重复 source/snapshot。
- Agent contract：未批准 Snapshot 无法生成 RoleContext；批准 digest 的 read model deterministic。
- Upgrade/rollback：从固定 PR #7 fixture schema 迁移、备份恢复和旧应用只读行为。

## 11. Evidence and claims

验收报告必须引用 migration list、`RunManifest`、API test JSON、source/snapshot digest manifest、Web E2E screenshots、restart transcript、secret/privacy scan 和 Owner decision。

通过机器验收后允许声明：`ENGINEERING_VERIFIED` 的本地 Onboarding 可把 MD/TXT/自由文字和结构化档案冻结为 Owner 批准、来源可追溯的 KnowledgeSnapshot。不得声称 PDF/DOCX/audio、自动知识学习、客户使用或业务结果。

## 12. Delivery plan

1. 0.5 天：冻结 convergence base、schema/error codes、migration 编号和 PR #7 adapter。
2. 1 天：版本表、Blob/source API、conflict/snapshot policy 与 tests。
3. 0.5–1 天：分步 Web、zh-CN/en、恢复/负测。
4. 0.5 天：upgrade/rollback、Owner UAT、中文验收报告、status handoff。

Critical path 为 PR #7 收敛 → migration → approval policy → UI/UAT。实现首提交才可由 Coordinator 将 `M5-06` 置 `IN_PROGRESS`；机器证据完成为 `EVIDENCE_READY`，Owner 二元决定后才可 `ACCEPTED`。

## 13. Alternatives and decision log

- 拒绝“一次性大 Prompt”：不可逐步审阅、不可版本化、不能定位来源。
- 拒绝“文件即知识”：原始来源、提取文本、Owner 决定和批准 Snapshot 必须分层。
- 拒绝“Market Pack 自动覆盖”：公共建议不具备 Owner authority。
- 拒绝首版向量数据库：MD/TXT 范围可用确定性提取与 source binding 验证，避免引入第二检索真源。
- 若真实资料规模证明线性投影不可用，可用带 source/digest contract 的 `KnowledgeProjectionProvider` 重开检索决策。

## 14. Owner-participated acceptance

Prerequisites：fresh local stack、public-safe A梦 fixture（2 MD、1 TXT、2 free-text）、浏览器 zh-CN；不需要 provider key。

1. 打开本地产品，输入显示名称，确认没有邮箱/密码步骤。
2. 完成 Persona、企业/产品、X/XHS 账号、Market/Locale/Time Zone。
3. 导入 fixture 并检查文件名、来源与 digest；尝试一份 PDF，确认明确显示“首版未支持”。
4. 在冲突页先尝试批准，确认被阻断；选择权威值后批准 exact Snapshot。
5. 刷新并重启 Web/API，确认 Snapshot ID/version/digest 与资料数量不变。
6. 修改一项产品事实，确认产生新 Draft 且旧批准版本仍可查。

Expected：页面进入 `KNOWLEDGE_APPROVED_NEEDS_GOAL`，显示下一步，不创建 Campaign/Goal。Failure signs：远端注册、PDF 假成功、冲突未解决可批准、刷新丢失、旧版本被覆盖或 Secret 字段。Owner 返回截图、Snapshot manifest 和 PASS/FAIL 决定；清理仅停止 stack，保留测试 volume，删除需另获授权。

## 15. Task closeout

- 中文验收报告：`docs/reports/acceptance/SDD-008-ACCEPTANCE.md`。
- Proposed module：`M5-06`；本文只为 `SPEC_READY`，不改变 canonical state。
- 下一可执行 SDD：SDD-009，仅在 SDD-008 达到所需验收门后。
- Closeout 必须报告 Worktree/Branch/Commit、文件、migration、测试、UAT、rollback、proposed state、blocker 和 STATUS_HANDOFF；完成前不得关闭 Goal。
