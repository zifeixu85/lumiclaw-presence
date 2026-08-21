# SDD-005 Clarifications

| ID | Question | Decision |
|---|---|---|
| CL-01 | Are market packs country stereotypes or free-form prompts? | No. They are structured, sourced, versioned and scoped items. |
| CL-02 | What is the first set? | Exactly US/en-US, JP/ja-JP and DE/de-DE. |
| CL-03 | Can Organization data be committed? | No. Only synthetic Organization fixtures; the real upload pipeline is out of scope. |
| CL-04 | Which source wins? | Campaign explicit decision > approved Organization knowledge > public pack; provenance remains. |
| CL-05 | What happens on incompatible values? | Deterministic blocked conflict; never silent overwrite. |
| CL-06 | Does a Public Pack guarantee compliance or content quality? | No; those claims are prohibited. |
| CL-07 | Does this change UI locale? | No. UI locale and content localization remain separate. |
| CL-08 | Is a vector database needed? | No. Static versioned fixtures and deterministic resolver are the minimum slice. |
| CL-09 | Which Agents receive it? | Planner selects; Producers consume minimum context; Auditor receives provenance/conflicts; Leader only coordinates. |
| CL-10 | Is current UX 1.1 core workspace modified? | No. Only an isolated evidence surface unless Owner authorizes a change request. |
| CL-11 | What status is allowed without a real enterprise? | At most `EVIDENCE_READY`; external calibration remains pending. |
| CL-12 | Can sources be copied wholesale? | No. Store metadata and bounded paraphrases; follow source citation/license limits. |

