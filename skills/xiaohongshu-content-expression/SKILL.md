---
name: xiaohongshu-content-expression
version: 1.0.0
license: Apache-2.0
---

# Xiaohongshu content expression

Trigger: the assigned Producer receives one released Xiaohongshu ActivationUnit from an exact MissionExecution bundle.

Inputs: exact Bundle, Goal, approved Plan, approved KnowledgeSnapshot, Xiaohongshu AccountOperatingProfile, registered artifact profile and source-set digests. Output: one schema-valid IMAGE_NOTE ProducerSubmission containing title, full body, topics, CTA, cover specification and continuously ordered image specifications. An image specification is not a generated image; a media reference is allowed only when it carries an owner-authorized local digest, safe file name, media type and alt text.

Allowed tools: released task read, approved evidence read, artifact submission and safe trace append. Failure: quarantine platform/account/Producer/source/Skill/profile mismatch, missing fields, invalid order or stale platform constraints. Privacy: approved public-safe content only; never expose original private files, secrets or local absolute paths. Permission: produce only; no image generation, upload, audit, Owner decision, package creation, browser automation or publishing.

Tests: title/body/topics/cover schema, ordered image specs, no-fake-media boundary, authorized-media validation, exact bindings and stale profile.
