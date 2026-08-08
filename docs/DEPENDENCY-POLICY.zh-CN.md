# 依赖与许可证政策

[English](DEPENDENCY-POLICY.md) | [简体中文](DEPENDENCY-POLICY.zh-CN.md)

LumiClaw Presence 采用 Apache-2.0。任何依赖、复制资产、容器镜像、生成产物、外部服务和旧工程迁移文件，在进入发布路径前都必须完成审计。

## 必须记录

在 SDD 或 Dependency Register 中记录：

- 精确项目、Package、Image、Provider 或 Asset；
- 锁定版本、Tag、Digest、Commit 或 API Version；
- 来源与 License；
- `BUILD`、`INTEGRATE`、`POC-GATED` 或 `LATER-REPLACE` 分类；
- 调用、进程、数据库与 Secret 边界；
- 分发、托管服务、署名、NOTICE 与源码提供义务；
- 已知安全公告与维护状态；
- 替换接口与迁移成本；
- 支持该决策的测试和 Evidence。

## 默认规则

- 优先采用仍受支持、持续维护、宽松许可证且传递依赖较少的组件；
- 锁定版本与容器 Digest，生产路径不得使用浮动 Tag；
- 在发布声明前由 CI 生成 SBOM 和 License Inventory；
- 保留 Copyright、License、Attribution 与 NOTICE 义务；
- 代码公开可见不等于允许复制，不复制竞品或上游源码；
- AGPL/GPL/SSPL/BSL、Source-available、非商业、限制用途或不明确许可证，集成前必须有明确架构与分发决策；
- 网络或进程隔离只能降低耦合，不是法律安全港；
- 第三方 API 必须审计条款、用途、隐私、保留、鉴权、故障与替换边界；
- Community Connector、Scraper、Actor 与 API Marketplace Endpoint 在具体 Provider/Endpoint 通过审计前保持 `POC-GATED`；
- 旧文件逐项迁移，记录源 Commit/Digest、语义变化、License、隐私审阅和回归测试。

## 当前专项决策

- AgentTeams：在 M0 安全 Gate 后，通过锁版本、隔离 Runtime Adapter 接入；
- Postiz：`POC-GATED`，不复制源码、不共享数据库或内部队列；
- Spec Kit：当前只参考方法；安装 CLI 或生成项目文件前，必须锁版本、核验许可证和 Provenance，并审阅完整 Diff；
- DeepSeek、EvoLink、TikHub、Apify 与 RapidAPI：只位于 Provider Adapter 后，品牌名不进入核心领域语义。

本政策是工程治理，不替代法律意见。分发、托管服务、数据、商标或专利义务不明确时，发布前必须升级处理。
