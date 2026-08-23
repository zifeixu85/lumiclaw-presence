import { PostgresModelGatewayTicketRepository } from "@lumiclaw/db";
import {
  createOperatingGoalRevision,
  createRuntimeRunGraph,
  runtimeGatewayInputProjection,
  runtimeGatewayPhase,
  runtimeGatewayPolicy,
  runtimeGatewayRequestDigest,
  runtimeLeaseTokenDigest,
  sha256Digest,
  stableContractId,
  type AccountProfileBinding,
  type KnowledgeRoleContext,
  type MissionIntentBundle,
  type RuntimeGatewayGenerateRequest,
  type RuntimeTaskContract,
} from "@lumiclaw/domain";
import { PublicSafeMockModelProvider } from "@lumiclaw/governed-shadow";
import { compileMissionIntentV2 } from "@lumiclaw/mission-compiler";
import { Pool, type PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { buildModelGateway } from "./server.js";

const connectionString = process.env.SDD007_POSTGRES_URL;
const suite = connectionString === undefined ? describe.skip : describe;
const ownerId = "0199a000-0000-7000-8000-000000000099";
const now = new Date("2026-08-22T12:00:00.000Z");
const bootstrap = "bootstrap-secret-value-01234567890123456789";

suite("SDD-007 Model Gateway PostgreSQL lease fencing", () => {
  it("keeps providerCalls at 0 for stale owner/token, expired lease and retry attempt, and at 1 for concurrent same-ticket calls", async () => {
    const pool = new Pool({ connectionString: connectionString! });
    await pool.query(
      "insert into local_owner_profiles(id,singleton_key,schema_version,display_name,state,created_at,updated_at) values($1,true,1,'Public-safe gateway fixture','PROFILE_READY',$2,$2)",
      [ownerId, now],
    );
    const scenarios = await Promise.all(
      ["concurrent", "stale", "expired", "retry", "short-lease", "stale-issue"].map((name) =>
        seedLineage(pool, name),
      ),
    );
    let providerCalls = 0;
    const app = buildModelGateway({
      repository: new PostgresModelGatewayTicketRepository(connectionString!),
      mode: "CONTROLLED_FAKE",
      bootstrapSecret: bootstrap,
      signingSecret: "signing-secret-value-012345678901234567890",
      now: () => now,
      providerFactory: ({ controlledOutput }) => {
        providerCalls += 1;
        return new PublicSafeMockModelProvider(controlledOutput, () => now);
      },
    });
    try {
      const concurrent = await ticketAndRequest(app, scenarios[0]!);
      const concurrentResponses = await Promise.all([
        generate(app, concurrent),
        generate(app, concurrent),
      ]);
      expect(
        concurrentResponses.map((response) => response.statusCode).sort(),
      ).toEqual([200, 409]);
      expect(providerCalls).toBe(1);

      const stale = await ticketAndRequest(app, scenarios[1]!);
      const replacement = runtimeLeaseTokenDigest("replacement-lease-token");
      await pool.query(
        "with changed as (update mission_jobs_v1 set lease_owner='replacement-worker',lease_token_hash=$2 where id=$1 returning id) update agent_task_attempts_v1 set lease_token_hash=$2 where id=$3 and exists(select 1 from changed)",
        [scenarios[1]!.jobId, replacement, scenarios[1]!.attemptId],
      );
      expect((await generate(app, stale)).statusCode).toBe(422);
      expect(providerCalls).toBe(1);

      const expired = await ticketAndRequest(app, scenarios[2]!);
      await pool.query(
        "update mission_jobs_v1 set lease_expires_at=$2 where id=$1",
        [scenarios[2]!.jobId, new Date(now.getTime() - 1)],
      );
      expect((await generate(app, expired)).statusCode).toBe(422);
      expect(providerCalls).toBe(1);

      const retry = await ticketAndRequest(app, scenarios[3]!);
      await replaceWithAttemptTwo(pool, scenarios[3]!);
      expect((await generate(app, retry)).statusCode).toBe(422);
      expect(providerCalls).toBe(1);

      await pool.query(
        "update mission_jobs_v1 set lease_expires_at=$2 where id=$1",
        [scenarios[4]!.jobId, new Date(now.getTime() + 30_000)],
      );
      const shortLeaseIssue = await rawTicketRequest(app, scenarios[4]!);
      expect(shortLeaseIssue.issued.statusCode).toBe(422);
      expect(shortLeaseIssue.issued.json().code).toBe("JOB_LEASE_LOST");
      expect(providerCalls).toBe(1);

      await replaceWithAttemptTwo(pool, scenarios[5]!);
      const staleAttemptIssue = await rawTicketRequest(app, scenarios[5]!);
      expect(staleAttemptIssue.issued.statusCode).toBe(422);
      expect(staleAttemptIssue.issued.json().code).toBe("JOB_LEASE_LOST");
      expect(providerCalls).toBe(1);
      const uses = await pool.query<{ outcome: string; count: string }>(
        "select outcome,count(*)::text count from model_gateway_ticket_uses_v1 group by outcome order by outcome",
      );
      expect(uses.rows).toEqual(
        expect.arrayContaining([
          { outcome: "REJECTED", count: "3" },
          { outcome: "REPLAYED", count: "1" },
          { outcome: "USED", count: "1" },
        ]),
      );
    } finally {
      await app.close();
      await pool.end();
    }
  }, 60_000);
});

type Seed = {
  bundle: MissionIntentBundle;
  contract: RuntimeTaskContract;
  runId: string;
  jobId: string;
  attemptId: string;
  attemptNumber: number;
  runtimeActorId: string;
  workerId: string;
  leaseToken: string;
  runtimeTaskId: string;
};
async function seedLineage(pool: Pool, name: string): Promise<Seed> {
  const bundle = bundleFor(name);
  const graph = createRuntimeRunGraph(bundle, "terminal-owner", now);
  const job = graph.jobs[0]!;
  const attemptNumber = 1;
  const attemptId = stableContractId("agent-task-attempt", {
    jobId: job.id,
    attemptNumber,
  });
  const runtimeActorId = "@presence-mission-leader:matrix.local";
  const workerId = `worker-${name}`;
  const leaseToken = `lease-${name}-${"x".repeat(40)}`;
  const leaseDigest = runtimeLeaseTokenDigest(leaseToken);
  const runtimeTaskId = `${job.taskContractId}:attempt:1`;
  const memberBindings = bundle.roles.map((role) => ({
    roleId: role.roleId,
    runtimeActorId: `@${role.roleId}:matrix.local`,
  }));
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into mission_runs_v1(id,owner_profile_id,bundle_id,bundle_digest,bundle_kind,generation,runtime_requirement,bundle_payload,state,created_by,created_at,started_at,finished_at,last_reconciled_at,error_code,row_version,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,'RUNNING','terminal-owner',$9,$9,null,null,null,2,$9)`,
      [
        graph.run.id,
        ownerId,
        bundle.bundleId,
        bundle.canonicalDigest,
        bundle.kind,
        bundle.generation,
        JSON.stringify(graph.run.runtimeRequirement),
        JSON.stringify(bundle),
        now,
      ],
    );
    await client.query(
      `insert into mission_jobs_v1(id,owner_profile_id,run_id,task_contract_id,generation,role_id,kind,dependency_ids,input_digest,skill_lock_digest,schema_ref,contract_payload,state,available_at,lease_owner,lease_token_hash,lease_expires_at,attempt_count,accepted_attempt_id,accepted_output_ref,accepted_output_digest,runtime_task_id,last_error_code,row_version,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ACKNOWLEDGED',$13,$14,$15,$16,1,null,null,null,$17,null,3,$13,$13)`,
      [
        job.id,
        ownerId,
        graph.run.id,
        job.taskContractId,
        job.generation,
        job.roleId,
        job.kind,
        JSON.stringify(job.dependencyIds),
        job.contract.inputDigest,
        job.contract.skillLockDigest,
        job.contract.outputSchema,
        JSON.stringify(job.contract),
        now,
        workerId,
        leaseDigest,
        new Date(now.getTime() + 120_000),
        runtimeTaskId,
      ],
    );
    await client.query(
      `insert into agent_task_attempts_v1(id,owner_profile_id,run_id,job_id,attempt_number,role_id,runtime_task_id,runtime_actor_id,input_digest,skill_lock_digest,schema_ref,lease_token_hash,state,ack_at,submitted_at,output_digest,output_envelope,error_code,created_at,updated_at) values($1,$2,$3,$4,1,$5,$6,$7,$8,$9,$10,$11,'ACKNOWLEDGED',$12,null,null,null,null,$12,$12)`,
      [
        attemptId,
        ownerId,
        graph.run.id,
        job.id,
        job.roleId,
        runtimeTaskId,
        runtimeActorId,
        job.contract.inputDigest,
        job.contract.skillLockDigest,
        job.contract.outputSchema,
        leaseDigest,
        now,
      ],
    );
    await client.query(
      `insert into runtime_bindings_v1(run_id,owner_profile_id,runtime_instance_id,runtime_project_id,team_profile_version,team_profile_digest,runtime_version,runtime_digest,member_bindings,state,bound_at,last_observed_at) values($1,$2,'agentteams-controller',$1,$3,$4,$5,$6,$7,'BOUND',$8,$8)`,
      [
        graph.run.id,
        ownerId,
        graph.run.runtimeRequirement.teamProfileVersion,
        graph.run.runtimeRequirement.teamProfileDigest,
        graph.run.runtimeRequirement.version,
        graph.run.runtimeRequirement.sourceTarSha256,
        JSON.stringify(memberBindings),
        now,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
  return {
    bundle,
    contract: job.contract,
    runId: graph.run.id,
    jobId: job.id,
    attemptId,
    attemptNumber,
    runtimeActorId,
    workerId,
    leaseToken,
    runtimeTaskId,
  };
}

function bundleFor(name: string): MissionIntentBundle {
  const account: AccountProfileBinding = {
    accountProfileRevisionId: stableUuid(name, 1),
    revision: 1,
    digest: sha256Digest({ name, account: true }),
    platformCode: "X",
    handleOrDisplayName: `@fixture_${name}`,
    producerMandates: ["FOUNDER_VOICE", "PRODUCT_EXPERTISE"],
    targetMarket: "US",
    contentLocale: "en-US",
  };
  const snapshotId = stableUuid(name, 2);
  const snapshotDigest = sha256Digest({ name, snapshot: true });
  const goal = createOperatingGoalRevision({
    ownerId,
    goalId: `goal-${name}`,
    revision: 1,
    state: "ACTIVE",
    parentDigest: null,
    value: {
      objective: `Public-safe ${name} gateway fencing`,
      horizonDays: 7,
      startsAt: "2026-08-24",
      endsAt: "2026-08-30",
      cadence: "DAILY",
      selectedAccountIds: [account.accountProfileRevisionId],
      targetMarket: "US",
      contentLocale: "en-US",
      timeZone: "Asia/Singapore",
      successSignals: [
        {
          code: "PUBLISHING_CADENCE",
          observation: "Observe reviewed slots only.",
        },
      ],
      knowledgeSnapshotId: snapshotId,
      knowledgeSnapshotDigest: snapshotDigest,
    },
    createdAt: now.toISOString(),
  });
  const knowledge: KnowledgeRoleContext = {
    snapshotId,
    snapshotDigest,
    ownerId,
    targetMarket: "US",
    contentLocale: "en-US",
    timeZone: "Asia/Singapore",
    items: [
      {
        id: `item-${name}`,
        kind: "EVIDENCE",
        normalizedValue: "Public-safe engineering fixture.",
        sourceRevisionIds: [`source-${name}`],
        profileRevisionIds: [],
        ownerAuthority: "ORGANIZATION_APPROVED_PRIVATE",
      },
    ],
    sourceDigests: [
      {
        revisionId: `source-${name}`,
        digest: sha256Digest({ name, source: true }),
      },
    ],
    profileDigests: [
      { revisionId: account.accountProfileRevisionId, digest: account.digest },
    ],
  };
  return compileMissionIntentV2({
    goal,
    knowledge,
    accountProfiles: [account],
  });
}

async function ticketAndRequest(
  app: ReturnType<typeof buildModelGateway>,
  seed: Seed,
) {
  const value = await rawTicketRequest(app, seed);
  expect(value.issued.statusCode, value.issued.body).toBe(201);
  return {
    ticket: value.issued.json().ticket as string,
    request: value.request,
    output: value.output,
  };
}
async function rawTicketRequest(
  app: ReturnType<typeof buildModelGateway>,
  seed: Seed,
) {
  const phase = runtimeGatewayPhase(seed.contract.kind);
  const model = "deepseek-v4-flash" as const;
  const policy = runtimeGatewayPolicy(seed.contract, phase, model);
  const input = runtimeGatewayInputProjection(seed.bundle, seed.contract);
  const request: RuntimeGatewayGenerateRequest = {
    ownerId,
    runId: seed.runId,
    jobId: seed.jobId,
    taskId: seed.contract.taskId,
    attemptId: seed.attemptId,
    attemptNumber: seed.attemptNumber,
    runtimeTaskId: seed.runtimeTaskId,
    runtimeActorId: seed.runtimeActorId,
    workerIdDigest: sha256Digest(seed.workerId),
    leaseTokenDigest: runtimeLeaseTokenDigest(seed.leaseToken),
    phase,
    model,
    policyDigest: policy.digest,
    inputDigest: seed.contract.inputDigest,
    outputSchemaRef: seed.contract.outputSchema,
    system: policy.system,
    input,
    outputSchema: policy.outputSchema,
  };
  const issued = await app.inject({
    method: "POST",
    url: "/internal/v1/tickets",
    headers: { "x-lumiclaw-gateway-bootstrap": bootstrap },
    payload: {
      ownerId,
      runId: seed.runId,
      jobId: seed.jobId,
      taskId: seed.contract.taskId,
      attemptId: seed.attemptId,
      attemptNumber: seed.attemptNumber,
      runtimeTaskId: seed.runtimeTaskId,
      runtimeActorId: seed.runtimeActorId,
      workerIdDigest: request.workerIdDigest,
      leaseTokenDigest: request.leaseTokenDigest,
      phase,
      model,
      policyDigest: policy.digest,
      inputDigest: seed.contract.inputDigest,
      requestDigest: runtimeGatewayRequestDigest(request),
      outputSchema: seed.contract.outputSchema,
    },
  });
  return {
    issued,
    request,
    output: {
      schemaVersion: 1,
      taskId: seed.contract.taskId,
      inputDigest: seed.contract.inputDigest,
      agentTeamsExecuted: true,
      completed: true,
    },
  };
}
async function generate(
  app: ReturnType<typeof buildModelGateway>,
  value: Awaited<ReturnType<typeof ticketAndRequest>>,
) {
  return app.inject({
    method: "POST",
    url: "/internal/v1/generate",
    headers: { "x-lumiclaw-model-ticket": value.ticket },
    payload: { ...value.request, controlledOutput: value.output },
  });
}
async function replaceWithAttemptTwo(pool: Pool, seed: Seed) {
  const client = await pool.connect();
  const tokenDigest = runtimeLeaseTokenDigest("new-attempt-token");
  const attemptId = stableContractId("agent-task-attempt", {
    jobId: seed.jobId,
    attemptNumber: 2,
  });
  const runtimeTaskId = `${seed.contract.taskId}:attempt:2`;
  try {
    await client.query("begin");
    await client.query(
      "update agent_task_attempts_v1 set state='FAILED',error_code='JOB_LEASE_LOST',updated_at=$2 where id=$1",
      [seed.attemptId, now],
    );
    await client.query(
      "update mission_jobs_v1 set attempt_count=2,runtime_task_id=$2,lease_owner='retry-worker',lease_token_hash=$3,lease_expires_at=$4,row_version=row_version+1 where id=$1",
      [
        seed.jobId,
        runtimeTaskId,
        tokenDigest,
        new Date(now.getTime() + 120_000),
      ],
    );
    await client.query(
      `insert into agent_task_attempts_v1(id,owner_profile_id,run_id,job_id,attempt_number,role_id,runtime_task_id,runtime_actor_id,input_digest,skill_lock_digest,schema_ref,lease_token_hash,state,ack_at,submitted_at,output_digest,output_envelope,error_code,created_at,updated_at) values($1,$2,$3,$4,2,$5,$6,$7,$8,$9,$10,$11,'ACKNOWLEDGED',$12,null,null,null,null,$12,$12)`,
      [
        attemptId,
        ownerId,
        seed.runId,
        seed.jobId,
        seed.contract.roleId,
        runtimeTaskId,
        seed.runtimeActorId,
        seed.contract.inputDigest,
        seed.contract.skillLockDigest,
        seed.contract.outputSchema,
        tokenDigest,
        now,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}
function stableUuid(name: string, index: number) {
  const digest = sha256Digest({ name, index });
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-7${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
async function rollback(client: PoolClient) {
  try {
    await client.query("rollback");
  } catch {}
}
