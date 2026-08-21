# SDD-008 Dependency, License and Security Review

> Classification: `PUBLIC_SAFE_SYNTHETIC`
> Date: 2026-08-22
> Scope: SDD-008 guided persona, knowledge and account onboarding

## Result

- No runtime or development dependency was added, removed, or upgraded. `package-lock.json` is unchanged from base `001ef2e5e8e10402d93f5f3dd02fff2a1a2315c0`.
- `npm run verify:sdd008:dependencies` passed: 1,020 packages inventoried, 710 CycloneDX 1.6 components, zero disallowed or unknown licenses. The complete local artifacts are `.evidence/sdd-008/license-inventory.json` and `.evidence/sdd-008/sbom.cdx.json`.
- `npm run check:secrets` passed over 446 tracked/untracked source files at the time of the review. Browser/API evidence contains public-safe synthetic names and digests only.
- No Postiz, AGPL source, competitor source, Shadcn source, document parser, scraping library, OAuth SDK, platform SDK, or new package was introduced. The Web uses the repository's existing React, Radix, Tailwind, Lucide, token, and primitive stack.
- The `frontend-design` Skill informed the use of the existing UX 1.4 shell, restrained information hierarchy, localized business labels, and desktop interaction quality; it did not add code or third-party assets.

## Vulnerability audit boundary

Two current `npm audit` attempts for both the production tree and complete tree returned non-zero because the npm advisory bulk endpoint disconnected before TLS establishment. No vulnerability result was returned, so this run records `NOT_VERIFIED_TRANSIENT_REGISTRY_FAILURE`, not a pass.

The exact frozen convergence base documents a successful production audit with zero findings and three pre-existing high findings in the development-only Storybook toolchain. Because SDD-008 leaves the lockfile unchanged, it does not introduce a new dependency delta; nevertheless, Coordinator/CI must rerun both commands when the registry is reachable:

```sh
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

This review does not treat the prior baseline as a substitute for a current advisory response, does not run `npm audit fix --force`, and makes no production-readiness or security-certification claim.

## Privacy and external-action boundary

- Secrets, passwords, cookies, OAuth tokens, API keys, private account credentials, and raw customer data are forbidden by the browser contract and server-side exact-schema/secret-shape checks.
- Rejection audit rows contain stable reason codes and redacted metadata only.
- Account profiles store only Owner-confirmed non-secret operating metadata.
- No AgentTeams run, Campaign/Goal, connector, ActionGrant, platform write, scrape, message, post, comment, follow, or DM is created by SDD-008.
- Canonical screenshots and JSON evidence are synthetic and public-safe. Failure diagnostics remain under gitignored `.evidence/sdd-008/diagnostics/`.
