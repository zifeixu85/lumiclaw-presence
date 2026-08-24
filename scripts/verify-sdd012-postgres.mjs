import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const image =
  "postgres:17-alpine@sha256:dc17045ccfd343b49600570ea734b9c4991cf1c3f3302e67df51e3b402dd55c4";
const container = `lumiclaw-sdd012-pg-${process.pid}`;
const evidenceDirectory = path.resolve("docs/reports/evidence/sdd-012");
const checks = {};
const commands = [];
let result = "FAIL";
let failure = null;
function publicLog(value) {
  let redacted = value.replaceAll(process.cwd(), "<WORKTREE>");
  const taskHome = process.env.HOME;
  if (taskHome !== undefined) redacted = redacted.replaceAll(taskHome, "<HOME>");
  return redacted;
}
const run = (file, args, options = {}) => {
  const startedAt = new Date().toISOString();
  const value = spawnSync(file, args, {
    cwd: process.cwd(),
    encoding: options.binary ? undefined : "utf8",
    timeout: options.timeout ?? 180_000,
    env: { ...process.env, ...options.env },
    input: options.input,
  });
  commands.push({
    command: [file, ...args],
    startedAt,
    status: value.status,
    stdout: options.binary
      ? `<${value.stdout?.byteLength ?? 0} binary bytes>`
      : publicLog(value.stdout ?? "").slice(-4000),
    stderr: options.binary
      ? Buffer.from(value.stderr ?? [])
          .toString("utf8")
          .slice(-4000)
      : publicLog(value.stderr ?? "").slice(-4000),
  });
  if (value.status !== 0 && !options.allowFailure)
    throw new Error(
      `COMMAND_FAILED:${file} ${args.join(" ")}\n${value.stderr}`,
    );
  return value;
};
const docker = (args, options = {}) => run("docker", args, options);
const psql = (database, sql, options = {}) =>
  docker(
    [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      sql,
    ],
    options,
  );

await mkdir(evidenceDirectory, { recursive: true });
try {
  docker([
    "run",
    "--detach",
    "--name",
    container,
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "--publish",
    "127.0.0.1::5432",
    image,
  ]);
  let stableReadinessChecks = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = docker(
      [
        "exec",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-At",
        "-c",
        "select 1",
      ],
      { allowFailure: true },
    );
    stableReadinessChecks =
      ready.status === 0 && ready.stdout.trim() === "1"
        ? stableReadinessChecks + 1
        : 0;
    if (stableReadinessChecks >= 4) break;
    if (attempt === 59) throw new Error("POSTGRES_READINESS_TIMEOUT");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const portText = docker(["port", container, "5432/tcp"]).stdout.trim();
  const port = /:(\d+)$/u.exec(portText)?.[1];
  if (port === undefined) throw new Error("POSTGRES_PORT_NOT_FOUND");
  for (const database of ["sdd012_repo", "sdd012_worker"])
    docker(["exec", container, "createdb", "-U", "postgres", database]);
  const repoUrl = `postgres://postgres@127.0.0.1:${port}/sdd012_repo`;
  const workerUrl = `postgres://postgres@127.0.0.1:${port}/sdd012_worker`;
  for (const url of [repoUrl, workerUrl])
    run("npm", ["--workspace", "@lumiclaw/db", "run", "migrate:up"], {
      env: { DATABASE_URL: url },
    });
  checks.migration15Applied =
    psql(
      "sdd012_repo",
      "select count(*) from pgmigrations where name='000015_xhs_governed_media_artifacts'",
    ).stdout.trim() === "1";
  checks.migration16Applied =
    psql(
      "sdd012_repo",
      "select count(*) from pgmigrations where name='000016_sdd012_a5_auditor_receipt_authority'",
    ).stdout.trim() === "1";
  run(
    "npx",
    [
      "vitest",
      "run",
      "packages/db/src/media-artifact-repository.test.ts",
      "--configLoader=runner",
    ],
    { env: { SDD012_POSTGRES_URL: repoUrl } },
  );
  checks.repositoryAuthority = true;
  run(
    "npx",
    [
      "vitest",
      "run",
      "apps/mission-worker/src/media-worker.test.ts",
      "--configLoader=runner",
    ],
    { env: { SDD012_MEDIA_WORKER_POSTGRES_URL: workerUrl }, timeout: 240_000 },
  );
  checks.fiveCrashStages = true;
  const countsSql = `select json_build_object('specs',(select count(*) from media_generation_specs_v2),'jobs',(select count(*) from media_generation_jobs_v2),'intents',(select count(*) from media_provider_submission_intents_v2),'tasks',(select count(*) from media_provider_task_receipts_v2),'costs',(select count(*) from media_cost_receipts_v2),'rights',(select count(*) from media_rights_receipts_v2),'raw',(select count(*) from media_raw_assets_v2),'final',(select count(*) from media_composited_assets_v2),'staging',(select count(*) from media_blob_staging_v1))::text`;
  const before = JSON.parse(psql("sdd012_worker", countsSql).stdout.trim());
  checks.authorityRowsComplete =
    before.jobs === 5 &&
    before.intents === 5 &&
    before.raw === 4 &&
    before.final === 4 &&
    before.tasks >= 4 &&
    before.costs === 4 &&
    before.rights === 4 &&
    before.staging === 8;
  const unknown = JSON.parse(
    psql(
      "sdd012_worker",
      `select json_build_object('count',count(*),'tasks',count(provider_task_id),'attempts',max(attempt_count))::text from media_generation_jobs_v2 where state='UNKNOWN_CHARGE_STATE'`,
    ).stdout.trim(),
  );
  checks.unknownChargeNoTaskNoRetry =
    Number(unknown.count) === 1 &&
    Number(unknown.tasks) === 0 &&
    Number(unknown.attempts) === 1;
  const sameTasks =
    psql(
      "sdd012_worker",
      `select count(*)=count(distinct provider_task_id) from media_generation_jobs_v2 where provider_task_id is not null`,
    ).stdout.trim() === "t";
  checks.sameTaskReconciliation = sameTasks;
  const triggers = Number(
    psql(
      "sdd012_worker",
      `select count(*) from pg_trigger where not tgisinternal and tgname like '%_immutable'`,
    ).stdout.trim(),
  );
  const fks = Number(
    psql(
      "sdd012_worker",
      `select count(*) from information_schema.table_constraints where constraint_type='FOREIGN KEY' and table_name in ('artifact_revisions_v4','media_set_items_v1','artifact_audit_decisions_v4','artifact_owner_decisions_v4','manual_publish_packages_v4')`,
    ).stdout.trim(),
  );
  checks.appendOnlyTriggers = triggers >= 16;
  checks.exactLineageForeignKeys = fks >= 9;
  const immutable = psql(
    "sdd012_worker",
    `update media_raw_assets_v2 set content_digest=repeat('0',64)`,
    { allowFailure: true },
  );
  checks.appendOnlyMutationBlocked =
    immutable.status !== 0 &&
    `${immutable.stdout}${immutable.stderr}`.includes(
      "SDD012_APPEND_ONLY_MEDIA_AUTHORITY",
    );
  const auditRequestImmutable = psql(
    "sdd012_repo",
    `update media_audit_requests_v1 set task_contract_digest=repeat('0',64)`,
    { allowFailure: true },
  );
  checks.auditRequestAppendOnly =
    auditRequestImmutable.status !== 0 &&
    `${auditRequestImmutable.stdout}${auditRequestImmutable.stderr}`.includes(
      "SDD012_APPEND_ONLY_MEDIA_AUTHORITY",
    );
  const a5ForeignKeys = Number(
    psql(
      "sdd012_repo",
      `select count(*) from information_schema.table_constraints where constraint_type='FOREIGN KEY' and table_name in ('media_audit_requests_v1','media_runtime_audit_receipts_v1')`,
    ).stdout.trim(),
  );
  checks.exactA5CompositeForeignKeys = a5ForeignKeys >= 11;
  const forgedRuntimeAudit = psql(
    "sdd012_repo",
    `insert into artifact_audit_decisions_v4(owner_profile_id,id,artifact_revision_id,artifact_revision_digest,auditor_role,auditor_identity_id,evidence_maturity,agentteams_executed,authoritative_for_operations,runtime_receipt_digest,result,canonical_digest,payload,created_at) select owner_profile_id,'direct-sql-forged-runtime-audit',id,canonical_digest,'A5_INDEPENDENT_AUDITOR','browser-selected-a5','AGENTTEAMS_RUNTIME',true,true,repeat('f',64),'PASS',repeat('e',64),'{}'::jsonb,now() from artifact_revisions_v4 limit 1`,
    { allowFailure: true },
  );
  checks.directSqlRuntimeAuditForgeryBlocked =
    forgedRuntimeAudit.status !== 0 &&
    `${forgedRuntimeAudit.stdout}${forgedRuntimeAudit.stderr}`.includes(
      "artifact_audit_v4_exact_runtime_receipt_fk",
    );
  const down = run(
    "npm",
    ["--workspace", "@lumiclaw/db", "run", "migrate:down", "--", "1"],
    { env: { DATABASE_URL: repoUrl }, allowFailure: true },
  );
  checks.populatedDownBlocked =
    down.status !== 0 &&
    `${down.stdout}${down.stderr}`.includes(
      "SDD012_A5_RECEIPT_DOWN_BLOCKED_EXPORT_AND_FORWARD_FIX_REQUIRED",
    );
  const dump = docker(
    [
      "exec",
      container,
      "pg_dump",
      "-U",
      "postgres",
      "--format=custom",
      "sdd012_worker",
    ],
    { binary: true },
  );
  const dumpBytes = Buffer.from(dump.stdout);
  checks.backupNonEmpty = dumpBytes.byteLength > 1024;
  docker(["exec", container, "createdb", "-U", "postgres", "sdd012_restore"]);
  docker(
    [
      "exec",
      "-i",
      container,
      "pg_restore",
      "-U",
      "postgres",
      "--no-owner",
      "--dbname",
      "sdd012_restore",
    ],
    { input: dumpBytes, timeout: 240_000 },
  );
  const after = JSON.parse(psql("sdd012_restore", countsSql).stdout.trim());
  checks.backupRestoreExact = JSON.stringify(before) === JSON.stringify(after);
  const failed = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failed.length > 0)
    throw new Error(`SDD012_POSTGRES_CHECKS_FAILED:${failed.join(",")}`);
  result = "PASS";
  await writeFile(
    path.join(evidenceDirectory, "postgres-verification.json"),
    `${JSON.stringify({ schemaVersion: 1, sdd: "SDD-012", classification: "PUBLIC_SAFE_SYNTHETIC", result, generatedAt: new Date().toISOString(), image, checks, counts: before, unknownCharge: unknown, appendOnlyTriggerCount: triggers, exactLineageForeignKeyCount: fks, backupSha256: createHash("sha256").update(dumpBytes).digest("hex"), commands }, null, 2)}\n`,
  );
} catch (error) {
  failure =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : String(error);
  throw error;
} finally {
  docker(["rm", "--force", container], { allowFailure: true });
  if (result !== "PASS")
    await writeFile(
      path.join(evidenceDirectory, "postgres-verification.json"),
      `${JSON.stringify({ schemaVersion: 1, sdd: "SDD-012", classification: "PUBLIC_SAFE_SYNTHETIC", result, generatedAt: new Date().toISOString(), checks, failure, commands }, null, 2)}\n`,
    );
  console.info(
    JSON.stringify({
      status: result,
      checks: Object.keys(checks).length,
      evidence: "docs/reports/evidence/sdd-012/postgres-verification.json",
    }),
  );
}
