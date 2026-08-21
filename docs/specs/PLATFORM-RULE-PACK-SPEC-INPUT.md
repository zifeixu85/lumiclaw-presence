# Platform Rule Pack / Artifact Profile Foundation — SDD Input

状态：`SPEC_INPUT_ONLY`

正式 SDD ID：由 Coordinator 分配

建议名称：`PLATFORM-RULE-PACK-AND-ARTIFACT-PROFILE-FOUNDATION`

## 1. Problem

当前 LumiClaw Presence 能生成 account-native artifact 并进入手动发布基础，但缺少一份可版本化、可追溯、可执行的 platform content contract。若继续把平台限制写在 prompt、Skill prose 或 UI 文案中，会产生四类风险：

1. 非官方运营建议被误标为平台硬限制；
2. 账号、地区、客户端与 API 能力差异被压成静态常量；
3. Producer 和 Auditor 使用不同规则版本，批准 digest 无法解释；
4. 第三方 Skill 的许可证与 cookie/逆向/浏览器自动化路径绕过项目安全边界。

## 2. Goal

建立第一方 `PlatformRulePack`、`ArtifactProfile` 与 platform Skill manifest 基础，使 X 单帖、X 线程和小红书图文笔记能够：

- 绑定 stable code、版本、来源 URL、retrievedAt、expiry 与 digest；
- 区分 hard、official recommendation、empirical recommendation、account probe；
- 由确定性 validator、Producer、Auditor、Owner 各自承担清晰责任；
- 在来源/能力过期、冲突或未知时 fail closed 或降级 manual native handoff；
- 绑定 exact approved artifact revision，不扩大当前外部动作权限。

## 3. Non-goals

- 不实现 X Direct production connector；
- 不实现小红书自动发布、cookie 登录、逆向私有 API 或浏览器自动化；
- 不把 Postiz/AGPL 代码引入 Apache-2.0 仓库；
- 不实现所有平台、所有 artifact profile；
- 不宣称法律合规、增长、线索或收入；
- 不把 3–7 thread、1080×1440、首图封面等建议升级为平台硬限制；
- 不在此 SDD 完成真实外部用户 UAT。

## 4. Dependencies

- SDD-004 manual publication foundation：官方入口 allowlist、账号确认、exact revision、user-action-required、失败/未知 reconciliation。
- SDD-005 market localization foundation：source/version/retrievedAt/scope/expiry/digest、precedence、role projection。
- SDD-006 onboarding/Skill registry foundation：read-only Skill registry 与 UI surface。
- 当前 `packages/domain` Ajv 版本与 repository dependency policy。

若依赖 PR 尚未合并，正式 SDD 必须先做接口 convergence，不得平行创建重复 domain objects。

## 5. Proposed domain objects

### 5.1 PlatformRulePack

Required:

- `packId`, `platformCode`, `packVersion`, `status`, `contentDigest`；
- pack-level `retrievedAt`, `reviewedAt`, `reviewCadenceDays`, `expiresAt`；
- sources：`sourceId`, URL, publisher, authority, source type, source version, expiry；
- applicability：artifact profile, market, locale, delivery mode, client surface, account capability selector；
- rules：stable `ruleCode`, classification, severity, source refs, condition, constraint, validator, fallback；
- source conflicts and explicit resolution.

Production `ACTIVE` pack must carry canonical digest; research prototype may omit it.

### 5.2 ArtifactProfile

Required:

- `profileCode`, `platformCode`, `profileVersion`, status；
- market/content locale，且显式与 UI locale 分离；
- required/optional fields、media slots、recommended exports；
- exact rule pack version/digest；
- allowed delivery mode、capability probe、manual fallback；
- validator codes 与 Owner-visible checklist。

First profiles:

- `X_SINGLE_POST`
- `X_THREAD`
- `XHS_IMAGE_NOTE`

Future profiles only after separate acceptance:

- `X_LONG_POST`, `X_ARTICLE`, `X_POLL`, `X_VIDEO_POST`, `XHS_VIDEO_NOTE`

### 5.3 Platform Skill manifest

Required:

- first-party/third-party origin, source URL, commit/tag, retrievedAt；
- SPDX and decision: adopt / reimplement concept only / reject；
- AgentTeams runtime and role codes；
- rule/profile/input/output bindings；
- network/browser/cookie/secret/public-write permissions；
- external action classification and exact-approved-digest requirement；
- fallback and fixture list。

First Skill is content-only and has no external action permission.

### 5.4 CapabilitySnapshot extension

Add per-account/client observations:

- capability code/value；
- account, client, market/region；
- observedAt, expiresAt, evidence ref；
- probe method and result；
- invalidation reasons。

Unknown or expired capability must not be converted to `false` or a guessed constant; validation returns `PROBE_REQUIRED`.

### 5.5 ArtifactValidationResult

Suggested shape:

- artifact revision/digest；
- rule pack/profile version/digest；
- hard failures, warnings, probes；
- deterministic evidence；
- Auditor disposition；
- Owner decisions for warnings/probes；
- result: `BLOCKED | PROBE_REQUIRED | REVIEW_REQUIRED | READY_FOR_APPROVAL`。

## 6. Role projection

- Presence Mission Leader：只看 pack/profile IDs、总体状态、阻塞原因和下一责任人，不生成或改写平台内容。
- Account-native Producer：看 artifact profile、hard constraints、recommendations、market/account context；输出 draft 与 self-check。
- Independent Auditor：看完整规则、来源、冲突、过期、capability evidence、Claim–Evidence 和 permission boundaries；独立给 disposition。
- Action Operator：不读取任意 prompt 生成结果，只接受 exact approved digest + short-lived grant + supported delivery mode。
- Owner：在 UI 区分红色 hard failure、黄色 recommendation、蓝色 probe，并能看到来源/版本/过期时间。

## 7. Deterministic validators

First implementation:

- schema and stable code validation；
- source/pack expiry and source-ref integrity；
- hard/recommendation/probe severity discipline；
- X weighted text through pinned official parser adapter；
- X image count/file size/ALT；
- X thread item/reply chain；
- X poll boundaries and mutual exclusion；
- XHS media mutual exclusion；
- XHS Share SDK shape only when that delivery mode is selected；
- recommended export dimensions as warning only；
- capability unknown/expired => probe required；
- Skill permissions and license/connector policy allowlist。

Semantic community/commercial rules remain Auditor checks, not pretend-deterministic legal validators.

## 8. Persistence and API

Suggested persistence:

- immutable rule-pack/profile revisions；
- source records and expiry；
- capability snapshots；
- artifact validation results；
- Owner warning/probe decisions；
- digest links to activation revision/media manifest。

Suggested read-only API first:

- `GET /api/v1/platform-rule-packs/:packId/versions/:version`
- `GET /api/v1/artifact-profiles/:profileCode/versions/:version`
- `GET /api/v1/skills/:skillId/manifest`
- `POST /api/v1/artifacts/validate` only within current governed mission scope

No publish endpoint is added by this SDD.

## 9. Acceptance criteria

Binary acceptance:

1. Production schemas reject missing source/version/expiry and unknown stable codes.
2. Every hard rule references at least one current source and has a deterministic or Auditor validator.
3. Recommendation cannot surface as platform rejection; probe cannot silently become a constant.
4. Pinned X parser passes URL, CJK, emoji and 280/281 conformance fixtures.
5. X single/thread fixtures validate with expected results.
6. XHS fixture remains `PROBE_REQUIRED` until account counters/crop/topic evidence exists; it does not use 20/38/1,000 as official constants.
7. Expired pack/source/capability blocks approval or forces explicit refresh.
8. Producer and Auditor projections are distinct; Leader cannot generate domain artifacts.
9. Skill manifest with cookie/browser/public-write permission is rejected for the content-only Skill.
10. AGPL/NOASSERTION source cannot enter the Apache-2.0 source tree.
11. Manual handoff binds exact rule/profile/artifact digests; page-open/SDK callback is not publication success.
12. Required automated checks, Chinese acceptance report and Owner-visible UAT steps exist before state can become `ACCEPTED`.

## 10. Owner UAT outline

Prerequisites:

- a test X account and a test Xiaohongshu account chosen by Owner；
- no customer material；
- manual publication only；
- capability evidence folder approved for private storage。

Steps:

1. Open rule/profile inspector and verify each rule displays class, source, retrievedAt and expiry.
2. Enter X 280/281 fixtures and verify pass/block; add long URL and verify fixed URL weighting.
3. Validate X thread and introduce one over-limit item/reply cycle; verify exact item failure.
4. Open current X composer with the test account; record long-post/article/video/poll capability without publishing.
5. Validate XHS fixture; verify system shows `PROBE_REQUIRED`, not a guessed hard failure.
6. Open Xiaohongshu creator/native composer manually; return title/body/image/topic counters and three native crop screenshots.
7. Refresh CapabilitySnapshot; verify warnings/probes update while source class remains unchanged.
8. Change image order or one character after approval; verify approval/grant invalidation.
9. Stop before public submission unless Owner separately authorizes a test post; if authorized, return URL/screenshot and reconcile.

Expected visible result：Owner can explain why an item is blocked, warned or awaiting probe and can open the exact source. Failure sign：UI says “平台限制” without source/scope/version, or a page-open event appears as published.

## 11. Rollback

- Disable the first-party platform-content-contract Skill in the read-only registry；
- stop selecting new rule/profile versions；
- preserve immutable validation evidence；
- fall back to existing manual artifact review and publication handoff；
- do not delete account probe evidence or rewrite historical decisions。

## 12. Research inputs

Primary research and prototypes live in [docs/research/platform-skills/README.md](../research/platform-skills/README.md). Machine-readable schemas and fixtures are research inputs, not automatically accepted production contracts.
