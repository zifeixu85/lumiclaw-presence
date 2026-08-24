# SDD-012 dependency, asset and license review

- Review result: `PASS_WITH_EXISTING_DEV_ONLY_ADVISORY`.
- `sharp@0.35.3`: Apache-2.0 JavaScript package, pinned by lockfile. It is the local decoder/metadata normalizer/compositor and uses the platform-specific prebuilt libvips distribution. The implementation invokes it with bounded pixels/bytes, fail-on-error decoding, exact MIME/magic/dimension checks and deterministic PNG settings. The package and third-party notice material remains in the npm distribution/SBOM; no libvips source is copied.
- `opentype.js@1.3.4`: MIT, pinned by lockfile. It converts the reviewed font glyphs to SVG paths, so output does not depend on browser canvas, a system font or a CDN.
- Font: `NotoSansSC-Regular.otf` 2.004, OFL-1.1, SHA-256 `faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`, source commit `523d033d6cb47f4a80c58a35753646f5c3608a78`. The exact OFL text is stored beside the font. Missing glyph/emoji/color-font needs fail closed; there is no hidden fallback.
- Template and optional Logo: LumiClaw-original Apache-2.0 assets. Exact SHA-256 values are in `assets/media/ASSET-MANIFEST.json`; changes must create new lineage and invalidate affected review/approval/package state.
- Archive: repository-owned deterministic ZIP-store writer under Apache-2.0. It rejects duplicate/unsafe names and verifies each input digest before emitting bytes. No archive dependency, browser canvas, remote font or external binary is used.
- Provider: the EvoLink adapter is original integration code against cited official HTTPS documentation; no SDK, example code, model output or provider terms are copied. EvoLink is adapter metadata only and is absent from core domain enums/errors. Rights remain Owner-attested/`UNVERIFIED`; this review is not legal advice.
- Prohibited sources: no competitor, Postiz or AGPL source was copied. No customer material, Secret, private prompt, signed result URL or raw provider response is public evidence.
- Production audit: `npm audit --omit=dev --audit-level=high --json` reports 0 total/high/critical vulnerabilities.
- Full audit: 3 existing high entries remain in the Storybook-only development chain (`@storybook/nextjs-vite`, `vite-plugin-storybook-nextjs`, `image-size`), with no production dependency finding. They remain bounded to repository-owned public-safe Storybook assets and must be upgraded when a compatible fix is available.
- Inventory/SBOM: `DEPENDENCY_EVIDENCE_ROOT=.evidence/sdd-012 npm run verify:dependencies` is the authoritative generated inventory gate. Unknown, AGPL/GPL/SSPL/BUSL/BSL dependencies fail the repository policy.

This review supports engineering evidence only. It does not claim production readiness, generated-content ownership, provider availability, platform compliance or legal compliance.
