# Security Policy

## Current status

LumiClaw Presence is pre-alpha and has no supported production release.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for this repository:

https://github.com/zifeixu85/lumiclaw-presence/security/advisories/new

Do not disclose credentials, tokens, customer data, private messages, or an exploitable account action in a public issue.

Useful reports include:

- unauthorized or wrong-account action paths;
- grant replay, expiry, revocation, or digest bypass;
- duplicate publication after ambiguous failure;
- secret exposure in prompts, logs, fixtures, or receipts;
- cross-organization, identity, market, or account memory leakage;
- auditor/owner separation bypass;
- connector capability or reconciliation errors.

## Security posture

Until a capability is explicitly marked ENGINEERING_VERIFIED, treat it as PLANNED. No current version should be used to delegate autonomous production account access.
