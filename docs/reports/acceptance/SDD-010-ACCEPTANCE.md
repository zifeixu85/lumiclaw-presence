# SDD-010 X/小红书产物、独立审校与人工发布包验收报告

- SDD：`SDD-010-X-XHS-ARTIFACT-AUDIT-MANUAL-PUBLISH-PACKAGE`
- Objective：冻结 X/小红书完整内容、独立审校、Owner exact-revision 决策与安全人工发布包合同
- Worktree：Coordinator 管理的 SDD-010 唯一专用 checkout；本地绝对路径不进入 public evidence
- Branch：`codex/sdd-010-x-xhs-artifact-audit-manual-publish-package`
- Exact authorized base：`903c92290ffc496dd067f44f53139c43f747b2fb`
- Proposed module state：`M5-09 = EVIDENCE_READY`，仅供 Coordinator 独立核验
- Owner UAT：`PENDING`
- 证据分类：`PUBLIC_SAFE_SYNTHETIC`
- 当前可声明成熟度：`IMPLEMENTED`、`ENGINEERING_VERIFIED`

## 一、交付结果

本 SDD 已把 SDD-009 selected X/小红书 ActivationUnit 转成完整、可编辑、可独立审校、可由 Owner 精确决定并导出确定性人工发布包的生产 Web/API/PostgreSQL 链路。

X 支持 `SINGLE` 与 `THREAD`，包含完整正文、连续帖子顺序、CTA/link、来源、账号以及 owner-authorized media/alt text 合同。小红书包含标题、正文、话题、CTA、封面规格与连续有序配图规格；当前没有真实媒体时，UI 和 package 明确写为“仅规格、未生成图片”。Producer submission 锁定 exact Bundle/Goal/Plan/Knowledge/Account/Skill/Profile/source digests，所有错误绑定、平台、账号、Producer、来源、长度或顺序均 quarantine 或 fail closed。

Producer 与 `independent-auditor` 是不同身份。Audit 必须为每个必需检查提供 finding，`FAIL`/`ESCALATE` 不能批准。Owner edit 追加不可变新 Revision 并使旧 Audit/Decision/Package 派生为 `INVALIDATED`；regenerate 只追加 `RegenerationRequest`，不会伪装模型已经运行。只有 exact Audit PASS 与 exact Owner APPROVE 才能创建 ManualPublishPackage。

复制、下载和打开官方页只追加本地 `EXPORTED / UNVERIFIED_EXTERNAL_STATE` helper event。无 `mark-published`、`reported-complete`、发布成功 mutation 或 `PUBLISHED` 状态升级。AgentTeams 和模型均未运行，真实 runtime authority 在本 API 中稳定拒绝，Owner UAT 尚未完成，因此不得标为 `ACCEPTED`。

## 二、交付范围

| 层 | 已实现 | 安全边界 |
|---|---|---|
| Domain | `lumiclaw.artifact-publish.v3`、X/XHS payload、Artifact/Profile/Skill/Audit/OwnerDecision/Package 合同、validators、stable errors、deterministic digests | Runtime 类型为后续预留；当前 API 只接受显著标注的 controlled fixture |
| Skills | `x-content-expression@1.0.0`、`xiaohongshu-content-expression@1.0.0`、`artifact-independent-audit@1.0.0`，文件 SHA-256 进入 Skill ref | Apache-2.0，本仓原创；Producer/Auditor 权限分离，无浏览器/发布能力 |
| PostgreSQL | migration 13，11 个 owner-scoped authority/head/idempotency/invalidation/package/file/event 表，audit/decision/package 的 6 个 exact-lineage 复合外键，append-only trigger，安全 down | accepted history 不可 UPDATE/DELETE；数据库层阻断 cross-revision 拼接；有数据 down 要求 export 与 Owner destructive decision |
| Repository | Memory 与 PostgreSQL parity，并在 authority 边界重算 Audit/OwnerDecision/Package 合同、canonical digest 与完整 lineage；If-Match/exact digest、idempotency、same-key 与 exact-package advisory lock、restart replay | 上层 typed object 不被信任；stale revision/audit/decision/package、重复 finding、tamper 与并发 unique collision 全部 fail closed |
| API/OpenAPI | Artifact create/import/read/edit/regenerate/audit/decision；package create/read/download/helper；OpenAPI `0.6.0-sdd010` | 不提供发布成功 mutation；invalidated package 可查历史但不能下载、复制或打开 |
| Web | 真实 Publish Center：完整预览、Revision diff、exact input trace、findings、edit/regenerate/approve/reject、package 文件与 helpers | `zh-CN` 默认、`en` parity；SaaS Shell/tokens/primitives；1024 desktop gate |
| Evidence/CI | deterministic golden、fresh Compose/PostgreSQL、Chromium/keyboard/axe、restart/down、dependency/license/SBOM、public-safe screenshots；专项 CI job | 不使用真实账号、Secret、Cookie、客户资料、模型或外部 publish action |

未修改 `IMPLEMENTATION-STATUS.md`、`ROADMAP.md` 或 `ARCHITECTURE.md`，未修改内部私有仓库，未创建第二 worktree，未 merge main。

## 三、实现证据

权威 public-safe machine evidence 位于 `docs/reports/evidence/sdd-010/`：

- `golden-contracts.json`：X SINGLE、X THREAD、小红书 IMAGE_NOTE 三个 deterministic 场景；revision/audit/decision/exact-input/manifest/Skill/Profile digests 与 ordered files。X SINGLE manifest digest 为 `d0ce48791a0da014e6d7b95d28289436721f36c56a62a34233fd594ca750c3ea`，THREAD 为 `4e265bb6a64396cf7460c2f70c9a99a4be258b7e0e0a3f89969699b610f45ffc`，XHS 为 `8fbacc73b38e4d227f5fa2c6ed5d46a9885cb2b3d20fbf1016e3d735b79ea59d`。
- `browser-verification.json`：22 个 Chromium 检查全为 true，覆盖 selected units、X Thread、XHS 完整规格、diff、trace、七项 findings、FAIL 阻断、PASS/APPROVE/package、regenerate/reject、copy/download/open、zh-CN/en、键盘、1024 无溢出、800 desktop gate；console error 0，serious/critical axe violation 0。
- `compose-verification.json`：17 个检查全为 true，覆盖 fresh stack、migration 13、empty/populated down、append-only、repository authority negative matrix、same-key 与 exact-package 并发、复合血缘外键、stale audit、restart、owner boundary、OpenAPI 无发布成功 mutation、PostgreSQL down 503。
- `repository-authority-results.json`：fresh isolated PostgreSQL 中 1 个真实 repository regression test 通过；3 revisions、3 audits、2 decisions、1 package、4 files、10 idempotency rows、6 个 lineage foreign keys。覆盖 malformed/重复 Audit finding、policy/canonical/result 重算、FAIL 不可批准、repository 与数据库双层 cross-revision 阻断、same-key 并发/重启 replay，以及不同 Idempotency-Key 的同一 exact package one-created/one-replayed，无裸 unique violation。
- `migration-manifest.json`：专项 journey 形成 5 revisions、4 audits、3 decisions、1 regeneration request、2 packages、11 files、3 helper events、2 invalidations；随后并发测试再追加 1 个胜出的 revision。
- `api-contract-results.json`：并发 `201 / 412` one-winner、stale audit `412`、owner header override ignored、无发布成功 mutation。
- `restart-transcript.json`：API restart 与 PostgreSQL+API restart 前后最后 Revision digest、两个 package manifest digests 和行数完全一致。
- `platform-source-review.json`：X 官方 Help 当前可读；X compose 未登录返回 403 边界；小红书官方 creator entry 当前 HTTPS 200。未保存 response Cookie。账号字段/counter 仍明确要求 Owner capability probe。
- `DEPENDENCY-LICENSE-REVIEW.md`：无新增 npm/archive 依赖、生产 audit 0、既有 Storybook dev-only advisory、Apache-2.0 Skill 来源与 SBOM 结果。
- `run-manifest.json`：核心 evidence 文件大小与 SHA-256、base/branch、fixture/AgentTeams/model/external-action/Owner-UAT 声明。
- `01-x-thread-review-zh.png` 至 `07-desktop-gate.png`：8 张 production UI public-safe 截图，另含 `06-regenerate-reject-zh.png`。

Package builder 使用 deterministic JSON/directory-file response，没有引入 ZIP 依赖。Secret/private-path scanner 与 package validator拒绝 `file://`、本地用户路径、private key、API key/token/password/cookie/secret 形态；仅 owner-authorized local media digest/file name/type/alt text 可进入引用，不包含原始文件或绝对路径。

## 四、自动化验证

| 命令 | 结果 |
|---|---|
| `npm run evidence:sdd010:golden` | PASS：3 个 deterministic Artifact/Package golden 场景 |
| `npx vitest run packages/domain/src/artifact-publish.test.ts apps/api/src/artifact-publish-api.test.ts apps/api/src/artifact-publish-memory-authority.test.ts apps/api/src/artifact-publish-postgres-authority.test.ts --configLoader=runner` | PASS：3 files passed / 1 PostgreSQL-connected file skipped，36 passed / 1 skipped；含 exact binding、closed JSON、重复 finding、Memory repository authority 与 same-key replay |
| `npm run verify:sdd010:compose` | PASS：17 Compose/PostgreSQL checks、22 Chromium checks、8 screenshots；fresh isolated PostgreSQL 中 connected repository test 1/1 PASS |
| `SDD009_SKIP_BUILD=1 SDD009_EVIDENCE_ROOT=.evidence/sdd-009-p1-final npm run verify:sdd009:compose` | PASS：22 Compose checks、30 Chromium checks、8 screenshots；migration 13 后的 SDD-009 rollback compatibility 已复验 |
| `npm run verify:sdd010:dependencies` | PASS：1,020 packages、710 CycloneDX components、disallowed licenses 0 |
| `npm audit --omit=dev --audit-level=high --json` | PASS：0 total/high/critical |
| `npm audit --audit-level=high --json` | REVIEWED：3 个既有 Storybook dev-only high entries，`fixAvailable=false`；production 0 |
| `npm run lint` | PASS：0 errors、0 warnings |
| `npm run typecheck` | PASS：13 个 workspace 的 TypeScript 检查通过 |
| `npm test` | PASS：48 passed / 2 skipped test files；444 passed / 2 skipped tests；两个 skipped 均为需要专项 fresh PostgreSQL URL 的 connected regression，并已在对应 Compose gate 中真实通过 |
| `npm run check:messages` | PASS：`zh-CN` / `en` 共 967 keys 完全一致 |
| `npm run check:status` | PASS：47 modules；canonical progress 未修改 |
| `npm run check:secrets` | PASS：扫描 510 个受版本控制或待提交文件，无 Secret 命中 |
| `npm run build` | PASS：全部 runtime packages 与 Next.js production build 通过 |
| `npm run storybook:build` | PASS：Storybook production build 与 browser-safety gate 通过 |
| `npm run verify` | PASS：static、tests、reports、secrets、Compose policy、dependency/SBOM、production build 与 Storybook 全链路通过 |

`.github/workflows/ci.yml` 已新增独立 `sdd010-artifact-audit-package` job：固定 Node/npm、安装 exact Chromium、重生成 golden 并检查 Git diff、运行 fresh PostgreSQL/append-only/rollback/restart/Chromium gate、上传 public-safe JSON/PNG evidence。Draft PR 的远端 CI 结果由 Coordinator/PR checks 独立核验，不能用本地结果代替。

## 五、验收标准结果

| AC | 结果 | 证据与说明 |
|---|---|---|
| AC-01 | PASS | X SINGLE/THREAD schema、连续 position、逐帖完整正文、CTA/link、媒体/alt 合同与 deterministic package golden 均覆盖。 |
| AC-02 | PASS | XHS title/body/topics/CTA/cover/连续 image specs 完整预览与导出；界面和 JSON 都标记 `generatedMedia=false`/无媒体文件。 |
| AC-03 | PASS | 只接受 SDD-009 selected platform/account/unit；platform/account/Producer/source/source digest/Bundle/Goal/Plan/Knowledge/Skill/Profile negative matrix 被 quarantine/fail closed。 |
| AC-04 | PASS | Producer/Auditor identity 不同；权威 audit 必须恰好七项且 `checkCode` 唯一，七个 required code 各一次；“七项完整再重复一项”的八项输入在 Domain/API/Memory/PostgreSQL 全部拒绝。PASS/FAIL/ESCALATE 派生一致，FAIL/ESCALATE 不能 approve/package。 |
| AC-05 | PASS | Owner edit 追加 parent-linked Revision 并触发旧链 invalidation；regenerate 追加 immutable request；reject 阻断 package。 |
| AC-06 | PASS | exact PASS + exact APPROVE 是 package 必要条件；stale audit/decision、digest/file tamper、invalidated package 下载/helper 全部拒绝。 |
| AC-07 | PASS | X/XHS 文件名、position、file digest、manifest digest deterministic；Secret/private path 排除；无 archive dependency。 |
| AC-08 | PASS | Official helper 只返回 query/hash stripped、platform-specific HTTPS allowlist；source/version/checkedAt/expiry 有记录，过期稳定返回 `PLATFORM_CONSTRAINT_STALE`。 |
| AC-09 | PASS | COPY/DOWNLOAD/OPEN/restart 都保持 `EXPORTED / UNVERIFIED_EXTERNAL_STATE`；OpenAPI 无 mark-published/reported-complete/PUBLISHED mutation。 |
| AC-10 | PASS | fresh PostgreSQL migration、6 个 composite lineage FKs、append-only、owner isolation、If-Match、idempotency、same-key concurrency/restart replay、不同 key exact-package concurrency、down、tamper 与 PG unavailable 全部有重复门禁；无裸 unique violation。 |
| AC-11 | PASS | zh-CN/en production UI 覆盖完整内容/diff/trace/audit/edit/regenerate/approve/reject/package/blocked states、keyboard/focus、axe 与 desktop gate。 |
| AC-12 | PENDING | Owner 参与 UAT 尚未执行；工程证据只支持 `EVIDENCE_READY`，Coordinator/Owner 决定前不得标为 `ACCEPTED`。 |

## 六、Owner 参与验收

状态：`PENDING`。以下步骤必须由 Owner 使用 public-safe SDD-009 approved X+XHS Execution 执行并返回明确 PASS/FAIL；不需要 provider key、OAuth、Cookie 或真实平台登录。

1. 执行 `npm ci`、`npm run evidence:sdd010:golden`、`npm run verify:sdd010:compose`。预期输出 17 Compose/22 browser checks 全部 PASS、8 张截图，并看到 fresh PostgreSQL repository regression 1/1 PASS；任一 false、migration/lineage/concurrency/axe/console/health 失败即停止。
2. 在默认 zh-CN 的「发布中心」逐一打开三个 selected ActivationUnit。预期只显示 X/小红书与绑定账号；未选 Bluesky/LinkedIn 不出现。
3. 打开 X THREAD，逐帖核对正文、position、CTA、source/account/Bundle/Goal/Plan/Knowledge/Skill/Profile trace。切换 SINGLE 建立另一个 public-safe scenario，确认只有一帖。
4. 编辑第一帖并保存。预期产生新 Revision、显示 previous/current diff，旧 Audit/Decision/Package 保留历史但失效；旧 package 可读 `INVALIDATED`，不能下载/复制/打开。
5. 在小红书 Revision 检查 title/body/topics/CTA、3:4 cover 与有序 image specs。预期每张写“仅规格、没有媒体文件”，不得出现伪造图片。
6. 记录 FAIL 或 ESCALATE。预期七项 findings 可见，approve 与 package 阻断。新建 Revision 后记录 PASS，再执行 APPROVE，预期 package ready。
7. 对第三个 unit 填写 regenerate 原因并创建请求。预期只显示 `WAITING_FOR_SDD_007_RUNTIME`，无 AgentTeams/model run。对 PASS revision 执行 REJECT，预期 package 继续阻断。
8. 下载 X/XHS package，逐一核对 manifest、ordered files 与 SHA-256。执行复制、下载、打开官方页；预期官方 URL 无正文/query/hash，产品状态始终 `UNVERIFIED_EXTERNAL_STATE`，不存在“已发布”按钮。
9. 刷新页面、重启 API、重启 PostgreSQL+API。预期 Revision/Audit/Decision/Package ID/digest 和 lineage 不变。并发提交两个 exact Owner edit，预期一个 201、一个 412。
10. 切换 en，核对同一完整内容与门禁语义；仅 stable code/digest 作为次级技术信息。键盘遍历关键控件，在 1440×1000、1024×900 与 800×900 检查焦点、无遮挡、desktop gate 和无横向溢出。

失败标志：FAIL/ESCALATE 仍可批准；编辑覆盖旧 row；旧 package 仍可执行 helper；未选平台出现产物；图片规格被显示为已生成媒体；fixture 被声称为 AgentTeams/model 结果；复制/下载/open 产生 `PUBLISHED`；URL 携带内容或 Secret；重启后 digest 变化。

Owner 返回：步骤 3/4/5/6/7/8/9/10 的截图、两个 package manifests、revision lineage、核心 SHA-256，以及明确 `PASS` 或 `FAIL` 与备注。测试下载文件可删除；PostgreSQL append-only 历史保留。

## 七、ChatGPT Pro 双代理记录

本 SDD 未授权、未调用 ChatGPT Pro，也未接收外部工程师补丁。所有实现、来源核对与验证均在唯一授权 worktree 内完成；因此无外部代码需要隔离应用。没有使用子代理。

## 八、失败、限制与非声明

Known limitations：

- 本 SDD 不调模型、不运行 AgentTeams；Producer/Auditor 均为显著标注的受控 public-safe fixture。真实 AgentTeams runtime 留给 SDD-007。
- 不实现 OAuth、平台 API 写入、Cookie/DOM 自动化、图片生成/上传/点击发布/回读，也不把人工自报升级为发布结果。
- 小红书 title/body/topic 的当前账号 composer 上限没有被声明为稳定官方硬限制；schema 的 120/20,000/30 是项目内部防滥用 envelope，最终发布前仍需 Owner 在 active composer capability probe。
- X 采用 regular-post 280 weighted envelope；Premium long post 不在本 ArtifactProfile。当前 weighted validator覆盖 URL 固定权重与项目所需 Unicode envelope，但不声明替代官方客户端的最终 counter。
- Official URL 和易变平台约束有短期 expiry；expiry 后必须 review，不能静默继续。
- full npm audit 的 3 个 high advisory 位于既有 Storybook dev-only 图片解析链，production audit 为 0，当前无可用升级修复；上游兼容修复发布后应独立升级。
- Owner UAT、真实外部用户校准和业务结果均为 `PENDING`；无 `EXTERNAL_CALIBRATED`、`BUSINESS_VERIFIED`、production-ready 或法律合规保证。

实现与门禁过程中发现并关闭：migration constraint 名冲突、approved Knowledge 无 legacy Campaign 时发布中心误阻断、fixture stamp 与 XHS image position 对比度、异步 UI 检查竞态、旧 invalidated package 直接下载缺口、未授权 runtime 成熟度伪报风险、OpenAPI gate 错路径导致的专项脚本假阳性，以及 migration 13 加入后 SDD-009 rollback gate 仍只回滚单条 migration 的兼容缺口。Coordinator 合并前 P1 复验进一步关闭了 repository 信任上层 typed object、migration 独立外键可 cross-revision 拼接、嵌套 JSON 可能触发 500、七项 finding 外再重复一项仍被接受、same-key 并发裸 unique violation，以及不同 Idempotency-Key 并发 exact package 撞 unique 的边界。最终 SDD-010 machine evidence 的全部布尔检查均为 true，SDD-009 完整兼容门禁也重新通过。

## 九、回滚与恢复

Rollback 原则：先停止新 Artifact 写入与 helper actions，导出权威数据，保留 append-only 历史，再由 Owner 决定是否隐藏新 UI/API。不得为了回滚应用而删除 accepted Revision/Audit/Decision/Package。

1. 隐藏 Publish Center 的 Artifact workbench 入口，并禁用 `/api/v1/artifacts*`、`/api/v1/artifact-submissions*`、`/api/v1/manual-publish-packages*` mutation；保留只读历史和 SDD-009 Goal/Plan/Bundle。
2. 使用 `pg_dump` 导出 migration 13 的 11 个表，记录 PostgreSQL version、表行数与备份 SHA-256；验证可恢复后取得明确 Owner destructive decision。
3. 空数据库上 `migrate:down` 已 PASS；有任一 accepted authority row 时 down 稳定失败：`SDD010_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED`。
4. authority row 的 UPDATE/DELETE 稳定失败：`SDD010_APPEND_ONLY_AUTHORITY`。修正只能追加 Revision、Decision 或 Invalidation event。
5. 如只回滚应用代码，保留 migration 13 和数据；恢复本分支后 Memory/PostgreSQL read model 会重新派生 exact state。平台规则过期时保持 `PLATFORM_CONSTRAINT_STALE`，不得绕过。

## 十、执行任务状态交接

- Objective：实现、专项工程验证和 public acceptance evidence 已完成；Goal 在 commit/push/Draft PR/STATUS_HANDOFF 前保持 active。
- Worktree/Branch/Base：见报告顶部；唯一 worktree，无 main merge。
- 用户可见结果：X SINGLE/THREAD、小红书完整内容与配图规格、diff/trace/findings、Owner edit/regenerate/approve/reject、deterministic package、copy/download/open blocked/ready states、zh-CN/en。
- 数据状态：migration 13、append-only PostgreSQL authority、exact digest/ETag/idempotency/concurrency/restart/down fail-closed。
- 安全/隐私：public-safe synthetic fixture；AgentTeams/model false；production audit 0；Secret/private path exclusion；无真实账号、Cookie、客户资料或外部 publish action。
- 建议状态：`M5-09 = EVIDENCE_READY`；Owner UAT 后由 Coordinator 独立核验并决定是否 `ACCEPTED`。
- 下一候选：SDD-007 消费冻结的 Skill/Artifact contracts 接入真实 AgentTeams；随后 SDD-011 做全链录屏与 competition evidence convergence。

最终 full HEAD、Draft PR URL、commit 列表、changed-file/test handoff 与 evidence aggregate digest 由 Executor 在本报告提交并推送后主动发送给 Coordinator；报告不写自引用 commit hash。

## 十一、Coordinator 验收决定

`PENDING`。

Coordinator 需要独立检查 exact base/head、代码 diff、migration/down、Skill source SHA-256、golden/package manifests、所有专项 evidence、full `npm run verify`、Draft PR checks 与 Owner UAT 返回，并仅由 Coordinator 同步中英文 canonical progress mirror。Executor 不修改 canonical 状态、不 merge main、不宣称 `ACCEPTED`。
