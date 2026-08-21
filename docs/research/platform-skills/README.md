# X / 小红书平台内容合同与 Skill 候选研究

状态：`RESEARCH_SPEC_INPUT`

成熟度：`PLANNED`，不是生产实现，不改变 `IMPLEMENTATION-STATUS.md`

检索日期：2026-08-22（Asia/Singapore）

基线：`origin/main@9e241da98be00c56204894c67b7599d37ff10505`

## 1. 结论先行

首批平台合同应分成三层，而不是把一份“运营经验清单”直接写进校验器：

1. `HARD_CONSTRAINT`：有当前官方/一级来源，且适用入口、账号能力与媒体类型都明确；失败时阻断。
2. `OFFICIAL_RECOMMENDATION` / `EMPIRICAL_RECOMMENDATION`：只告警、要求预览或 Owner 决策，不能冒充平台上限。
3. `NEEDS_ACCOUNT_PROBE`：官方公开数字缺失、冲突或随账号/地区/客户端变化；必须记录实测能力、证据和过期时间。

本轮可安全写入首版硬约束的内容包括：

- X 普通帖使用官方加权字符算法，常规上限 280；每个 URL 按 23 计数；不能用 JavaScript `string.length` 替代。
- X 图片帖 1–4 张、图片 ALT 每张不超过 1,000 字符；API Poll 为 2–4 选项、每项 1–25 字符、5–10,080 分钟，且 Poll 与 media/quote/card 互斥。
- 小红书官方 Android/HarmonyOS 分享 SDK 的图文路径为 1–18 张图片，视频路径为 1 个视频和 0–1 张封面；这些数字只属于对应 Share SDK 路径，不是创作中心/原生 App 的通用硬限制。
- 小红书官方 Q&A 明确说明分享 SDK 的标题与文案自动填充当前受限，因此任何 adapter 都不能把“传入字段”当成“已填入原生编辑器”。
- X 只允许官方 API 或用户驱动的原生手动发布；小红书当前只允许手动原生交接，官方 Share SDK 仅进入后续研究/申请路径。Cookie、逆向私有 API、CDP/无头自动发布均不进入当前产品。

本轮不能写成平台硬规则的内容包括：

- X 线程总条数。官方帮助页描述线程构造方式，但未给出稳定公开的总条数上限；3–7 条只是首版可审校建议。
- X Premium 视频上限。2026-08-22 检索到的两个官方帮助页分别写出不同上限，必须按账号、客户端、地区做短期能力快照。
- X Article 是否对某个具体 Premium tier/账号可见。官方当前页面的 tier 文案存在歧义，必须探测 Article composer。
- 小红书标题、正文、话题数量、创作中心图片总数、视频时长/大小、通用图片比例。未找到可公开核验且覆盖所有入口的官方精确数字。
- “标题 20/38 字、正文 1,000 字、标签 3–10 个、每天 50 条、首图一定如何处理”等第三方 Skill 常见数字。它们只可作为待实测假设，不能进入平台硬约束。

## 2. 研究范围与来源纪律

### 2.1 一级来源

X 使用：

- [How to post](https://help.x.com/en/using-x/how-to-post)
- [twitter-text v3.1.0](https://github.com/twitter/twitter-text/tree/30e2430d90cff3b46393ea54caf511441983c260)
- [Create or edit Post API](https://docs.x.com/x-api/posts/create-or-edit-post)
- [Upload media](https://docs.x.com/x-api/media/upload-media)
- [X Premium](https://help.x.com/en/using-x/x-premium)
- [Threads](https://help.x.com/en/using-x/create-a-thread)
- [Articles](https://help.x.com/en/using-x/articles)
- [Image descriptions](https://help.x.com/en/using-x/add-image-descriptions)
- [Accessibility](https://help.x.com/en/using-x/accessibility-features)
- [Automation rules](https://help.x.com/en/rules-and-policies/x-automation)
- [Developer Guidelines](https://docs.x.com/developer-guidelines)

小红书使用：

- [分享开放平台能力概览](https://agora.xiaohongshu.com/doc)
- [Android 分享 SDK](https://agora.xiaohongshu.com/doc/android)
- [iOS 分享 SDK](https://agora.xiaohongshu.com/doc/ios)
- [HarmonyOS 分享 SDK](https://agora.xiaohongshu.com/doc/harmony)
- [分享开放平台 Q&A](https://agora.xiaohongshu.com/doc/qa)
- [创作服务平台发布入口](https://creator.xiaohongshu.com/publish)
- [蒲公英规则公告入口](https://pgy.xiaohongshu.com/help/home)
- [蒲公英内容审核规范](https://pgy.xiaohongshu.com/help/detail?id=6495c527d1eedeeb48fb18b1f875650e&userType=4)
- [聚光广告物料审核规范](https://ad.xiaohongshu.com/next_help/docs/8dc5bd9c45c9a90cb9912f3400d43f92)

完整字段、检索时间、支持结论与局限见 [SOURCE-REGISTER.json](./SOURCE-REGISTER.json)。

### 2.2 次级输入

Owner 提供的 `buffer.md`、`postiz.md`、`lumiclaw_opponent_analysis.md` 只用于比较工作流、日历、provider、失败态与产品定位：

- 未把其中任何平台数字当作硬规则；
- 未把文件复制进公共仓库；
- Buffer 的闭源实现不作为代码来源；
- Postiz 为 AGPL-3.0，仍是 `POC-GATED`，未复制其源码、类型、fixture 或生成代码。

## 3. X 首批内容合同

### 3.1 普通帖与字符计算

| 规则 | 分类 | 合同 |
|---|---|---|
| 普通帖最大长度 | `HARD_CONSTRAINT` | 280 个 X 加权字符；使用 `twitter-text` v3 语义 |
| URL | `HARD_CONSTRAINT` | 每个 URL 经 t.co 处理，固定占 23 个加权字符 |
| Unicode / emoji | `HARD_CONSTRAINT` | 按官方权重配置解析，不按 UTF-16 code unit 或用户可见 grapheme 自创算法 |
| 长帖 | 条件硬约束 + capability | 仅当账号当前暴露 longer Post 能力时允许，官方当前写为最高 25,000 字符 |

生产实现应优先评估固定版本 `twitter/twitter-text@v3.1.0`，不要手抄字符区间。依赖采用仍需走 Apache-2.0 依赖/NOTICE 审查，并用实时边界 fixture 验证。

### 3.2 线程

- 每一条分别通过普通帖加权长度校验。
- 每一条分别校验图片数量 0–4；不能把整个线程的图片数误当作单个帖子媒体数。
- 每条必须携带稳定 `itemCode`，后续条目的 `replyToItemCode` 只能指向前序条目；禁止环和跳到未批准内容。
- 整个线程属于同一 `approvedRevisionDigest`；改动任意一条都生成新修订并使原批准失效。
- 3–7 条是 LumiClaw 首版可审校建议，不是 X 平台硬上限。
- 当前手动模式可由用户在官方 composer 内构造线程；官方 API POC 只能用 `in_reply_to_tweet_id` 和 user-context OAuth，并需逐条回执。

### 3.3 图片、GIF、视频和可访问性

| 项目 | 结论 | 分类 |
|---|---|---|
| 图片数量 | 1–4 张 | `HARD_CONSTRAINT` |
| 图片大小 | 文档化 web 路径每张不超过 5 MB | `HARD_CONSTRAINT`（限定入口） |
| GIF | 移动端 5 MB、web 15 MB；单 GIF 与多图片组合需按当前 composer 验证 | 条件硬约束 |
| 单图完整显示范围 | 2:1 到 3:4 | `OFFICIAL_RECOMMENDATION`，是显示/裁剪提示，不是拒绝上传条件 |
| 图片/GIF ALT | 每张不超过 1,000 字符 | `HARD_CONSTRAINT`；内容质量由 Auditor 检查 |
| 视频 ALT | 不把图片 ALT 模型套到视频 | `NOT_CLAIMED` |
| 视频可访问性 | 提供并审校字幕；X 支持 SRT/字幕能力 | `OFFICIAL_RECOMMENDATION` |
| 非 Premium 视频安全包络 | 140 秒、512 MB | 账号能力未知时的官方公开回退值 |
| Premium 视频 | 官方帮助页当前互相冲突 | `NEEDS_ACCOUNT_PROBE` |

API 媒体文档给出的 1280×720、720×1280、H.264/AAC 等建议只用于 `X_API_V2` 上传 profile，不应覆盖 web/iOS 的 Premium profile。

### 3.4 Poll 与 hashtag

- Poll：2–4 个选项；每项 1–25 字符；持续 5–10,080 分钟；Poll 与媒体、quote、card URI 互斥。这些来自官方 Create Post API，可做确定性校验。
- Hashtag 中不能有空格和标点，剩余总量仍受帖子字符上限控制。
- 官方建议每帖不超过 2 个 hashtag；这是推荐，不是硬上限。超过 2 个只能产生 warning 与 Owner 决策，不能显示为“平台拒绝”。
- 可访问性建议用 CamelCase hashtag、sentence case、分段和少量 emoji；均属于内容审校建议。

### 3.5 长文与发布入口

- Longer Post：账号能力存在时最多 25,000 字符；能力未知则降级为 thread。
- Article：官方入口 `https://x.com/compose/articles`，支持富文本、图片、视频/GIF、Post 与链接；发布资格依赖订阅/账号能力。当前官方 Premium 页的 tier 描述不完全一致，必须探测，不做静态 tier 判断。
- 手动普通发布入口：`https://x.com/compose/post`。
- 官方 API：`POST /2/tweets`，媒体先走官方 media upload；OAuth 2.0 PKCE 需要 user-context scopes，例如 `tweet.read`、`tweet.write`、`users.read`。
- 当前产品边界：X Direct 仍是 `POC-GATED`、Canary、官方 OAuth/API only；否则走 `MANUAL_DESKTOP_ASSISTANT`。

### 3.6 X 账号能力快照

至少记录：

- `accountId`、确认时显示的 `@handle`、组织/个人类型；
- `clientSurfaceCode`：web、iOS、Android、API v2；
- `longPost`、`articleComposer`、`poll`、`mediaUpload`、`videoDurationSeconds`、`videoMaxBytes`；
- OAuth scopes、developer app/project、当前 API 可用性；
- `observedAt`、证据截图/响应摘要、`expiresAt`；
- 任何账号、tier、客户端、地区或平台文档变化都使相关批准/能力快照失效。

## 4. 小红书首批内容合同

### 4.1 入口和能力边界

当前可用入口：

- 创作服务平台：`https://creator.xiaohongshu.com/publish`，登录后字段与能力需账号实测；
- 小红书原生 App：当前手动交接的最终回退；
- 官方 Share SDK：Android/iOS/HarmonyOS/JavaScript 能力概览存在，但需要应用登记、审核与 AppKey，且各端能力不同；后续只能作为独立官方 adapter 研究，不是服务端直接发布 API。

当前不允许：

- 抽取/存储浏览器 cookie 作为产品凭证；
- 逆向签名或调用私有 web API；
- CDP/Playwright/无头浏览器自动点击发布；
- 自动点赞、收藏、评论、关注；
- 以“打开发布页”或 Share SDK 回调代替真实发布回执。

### 4.2 图文笔记与视频笔记

| 项目 | 可执行合同 | 适用范围 |
|---|---|---|
| 图文 Share SDK | 1–18 张图片 | Android/HarmonyOS 官方 Share SDK；不是全平台通用值 |
| 视频 Share SDK | 1 个视频，0–1 张封面 | 官方 Share SDK 文档路径 |
| 图/视频混用 | LumiClaw 直接阻断 | 部分 SDK 会静默优先图片，这会破坏 exact-artifact 审批 |
| 标题/正文 SDK 自动填充 | 不得假设 | 官方 Q&A 明确说明当前受限 |
| Share SDK 成功 | 仅代表该 SDK 回调结果 | 仍需真实笔记链接/截图做业务对账 |

### 4.3 标题、正文、图片、封面、话题

公开来源不足时的处理如下：

| 项目 | 首版处理 | 原因 |
|---|---|---|
| 标题最大长度 | `NEEDS_ACCOUNT_PROBE` | 未找到覆盖创作中心/原生 App 的公开官方精确值；候选 Skill 在 20 与 38 之间互相冲突 |
| 正文最大长度 | `NEEDS_ACCOUNT_PROBE` | 未找到当前公开官方精确值；不能把第三方常见 1,000 当平台硬规则 |
| 话题数量 | `NEEDS_ACCOUNT_PROBE` | 官方只说明可挂载/推荐话题，未给稳定公开总数 |
| 话题实体 | 原生 selector 实测 | 纯文本 `#标签` 不等于已创建平台话题实体 |
| 创作中心图片最大数 | `NEEDS_ACCOUNT_PROBE` | 1–18 只来自特定 Share SDK 路径 |
| 3:4 图片 | `EMPIRICAL_RECOMMENDATION` | 官方 iOS 旧裁剪路径提供了 3:4–2:1 包络，但 Q&A 明确新旧裁剪未统一 |
| 1080×1440 | `EMPIRICAL_RECOMMENDATION` | 落在旧路径已公开包络内，便于稳定渲染；仍需原生预览 |
| 首图作封面 | `EMPIRICAL_RECOMMENDATION` | 本轮未找到稳定公开官方通用规则；Owner 必须检查原生预览 |
| 视频 1080×1920 H.264/AAC | `EMPIRICAL_RECOMMENDATION` | 仅作为首测导出，时长、大小、codec、封面与比例都需账号/客户端实测 |

iOS 官方旧资源路径说明：最长边超过 1,920、宽度低于 600、宽度超过 1,280、宽高比小于 3:4 或大于 2:1 时会裁剪。该页面同时区分“旧裁剪逻辑”和“新裁剪规则”，官方 Q&A 也说规则尚未统一，所以这些数字不能提升为全平台硬约束。

### 4.4 社区与商业规范

平台内容分类必须先于规则应用：

- 普通社区笔记：遵守社区公约/社区规范，真实分享，不做虚假夸张、侵权或非法内容；复杂语义由独立 Auditor 审核，系统不宣称能自动完成法律合规。
- 品牌合作/蒲公英笔记：适用先审后发、客户确认、合作授权、利益关系和平台规则；不得做绝对保证、全称化效果承诺。
- 广告/聚光物料：需额外满足广告审核、第三方商标/肖像/合作授权与行业资质。
- 不同内容分类不能互相借用“已审核”的结论；商业状态或授权变化会使批准失效。

### 4.5 小红书账号/地区能力快照

至少实测并记录：

- 账号身份、登录账号昵称/ID、普通/专业号/品牌合作能力；
- 当前地区与客户端：creator web、iOS、Android、HarmonyOS；
- 图文/视频入口、标题与正文 counter、图片上限、视频时长/大小、封面、定时、原创、可见范围；
- 话题 selector 能否找到并挂载建议话题；
- 每张图实际裁剪预览与图片顺序；
- 若研究 Share SDK：AppKey、应用审核、包名/Bundle ID、最低 App 版本和 SDK 版本；
- `observedAt`、证据、`expiresAt`。首版建议 creator 能力 14 天过期，内容规则来源 30 天复核。

## 5. 配图生成、裁剪与导出合同

### 5.1 共同原则

1. 保留可重导出的 source master；export 是派生物，不能覆盖 master。
2. 生成式模型优先只生成无文字背景/氛围图；标题、数据和品牌文本用确定性 HTML/SVG 叠加，避免中文乱码和不可审计变化。
3. export 固定 sRGB，记录宽高、格式、字节数和 SHA-256；更改任一像素产生新 artifact revision。
4. 关键事实、数字、CTA 不只存在于图片；X 用正文/ALT，小红书用正文重复表达。
5. 避免把第三方 logo、人物肖像、截图或网络图片当成“可商用”；每个资产携带 rights evidence。
6. 裁剪、压缩、重排图片均属于内容变化，必须重新生成批准摘要。

### 5.2 首版导出 profile

| Profile | 推荐 export | 平台硬规则/来源关系 |
|---|---|---|
| `X_SINGLE_POST` | 1600×900 PNG/JPEG，sRGB，目标 <5 MB | 16:9 是项目默认；5 MB 与 1–4 张来自官方 web 帮助/API |
| `X_THREAD` | 必要时某一条附 1600×900；避免每条重复同图 | 数量和字符逐条校验；3–7 只是项目建议 |
| `XHS_IMAGE_NOTE` | 1080×1440 PNG/JPEG，sRGB；首图为设计封面 | 1080×1440 与首图规则均为经验建议；原生裁剪预览为必做 probe |
| `X_VIDEO_POST` | API POC 默认 1280×720 H.264/AAC；字幕单独审校 | API profile 建议；web/Premium 限制按 CapabilitySnapshot |
| `XHS_VIDEO_NOTE` | 首测 1080×1920 H.264/AAC + 独立封面 | 全部标为经验建议，真实时长/大小/codec/比例需 probe |

### 5.3 审校 checklist

生成前：

- [ ] 当前 Claim–Evidence 已批准，图上数字能回到证据；
- [ ] 素材权利、许可、人物/商标授权明确；
- [ ] 已选择 platform + artifact profile + market + content locale；
- [ ] 没有把 UI locale 当作内容语言或目标市场。

导出后：

- [ ] 宽高、格式、颜色空间、字节数和 digest 已记录；
- [ ] 关键文字在安全区内，缩略图仍可读，颜色对比可接受；
- [ ] X 每张图有准确 ALT，视频有审校过的字幕；
- [ ] 小红书关键图片信息在正文重复表达；
- [ ] 原生 composer 逐图预览过裁剪和顺序；
- [ ] 无水印、乱码、截断、未授权素材、隐私信息或未批准联系方式；
- [ ] export digest 与 Owner 批准 digest 相同。

发布前：

- [ ] 登录账号与 AccountMandate 匹配；
- [ ] 当前规则包、能力快照未过期；
- [ ] 所有硬约束通过；recommendation warning 有 Owner 决定；probe 已填证据；
- [ ] 商业内容分类、授权、披露和审核路径正确；
- [ ] 发布动作仍由手动原生流程或未来获批的官方 API operator 执行；
- [ ] 已定义成功、失败、取消、未知的 reconciliation 证据。

## 6. GitHub / Skill 研究与许可证结论

使用 `skills.sh`、ClawHub、GitHub repository/API/code search 和本地 Skill 扫描。原始候选元数据见 [GITHUB-SKILL-CANDIDATES.json](./GITHUB-SKILL-CANDIDATES.json)。

| 候选 | License | 可复用内容 | 结论 |
|---|---|---|---|
| `twitter/twitter-text@v3.1.0` | Apache-2.0 | 官方加权字符解析和 conformance | 进入依赖评审；优先固定依赖，不手抄 |
| `xdevplatform/samples` | Apache-2.0 | OAuth/API/media 测试思路 | 一级参考，不直接复制 |
| `JimLiu/baoyu-skills` / `baoyu-post-to-x` | MIT | 预览、最终确认、后置检查 | 只重写安全模式；浏览器发布不进入产品 |
| `langchain-ai/deepagents` social-media | MIT | research-first、thread 输出结构 | 只作内容工作流参考，不能作为规则来源 |
| `xpzouying/xiaohongshu-mcp` | Apache-2.0 | 错误态/能力测试启发 | 技术路径依赖 cookie/浏览器，connector 拒绝 |
| `white0dew/XiaohongshuSkills` | MIT | preview、selector 失效案例 | 默认无头自动发布，connector 拒绝 |
| `jackwener/xiaohongshu-cli` | `pyproject` 声明 Apache-2.0，根 LICENSE 缺失 | 结构化错误码 | 逆向 API、签名、cookie、anti-detection；拒绝且不复制 |
| `autoclaw-cc/xiaohongshu-mcp-skills` | MIT | narrow Skill 边界、确认模式 | 依赖非官方自动发布；只重写合同边界 |
| `adjfks/corner-skills` | 无许可证 | research-before-writing | 禁止复制，且平台数字无一级来源 |
| `Xiangyu-CAS/xiaohongshu-ops-skill` | 无许可证 | snapshot/replay、停在发布页 | 禁止复制；浏览器运营路径不进入产品 |
| `gitroomhq/postiz-app` | AGPL-3.0 | provider/scheduling/receipt 产品研究 | `POC-GATED`，Apache-2.0 源树零复制；仅未来 BYO adapter 候选 |

依赖与自动化面：`twitter-text` 是可隔离的纯解析依赖；X 官方 samples 需要开发者 app、OAuth 和真实账号能力。`baoyu-post-to-x` 依赖 Chrome、Bun、剪贴板/辅助功能或 CDP。小红书候选普遍依赖 Chrome/CDP、Playwright/Camoufox、`browser-cookie3`、二维码 cookie 会话、MCP server 或逆向签名；这类依赖同时扩大秘密、账号、平台封禁和供应链面，不能仅凭“本地运行”降低风险。Postiz 是完整网络服务与数据库/队列型应用，不是可直接嵌入的轻量 Skill。

本地 Skill 结论：

- `baoyu-post-to-x` 本地版 1.57.1：保留“展示预览、当前轮明确确认、发布后验证”的安全思想；其中 10,000 长帖、60 分钟视频等数字已与当前官方资料不一致，不能引用。
- `lumilab-content-repurpose`：HTML→1080×1440 的确定性中文封面思路有价值，但 manifest 为 AGPL-3.0-or-later，且“XHS 标题 38、标签 3–10”等被写成硬规则却无一级来源；不复制代码或模板。
- `lumilab-research-platforms`：可作为研究采集参考，不是公开动作 connector。

许可证只是第一道门。候选即使是 MIT/Apache-2.0，只要依赖 cookie、逆向 API、anti-detection 或无头自动发布，就仍然不满足平台和产品政策。

## 7. Schema 设计

### 7.1 `PlatformRulePack`

原型：[platform-rule-pack.schema.json](./schemas/platform-rule-pack.schema.json)

关键字段：

- stable codes：`packId`、`platformCode`、`ruleCode`、`artifactProfileCodes`、`deliveryModeCodes`；
- provenance：`retrievedAt`、`reviewedAt`、`reviewCadenceDays`、`expiresAt`、可选 `contentDigest`；
- source：URL、publisher、authority、sourceType、sourceVersion、独立过期时间；
- rule class：`HARD_CONSTRAINT`、`OFFICIAL_RECOMMENDATION`、`EMPIRICAL_RECOMMENDATION`、`NEEDS_ACCOUNT_PROBE`；
- applicability：market、locale、artifact profile、delivery mode、client surface、capability selector；
- validation：deterministic、Auditor、Owner、capability probe；
- fallback：block、warning、profile downgrade、manual native handoff；
- `sourceConflicts`：不静默覆盖官方冲突，记录冲突和保守解析。

规则包过期时默认阻断，不允许把旧值继续当已验证平台事实。

### 7.2 `ArtifactProfile`

原型：[artifact-profile.schema.json](./schemas/artifact-profile.schema.json)

它描述用户可见 artifact，而不是某个 Agent 的内部文本：

- `profileCode`：如 `X_SINGLE_POST`、`X_THREAD`、`XHS_IMAGE_NOTE`；
- market、content locale 与 UI locale 分离；
- required/optional content fields 与 media slots；
- 推荐导出值必须带 recommendation 分类；
- 固定 rule pack version/digest；
- 允许的 delivery mode、capability probe 和 manual fallback；
- Owner-visible checklist 与确定性 validator。

后续可追加 `X_LONG_POST`、`X_ARTICLE`、`X_POLL`、`X_VIDEO_POST`、`XHS_VIDEO_NOTE`，但首批 fixture 不应被一次性扩成全平台产品。

### 7.3 platform Skill manifest

原型：[platform-skill-manifest.schema.json](./schemas/platform-skill-manifest.schema.json)

manifest 必须声明：

- 版本、来源 URL/commit/tag、SPDX、采用/重写/拒绝决策；
- AgentTeams runtime 与角色；
- 输入/输出 schema、rule packs、artifact profiles；
- network/browser/cookie/secret/public-write 权限；
- external action 分类、Owner confirmation、exact approved digest；
- expired source、unknown capability 和 hard failure 的 fallback；
- validator 与 fixture。

首个建议 Skill `org.lumiclaw.platform-content-contract` 为第一方 Apache-2.0、无网络/浏览器/cookie/secret/public write，只做内容合同生成/校验；Producer 生成，Auditor 独立审校，Leader 只看状态。

## 8. 最小 machine-readable fixtures

- [X 单帖](./fixtures/x-single-post.fixture.json)：ASCII + URL，用官方 23-char URL 语义，预期 weighted length 124；1 张 1600×900 图片与 ALT。
- [X 线程](./fixtures/x-thread.fixture.json)：3 条有序 reply chain，每条独立加权长度；3 条只体现首版审校建议。
- [小红书图文笔记](./fixtures/xiaohongshu-image-note.fixture.json)：中文标题/正文、3 张 1080×1440 图片、话题 suggestions、必做账号与裁剪 probe。
- [X RulePack](./fixtures/x-platform-rule-pack.v1alpha1.json)
- [小红书 RulePack](./fixtures/xiaohongshu-platform-rule-pack.v1alpha1.json)
- [第一方 Skill manifest](./fixtures/platform-content-contract.skill-manifest.json)

fixture 只描述内容合同，不包含真实客户、账号、私信、cookie、token 或可公开执行的凭证。

## 9. 后续代码落点

本 PR 不写生产业务逻辑。建议下一 SDD 在依赖 PR 合并后落到：

| 落点 | 责任 |
|---|---|
| `packages/domain/src/platform-rules.ts` | stable codes、RulePack/Profile/validation result 类型 |
| `packages/domain/src/schemas/` | 生产 JSON Schema 与 Ajv strict validator |
| `packages/domain/src/x-weighted-text.ts` | 固定官方 parser adapter，不手抄算法 |
| `packages/mission-compiler/` | Producer/Auditor 角色投影；Leader 只拿状态与阻塞原因 |
| `packages/db/` | pack/profile/version/digest、CapabilitySnapshot、ArtifactValidationResult 持久化 |
| `skills/platform-content-contract/` | 第一方 Skill + manifest；不含发布动作 |
| `apps/api/` | 只读 Skill/rule/profile 查询与受治理 validation endpoint |
| `apps/web/` | Owner 可见 hard/warning/probe、来源、过期、原生预览/对账步骤 |
| activation/manual handoff | 绑定 exact approved revision、media manifest、rule-pack digest、capability digest |

与在审 PR 的衔接：

- PR #5 / SDD-004：复用 `MANUAL_DESKTOP_ASSISTANT`、账号确认、官方入口 allowlist、失败/未知 reconciliation 与 exact digest。
- PR #6 / SDD-005：复用 version/source/retrievedAt/scope/expiry/digest、campaign > organization > public-pack precedence 和 Producer/Auditor 分离。
- PR #7 / SDD-006：扩展 read-only Skill registry；不能只返回 `name/state/license`，还要安全暴露 manifest version、rule/profile bindings、source expiry 与 permissions。

## 10. 测试矩阵

| ID | 层 | 用例 | 预期 |
|---|---|---|---|
| PR-001 | Schema | 未知 stable code / 缺 source / 缺 expiry | reject |
| PR-002 | Provenance | source 或 pack 过期 | block；要求 refresh |
| PR-003 | Classification | recommendation 被配置为 block，或 probe 被配置为 warn | schema/policy reject |
| X-001 | Weighted text | ASCII/CJK/emoji/combining mark/URL | 与 pinned `twitter-text` fixture 一致 |
| X-002 | Boundary | regular Post 280 / 281 | pass / block |
| X-003 | URL | 短 URL、长 URL、多个 URL | 每个固定 23 |
| X-004 | Images | 1 / 4 / 5 张 | pass / pass / block |
| X-005 | Image ALT | 1,000 / 1,001 字符 | pass / block |
| X-006 | Thread | 每条合规、越长一条、环、指向后序 | pass / block / block / block |
| X-007 | Thread media | 单条 0 / 4 / 5 张 | pass / pass / block；按 item 校验 |
| X-008 | Thread count | 2 / 3 / 7 / 8 | warning / pass / pass / warning；绝不称平台拒绝 |
| X-009 | Poll | options 2/4/5，option 25/26，duration 5/10080/10081 | 边界 pass，越界 block |
| X-010 | Poll mix | poll + media/quote/card | block |
| X-011 | Long Post | capability true/false/stale | validate / downgrade thread / block refresh |
| X-012 | Article | composer true/unknown | validate profile / downgrade thread |
| X-013 | Video | conflicting source + no capability | use verified safe fallback or manual; no universal Premium number |
| X-014 | API auth | missing user scopes / app access | manual fallback，禁止 cookie/CDP 替代 |
| XHS-001 | Share images | SDK path 1/18/19 | pass / pass / block；manual path 不套 18 上限 |
| XHS-002 | Video | 1 video + 0/1 cover；image+video | pass / block mixed package |
| XHS-003 | Text autofill | SDK accepts title/body fields | result remains user-action-required until native text verified |
| XHS-004 | Counters | no account probe | pending/block approval；不使用 20/38/1,000 假常量 |
| XHS-005 | Image export | 1080×1440 vs other ratio | pass recommendation / warning + native preview |
| XHS-006 | Topics | plain `#` vs native topic entity | suggestions only / confirmed after probe |
| XHS-007 | Commercial | missing authorization/disclosure/rights | Auditor block |
| ACT-001 | Exact artifact | text/media/order/crop changes after approval | invalidate approval and grant |
| ACT-002 | Reconciliation | page opened / user cancelled / unknown / real URL | not success / cancelled / unknown / reconciled |
| SK-001 | Permission | Skill requests browser/cookie/publicWrite while manifest says content-only | registry reject |
| SK-002 | License | AGPL or NOASSERTION source enters Apache tree | dependency/license gate reject |
| I18N-001 | Semantics | zh-CN UI + en content + GLOBAL market | preserve three separate codes |

## 11. 迁移顺序

1. Coordinator 为下一 SDD 分配正式 ID；建议名 `PLATFORM-RULE-PACK-AND-ARTIFACT-PROFILE-FOUNDATION`。
2. 等待/吸收 SDD-004、SDD-005、SDD-006 的最终合并接口，避免重复定义 activation、provenance 和 Skill registry。
3. 把本轮 v1alpha1 schema 转为 domain types + strict Ajv schema；保留 research fixture 作为 golden input。
4. 对 `twitter-text` 做依赖、许可证、NOTICE、供应链与 conformance 评审；不能采用则实现薄 adapter 但不复制第三方代码。
5. 先实现纯内容 validation 和 read-only registry；不连接发布。
6. 增加 Account Capability Probe 与 Owner 证据 UI；来源/能力过期 fail closed。
7. 接入 manual handoff exact digest；验证成功/失败/未知 reconciliation。
8. X official API 与小红书 Share SDK 分别开新的 POC-GATED SDD；不能由内容合同 SDD 顺带扩大权限。

## 12. 已知局限

- 未登录 Owner 的真实 X / 小红书账号，因此没有 `EXTERNAL_CALIBRATED` capability evidence；全部账号能力为 `PLANNED`。
- 小红书创作中心登录后 counter、图片/视频限制、话题 selector 与地区差异尚未实测。
- X 官方帮助页会动态更新，并已有同日冲突；30 天默认复核不足以覆盖 Premium/video，相关 source 已设 14 天过期。
- 本轮没有复制第三方 Skill 原文件，因许可证、平台政策和公共仓库边界优先于 Skill Scout 的“留存原件”常规做法。
- 未生成真实媒体二进制；fixture 只记录将来 media export 的合同字段与安全占位路径。
- 未修改生产代码、数据库、Skill registry、发布 operator 或 canonical progress。
