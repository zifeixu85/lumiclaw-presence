# SDD-002 CR2 Fix 3 — Live task-level provider outcome

Status: `SPEC_READY` after Coordinator evidence `COORDINATOR_FIX_REQUEST_3` on 2026-08-04.

## Verified boundary

The Coordinator's third real Canary used clean Head `356a9cac79d49cbda05b5fad8855c93363159183`. Exact AgentTeams runtime identity, six-member topology, Project creation, eight-Task DAG planning, six role bindings, Control Plane dispatch and the deterministic Leader task passed. The first domain Task failed after the broker request began. The host receipt recorded `PROVIDER_REQUEST / LIVE_PROVIDER_REQUEST_FAILED`, failed Task `019fcd53-3df1-796b-b10e-0c87c9ad0648`, zero accepted model receipts, zero actions and complete cleanup.

Independent hidden-TTY probes then proved the official DeepSeek API, Owner credential, `deepseek-v4-flash`/`deepseek-v4-pro` visibility, JSON-object response mode, returned model identity and usage shape. Those probes are Coordinator evidence only; the Executor does not receive the credential or model content.

The remaining implementation gap is task-level diagnostic integrity. The API persists an allowlisted provider/model/semantic failure before returning a non-2xx response. The AgentTeams Worker uses `urllib.request.urlopen`, whose `HTTPError` exits before the JSON response is parsed. The Runner then discards captured child output and retains only the coarse stage code. Ephemeral PostgreSQL cleanup removes the specific Mission failure before it can be inspected.

Static inspection also finds a concrete first-domain-task contract defect: `DeepSeekModelProvider` locally validates `request.outputSchema`, but the schema is not included in either provider message. The system prompt tells the model to match a "supplied role schema" that was never supplied. The simple official JSON probe therefore does not prove that the `FREEZE_EVIDENCE` shape `{frozen, assessment}` can pass the product contract.

## Bounded correction

- Keep the top stage/code as `PROVIDER_REQUEST / LIVE_PROVIDER_REQUEST_FAILED`, and add one nullable `providerOutcomeCode` to the strict host receipt and child envelope.
- Derive the outcome by reopening the exact Mission before cleanup after a Worker nonzero exit. Accept only the persisted failure code or exact Task-bound `ModelCallSnapshot.error.code`; reject disagreement and map missing, malformed or non-allowlisted state to `LIVE_PROVIDER_BROKER_FAILED`.
- Allow only existing stable outcomes: `DEEPSEEK_SECRET_FILE_UNAVAILABLE`, `PROVIDER_HTTP_4xx`, `PROVIDER_HTTP_5xx`, `MODEL_TIMEOUT`, `PROVIDER_UNAVAILABLE`, response identity/model/finish/usage/response/JSON/schema failures, `LIVE_MODEL_SEMANTIC_OUTPUT_INVALID`, and `LIVE_PROVIDER_BROKER_FAILED`.
- Never propagate the HTTP body, prompt, model content, response ID, headers, ticket, bootstrap, Authorization/Bearer value or arbitrary exception text. The top launcher reconstructs only the strict envelope and receipt fields.
- Send the exact closed JSON output schema in the provider request prompt and bind that schema into the model input digest. Continue to use official `json_object`; do not invent unsupported server-side schema enforcement.
- Exercise the first `FREEZE_EVIDENCE` domain Task through fixture transports for every HTTP/provider/model/semantic outcome and one success. The tests must prove the failure snapshot is persisted, the exact outcome survives child-process transport, and forbidden markers never appear.
- Retain no Mock fallback, zero ActionGrant/Connector/external action, exact cleanup, fixed AgentTeams internals, canonical-status ownership and the Coordinator-only real Canary.

## Binary acceptance additions

1. Every non-2xx provider/model/semantic result produces exactly one allowlisted `providerOutcomeCode` bound to the failed Task and final clean Head.
2. A missing, contradictory, extra-field or non-allowlisted Mission/snapshot outcome fails closed as `LIVE_PROVIDER_BROKER_FAILED`; arbitrary text never crosses a child boundary.
3. Fixture coverage includes HTTP 401/402/404/429/500/502/503/504, timeout/unavailable, response identity, returned model, finish reason, usage, provider response, JSON, schema, semantic, broker and success outcomes.
4. The provider request contains the exact role output schema and the snapshot input digest changes if that schema changes.
5. The actual first domain Task fixture succeeds only with `{frozen: true, assessment: <non-empty string>}` and rejects a merely valid but wrong JSON object as `MODEL_SCHEMA_INVALID`.
6. All public evidence remains redacted, ActionGrant/Connector/external action remain zero, and `LIVE_PROVIDER_VERIFIED` remains false until a new Coordinator Canary succeeds.

## Out of scope

Owner Secret access, raw provider response preservation, general prompt tuning, AgentTeams Manager/Worker/Matrix changes, Docker socket exposure, an always-on supervisor, external platform actions, M3, Push/PR/Deploy and canonical status edits remain prohibited.
