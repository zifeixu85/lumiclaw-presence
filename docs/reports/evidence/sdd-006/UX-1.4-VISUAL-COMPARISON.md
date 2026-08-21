# SDD-006｜UX 1.4 冻结原型与生产实现视觉对照

> 生成日期：2026-08-16
>
> 画布：冻结原型与生产截图均为 `1440 × 900`；并排图左侧为冻结原型，右侧为真实 `LOCAL_PRIVATE` 生产工作区。
>
> 结论：Executor 逐屏自查通过，Owner 视觉 UAT 仍为 `PENDING`，本文不声明 `ACCEPTED`。

## 对照图

| 流程 | 并排证据 | 生产实现保留的层级 | 为真实性主动保留的差异 |
|---|---|---|---|
| Today | [`comparisons/today-prototype-production.png`](comparisons/today-prototype-production.png) | 深蓝黑 Shell、三类 Owner 待办、持续 Goal、紧凑协作条、周时间线、薄荷绿/珊瑚色语义。 | `LOCAL_PRIVATE` 不显示原型模拟中的活跃 Agent、Token、完成量或增长进度；进度说明明确为工作流状态。 |
| AI Team | [`comparisons/ai-team-prototype-production.png`](comparisons/ai-team-prototype-production.png) | 四页签、深色协作看板、六名 Agent 专业头像、任务队列和指标带。 | 原型模拟的 `3 active / 27 tasks / 128.4K Token` 被替换为“6 角色已配置、0 权威运行观测、Token 未观测、0 持久任务”。 |
| Campaign | [`comparisons/campaign-prototype-production.png`](comparisons/campaign-prototype-production.png) | 目标摘要、页签、平台内容计划、准备度侧栏、单一当前责任。 | 标题、目标、语言和内容来自本机权威 Campaign；没有把 Demo Campaign、审校成功或运行状态带入私有工作区。 |
| Review | [`comparisons/review-prototype-production.png`](comparisons/review-prototype-production.png) | 大抽屉、左侧平台版本、中间全文与媒体、右侧平台预览、底部精确审批区。 | 缺独立 Audit/OwnerDecision 时审批按钮保持 disabled；技术码只在折叠详情，正文区域使用用户语言解释。 |
| Publish | [`comparisons/publish-prototype-production.png`](comparisons/publish-prototype-production.png) | 内容包选择、完整正文/媒体、目标平台与账号、四步发布流程。 | 复制/下载仅为审阅导出；账号未连接时显示“尚未连接”；打开官方页和人工完成保持锁定，API 也 fail-closed。 |

## 逐项自查

| 维度 | 结果 | 证据 |
|---|---|---|
| 导航与信息架构 | `PASS` | 224px 分组侧栏、Workspace switcher、Owner footer、56px 顶栏、breadcrumb/search/team/mode/locale 入口；主流程顺序与冻结原型一致。 |
| 层级与密度 | `PASS` | 普通页面标题 28px、正文 13–14px、规则型表格/列表优先；1440×900 首屏可同时看到主要任务、Goal、协作条和周时间线。 |
| 色彩与组件 | `PASS` | 深蓝黑 `#172126`、暖白 `#fffefa`、薄荷绿 `#a8dbbc`、珊瑚色 `#ef5a38`；共享 token、rule sheet、status、tabs、drawer 与平台预览。 |
| 数据真相 | `PASS` | `LOCAL_PRIVATE` 与演示数据标签不混淆；普通页面不以 `SDD_007_REQUIRED` / `NOT_CONFIGURED` 为标题；未连接账号不暴露内部 placeholder code。 |
| 动效 | `PASS` | 页面 180ms ease-out；Drawer 240ms / Overlay 220ms；仅 opacity/transform；`prefers-reduced-motion` 关闭进入动效；没有 `transition: all`。 |
| 键盘与焦点 | `PASS` | AI Team tabs 支持 Left/Right/Home/End；Drawer focus trap、Esc、scroll lock、focus restore；复制/下载使用 `aria-live`。 |
| 可访问性与尺寸 | `PASS` | zh/en 关键页 axe serious/critical 0；1024/1440 无横向溢出；800 显示 desktop gate；Drawer 显式 `aria-modal=true`。 |

## Digest

| 文件 | SHA-256 |
|---|---|
| `today-prototype-production.png` | `4705d2e45d147ad47dee03eadbceabca5ee07de7fe2d62c78ba9b9376b2cbdd6` |
| `ai-team-prototype-production.png` | `84aedaa8b106477ed323d181134446326579949f675d43c76959843a0df70a77` |
| `campaign-prototype-production.png` | `18784324c971545feee9321d4addcf04e241e3ec4bc15f7a55c155bac9507d7c` |
| `review-prototype-production.png` | `1d3c164facbaf3130507aeaf2a593705b813fc2b3e5c66318f4e239437294a7d` |
| `publish-prototype-production.png` | `70c0648a79783aa0c29653fc47b401543a5fa5bd214475a9cd4615af4349c126` |
| `browser-verification.json` | `43287b214e75c7b4e6d06e0326cdff09fdb4677fc42384dd234fc4256c86e077` |

原型截图由 `scripts/capture-sdd006-ux-reference.mjs` 从 Owner 冻结静态原型生成，只作为视觉/交互参考；生产截图由 `scripts/verify-sdd006-browser.mjs` 在真实 PostgreSQL/Blob/Next 生产容器上完成 `LOCAL_PRIVATE` 初始化后生成。
