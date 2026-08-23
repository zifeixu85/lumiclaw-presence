import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const project = "lumiclaw-sdd012-verify";
const webPort = "3212";
const apiPort = "4212";
const apiUrl = `http://127.0.0.1:${apiPort}`;
const evidenceDirectory = path.resolve("docs/reports/evidence/sdd-012");
const packagePath = path.resolve(".evidence/sdd-012/sdd012-media-package.zip");
const files = ["-f", "compose.yml", "-f", "compose.media-controlled-fake.yml"];
const checks = {};
const events = [];
let result = "FAIL";
let failure = null;
function canonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}
function canonicalDigest(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}
function publicLog(value) {
  let redacted = value.replaceAll(process.cwd(), "<WORKTREE>");
  const taskHome = process.env.HOME;
  if (taskHome !== undefined) redacted = redacted.replaceAll(taskHome, "<HOME>");
  return redacted;
}
function docker(args, options = {}) {
  const command = ["compose", "--project-name", project, ...files, ...args];
  const value = spawnSync("docker", command, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: options.timeout ?? 900_000,
    env: {
      ...process.env,
      LUMICLAW_WEB_PORT: webPort,
      LUMICLAW_API_PORT: apiPort,
      ...options.env,
    },
  });
  events.push({
    command: ["docker", ...command],
    status: value.status,
    stdout: publicLog(value.stdout ?? "").slice(-4000),
    stderr: publicLog(value.stderr ?? "").slice(-4000),
  });
  if (value.status !== 0 && !options.allowFailure)
    throw new Error(`SDD012_DOCKER_FAILED:${args.join(" ")}\n${value.stderr}`);
  return value;
}
function composeRows() {
  const raw = docker(["ps", "--format", "json"]).stdout.trim();
  return raw === ""
    ? []
    : raw.startsWith("[")
      ? JSON.parse(raw)
      : raw.split("\n").map((line) => JSON.parse(line));
}
async function waitHealthy(timeout = 360_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const rows = composeRows();
    const byService = new Map();
    for (const row of rows) {
      const values = byService.get(row.Service) ?? [];
      values.push(row.Health || row.State);
      byService.set(row.Service, values);
    }
    if (
      ["postgres", "api", "action-operator", "web"].every((service) =>
        byService.get(service)?.every((state) => state === "healthy"),
      ) &&
      (byService.get("mission-worker")?.filter((state) => state === "healthy")
        .length ?? 0) === 2
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("SDD012_COMPOSE_HEALTH_TIMEOUT");
}
function pg(sql) {
  return docker([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "postgres",
    "-d",
    "lumiclaw",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    sql,
  ]).stdout.trim();
}
async function api(route) {
  const response = await fetch(`${apiUrl}${route}`);
  let body = {};
  try {
    body = await response.json();
  } catch {}
  return { status: response.status, body };
}

await mkdir(evidenceDirectory, { recursive: true });
try {
  docker(["down", "--volumes", "--remove-orphans"], { allowFailure: true });
  if (process.env.SDD012_SKIP_BUILD !== "1")
    docker(["build"], { timeout: 1_200_000 });
  docker(["up", "--detach", "--no-build", "--scale", "mission-worker=2"], {
    timeout: 600_000,
  });
  await waitHealthy();
  checks.freshComposeHealthy = true;
  checks.doubleWorkerHealthy =
    composeRows().filter(
      (row) => row.Service === "mission-worker" && row.Health === "healthy",
    ).length === 2;
  checks.migration15Applied =
    pg(
      "select count(*) from pgmigrations where name='000015_xhs_governed_media_artifacts'",
    ) === "1";
  execFileSync(process.execPath, ["scripts/verify-sdd012-browser.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      SDD012_WEB_URL: `http://127.0.0.1:${webPort}`,
      SDD012_API_URL: apiUrl,
    },
    timeout: 600_000,
  });
  checks.productionBrowserJourney = true;
  const counts = JSON.parse(
    pg(
      `select json_build_object('specs',(select count(*) from media_generation_specs_v2),'jobs',(select count(*) from media_generation_jobs_v2),'tasks',(select count(distinct provider_task_id) from media_generation_jobs_v2 where provider_task_id is not null),'raw',(select count(*) from media_raw_assets_v2),'final',(select count(*) from media_composited_assets_v2),'revisions',(select count(*) from artifact_revisions_v4),'audits',(select count(*) from artifact_audit_decisions_v4),'decisions',(select count(*) from artifact_owner_decisions_v4),'packages',(select count(*) from manual_publish_packages_v4),'files',(select count(*) from manual_publish_package_files_v4))::text`,
    ),
  );
  checks.concurrentAuthorityExact =
    counts.jobs === 3 &&
    counts.tasks === 3 &&
    counts.raw === 3 &&
    counts.final === 3 &&
    counts.revisions === 1 &&
    counts.audits === 1 &&
    counts.decisions === 1 &&
    counts.packages === 1 &&
    counts.files === 5;
  const workspace = (await api("/api/v1/media")).body.workspace;
  const before = {
    jobs: workspace.jobs.map((value) => [
      value.id,
      value.canonicalDigest,
      value.providerTaskId,
    ]),
    finals: workspace.finalAssets.map((value) => [
      value.id,
      value.contentDigest,
    ]),
    packages: workspace.packages.map((value) => [
      value.id,
      value.manifestDigest,
    ]),
  };
  docker(["restart", "api", "mission-worker"]);
  await waitHealthy();
  docker(["restart", "postgres", "api", "mission-worker"]);
  await waitHealthy();
  const afterWorkspace = (await api("/api/v1/media")).body.workspace;
  const after = {
    jobs: afterWorkspace.jobs.map((value) => [
      value.id,
      value.canonicalDigest,
      value.providerTaskId,
    ]),
    finals: afterWorkspace.finalAssets.map((value) => [
      value.id,
      value.contentDigest,
    ]),
    packages: afterWorkspace.packages.map((value) => [
      value.id,
      value.manifestDigest,
    ]),
  };
  checks.restartStable = JSON.stringify(before) === JSON.stringify(after);
  const zipTest = spawnSync("unzip", ["-t", packagePath], {
    encoding: "utf8",
    timeout: 30_000,
  });
  checks.zipIntegrity = zipTest.status === 0;
  const names = execFileSync("unzip", ["-Z1", packagePath], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  checks.zipExactFiles =
    [
      "image-specs.json",
      "media-lineage.json",
      "image-01.png",
      "image-02.png",
      "image-03.png",
      "manifest.json",
      "media-manifest.json",
    ].every((name) => names.includes(name)) && names.length === 7;
  const manifest = JSON.parse(
    execFileSync("unzip", ["-p", packagePath, "manifest.json"], {
      encoding: "utf8",
    }),
  );
  checks.packageFileDigests =
    manifest.files.every((file) => {
      const bytes = execFileSync("unzip", ["-p", packagePath, file.fileName]);
      return (
        bytes.byteLength === file.bytes &&
        createHash("sha256").update(bytes).digest("hex") === file.digest
      );
    }) && manifest.externalState === "UNVERIFIED_EXTERNAL_STATE";
  checks.actualPngBytes = manifest.files
    .filter((file) => /^image-\d{2}\.png$/u.test(file.fileName))
    .every(
      (file) =>
        execFileSync("unzip", ["-p", packagePath, file.fileName])
          .subarray(0, 8)
          .toString("hex") === "89504e470d0a1a0a",
    );
  const openapi = await api("/api/v1/openapi.json");
  checks.noExternalPublishMutation =
    openapi.status === 200 &&
    !/mark-published|reported-complete|"PUBLISHED"|upload-to-xiaohongshu|click-publish/iu.test(
      JSON.stringify(openapi.body),
  );
  const packageId = afterWorkspace.packages[0].id;
  const nextSnapshotCanonical = JSON.parse(
    pg(`select json_build_object('ownerId',owner_profile_id,'version',version+1,'sessionRowVersion',session_row_version+1,'sourceRevisionDigests',source_revision_digests,'profileRevisionDigests',profile_revision_digests,'itemBindings',item_bindings,'conflictDecisions',conflict_decisions,'gaps',gaps)::text from knowledge_snapshots where state='APPROVED' limit 1`),
  );
  const nextSnapshotDigest = canonicalDigest(nextSnapshotCanonical);
  pg(`with old as (select * from knowledge_snapshots where state='APPROVED' limit 1), changed as (update knowledge_snapshots s set state='SUPERSEDED' from old where s.owner_profile_id=old.owner_profile_id and s.id=old.id returning s.owner_profile_id,s.id) insert into knowledge_snapshots(owner_profile_id,id,version,state,session_row_version,canonical_digest,source_revision_digests,profile_revision_digests,item_bindings,conflict_decisions,gaps,approved_by,approved_at,created_at) select old.owner_profile_id,'019f0000-0000-7000-8000-000000000012'::uuid,old.version+1,'APPROVED',old.session_row_version+1,'${nextSnapshotDigest}',old.source_revision_digests,old.profile_revision_digests,old.item_bindings,old.conflict_decisions,old.gaps,old.owner_profile_id,now(),now() from old; insert into knowledge_snapshot_source_bindings(owner_profile_id,snapshot_id,source_revision_id,source_digest) select b.owner_profile_id,'019f0000-0000-7000-8000-000000000012'::uuid,b.source_revision_id,b.source_digest from knowledge_snapshot_source_bindings b join knowledge_snapshots s on s.owner_profile_id=b.owner_profile_id and s.id=b.snapshot_id where s.state='SUPERSEDED' order by s.approved_at desc limit 1;`);
  const staleDownload = await api(
    `/api/v1/media-publish-packages/${packageId}/download`,
  );
  checks.snapshotChangeInvalidates =
    staleDownload.status === 412 &&
    staleDownload.body.code === "MEDIA_REVISION_STALE" &&
    Number(
      pg(
        `select count(*) from media_invalidation_events_v1 where reason_code='MEDIA_KNOWLEDGE_SNAPSHOT_CHANGED'`,
      ),
    ) === 1;
  checks.noSecretInEvidence =
    !/api[_-]?key|authorization\s*:\s*bearer|sk-[a-z0-9_-]{8,}/iu.test(
      JSON.stringify({ counts, before, after, manifest }),
    );
  const failed = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failed.length > 0)
    throw new Error(`SDD012_COMPOSE_CHECKS_FAILED:${failed.join(",")}`);
  result = "PASS";
  await writeFile(
    path.join(evidenceDirectory, "compose-verification.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sdd: "SDD-012",
        classification: "PUBLIC_SAFE_SYNTHETIC",
        result,
        generatedAt: new Date().toISOString(),
        checks,
        counts,
        restart: { before, after },
        snapshotInvalidation: {
          status: staleDownload.status,
          code: staleDownload.body.code,
        },
        package: {
          names,
          manifestDigest: manifest.manifestDigest,
          zipSha256: createHash("sha256")
            .update(await readFile(packagePath))
            .digest("hex"),
        },
        externalActionCount: 0,
        events,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  failure =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : String(error);
  throw error;
} finally {
  if (process.env.SDD012_KEEP_COMPOSE !== "1")
    docker(["down", "--volumes", "--remove-orphans"], { allowFailure: true });
  if (result !== "PASS")
    await writeFile(
      path.join(evidenceDirectory, "compose-verification.json"),
      `${JSON.stringify({ schemaVersion: 1, sdd: "SDD-012", classification: "PUBLIC_SAFE_SYNTHETIC", result, generatedAt: new Date().toISOString(), checks, failure, events }, null, 2)}\n`,
    );
  console.info(
    JSON.stringify({
      status: result,
      checks: Object.keys(checks).length,
      evidence: "docs/reports/evidence/sdd-012/compose-verification.json",
    }),
  );
}
