# SDD-010 — X/XHS Artifact, Independent Audit and Manual PublishPackage

> Status: `SPEC_READY`
> Milestone: `M5`
> Proposed progress module ID: `M5-09`（待 Coordinator 登记；本文不改变 canonical progress）
> Owner: LumiClaw Presence 产品/设计 Owner
> Goal objective: 冻结 X/小红书完整内容、独立审校、Owner revision 决策与安全人工发布包合同
> Target evidence maturity: `ENGINEERING_VERIFIED`
> Acceptance report: `docs/reports/acceptance/SDD-010-ACCEPTANCE.md`
> Last updated: `2026-08-22`

## 1. User problem and outcome

Owner 需要看到和实际发布一致的完整内容，而不是四张模板卡片。每个 selected X 或小红书 ActivationUnit 必须产出结构完整、来源/计划/账号绑定明确的 revision，经与 Producer 分离的 Auditor 审校。Owner 可以修改、要求重生成、批准或拒绝 exact revision；只有有效 Audit PASS 与 exact approval 才能生成可复制/下载/打开官方页的人工发布包。

本轮坚持 manual-only：打开官方页不传内容、不自动上传/点击/发布；复制、下载、打开页面或 Owner 自报都不能生成 `PUBLISHED`。

## 2. Current state

- M2 有 immutable artifact revision、独立 Auditor、review/trace/ledger 合同，但 schema 固定四平台且输入为 fixture。
- PR #7 有 Publish/Knowledge/AI Team 页面和 review export，但内容来自初始化模板，AI Team 为 `NOT_CONFIGURED`。
- PR #5 / SDD-004 CR1 有六平台注册表、exact digest、ordered media、allowlisted official-page、manual package 和无 `PUBLISHED` 状态等可复用安全合同；它仍是独立纯函数/Story，没有 PG/API、真实 Audit/OwnerDecision、X/XHS 完整 ArtifactProfile。
- 当前没有 Owner edit/regenerate 的 revision invalidation 规则，也没有 X thread 与小红书图片规格的稳定 schema。

## 3. Scope

### In scope

- 版本化 X 与小红书 `ArtifactProfile` 和 platform Skill contracts。
- Producer submission 的 schema/digest/source/goal/account validation 与 immutable `ArtifactRevision`。
- X 单帖/Thread 包；小红书标题、正文、话题、封面与有序配图规格。
- Independent Auditor `PASS | FAIL | ESCALATE`，检查来源、claim、目标、账号语气、平台约束和敏感风险。
- Owner edit、regenerate request、approve/reject；任何内容变化创建新 Revision 并使旧 Audit/Decision/Package 失效。
- exact-digest `ManualPublishPackage`：复制文本、下载包、打开 allowlisted 官方发布页。
- PostgreSQL/API/Web 预览、diff、trace、审校和 package manifest。

### Out of scope

- AgentTeams runtime/model dispatch；由 SDD-007 执行本规格的 Skill/Artifact contracts。
- 任何平台 API 写入、OAuth、Cookie、浏览器自动化、图片生成、图片上传或发布回读。
- 把 Owner 自报、复制或打开页面变成 published receipt。
- Bluesky、LinkedIn 或其他平台产物。

### Existing behavior that must not change

- Producer 与 Auditor 分离；Auditor 不改稿、不批准、不生成 package。
- 已接受 revision append-only；accepted digest 不可被 UI 编辑覆盖。
- PR #5 的 exact digest、ordered media、allowlist 和无 `PUBLISHED` 原则。
- 私有资料不进入下载包之外的公开 Evidence；Secret 永远不进入 artifact/package。

## 4. User journey and UI states

1. Owner 从计划/本次内容进入 artifact workspace，按 selected platform/账号查看完整内容和 input trace。
2. Producer 任务运行时显示 `GENERATING`；schema 校验失败显示 `QUARANTINED` 和稳定原因，不渲染半成品为可批准内容。
3. Artifact revision 完成后进入 `AWAITING_AUDIT`；Auditor PASS 才进入 `OWNER_REVIEW`，FAIL/ESCALATE 显示逐项 findings 和恢复动作。
4. Owner 可：直接编辑并保存新 revision、填写原因要求重生成、批准 exact revision、拒绝。编辑后必须再次独立 Audit。
5. exact approval 后生成 package。X 显示复制单帖/逐帖、下载；小红书显示复制标题/正文/话题、下载 image specs；两者可打开官方发布页。
6. 打开官方页后 UI 仍显示 `UNVERIFIED_EXTERNAL_STATE`，明确提示用户在平台手工完成；当前没有“已发布”按钮。

状态包括 `GENERATING | QUARANTINED | AWAITING_AUDIT | AUDIT_FAILED | AUDIT_ESCALATED | OWNER_REVIEW | APPROVED | REJECTED | INVALIDATED`；Package `READY | INVALIDATED | EXPORTED`，其中 `EXPORTED` 只描述本地下载/复制事件，不表示发布。刷新或重启恢复 exact revision/audit/decision/package。

## 5. Domain and API contracts

### Artifact profiles

- `ArtifactProfileRef { id, version, digest, platformCode }` 固定进 Bundle/SkillLock。
- X v1：`mode: SINGLE | THREAD`、`posts[] { position, text, mediaRefs[], altText? }`、`link?`、`cta?`、`language`、`accountProfileRevisionId`、`sourceBindings[]`。Thread position 连续且不可重复。
- XHS v1：`title`、`body`、`topics[]`、`coverSpec`、`imageSpecs[] { position, purpose, aspectRatio, visualBrief, overlayCopy?, altDescription? }`、`cta?`、`language`、`accountProfileRevisionId`、`sourceBindings[]`。
- 平台长度/数量等约束来自 versioned contract 和来源 manifest；不得把易变限制硬写成无来源的“法律事实”。约束过期时进入 `PLATFORM_CONSTRAINT_STALE`，要求 review。

### Revision, audit and owner decision

- immutable `ArtifactRevision { id, activationUnitId, producerRole, artifactProfileRef, payload, inputBindings, canonicalDigest, parentRevisionId?, origin: AGENT|OWNER_EDIT, state }`。
- `RegenerationRequest { id, artifactRevisionId, reason, requestedBy, requestedAt, state }`；只创建新任务请求，不原地修改旧 submission。
- immutable `AuditDecision { artifactRevisionId/digest, auditorRole, result, findings[], evidenceBindings[], policyVersion, canonicalDigest }`。
- immutable `OwnerDecision { artifactRevisionId/digest, auditDecisionId/digest, result: APPROVE|REJECT, ownerId, reason?, decidedAt, canonicalDigest }`。
- `PASS` 只是 Owner approve 的必要条件，不是充分条件；`FAIL/ESCALATE` 禁止批准和 package。
- 新 revision、profile/skill/knowledge/goal/account binding 失效时，旧 Audit/Decision/Package 进入 `INVALIDATED` 并保留历史。

### Manual publish package

`ManualPublishPackage { id, platformCode, accountProfileRevisionId, artifactRevisionId/digest, auditDecisionId/digest, ownerDecisionId/digest, orderedFiles[], officialPublishUrlRef, manifestDigest, state }`。

- X 包：`manifest.json`、`content.md`、单帖或按顺序 `post-01.txt...`、媒体引用/alt text manifest。
- XHS 包：`manifest.json`、`title.txt`、`body.md`、`topics.txt`、`image-specs.json`，以及已有且获授权的本地 media refs；首版不生成图片。
- `COPY_TEXT`、`DOWNLOAD_PACKAGE`、`OPEN_OFFICIAL_PUBLISH_PAGE` 为本地 helper events；它们不改变 artifact approval，不创建 receipt，不写 `PUBLISHED`。
- Official URL 必须 HTTPS、platform-specific、version/source/checkedAt/expiry 有记录；内容、账号 Secret、tracking token 和本地路径不得放入 query/hash。

### API and migrations

- `GET /api/artifacts/:id`、`POST /api/artifacts/:id/edit`、`POST /api/artifacts/:id/regenerate`
- `POST /api/artifacts/:id/audits`（仅 Auditor task identity）、`POST /api/artifacts/:id/owner-decisions`
- `POST/GET /api/manual-publish-packages`、`POST /api/manual-publish-packages/:id/copy-event|download-event|open-official`
- 不得提供 `mark-published`、`reported-complete` 或等价 endpoint。

迁移必须建立 immutable revisions/audits/decisions/packages、invalidation links、ordered file entries 和唯一 exact-input constraint。mutation 需要 owner/task authority、idempotency、If-Match/exact digest。稳定错误码包括 `ARTIFACT_SCHEMA_INVALID`、`ARTIFACT_INPUT_MISMATCH`、`ARTIFACT_PROFILE_UNSUPPORTED`、`AUDITOR_INDEPENDENCE_REQUIRED`、`AUDIT_PASS_REQUIRED`、`OWNER_DECISION_STALE`、`PACKAGE_INPUT_INVALIDATED`、`OFFICIAL_URL_NOT_ALLOWLISTED`、`EXTERNAL_PUBLISH_UNVERIFIED`。

## 6. AgentTeams and Skills

- `x-content-expression@1`：消费 Founder/Product mandate、Goal/Plan/Claim/Knowledge projections，输出 X v1 schema；无 browser/network/publish tool。
- `xiaohongshu-content-expression@1`：输出 XHS v1 schema与配图规格；无图片生成/上传工具。
- `artifact-independent-audit@1`：只读 inputs/artifact，输出 findings/decision；不能调用 Producer Skill 或写 artifact。
- 每个 Skill 用 source、license、version、digest 固定在 `SkillLock`；共享 Skill 更新需独立 SkillChangeProposal、回归测试和 maintainer approval。
- Producer 只能提交分配给自己的 selected units；Auditor task identity 必须与 Producer 不同。Leader 只能推进 DAG。
- Owner edit 标为 `origin=OWNER_EDIT`，仍需 Auditor；Owner approve 是人类 gate。Package builder 是 deterministic operator，不是 Agent。

## 7. Dependencies and reuse decision

| 组件 | 决定 | 版本/来源/许可证 | 边界 |
|---|---|---|---|
| PR #5 package safety | `INTEGRATE` | 收敛时固定 commit / Apache-2.0 | 复用 digest/order/allowlist/no-published；接入 PG/API |
| M2 revision/audit/trace | `INTEGRATE` | accepted commit / Apache-2.0 | 复用 append-only与角色分离，替换 fixed-four schema |
| X/XHS Artifact/Skill contracts | `BUILD` | 本仓 Apache-2.0 | 纯 schema + validation；由 SDD-007 runtime 调用 |
| ZIP/archive generation | `BUILD` 或现有依赖 `INTEGRATE` | 实现前固定 license/version | 只读取 package manifest；可替换为目录下载 |
| Platform official URL registry | `BUILD` | 来源登记于 source register | 不含 credentials/automation |
| Postiz/平台 SDK/图片生成 | `LATER-REPLACE` | 未选择 | 当前不依赖；Postiz 保持 POC-GATED |

任何新增 archive/validation library必须通过 Apache-2 dependency policy 和 NOTICE review；不复制 X/小红书或竞品代码。

## 8. Failure, recovery, and rollback

- 非 selected platform、错误 producer/account、schema/length/order/source digest 不符的 submission 进入 quarantine，不能进入 Owner review。
- Auditor 与 Producer identity 相同、缺证据或 policy stale 时 fail closed。
- Owner 并发 edit/approve 返回 stale；旧 revision 不被覆盖。regenerate 超时保留 request，可由 SDD-007 重试。
- 下载构建失败不撤销 approval；package 保持可重试 `READY`。manifest/file digest 不符则 package invalidated。
- official URL 过期、非 HTTPS、host/path 不在 allowlist 时禁止打开，不回退到搜索或任意 URL。
- Web/API/PG 重启后从版本表恢复。copy/download/open event 幂等且只作审计；不会升级外部状态。
- rollback 可关闭新 artifact workspace 并保留所有 append-only data；不得 down migration 删除 accepted revision/audit/decision/package。

## 9. Acceptance criteria

- [ ] X SINGLE 与 THREAD 均通过 schema；Thread 顺序、每帖正文、媒体/alt text 可完整预览与下载。
- [ ] 小红书完整显示标题、正文、话题、封面/有序配图规格和 CTA。
- [ ] 只有 selected platform/account 可接收 Producer submission；错误绑定被 quarantine。
- [ ] Producer 与 Auditor identity 分离；FAIL/ESCALATE 无法 approve/package。
- [ ] Owner edit 和 regenerate 都产生新 revision；旧 Audit/Decision/Package 自动失效且可查。
- [ ] exact PASS + Owner APPROVE 才能生成 package；digest tamper、stale decision 被拒绝。
- [ ] X/XHS 包的文件名、顺序和 manifest digest deterministic；不含 Secret/private blob path。
- [ ] official page helper 只打开有来源的 HTTPS allowlist URL，URL 不包含内容或 Secret。
- [ ] 复制、下载、打开页、自报或重启均不产生 `PUBLISHED`；API schema 不存在该 mutation。
- [ ] machine evidence 包含 artifact golden、audit independence、invalidation matrix、package manifest 和 Web UAT screenshots。

## 10. Test plan

- Schema/golden：X single/thread、XHS title/body/topics/image order、canonical digest、locale content。
- Policy integration：selected account、producer identity、audit PASS/FAIL/ESCALATE、Owner stale edit/approve、regeneration lineage。
- Package unit/integration：ordered files、ZIP/directory manifest、copy/download/open events、allowlist expiry/HTTPS/query stripping。
- Negative/property：mutation/tamper、duplicate positions、oversize/stale constraint、unbound source、cross-owner/account、auditor=producer。
- DB/API：migration、idempotency、append-only、invalidation propagation、restart。
- Web E2E zh-CN/en：full preview、diff、trace、audit findings、edit/regenerate/approve/reject、download/open blocked。
- Runtime contract：用 controlled task submissions 验证 Skill/Artifact schema；真实 Agent run 留给 SDD-007/011。
- Secret/privacy/license scan：package、URL、logs、fixtures、lockfile/NOTICE。

## 11. Evidence and claims

证据包括 ArtifactProfile/SkillLock manifest、X/XHS golden artifacts、revision lineage、Audit/OwnerDecision digests、manual package manifest、allowlist source/expiry、API/Web test、restart transcript、secret scan 和 Owner PASS/FAIL。

通过后可声明：`ENGINEERING_VERIFIED` 的 X/小红书内容 revision 能独立审校、由 Owner 精确批准并导出安全人工发布包。不得声明真实 Agent 已生成（直至 SDD-007/011）、图片已生成、内容已在平台发布、自动发布或外部业务结果。

## 12. Delivery plan

1. 0.5 天：收敛 PR #5 与 M2 revision/audit contracts，冻结 X/XHS profile/Skill schema。
2. 1 天：migrations、repository/API、audit/decision/invalidation/package builder tests。
3. 0.5–1 天：Web artifact workspace、diff/trace/manual helpers、zh-CN/en。
4. 0.5 天：restart/security/license/Owner UAT、验收报告。

Critical path：SDD-009 Bundle contract → Artifact/Skill schema → audit/decision → package/UAT。`M5-09` 状态只由 Coordinator 在 canonical progress 中改变。

## 13. Alternatives and decision log

- 拒绝通用 `text + media[]` schema：不能保证 X Thread 和小红书图片规格可审阅/导出。
- 拒绝 Producer 自审：违反独立治理边界。
- 拒绝 Owner 直接改 accepted row：必须新 revision、重审和重新批准。
- 拒绝“我已发布”按钮：无原生可复核 evidence，只能保持 unknown/unverified。
- 拒绝首版自动发布与图片生成：扩大 Secret、授权、平台政策和 license 风险；人工包已满足当前用户结果。

## 14. Owner-participated acceptance

Prerequisites：SDD-009 public-safe X+XHS Bundle；controlled producer/auditor outputs；无需 provider key 或真实平台登录。

1. 查看 X Thread 和小红书产物，逐项核对完整正文、来源、账号、计划和配图顺序。
2. 让 Auditor 对一处无依据 claim 返回 FAIL，确认 approve/package 均被阻断。
3. 修订内容并重新审校，确认旧 revision/audit 保留，新 revision PASS。
4. 批准 exact revision，复制文本、下载 X/XHS package，核对 manifest/file digest。
5. 打开官方页，确认只有 allowlisted HTTPS 页面且 URL 无正文；返回产品后状态仍 `UNVERIFIED_EXTERNAL_STATE`。
6. 尝试过期 decision 和篡改 package，确认 fail closed；重启后检查 lineage 不变。

Expected：完整内容可审阅/修改/重生成/批准并安全交接人工发布。Failure signs：FAIL 仍能批准、编辑覆盖历史、未选平台有 package、打开页变 PUBLISHED、URL 携带内容。Owner 返回 screenshots、两个 package manifests、revision lineage、PASS/FAIL；测试下载包可手动删除，数据库历史保留。

## 15. Task closeout

- 中文验收报告：`docs/reports/acceptance/SDD-010-ACCEPTANCE.md`。
- Proposed module：`M5-09`；当前只有 spec `SPEC_READY`。
- 下游：SDD-007 使用冻结 Skill/Artifact contracts 接真实 AgentTeams；SDD-011 做全链录屏。
- Closeout 必须报告 Worktree/Branch/Commit、changed files、migration、tests、evidence、UAT、rollback、license、proposed state、blockers 和 STATUS_HANDOFF；Goal 最后完成。
