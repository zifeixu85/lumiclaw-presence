# SDD-006 UX 1.4 原型到生产映射

> 状态：实现输入。视觉与交互取自 Owner 冻结的 `final-saas-workspace`；数据、权限与成熟度只取生产 API/Domain 合同。原型中的模拟运行、Token、完成量、审校通过和发布成功不得进入 `LOCAL_PRIVATE` 事实。

## 1. 视觉 Token

| 原型语义 | 生产 Token | 用途 |
|---|---|---|
| 深蓝黑 `#172126` / `#10232f` | `--lc-sidebar` / `--lc-ink-panel` | 侧栏、持续 Goal、AI 协作边界 |
| 暖白 `#fffefa` | `--lc-surface` | 主工作面、列表和抽屉 |
| 暖灰 `#f3f4f1` | `--lc-canvas` | 页面底色与分区 |
| 薄荷 `#a8dbbc` / `#246c4a` | `--lc-mint` / `--lc-positive` | 主要选中、已就绪、品牌识别 |
| 珊瑚 `#ef5a38` / `#a93620` | `--lc-coral` / `--lc-coral-deep` | 风险、待办、当前决策；深色值满足小字号对比度 |
| IBM Plex Sans + Noto Sans SC | `--lc-font-sans` | 中文优先的紧凑 SaaS 正文 |
| IBM Plex Mono | `--lc-font-mono` | 版本、时间、稳定代码（仅技术详情） |
| 224 / 56px | `--lc-sidebar-width` / `--lc-header-height` | 固定侧栏与顶栏 |

## 2. 逐屏映射

| 冻结原型 | 生产 route / component | 真实数据与降级规则 |
|---|---|---|
| First open | `/[locale]` → `OnboardingFlow/ProfileStep` | 只收本地显示名称；无邮箱、密码、API Key |
| 初始化路径选择 | `OnboardingFlow/ChoiceStep` | `PUBLIC_SAFE_EXAMPLE` 与 `LOCAL_PRIVATE` 两条真实 API 路径；普通文案不展示稳定码 |
| 本机资料确认 | `OnboardingFlow/MaterialStep` | MD/TXT 服务端提取和持久化；PDF/DOCX 诚实不可用；用户确认 Organization/Brand/Product/Campaign 与四个上下文字段 |
| Today | `/[locale]` → `TodayView` | 待办来自 Campaign Revision、发布授权和反馈缺口；Goal 使用 Campaign brief，不伪造业务进度；无 runtime 时协作条静态显示“角色已配置，等待接通” |
| Campaign 概览/资料/内容/审阅 | `/campaigns` → `CampaignFeature` | 使用权威 CampaignEnvelope；模式显示为用户语言；完整正文和平台预览在大型右抽屉；Audit/OwnerDecision 缺失继续失败关闭 |
| 内容工作区 | `ContentReviewDrawer` | 当前 Producer 单一紧凑显示；历史步骤可展开；稳定码和 digest 仅在“技术详情” |
| AI 团队工作概览 | `/ai-team?view=overview` | 六角色/Skill 为仓库合同；无权威 runtime 时不显示 pulse、进度、活跃数、Token 或完成量成功叙事 |
| AI 员工 | `/ai-team?view=employees` | 六张专业头像卡；职责、Skill 和静态配置真实；运行状态用自然语言，原始 code 在详情 |
| 团队技能 | `/ai-team?view=skills` | 只读仓库 `SKILL.md`；不补造 scripts/references |
| 定时任务 | `/ai-team?view=schedules` | 无 PostgreSQL occurrence 时显示自然语言空态；后续 SDD 稳定码只在技术详情 |
| 发布中心 | `/publish` → `PublishFeature` | 先展示精确内容包、平台和可用审阅导出；打开官方页/人工完成在缺 Audit PASS + OwnerDecision 时禁用；API 防绕过不变 |
| 品牌资料 | `/knowledge` → `KnowledgeView` | 显示权威 Organization/Brand/Product、材料、Market/Locale/Platform/Time Zone；示例与本机标签不混淆 |
| 设置/就绪 | `/settings` → `SettingsView` | Web/API/PostgreSQL/Adapter/Runtime 确定性合同；稳定码和 SDD 编号集中于诊断详情；不收浏览器 Secret |

## 3. 可复用组件边界

- `WorkspaceShell`：品牌、Workspace switcher、分组导航、顶栏 breadcrumb/search/AI 团队入口/Owner。
- `PageHeader`：24–30px 标题、日期/eyebrow、单一主要动作。
- `StatusBadge`：短用户状态；技术稳定码不得作为页面标题。
- `CurrentAgentStrip`：只有 `metrics.source !== NO_RUNTIME_OBSERVATION` 才允许 pulse/progress。
- `Drawer`：Radix modal、focus trap、Esc、scroll lock、focus restore，240ms ease-out。
- `TechnicalDetails`：digest、reasonCode、remediationCode、SDD 编号的唯一普通页面容器。
- `ModeLabel`：`PUBLIC_SAFE_EXAMPLE` → “演示数据”，`LOCAL_PRIVATE` → “本机私有”；不得交叉显示。

## 4. 动效与无障碍合同

- 页面与分区进入：180ms ease-out，仅 `opacity/transform`，轻量 stagger。
- Drawer：240ms ease-out；Overlay 220ms；禁止 `transition: all`。
- 导航、页签、按钮、列表行都有 hover/pressed/focus-visible；复制/下载通过 `role=status` / `aria-live` 反馈。
- `prefers-reduced-motion: reduce` 将动画与过渡缩短至 0.01ms。
- 1024px 是最小支持宽度；1024 与 1440 均不得出现页面级水平溢出。
