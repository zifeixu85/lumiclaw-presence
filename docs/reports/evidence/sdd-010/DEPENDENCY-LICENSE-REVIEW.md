# SDD-010 dependency and license review

- Review result: `PASS_WITH_EXISTING_DEV_ONLY_ADVISORY`
- Runtime/package decision: no new npm dependency and no lockfile change. ManualPublishPackage uses deterministic JSON/file responses, so no ZIP/archive library was introduced.
- Skill implementation: three repository-owned Apache-2.0 Skill files were created from the SDD contracts; no Postiz, competitor, platform SDK or third-party Skill source was copied.
- Inventory: 1,020 packages; 710 CycloneDX 1.6 components; disallowed license count 0. Generated evidence is under `.evidence/sdd-010/` and the canonical public dependency inventory remains rooted at `.evidence/sdd-002/` for the shared quality job.
- Production audit: `npm audit --omit=dev --audit-level=high --json` reported 0 total/high/critical vulnerabilities.
- Full audit: `npm audit --audit-level=high --json` reported 3 high entries in the existing Storybook-only development chain: `@storybook/nextjs-vite` → `vite-plugin-storybook-nextjs` → `image-size<=2.0.2`. The advisory concerns denial of service in ICNS/JXL/HEIF parsing, `fixAvailable=false`, and does not enter the production dependency audit. Storybook remains limited to repository-owned public-safe assets.
- Platform-source review: `platform-source-review.json` records the sanitized official-entry checks. No response cookie, credential, private path or customer data is retained.

This review does not claim production readiness or eliminate the need to upgrade the Storybook chain when a compatible upstream fix exists.
