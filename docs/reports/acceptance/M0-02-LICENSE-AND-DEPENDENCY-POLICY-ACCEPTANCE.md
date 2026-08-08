# M0-02 验收报告｜根许可证与依赖政策

> SDD：Owner 决策驱动的 M0 基础治理项
> 进度模块 ID：`M0-02`
> Goal Objective：在首个公开代码实现前冻结根许可证、贡献与依赖规则
> 报告状态：`ACCEPTED`
> 证据成熟度：`ENGINEERING_VERIFIED`
> 生成日期：`2026-08-03`

## 一、交付结果

公开仓现在使用 Apache License 2.0，并明确了 Contribution、Dependency、Provider、Container、Legacy Migration、Copyleft / Source-available 与 SBOM/NOTICE 的工程处理规则。

## 二、证据

| 范围 | 文件 | 结果 |
|---|---|---|
| 根许可证 | `LICENSE` | Apache License 2.0 正文 |
| 依赖政策 | `docs/DEPENDENCY-POLICY.md` 与中文镜像 | 审计字段、分类、License 与替换边界 |
| 贡献规则 | `CONTRIBUTING.md` | Apache-2.0 Contribution 与依赖披露要求 |
| Agent 规则 | `AGENTS.md` | 不把根许可证误当作第三方兼容性或 Production 声明 |
| README | 中英文 README | 明确 Apache-2.0 与 Pre-alpha 边界 |

## 三、验证

| 检查 | 期望 | 结果 |
|---|---|---|
| License 文件存在且正文完整 | Apache-2.0 Version 2.0 | `PASS` |
| README / AGENTS / CONTRIBUTING 口径一致 | 无“许可证未决定”残留 | `PASS` |
| Dependency Policy 双语链接 | 全部可解析 | `PASS` |
| Secret / Private Data | 无 | `PASS` |

## 四、Owner 决定

Owner 于 2026-08-03 明确回复“使用 Apache-2.0 可以的”。该决定满足本模块所需 Owner Acceptance。

## 五、限制

- Apache-2.0 不自动证明任何第三方依赖兼容；
- AGPL、Source-available、Provider Terms、数据与商标问题仍需逐项审计；
- 本报告不是法律意见。

## 六、最终决定

- 自动化验证：`PASS`
- Owner 决定：`ACCEPTED`
- 最终模块状态：`ACCEPTED`
- 下一模块：`M0-03 Node/TypeScript Monorepo 与锁定依赖基线`
