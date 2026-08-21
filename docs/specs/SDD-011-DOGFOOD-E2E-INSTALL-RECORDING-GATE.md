# SDD-011 — Full Dogfood E2E, Install, Upgrade, Rollback and Recording Gate

> Status: `SPEC_READY`
> Milestone: `M5`
> Proposed progress module ID: `M5-10`（待 Coordinator 登记；本文不改变 canonical progress）
> Owner: LumiClaw Presence 产品/设计 Owner；technical lead 负责工程证据
> Goal objective: 用 public-safe A梦 fixture 完成可复现 fresh install 到人工发布包的真实 AgentTeams 狗粮验收与录屏
> Target evidence maturity: `ENGINEERING_VERIFIED`；Owner Dogfood 不等于 `EXTERNAL_CALIBRATED`
> Acceptance report: `docs/reports/acceptance/SDD-011-ACCEPTANCE.md`
> Last updated: `2026-08-22`

## 1. User problem and outcome

分项页面和单元测试不能证明闭环可用。Owner 需要在一台本地机器上从零安装，不注册远端账号，以 public-safe A梦资料走完：分步 Onboarding → 批准知识 → 7/30 日 Goal/Plan → selected X/XHS compile → 真实六成员 AgentTeams → 独立审校 → 修改/重生成/批准 → 手工发布包，并在中途重启后继续同一 Mission。

本 SDD 把 fresh install、从既有本地数据升级、备份/回滚、正常与 fail-closed UAT、公开录屏和 evidence manifest 作为一个 release gate；它不新增业务语义。

## 2. Current state

- `main` 有 Docker/local developer baseline 和 M0/M1 verification；M2 有真实 AgentTeams/DeepSeek 一次性 UAT evidence。
- PR #7 提供生产 UX、本地显示名称、MD/TXT 和 local-private 基础，但仍是 fixture-bound 页面闭环。
- SDD-008～010 与 SDD-007 分别冻结知识、Goal/compiler、artifact/audit/package 和 runtime；只有它们在同一 convergence base 实施后，才有本 SDD 的可执行对象。
- 当前没有一条从 fresh volume 到 manual package 的真实 AgentTeams E2E；没有覆盖旧本地资料升级、应用版本回退/数据恢复和 public-safe recording gate。

## 3. Scope

### In scope

- 可复现本地安装、启动、停止、readiness、terminal Secret 配置与清理 runbook。
- public-safe A梦 fixture：多份 MD/TXT/自由文字、Persona、企业/产品、X Founder、小红书 Product、Market/Locale/Time Zone、7/30 日 Goal 输入；所有内容去标识且有 license/source/digest manifest。
- 完整正常 E2E、Auditor FAIL→revision→PASS 路径、runtime restart/recovery 路径。
- 从 Coordinator 冻结的 PR #7/convergence schema 及 seed data 升级到本 Epic；迁移前备份、失败恢复、应用版本 rollback/forward-fix。
- Owner 可执行的逐步 UAT、failure signs、evidence return、cleanup。
- public-safe 录屏脚本/shot list、固定 viewport、脱敏检查、evidence manifest 与 claim gate。
- release/upgrade/rollback docs 和 automated/conditional-live test entrypoints。

### Out of scope

- 新增 Persona/Goal/Artifact/Runtime 领域逻辑；发现缺口退回所属 SDD，不在 E2E 中复制实现。
- 真实平台自动发布、真实账号凭据、Cookie、DM/评论、客户数据。
- 把 Owner Dogfood 称为 external calibration、customer UAT、business verified 或 production ready。
- 必须把内容真正发布到 X/小红书；打开官方页即结束 current product responsibility。

### Existing behavior that must not change

- 公开 fixture 与私有 Owner 数据严格分开；fixture 不含联系人、原始 DM、客户名、Secret。
- AgentTeams/Provider 真实 run 和 controlled fixture run 有显著、机器可读标记。
- 无 `PUBLISHED` mutation；manual package 之后状态仍 `UNVERIFIED_EXTERNAL_STATE`。
- canonical progress 只能由 Coordinator 在独立验证和 Owner 决定后更新。

## 4. User journey and UI states

### Fresh install happy path

1. 按 README/runbook 检查 Docker/Node/ports/disk，启动 fresh named volume；所有服务 readiness 可见。
2. 终端隐藏输入 DeepSeek key；浏览器首次进入只填显示名称。
3. 导入 public-safe A梦 fixture，完成 Persona/企业产品/X/XHS/Market/Locale/Time Zone，解决冲突并批准 KnowledgeSnapshot。
4. 建立 7 日 Goal，启动 Intent generation，让真实 Claim Steward/Planner 生成候选计划；审阅并批准计划，确认下一代只 materialize X+XHS，六角色和两个 Producer 均有工作。
5. 继续同一真实 AgentTeams Mission；查看 bundle generation lineage、渐进 Trace 和完整 X Thread/小红书产物。
6. 故意触发 Auditor FAIL，修订或要求重生成，再由独立 Auditor PASS；Owner 批准 exact revision。
7. 复制/下载两个 package、打开官方页，确认无自动发布且状态未升级。
8. 运行中重启 worker/runtime/API，再次确认同一 run/revisions/digests 恢复。

### Required visible states

安装检查失败、Secret 未配置、服务 starting/degraded、Onboarding draft/conflict、Goal/Plan blocked、runtime queued/running/recovering/failed、artifact quarantined/audit failed/owner review、package ready/invalidated、external unverified 都必须有明确恢复动作；不得以 raw stack trace 代替 Owner 可理解的信息。

## 5. Domain and API contracts

本 SDD 不创建新的业务表。它新增 release/evidence artifacts：

- `DogfoodFixtureManifest { fixtureVersion, files[], digests[], source/license, publicSafeReview, expectedProfiles, expectedSelectedPlatforms }`。
- `InstallManifest { appCommit, imageDigests, migrationHead, runtime/team/skill/compiler/artifactProfile versions, platform, prerequisites }`。
- `BackupManifest { createdAt, schemaVersion, databaseDigest/ref, blobInventoryDigest, appCommit, restoreCommandRef }`；不得提交真实备份。
- `DogfoodRunManifest { fixtureDigest, input object IDs/digests, mission/run/task/revision/audit/decision/package refs/digests, realProviderMarker, restartEvents, tests, recordingRef }`。
- `RecordingManifest { fileDigest, duration, viewport, shotListVersion, redactionReview, publicSafeFixtureDigest, claimsShown[] }`。

CLI/scripts 需要稳定 exit codes 和 machine JSON mode：preflight、install/start/readiness、backup、migrate、restore rehearsal、dogfood seed、E2E verify、secret scan、recording verify、cleanup。脚本不得使用 destructive volume deletion 作为正常 cleanup；删除测试 volume 必须 explicit exact target + Owner authorization。

升级基线必须在验收报告记录 exact commit/schema/migration。migration failure 后应用不能在未知 schema 上继续；恢复流程为停止写入 → 验证 backup digest → restore 到独立验证 volume → smoke check → 切回，或采用有证据的 forward-fix。应用二进制 rollback 与数据 rollback 分开记录。

## 6. AgentTeams and Skills

- E2E 必须使用 SDD-007 锁定的真实 AgentTeams runtime/profile 和 exactly six members；controlled fake 只能用于 CI fault setup，不能作为 Owner happy-path evidence。
- DeepSeek 通过 terminal broker/ModelGateway；RunManifest 标记 provider、model policy、sanitized request receipt，不含 Secret/prompt private text。
- 使用 SDD-009 Bundle 和 SDD-010 SkillLock/ArtifactProfile；E2E 不允许 bypass compiler 直接手写 Agent task。
- public-safe fixture 的 X Founder 与 XHS Product 分别让两个 Producers 执行实质工作；Auditor 独立。
- recording 必须显示“真实 AgentTeams / public-safe fixture / manual publish / external state unverified”，防止把演示误读为业务结果。

## 7. Dependencies and reuse decision

| 组件 | 决定 | 版本/来源/许可证 | 边界 |
|---|---|---|---|
| SDD-008/009/010/007 | `INTEGRATE` | 各 accepted commit / Apache-2.0 | E2E 只编排和验证，不复制业务逻辑 |
| Docker Compose/local launcher | `INTEGRATE` | repository pinned versions | 本地单机；Secret 使用 Compose Secret，不 bake image |
| public-safe A梦 fixture | `BUILD` | 本仓 Apache-2.0；source manifest | 合成/去标识；不是真实客户数据 |
| Browser E2E framework | `INTEGRATE` | 复用 repo lock / license register | 测用户路径；不自动操作外部 X/XHS 页面 |
| Screen recording tool | `INTEGRATE` | Owner OS tool，非运行依赖 | 只按 shot list 录制本地产品，官方页可截到空白入口 |
| Remote installer/updater | `LATER-REPLACE` | 未选择 | 首版本地 clone/package；无远端注册 |

新增测试/归档依赖需固定版本与 license/NOTICE。Fixture 中使用的文字、品牌/头像/图片规格需自有或明确 public-safe；不抓取 X/小红书内容作 fixture。

## 8. Failure, recovery, and rollback

- preflight 缺 Docker/Node/port/disk 时中止且不写数据库；Secret 缺失不生成 mock run。
- migration 开始前生成/验证 backup manifest；失败即停止写路径，不自动 destructive rollback。
- fresh install 与 upgrade 使用独立 named volume，避免覆盖 Owner 日常数据。所有 destructive cleanup 显示 exact target 并单独授权。
- E2E 中任何 SDD invariant 失败，RunManifest 标记 FAIL 并链接所属 SDD；不在脚本中跳过 Audit/Owner gate。
- worker/runtime/API restart 按 SDD-007 reconciliation；超时后保持可诊断 blocked/unknown。
- recording 发现 Secret、私有文件路径、真实账号、未授权素材或误导 claim 时，文件不可公开，删除/重录由 Owner明确决定。
- rollback 验证包括：旧应用对新表安全只读或拒绝启动、restore 到验证 volume 后对象/digest count 相符、Blob inventory 不丢、append-only history 不裁剪。

## 9. Acceptance criteria

- [ ] 一份全新 checkout/volume 可按单一路径安装，无远端注册，服务 readiness 全绿或明确 blocked。
- [ ] public-safe A梦 fixture 有 source/license/digest/public-safe review，且不含 Secret、客户/联系人/原始 DM。
- [ ] Owner 从显示名称走到 X/XHS manual packages，除 terminal key 外不需工程师手工复制 ID/改数据库。
- [ ] happy path 使用真实固定版本六成员 AgentTeams/DeepSeek，不是 fixture/mock success。
- [ ] Auditor FAIL→Owner edit/regenerate→new Audit PASS→exact approve→package 的 lineage 可复核。
- [ ] 中途重启 worker/runtime/API 后继续同一 run，accepted outputs/packages 不重复。
- [ ] copy/download/open official page 后没有 `PUBLISHED`，没有自动平台动作。
- [ ] 从固定 legacy/convergence data 升级不丢 source/blob/campaign；失败可用已验证 backup 在独立 volume 恢复。
- [ ] app rollback、data restore、cleanup 各有 exact 命令、target、expected result 和 failure signs。
- [ ] 录屏按固定 shot list 完成并通过 Secret/privacy/claim review，manifest 含文件 digest。
- [ ] automated suite、conditional-live test、secret/license scan、Owner binary decision 全部进入中文验收报告。

## 10. Test plan

- Fresh install：clean checkout/config、new named volume、migrate/seed/readiness、zh-CN default/en switch。
- Full Web E2E：Onboarding、Snapshot、Goal/Plan、selected compile、real runtime、audit failure/revision/approval、package。
- 30-day contract：验证 30 日计划/slots/compile；录屏可用较短 7 日路径。
- Fault/restart：kill API、worker、AgentTeams、gateway at frozen stages；SSE reconnect、lease recovery、no duplicate。
- Upgrade：固定 pre-Epic schema/PR #7 fixture → migration head；对象数、digests、Blob inventory、legacy v1 reader。
- Rollback/restore：migration failure simulation、backup digest、independent restore volume、old/new app compatibility。
- Negative/security：PDF planned、conflict unresolved、unselected platform、runtime/key failure、Auditor FAIL、package tamper、official URL allowlist、no PUBLISHED。
- Real live gate：valid DeepSeek key + real AgentTeams；结果独立标为 `REAL_PROVIDER`，无 key 的 CI 只能 skip with explicit reason，不能 PASS 该 AC。
- Recording/privacy/license：1440×900（或 Owner 冻结的单一 viewport）、no notification、secret scan、fixture/source/NOTICE review、video digest。

## 11. Evidence and claims

验收包应包含：acceptance report、Install/Backup/DogfoodRun/Recording manifests、exact commands/results、migration/fixture/runtime/team/skill/compiler/image digests、E2E screenshots/video、sanitized AgentTeams trace、audit/revision/package manifests、restart/restore evidence、secret/license scan 和 Owner signed PASS/FAIL。

通过后允许的精确 claim：

> `ENGINEERING_VERIFIED`：LumiClaw Presence 可在本地使用 public-safe Owner 资料，把 selected X/小红书 7/30 日内容目标通过真实六成员 AgentTeams 生成并独立审校，再输出安全人工发布包；fresh install、upgrade、restart 与 fail-closed 路径已验证。

仍为 `NOT_CLAIMED`：自动发布、原生平台 published receipt、外部用户校准、增长/线索/营收、法律合规、生产就绪。Owner Dogfood 不是 `EXTERNAL_CALIBRATED`。

## 12. Delivery plan

1. 0.5 天：冻结 accepted dependency commits、fixture/manifest schema、install/upgrade base 和 shot list。
2. 0.5–1 天：preflight/install/start/backup/restore/evidence scripts 与 docs。
3. 1 天：full automated E2E、negative/restart/upgrade/rollback matrix。
4. 0.5 天：real Provider/AgentTeams Owner UAT、录屏/redaction review、验收报告和 release handoff。

Critical path：SDD-008→009→010→007 accepted → convergence install → full E2E/live UAT → recording/review。`M5-10` 不得因“视频录完”自动 ACCEPTED；二元 AC、机器证据和 Owner decision 都必须通过。

## 13. Alternatives and decision log

- 拒绝只录顺滑 happy-path：必须包含 Audit failure/revision 和 restart recovery，否则不能证明治理闭环。
- 拒绝用 synthetic Agent output 冒充 real E2E：CI 可 controlled fake，Owner gate 必须真实 AgentTeams/provider。
- 拒绝从 dirty developer volume 验收：无法证明 fresh install 和迁移。
- 拒绝 destructive down migration：资料/历史优先；使用 backup、forward-fix 和独立 restore rehearsal。
- 拒绝在录屏中真的发布：超出 current boundary且引入账号/政策风险。

## 14. Owner-participated acceptance

### Prerequisites

- clean worktree/checkout、Docker/Node 和足够磁盘；exact supported versions见 InstallManifest；
- public-safe A梦 fixture；有效 DeepSeek key，仅在终端录入；
- 不登录真实 X/小红书也可完成，官方页只验证入口；
- 录屏前开启勿扰、隐藏终端历史/通知/私有路径，使用冻结 viewport。

### Numbered protocol

1. 跟随 fresh-install runbook 启动，确认无远端注册和 readiness。
2. 完成分步 Onboarding，导入 fixture、处理冲突、批准 exact Snapshot。
3. 建立/批准 7 日 Goal/Plan，确认只有 X/XHS 和六成员职责。
4. 启动真实 AgentTeams；记录 run ID/digest 与两个 Producers、Auditor trace。
5. 在冻结 stage 停止 mission-worker，重启后确认恢复且无 duplicate。
6. 触发 Auditor FAIL，修改/重生成后再次审校 PASS，批准 exact revisions。
7. 下载两个 packages、核 manifest；打开官方页并确认仍 external unverified。
8. 执行 secret/privacy scan 和 automated manifest verifier。
9. 另用固定 legacy volume 做 backup→upgrade；在独立 volume 演练 restore，并对比对象/blob/digest。
10. 按 shot list 录制一次无 Secret 视频，review claims 后给出 `OWNER_UAT_PASS | OWNER_UAT_FAIL`。

Expected：一条可重复、可恢复、没有隐藏 fixture 成功的完整路径。Failure signs：安装需远端账号、手工改 DB/复制 ID、未选平台出现、Leader代写、Auditor不独立、重启重复、FAIL仍可批准、外部状态变 PUBLISHED、Secret/客户数据入证据。Owner 返回 binary decision、Run/Recording manifests、截图/视频 digest、问题列表；cleanup 停止 stack并移除临时 Secret，保留 evidence volume。删除 volume/下载包前列 exact target 并另行确认。

## 15. Task closeout

- 中文验收报告：`docs/reports/acceptance/SDD-011-ACCEPTANCE.md`。
- Proposed module：`M5-10`；当前只有 spec `SPEC_READY`。
- Canonical progress 只在 Coordinator 独立重跑关键检查、核验中英文 parity 和 Owner decision 后更新。
- Closeout 必须报告 Worktree/Branch/Commit、dependency commits、fixture/manifest/version/license、tests、real live evidence、Owner UAT、recording、upgrade/rollback、non-claims、proposed state、blockers、next candidate 和 STATUS_HANDOFF；Goal 最后完成。
