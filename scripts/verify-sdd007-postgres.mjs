import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";

const adminUrl = process.env.SDD007_POSTGRES_ADMIN_URL ?? process.env.DATABASE_URL;
if (adminUrl === undefined) throw new Error("SDD007_POSTGRES_ADMIN_URL_REQUIRED");

const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
const authorityDatabase = `lumiclaw_sdd007_authority_${suffix}`;
const gatewayDatabase = `lumiclaw_sdd007_gateway_${suffix}`;
const rollbackDatabase = `lumiclaw_sdd007_rollback_${suffix}`;
const blobRoot = await mkdtemp(path.join(tmpdir(), "lumiclaw-sdd007-blobs-"));
const admin = new Client({ connectionString: adminUrl });
const evidencePath = ".evidence/sdd-007/postgres.json";
const latestMigration = "000016_sdd012_a5_auditor_receipt_authority";
const rollbackDepthThroughSdd007 = 3;

function databaseUrl(databaseName) {
  const value = new URL(adminUrl);
  value.pathname = `/${databaseName}`;
  return value.toString();
}

function identifier(value) {
  if (!/^lumiclaw_sdd007_[a-z0-9_]+$/u.test(value)) {
    throw new Error("UNSAFE_SDD007_DATABASE_IDENTIFIER");
  }
  return `"${value}"`;
}

function run(command, args, env = {}, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output.length > 0) process.stdout.write(output);
  if (result.error !== undefined) throw result.error;
  if (result.status !== expectedStatus) {
    throw new Error(
      `SDD007_COMMAND_STATUS_MISMATCH:${command}:${result.status}:${expectedStatus}`,
    );
  }
  return output;
}

async function tableExists(connectionString, table) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(
      "select to_regclass($1) is not null as exists",
      [`public.${table}`],
    );
    return result.rows[0]?.exists === true;
  } finally {
    await client.end();
  }
}

async function migrationBoundarySnapshot(connectionString) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(`select json_build_object(
      'latestMigration',(select name from pgmigrations order by run_on desc,name desc limit 1),
      'boundaryMigrations',coalesce((select json_agg(name order by name) from pgmigrations where name in (
        '000013_x_xhs_artifact_audit_manual_publish_package',
        '000014_persistent_agentteams_runtime',
        '000015_xhs_governed_media_artifacts',
        '000016_sdd012_a5_auditor_receipt_authority'
      )),'[]'::json),
      'artifactV3',to_regclass('public.artifact_revisions_v3') is not null,
      'runtimeV1',to_regclass('public.mission_runs_v1') is not null,
      'mediaV4',to_regclass('public.artifact_revisions_v4') is not null,
      'auditRequestV1',to_regclass('public.media_audit_requests_v1') is not null,
      'earlierGoalSchema',to_regclass('public.operating_goal_revisions') is not null
    ) as snapshot`);
    return result.rows[0]?.snapshot;
  } finally {
    await client.end();
  }
}

async function runtimeAuthorityCounts(connectionString) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(`select json_build_object(
      'runs',(select count(*) from mission_runs_v1),
      'jobs',(select count(*) from mission_jobs_v1),
      'attempts',(select count(*) from agent_task_attempts_v1),
      'events',(select count(*) from runtime_events_v1),
      'batches',(select count(*) from runtime_materialization_batches_v1)
    ) as counts`);
    return result.rows[0]?.counts;
  } finally {
    await client.end();
  }
}

await admin.connect();
try {
  await admin.query(`create database ${identifier(authorityDatabase)}`);
  await admin.query(`create database ${identifier(gatewayDatabase)}`);
  await admin.query(`create database ${identifier(rollbackDatabase)}`);
  const authorityUrl = databaseUrl(authorityDatabase);
  const gatewayUrl = databaseUrl(gatewayDatabase);
  const rollbackUrl = databaseUrl(rollbackDatabase);

  run("npm", ["run", "migrate:up", "--workspace", "@lumiclaw/db"], {
    DATABASE_URL: authorityUrl,
  });
  run(
    "npx",
    ["vitest", "run", "apps/api/src/persistent-runtime-postgres.test.ts"],
    {
      SDD007_POSTGRES_URL: authorityUrl,
      SDD007_BLOB_ROOT: blobRoot,
    },
  );

  const populatedBoundaryBefore = await migrationBoundarySnapshot(authorityUrl);
  const populatedAuthorityBefore = await runtimeAuthorityCounts(authorityUrl);
  if (
    populatedBoundaryBefore?.latestMigration !== latestMigration ||
    populatedBoundaryBefore?.boundaryMigrations?.join(",") !==
      [
        "000013_x_xhs_artifact_audit_manual_publish_package",
        "000014_persistent_agentteams_runtime",
        "000015_xhs_governed_media_artifacts",
        latestMigration,
      ].join(",") ||
    populatedBoundaryBefore?.artifactV3 !== true ||
    populatedBoundaryBefore?.runtimeV1 !== true ||
    populatedBoundaryBefore?.mediaV4 !== true ||
    populatedBoundaryBefore?.auditRequestV1 !== true ||
    populatedBoundaryBefore?.earlierGoalSchema !== true ||
    Number(populatedAuthorityBefore?.runs) < 1
  ) {
    throw new Error("SDD007_POPULATED_ROLLBACK_PRECONDITION_INVALID");
  }

  const blockedDown = run(
    "npm",
    [
      "run",
      "migrate:down",
      "--workspace",
      "@lumiclaw/db",
      "--",
      String(rollbackDepthThroughSdd007),
    ],
    { DATABASE_URL: authorityUrl },
    1,
  );
  if (!blockedDown.includes("SDD007_DOWN_BLOCKED_EXPORT_RUNTIME_EVIDENCE_FIRST")) {
    throw new Error("SDD007_POPULATED_DOWN_DID_NOT_FAIL_CLOSED");
  }
  const populatedBoundaryAfter = await migrationBoundarySnapshot(authorityUrl);
  const populatedAuthorityAfter = await runtimeAuthorityCounts(authorityUrl);
  if (
    JSON.stringify(populatedBoundaryAfter) !==
      JSON.stringify(populatedBoundaryBefore) ||
    JSON.stringify(populatedAuthorityAfter) !==
      JSON.stringify(populatedAuthorityBefore) ||
    !(await tableExists(authorityUrl, "mission_runs_v1"))
  ) {
    throw new Error("SDD007_POPULATED_DOWN_PARTIALLY_REMOVED_AUTHORITY");
  }

  run("npm", ["run", "migrate:up", "--workspace", "@lumiclaw/db"], {
    DATABASE_URL: gatewayUrl,
  });
  run(
    "npx",
    ["vitest", "run", "apps/model-gateway/src/postgres-fencing.test.ts"],
    { SDD007_POSTGRES_URL: gatewayUrl },
  );

  run("npm", ["run", "migrate:up", "--workspace", "@lumiclaw/db"], {
    DATABASE_URL: rollbackUrl,
  });
  run(
    "npm",
    [
      "run",
      "migrate:down",
      "--workspace",
      "@lumiclaw/db",
      "--",
      String(rollbackDepthThroughSdd007),
    ],
    { DATABASE_URL: rollbackUrl },
  );
  const emptyBoundaryAfter = await migrationBoundarySnapshot(rollbackUrl);
  if (
    emptyBoundaryAfter?.latestMigration !==
      "000013_x_xhs_artifact_audit_manual_publish_package" ||
    emptyBoundaryAfter?.boundaryMigrations?.join(",") !==
      "000013_x_xhs_artifact_audit_manual_publish_package" ||
    emptyBoundaryAfter?.artifactV3 !== true ||
    emptyBoundaryAfter?.runtimeV1 !== false ||
    emptyBoundaryAfter?.mediaV4 !== false ||
    emptyBoundaryAfter?.auditRequestV1 !== false ||
    emptyBoundaryAfter?.earlierGoalSchema !== true ||
    (await tableExists(rollbackUrl, "mission_runs_v1"))
  ) {
    throw new Error("SDD007_EMPTY_DOWN_LEFT_RUNTIME_TABLES");
  }

  const version = await admin.query("show server_version");
  const evidence = {
    schemaVersion: 1,
    status: "PASS",
    postgresVersion: version.rows[0]?.server_version,
    freshMigrationUp: true,
    rollbackDepthFromMigration16ThroughMigration14:
      rollbackDepthThroughSdd007,
    populatedMigrationDownFailClosed: true,
    populatedDownRestoresMigrations16And15: true,
    populatedDownPreservesExactAuthorityCounts: true,
    emptyMigrationUpDown: true,
    emptyDownRemovesOnlyMigrations16Through14: true,
    emptyDownPreservesMigration13AndEarlierSchema: true,
    exactLineageAdversarialSql: true,
    concurrentCreateReplay: true,
    dualWorkerLeaseCas: true,
    dualWorkerLeaseHeartbeatExtension: true,
    durableSubmissionIntentRecovery: true,
    ackWithoutIntentRecovery: true,
    staleLeaseRejectedAfterRecovery: true,
    completionOutboxRecovery: true,
    completionConfirmationGatesDependenciesAndRunTerminalState: true,
    cancelledRunCompletionOutboxTerminalMonotonic: true,
    ticketOneUseAndLeaseFencing: true,
    gatewayProviderCallsFencedByPostgres: true,
    stagedMaterializationRecovery: true,
    multiItemAtomicRollbackAndResume: true,
    acceptedOutputExactlyOnce: true,
    apiMutationEtagAndIdempotency: true,
    fixture: "PUBLIC_SAFE_A_MENG",
  };
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.info(JSON.stringify({ ...evidence, evidence: evidencePath }));
} finally {
  for (const database of [
    authorityDatabase,
    gatewayDatabase,
    rollbackDatabase,
  ]) {
    await admin
      .query(`drop database if exists ${identifier(database)} with (force)`)
      .catch((error) => console.error(`cleanup ${database}: ${error.message}`));
  }
  await admin.end().catch(() => undefined);
  await rm(blobRoot, { recursive: true, force: true });
}
