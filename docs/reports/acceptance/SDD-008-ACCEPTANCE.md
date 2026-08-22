# SDD-008 — 分步人设、权威知识与账号运营档案 Onboarding 验收报告

> Goal Objective：完整实现 SDD-008 分步人设、权威知识与 X/小红书账号运营档案 Onboarding，形成可恢复 KnowledgeSnapshot
> Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-008-guided-persona-knowledge-account-onboarding`
> Branch：`codex/sdd-008-guided-persona-knowledge-account-onboarding`
> Exact Base：`001ef2e5e8e10402d93f5f3dd02fff2a1a2315c0`
> Governing SDD：`docs/specs/SDD-008-GUIDED-PERSONA-KNOWLEDGE-ACCOUNT-ONBOARDING.md`
> 证据成熟度：`IMPLEMENTED / ENGINEERING_VERIFIED`；Owner UAT 与 Coordinator acceptance 均为 `PENDING`
> 建议模块状态：`M5-06 IN_PROGRESS → EVIDENCE_READY`；Executor 不修改 canonical progress，不声明 `ACCEPTED`

## 一、交付结果

SDD-008 已形成真实的本地生产路径：首次仍只要求本地显示名称；之后进入可返回、逐步保存、刷新/重启恢复的七步设置，而不是一次性技术表单。Owner 可建立个人/创始人人设、企业与产品事实、X 与小红书各自独立的非 Secret 账号运营档案、默认 Market / Content Locale / IANA Time Zone，并导入多份 MD/TXT 与自由文字。

普通用户上传或粘贴来源时不需要填写 `KnowledgeItem`、candidate JSON、digest 或任何技术元数据。服务端保存原始 bytes 的内容摘要与 Blob reference，创建 immutable `SourceDocumentRevision`，并把完整提取文本确定性映射为 `SOURCE_EXCERPT` KnowledgeItem/source binding。Review 页面展示来源摘录、结构化事实、冲突、缺口与来源；当前不可信的自动事实抽取不会假装成功，Owner 通过逐条冲突选择和 exact digest 批准完成确认。五份来源均进入 Snapshot 与 exact `RoleContext`，不是“文件上传成功但下游为空”。

X 与小红书分别保留 `accountExists` Owner 确认、handle/nickname、角色、人群、内容支柱、表达示例、do/don't、CTA、节奏、producer mandates、各自 target market 与 content locale。全局 Market/Locale/Time Zone 明确是默认运营上下文，Compose/RoleContext 证据验证 `X=US/en-US`、`XIAOHONGSHU=CN/zh-CN` 与默认 `SG/en-US/Asia-Singapore` 同时存在，彼此不覆盖。

Owner 解决冲突并批准 exact draft digest 后，得到不可变 `AuthoritativeKnowledgeSnapshot(APPROVED)`；未批准、来源/档案变化、删除、Blob 缺失、digest tamper、stale ETag 或当前版本不一致均 fail closed。批准页提供“更新知识（开始新草稿）”，会立即停止把旧快照作为 current context，同时保留已批准历史。没有启动 AgentTeams、创建 Goal/Campaign、生成平台内容或执行外部动作。

Coordinator 指出的视觉 P1 已关闭：Review 长页切换到 Approved 短页时，仅 Onboarding main 与页面滚动根复位到顶部，不移动焦点。真实 Chromium 新增首帧断言，中文批准后的第一个 frame 已同时显示 LumiClaw Logo、“本地称呼”、批准标题，main/page `scrollTop=0`；canonical `04-approved-snapshot.png` 已重新生成，失败调试图只保留在 gitignored diagnostics。

## 二、交付范围

| 层 | 已实现 | 明确边界 |
|---|---|---|
| Domain | stable enums/errors、精确 schema、UTF-8 MD/TXT、2 MiB、secret-shape 拒绝、Profile/Source/Item/Conflict/Snapshot/RoleContext、canonical digest | 不做通用 RAG、模型自动写真源或 SDD-009 Goal |
| PostgreSQL | migration `000011`、owner-scoped 复合 FK、版本/绑定/幂等/audit 表、row lock/ETag、append-only revision、legacy adapter | PostgreSQL 单真源；Blob 只存 bytes；不使用内存作为生产真源 |
| Blob/来源 | 多文件、自由文字、SHA-256、内容寻址、reference-aware compensation、删除创建新 Draft | PDF/DOCX/audio 明确 `SOURCE_TYPE_PLANNED`；不抓网页 |
| API | Owner/session/profile/account/source/conflict/approve/exact RoleContext 路由、OpenAPI、稳定错误码、redacted audit | 不收 Credential/OAuth/Cookie/API key；不提供平台连接/发布 |
| Web | zh-CN 默认、en parity、七步草稿/返回/恢复、普通用户来源路径、友好业务状态主标签、稳定码详情、approved/new-draft 入口 | 桌面 1024+；不重设计 Shell；public-safe 示例与 LOCAL_PRIVATE 隔离 |
| Evidence | real Chromium、fresh Compose、migration up/down、legacy、restart、concurrency、Blob missing、source delete/history、owner boundary、secret/license | 只含 synthetic public-safe 数据；不是客户 UAT 或业务结果 |

实现没有触碰 SDD-009 Goal/编译、SDD-007 runtime、SDD-010 平台产物/发布，也没有让静态 AI Team 或 fixture 冒充 Agent run。

## 三、实现证据

| Evidence | 路径 | 关键事实 |
|---|---|---|
| RunManifest | `docs/reports/evidence/sdd-008/run-manifest.json` | Base、run-time Head/branch、runtime、claim boundary、全部 canonical evidence 的 bytes/SHA-256 |
| Migration manifest | `docs/reports/evidence/sdd-008/migration-manifest.json` | migration list、000011、fresh-empty down PASS、populated down BLOCK、legacy digest/review |
| API contract JSON | `docs/reports/evidence/sdd-008/api-contract-results.json` | exact RoleContext、412 stale、422 digest/secret/blob、delete/new draft、owner FK、zero action |
| Source/Snapshot digest | `docs/reports/evidence/sdd-008/source-snapshot-digest-manifest.json` | 2 MD + 1 TXT + 2 free text、revision/digest、Snapshot/RoleContext、双账号画像与默认上下文 |
| Restart transcript | `docs/reports/evidence/sdd-008/restart-transcript.json` | API restart、PG+API restart，前后 sources/profiles/snapshots 计数一致、无重复 |
| Compose | `docs/reports/evidence/sdd-008/compose-verification.json` | fresh image/volume、18 项跨 DB/API/Blob/restart/immutability/rollback 检查、project-scoped cleanup |
| Browser | `docs/reports/evidence/sdd-008/browser-verification.json` | real Chromium、zh-CN/en、七步普通用户路径、权威优先级、axe、1024、desktop gate、批准首帧复位 |
| Screenshots | `docs/reports/evidence/sdd-008/01-first-open-zh.png` ～ `06-desktop-gate.png` | 公开安全首次打开、五来源、Review、中文/英文 Approved、桌面 gate；SHA-256 在 RunManifest |
| Dependency/license | `docs/reports/evidence/sdd-008/DEPENDENCY-LICENSE-REVIEW.md` | lockfile 无变化、inventory/SBOM PASS、audit endpoint 限制、无 AGPL/竞品源码/新增依赖 |

Canonical evidence 不包含 Owner 真实私密资料、Blob 原文、密码、Cookie、OAuth、API key 或本机绝对路径。`failure-xiaohongshu-submit.png` 是已关闭问题的本地诊断，只位于 `.evidence/sdd-008/diagnostics/`，不进入 Git、RunManifest 或 canonical evidence。

## 四、自动化验证

| 命令 | 结果 | 精确覆盖 |
|---|---|---|
| `npm run lint` | `PASS` | ESLint 全仓 |
| `npm run typecheck` | `PASS` | 12 workspace TypeScript contracts |
| `npm test` | `PASS` | 42 files / 379 tests；Domain、API、Web、既有回归 |
| `npm run check:messages` | `PASS` | zh-CN/en 760 keys parity |
| `npm run verify:sdd008:compose` | `PASS` | 当前源码 fresh build；18 项 Compose/PG/API/Blob/restart/immutability/rollback + real Chromium |
| `npm run verify:sdd008:browser`（由上项在 fresh stack 内执行） | `PASS` | 23 checks、6 PNG、console error 0、axe serious/critical 0 |
| `npm run check:secrets` | `PASS` | final full verification 448 files；另有 API rejection/redacted audit 负测 |
| `npm run verify:sdd008:dependencies` | `PASS` | 1,020 packages、710 SBOM components、disallowed 0 |
| `npm run verify` | `PASS` | static、全量 tests、Next production build、Storybook production build |
| `npm audit --omit=dev --audit-level=high` / full audit | `NOT_VERIFIED_TRANSIENT_REGISTRY_FAILURE` | 两次 npm advisory endpoint TLS 连接中断；本次 lockfile 无变化；Coordinator/CI 必须重跑。Frozen base 最近证据为 prod 0、dev-only 3 high，不冒充本次结果 |

Fresh PostgreSQL 回滚证据是二元的：空的 SDD-008 表允许 `migrate:down` 并移除 schema；只要 Source/Profile/Item/Conflict/Snapshot/Binding/Idempotency/Audit 任一表有资料，down 返回稳定错误 `SDD008_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED`，schema 与数据仍在。测试环境与生产环境没有不同的删除语义。

## 五、验收标准结果

| Criterion ID | 结果 | Evidence | 说明 |
|---|---|---|---|
| AC-01 | `PASS` | Browser first-open + API tests | 首次只输入本地显示名称；无邮箱、密码、远端注册或 Secret 字段。 |
| AC-02 | `PASS` | Browser seven-step/reload + PG restart | Persona、Organization/Product、X、XHS、默认上下文逐步保存、可返回、刷新与重启恢复。 |
| AC-03 | `PASS` | Browser sources + source manifest + RoleContext | 2 MD、1 TXT、2 自由文字全部进入 immutable revision、Blob/digest、KnowledgeItem/source binding、Snapshot/RoleContext；用户不填 JSON/技术元数据。 |
| AC-04 | `PASS` | Domain authority-order test + API/Browser conflict matrix | 冲突不静默覆盖且 radio 默认未选；Owner 选择后 exact digest 才可批准；固定顺序为 Campaign > Organization private > Public > Model prior，模型先验明确必须 Owner 确认。 |
| AC-05 | `PASS` | Snapshot/history/source delete + direct PG mutation tests | 只有 current immutable APPROVED Snapshot 可读；变更/删除产生新 Draft并使 current exact read stale；直接 DELETE、状态复活、binding 删除均被 trigger 拒绝，旧 snapshot/bindings 不覆盖。 |
| AC-06 | `PASS` | Domain/API negative tests | PDF/DOCX/audio、MIME/extension、UTF-8、空文件、超限、path traversal、digest mismatch fail closed，不创建假 Blob/Profile。 |
| AC-07 | `PASS` | API/PG audit and composite FK | cross-owner、secret-shaped field、digest tamper、stale ETag、missing Blob 均拒绝；审计脱敏且无 Secret value。 |
| AC-08 | `PASS` | Restart transcript + counts | API 与 PostgreSQL 分别重启后同一 session/source/snapshot 恢复，revision/snapshot 无重复。 |
| AC-09 | `PASS` | Migration manifest + Compose | PR #7 legacy bytes/digest 保留为 `LEGACY_NEEDS_REVIEW`，不自动 APPROVED；000011 是当时 next unused migration。 |
| AC-10 | `PASS` | RunManifest/API/source/browser/security evidence | migration、API、fixture/snapshot digest、restart、secret/privacy、双语截图均为 public-safe 可复核证据。 |
| AC-11 | `PASS` | Browser 23 checks + RoleContext | 主状态/权威标签中英文业务解释，stable code 只作次级详情；X/XHS 独立市场/语言同时保留；批准首个中文 frame 顶部可见且 scroll=0。 |
| AC-12 | `PASS / OWNER PENDING` | empty/populated down + 本报告 UAT | destructive down 对有资料库稳定阻断；机器门禁完成，但 Owner 二元 UAT 与 Coordinator acceptance 仍 `PENDING`。 |

## 六、Owner 参与验收

### UAT-01｜普通用户分步知识建立、批准、恢复与新版本

- **前置条件：**checkout 到最终 STATUS_HANDOFF 的 remote-equal Head；Node `24.16.0`、npm `11.13.0`、Docker/Compose 与桌面 Chrome/Edge；窗口宽度至少 1024px。不需要 provider key、平台账号或真实客户资料。
- **安全数据：**只使用公开安全 fixture：2 份 `.md`、1 份 `.txt`、2 条自由文字。不要输入真实 Owner/客户资料、Cookie、密码、OAuth、API key 或私有账号信息。
- **准备：**运行 `npm ci && docker compose up --build`，等待 Web/API/PostgreSQL healthy；打开 `http://localhost:3000/zh-CN`。
- **操作步骤：**
  1. 输入本地显示名称；确认页面没有邮箱、密码或云注册。
  2. 完成人设、企业/产品；使用返回按钮再进入，确认已提交草稿仍在。
  3. 批量上传 2 MD + 1 TXT，再粘贴 2 条自由文字；确认页面只问文件/来源名称/原文，不要求 KnowledgeItem、candidate JSON 或 digest，并可打开每份来源摘录。
  4. 尝试上传 PDF；确认显示首版未支持/`SOURCE_TYPE_PLANNED`，没有假成功来源。
  5. 分别填写 X=`US/en-US`、小红书=`CN/zh-CN`，再把全局默认设置为 `SG/en-US/Asia-Singapore`；在 Review 确认两份账号画像未被全局值覆盖。
  6. 在冲突未解决时确认批准按钮不可用；选择权威值后确认出现“可以批准”，再批准 exact Snapshot。
  7. 不刷新、不切语言，立即确认批准首屏同时看到 LumiClaw Logo、左侧“本地称呼”和“权威知识快照已经批准”；页面应从顶部开始。
  8. 刷新并重启 Web/API；确认 Snapshot version/digest、五份来源与状态不变，且没有 Campaign/Goal/Agent run。
  9. 点击“更新知识（开始新草稿）”，修改一项产品事实；确认进入新 Draft，旧批准版本未被覆盖，当前下游读取在重新批准前 fail closed。
- **期望可见结果：**普通用户无需技术元数据即可把来源原文变成可审阅、可追溯知识；冲突显式；批准后进入 `KNOWLEDGE_APPROVED_NEEDS_GOAL`；双账号画像、默认上下文和 immutable history 均正确。
- **失败信号：**上传后 Review/RoleContext 无来源内容；raw `READY/NEEDS_OWNER_DECISION` 成为主标签；X/XHS 被全局 market/locale 覆盖；冲突未解决可批准；刷新/重启丢失；批准首帧仍停留在页面中部；旧版本被覆盖；出现 Secret/远端注册/Agent/发布。
- **需返回证据：**步骤 3 来源页、步骤 5 Review、步骤 7 批准首帧三张截图；Snapshot/source manifest；浏览器 console 摘要；书面 `UAT-01 PASS` 或失败的 exact AC ID/步骤/可见差异。
- **清理：**只执行 `docker compose down`，默认保留 volume。任何删除 volume、来源或数据库的动作都需要另获 Owner 授权。
- **Owner 结果：**`PENDING`

## 七、ChatGPT Pro 双代理记录

- ChatGPT Pro 协作未被请求或授权，状态为 `NOT_RUN_NOT_REQUESTED`。
- 没有向外部 Agent、插件、平台或第三方上传源码、资料、证据、Secret 或账户信息。
- 本地实现、测试与报告均不依赖外部 reviewer claim；ChatGPT Pro 不替代 Owner UAT 或 Coordinator 复验。

## 八、失败、限制与非声明

- **已发现并修复：**连续 X/XHS 页面最初复用了 React local state，导致小红书可能提交 X payload；平台 key 隔离后真实浏览器双画像通过。
- **已发现并修复：**DELETE/legacy-confirm 曾带空 JSON content type，Fastify 正确拒绝；control-only headers 修复后恢复稳定协议。
- **已发现并修复：**长 Review → 短 Approved 保留滚动位置，中文首帧裁掉 Logo/前六步；按 state/step `scrollKey` 只复位 Onboarding main/page scroll，不移动焦点，真实 Chromium 首帧断言通过。
- **Known limitations：**首版只支持 UTF-8 MD/TXT 与自由文字。PDF/DOCX/audio/OCR/网页抓取/向量检索均为 `PLANNED/NOT_CLAIMED`。
- **Known limitations：**当前不声称可信自动事实抽取；来源正文以确定性 `SOURCE_EXCERPT` 与来源绑定进入 Snapshot，结构化 facts 来自 Owner Profile/明确冲突选择。未来 extractor 必须保留同一 source/digest/confirmation contract。
- **Known limitations：**只实现 X 与小红书非 Secret 运营档案；不做账号连接、capability probe、OAuth 或发布。
- **Known limitations：**npm advisory endpoint 在本轮两次 TLS 失败，current audit 结果不可得；详见 dependency review，Coordinator/CI 必须重跑。
- **Known limitations：**Owner UAT、Coordinator independent verification、remote CI 均待完成。本报告不作 `ACCEPTED` 声明。
- **明确 `NOT_CLAIMED`：**SDD-009 Goal/编译、SDD-007 runtime、SDD-010 内容/发布、AgentTeams run、自动学习、客户使用、EXTERNAL_CALIBRATED、BUSINESS_VERIFIED、增长/线索/收入、production readiness、安全或法律合规保证。

## 九、回滚与恢复

### 数据备份与恢复

在任何应用/Schema 回退前，先在 Worktree 外的 Owner 指定安全目录导出整个 PostgreSQL 数据库并校验：

```sh
docker compose exec -T postgres pg_dump -U postgres -d lumiclaw --format=custom > /OWNER_APPROVED_SAFE_PATH/lumiclaw-before-sdd008.dump
shasum -a 256 /OWNER_APPROVED_SAFE_PATH/lumiclaw-before-sdd008.dump
docker compose exec -T postgres pg_restore --list < /OWNER_APPROVED_SAFE_PATH/lumiclaw-before-sdd008.dump
```

恢复必须进入单独的新数据库，先验证后再由 Owner 决定切换；不得覆盖现有库：

```sh
docker compose exec -T postgres createdb -U postgres lumiclaw_sdd008_restore
docker compose exec -T postgres pg_restore -U postgres -d lumiclaw_sdd008_restore --exit-on-error < /OWNER_APPROVED_SAFE_PATH/lumiclaw-before-sdd008.dump
docker compose exec -T postgres psql -U postgres -d lumiclaw_sdd008_restore -c "select count(*) from knowledge_snapshots;"
```

### Migration Rollback

- 首选 forward-fix，旧应用只读/不识别新表，不删除资料。
- `000011 down` 只有相关表全部为空时才允许移除 schema；fresh-empty 证据为 `PASS`。
- 任一相关表存在资料时，down 必须并已验证返回 `SDD008_DOWN_BLOCKED_DATA_EXPORT_AND_OWNER_DECISION_REQUIRED`，要求先导出并获得 Owner 对保留/迁移/删除的明确决定。不得以“测试环境可删”绕过。
- 代码 Rollback 由 Coordinator 对最终提交执行 `git revert <commit>`；不重写历史、不使用 `reset --hard`。回退应用在 Owner 知情下保持新表数据不变，随后 forward-fix。
- Blob 与数据库必须一起备份/恢复；不能只删 Blob 或只回退 schema。reference-aware compensation 仅清理本次事务新增且未被任何 source 引用的 Blob。

## 十、执行任务状态交接

Executor 未修改 public 或中文 canonical `IMPLEMENTATION-STATUS`。`M5-06` 仍由 Coordinator 管理；本报告只提出状态建议。

| Module ID | 当前状态 | 建议状态 | 理由 |
|---|---|---|---|
| M5-06 | `IN_PROGRESS` | `EVIDENCE_READY` | AC-01～AC-11 机器门禁通过，AC-12 的工程部分通过；Owner UAT/Coordinator acceptance 仍 `PENDING`。 |

STATUS_HANDOFF 摘要：

- Worktree/Branch/Base：见报告头；只使用 Coordinator 授权 Worktree。
- Commit/Full HEAD/Draft PR：在 commit、push、创建 Draft PR 后由最终结构化 STATUS_HANDOFF 精确回传。
- Changed files：Domain/DB migration+repository/API+OpenAPI/Web+i18n/tests/evidence scripts/public-safe evidence/dependency review/本报告；canonical status 文件无修改。
- Security/license：Secret scan、exact schema、redacted audit、dependency inventory/SBOM 通过；lockfile 无变化；current npm audit 因 registry TLS 暂不可得并明确列为限制。
- Blocker：无本地工程 blocker。Owner UAT、Coordinator independent verify 与 remote CI 是接受门禁，不能由 Executor 代替。
- 下一步：Coordinator 复核 remote-equal Head 与证据后安排 Owner UAT；达到门后才启动独立 SDD-009，不在本 PR 中实现 Goal/编译。

## 十一、Coordinator 验收决定

- Executor 自动化验证：`PASS`
- Executor 建议证据成熟度：`IMPLEMENTED / ENGINEERING_VERIFIED`
- Executor 建议模块状态：`EVIDENCE_READY`
- Coordinator independent verification：`PENDING`
- Owner UAT：`PENDING`
- Owner 二元决定：`PENDING`
- 最终 canonical state：`PENDING`；Executor 未自行标 `ACCEPTED`
- Draft PR：创建后由最终 STATUS_HANDOFF 回传；不得在 Owner/Coordinator 门禁前 merge
