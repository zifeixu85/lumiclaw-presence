# Dependency Policy

[English](DEPENDENCY-POLICY.md) | [简体中文](DEPENDENCY-POLICY.zh-CN.md)

LumiClaw Presence is licensed under Apache-2.0. Every dependency, copied asset, container image, generated artifact, external service, and migrated legacy file must be reviewed before it enters a release path.

## Required record

Record the following in the SDD or dependency register:

- exact project, package, image, provider, or asset;
- pinned version, tag, digest, commit, or API version;
- source and license;
- classification: `BUILD`, `INTEGRATE`, `POC-GATED`, or `LATER-REPLACE`;
- invocation, process, database, and secret boundary;
- distribution, hosted-service, attribution, NOTICE, and source-offer obligations;
- known security advisories and maintenance state;
- replacement interface and migration cost;
- tests and evidence that justify the decision.

## Default rules

- Prefer supported, actively maintained dependencies with permissive licenses and small transitive surfaces.
- Lock versions and container digests. Do not use floating production tags.
- Generate an SBOM and license inventory in CI before a release claim.
- Preserve copyright, license, attribution, and NOTICE obligations.
- Never copy competitor or upstream source merely because it is publicly visible.
- AGPL/GPL/SSPL/BSL, source-available, non-commercial, field-of-use, or unclear licenses require an explicit architecture and distribution decision before integration.
- Network or process isolation reduces coupling; it is not a legal safe harbor.
- Third-party APIs require terms, data-purpose, privacy, retention, authentication, failure, and replacement review.
- Community connectors, scrapers, actors, and API marketplace endpoints remain `POC-GATED` until the concrete provider and endpoint pass review.
- Legacy files are migrated one by one with source commit/digest, semantic changes, license status, privacy review, and regression tests.

## Current special decisions

- AgentTeams: integrate through a pinned, isolated runtime adapter after the M0 security gate.
- Postiz: `POC-GATED`; no source copy, shared database, or internal queue coupling.
- Spec Kit: methodology reference now; CLI or generated project files require a pinned-version, license, provenance, and diff review before installation.
- DeepSeek, EvoLink, TikHub, Apify, and RapidAPI: provider adapters only; brand names do not enter core domain semantics.

This policy is engineering governance, not legal advice. Escalate uncertain redistribution, hosted-service, data, trademark, or patent questions before release.
