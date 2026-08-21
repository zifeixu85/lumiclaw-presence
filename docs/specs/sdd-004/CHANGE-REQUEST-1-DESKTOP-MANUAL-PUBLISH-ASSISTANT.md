# SDD-004 CR1 — Desktop manual publish assistant

> Status: `SPEC_READY`
> Date: `2026-08-16`
> Authority: LumiClaw product/design Owner override
> Parent: `docs/specs/SDD-004-ASSISTED-HANDOFF-FOUNDATION.md`
> Module: `M3-00`（本 CR 不单独修改进度；Coordinator 独立复验后规范状态为 `EVIDENCE_READY`）

## 1. Override

本 CR 在当前用户路径、用户文案、当前动作与验收标准冲突时优先于父 SDD。内部 domain/registry 可以保留稳定的 `PLATFORM_READY`、`ASSISTED_HANDOFF`、`GOVERNED_DIRECT` code 及未来能力信息，但它们不是当前用户可选择的三档产品模式。

当前唯一用户路径是本地部署产品中的桌面浏览器手动发布助手：Owner 批准精确版本后进入“去发布”，确认目标平台和预期账号，复制正文，按顺序复制或下载图片，打开 allowlisted 官方发布入口，并由用户手工完成平台操作。LumiClaw 不预填网页正文或媒体，不上传，不点击发布，不读取 Cookie/密码，不执行导航。

## 2. Superseded parent sections

以下父 SDD 表述被本 CR 替代：

- §1 中把三层能力作为当前可见产品选择的表述；三层只保留为内部合同和未来能力。
- §3、§4、§5 中 X/Threads text intent、LinkedIn share-offsite 的正文/URL query 预填，以及当前用户提交 proof/URL 的表述。
- §8 中 Threads intent probe 失败才降级的当前路径；当前无论 probe 结果都使用手动桌面路径。
- AC-02、AC-03、AC-06、AC-08 与 §10/§14 中与网页预填、URL/截图回填、当前 `HANDOFF_RECONCILED` 或三档可见能力冲突的部分。

未被列出的 exact approved revision、ordered media digest、account/capability/expiry fail-closed、无证据不声称已发布、UNKNOWN 不盲重发、零外部动作、双语/安全/许可证边界继续有效。

## 3. Current contract

### Current path

稳定内部 code：`MANUAL_DESKTOP_ASSISTANT`。

每个成功 package 只包含以下手动动作：

1. `COPY_TEXT`；
2. `COPY_OR_DOWNLOAD_MEDIA`；
3. `OPEN_OFFICIAL_PUBLISH_PAGE`；
4. `MANUAL_COMPLETE`。

账号确认是 package 创建前的 fail-closed gate，不是推断浏览器当前登录账号。官方入口必须是 HTTPS allowlist，且不得携带正文、链接、hashtags、via 或媒体预填 query。Builder 只返回数据，不能实际导航。

### Current state

~~~text
USER_ACTION_REQUIRED
→ HANDOFF_OPENED
→ AWAITING_RECONCILIATION
~~~

- 明确失败：`FAILED`；
- 匹配不唯一或外部事实不确定：`UNKNOWN_RECONCILIATION_REQUIRED`；
- 当前合同没有 `PUBLISHED`；
- 当前合同没有通向 `HANDOFF_RECONCILED` 的 transition；
- `UNKNOWN_RECONCILIATION_REQUIRED` 只有核对，不得 resend。

### Reconciliation boundary

当前不要求用户输入发布 URL、上传截图或点击“我已发布=成功”。未来由持久化定时任务通过官方或经过审查的第三方只读 API 获取目标账号新增内容，并按 account、time window、exact Revision 内容/media digest 等证据匹配；该能力是 `PLANNED`，本 SDD 不实现 API、数据库、worker、抓取或自动匹配，也不声明已发布。

## 4. Current UI boundary

- 中文优先；普通 UI 使用“去发布”“复制正文”“复制/下载图片”“打开官方发布页”“等待系统核对”等用户语言。
- 不显示 Platform-ready / Assisted / Direct 三档，不显示 Direct、一键发布、自动发布或可用 Badge。
- 不提供 URL/截图回填框。
- 不做移动端、Native Share 或响应式手机发布路径。
- UI evidence 只新增隔离 Story/组件，不修改 Owner 正在收敛的核心页面。
- AI 团队一级导航、六 Agent 中文呈现、Skills 与定时任务属于下一阶段已冻结方向，不在 SDD-004 实现。

## 5. Revised acceptance criteria

| ID | Binary criterion |
|---|---|
| CR1-AC-01 | 六平台 registry 均有稳定 code、`MANUAL_DESKTOP_ASSISTANT` current path、prefill 全 false、Direct 全 false；未来分层不会出现在当前 UI。 |
| CR1-AC-02 | X、Threads、LinkedIn、Instagram builder 对有效 exact-approved 输入只返回四个手动动作与 allowlisted HTTPS 官方入口，入口不含正文/链接/media 预填 query，也不执行 navigation。 |
| CR1-AC-03 | 过期/错平台/错账号/错 capability/未确认账号/digest mutation 全部使用稳定 code fail closed。 |
| CR1-AC-04 | Package 绑定 exact approved revision digest、ordered media digests、platform、account、capability identity 与 expiry；mutation 改变或破坏 package identity。 |
| CR1-AC-05 | 当前状态只覆盖 `USER_ACTION_REQUIRED → HANDOFF_OPENED → AWAITING_RECONCILIATION`、`FAILED`、`UNKNOWN_RECONCILIATION_REQUIRED`；无 `PUBLISHED`、无 current reconciled、UNKNOWN 无 resend。 |
| CR1-AC-06 | 隔离 Story/组件只展示桌面“去发布”单一路径、至少四个平台差异、中文优先、账号/Revision、复制/下载/打开/等待核对；无三级模式、URL 输入、移动端或真实动作。 |
| CR1-AC-07 | 父 SDD AC-07、AC-09、AC-10 继续通过，exact-four Campaign invariant、message parity、安全与依赖边界不变。 |

## 6. Owner UAT

Owner 只读检查隔离 Story：

1. 确认页面只有桌面“去发布”路径，没有 Direct/一键发布/自动发布或三档选择；
2. 检查至少 X、Threads、LinkedIn、Instagram 的目标平台、预期账号、exact Revision 与不同手工限制；
3. 确认操作只写“复制正文、复制/下载图片、打开官方发布页、人工完成”；
4. 确认没有 URL/截图回填，“人工完成”之后只显示“等待系统核对/尚未确认”；
5. 检查 UNKNOWN 只提供核对提示，没有重新发布；
6. 返回一张 public-safe 桌面截图和 `PASS`，或给出精确失败项/文案。

移动端、真实账号、真实平台动作、只读定时对账和 `HANDOFF_RECONCILED` 不属于本次 UAT。

## 7. Non-claims and rollback

- `PLANNED`：定时只读账号同步、Revision 自动匹配、当前 UI 之外的内部 reconciled transition、Direct、一键发布、移动端/Native Share、AI 团队一级导航。
- `NOT_CLAIMED`：任何已发布结果、真实账号连接、URL/截图 proof、客户 UAT、reach/lead/revenue。
- 回滚仍为纯代码：删除新增 domain contract、隔离 Story/组件、双语文案和本 CR；没有 Migration、凭据或外部状态需要补偿。
