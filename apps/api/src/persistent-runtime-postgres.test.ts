import { LocalContentAddressedBlobStore } from "@lumiclaw/blob-store";
import {
  PostgresGoalPlanRepository,
  PostgresKnowledgeRepository,
  PostgresLocalPresenceRepository,
  PostgresModelGatewayTicketRepository,
  PostgresPersistentRuntimeRepository,
} from "@lumiclaw/db";
import {
  AGENTTEAMS_SOURCE_TAR_SHA256,
  contentPlanCanonicalPayload,
  missionRunEtag,
  runtimeGatewayInputProjection,
  runtimeGatewayPhase,
  runtimeGatewayPolicy,
  runtimeGatewayRequestDigest,
  runtimeLeaseTokenDigest,
  sha256Digest,
  stableContractId,
  type MissionIntentBundle,
  type ModelGatewayTicketClaims,
  type PlannerSubmission,
  type ProducerRoleId,
  type RuntimeBinding,
  type RuntimeLease,
  type RuntimeSubmissionEnvelope,
} from "@lumiclaw/domain";
import {
  CONTENT_PLAN_SCHEMA_DIGEST,
  CONTENT_PLAN_SCHEMA_ID,
  importPlannerSubmissionV2,
} from "@lumiclaw/mission-compiler";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { buildApi } from "./server.js";

const connectionString = process.env.SDD007_POSTGRES_URL;
const suite = connectionString === undefined ? describe.skip : describe;
const blobRoot =
  process.env.SDD007_BLOB_ROOT ?? "/tmp/lumiclaw-sdd007-postgres-blobs";
const persona = {
  displayName: "A梦公开安全测试",
  role: "Founder",
  voice: "Evidence first",
  viewpoints: ["Governed missions should be inspectable"],
  expressionBoundaries: ["No outcome guarantees"],
  firstPersonRelationship: "First person for founder experience only",
  expressionExamples: ["I will show the source."],
};
const organization = {
  name: "Public Safe Runtime Studio",
  brandName: "LumiClaw fixture",
  description: "Synthetic engineering fixture.",
  audiences: ["AI builders"],
  facts: ["Release status is engineering candidate"],
  approvedClaims: [
    {
      statement: "Persistent runtime is under engineering verification",
      evidence: "Public repository tests",
    },
  ],
};
const product = {
  name: "Presence fixture",
  description: "Governed public presence mission fixture.",
  valueProposition: "Make runtime boundaries visible.",
  audiences: ["Product teams"],
  facts: ["No external action"],
  approvedClaims: [
    {
      statement: "The fixture performs no external action",
      evidence: "TaskContract externalActionAllowed false",
    },
  ],
};
const account = (platformCode: "X" | "XIAOHONGSHU") => ({
  platformCode,
  accountExists: false,
  handleOrDisplayName:
    platformCode === "X" ? "@public_safe_runtime" : "公开安全运行时手记",
  producerMandates: ["FOUNDER_VOICE", "PRODUCT_EXPERTISE"] as const,
  rolePersona: "Founder and product build notes",
  audience: ["AI builders"],
  targetMarket: platformCode === "X" ? "US" : "CN",
  contentLocale: platformCode === "X" ? "en-US" : "zh-CN",
  contentPillars: ["Build notes"],
  expressionExamples: ["Show the source."],
  dos: ["Be exact"],
  donts: ["No outcome promise"],
  ctaPolicy: "Invite review",
  cadenceHint: "Daily fixture slot",
});

suite("SDD-007 fresh PostgreSQL persistent runtime authority", () => {
  it("fences lineage, leases, tickets, staged recovery, duplicates and restart replay", async () => {
    const authority = await createAuthorityBundles(connectionString!);
    const runtimeA = new PostgresPersistentRuntimeRepository(connectionString!);
    const runtimeB = new PostgresPersistentRuntimeRepository(connectionString!);
    const pool = new Pool({ connectionString: connectionString! });
    const t0 = new Date();
    try {
      const concurrent = await Promise.all([
        runtimeA.createRun(
          authority.ownerId,
          authority.first,
          "terminal-owner",
          "create-run-concurrent-0001",
          t0,
        ),
        runtimeB.createRun(
          authority.ownerId,
          authority.first,
          "terminal-owner",
          "create-run-concurrent-0001",
          t0,
        ),
      ]);
      expect(concurrent.filter((result) => !result.replayed)).toHaveLength(1);
      expect(concurrent.filter((result) => result.replayed)).toHaveLength(1);
      const run = concurrent[0]!.run;
      await runtimeB.close();
      const runtimeRestarted = new PostgresPersistentRuntimeRepository(
        connectionString!,
      );
      const replay = await runtimeRestarted.createRun(
        authority.ownerId,
        authority.first,
        "terminal-owner",
        "create-run-concurrent-0001",
        new Date(t0.getTime() + 1),
      );
      expect(replay.replayed).toBe(true);
      expect(replay.run).toEqual(
        concurrent.find((item) => !item.replayed)!.run,
      );

      const [winner, loser] = await Promise.all([
        runtimeA.acquireJob("worker-alpha", 60_000, t0),
        runtimeRestarted.acquireJob("worker-beta", 60_000, t0),
      ]);
      const lease = winner ?? loser;
      expect(lease).toBeDefined();
      expect([winner, loser].filter(Boolean)).toHaveLength(1);
      if (lease === undefined) throw new Error("LEASE_REQUIRED");
      await runtimeA.heartbeatLease(lease.job.leaseOwner!,lease.job.id,lease.attempt.id,lease.leaseToken,60_000,new Date(t0.getTime()+59_000));
      expect(await runtimeRestarted.acquireJob('worker-stale-contender',60_000,new Date(t0.getTime()+61_000))).toBeUndefined();
      const binding = runtimeBinding(lease, authority.first);
      const actor = binding.memberBindings.find(
        (item) => item.roleId === lease.job.roleId,
      )!.runtimeActorId;
      await runtimeA.bindRuntime(
        lease.job.leaseOwner!,
        lease.job.id,
        lease.attempt.id,
        lease.leaseToken,
        binding,
        lease.job.taskContractId,
        new Date(t0.getTime() + 61_010),
      );
      await expect(
        runtimeA.recordAck(
          lease.job.leaseOwner!,
          lease.job.id,
          lease.attempt.id,
          lease.leaseToken,
          lease.job.taskContractId,
          "@wrong-actor:matrix.local",
          new Date(t0.getTime() + 61_020),
        ),
      ).rejects.toMatchObject({ code: "SUBMISSION_INPUT_MISMATCH" });
      await runtimeA.recordAck(
        lease.job.leaseOwner!,
        lease.job.id,
        lease.attempt.id,
        lease.leaseToken,
        lease.job.taskContractId,
        actor,
        new Date(t0.getTime() + 61_020),
      );

      const ticketRepository = new PostgresModelGatewayTicketRepository(
        connectionString!,
      );
      const pair = ticketClaims(
        lease,
        authority.first,
        actor,
        new Date(t0.getTime() + 90_000),
      );
      const claimsA = { ...pair.claims, nonce: "a".repeat(43) };
      const claimsB = { ...pair.claims, nonce: "b".repeat(43) };
      const issued = await Promise.allSettled([
        ticketRepository.issue(
          claimsA,
          sha256Digest(claimsA.nonce),
          new Date(t0.getTime() + 61_030),
        ),
        ticketRepository.issue(
          claimsB,
          sha256Digest(claimsB.nonce),
          new Date(t0.getTime() + 61_030),
        ),
      ]);
      expect(issued.filter((item) => item.status === "fulfilled")).toHaveLength(
        1,
      );
      expect(issued.filter((item) => item.status === "rejected")).toHaveLength(
        1,
      );
      const active = issued[0]!.status === "fulfilled" ? claimsA : claimsB;
      const ticketDigest = sha256Digest(active.nonce);
      const consumed = await Promise.all([
        ticketRepository.consume(
          active,
          ticketDigest,
          new Date(t0.getTime() + 61_040),
        ),
        ticketRepository.consume(
          active,
          ticketDigest,
          new Date(t0.getTime() + 61_040),
        ),
      ]);
      expect(consumed.sort()).toEqual(["REPLAYED", "USED"]);

      const payload = {
        schemaVersion: 1,
        taskId: lease.job.taskContractId,
        inputDigest: lease.job.contract.inputDigest,
        agentTeamsExecuted: true,
        completed: true,
      };
      const envelope = envelopeFor(
        lease,
        authority.first,
        actor,
        payload,
        new Date(t0.getTime() + 61_200),
      );
      await runtimeA.recordSubmissionIntent(
        lease.job.leaseOwner!,lease.job.id,lease.attempt.id,lease.leaseToken,envelope,
        new Date(t0.getTime() + 61_100),
      );
      const submissionRecoveryAt = new Date(t0.getTime() + 120_000);
      const [ordinaryBeforeStage, submissionRecoveryA, submissionRecoveryB] = await Promise.all([
        runtimeA.acquireJob("worker-ordinary", 60_000, submissionRecoveryAt),
        runtimeA.acquireSubmissionRecovery("worker-submit-recovery-a", 60_000, submissionRecoveryAt),
        runtimeRestarted.acquireSubmissionRecovery("worker-submit-recovery-b", 60_000, submissionRecoveryAt),
      ]);
      expect(ordinaryBeforeStage).toBeUndefined();
      const submissionRecovery = submissionRecoveryA ?? submissionRecoveryB;
      expect([submissionRecoveryA,submissionRecoveryB].filter(Boolean)).toHaveLength(1);
      expect(submissionRecovery?.envelope).toEqual(envelope);
      if(submissionRecovery===undefined)throw new Error('SUBMISSION_RECOVERY_REQUIRED');
      await expect(runtimeA.heartbeatLease(lease.job.leaseOwner!,lease.job.id,lease.attempt.id,lease.leaseToken,60_000,new Date(submissionRecoveryAt.getTime()+1))).rejects.toMatchObject({code:'JOB_LEASE_LOST'});
      const batch = await runtimeA.stageMaterialization(
        submissionRecovery.lease.job.leaseOwner!,
        submissionRecovery.lease.job.id,
        submissionRecovery.lease.attempt.id,
        submissionRecovery.lease.leaseToken,
        envelope,
        `urn:lumiclaw:protocol:${envelope.outputDigest}`,
        [
          {
            kind: "PROTOCOL",
            authorityId: lease.job.taskContractId,
            canonicalDigest: envelope.outputDigest,
            payload,
          },
        ],
        new Date(submissionRecoveryAt.getTime() + 10),
      );
      const recoveryAt = new Date(submissionRecoveryAt.getTime() + 61_000);
      const [ordinary, recovery] = await Promise.all([
        runtimeA.acquireJob("worker-ordinary", 60_000, recoveryAt),
        runtimeRestarted.acquireStagedMaterialization(
          "worker-recovery",
          60_000,
          recoveryAt,
        ),
      ]);
      expect(ordinary).toBeUndefined();
      expect(recovery?.batch.id).toBe(batch.id);
      if (recovery === undefined) throw new Error("STAGED_RECOVERY_REQUIRED");
      const finalized = await runtimeRestarted.finalizeMaterialization(
        "worker-recovery",
        recovery.lease.job.id,
        recovery.lease.attempt.id,
        recovery.lease.leaseToken,
        recovery.batch.id,
        new Date(recoveryAt.getTime() + 10),
      );
      expect(finalized).toMatchObject({ accepted: true, duplicate: false });
      const [completionA,completionB]=await Promise.all([
        runtimeA.acquirePendingCompletion('worker-completion-a',60_000,new Date(recoveryAt.getTime()+20)),
        runtimeRestarted.acquirePendingCompletion('worker-completion-b',60_000,new Date(recoveryAt.getTime()+20)),
      ]);
      const completion=completionA??completionB;
      expect([completionA,completionB].filter(Boolean)).toHaveLength(1);
      expect(completion?.batch.id).toBe(batch.id);
      if(completion===undefined)throw new Error('COMPLETION_OUTBOX_REQUIRED');
      await runtimeA.confirmRuntimeCompletion(completion.lease.job.leaseOwner!,completion.lease.job.id,completion.lease.attempt.id,completion.lease.leaseToken,completion.batch.id,new Date(recoveryAt.getTime()+30));
      expect(await runtimeRestarted.acquirePendingCompletion('worker-completion-replay',60_000,new Date(recoveryAt.getTime()+31))).toBeUndefined();
      const acceptedEventsBefore = Number(
        (
          await pool.query<{ count: string }>(
            "select count(*)::text count from runtime_events_v1 where run_id=$1 and type='TASK_OUTPUT_ACCEPTED'",
            [run.id],
          )
        ).rows[0]!.count,
      );
      const duplicate = await runtimeRestarted.finalizeMaterialization(
        "worker-recovery",
        recovery.lease.job.id,
        recovery.lease.attempt.id,
        recovery.lease.leaseToken,
        recovery.batch.id,
        new Date(recoveryAt.getTime() + 20),
      );
      expect(duplicate).toMatchObject({ accepted: false, duplicate: true });
      const acceptedEventsAfter = Number(
        (
          await pool.query<{ count: string }>(
            "select count(*)::text count from runtime_events_v1 where run_id=$1 and type='TASK_OUTPUT_ACCEPTED'",
            [run.id],
          )
        ).rows[0]!.count,
      );
      expect(acceptedEventsAfter).toBe(acceptedEventsBefore);

      const claimAt = new Date(recoveryAt.getTime() + 40);
      const claim = await runtimeA.acquireJob("worker-claim", 60_000, claimAt);
      expect(claim?.job.kind).toBe("FREEZE_CLAIMS");
      if (claim === undefined) throw new Error("CLAIM_LEASE_REQUIRED");
      const claimActor = actorFor(claim, authority.first);
      await dispatchAndAck(
        runtimeA,
        claim,
        authority.first,
        claimActor,
        claimAt,
      );
      const claimPayload = {
        schemaVersion: 1,
        taskId: claim.job.taskContractId,
        inputDigest: claim.job.contract.inputDigest,
        agentTeamsExecuted: true,
        frozenBindingDigest: sha256Digest(authority.first.inputBindings),
      };
      const claimEnvelope = envelopeFor(
        claim,
        authority.first,
        claimActor,
        claimPayload,
        new Date(claimAt.getTime() + 20),
      );
      const claimBatch = await runtimeA.stageMaterialization(
        "worker-claim",
        claim.job.id,
        claim.attempt.id,
        claim.leaseToken,
        claimEnvelope,
        `urn:lumiclaw:claim-freeze:${claim.job.taskContractId}:${claimEnvelope.outputDigest}`,
        [
          {
            kind: "PROTOCOL",
            authorityId: claim.job.taskContractId,
            canonicalDigest: claimEnvelope.outputDigest,
            payload: claimPayload,
          },
        ],
        new Date(claimAt.getTime() + 20),
      );
      expect(
        await runtimeA.finalizeMaterialization(
          "worker-claim",
          claim.job.id,
          claim.attempt.id,
          claim.leaseToken,
          claimBatch.id,
          new Date(claimAt.getTime() + 30),
        ),
      ).toMatchObject({ accepted: true, duplicate: false });

      const planAt = new Date(claimAt.getTime() + 40);
      const planLease = await runtimeA.acquireJob(
        "worker-plan",
        60_000,
        planAt,
      );
      expect(planLease?.job.kind).toBe("PLAN_CONTENT");
      if (planLease === undefined) throw new Error("PLAN_LEASE_REQUIRED");
      const planActor = actorFor(planLease, authority.first);
      await dispatchAndAck(
        runtimeA,
        planLease,
        authority.first,
        planActor,
        planAt,
      );
      const planSubmission = plannerSubmission(authority.first);
      const planCandidate = importPlannerSubmissionV2(
        authority.first,
        planSubmission,
        new Date(planAt.getTime() + 20).toISOString(),
      );
      const { canonicalDigest: firstPlanDigest, ...secondPlanBase } = {
        ...structuredClone(planCandidate),
        planId: stableContractId("runtime-second-plan", {
          firstPlanId: planCandidate.planId,
        }),
      };
      expect(firstPlanDigest).toBe(planCandidate.canonicalDigest);
      const secondPlanCandidate = {
        ...secondPlanBase,
        canonicalDigest: sha256Digest(
          contentPlanCanonicalPayload(secondPlanBase),
        ),
      };
      const planEnvelope = envelopeFor(
        planLease,
        authority.first,
        planActor,
        planSubmission,
        new Date(planAt.getTime() + 20),
      );
      const planBatch = await runtimeA.stageMaterialization(
        "worker-plan",
        planLease.job.id,
        planLease.attempt.id,
        planLease.leaseToken,
        planEnvelope,
        `urn:lumiclaw:content-plan:${planCandidate.planId}:${planCandidate.canonicalDigest}`,
        [
          {
            kind: "CONTENT_PLAN",
            authorityId: planCandidate.planId,
            canonicalDigest: planCandidate.canonicalDigest,
            expectedHeadDigest: null,
            payload: planCandidate,
          },
          {
            kind: "CONTENT_PLAN",
            authorityId: secondPlanCandidate.planId,
            canonicalDigest: secondPlanCandidate.canonicalDigest,
            expectedHeadDigest: null,
            payload: secondPlanCandidate,
          },
        ],
        new Date(planAt.getTime() + 20),
      );
      expect(
        await authorityCount(
          pool,
          "content_plan_revisions_v2",
          "plan_id",
          planCandidate.planId,
        ),
      ).toBe(0);
      expect(
        await authorityCount(
          pool,
          "content_plan_heads_v2",
          "plan_id",
          planCandidate.planId,
        ),
      ).toBe(0);
      expect(
        Number(
          (
            await pool.query<{ count: string }>(
              "select count(*)::text count from goal_plan_idempotency_records_v2 where owner_profile_id=$1 and route='RUNTIME_PLAN_APPEND'",
              [authority.ownerId],
            )
          ).rows[0]!.count,
        ),
      ).toBe(0);
      expect(
        (
          await pool.query<{ state: string }>(
            "select state from runtime_materialization_batches_v1 where id=$1",
            [planBatch.id],
          )
        ).rows[0]?.state,
      ).toBe("STAGED");
      expect(
        (
          await pool.query<{ job_state: string; attempt_state: string }>(
            `select j.state job_state,a.state attempt_state from mission_jobs_v1 j join agent_task_attempts_v1 a on a.id=$2 where j.id=$1`,
            [planLease.job.id, planLease.attempt.id],
          )
        ).rows[0],
      ).toEqual({ job_state: "SUBMITTED", attempt_state: "SUBMITTED" });
      const planRecoveryAt = new Date(planAt.getTime() + 61_000);
      const [ordinaryPlanRecovery, recoveredPlanA, recoveredPlanB] =
        await Promise.all([
          runtimeA.acquireJob("worker-no-model-rerun", 60_000, planRecoveryAt),
          runtimeRestarted.acquireStagedMaterialization(
            "worker-plan-recovery-a",
            60_000,
            planRecoveryAt,
          ),
          runtimeA.acquireStagedMaterialization(
            "worker-plan-recovery-b",
            60_000,
            planRecoveryAt,
          ),
        ]);
      expect(ordinaryPlanRecovery).toBeUndefined();
      const recoveredPlans = [recoveredPlanA, recoveredPlanB].filter(
        (item): item is NonNullable<typeof item> => item !== undefined,
      );
      expect(recoveredPlans).toHaveLength(1);
      const recoveredPlan = recoveredPlans[0]!;
      expect(recoveredPlan.batch.id).toBe(planBatch.id);
      expect(recoveredPlan.lease.attempt.id).toBe(planLease.attempt.id);
      expect(recoveredPlan.lease.attempt.attemptNumber).toBe(1);
      const finalizeAt = new Date(planRecoveryAt.getTime() + 10);
      await pool.query("create table sdd007_fault_barrier(call_count integer not null)");
      await pool.query("insert into sdd007_fault_barrier values(0)");
      await pool.query(
        `create function sdd007_fail_second_plan() returns trigger language plpgsql as $$ declare next_count integer; begin
          update sdd007_fault_barrier set call_count=call_count+1 returning call_count into next_count;
          if next_count=2 then raise exception 'SDD007_FAULT_AFTER_FIRST_OF_N'; end if;
          return new;
        end $$`,
      );
      await pool.query(
        "create trigger sdd007_fail_second_plan before insert on content_plan_revisions_v2 for each row execute function sdd007_fail_second_plan()",
      );
      await expect(
        runtimeA.finalizeMaterialization(
          recoveredPlan.lease.job.leaseOwner!,
          recoveredPlan.lease.job.id,
          recoveredPlan.lease.attempt.id,
          recoveredPlan.lease.leaseToken,
          recoveredPlan.batch.id,
          finalizeAt,
        ),
      ).rejects.toThrow("SDD007_FAULT_AFTER_FIRST_OF_N");
      expect(
        await authorityCount(
          pool,
          "content_plan_revisions_v2",
          "plan_id",
          planCandidate.planId,
        ),
      ).toBe(0);
      expect(
        await authorityCount(
          pool,
          "content_plan_revisions_v2",
          "plan_id",
          secondPlanCandidate.planId,
        ),
      ).toBe(0);
      expect(
        (
          await pool.query<{ state: string }>(
            "select state from runtime_materialization_batches_v1 where id=$1",
            [planBatch.id],
          )
        ).rows[0]?.state,
      ).toBe("STAGED");
      await pool.query(
        "drop trigger sdd007_fail_second_plan on content_plan_revisions_v2",
      );
      await pool.query("drop function sdd007_fail_second_plan() ");
      await pool.query("drop table sdd007_fault_barrier");
      const finalizedPlans = await Promise.all([
        runtimeA.finalizeMaterialization(
          recoveredPlan.lease.job.leaseOwner!,
          recoveredPlan.lease.job.id,
          recoveredPlan.lease.attempt.id,
          recoveredPlan.lease.leaseToken,
          recoveredPlan.batch.id,
          finalizeAt,
        ),
        runtimeRestarted.finalizeMaterialization(
          recoveredPlan.lease.job.leaseOwner!,
          recoveredPlan.lease.job.id,
          recoveredPlan.lease.attempt.id,
          recoveredPlan.lease.leaseToken,
          recoveredPlan.batch.id,
          new Date(finalizeAt.getTime() + 1),
        ),
      ]);
      expect(
        finalizedPlans.filter((item) => item.accepted && !item.duplicate),
      ).toHaveLength(1);
      expect(
        finalizedPlans.filter((item) => !item.accepted && item.duplicate),
      ).toHaveLength(1);
      expect(
        await authorityCount(
          pool,
          "content_plan_revisions_v2",
          "plan_id",
          planCandidate.planId,
        ),
      ).toBe(1);
      expect(
        await authorityCount(
          pool,
          "content_plan_heads_v2",
          "plan_id",
          planCandidate.planId,
        ),
      ).toBe(1);
      expect(
        await authorityCount(
          pool,
          "content_plan_revisions_v2",
          "plan_id",
          secondPlanCandidate.planId,
        ),
      ).toBe(1);
      expect(
        await authorityCount(
          pool,
          "content_plan_heads_v2",
          "plan_id",
          secondPlanCandidate.planId,
        ),
      ).toBe(1);
      expect(
        Number(
          (
            await pool.query<{ count: string }>(
              "select count(*)::text count from goal_plan_idempotency_records_v2 where owner_profile_id=$1 and route='RUNTIME_PLAN_APPEND'",
              [authority.ownerId],
            )
          ).rows[0]!.count,
        ),
      ).toBe(2);
      expect(
        (
          await pool.query<{ state: string }>(
            "select state from runtime_materialization_batches_v1 where id=$1",
            [planBatch.id],
          )
        ).rows[0]?.state,
      ).toBe("COMMITTED");
      expect(
        (
          await pool.query<{
            job_state: string;
            attempt_state: string;
            attempt_count: number;
            output_digest: string;
          }>(
            `select j.state job_state,a.state attempt_state,j.attempt_count,a.output_digest from mission_jobs_v1 j join agent_task_attempts_v1 a on a.id=$2 where j.id=$1`,
            [planLease.job.id, planLease.attempt.id],
          )
        ).rows[0],
      ).toEqual({
        job_state: "ACCEPTED",
        attempt_state: "ACCEPTED",
        attempt_count: 1,
        output_digest: planEnvelope.outputDigest,
      });
      expect(
        Number(
          (
            await pool.query<{ count: string }>(
              "select count(*)::text count from runtime_events_v1 where run_id=$1 and job_id=$2 and type='TASK_OUTPUT_ACCEPTED'",
              [run.id, planLease.job.id],
            )
          ).rows[0]!.count,
        ),
      ).toBe(1);

      const second = await runtimeA.createRun(
        authority.ownerId,
        authority.second,
        "terminal-owner",
        "create-run-second-0001",
        new Date(t0.getTime() + 1),
      );
      const stale = await runtimeA.acquireJob(
        "worker-stale",
        1_000,
        new Date(t0.getTime() + 700),
      );
      expect(stale?.run.id).toBe(second.run.id);
      if (stale === undefined) throw new Error("STALE_LEASE_REQUIRED");
      const staleBinding = runtimeBinding(stale, authority.second);
      const staleActor = staleBinding.memberBindings.find(
        (item) => item.roleId === stale.job.roleId,
      )!.runtimeActorId;
      await runtimeA.bindRuntime(
        "worker-stale",
        stale.job.id,
        stale.attempt.id,
        stale.leaseToken,
        staleBinding,
        stale.job.taskContractId,
        new Date(t0.getTime() + 710),
      );
      await runtimeA.recordAck(
        "worker-stale",
        stale.job.id,
        stale.attempt.id,
        stale.leaseToken,
        stale.job.taskContractId,
        staleActor,
        new Date(t0.getTime() + 720),
      );
      const stalePair = ticketClaims(
        stale,
        authority.second,
        staleActor,
        new Date(t0.getTime() + 1_600),
      );
      const staleClaims = { ...stalePair.claims, nonce: "c".repeat(43) };
      const staleDigest = sha256Digest(staleClaims.nonce);
      await ticketRepository.issue(
        staleClaims,
        staleDigest,
        new Date(t0.getTime() + 730),
      );
      const replacementDigest = runtimeLeaseTokenDigest(
        "replacement-lease-token",
      );
      await pool.query(
        "with replaced as (update mission_jobs_v1 set lease_owner='worker-reclaimer',lease_token_hash=$2 where id=$1 returning id) update agent_task_attempts_v1 set lease_token_hash=$2 where id=$3 and exists(select 1 from replaced)",
        [stale.job.id, replacementDigest, stale.attempt.id],
      );
      expect(
        await ticketRepository.consume(
          staleClaims,
          staleDigest,
          new Date(t0.getTime() + 800),
        ),
      ).toBe("REJECTED");
      expect(
        await runtimeRestarted.acquireJob(
          "worker-reclaimer",
          60_000,
          new Date(t0.getTime() + 2_000),
        ),
      ).toBeUndefined();
      expect(
        await ticketRepository.consume(
          staleClaims,
          staleDigest,
          new Date(t0.getTime() + 2_010),
        ),
      ).toBe("EXPIRED");

      let apiClock = t0.getTime() + 130_000;
      const apiRuntime = new PostgresPersistentRuntimeRepository(
        connectionString!,
      );
      const runtimeApi = buildApi({
        localPresenceRepository: new PostgresLocalPresenceRepository(
          connectionString!,
          new LocalContentAddressedBlobStore(blobRoot),
        ),
        goalPlanRepository: new PostgresGoalPlanRepository(connectionString!),
        persistentRuntimeRepository: apiRuntime,
        now: () => new Date(apiClock),
      });
      try {
        const createCancel = await runtimeApi.inject({
          method: "POST",
          url: "/api/v1/mission-runs",
          headers: { "idempotency-key": "api-cancel-run-create-0001" },
          payload: {
            bundleId: authority.third.bundleId,
            bundleDigest: authority.third.canonicalDigest,
          },
        });
        expect(createCancel.statusCode, createCancel.body).toBe(201);
        const cancelRunId = createCancel.json().run.id as string;
        const cancelEtag = createCancel.headers.etag!;
        expect(
          (
            await runtimeApi.inject({
              method: "POST",
              url: `/api/v1/mission-runs/${cancelRunId}/cancel`,
              headers: { "idempotency-key": "api-cancel-missing-etag-0001" },
            })
          ).statusCode,
        ).toBe(428);
        const cancel = () =>
          runtimeApi.inject({
            method: "POST",
            url: `/api/v1/mission-runs/${cancelRunId}/cancel`,
            headers: {
              "idempotency-key": "api-cancel-concurrent-0001",
              "if-match": cancelEtag,
            },
          });
        const cancelResults = await Promise.all([cancel(), cancel()]);
        expect(cancelResults.map((item) => item.statusCode)).toEqual([
          200, 200,
        ]);
        expect(
          cancelResults
            .map((item) => item.headers["idempotency-replayed"])
            .sort(),
        ).toEqual(["false", "true"]);
        expect(cancelResults[0]!.json().run.state).toBe("CANCELLED");
        expect(
          (
            await runtimeApi.inject({
              method: "POST",
              url: `/api/v1/mission-runs/${cancelRunId}/cancel`,
              headers: {
                "idempotency-key": "api-cancel-stale-etag-0001",
                "if-match": cancelEtag,
              },
            })
          ).statusCode,
        ).toBe(412);

        apiClock += 1_000;
        const createRetry = await runtimeApi.inject({
          method: "POST",
          url: "/api/v1/mission-runs",
          headers: { "idempotency-key": "api-retry-run-create-0001" },
          payload: {
            bundleId: authority.fourth.bundleId,
            bundleDigest: authority.fourth.canonicalDigest,
          },
        });
        expect(createRetry.statusCode, createRetry.body).toBe(201);
        const retryRunId = createRetry.json().run.id as string;
        const retryLease = await apiRuntime.acquireJob(
          "worker-api-retry",
          60_000,
          new Date(apiClock + 10),
        );
        expect(retryLease?.run.id).toBe(retryRunId);
        if (retryLease === undefined)
          throw new Error("API_RETRY_LEASE_REQUIRED");
        const retryActor = actorFor(retryLease, authority.fourth);
        await dispatchAndAck(
          apiRuntime,
          retryLease,
          authority.fourth,
          retryActor,
          new Date(apiClock + 20),
        );
        const retryPayload = {
          schemaVersion: 1,
          taskId: retryLease.job.taskContractId,
          inputDigest: retryLease.job.contract.inputDigest,
          agentTeamsExecuted: true,
          completed: true,
        };
        await apiRuntime.quarantineSubmission(
          "worker-api-retry",
          retryLease.job.id,
          retryLease.attempt.id,
          retryLease.leaseToken,
          envelopeFor(
            retryLease,
            authority.fourth,
            retryActor,
            retryPayload,
            new Date(apiClock + 45),
          ),
          "SUBMISSION_SCHEMA_INVALID",
          new Date(apiClock + 45),
        );
        apiClock += 100;
        const blocked = await runtimeApi.inject({
          method: "GET",
          url: `/api/v1/mission-runs/${retryRunId}`,
        });
        expect(blocked.statusCode, blocked.body).toBe(200);
        expect(blocked.json().run.state).toBe("BLOCKED");
        const blockedEtag = blocked.headers.etag!;
        const retry = () =>
          runtimeApi.inject({
            method: "POST",
            url: `/api/v1/mission-runs/${retryRunId}/retry-blocked`,
            headers: {
              "idempotency-key": "api-retry-concurrent-0001",
              "if-match": blockedEtag,
            },
          });
        const retryResults = await Promise.all([retry(), retry()]);
        expect(retryResults.map((item) => item.statusCode)).toEqual([200, 200]);
        expect(
          retryResults
            .map((item) => item.headers["idempotency-replayed"])
            .sort(),
        ).toEqual(["false", "true"]);
        expect(retryResults[0]!.json().run.state).toBe("QUEUED");
        expect(
          (
            await runtimeApi.inject({
              method: "POST",
              url: `/api/v1/mission-runs/${retryRunId}/retry-blocked`,
              headers: {
                "idempotency-key": "api-retry-stale-etag-0001",
                "if-match": blockedEtag,
              },
            })
          ).statusCode,
        ).toBe(412);
        expect(
          Number(
            (
              await pool.query<{ count: string }>(
                "select count(*)::text count from runtime_idempotency_v1 where owner_profile_id=$1 and route in ('MISSION_RUN_CANCEL','MISSION_RUN_RETRY_BLOCKED')",
                [authority.ownerId],
              )
            ).rows[0]!.count,
          ),
        ).toBe(2);
      } finally {
        await runtimeApi.close();
      }

      await expectPgCode(
        pool.query(
          "insert into runtime_events_v1(id,owner_profile_id,run_id,job_id,attempt_id,type,public_payload,occurred_at) values('cross-lineage-event',$1,$2,$3,$4,'ADVERSARIAL','{}',now())",
          [authority.ownerId, run.id, lease.job.id, stale.attempt.id],
        ),
        "23503",
      );
      await expectPgCode(
        pool.query(
          `insert into agent_task_attempts_v1(
            id,owner_profile_id,run_id,job_id,attempt_number,role_id,input_digest,
            skill_lock_digest,schema_ref,lease_token_hash,state,created_at,updated_at
          ) values('cross-lineage-attempt',$1,$2,$3,99,$4,$5,$6,$7,$8,'LEASED',now(),now())`,
          [
            authority.ownerId,
            run.id,
            stale.job.id,
            stale.job.roleId,
            stale.job.contract.inputDigest,
            stale.job.contract.skillLockDigest,
            stale.job.contract.outputSchema,
            "e".repeat(64),
          ],
        ),
        "23503",
      );
      await expectPgCode(
        pool.query(
          `insert into model_gateway_ticket_uses_v1(
            ticket_digest,owner_profile_id,run_id,job_id,task_id,attempt_id,
            runtime_actor_id,outcome,occurred_at,public_claims
          ) values($1,$2,$3,$4,$5,$6,$7,'REJECTED',now(),'{}')`,
          [
            ticketDigest,
            authority.ownerId,
            second.run.id,
            stale.job.id,
            stale.job.taskContractId,
            stale.attempt.id,
            staleActor,
          ],
        ),
        "23503",
      );
      await expectPgCode(
        pool.query(
          "update mission_jobs_v1 set accepted_attempt_id=$2,accepted_output_ref='forbidden',accepted_output_digest=$3 where id=$1",
          [second.jobs[1]!.id, stale.attempt.id, "f".repeat(64)],
        ),
        "23514",
      );
      await expect(
        pool.query(
          "update runtime_events_v1 set type='MUTATED' where run_id=$1",
          [run.id],
        ),
      ).rejects.toMatchObject({ code: "P0001" });
      await expect(
        pool.query(
          "update runtime_bindings_v1 set team_profile_digest=$2 where run_id=$1",
          [second.run.id, "f".repeat(64)],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      expect(
        (await runtimeRestarted.getRun(authority.ownerId, run.id))?.state,
      ).toBe("HUMAN_GATE");
      expect(
        missionRunEtag(
          (await runtimeRestarted.getRun(authority.ownerId, run.id))!,
        ),
      ).toMatch(/^"runtime-run-.+-v[1-9][0-9]*"$/u);
      await ticketRepository.close();
      await runtimeRestarted.close();
    } finally {
      await runtimeA.close().catch(() => undefined);
      await runtimeB.close().catch(() => undefined);
      await pool.end();
    }
  }, 120_000);
});

async function createAuthorityBundles(url: string) {
  const local = new PostgresLocalPresenceRepository(
    url,
    new LocalContentAddressedBlobStore(blobRoot),
  );
  const knowledge = new PostgresKnowledgeRepository(
    url,
    new LocalContentAddressedBlobStore(blobRoot),
  );
  const goals = new PostgresGoalPlanRepository(url);
  const app = buildApi({
    localPresenceRepository: local,
    knowledgeRepository: knowledge,
    goalPlanRepository: goals,
    now: () => new Date("2026-08-22T10:00:00.000Z"),
  });
  try {
    const ownerResult = await app.inject({
      method: "POST",
      url: "/api/v1/local-owner-profile",
      payload: { displayName: "A梦公开安全测试" },
    });
    expect(ownerResult.statusCode, ownerResult.body).toBe(201);
    const ownerId = ownerResult.json().profile.id as string;
    let overview = (
      await app.inject({ method: "GET", url: "/api/v1/onboarding/session" })
    ).json().overview;
    const mutate = async (
      method: "PUT" | "POST",
      urlPath: string,
      payload: Record<string, unknown>,
      key: string,
    ) => {
      const response = await app.inject({
        method,
        url: urlPath,
        headers: {
          "if-match": `"knowledge-${overview.session.rowVersion}"`,
          "idempotency-key": key,
        },
        payload,
      });
      expect(response.statusCode, response.body).toBeLessThan(300);
      overview = response.json().overview;
      return response;
    };
    await mutate(
      "PUT",
      "/api/v1/profiles/persona",
      persona,
      "runtime-persona-0001",
    );
    await mutate(
      "PUT",
      "/api/v1/profiles/organization",
      organization,
      "runtime-org-0001",
    );
    await mutate(
      "PUT",
      "/api/v1/profiles/product",
      product,
      "runtime-product-0001",
    );
    await mutate(
      "POST",
      "/api/v1/knowledge/sources/text",
      {
        label: "Public-safe source",
        text: "No external action; no business outcome claim.",
      },
      "runtime-source-0001",
    );
    await mutate(
      "PUT",
      "/api/v1/profiles/accounts/X",
      account("X"),
      "runtime-account-x-0001",
    );
    await mutate(
      "PUT",
      "/api/v1/profiles/accounts/XIAOHONGSHU",
      account("XIAOHONGSHU"),
      "runtime-account-xhs-0001",
    );
    await mutate(
      "PUT",
      "/api/v1/onboarding/session",
      {
        currentStep: "REVIEW",
        targetMarket: "US",
        contentLocale: "en-US",
        timeZone: "Asia/Singapore",
      },
      "runtime-context-0001",
    );
    const draft = overview.draft;
    const snapshotId = draft.id as string;
    const snapshotDigest = draft.canonicalDigest as string;
    const accountId = overview.profiles.accounts.X.id as string;
    const approved = await mutate(
      "POST",
      "/api/v1/knowledge/snapshots/approve",
      { snapshotId, canonicalDigest: snapshotDigest },
      "runtime-approve-0001",
    );
    const compile = async (label: string, startsAt: string, endsAt: string) => {
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/goals",
        headers: {
          "if-match": approved.headers.etag!,
          "idempotency-key": `runtime-goal-${label}-create`,
        },
        payload: {
          objective: `Public-safe runtime Goal ${label}`,
          horizonDays: 7,
          startsAt,
          endsAt,
          cadence: "DAILY",
          selectedAccountIds: [accountId],
          targetMarket: "US",
          contentLocale: "en-US",
          timeZone: "Asia/Singapore",
          successSignals: [
            {
              code: "PUBLISHING_CADENCE",
              observation: "Observe reviewed fixture slots",
            },
          ],
          knowledgeSnapshotId: snapshotId,
          knowledgeSnapshotDigest: snapshotDigest,
        },
      });
      expect(created.statusCode, created.body).toBe(201);
      const activated = await app.inject({
        method: "POST",
        url: `/api/v1/goals/${created.json().goal.goalId}/activate`,
        headers: {
          "if-match": created.headers.etag!,
          "idempotency-key": `runtime-goal-${label}-activate`,
        },
        payload: { canonicalDigest: created.json().goal.canonicalDigest },
      });
      expect(activated.statusCode, activated.body).toBe(200);
      const compiled = await app.inject({
        method: "POST",
        url: "/api/v1/missions/compile",
        headers: {
          "if-match": activated.headers.etag!,
          "idempotency-key": `runtime-goal-${label}-compile`,
        },
        payload: {
          goalId: activated.json().goal.goalId,
          goalDigest: activated.json().goal.canonicalDigest,
        },
      });
      expect(compiled.statusCode, compiled.body).toBe(201);
      return compiled.json().bundle as MissionIntentBundle;
    };
    return {
      ownerId,
      first: await compile("first", "2026-08-24", "2026-08-30"),
      second: await compile("second", "2026-09-01", "2026-09-07"),
      third: await compile("third", "2026-09-08", "2026-09-14"),
      fourth: await compile("fourth", "2026-09-15", "2026-09-21"),
    };
  } finally {
    await app.close();
  }
}
function runtimeBinding(
  lease: RuntimeLease,
  bundle: MissionIntentBundle,
): RuntimeBinding {
  return {
    schemaVersion: 1,
    runId: lease.run.id,
    runtimeInstanceId: "agentteams-controller",
    runtimeProjectId: lease.run.id,
    teamProfileVersion: bundle.inputBindings.teamProfile.version,
    teamProfileDigest: bundle.inputBindings.teamProfile.digest,
    runtimeVersion: "v1.2.0",
    runtimeDigest: AGENTTEAMS_SOURCE_TAR_SHA256,
    memberBindings: bundle.roles.map((role) => ({
      roleId: role.roleId,
      runtimeActorId: `@${role.roleId}:matrix.local`,
    })),
    state: "BOUND",
    boundAt: lease.run.createdAt,
    lastObservedAt: lease.run.createdAt,
  };
}
function ticketClaims(
  lease: RuntimeLease,
  bundle: MissionIntentBundle,
  runtimeActorId: string,
  expiresAt: Date,
) {
  const phase = runtimeGatewayPhase(lease.job.kind);
  const model = "deepseek-v4-flash" as const;
  const input = runtimeGatewayInputProjection(bundle, lease.job.contract);
  const policy = runtimeGatewayPolicy(lease.job.contract, phase, model);
  const workerIdDigest = sha256Digest(lease.job.leaseOwner!);
  const leaseTokenDigest = runtimeLeaseTokenDigest(lease.leaseToken);
  const request = {
    ownerId: lease.run.ownerId,
    runId: lease.run.id,
    jobId: lease.job.id,
    taskId: lease.job.taskContractId,
    attemptId: lease.attempt.id,
    attemptNumber: lease.attempt.attemptNumber,
    runtimeTaskId: lease.job.taskContractId,
    runtimeActorId,
    workerIdDigest,
    leaseTokenDigest,
    phase,
    model,
    policyDigest: policy.digest,
    inputDigest: lease.job.contract.inputDigest,
    outputSchemaRef: lease.job.contract.outputSchema,
    system: policy.system,
    input,
    outputSchema: policy.outputSchema,
  };
  const claims: Omit<ModelGatewayTicketClaims, "nonce"> = {
    schemaVersion: 1,
    ownerId: request.ownerId,
    runId: request.runId,
    jobId: request.jobId,
    taskId: request.taskId,
    attemptId: request.attemptId,
    attemptNumber: request.attemptNumber,
    runtimeTaskId: request.runtimeTaskId,
    runtimeActorId,
    workerIdDigest,
    leaseTokenDigest,
    phase,
    model,
    policyDigest: policy.digest,
    inputDigest: lease.job.contract.inputDigest,
    requestDigest: runtimeGatewayRequestDigest(request),
    outputSchema: lease.job.contract.outputSchema,
    expiresAt: expiresAt.toISOString(),
  };
  return { claims, request };
}
function envelopeFor(
  lease: RuntimeLease,
  bundle: MissionIntentBundle,
  runtimeActorId: string,
  payload: Record<string, unknown>,
  submittedAt: Date,
): RuntimeSubmissionEnvelope {
  return {
    schemaVersion: 1,
    runId: lease.run.id,
    bundleId: bundle.bundleId,
    bundleDigest: bundle.canonicalDigest,
    generation: bundle.generation,
    taskId: lease.job.taskContractId,
    attemptId: lease.attempt.id,
    attemptNumber: lease.attempt.attemptNumber,
    roleId: lease.job.roleId,
    runtimeTaskId: lease.job.taskContractId,
    runtimeActorId,
    inputDigest: lease.job.contract.inputDigest,
    skillLockDigest: lease.job.contract.skillLockDigest,
    outputSchema: lease.job.contract.outputSchema,
    payload,
    outputDigest: sha256Digest(payload),
    submittedAt: submittedAt.toISOString(),
    evidenceMaturity: "AGENTTEAMS_RUNTIME",
    agentTeamsExecuted: true,
    controlledProvider: true,
  };
}
function actorFor(lease: RuntimeLease, bundle: MissionIntentBundle): string {
  return runtimeBinding(lease, bundle).memberBindings.find(
    (item) => item.roleId === lease.job.roleId,
  )!.runtimeActorId;
}
async function dispatchAndAck(
  runtime: PostgresPersistentRuntimeRepository,
  lease: RuntimeLease,
  bundle: MissionIntentBundle,
  actor: string,
  at: Date,
) {
  await runtime.bindRuntime(
    lease.job.leaseOwner!,
    lease.job.id,
    lease.attempt.id,
    lease.leaseToken,
    runtimeBinding(lease, bundle),
    lease.job.taskContractId,
    new Date(at.getTime() + 10),
  );
  await runtime.recordAck(
    lease.job.leaseOwner!,
    lease.job.id,
    lease.attempt.id,
    lease.leaseToken,
    lease.job.taskContractId,
    actor,
    new Date(at.getTime() + 20),
  );
}
function plannerSubmission(intent: MissionIntentBundle): PlannerSubmission {
  const task = intent.tasks.find((item) => item.kind === "PLAN_CONTENT")!;
  const sourceItemIds = intent.roleContexts
    .find((item) => item.roleId === "campaign-planner")!
    .knowledgeItemIds.slice(0, 2);
  const slots = intent.plannerRequirements.expectedSlotDates.map(
    (localDate, index) => {
      const producerRole: ProducerRoleId =
        index % 2 === 0
          ? "founder-identity-producer"
          : "product-account-producer";
      const mandate =
        producerRole === "founder-identity-producer"
          ? "FOUNDER_VOICE"
          : "PRODUCT_EXPERTISE";
      const selected = intent.inputBindings.accountProfiles.find((item) =>
        item.producerMandates.includes(mandate),
      )!;
      return {
        slotId: stableContractId("runtime-plan-slot", {
          intentBundleId: intent.bundleId,
          localDate,
          index,
        }),
        localDate,
        localTime: index % 2 === 0 ? "09:30" : "18:30",
        platformCode: selected.platformCode,
        accountProfileRevisionId: selected.accountProfileRevisionId,
        producerRole,
        theme: `Runtime plan theme ${index + 1}`,
        contentObjective: `Runtime plan objective ${index + 1}`,
        claimConstraints: [
          "Approved evidence only",
          "No business outcome claim",
        ],
        sourceItemIds,
        status: "PLANNED" as const,
      };
    },
  );
  const first = slots[0]!;
  return {
    schemaVersion: 2,
    roleId: "campaign-planner",
    missionIntentId: intent.missionIntentId,
    intentBundleId: intent.bundleId,
    intentBundleDigest: intent.canonicalDigest,
    taskId: task.taskId,
    inputDigest: task.inputDigest,
    outputSchema: CONTENT_PLAN_SCHEMA_ID,
    outputSchemaDigest: CONTENT_PLAN_SCHEMA_DIGEST,
    skillLockDigest: task.skillLockDigest,
    slots,
    currentBrief: {
      briefId: stableContractId("runtime-plan-brief", { slotId: first.slotId }),
      slotId: first.slotId,
      platformCode: first.platformCode,
      accountProfileRevisionId: first.accountProfileRevisionId,
      producerRole: first.producerRole,
      theme: first.theme,
      contentObjective: first.contentObjective,
      sourceItemIds: [...first.sourceItemIds],
      claimConstraints: [...first.claimConstraints],
    },
    sourceBindings: [
      {
        snapshotId: intent.inputBindings.knowledgeSnapshot.id,
        snapshotDigest: intent.inputBindings.knowledgeSnapshot.digest,
        sourceItemIds,
        claimConstraints: ["Approved evidence only"],
      },
    ],
    evidenceMaturity: "AGENTTEAMS_RUNTIME",
  };
}
async function authorityCount(
  pool: Pool,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  if (
    !["content_plan_revisions_v2", "content_plan_heads_v2"].includes(table) ||
    column !== "plan_id"
  )
    throw new Error("UNSAFE_AUTHORITY_COUNT");
  return Number(
    (
      await pool.query<{ count: string }>(
        `select count(*)::text count from ${table} where ${column}=$1`,
        [value],
      )
    ).rows[0]!.count,
  );
}
async function expectPgCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}
