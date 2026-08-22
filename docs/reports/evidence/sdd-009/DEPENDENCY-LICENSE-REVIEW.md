# SDD-009 Dependency / License / Audit Review

- Scope: `SDD-009-PERSISTENT-GOAL-SELECTED-PLATFORM-COMPILER`
- Classification: `PUBLIC_SAFE_SYNTHETIC`
- Node/npm: `24.16.0` / `11.13.0`
- Lockfile SHA-256: `d726259c80efa7c1cd0295afd0ae2611e9b60dbbda8556ad963d93049c713746`

## 变更结论

本 SDD 没有新增第三方 package。`apps/api` 只新增了仓库内已有的 workspace dependency `@lumiclaw/mission-compiler: "*"`，使 API 直接使用同一 deterministic compiler v2；对应 lockfile 仅新增这个 workspace edge。没有复制竞品源码、AGPL 源码或 Postiz 代码，也没有引入平台 SDK、抓取器、模型 SDK、Secret broker 或 Connector。

## Inventory 与 SBOM

- `npm run verify:sdd009:dependencies`: `PASS`
- Dependency inventory: 1,020 packages；`disallowedCount=0`
- CycloneDX: 1.6；710 components
- Canonical inventory files 已按当前 lockfile 更新：
  - `docs/dependencies/LICENSE-INVENTORY.json`
  - `docs/dependencies/VERSION-MANIFEST.json`
- 完整 machine evidence 位于 gitignored `.evidence/sdd-009/`，PR 不提交本机绝对路径或缓存。

许可证集合包含 Apache-2.0、MIT、BSD、ISC、MPL-2.0、LGPL-3.0-or-later 等既有依赖声明；inventory policy 判定无禁用项。此结论只覆盖依赖清单与当前政策，不把未审阅的未来依赖视为自动兼容。

## npm advisory 结果

| 命令 | 结果 |
|---|---|
| `npm audit --omit=dev --audit-level=high --json` | `PASS`：production 0 high / 0 critical / 0 total |
| `npm audit --audit-level=high --json` | dev-only 3 high / 0 critical；无可用修复 |

三个 dev-only 条目为 `@storybook/nextjs-vite` → `vite-plugin-storybook-nextjs` → `image-size <=2.0.2`。上游 advisory 为 ICNS/JXL/HEIF parser 可能无限循环导致 DoS（GHSA-w3rx-r6r6-pgpr、GHSA-5p2g-fcmc-qvqq）；当前 dependency tree 报告 `fixAvailable=false`。

风险边界与决定：

- 该路径不进入 API/Web production runtime；`npm audit --omit=dev` 为零。
- Storybook 只在开发/CI 构建仓库自有、公开安全的静态资产，不接受用户上传的 ICNS/JXL/HEIF 输入。
- CI 仍构建 Storybook 并执行 browser-safety gate；不把 dev audit 误报为零风险。
- 在上游发布兼容修复后，应在独立依赖变更中升级并重跑 production/full audit、Storybook build 与视觉证据；本 SDD 不通过未经验证的 override 改写 transitive dependency。

## 安全与隐私边界

- public evidence 只含 synthetic Goal/Plan/Bundle、稳定 digest、公开安全 handle 与截图。
- 没有 Secret、Cookie、OAuth token、真实账号、客户资料或原始私有来源进入 fixture、日志、SBOM 或提交。
- 浏览器不收集 Secret；SDD-009 mutation 只接收 owner-bound structured payload、`If-Match`、exact digest 与 `Idempotency-Key`。
- `externalActionAllowed=false`、`agentTeamsExecuted=false`；依赖审查不构成 production readiness、安全保证或法律合规保证。
