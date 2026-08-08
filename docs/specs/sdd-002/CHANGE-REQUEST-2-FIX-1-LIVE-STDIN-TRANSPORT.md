# SDD-002 CR2 Fix 1 — Live runner stdin transport

Status: `SPEC_READY` after Coordinator failure evidence `COORDINATOR_FIX_REQUEST_CR2_1` on 2026-08-04.

## Verified failure

The Coordinator-started launcher successfully mounted both Compose secrets, passed container inspection, created one exact `LIVE_DEEPSEEK_UAT` Mission and submitted its three public identifiers. The nested Live Runner then exited with Node status 13 before AgentTeams execution. `scripts/run-live-deepseek-uat.mjs` created one `readline` Interface and awaited four consecutive `question()` calls over a non-TTY pipe. The first read buffered the remaining bytes and the pipe reached EOF before the second pending question resolved, producing `Detected unsettled top-level await` at the second question. The failed attempt is not Live Provider verification.

## Bounded correction

- Launcher serializes exactly four fields as one JSON document: `organizationId`, `missionId`, `campaignDigest`, and `bootstrap`.
- Environment verifier reads fd 0 once, keeps the document in process memory only, and forwards it to the Runner with captured stdin/stdout/stderr pipes.
- Runner reads fd 0 once with `readFileSync(0, 'utf8')`, rejects oversized, malformed, partial, extra-key, wrong-type, wrong-format, or trailing-document input, and never prompts or echoes stdin. Node 24's promise API does not accept a numeric fd, while the synchronous API does.
- Production and conformance use the same parser and the same nested child-process transport. Conformance may return only field count and one-way digests; it must never return raw field values.
- Runner, environment verifier and launcher expose only allowlisted stable JSON error codes. Raw child stdout/stderr, request headers, bootstrap values and tickets never become an exception or inherited terminal output.
- Every failure path retains exact cleanup of the `lumiclaw-sdd002-live-uat-cr2` Compose project, only the AgentTeams runtime objects owned by this attempt, and the launcher-owned private temporary Secret directory containing 0600 files. A preflight failure never cleans pre-existing global AgentTeams objects.

## Binary acceptance additions

1. A real nested child-process test transports all four valid JSON fields and returns only redacted digests.
2. Partial, malformed and extra-field documents exit nonzero with one stable code.
3. Dummy bootstrap/secret markers are absent from both stdout and stderr for every positive and negative case.
4. `verify:live-conformance` executes the nested transport suite and binds its counts, non-disclosure and cleanup claims into public-safe evidence.
5. Unit/type/full verify, no-secret Live conformance and real AgentTeams Mock acceptance pass from one clean committed Head.
6. Owner Key remains unknown to the Executor; `LIVE_PROVIDER_VERIFIED` remains pending until the Coordinator reruns the Canary.

## Out of scope

No provider, Mission state, AgentTeams internal, Docker socket, external platform action, canonical status, deployment or M3 change is authorized.
