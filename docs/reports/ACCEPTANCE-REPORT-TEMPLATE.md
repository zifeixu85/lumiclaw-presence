# SDD-NNN 验收报告｜标题

> 默认语言：简体中文；必要的代码、命令、稳定状态码和外部专有名词可保留英文
> SDD：`docs/specs/SDD-NNN-....md`
> 进度模块 ID：`M?-??`
> Goal Objective：
> 执行任务 / ChatGPT Pro 对话链接：
> Commit / Worktree / Build Identity：
> 报告状态：`DRAFT | EVIDENCE_READY | ACCEPTED | REJECTED`
> 证据成熟度：`IMPLEMENTED | ENGINEERING_VERIFIED | EXTERNAL_CALIBRATED`
> 生成日期：`YYYY-MM-DD`

## 一、交付结果

用中文说明用户现在能做什么，以及相对已核验起点发生了什么变化。

## 二、交付范围

### 已包含

-

### 未包含或延期

-

## 三、实现证据

| 范围 | 文件 / 对象 | Evidence |
|---|---|---|
| Domain / Database |  |  |
| API / Worker |  |  |
| UI / i18n |  |  |
| AgentTeams / Skill |  |  |
| Connector / Provider |  |  |
| Security / Privacy / License |  |  |

## 四、自动化验证

记录精确命令、环境、期望结果、实际结果与 Evidence 位置。

| 检查 | 命令或协议 | 期望 | 实际 | 结果 |
|---|---|---|---|---|
| Unit / Schema |  |  |  | `PASS/FAIL` |
| Database / Integration |  |  |  | `PASS/FAIL/N/A` |
| AgentTeams / Provider Contract |  |  |  | `PASS/FAIL/N/A` |
| Web E2E / Visual / Accessibility |  |  |  | `PASS/FAIL/N/A` |
| Failure / Recovery / Rollback |  |  |  | `PASS/FAIL` |
| Secret / Privacy / License |  |  |  | `PASS/FAIL` |

## 五、验收标准结果

| Criterion ID | 结果 | Evidence | 说明 |
|---|---|---|---|
| AC-01 | `PASS/FAIL` |  |  |

不得用“看起来没问题”或“测试通过”代替逐条 Criterion。

## 六、Owner 参与验收

每个 Owner 可执行检查都必须成为可独立运行的中文协议。

### UAT-01｜名称

- **为什么需要 Owner 验证：**
- **前置条件：**
- **安全 / 数据说明：**
- **操作步骤：**
  1.
- **期望可见结果：**
- **失败信号：**
- **需要返回的证据：**截图、导出 Receipt、URL 或书面决定。
- **清理 / 回滚：**
- **Owner 结果：**`PENDING | PASS | FAIL | WAIVED_WITH_REASON`

若 Owner 操作没有价值或不安全，必须说明原因，并改为只读 Evidence Review。

## 七、ChatGPT Pro 双代理记录

若本 SDD 使用 ChatGPT Pro，记录：

- 对话链接；
- 源码包 Git 基线、大小与 SHA-256；
- ChatGPT Pro 交付物；
- Codex 发现并要求修正的问题；
- 修正轮次与最终独立复验结果。

未使用时写 `N/A`，不得虚构外部评审。

## 八、失败、限制与非声明

- 已知失败：
- 接受的限制：
- 仍为 `PLANNED` 的 Claim：
- 明确 `NOT_CLAIMED` 的结果：

## 九、回滚与恢复

说明已测试的代码回滚、数据 Migration 回退、Connector Reconciliation，以及必须保留人工步骤的部分。

## 十、执行任务状态交接

Executor 向 Coordinator 报告，不直接修改规范进度真源，除非 Coordinator 明确授权。

| Module ID | 当前规范状态 | 建议新状态 | 原因 / Evidence |
|---|---|---|---|
| M?-?? |  |  |  |

同时报告：

- Worktree / Branch / Commit；
- 变更文件；
- 未提交或未推送状态；
- Blocker；
- 下一候选步骤。

## 十一、Coordinator 验收决定

- Executor 自动化验证：`PASS | FAIL`
- Coordinator 独立复验：`PASS | FAIL | PENDING`
- 是否需要 Owner 验收：`YES | NO`
- Owner 决定：`PENDING | ACCEPTED | REJECTED`
- 最终模块状态：`EVIDENCE_READY | ACCEPTED | BLOCKED`
- 下一 Module / SDD：
