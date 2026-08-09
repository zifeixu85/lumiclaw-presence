# M3-01 ActionGrant + Outbox — 冻结对齐文档

> Status: `PROPOSED` → 待与合作方对齐后改为 `FROZEN`
> Milestone: `M3`
> Progress module ID: `M3-01`
> 冻结范围: Demo Golden Path / ViewModel & API / 状态码和错误码 / Direct-Handoff-UNKNOWN 行为边界
> 对应代码分支: `dtg-lumiclaw`
> 最后更新: `2026-08-09`

---

## 1. Demo Golden Path

### 1.1 当前代码已实现

当前 `DEMO_SEED` 模式下的端到端链路（7 步）：

```
 Step 1               Step 2               Step 3               Step 4
┌──────────┐  POST   ┌──────────┐  INSERT  ┌──────────────┐  poll  ┌────────────────┐
│  Owner   │ ──────→ │  API     │ ───────→ │ PostgreSQL    │ ←───── │ action-operator│
│ (Web UI) │         │ :4001    │  原子事务 │ action_grants │        │ :4002          │
└──────────┘         └──────────┘          │ outbox        │        │ 独立进程 无LLM  │
                                           └──────────────┘        └───────┬────────┘
                                                                            │
 Step 5                   Step 6                   Step 7                   │
┌──────────────┐        ┌──────────────┐        ┌──────────────┐           │
│ action_receipt│ ←──── │ completeOutbox│ ←──── │ Connector    │ ←─────────┘
│ (不可变)      │        │ (COMPLETED)  │        │ .execute()   │
└──────────────┘        └──────────────┘        │ Bluesky mock │
                                                 └──────────────┘
```

具体步骤（均在 `DEMO_SEED` 模式、`live: false`、`externalActionAllowed: false` 下运行）：

1. **Owner 创建 Campaign**：Web UI → `POST /api/v1/campaigns`，返回 `{document, etag, digest}`
2. **Owner 签发 ActionGrant**：Web UI → `POST /api/v1/campaigns/:id/action-grants`，需要 `Idempotency-Key` + `If-Match`，服务端生成 `ActionGrant`（状态 `ISSUED`，15 分钟 TTL）+ `OutboxRecord`（状态 `PENDING`），在同一 PostgreSQL 事务中原子写入
3. **action-operator 轮询**：`OutboxConsumer` 每隔 2 秒 `claimNextOutbox`，使用 `FOR UPDATE SKIP LOCKED` 行级锁领取一条 `PENDING` 记录
4. **验证 Grant**：`isGrantConsumable()` 检查状态 + 过期时间；`digestActionGrant()` 检查签名完整性
5. **分发 Connector**：根据 `grant.platform` 查找 `connectorByPlatform[platform]`，当前注册了 Bluesky（DIRECT）、LinkedIn（NATIVE_HANDOFF）、小红书（NATIVE_HANDOFF）
6. **写入 Receipt**：Connector 成功 → `completeOutbox` → Outbox 变 `COMPLETED` + 写入 `action_receipts`（触发器保证不可变）
7. **查询 Timeline**：`GET /api/v1/campaigns/:id/receipts` 返回该 Campaign 下所有 Receipt

**已实现的 Fixture：**
- `createDemoCampaignDocument()` → 标准 Demo Campaign（含 Bluesky activation unit）
- `createDemoActionGrant(campaign, now)` → 生成一个 Bluesky DIRECT grant（15min TTL）+ 配套 OutboxRecord
- 幂等键重放：相同 key 第二次请求 → 返回 200 + `Idempotency-Replayed: true`
- 幂等键冲突：相同 key 不同 body → 抛出 `IDEMPOTENCY_KEY_REUSED`

**已落地的证据：**
- `.evidence/m3-01/action-grant-integration.json`：`verify-m3-action-grant.ts` 运行结果，**20/20 PASS**（覆盖创建、幂等、撤销、消费、篡改拒绝、不可变性）

---

### 1.2 需要对齐的决策

| # | 决策点 | 当前状态 | 需要确认 |
|---|---|---|---|
| G1 | Golden Path 的步骤顺序是否准确？ | 7 步如上 | 有无遗漏步骤？比如 Owner 是否需要在签发 Grant 之前做一次 "预览确认"？ |
| G2 | `externalActionAllowed: false` 何时变 `true`？ | 当前所有响应硬编码 `false` | 需要什么前置条件？（真实 API Key？Owner Credential？production 部署？） |
| G3 | Demo 模式的 Connector 是永久 mock 还是需要有真实沙箱？ | Bluesky/LinkedIn/小红书全 mock | M3 阶段是否需要至少一个 Connector 接入真实 API 沙箱？ |
| G4 | `mode: 'DEMO_SEED'` 和 `live: false` 何时切换到生产模式？ | 硬编码 | 切换条件是什么？是一次性全局开关还是按 Organization 粒度？ |
| G5 | verify-m3-action-grant.ts 的 20 项检查是否覆盖了 Golden Path 的全部关键节点？ | 20/20 | 合作方是否认可这个验证脚本作为 Golden Path 的权威判定？ |

---

## 2. 平台 Action ViewModel / API

### 2.1 当前代码已实现

**API 端点清单**（全部挂载在 `/api/v1/campaigns/:campaignId` 下）：

| 方法 | 路径 | 请求头 | 成功 HTTP | 响应 code | 用途 |
|---|---|---|---|---|---|
| `GET` | `/action-grants` | `x-lumiclaw-organization-id` | 200 | `ACTION_GRANT_LIST` | 列出该 Campaign 下的 Receipt（作为 Grant 的代理） |
| `POST` | `/action-grants` | `Idempotency-Key`, `If-Match`, `x-lumiclaw-organization-id` | 201 | `ACTION_GRANT_ISSUED` | 签发新的 ActionGrant + OutboxRecord |
| `POST` | `/action-grants` | 同上（重放） | 200 | `ACTION_GRANT_REPLAYED` | 幂等重放已有 Grant |
| `DELETE` | `/action-grants/:grantId` | `x-lumiclaw-organization-id` | 200 | `ACTION_GRANT_REVOKED` | Owner 撤销未消费的 Grant |
| `GET` | `/receipts` | `x-lumiclaw-organization-id` | 200 | `RECEIPT_LIST` | 列出该 Campaign 下所有 Receipt（Timeline） |
| `GET` | `/receipts/:receiptId` | `x-lumiclaw-organization-id` | 200 | `RECEIPT_DETAIL` | 查看单条 Receipt 详情 |
| `GET` | `/receipts/stream` | `x-lumiclaw-organization-id` | 200 | （SSE 事件流） | SSE 实时推送 Receipt 状态变更 |
| `POST` | `/receipts/:receiptId/reconcile` | Body: `{method, notes?}` | 200 | `RECEIPT_RECONCILED` | 对 UNKNOWN 状态的 Receipt 进行对账 |

**响应 ViewModel（以 POST /action-grants 为例）：**

```jsonc
// 成功 (201)
{
  "code": "ACTION_GRANT_ISSUED",
  "mode": "DEMO_SEED",
  "live": false,
  "externalActionAllowed": false,
  "grant": {
    "id": "01908900-...",                // DomainId (UUIDv7)
    "organizationId": "01908900-...",
    "campaignId": "01908900-...",
    "scheduleOccurrenceId": "01908900-...",
    "artifactRevisionId": "01908900-...",
    "activationUnitId": "01908900-...",
    "schemaVersion": 1,
    "platform": "BLUESKY",               // X | BLUESKY | LINKEDIN | XIAOHONGSHU
    "executionMode": "DIRECT",           // DIRECT | NATIVE_HANDOFF
    "status": "ISSUED",                  // ISSUED | CONSUMED | EXPIRED | REVOKED
    "issuedAt": "2026-08-08T12:00:00.000Z",
    "expiresAt": "2026-08-08T12:15:00.000Z",  // 15 min TTL
    "consumedAt": null,
    "revocationReason": null,
    "grantDigest": "abc123..."           // SHA-256 签名，64 字符 hex
  },
  "outbox": {
    "id": "01908900-...",
    "organizationId": "01908900-...",
    "aggregateType": "ACTION_GRANT",
    "aggregateId": "01908900-...",       // = grant.id
    "schemaVersion": 1,
    "state": "PENDING",                  // PENDING | PROCESSING | COMPLETED | FAILED
    "lockedBy": null,
    "lockedAt": null,
    "attempts": 0,
    "createdAt": "2026-08-08T12:00:00.000Z"
  }
}
```

```jsonc
// Receipt 响应
{
  "code": "RECEIPT_LIST",
  "mode": "DEMO_SEED",
  "live": false,
  "receipts": [{
    "id": "01908900-...",
    "organizationId": "...",
    "actionGrantId": "...",
    "schemaVersion": 1,
    "platform": "BLUESKY",
    "executionMode": "DIRECT",
    "state": "PUBLISHED",                // PUBLISHED | HANDOFF_CONFIRMED | FAILED | UNKNOWN
    "platformUri": "https://bsky.app/profile/.../post/...",
    "platformCid": "bafyrei-...",
    "handoffSteps": null,                // string[] 仅 NATIVE_HANDOFF
    "unknownReason": null,               // string 仅 UNKNOWN
    "reconciledAt": null,
    "reconciliationMethod": null,        // PLATFORM_QUERY | OWNER_MANUAL
    "createdAt": "2026-08-08T12:00:01.000Z"
  }]
}
```

**SSE 事件协议**（`receipt-stream.ts`）：

| SSE event | 触发时机 | data 内容 |
|---|---|---|
| `receipt_created` | `completeOutbox` 成功后 | `{event: "receipt_created", receipt: ActionReceipt}` |
| `:heartbeat` | 每 15 秒 | 空（SSE comment line） |

**Web 前端现状：**
- M1 阶段明确不涉及 ActionGrant UI：`reviewHint: 'M1 不创建 OwnerDecision、ActionGrant 或 Receipt'`
- `campaign-workspace.tsx` 中无任何 Grant/Receipt UI 组件
- `shadow-mission-workspace.tsx` 中有 `createsActionGrant: false` 的显式声明和 `noGrant: 'Owner Review ≠ ActionGrant'` 的文案

---

### 2.2 需要对齐的决策

| # | 决策点 | 当前状态 | 需要确认 |
|---|---|---|---|
| V1 | M3 阶段前端需要新增哪些 UI 组件？ | 无 | Grant 签发按钮？Receipt Timeline 时间线？撤销确认弹窗？对账表单？ |
| V2 | ViewModel 的字段全集是否足够？ | 如上 | 是否缺少字段？比如 `grant.consumedAt` 目前只在代码类型中定义但从未在前端展示 |
| V3 | `GET /action-grants` 目前返回的是 Receipt 列表而非 Grant 列表——这是有意为之还是 Bug？ | 代码注释写 `"return receipts as proxy for grant list"` | 是否需要一个真正的 Grant 列表端点？ |
| V4 | SSE 目前 fan-out 给所有客户端（未按 campaignId 过滤） | 代码注释标注了 `"for simplicity we fan-out to all"` | M3 阶段是否需要精确过滤？ |
| V5 | API 返回的 `mode`/`live`/`externalActionAllowed` 字段——前端是否需要用它们来控制 UI 状态？ | 目前硬编码 | 前端需要基于这些字段做条件渲染吗？ |
| V6 | `POST /action-grants` 创建 Grant 时，是否需要让 Owner 选择 platform 和 executionMode？ | 目前写死 Bluesky DIRECT | 是否需要支持 Owner 指定平台？ |

---

## 3. 状态码和错误码

### 3.1 当前代码已实现

**HTTP 状态码：**

| HTTP | 含义 | 触发条件 |
|---|---|---|
| `200` | 成功 | 幂等重放、撤销成功、列表查询、Receipt 详情、对账成功 |
| `201` | 已创建 | ActionGrant + Outbox 原子写入成功 |
| `404` | 资源不存在 | Campaign/Grant/Receipt 不存在或不属于该 Organization |
| `409` | 状态冲突 | Campaign BLOCKED（不可签发 Grant）、Receipt 状态不是 UNKNOWN（不可对账）、ETag/Digest 版本冲突 |
| `412` | 前置条件失败 | `If-Match` ETag 与服务器版本不一致 |
| `422` | 请求体格式错误 | 对账请求 body 格式不符 |
| `428` | 缺少前置条件头 | 缺少 `If-Match` 或 `Idempotency-Key` |
| `502` | 上游服务错误 | Live Model Provider（DeepSeek）调用失败 |
| `503` | 服务不可用 | API 启动时控制面不可用 |

**应用层 code 枚举：**

成功类：
```
ACTION_GRANT_ISSUED        ACTION_GRANT_REPLAYED       ACTION_GRANT_LIST
ACTION_GRANT_REVOKED       RECEIPT_LIST                RECEIPT_DETAIL
RECEIPT_RECONCILED         CAMPAIGN_LIST               CAMPAIGN_REOPENED
DEMO_TEMPLATE_READY        MISSION_CONTRACT_READY      SCHEDULE_PREVIEW_READY
```

错误类：
```
CAMPAIGN_NOT_FOUND         ACTION_GRANT_NOT_FOUND      RECEIPT_NOT_FOUND
CAMPAIGN_BLOCKED           CAMPAIGN_VERSION_CONFLICT   ETAG_REQUIRED
IDEMPOTENCY_KEY_REQUIRED   IDEMPOTENCY_KEY_REUSED      RECEIPT_NOT_UNKNOWN
RECONCILE_BODY_INVALID     ORGANIZATION_SCOPE_MISMATCH
CONTROL_PLANE_UNAVAILABLE
```

领域校验错误码（`types.ts` `ValidationIssue.code`）：
```
ACTION_GRANT_SCOPE_INVALID       ACTION_GRANT_DIGEST_MISMATCH
ACTION_GRANT_EXPIRED             ACTION_GRANT_REVOKED
ACTION_GRANT_ALREADY_CONSUMED    ACTION_GRANT_OCCURRENCE_NOT_FOUND
ACTION_GRANT_REVISION_NOT_FOUND  OUTBOX_CONSUMER_LOCKED
```

**领域状态机（当前实现）：**

```
ActionGrant.status:
    ISSUED ──────→ CONSUMED    （outbox 被消费 + connector 成功）
       ├────────→ EXPIRED      （过了 expiresAt 未被消费）
       └────────→ REVOKED      （Owner 主动撤销，仅 ISSUED 状态可撤销）

    不可逆：CONSUMED / EXPIRED / REVOKED 不能再回到 ISSUED

OutboxRecord.state:
    PENDING → PROCESSING → COMPLETED    （connector 成功 + receipt 写入）
                         → FAILED       （验证失败 / connector 失败 / UNKNOWN）

ActionReceipt.state:
    PUBLISHED           ← DIRECT 模式成功
    HANDOFF_CONFIRMED   ← NATIVE_HANDOFF 模式成功
    FAILED              ← （预留，当前未生成）
    UNKNOWN             ← connector 返回 {ok: false} 或异常
                       → (Reconcile) → 状态不变但 reconciledAt 被设置
```

**幂等机制：**
- 键：`(organizationId, POST, route, idempotencyKey)`
- 存储：`idempotency_records` 表，24 小时过期
- 行为：相同 key + 相同 body → 返回 200 + `Idempotency-Replayed: true`；相同 key + 不同 body → `IDEMPOTENCY_KEY_REUSED` 错误
- 并发保护：`pg_advisory_xact_lock` 在事务级别锁定

---

### 3.2 需要对齐的决策

| # | 决策点 | 当前状态 | 需要确认 |
|---|---|---|---|
| S1 | `CONSUMED` 状态的写入时机 | 当前在 `completeOutbox` 时……等下，当前代码并未显式将 grant.status 改为 CONSUMED | **这是一个 Bug 还是设计意图？** `outbox-consumer.ts` 完成消费后只调用 `completeOutbox`（写入 receipt + outbox→COMPLETED），但没有把 grant.status 更新为 CONSUMED |
| S2 | FAILED 的 outbox 是否可以重新入队？ | 当前 OUTBOX 状态机中 FAILED 是终态，无法回到 PENDING | 是否需要支持手动/自动重试？比如 FAILED 后 N 分钟自动重置为 PENDING？ |
| S3 | `RECEIPT_NOT_UNKNOWN` 错误码是否有歧义？ | 双重否定 | 是否改为 `RECEIPT_ALREADY_RECONCILED` 或 `RECEIPT_STATE_NOT_RECONCILABLE`？ |
| S4 | 错误码是否需要对前端区分"可重试"和"不可重试" | 当前无区分 | 是否在响应中增加 `retryable: boolean` 字段？ |
| S5 | `ActionReceipt.FAILED` 状态 | 类型定义了但当前代码从未生成 | 什么场景下应该生成 FAILED 而非 UNKNOWN？两者的边界是什么？ |
| S6 | action_grants 表目前没有在消费时更新 status 为 CONSUMED | 如 S1 | 需要修复还是有意为之（通过 outbox.state 间接判断）？ |

---

## 4. Direct / Handoff / UNKNOWN 三类行为边界

### 4.1 当前代码已实现

**类型定义**（`action-grant.ts:7`）：
```ts
ExecutionMode = 'DIRECT' | 'NATIVE_HANDOFF'
ActionReceiptState = 'PUBLISHED' | 'HANDOFF_CONFIRMED' | 'FAILED' | 'UNKNOWN'
```

**Connector 接口**（`connectors.ts`）：
```ts
interface PublishConnector {
  platform: Platform;
  executionMode: 'DIRECT' | 'NATIVE_HANDOFF';
  execute(grant: ActionGrant, artifact: PlatformArtifact): Promise<ConnectorResult>;
}

type ConnectorResult =
  | {ok: true; mode: 'DIRECT'; platformUri: string; platformCid: string}
  | {ok: true; mode: 'NATIVE_HANDOFF'; handoffSteps: string[]}
  | {ok: false; reason: 'UNKNOWN'; message: string};
```

**三类行为的当前实现：**

| | DIRECT | NATIVE_HANDOFF | UNKNOWN |
|---|---|---|---|
| **谁执行** | action-operator 自动调用平台 API | Owner 手动按步骤操作 | （异常路径） |
| **当前平台** | Bluesky（mock） | LinkedIn、小红书（mock） | — |
| **成功产物** | `platformUri` + `platformCid` | `handoffSteps: string[]`（如 "1. 打开 LinkedIn..."） | — |
| **Receipt 状态** | `PUBLISHED` | `HANDOFF_CONFIRMED` | （不写 Receipt） |
| **Outbox 结果** | `COMPLETED` | `COMPLETED` | `FAILED` |
| **失败策略** | Connector 返回 `{ok: false}` | Connector 返回 `{ok: false}` | `failOutbox()` → Outbox FAILED |
| **重试策略** | **不重试**（outbox-consumer 不重试） | **不重试** | **绝不盲重试** |

**OutboxConsumer 的消费决策树**（`outbox-consumer.ts:65-129`）：

```
claimNextOutbox → 有 PENDING 记录？
  ├── 无 → return null
  └── 有 → 解码 payload {grant, revision}
            │
            ├── isGrantConsumable? → NO
            │   ├── status=EXPIRED → failOutbox("Grant has expired.")
            │   ├── status=REVOKED → failOutbox("Grant was revoked.")
            │   └── 其他 → failOutbox("Grant is not consumable.")
            │
            ├── digestActionGrant(grant) !== grant.grantDigest?
            │   └── failOutbox("Grant digest mismatch.")
            │
            ├── connectorByPlatform[grant.platform] === undefined?
            │   └── failOutbox("No connector available.")
            │
            └── connector.execute(grant, artifact.content)
                ├── {ok: true, mode: 'DIRECT'}
                │   → Receipt.state = PUBLISHED → completeOutbox
                ├── {ok: true, mode: 'NATIVE_HANDOFF'}
                │   → Receipt.state = HANDOFF_CONFIRMED → completeOutbox
                └── {ok: false, reason: 'UNKNOWN'}
                    → failOutbox("UNKNOWN: ...")  // fail closed, no blind retry
```

**HANDOFF 的 Owner 确认路径：**
- 当前 HANDOFF Connector 返回 `handoffSteps` 后直接写 `HANDOFF_CONFIRMED`
- **没有**等待 Owner 确认的环节——代码注释标注了 `"Owner 确认后，将发布后的 URL 粘贴回 LumiClaw 以完成对账"`，但这一步**尚未实现**

**UNKNOWN 的对账路径：**
- `POST /receipts/:id/reconcile` → `{method: 'PLATFORM_QUERY' | 'OWNER_MANUAL'}` 已实现
- 但 Postgres 版本 `reconcileReceipt` 抛出 `'RECONCILIATION_NOT_AVAILABLE'`，标注 `"M3-07"`
- 只有 Memory 版本完整实现了 reconcile 逻辑

---

### 4.2 需要对齐的决策

| # | 决策点 | 当前状态 | 需要确认 |
|---|---|---|---|
| B1 | DIRECT 模式下，真实的 Bluesky API 调用失败（网络超时 / 鉴权失败）→ 应归类为 UNKNOWN 还是 FAILED？ | 当前所有 `{ok: false}` 一律走 UNKNOWN → failOutbox | 是否需要区分 "可重试的临时故障"（网络超时）和"不可重试的永久故障"（鉴权过期）？ |
| B2 | NATIVE_HANDOFF 的 Owner 确认时限 | 无 | Owner 多长时间不确认视作过期？是否和 Grant 的 15 分钟 TTL 联动？超时后 Grant 自动 EXPIRED？ |
| B3 | HANDOFF 确认后，Owner 提交的 URL 如何验证？ | 未实现 | 是否需要系统校验 URL 格式/域名？还是纯信任 Owner 输入？ |
| B4 | UNKNOWN 对账后，Receipt 能否从 UNKNOWN 变为 PUBLISHED？ | `reconcileReceipt` 只设置 `reconciledAt`，不改变 state | 对账确认"其实已经发出去了"→ state 应该改写还是保留 UNKNOWN + 标注 reconciled？ |
| B5 | 三个 Connector 并行执行，一个 UNKNOWN 了，另外两个是否继续？ | 当前每个 Grant 独立消费，互不影响 | 是否需要 Campaign 级别的 "全部成功 or 全部回滚" 语义？ |
| B6 | `ActionReceipt.FAILED` 和 `OutboxRecord.FAILED` 的区别 | FAILED receipt 类型定义了但未使用；FAILED outbox 在 UNKNOWN 时产生 | 什么场景产生 FAILED receipt？（比如 connector 明确返回 "内容违规被平台拒绝"？） |
| B7 | Connector 返回 `{ok: false}` 时是否需要通知 Owner？ | 当前仅写 failOutbox，无通知 | 是否需要 SSE 推送 `receipt_failed` 事件？或者 Web UI 轮询？ |

---

## 5. 冻结流程

1. **本文档草稿**（当前）→ 合作方审阅
2. **对齐会议** → 逐条讨论第 1-4 节中带 "需要确认" 标记的决策点，记录结论
3. **更新文档** → 将决策结论写入每个决策点下方，删除待定标记
4. **冻结** → `Status: FROZEN`，提交到 `main` 分支。此后任何对这四件事的修改都需要通过 Change Request

---

## 附录 A：相关文件索引

| 层 | 文件 | 说明 |
|---|---|---|
| 领域类型 + 业务逻辑 | `packages/domain/src/action-grant.ts` | ActionGrant、OutboxRecord、ActionReceipt 类型 + 校验函数 + Fixture |
| 领域类型 | `packages/domain/src/types.ts` | Platform、ValidationIssue code 枚举 |
| Postgres 持久层 | `packages/db/src/action-repository.ts` | 原子事务、幂等、行级锁、FOR UPDATE SKIP LOCKED |
| 内存持久层 | `packages/db/src/memory-action-repository.ts` | Demo 模式 / 测试用 |
| DDL 迁移 | `packages/db/migrations/000007_action_grants.cjs` | action_grants、outbox、action_receipts 三张表 |
| Outbox 消费循环 | `apps/action-operator/src/outbox-consumer.ts` | setInterval 轮询 + 验证 + 分发 |
| 三个平台 Connector | `apps/action-operator/src/connectors.ts` | Bluesky DIRECT / LinkedIn HANDOFF / 小红书 HANDOFF |
| action-operator 服务 | `apps/action-operator/src/server.ts` | HTTP 健康检查，端口 4002 |
| API 路由 | `apps/api/src/server.ts:156-261` | 6 个 REST 端点 |
| SSE 事件流 | `apps/api/src/receipt-stream.ts` | ReceiptEventBus + SseManager |
| API 测试 | `apps/api/src/action-grant-routes.test.ts` | 201/200/404/412/428 路由测试 |
| 集成验证 | `scripts/verify-m3-action-grant.ts` | 7 阶段 20 项检查 |
| 验证证据 | `.evidence/m3-01/action-grant-integration.json` | 20/20 PASS |

## 附录 B：待修复或澄清的问题（代码层面）

以下问题在冻结对齐时应一并讨论：

1. **grant.status 不在消费时更新为 CONSUMED**：`outbox-consumer.ts` 的 `completeOutbox` 只更新 outbox 和 receipt，没有更新 grant 的状态。目前只能通过 `outbox.state === 'COMPLETED'` 来间接判断 grant 已被消费。
2. **`GET /action-grants` 返回的是 Receipt 列表**：API 注释写 `"return receipts as proxy for grant list"`，需要确认是临时方案还是最终设计。
3. **SSE fan-out 未按 campaignId 过滤**：当前推送给所有连接的 SSE 客户端，由客户端自行过滤。
4. **Postgres 版 reconcileReceipt 未实现**：标注 M3-07，当前抛 `RECONCILIATION_NOT_AVAILABLE`。
5. **HANDOFF 缺少 Owner 确认环节**：Connector 返回 handoff steps 后直接标记 HANDOFF_CONFIRMED，没有等待 Owner 实际确认。
