# Source and Asset Register

This public register records only source metadata and bounded paraphrases. It contains no copied webpage, customer material, credential, private prompt or runtime evidence. `PUBLIC_SAFE_FIXTURE` entries are engineering inputs, not legal/cultural compliance advice, customer evidence, worldwide coverage or localization-quality proof.

## SDD-005 market-localization sources

Retrieved date for this review: `2026-08-16`.

| Source ID | Market / scope | Publisher | Title / URL | Version or update | Reuse / citation boundary | Bounded fixture use |
|---|---|---|---|---|---|---|
| `unicode-cldr-49-en-us` | US / `en-US`; locale quotation data | Unicode Consortium | [Locale Data Summary for English — CLDR 49](https://www.unicode.org/cldr/charts/49/summary/en.html) | CLDR 49, 2026 | Use only the small locale-data fact under the [Unicode Terms of Use, Exhibit 1](https://www.unicode.org/copyright.html); preserve publisher/version/link. | Paraphrased primary and nested quotation starting points. |
| `gsa-uswds-design-principles` | US / English web-copy review | U.S. General Services Administration, USWDS | [USWDS Design principles](https://designsystem.digital.gov/design-principles/) | Living guidance; retrieved 2026-08-16 | Bounded paraphrase only. The official [USWDS repository](https://github.com/uswds/uswds) identifies the project as CC0/public domain except separately identified assets; no asset or source code is copied. | Clear, easy-to-follow, scan-oriented copy review prompt. |
| `unicode-cldr-49-ja-jp` | JP / `ja-JP`; locale quotation data | Unicode Consortium | [Locale Data Summary for Japanese — CLDR 49](https://www.unicode.org/cldr/charts/49/summary/ja.html) | CLDR 49, 2026 | Same Unicode Exhibit 1 boundary; only a small locale-data fact is retained. | Paraphrased Japanese primary/nested quotation starting points. |
| `jp-digital-agency-typography-2025-04-23` | JP / Japanese typography review | Digital Agency, Government of Japan | [デジタル庁デザインシステムβ版 — タイポグラフィ（概要）](https://design.digital.go.jp/dads/foundations/typography/) | Updated 2025-04-23 | Attributed, transformed, bounded paraphrase. Follow the Digital Agency [usage notices](https://design.digital.go.jp/dads/introduction/notices/): identify the source and state that LumiClaw transformed it; do not imply Digital Agency authorship of the fixture. | Human-review prompt to avoid synthetic italics for Japanese text without a specific reason. |
| `unicode-cldr-49-de-de` | DE / `de-DE`; locale quotation data | Unicode Consortium | [Locale Data Summary for German — CLDR 49](https://www.unicode.org/cldr/charts/49/summary/de.html) | CLDR 49, 2026 | Same Unicode Exhibit 1 boundary; only a small locale-data fact is retained. | Paraphrased German primary/nested quotation starting points. |
| `german-spelling-council-rules-2024` | DE / German orthography review baseline | Rat für deutsche Rechtschreibung | [Amtliches Regelwerk der deutschen Rechtschreibung 2024](https://www.rechtschreibrat.com/DOX/RfdR_Amtliches-Regelwerk_2024.pdf) | 2024; current official update effective 2024-07-01 per the Council's [change overview](https://www.rechtschreibrat.com/DOX/RfdR_Amtliches-Regelwerk_2024_UeberblickAenderungen.pdf) | Citation-only reference and short original paraphrase; no rule text, word list or PDF content is copied. | Review against the current official-rule baseline; uncertainty remains a human question. |
| `synthetic-organization-*-approved-override` | One Organization + one market | LumiClaw repository authors | Repository-local synthetic fixture identity | `2026.08.16.1` | Apache-2.0 repository-authored synthetic data. It must always remain labeled `SYNTHETIC_ORGANIZATION_OVERRIDE_FIXTURE`. | Proves Organization precedence, isolation and an incompatible JP conflict; it is not enterprise/customer knowledge. |
| `synthetic-campaign-*-owner-decision` | One Campaign + one ActivationUnit + one market | LumiClaw repository authors | Repository-local synthetic fixture identity | `2026.08.16.1` | Apache-2.0 repository-authored synthetic data. It must always remain labeled public-safe and non-customer. | Binds the same synthetic product fact and explicit Campaign decisions without claiming content quality. |

## Source-review decisions

- No raw page, PDF, screenshot, source dataset, font, icon or third-party code is vendored.
- The pack stores short repository-authored paraphrases plus URL/publisher/title/retrieval/scope/version/terms metadata.
- CLDR values are version-pinned to 49; a later version must produce a new pack version and context digest.
- Japanese Digital Agency content is explicitly attributed and identified as transformed.
- The German official rule document is citation-only; the fixture does not reproduce the rules or claim legal correctness.
- No new runtime dependency, AGPL/Postiz component, vector database, crawler, account integration or external action is introduced.
