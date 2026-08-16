# SDD-006 依赖、许可证与安全审阅

> 审阅日期：2026-08-16
>
> Lockfile SHA-256：`18caf50558ddd99d3ca7f322ca6f7dccad6f4bd8bfa80b93c4f4886227aefe07`
>
> 完整清单：`.evidence/sdd-006/license-inventory.json`
>
> CycloneDX：`.evidence/sdd-006/sbom.cdx.json`

## 结论

- 1020 个 lockfile package 完成许可证清单；disallowed/unknown 数为 0。
- CycloneDX 1.6 SBOM 生成 710 个 component，并绑定同一 lockfile digest。
- `npm audit --omit=dev --audit-level=high`：0 vulnerability。
- 未增加 PDF/DOCX parser，因而没有把未审阅的文档解析攻击面或许可证带入生产路径；UI 明确显示 `PLANNED`。
- 没有复制 Shadcn、竞品或 Postiz 源码。`Button`、`StatusBadge`、`Drawer` 等 primitive 是本仓库组件；仅采用“少量可审阅 primitive + token”的组件组织模式。

## 新增直接依赖

| Package | 精确版本 | 分类 | License | 用途与审阅结果 |
|---|---:|---|---|---|
| `@radix-ui/react-dialog` | `1.1.23` | runtime | MIT | 仅用于 modal drawer 的焦点陷阱、Esc、页面 inert/scroll lock 与关闭恢复；无网络、存储或 Secret 能力。真实 Chromium 与单元键盘测试通过。 |
| `lucide-react` | `1.31.0` | runtime | ISC | 图标组件；按需 import，无业务状态或外部调用。 |
| `tailwindcss` | `4.3.3` | development/build | MIT | Next 构建时生成仓库自有 token/utility CSS；不进入运行时状态层。 |
| `@tailwindcss/postcss` | `4.3.3` | development/build | MIT | Tailwind 4 的 PostCSS 集成。 |
| `postcss` | `8.5.26` | development/build | MIT | 显式锁定构建链。 |
| `@playwright/test` | `1.62.1` | development | Apache-2.0 | public-safe 真实浏览器 E2E 与截图。 |
| `@testing-library/dom` | `10.4.1` | development | MIT | 组件语义查询。 |
| `@testing-library/react` | `16.3.2` | development | MIT | React 19 组件行为测试。 |
| `@testing-library/user-event` | `14.6.4` | development | MIT | 键盘与焦点行为。 |
| `@vitejs/plugin-react` | `6.0.5` | development | MIT | Vitest JSX/TSX 转换。 |
| `axe-core` | `4.13.0` | development | MPL-2.0 | WCAG A/AA 自动检查；仅测试执行，不打入生产 Web bundle。 |

## 来源与维护边界

- Tailwind 的 Next.js 集成按官方框架指南接入：<https://tailwindcss.com/docs/installation/framework-guides/nextjs>。
- Radix Dialog 的可访问性行为依据官方文档：<https://www.radix-ui.com/primitives/docs/components/dialog>。
- 精确版本、resolved URL、integrity、直接/传递分类以 `package-lock.json`、`docs/dependencies/VERSION-MANIFEST.json` 与完整 license inventory 为准。
- Storybook/browser safety gate 已证明 repository Skill source、服务端文件读取和 Secret 处理代码没有进入浏览器 bundle。

## 本轮视觉资产

本轮没有下载第三方图片或复制竞品资产。`apps/web/public/ux/` 只包含 Owner 冻结原型随附的 first-party、public-safe 视觉资产；它们随 Apache-2.0 公共仓库交付，不含客户资料、Secret 或真实运行证据。

| 资产 | SHA-256 |
|---|---|
| `agent-a0-task-coordinator-square.png` | `cc031ff295fecbadfee0838d437ff410e01f7176534ef345373d84c9109e8e15` |
| `agent-a1-fact-verifier-square.png` | `2ae4dab5b3ddeb3f418aa127a06529a4437e7f3ee084722c86482e7b2499efd6` |
| `agent-a2-market-planner-square.png` | `0ea47f625868e879ea0ff332279ff6eb106bc6b659f2f3748cae19e25d4a6a36` |
| `agent-a3-founder-content-square.png` | `96e80aff0d4ccbb7d4b136b4f702bfbde325972654f26755c9e14b93cb5b310d` |
| `agent-a4-product-content-square.png` | `1c4d0fd86e94969a32ceddd1d8b61944aef10228d60ba5cccb045b3469cce1cf` |
| `agent-a5-independent-auditor-square.png` | `cd7ffd6673ae98f1a70fd52ab562b7059f3378b31e73f29212d005ae18466310` |
| `design-partner-campaign.svg` | `725be57648d70893b201c22fa573dc713857d9dfd2354a17f8b2a7e938321579` |

## 已知限制

- 全量 development audit 仍会继承既有 Storybook 工具链的 3 个 high 警告；生产依赖 audit 为 0。本 SDD 不以 `--force` 降级或破坏 Next/Storybook 版本来伪造全绿。
- 该审阅是工程许可证/攻击面记录，不是法律意见，也不把依赖声明为生产就绪。
