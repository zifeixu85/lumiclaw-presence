# SDD-001 验收报告｜Campaign Walking Skeleton

> SDD：`docs/specs/SDD-001-CAMPAIGN-WALKING-SKELETON.md`  
> 进度模块 ID：`M1-01`、`M1-02`、`M1-03`、`M1-04`、`M1-05`、`M1-06`  
> Goal Objective：完成 SDD-001 Campaign Walking Skeleton 的规范、实现、测试、中文验收报告与状态交接。  
> Executor Task：`019fc6d8-2c5a-76d3-b3ad-ddb96b56f62e`  
> Worktree：`/Users/ameng/Documents/Projects/GOAI-hangzhou/worktrees/lumiclaw-presence/sdd-001-campaign-walking-skeleton`  
> Branch / Base：`codex/sdd-001-campaign-walking-skeleton` / `4568277f9dc8e302141b93bb38ded20200fb31a9`  
> 报告状态：`EVIDENCE_READY`  
> 证据成熟度：`ENGINEERING_VERIFIED`  
> 生成日期：`2026-08-04`

## 一、交付结果

SDD-001 已把 M0 的非实时产品壳扩展为一条真实、可持久化的 M1 纵向切片。Owner 现在可以用默认中文界面创建一条纯本地、synthetic Campaign，将最小品牌矩阵、Claim/Evidence、四个平台草稿与排程合同保存到 PostgreSQL，刷新或重启后按 Campaign ID 重开同一状态。Web、REST/OpenAPI、未来 CLI/AgentTeams adapter 编译入口读取同一个持久化控制面；保存使用 Idempotency-Key、强 ETag 与版本冲突保护。

四个平台分别提供 X、Bluesky、LinkedIn、小红书的可编辑模型和不同的 native-like preview；排程只生成/保存 `ONCE` 或受约束 RRULE 的 occurrence 预览，持久化 IANA 时区、DST gap/fold、misfire 与编辑失效状态。全部数据始终显示 `DEMO_SEED / NOT_LIVE`；没有到期执行、发布、评论、回复、私信、抓取、Provider 调用或真实 AgentTeams Mission。

Executor 已完成机器验证和真实本地浏览器 rehearsal；Owner UAT 与 Coordinator 独立复验仍为 `PENDING`，所以本报告只能建议 `M1-01`～`M1-06` 为 `EVIDENCE_READY`，不能自行宣告规范状态 `ACCEPTED`。

## 二、交付范围

### 已包含

- tenant-aware 的 Organization、Identity、Brand、Product、Market、ChannelAccount、AccountMandate 图与复合外键、负向 fixture。
- CampaignBrief、GoalProfile、Claim/Evidence、ActivationPlan/Unit、MissionContract、ArtifactRevision、CapabilitySnapshot、PublishingSchedule、ScheduleOccurrence 的最小版本合同。
- canonical serialization、SHA-256 stable digest、首次创建 authority template、全部 governed Claim/产品/市场/tenant scope 校验、跨 Campaign 子对象 ID 归属锁、受控修订与 immutable 历史。
- PostgreSQL migration、repository、REST/OpenAPI create/list/get/update/reopen/mission-contract、并发幂等、ETag/lost-update 与 restart/down-up recovery。
- 默认 `zh-CN`、第二语言 `en` 的五主屏持久化状态，以及 empty/loading/blocked/needs-owner/saved/conflict/recovery/non-live 可见状态；412 使用显式三方 rebase，422 保持编辑器可修正。
- X、Bluesky、LinkedIn、小红书四套可编辑草稿、约束与 distinct preview；保存/重开一致。
- `ONCE` 与 `FREQ=DAILY|WEEKLY;INTERVAL=1..30;COUNT=1..50` 排程子集、IANA/DST/misfire/失效合同；preview 仅为 proposal，PUT 拒绝同次内容编辑并由服务端重派生全部 Schedule/Occurrence 字段；PostgreSQL 是唯一真源。
- 六成员 MissionContract compiler/adapter-input smoke；M2 Governed SHADOW Campaign SDD 生命周期文件已达 `SPEC_READY`，没有 M2 实现。

### 未包含或延期

- 真实 AgentTeams 六成员 Mission、DeepSeek/EvoLink/TikHub/Apify/RapidAPI、真实媒体/信号 Provider 或任何真实凭据。
- 真实 X、Bluesky、LinkedIn、小红书 Connector、发布、评论、回复、DM、抓取、自动互动或平台能力声明。
- AuditDecision、OwnerDecision、ActionGrant/Attempt/Receipt、到期 occurrence lease/heartbeat/worker execution；这些均属于后续 SDD。
- 生产认证、SSO/RBAC/RLS、托管部署、跨浏览器/无障碍认证、客户 UAT、增长、线索或收入结果。
- Push、PR、Deploy、线上配置、真实数据库 migration，以及 Executor 对双语规范进度真源的修改。

## 三、实现证据

| 范围 | 文件 / 对象 | Evidence |
|---|---|---|
| SDD 生命周期 | `docs/specs/SDD-001-CAMPAIGN-WALKING-SKELETON.md`、`docs/specs/sdd-001/` | Constitution → Specify → Clarify → Plan → Checklist → Tasks → Analyze 在实现前达 `SPEC_READY`；Spec Kit 仅作为方法，未安装 CLI。 |
| Domain / Graph | `packages/domain/src/graph-*`、`campaign-*`、`schedule.ts` | 版本化 schema/types、positive/negative fixtures、stable error codes、canonical digest、authority/revision/schedule invalidation 单元合同。 |
| Database | `packages/db/migrations/000002_*`～`000004_*`、`campaign-repository.ts` | tenant composite FK、append-only CampaignSnapshot/ArtifactRevision、transaction advisory-lock idempotency/child ownership、Schedule/Occurrence 唯一性与 project-scoped down。 |
| API / OpenAPI | `apps/api/src/server.ts`、`openapi.ts`、`.evidence/sdd-001/api-integration.json` | create/list/get/update/mission-contract、organization header、Idempotency-Key、ETag、422/409/412/428/503 与 PostgreSQL 重开。 |
| UI / i18n | `apps/web/src/components/campaign-workspace.tsx`、`globals.css`、`packages/i18n/` | 五屏共享 API 状态、四平台 editor/preview、排程展示、中文默认/英文深链；真实浏览器 desktop 与 390px rehearsal。 |
| AgentTeams boundary | `packages/mission-compiler/`、`packages/runtime-agentteams/` | 六角色、Leader orchestration-only、Producer/Auditor 分离、exact persisted digest、`live=false`、无 action permission；仅 compiler/adapter smoke。 |
| M2 准备 | `docs/specs/SDD-002-GOVERNED-SHADOW-CAMPAIGN.md`、`docs/specs/sdd-002/` | M2 Epic 已 `SPEC_READY`，只覆盖 Governed SHADOW Campaign，未实现 M2。 |
| Security / License | `scripts/secret-scan.mjs`、`package-source-evidence.mjs`、`docs/dependencies/` | secret positive fixture 与仓库 scan；956 package license inventory、CycloneDX SBOM；无新增第三方运行时依赖。 |

## 四、自动化验证

执行环境：Darwin arm64；Node.js `v24.16.0`、ICU `78.3`、tzdata `2026b`；npm `11.13.0`；Docker `29.4.0`；Docker Compose `v5.1.2`；Git `2.54.0`。命令均从本报告头指定 Worktree 执行。

| 检查 | 命令或协议 | 期望 | 实际 | 结果 |
|---|---|---|---|---|
| Reproducible install | `npm ci`；前后 `shasum -a 256 package-lock.json` | 安装成功且 lockfile 不变 | 前后均为 `de71bb2b075a766c80a703216d0bd1db71f98414031ea7cef0a327e0c8f482c5`；800 packages installed | `PASS` |
| Unit / Contract | `npm test` | 所有领域/API/UI/脚本正反合同通过 | 17 个 test file / 88 个 test；含 malformed/calendar-aware RFC 3339/platform discriminator、tenant/scope、跨 Campaign child ID、digest、首次创建 authority、Claim version/temporal readiness、server-derived schedule/misfire、三方 rebase/旧排程 preview 丢弃、DST、ETag/幂等负向 | `PASS` |
| Lint / Type | `npm run lint && npm run typecheck` | 无 lint/type error | 所有 workspace 通过 | `PASS` |
| PostgreSQL/API | `npm run verify:campaign-api` | create/replay/conflict/scope/schedule/restart/down-up/cleanup 通过 | `result=PASS`、`cleanup=PASS`；跨 Campaign child ID 与 forged occurrence 均 422；排程保存由服务端重派生；4 snapshots、6 artifact revisions、4 idempotency records、1 schedule、2 occurrences | `PASS` |
| Compose failure/recovery | `npm run verify:compose` | fresh、broken SQL、DB unavailable、health、restart/down-up Campaign+blob persistence、精确清理 | `.evidence/sdd-001/compose-verification.json` 记录 `result=PASS`、`cleanup=PASS` | `PASS` |
| Build / Storybook / static gates | `npm run verify` | lint/type/test/message/status/report/secret/license/SBOM/build/Storybook 全通过 | CI-equivalent 本地完整门禁通过；Next production 与 Storybook static build 成功 | `PASS` |
| Storybook Fix-1 browser runtime | `npm run check:storybook-browser-safety`；静态服务器 + 真实内置浏览器 | 四个 Story 可见，preview runtime console 无 warning/error，不携带 Node-only digest/runtime | 四个 manager URL 均显示预期内容，无 component/`Buffer` failure；四个 `iframe.html` 隔离预览均为 warning/error `0`；Story bundle `2,339` bytes，forbidden `[]` | `PASS` |
| AgentTeams image boundary | `npm run verify:agentteams-images` 与 `npm run check:runtime-profile` | 固定 v1.2.0 镜像/profile 合同，无 live Mission claim | 真实 image CLI/controlled adapter smoke 通过，`liveAgentTeamRun=false` | `PASS` |
| Browser product flow | 真实 Compose Web/API/PostgreSQL；desktop、`390 × 844`、`/en/mission`、console | create/edit/save/schedule/reopen/conflict recovery，四 preview distinct；document 不溢出；console 无应用错误 | 原 rehearsal v4 跨页面/英文深链保持四平台与失效历史；最终 authority-fix rehearsal 证明 fold 默认未选/按钮禁用、显式 LATER + HOLD_FOR_OWNER 保存、真实 412 后 local draft 不丢、三方 rebase 同时保留 server CTA 与 local X 文本并保存 v4；390px html/body 为 `390`；console warning/error `0` | `PASS` |
| Dependency / SBOM / secret | `npm run verify:dependencies && npm run check:secrets` | 无未知/禁用 license 或 Secret | 956 package entries，disallowed `[]`；tracked public source scan 通过 | `PASS` |
| Evidence manifest | `npm run evidence:manifest` | ignored machine evidence有 byte/SHA-256 清单 | `.evidence/sdd-001/run-manifest.json` 生成 | `PASS` |

GitHub Actions 未 Push，故只声明工作流与本地等价门禁，远端 CI run 为 `NOT_CLAIMED`。

### Fix-1｜静态 Storybook 浏览器运行时阻断修正

- **复现：**Coordinator 复验 Head `030f86b04824f17b01fe661599279283b1875399` 的 `/?path=/story/m1-four-platform-previews--x` 时，静态 build 虽通过，但 preview 显示 “The component failed to render properly”，console 为 `ReferenceError: Buffer is not defined`；构建同时出现 `node:crypto` externalized 警告。
- **根因：**`platform-preview.stories.tsx` 在浏览器 story 中值导入 `createDemoCampaignDocument()`；该 helper 会继续触发 canonical digest/UUID 的服务端 `node:crypto` 与 `Buffer` 路径。Vite 可产出静态文件，但真实浏览器没有 Node globals，因此 build-only 门禁产生假阳性。
- **修正：**Story 改用与原 DEMO_SEED 等价的静态、合成、browser-safe `PlatformArtifact` args，`@lumiclaw/domain` 只保留 type-only import；没有向客户端加入 Node crypto/Buffer polyfill，没有更改服务端 canonical serialization/digest/authority。新增 `check:storybook-browser-safety` 在每次 Storybook build 后拒绝 story bundle 重新引入 `node:crypto`、`Buffer`、`createDemoCampaignDocument` 或 `digestCampaign`。
- **真实浏览器：**manager 路径 `--x`、`--bluesky`、`--linked-in`、`--xiaohongshu` 均可见，且无 render/Buffer failure；对应 `iframe.html?id=...&viewMode=story` 的四个独立 preview runtime 均找到平台特征文案，console warning/error 各为 `0`。
- **门禁与回归：**`npm ci`、`npm run verify`、`npm run verify:campaign-api`、`npm run verify:compose`、`git diff --check` 全部通过；`package-lock.json` 仍为 `de71bb2b075a766c80a703216d0bd1db71f98414031ea7cef0a327e0c8f482c5`；API/DB/主产品代码未改动。

## 五、验收标准结果

| Criterion ID | 结果 | Evidence | 说明 |
|---|---|---|---|
| AC-01 | `PASS` | `packages/domain/src/*test.ts`、graph/campaign schema | 完整对象合同与 malformed/calendar-invalid RFC 3339/platform-content mismatch/tampered/forged create/cross-tenant/cross-Campaign child ID/expired/revoked/Product/Market 负向均有 stable code；合法闰日通过。 |
| AC-02 | `PASS` | canonical/digest 单元测试、API evidence | key order 稳定；受治理字段改变 digest；restart/down-up 未编辑重开保持 digest。 |
| AC-03 | `PASS` | migrations `000002`～`000004`、Compose/API evidence | 复合 scope FK、append-only history、idempotency、transaction-serialized child ownership、schedule/occurrence uniqueness 和本地 down 均存在。 |
| AC-04 | `PASS` | API/OpenAPI、repository、integration evidence | 所有 Campaign route 通过 PostgreSQL repository；Web 只经同源 proxy 调用。 |
| AC-05 | `PASS` | API unit/integration、real browser conflict rehearsal | 相同请求 replay；并发同 key 序列化；reuse/missing key、missing/stale ETag、cross-tenant 均无重复或覆盖；412 后本地草稿与 server 变更经显式三方 rebase 同时保留。 |
| AC-06 | `PASS` | Web reducer/component/story、message parity、browser | 五屏和两种 locale 共用真实 aggregate；required states 与 non-live 文案可见，无 raw key。 |
| AC-07 | `PASS` | platform adapters、Storybook stories、browser | 四个编辑模型/preview class 不同；server constraint/revision 保存后重开不变；Fix-1 的四个静态 Story 在真实浏览器隔离 preview runtime 中均可见且 console warning/error 为 0。 |
| AC-08 | `PASS` | `schedule.test.ts`、migration、API/browser evidence | ONCE/RRULE、IANA、无默认 fold、gap/fold、preview 跨时 misfire、forged occurrence、同次 content+schedule 拒绝、服务端重派生、replacement、edit invalidation 正反通过；没有执行态。 |
| AC-09 | `PASS` | mission-compiler 单元合同/runtime profile | exact digest、六角色、Leader/Producer/Auditor 分离、`live=false`、无 action 权限或 provider call。 |
| AC-10 | `PASS` | 真实 browser rehearsal、CSS fix | 390px 下 document/body 均无横向溢出；四平台 rail 只在自身滚动；desktop 可用，console 清洁。 |
| AC-11 | `PASS` | clean install、`npm run verify`、两项 integration | lock、static、unit/contract、report/status/message/secret/license/SBOM、build/Storybook、PostgreSQL/Compose 全通过；Storybook build 已串联 browser-safety bundle 门禁。 |
| AC-12 | `PASS` | `.evidence/sdd-001/compose-verification.json` | fresh/create/reopen/restart/down-up 持久；broken migration/DB unavailable 失败关闭；cleanup project-scoped。 |
| AC-13 | `PASS` | SDD-002 与 `sdd-002/` lifecycle | 状态 `SPEC_READY`、范围限 M2 Governed SHADOW，无实现 claim。 |
| AC-14 | `PASS` | 本报告、`check:report`、Git diff | 16 条 AC、命令、Pro、限制、Rollback、UAT、交接齐全；两份 status 相对 Base diff 为 0。 |
| AC-15 | `PASS` | source-package manifest 与 Pro URL | public-safe ZIP 在上传前校验 Base/files/bytes/SHA-256、路径/content secret scan 与排除项。 |
| AC-16 | `PASS` | code search、domain/runtime/Compose tests、non-claims | 无发布/互动/抓取/provider/到期执行/ActionGrant 路径；无客户、生产或业务结果 claim。 |

## 六、Owner 参与验收

### UAT-01｜创建、保存、重开与品牌事实边界

- **为什么需要 Owner 验证：**只有 Owner 能判断最小品牌矩阵、Claim/Evidence gap 与下一安全步骤是否足够清楚，而不只是技术上可保存。
- **前置条件：**checkout 到最终本地 Commit；Docker Desktop 运行；Node `24.16.0` / npm `11.13.0`；不准备 API Key；使用页面提供的 synthetic fixture。
- **安全 / 数据说明：**只填虚构或页面默认数据；不要填写真实公司、账号、客户、Evidence URL 或私密资料；不会调用外部平台。
- **操作步骤：**
  1. 在 Worktree 运行 `npm ci`，再运行 `LUMICLAW_WEB_PORT=3122 LUMICLAW_API_PORT=4122 docker compose --project-name lumiclaw-sdd001-owner up --build --detach --wait`。
  2. 打开 `http://127.0.0.1:3122/`，确认默认中文及 `DEMO_SEED / NOT_LIVE`。
  3. 创建 Campaign，记录 ID、version 与 digest；打开“准备品牌资料”，核对 Organization/Identity/Brand/Product/Market/AccountMandate 与 Claim/Evidence gap。
  4. 用两个浏览器标签打开同一 Campaign：A 修改 objective 但先不保存，B 修改 CTA 并保存；回到 A 保存，确认显示当前 server version/digest 且 A 的文本仍在。点击显式合并按钮，再保存并刷新，确认 A 的 objective 与 B 的 CTA 同时存在。
  5. 刷新页面；执行同一 Compose project 的 `restart postgres api web`，再重开同一 Campaign。
  6. 确认 Campaign ID、最后保存的 objective/CTA、四个 ActivationUnit、version/digest 均一致。
- **期望可见结果：**Owner 能解释每个账号代表哪个 Identity/Product/Market、哪个 Claim 可用于预览、哪个 Evidence gap 仍需 Owner；412 不丢本地或非冲突 server 编辑；刷新/重启不丢数据，也不出现 live/published/approved business claim。
- **失败信号：**Campaign 丢失、无编辑却 digest 改变、旧 ETag 覆盖新版本、身份/账号关系不清、Claim gap 被隐藏、raw error/key、外部网络动作或 live 状态。
- **需要返回的证据：**创建页与重开页截图、Campaign ID/version/digest、书面 `UAT-01 PASS` 或失败的 AC ID。
- **清理 / 回滚：**`docker compose --project-name lumiclaw-sdd001-owner down` 保留本地 volume；若 Owner 明确不要保留 fixture，才加 `--volumes --remove-orphans`。不得全局 prune。
- **Owner 结果：**`PASS`（2026-08-04）。Owner 接受本阶段是可持久化的功能骨架，不把当前视觉、布局或操作流程视为最终产品设计；创建/重开、事实边界与 non-live 语义的工程项由 Coordinator 独立浏览器与数据库复验覆盖。

### UAT-02｜四平台预览、排程、移动端与英文深链

- **为什么需要 Owner 验证：**平台差异、时间语义和移动端可理解性属于真实使用判断，机器测试不能代替 Owner 决策。
- **前置条件：**UAT-01 Campaign 已存在；浏览器能切换 desktop 与 `390 × 844` responsive mode。
- **安全 / 数据说明：**编辑只保存在本机 PostgreSQL；preview 不是平台实况；Schedule 不会到期执行。
- **操作步骤：**
  1. 打开 `/mission`，依次编辑 X、Bluesky、LinkedIn、小红书各一个可见字段。
  2. 核对四个 preview 布局不同，并显示 target account/identity、execution mode、CapabilitySnapshot 时间、约束/违规与 native-rendering disclaimer。
  3. 保存并刷新，确认四项修改仍在；创建 `Asia/Singapore` 的 ONCE 或受约束 RRULE，确认 local wall time、IANA zone、UTC、fold/misfire、occurrence count 可见。
  4. 保存 schedule 后确认它为 `ACTIVE`；再编辑任一平台正文并保存，确认旧 schedule 变为 `INVALIDATED`，没有执行或发布提示。
  5. 用文档化的 New York DST gap/fold 输入核对 gap 被拒绝，fold 必须明确 earlier/later（可复核自动化 evidence，不要求向外部系统提交）。
  6. 在 `390 × 844` 下复查创建、重开、composer、constraint error、schedule；确认 document 无横向滚动，平台 tab rail 仅在自身横向滚动。
  7. 打开 `/en/mission`，确认 locale 为 English，但 Campaign、content language、target market、schedule timezone 没被翻译标签替换；检查 console 无应用 warning/error。
- **期望可见结果：**四套 distinct editor/preview 保存后重开；排程语义明确且 non-executing；编辑使旧排程失效；desktop/390px/en 均可用。
- **失败信号：**四个平台只是同一 generic preview、保存丢失、约束被前端绕过、schedule 显示 Running/Published、silent fold、document width 大于 viewport、locale 切换丢 Campaign 或 console application error。
- **需要返回的证据：**四平台 desktop、ACTIVE/INVALIDATED schedule、390px、`/en/mission` 四张截图，console 摘要，以及书面 `UAT-02 PASS` 或失败 AC ID。
- **清理 / 回滚：**同 UAT-01；普通 `down` 保留数据，只有明确重置此 project fixture 时才删除它的 named volumes。
- **Owner 结果：**`PASS`（2026-08-04，带已接受限制）。Owner 认可四平台与排程能力作为功能预演，但指出当前界面视觉和流程不符合最终用户体验；尤其顶部“需要你补全依据”与排程按钮禁用同时出现，会让用户误以为 Claim/Evidence 阻止排程预览。源码复核确认 readiness 只阻止未来执行，排程预览实际仅在存在未保存内容或 `foldPreference` 未选择时禁用。该问题记为 `UX-M1-001`：后续高保真与交互收敛必须分离“执行资格”和“排程草稿”，并在禁用按钮旁显示准确、可操作的原因。

## 七、ChatGPT Pro 双代理记录

- 对话链接：<https://chatgpt.com/c/6a70683f-8a6c-83ea-bf6d-7f3a533645a6>。
- 上传前快照：Base `4568277f9dc8e302141b93bb38ded20200fb31a9`，Head `7632175c0638729e3ddf10098e85292613f448e1`，178 files，`862,473` bytes，SHA-256 `166dcfcadc44e0cb5414f1d5e4c9cde83da48e6d8ffd504497e88384d9132afc`；filename/content secret scan `PASS`，排除 `.git`、`node_modules`、build/cache/database/runtime/browser state、`.env`、API Key、Token、私钥、Cookie、客户/私有资料。
- 第二轮修正包：Head `e9ebeebd2f99958e99119b8017fdab644b415462`，180 files，`886,838` bytes，SHA-256 `968704a9e4c2ea8510536d1d96b36e26b48e9bf811db62ea5fc8fc77b8cecc39`，secret/path scan `PASS`。Pro 再次返回 `CHANGES_REQUIRED`、无 P0；确认 P1-5/P1-7 已关闭，指出 POST 首次 authority、Organization/Brand 修订上下文、保存时 misfire/fold 默认、跨 Campaign child owner、412/422 恢复、platform-content/date-time/OpenAPI graph 与双语成熟度仍需核对。
- 第三轮源码包：Head `bc632fc5b0158840aff49e0b086ab2a613eb67a9`，181 files，`892,468` bytes，SHA-256 `7d6392ad4df8f8443d9d55aa3e667bd21902ba7f6837e74ef71db57fd19ef422`，secret/path scan `PASS`。Pro 独立确认 bytes/files/SHA/Head、CRC、无路径穿越/绝对路径/符号链接；结论 `CHANGES_REQUIRED`、无 P0，确认 P1-1/P1-2/P1-3/P1-5/P1-7/P1-8 已关闭，残余 P1-4 是 conflict-refresh 失败后的恢复与最新草稿合并，P1-6 是 `Date.parse` 会规范化不存在的日历日期。
- 第四轮针对性终审包：Head `55c2fdd493e4f6dc83c8e1b1ffae077a5ae8a5d8`，182 files，`897,102` bytes，SHA-256 `cbb86c7149d237b3fbd27639b19fc52e7e1df4c1b3422e40ae6c2fad106d263e`，secret/path/CRC scan `PASS`。Pro 结论为 `READY_FOR_COORDINATOR_REVIEW`，P0/P1 均为 0，明确将 P1-4/P1-6 标为 `CLOSED`；其还直接执行了附件内 RFC3339 与 rebase helper 定向反例。该结论只覆盖公开安全附件源码，不替代本地证据、Owner UAT 或 Coordinator 验收。
- Pro 是不受信任外部 reviewer，只能检查该公开安全 ZIP，无法访问本地仓、Docker、浏览器或私有真源；其输出没有被直接视为正确。
- Pro 首轮结论为 `CHANGES_REQUIRED`、无 P0，共八项 P1：服务端治理权可被 aggregate body 绕过；schedule 合同/同次保存假阳性/伪造 occurrence；JSONB 与 projection 双真源；并发幂等与 Web 重试竞态；时间窗口 readiness 不在重开时复算；nested/exact schema 不够严格；preview 上下文、字段与视觉证据不足；CI/证据路径与成熟度清单过宽。另有一项 P2：依赖审计仍含 3 个 high。
- Codex 修正：锁定 Evidence/CapabilitySnapshot/ActivationUnit/AccountMandate 与 approved Claim authority，并对首次 POST 的 authority template、全部非草稿 Claim、Organization/Brand governed context 失败关闭；Claim/ArtifactRevision 由服务端增版；calendar-aware RFC 3339/discriminated schema、全局 ID 唯一、exact four capability/account/unit/artifact、exact six Mission roles、duplicate RRULE/伪造 occurrence 拒绝；transaction advisory lock + idempotency expiry/replay；repository 更新 graph projections 并在重开校验 persisted digest/ETag、实时复算 readiness；Schedule PUT 以保存时 clock 重派生、替换保留历史；Web fold 无默认、显式 misfire、未知结果复用 key、412 三方 rebase（refresh 失败只重试 GET，应用时以最新 local draft 重算）、422 原位修正，并补齐四平台上下文/字段/Storybook。
- CI/证据修正：工作流改用 SDD-001 路径并执行 PostgreSQL/API integration；secret scan 生成结构化 evidence；run manifest 在缺失或 FAIL 的 API/Compose/AgentTeams/browser/license/secret/source-package/SBOM 时拒绝写入 `ENGINEERING_VERIFIED`。
- 第三轮后的 P1-4 已由 `d4973d6` 与 `7e6c4ed` 收口：412 后当前版本 GET 失败保持 blocked/local draft，Retry 只重试 GET；应用 merge 时根据最新 local draft 重算。P1-6 由共享闰年/月天数校验收口，Memory 与真实 PostgreSQL API 对 `2026-02-31` 稳定返回 422。第四轮针对性终审确认两项均关闭。
- 上述修正由本地 88 个单元/合同测试、真实 PostgreSQL/API integration、Compose failure/recovery、AgentTeams controlled image smoke 和真实浏览器 desktop/390px/412-rebase 独立复验；Pro 没有访问本地 Docker/浏览器，也没有被授予任何 Secret 或外部动作权限。

## 八、失败、限制与非声明

- **已发现并修复：**M0 的 390px document overflow（曾为 `scrollWidth=872`）通过 grid `minmax(0,1fr)` 与移动布局约束修复；最终 document/body 为 `390/390`。Compose 重启 PostgreSQL 时，Pool idle client error 曾令 API 退出；增加 pool error handling 后 failure/recovery 门禁通过。外部复核后继续修复首次创建 authority、全部 governed Claim、Organization/Brand 修订上下文、跨 Campaign child ID、保存时排程重派生、无默认 fold、412/422 恢复、最新草稿 rebase、platform discriminator、calendar-aware RFC 3339 与严格 OpenAPI graph。Fix-1 进一步修复了 Storybook static build 通过但浏览器因 `Buffer` 缺失而崩溃的假阳性，并新增 bundle 防回归门禁。
- **Known limitations：**Story 组件所在的四个隔离 preview runtime console 均无 warning/error；Storybook `10.5.5` 的 manager 壳自身仍会从 `sb-manager/globals-runtime.js` 输出一条 v11 `PopoverProvider ariaLabel` 弃用 warning。该提示不来自 LumiClaw story/component，本轮未以 console monkeypatch 隐藏，也未为消除工具壳提示而扩大至 Storybook 升级。
- **Known limitations：**M1 的 tenant boundary 是显式 organization header + row/FK validation，不是生产 authentication/authorization/RLS；只适用于本地 engineering fixture。
- **Known limitations：**RRULE 只支持有界 DAILY/WEEKLY 子集；时区解析依赖 Node `v24.16.0` / ICU `78.3` / tzdata `2026b`，跨 runtime conformance 与未来 tzdata 更新需重新验证。
- **Known limitations：**390px 平台 tab rail 允许自己的 bounded horizontal scroll；验收通过的是 document 无严重横向溢出，不是所有内容绝不横向滚动。
- **Known limitations：**`npm audit --audit-level=high` 仍报告 3 个 inherited high，来自 Next `16.2.12` 的 bundled `postcss@8.4.31` 与 optional `sharp@0.34.5`；npm 无安全同主版本自动修复并错误建议降至 Next 9。生产发布保持阻断。
- **Known limitations：**没有 Push，因此 GitHub Actions 远端 run 未发生；Pro 无法运行本地最终代码；Owner UAT 和 Coordinator 独立复验仍 `PENDING`。
- **仍为 `PLANNED`：**M2 live six-member SHADOW Mission、Provider/Audit/Owner review；M3 ActionGrant/Operator/Receipt 和 schedule worker；M4 response；M5 learning。
- **明确 `NOT_CLAIMED`：**真实平台连接/能力/动作、客户 UAT、外部校准、production readiness、安全/合规认证、增长、线索、收入或任何商业结果。
- **外部动作审计：**没有真实平台/Provider 请求，没有 Secret，没有真实账号/客户数据，没有 Push/PR/Deploy/线上配置/真实数据库 migration。

## 九、回滚与恢复

- **代码 Rollback：**在本地分支对 SDD-001 提交逐个执行常规 `git revert <commit>`；不重写历史，不使用 `reset --hard`。
- **普通停止/恢复：**对明确 project name 执行 `docker compose --project-name <name> down` 可保留 named volumes；再次 `up --detach --wait` 从 PostgreSQL 重开 Campaign。
- **本地测试数据 Rollback：**仅在确认不要保留 synthetic fixture 时，对该 SDD project 执行 `down --volumes --remove-orphans`；不得全局 Docker prune。
- **Migration Rollback：**`000004` → `000003` → `000002` 仅允许对本项目 local test DB 逆序执行；它会删除 M1 Schedule/Campaign/graph 数据，必须先由 Owner 明确确认，无任何外部/生产 DB 授权。
- **并发/未知结果恢复：**网络中断后使用原 Idempotency-Key replay，或按已知 Campaign ID GET 重开；不得盲目换 key 重复 create/save。
- **冲突恢复：**412 时原 local draft 不被 GET 覆盖；Web 对 base/local/server 做三方 rebase，显式按钮保留 local conflict choice 与非冲突 server 变更，再以新 Idempotency-Key/If-Match 保存；真实浏览器演练验证 server CTA 与 local X 文本同时保留。
- **Schedule 恢复：**内容/account/time/rule 变更会保留旧 history 并将未来 occurrence 标记 `INVALIDATED`；M1 不存在需要 reconciliation 的 Connector 外部副作用。

## 十、执行任务状态交接

Executor 未修改 `IMPLEMENTATION-STATUS.md` 或 `IMPLEMENTATION-STATUS.zh-CN.md` 的规范状态；相对 Base 的两文件 diff 为 0。建议由 Coordinator 独立复验和记录 Owner 决定后更新。

| Module ID | 当前规范状态 | 建议新状态 | 原因 / Evidence |
|---|---|---|---|
| M1-01 | `IN_PROGRESS` | `EVIDENCE_READY` | tenant-aware 最小领域图、composite FK、正反 fixture 通过。 |
| M1-02 | `NOT_STARTED` | `EVIDENCE_READY` | Campaign/Claim/Evidence/Activation/Mission/ArtifactRevision、canonical digest 与 scope/expiry 负向通过。 |
| M1-03 | `NOT_STARTED` | `EVIDENCE_READY` | PostgreSQL/API create/save/reopen、OpenAPI、ETag、并发 idempotency、tenant isolation、restart recovery 通过。 |
| M1-04 | `NOT_STARTED` | `EVIDENCE_READY` | 五屏真实 shared state、双语状态、recovery 与 390px document overflow 修复通过。 |
| M1-05 | `NOT_STARTED` | `EVIDENCE_READY` | 四平台可编辑、distinct native-like preview、约束、保存重开和视觉 rehearsal 通过。 |
| M1-06 | `NOT_STARTED` | `EVIDENCE_READY` | PostgreSQL Schedule/Occurrence、ONCE/RRULE/IANA/DST/misfire/replacement/invalidation、无执行路径通过。 |

状态交接摘要：

- Worktree / Branch / Base / Task：见报告头；全程只使用 Coordinator 指定的 SDD-001 Worktree。
- Changed Files：从 Base 起集中于 `apps/api`、`apps/web`、`packages/domain`、`packages/db`、`packages/mission-compiler`、i18n、scripts、Compose、Storybook、SDD-001/M2 规范与本报告；两份 canonical status 无改动。
- Commits：规范与实现小步提交从 `04a73a1` 到最终本地 Head；精确列表和 Head 由最终 `STATUS_HANDOFF` 原样给出。
- Push / PR / Deploy / external action：全部 `NO`。
- 未提交状态：最终 handoff 前必须为 clean；源码 ZIP 与 raw evidence 位于 gitignored `.evidence/sdd-001/`。
- Blocker：无。Owner 已接受本阶段功能骨架边界；`UX-M1-001` 是后续必须收口的可用性债务，不是 M1 持久化功能合同的阻断项。
- 下一候选步骤：Coordinator 验收 M1 后，独立任务实现已 `SPEC_READY` 的 `SDD-002 Governed SHADOW Campaign`；本任务不开始 M2 实现。

## 十一、Coordinator 验收决定

- Executor 自动化验证：`PASS`
- Coordinator 独立复验：`PASS`（Git/ZIP、源码边界、`npm run verify`、PostgreSQL/API、Compose、390px、双语、排程、四平台静态 Storybook 浏览器运行时）
- 是否需要 Owner 验收：`YES`
- Owner 决定：`PASS`（2026-08-04；接受当前仅为功能骨架，并记录 `UX-M1-001`）
- 最终模块状态：`M1-01`～`M1-06 ACCEPTED`
- 下一 Module / SDD：`SDD-002 Governed SHADOW Campaign`；由 Coordinator 创建独立 Worktree 与 Executor 任务。
