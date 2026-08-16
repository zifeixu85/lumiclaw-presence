# SDD-006 Onboarding Owner 反馈与冻结原型差距审计

日期：2026-08-16
范围：仅比较冻结 UX 1.4 原型与生产 React/Next.js Onboarding；原型中的模拟运行状态不作为实现证据。

## 本轮已修正

| Owner 反馈 | 生产实现 | 真实性边界 |
| --- | --- | --- |
| 名字输入后即可选择公开示例 | 首屏在本地显示名称下直接提供「使用本机资料开始」和「使用公开示例快速体验」；未输入名称时两者均禁用 | 示例仍标为 public-safe，不连接账号、不冒充真实业务结果 |
| Market / Locale / Platform 应可多选 | 三组改为可键盘操作的多选按钮组；至少保留一项 | 数组进入稳定 API 合同、Memory、PostgreSQL 与重启测试，不是仅前端外观 |
| 时间字段应是单值默认时区 | 改名为「默认排程时区」，继续保存明确 IANA time zone | 不从界面语言、市场或平台静默推断 |
| 中文界面左侧出现英文 | 默认 `/` 明确进入 `zh-CN`；Onboarding 首屏增加可见的中英文切换入口；双语浏览器回归覆盖左侧步骤栏 | 稳定技术 code 仅保留在可展开技术详情，不作为普通页面主叙事 |
| 左上绿色 Logo 方案 | 保留冻结方案的薄荷绿色 `L` 品牌标 | 与 Owner 确认一致 |

## 多选如何进入权威数据

- `marketCodes`、`contentLocales`、`platforms` 与 `defaultTimeZone` 作为 Onboarding session 的稳定字段持久化。
- 首个本机 Campaign 的 `graph.markets` 纳入全部已选目标市场，Claim 绑定全部对应 Market ID。
- 当前 M1 Campaign 合同仍要求四个平台各一个可审阅 Revision，因此「首选平台」是工作区偏好，不代表账号连接，也不删减冻结的四平台审阅包。
- 当前 Campaign brief 只有一个 `contentLanguage`，所以首批草稿使用所选列表第一种内容语言；其余 Locale 保留在工作区范围。支持每个 Locale 独立 Revision 属于后续 Campaign 合同扩展，不能在本 SDD 中伪造。

## 对照冻结五步原型后仍存在的差距

| 冻结原型阶段 | 当前生产状态 | 差距 / 后续要求 |
| --- | --- | --- |
| 1. 导入资料 | MD/TXT 服务端真实解析、Blob/Manifest 持久化；示例路径可从首屏直达 | 多文件批量拖放、自由文字输入、语音输入、PDF/DOCX 尚未实现；PDF/DOCX 继续诚实标为 PLANNED |
| 2. 资料体检 | 展示逐文件成功状态、摘要与提取文本 | 没有权威 Agent runtime，因此不能展示原型中的动态「事实核验 Agent 正在读取」；结构化提取、来源冲突识别和密码文档状态仍未实现 |
| 3. 确认理解 | 用户对照提取文本手动确认 Organization / Brand / Product / Campaign 字段 | 尚无由真实抽取结果生成的知识摘要、来源抽屉、过期状态和冲突决策面板 |
| 4. 补充缺口 | Market / Locale / Platform 多选与默认排程时区已分离 | 仍是字段组，不是最多四个逐题式关键缺口流程；Market Knowledge resolver 与来源优先级属于已冻结但尚未落地的后续能力 |
| 5. 建立目标 | Campaign objective、CTA 与本地权威 Campaign 创建已实现 | 尚无独立持续 Goal 对象、时间窗口、最终负责人字段和每周任务驱动合同；不能把 Campaign objective 冒充完整持续 Goal |

## 视觉与交互结论

- 当前左侧深蓝黑轨道、薄荷绿品牌标、暖白主面和紧凑字号已经回到选定视觉方向。
- 首屏路径决策已前移，减少一次无价值的中间页；恢复中的 `UNSELECTED` session 仍保留旧路径选择页，避免历史状态不可恢复。
- 多选使用明确 pressed 状态、hover、focus-visible，并遵守 reduced-motion；默认时区保持原生单选，以确保键盘与辅助技术可用。
- 最大剩余差距不是颜色或卡片，而是冻结五步原型中的「真实资料体检 → 知识摘要 → 冲突决定 → 持续 Goal」产品链路缺少对应权威后端。后续实现必须先有真实合同与测试，不能复制原型的模拟成功状态。
