# SDD-002 implementation plan

- Extend the accepted Runtime Adapter with Project/DAG/Task/ACK/Submit/recovery operations and immutable runtime identity evidence.
- Add Mission/Task/Run/SkillLock/Trace/Ledger/Audit persistence and APIs under the same organization/Campaign scope.
- Author five locked domain Skills plus orchestration behavior; compile six separate RoleContext views and permissions.
- Add DeepSeek gateway with exact schema/model/config/cost/error snapshots and no secret logging.
- Import four returned immutable revisions, run independent audit, expose revision compare/Owner review, and invalidate audit after edits.
- Add content-addressed media boundary and optional provider mock/Canary without auto-approval.
- Inject one frozen fault and prove audit denial/no action through machine evidence and Web.
- Verify timeout/restart/duplicate/digest mismatch/recovery, then build public-safe report/UAT/handoff.

Rollback uses local Git reverts and project-scoped test migrations. Cancellation and retry preserve append-only history. No external compensation exists because M2 has no external action.

