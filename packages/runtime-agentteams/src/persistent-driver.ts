import {
  AGENTTEAMS_IMAGE_DIGESTS,
  AGENTTEAMS_RUNTIME_VERSION,
  AGENTTEAMS_SOURCE_COMMIT,
  AGENTTEAMS_SOURCE_TAR_SHA256,
  AGENTTEAMS_TEAM_PROFILE_DIGEST,
  AGENTTEAMS_TEAM_PROFILE_ID,
  AGENTTEAMS_TEAM_PROFILE_VERSION,
  GOAL_ROLE_IDS,
  PersistentRuntimeError,
  sha256Digest,
  type MissionJob,
  type MissionRun,
  type RuntimeBinding,
  type RuntimeTaskContract,
} from "@lumiclaw/domain";
import { spawn } from "node:child_process";

const leader = "presence-mission-leader";
const teamName = "sdd002-governed-shadow";
type ToolResult = {
  ok?: boolean;
  error?: unknown;
  effective?: boolean;
  verified?: boolean;
  task?: Record<string, unknown>;
  tasks?: unknown[];
};
type Worker = {
  name: string;
  phase: string;
  runtime: string;
  matrixUserID?: string;
};
type Team = Record<string, unknown>;
type RuntimeImageComponent = "controller" | "manager" | "worker";
export type RuntimeImageObservation = {
  containerName: string;
  component: RuntimeImageComponent;
  imageId: string;
  configuredImage: string;
  repoDigests: string[];
};
export type AgentTeamsRuntimeIdentityEvidence = {
  method: "DOCKER_INSPECT_REPODIGEST_AND_EXACT_TOPOLOGY_V1";
  verified: boolean;
  mismatches: string[];
  expected: {
    runtimeVersion: typeof AGENTTEAMS_RUNTIME_VERSION;
    sourceCommit: typeof AGENTTEAMS_SOURCE_COMMIT;
    sourceTarSha256: typeof AGENTTEAMS_SOURCE_TAR_SHA256;
    teamProfile: {
      id: typeof AGENTTEAMS_TEAM_PROFILE_ID;
      version: typeof AGENTTEAMS_TEAM_PROFILE_VERSION;
      digest: typeof AGENTTEAMS_TEAM_PROFILE_DIGEST;
    };
    topologyDigest: string;
    imageDigests: typeof AGENTTEAMS_IMAGE_DIGESTS;
  };
  actual: {
    versionProbeDigest: string;
    teamName: string | null;
    leaderName: string | null;
    roleIds: string[];
    topologyDigest: string;
    images: RuntimeImageObservation[];
  };
};
const imageRepositories = {
  controller:
    "higress-registry.cn-hangzhou.cr.aliyuncs.com/agentteams/agentteams-embedded",
  manager:
    "higress-registry.cn-hangzhou.cr.aliyuncs.com/agentteams/agentteams-manager-copaw",
  worker:
    "higress-registry.cn-hangzhou.cr.aliyuncs.com/agentteams/agentteams-copaw-worker",
} as const;
const expectedTopology = {
  teamName,
  leaderName: leader,
  roleIds: [...GOAL_ROLE_IDS].sort(),
};
const expectedTopologyDigest = sha256Digest(expectedTopology);

export interface PersistentAgentTeamsDriver {
  readiness(): Promise<{
    state: "READY" | "INCOMPATIBLE" | "UNREACHABLE";
    reasonCode: string | null;
    memberCount: number;
    runtimeVersion: string;
    runtimeDigest: string;
    sourceCommit: string;
    sourceTarSha256: string;
    teamProfileVersion: string;
    teamProfileDigest: string;
    identityEvidence: AgentTeamsRuntimeIdentityEvidence | null;
  }>;
  ensureBinding(
    run: MissionRun,
    jobs: MissionJob[],
    now: Date,
  ): Promise<RuntimeBinding>;
  dispatch(
    binding: RuntimeBinding,
    contract: RuntimeTaskContract,
  ): Promise<{ runtimeTaskId: string; runtimeActorId: string }>;
  acknowledge(
    contract: RuntimeTaskContract,
    runtimeActorId: string,
  ): Promise<void>;
  generate(
    contract: RuntimeTaskContract,
    runtimeActorId: string,
    gatewayOrigin: string,
    ticket: string,
    body: Record<string, unknown>,
  ): Promise<{ value: unknown; outputDigest: string; controlledFake: boolean }>;
  submit(
    contract: RuntimeTaskContract,
    runtimeActorId: string,
    payload: unknown,
  ): Promise<{ payload: unknown; submittedAt: string }>;
  complete(binding: RuntimeBinding, runtimeTaskId: string): Promise<void>;
  observe(
    binding: RuntimeBinding,
  ): Promise<{
    knownRuntimeTaskIds: string[];
    submittedOutputDigests: string[];
  }>;
  observeSubmission(
    binding: RuntimeBinding,
    contract: RuntimeTaskContract,
  ): Promise<
    | { state: "MISSING" }
    | { state: "SUBMITTED" | "COMPLETED"; payload: unknown; outputDigest: string; submittedAt: string }
  >;
}

export class DockerAgentTeamsV120Driver implements PersistentAgentTeamsDriver {
  public constructor(
    private readonly docker = "docker",
    private readonly controller = "agentteams-controller",
    private readonly operationTimeoutMs = 120_000,
    private readonly terminateGraceMs = 2_000,
  ) {}
  public async readiness() {
    const identity = {
      runtimeVersion: AGENTTEAMS_RUNTIME_VERSION,
      runtimeDigest: AGENTTEAMS_SOURCE_TAR_SHA256,
      sourceCommit: AGENTTEAMS_SOURCE_COMMIT,
      sourceTarSha256: AGENTTEAMS_SOURCE_TAR_SHA256,
      teamProfileVersion: AGENTTEAMS_TEAM_PROFILE_VERSION,
      teamProfileDigest: AGENTTEAMS_TEAM_PROFILE_DIGEST,
    };
    try {
      const { workers, evidence } = await this.topology(false);
      if (!evidence.verified)
        return {
          ...identity,
          state: "INCOMPATIBLE" as const,
          reasonCode: "RUNTIME_VERSION_INCOMPATIBLE",
          memberCount: workers.length,
          identityEvidence: evidence,
        };
      return {
        ...identity,
        state: "READY" as const,
        reasonCode: null,
        memberCount: workers.length,
        identityEvidence: evidence,
      };
    } catch {
      return {
        ...identity,
        state: "UNREACHABLE" as const,
        reasonCode: "RUNTIME_UNREACHABLE",
        memberCount: 0,
        identityEvidence: null,
      };
    }
  }
  public async ensureBinding(
    run: MissionRun,
    jobs: MissionJob[],
    now: Date,
  ): Promise<RuntimeBinding> {
    const { workers, team } = await this.topology();
    if (workers.length !== 6 || team === undefined)
      throw new PersistentRuntimeError("RUNTIME_VERSION_INCOMPATIBLE");
    stringField(team, "teamRoomID");
    const projectId = run.id;
    const created = await this.callTool(
      leader,
      "projectflow",
      "create_project",
      {
        projectId,
        title: `LumiClaw Mission ${run.id}`,
        source: run.bundleDigest,
        requester: "lumiclaw-postgresql-control-plane",
      },
    );
    if (
      created.ok !== true &&
      !String(created.error).includes("already exists")
    )
      throw new PersistentRuntimeError(
        "RUNTIME_UNREACHABLE",
        "AGENTTEAMS_PROJECT_CREATE_FAILED",
      );
    if (created.ok === true) {
      const tasks = jobs.map((job) => ({
        taskId: job.taskContractId,
        title: `${job.kind}:${job.roleId}`,
        assignedTo: job.roleId,
        taskKind: job.kind,
        attempt: 1,
        dependsOn: job.dependencyIds,
      }));
      const planned = await this.callTool(leader, "projectflow", "plan_dag", {
        projectId,
        tasks,
      });
      if (
        planned.ok !== true ||
        !Array.isArray(planned.tasks) ||
        planned.tasks.length !== jobs.length
      )
        throw new PersistentRuntimeError(
          "RUNTIME_UNREACHABLE",
          "AGENTTEAMS_DAG_PLAN_FAILED",
        );
    } else await this.assertExistingProject(projectId, jobs);
    const memberBindings = GOAL_ROLE_IDS.map((roleId) => {
      const worker = workers.find((item) => item.name === roleId);
      if (worker?.matrixUserID === undefined)
        throw new PersistentRuntimeError(
          "RUNTIME_VERSION_INCOMPATIBLE",
          "AGENTTEAMS_ACTOR_MISSING",
        );
      return { roleId, runtimeActorId: worker.matrixUserID };
    });
    return {
      schemaVersion: 1,
      runId: run.id,
      runtimeInstanceId: this.controller,
      runtimeProjectId: projectId,
      teamProfileVersion: run.runtimeRequirement.teamProfileVersion,
      teamProfileDigest: run.runtimeRequirement.teamProfileDigest,
      runtimeVersion: AGENTTEAMS_RUNTIME_VERSION,
      runtimeDigest: AGENTTEAMS_SOURCE_TAR_SHA256,
      memberBindings,
      state: "BOUND",
      boundAt: now.toISOString(),
      lastObservedAt: now.toISOString(),
    };
  }
  public async dispatch(
    binding: RuntimeBinding,
    contract: RuntimeTaskContract,
  ) {
    const actor = binding.memberBindings.find(
      (item) => item.roleId === contract.roleId,
    )?.runtimeActorId;
    if (actor === undefined)
      throw new PersistentRuntimeError("RUNTIME_VERSION_INCOMPATIBLE");
    const team = await this.team();
    const checked = await this.callTool(leader, "taskflow", "check_task", {
      taskId: contract.taskId,
    });
    if (checked.ok === true && checked.effective === true)
      throw new PersistentRuntimeError(
        "RECOVERY_REVIEW_REQUIRED",
        "AGENTTEAMS_TASK_ALREADY_SUBMITTED",
      );
    const delegated = await this.callTool(leader, "taskflow", "delegate_task", {
      projectId: binding.runtimeProjectId,
      taskId: contract.taskId,
      roomId: stringField(team, "teamRoomID"),
      spec: JSON.stringify(contract),
    });
    if (delegated.ok !== true && !String(delegated.error).includes("already"))
      throw new PersistentRuntimeError(
        "RUNTIME_UNREACHABLE",
        "AGENTTEAMS_TASK_DELEGATE_FAILED",
      );
    return { runtimeTaskId: contract.taskId, runtimeActorId: actor };
  }
  public async acknowledge(
    contract: RuntimeTaskContract,
    runtimeActorId: string,
  ) {
    const checked = await this.callTool(leader, "taskflow", "check_task", {
      taskId: contract.taskId,
    });
    if (checked.ok === true && checked.task?.status === "in_progress") return;
    const result = await this.callTool(
      contract.roleId,
      "taskflow",
      "ack_task",
      { taskId: contract.taskId },
      runtimeActorId,
    );
    if (result.ok !== true || result.task?.status !== "in_progress")
      throw new PersistentRuntimeError("TASK_ACK_TIMEOUT");
  }
  public async generate(
    contract: RuntimeTaskContract,
    runtimeActorId: string,
    gatewayOrigin: string,
    ticket: string,
    body: Record<string, unknown>,
  ) {
    const origin = allowedGatewayOrigin(gatewayOrigin);
    if (
      body.runtimeActorId !== runtimeActorId ||
      body.taskId !== contract.taskId
    )
      throw new PersistentRuntimeError("SUBMISSION_INPUT_MISMATCH");
    const code =
      'import json,sys,urllib.request; x=json.load(sys.stdin); data=json.dumps(x["body"],separators=(",",":"),ensure_ascii=False).encode(); req=urllib.request.Request(x["url"]+"/internal/v1/generate",data=data,headers={"content-type":"application/json","x-lumiclaw-model-ticket":x["ticket"]}); response=urllib.request.urlopen(req,timeout=90); print(response.read().decode())';
    const raw = await this.exec(
      [
        "exec",
        "-i",
        "-e",
        `AGENTTEAMS_MATRIX_USER_ID=${runtimeActorId}`,
        "-w",
        workspace(contract.roleId),
        `agentteams-worker-${contract.roleId}`,
        "/opt/venv/standard/bin/python",
        "-c",
        code,
      ],
      JSON.stringify({ url: origin, ticket, body }),
    );
    const value = JSON.parse(raw) as {
      ok?: unknown;
      value?: unknown;
      outputDigest?: unknown;
      controlledFake?: unknown;
    };
    if (
      value.ok !== true ||
      typeof value.outputDigest !== "string" ||
      value.outputDigest !== sha256Digest(value.value) ||
      typeof value.controlledFake !== "boolean"
    )
      throw new PersistentRuntimeError("MODEL_PROVIDER_FAILED");
    return {
      value: value.value,
      outputDigest: value.outputDigest,
      controlledFake: value.controlledFake,
    };
  }
  public async submit(
    contract: RuntimeTaskContract,
    runtimeActorId: string,
    payload: unknown,
  ) {
    const outputDigest = sha256Digest(payload);
    const result = await this.callTool(
      contract.roleId,
      "taskflow",
      "submit_task",
      {
        taskId: contract.taskId,
        status: "SUCCESS",
        summary: JSON.stringify({ schemaVersion: 1, payload, outputDigest }),
        deliverables: [],
        notes: [
          "REAL_AGENTTEAMS_V1_2_0_TASK_PROTOCOL",
          "MODEL_GATEWAY_OUTPUT",
          "NO_EXTERNAL_ACTION",
        ],
      },
      runtimeActorId,
    );
    if (
      result.ok !== true ||
      result.verified !== true ||
      result.task?.status !== "submitted"
    )
      throw new PersistentRuntimeError("TASK_SUBMIT_TIMEOUT");
    const checked = await this.callTool(leader, "taskflow", "check_task", {
      taskId: contract.taskId,
    });
    if (
      checked.ok !== true ||
      checked.effective !== true ||
      checked.task?.status !== "submitted"
    )
      throw new PersistentRuntimeError("TASK_SUBMIT_TIMEOUT");
    const persisted = await this.readTaskResult(
      contract.roleId,
      contract.taskId,
    );
    if (
      persisted === undefined ||
      sha256Digest(persisted.payload) !== outputDigest ||
      persisted.outputDigest !== outputDigest
    )
      throw new PersistentRuntimeError(
        "SUBMISSION_INPUT_MISMATCH",
        "AGENTTEAMS_PERSISTED_RESULT_MISMATCH",
      );
    return {
      payload: persisted.payload,
      submittedAt: dateField(result.task, "submitted_at"),
    };
  }
  public async complete(binding: RuntimeBinding, runtimeTaskId: string) {
    const code =
      'import sys; from copaw_worker.task import FileSystemTaskStore,parse_dag_tasks,_replace_task_status,replace_dag_tasks; s=FileSystemTaskStore(); p=s.read_project_plan(sys.argv[1]); s.write_project_plan(sys.argv[1],replace_dag_tasks(p,_replace_task_status(parse_dag_tasks(p),sys.argv[2],"completed"))); print("accepted")';
    await this.exec([
      "exec",
      "-w",
      workspace(leader),
      `agentteams-worker-${leader}`,
      "/opt/venv/standard/bin/python",
      "-c",
      code,
      binding.runtimeProjectId,
      runtimeTaskId,
    ]);
  }
  public async observe(binding: RuntimeBinding) {
    const code =
      'import json,sys; from copaw_worker.task import FileSystemTaskStore,parse_dag_tasks; s=FileSystemTaskStore(); p=s.read_project_plan(sys.argv[1]); print(json.dumps([{"taskId":t.task_id,"status":t.status,"assignedTo":t.assigned_to} for t in parse_dag_tasks(p)]))';
    const rows = JSON.parse(
      await this.exec([
        "exec",
        "-w",
        workspace(leader),
        `agentteams-worker-${leader}`,
        "/opt/venv/standard/bin/python",
        "-c",
        code,
        binding.runtimeProjectId,
      ]),
    ) as Array<{
      taskId: string;
      status: string;
      assignedTo: string;
    }>;
    const allowedRoles = new Set(
      binding.memberBindings.map((item) => item.roleId),
    );
    if (
      rows.some(
        (row) =>
          !allowedRoles.has(row.assignedTo as (typeof GOAL_ROLE_IDS)[number]),
      )
    )
      throw new PersistentRuntimeError(
        "RUNTIME_VERSION_INCOMPATIBLE",
        "AGENTTEAMS_OBSERVED_TASK_ACTOR_MISMATCH",
      );
    const persistedResults = await Promise.all(
      rows.map((row) => this.readTaskResult(row.assignedTo, row.taskId)),
    );
    const submittedOutputDigests: string[] = [];
    for (const parsed of persistedResults) {
      if (parsed !== undefined)
        submittedOutputDigests.push(parsed.outputDigest);
    }
    return {
      knownRuntimeTaskIds: rows.map((row) => row.taskId),
      submittedOutputDigests,
    };
  }
  public async observeSubmission(
    binding: RuntimeBinding,
    contract: RuntimeTaskContract,
  ) {
    if (binding.runId !== contract.runId)
      throw new PersistentRuntimeError("SUBMISSION_INPUT_MISMATCH");
    const checked = await this.callTool(leader, "taskflow", "check_task", {
      taskId: contract.taskId,
    });
    const status = checked.task?.status;
    const persisted = await this.readTaskResult(contract.roleId, contract.taskId);
    if (persisted === undefined) return { state: "MISSING" as const };
    if (status !== "submitted" && status !== "completed")
      throw new PersistentRuntimeError(
        "SUBMISSION_INPUT_MISMATCH",
        "AGENTTEAMS_RESULT_WITHOUT_SUBMITTED_STATE",
      );
    return {
      state: status === "completed" ? ("COMPLETED" as const) : ("SUBMITTED" as const),
      payload: persisted.payload,
      outputDigest: persisted.outputDigest,
      submittedAt: dateField(checked.task, "submitted_at"),
    };
  }
  private async topology(requireVerified = true) {
    const workersDoc = JSON.parse(
      await this.exec([
        "exec",
        this.controller,
        "agt",
        "get",
        "workers",
        "-o",
        "json",
      ]),
    ) as { total: number; workers: Worker[] };
    const teamsDoc = JSON.parse(
      await this.exec([
        "exec",
        this.controller,
        "agt",
        "get",
        "teams",
        "-o",
        "json",
      ]),
    ) as { teams: Team[] };
    const workers = workersDoc.workers.filter((worker) =>
      GOAL_ROLE_IDS.includes(worker.name as (typeof GOAL_ROLE_IDS)[number]),
    );
    const team = teamsDoc.teams.find((item) => item.name === teamName);
    const images = await Promise.all(
      [
        { containerName: this.controller, component: "controller" as const },
        { containerName: "agentteams-manager", component: "manager" as const },
        ...GOAL_ROLE_IDS.map((roleId) => ({
          containerName: `agentteams-worker-${roleId}`,
          component: "worker" as const,
        })),
      ].map((item) => this.inspectImage(item.containerName, item.component)),
    );
    const versionProbe = await this.exec([
      "exec",
      this.controller,
      "agt",
      "version",
    ]);
    const evidence = verifyAgentTeamsRuntimeIdentity({
      workersTotal: workersDoc.total,
      workers,
      team,
      images,
      versionProbe,
    });
    if (requireVerified && !evidence.verified)
      throw new PersistentRuntimeError(
        "RUNTIME_VERSION_INCOMPATIBLE",
        evidence.mismatches.join(","),
      );
    return { workers, team, evidence };
  }
  private async team() {
    const result = await this.topology();
    if (result.team === undefined)
      throw new PersistentRuntimeError("RUNTIME_VERSION_INCOMPATIBLE");
    return result.team;
  }
  private async inspectImage(
    containerName: string,
    component: RuntimeImageComponent,
  ): Promise<RuntimeImageObservation> {
    const containers = JSON.parse(
      await this.exec(["container", "inspect", containerName]),
    ) as Array<{ Image?: unknown; Config?: { Image?: unknown } }>;
    const container = containers[0];
    if (
      typeof container?.Image !== "string" ||
      typeof container.Config?.Image !== "string"
    )
      throw new PersistentRuntimeError(
        "RUNTIME_UNREACHABLE",
        "DOCKER_CONTAINER_IDENTITY_UNAVAILABLE",
      );
    const images = JSON.parse(
      await this.exec(["image", "inspect", container.Image]),
    ) as Array<{ Id?: unknown; RepoDigests?: unknown }>;
    const image = images[0];
    if (
      typeof image?.Id !== "string" ||
      !Array.isArray(image.RepoDigests) ||
      image.RepoDigests.some((item) => typeof item !== "string")
    )
      throw new PersistentRuntimeError(
        "RUNTIME_UNREACHABLE",
        "DOCKER_IMAGE_IDENTITY_UNAVAILABLE",
      );
    return {
      containerName,
      component,
      imageId: image.Id,
      configuredImage: container.Config.Image,
      repoDigests: [...image.RepoDigests] as string[],
    };
  }
  private async assertExistingProject(projectId: string, jobs: MissionJob[]) {
    const code =
      "import json,sys; from dataclasses import asdict; from copaw_worker.task import FileSystemTaskStore,parse_dag_tasks; s=FileSystemTaskStore(); print(json.dumps([asdict(x) for x in parse_dag_tasks(s.read_project_plan(sys.argv[1]))]))";
    const tasks = JSON.parse(
      await this.exec([
        "exec",
        "-w",
        workspace(leader),
        `agentteams-worker-${leader}`,
        "/opt/venv/standard/bin/python",
        "-c",
        code,
        projectId,
      ]),
    ) as Array<{ task_id: string; assigned_to: string }>;
    if (
      tasks.length !== jobs.length ||
      jobs.some(
        (job) =>
          !tasks.some(
            (task) =>
              task.task_id === job.taskContractId &&
              task.assigned_to === job.roleId,
          ),
      )
    )
      throw new PersistentRuntimeError(
        "RUNTIME_VERSION_INCOMPATIBLE",
        "AGENTTEAMS_EXISTING_DAG_MISMATCH",
      );
  }
  private async readTaskResult(role: string, taskId: string) {
    const code =
      'import json,sys; from dataclasses import asdict; from copaw_worker.task import FileSystemTaskStore,TaskflowError; s=FileSystemTaskStore();\ntry: print(json.dumps(asdict(s.read_task_result(sys.argv[1]))))\nexcept TaskflowError: print("null")';
    const value = JSON.parse(
      await this.exec([
        "exec",
        "-w",
        workspace(role),
        `agentteams-worker-${role}`,
        "/opt/venv/standard/bin/python",
        "-c",
        code,
        taskId,
      ]),
    ) as { summary?: string } | null;
    return parseSummary(value?.summary);
  }
  private async callTool(
    role: string,
    tool: string,
    action: string,
    payload: unknown,
    actor?: string,
  ): Promise<ToolResult> {
    const modulePath = `copaw_worker.hooks.tools.${tool}`;
    const code = `import asyncio,json,sys; from ${modulePath} import ${tool}; payload=json.load(sys.stdin); response=asyncio.run(${tool}(sys.argv[1],payload)); print(response.content[0]["text"])`;
    const args = [
      "exec",
      "-i",
      ...(actor === undefined
        ? []
        : ["-e", `AGENTTEAMS_MATRIX_USER_ID=${actor}`]),
      "-w",
      workspace(role),
      `agentteams-worker-${role}`,
      "/opt/venv/standard/bin/python",
      "-c",
      code,
      action,
    ];
    return JSON.parse(
      await this.exec(args, JSON.stringify(payload)),
    ) as ToolResult;
  }
  private async exec(args: string[], input?: string): Promise<string> {
    return runBoundedProcess(
      this.docker,
      args,
      input,
      this.operationTimeoutMs,
      this.terminateGraceMs,
    );
  }
}

export function runBoundedProcess(
  command: string,
  args: string[],
  input: string | undefined,
  timeoutMs: number,
  terminateGraceMs: number,
): Promise<string> {
  if (timeoutMs < 1 || terminateGraceMs < 1)
    throw new PersistentRuntimeError(
      "SUBMISSION_SCHEMA_INVALID",
      "AGENTTEAMS_OPERATION_TIMEOUT_INVALID",
    );
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), terminateGraceMs);
      killTimer.unref();
    }, timeoutMs);
    timeout.unref();
    const finish = () => {
      clearTimeout(timeout);
      if (killTimer !== undefined) clearTimeout(killTimer);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", () => {
      finish();
      reject(new PersistentRuntimeError("RUNTIME_UNREACHABLE"));
    });
    child.once("close", (code) => {
      finish();
      if (timedOut)
        reject(
          new PersistentRuntimeError(
            "RUNTIME_UNREACHABLE",
            "AGENTTEAMS_OPERATION_TIMEOUT",
          ),
        );
      else if (code === 0) resolve(stdout.trim());
      else
        reject(
          new PersistentRuntimeError(
            "RUNTIME_UNREACHABLE",
            stderr.trim() || `DOCKER_EXIT_${code}`,
          ),
        );
    });
    if (input === undefined) child.stdin.end();
    else child.stdin.end(input);
  });
}

export function verifyAgentTeamsRuntimeIdentity(input: {
  workersTotal: number;
  workers: Worker[];
  team: Team | undefined;
  images: RuntimeImageObservation[];
  versionProbe: string;
}): AgentTeamsRuntimeIdentityEvidence {
  const mismatches: string[] = [];
  const roleIds = input.workers.map((worker) => worker.name).sort();
  const members = Array.isArray(input.team?.workerMembers)
    ? input.team.workerMembers
    : [];
  const leaderMember = members.find(
    (member) => record(member) && member.role === "team_leader",
  );
  const leaderName =
    record(leaderMember) && typeof leaderMember.name === "string"
      ? leaderMember.name
      : null;
  const teamNameActual =
    typeof input.team?.name === "string" ? input.team.name : null;
  const topology = { teamName: teamNameActual, leaderName, roleIds };
  const topologyDigest = sha256Digest(topology);
  if (
    input.workersTotal !== 6 ||
    input.workers.length !== 6 ||
    roleIds.join(",") !== [...GOAL_ROLE_IDS].sort().join(",")
  )
    mismatches.push("EXACT_SIX_ROLE_TOPOLOGY_MISMATCH");
  if (
    input.workers.some(
      (worker) =>
        worker.phase !== "Running" ||
        worker.runtime !== "copaw" ||
        typeof worker.matrixUserID !== "string" ||
        worker.matrixUserID.length === 0,
    )
  )
    mismatches.push("WORKER_RUNTIME_IDENTITY_MISMATCH");
  if (
    teamNameActual !== teamName ||
    input.team?.phase !== "Active" ||
    input.team?.leaderReady !== true ||
    input.team?.readyWorkers !== 5 ||
    input.team?.totalWorkers !== 5 ||
    members.length !== 6 ||
    leaderName !== leader ||
    members
      .filter(record)
      .map((member) => String(member.name))
      .sort()
      .join(",") !== expectedTopology.roleIds.join(",")
  )
    mismatches.push("TEAM_PROFILE_TOPOLOGY_MISMATCH");
  if (topologyDigest !== expectedTopologyDigest)
    mismatches.push("TEAM_PROFILE_DIGEST_MISMATCH");
  if (input.versionProbe.trim().length === 0)
    mismatches.push("VERSION_PROBE_EMPTY");
  const expectedCounts: Record<RuntimeImageComponent, number> = {
    controller: 1,
    manager: 1,
    worker: 6,
  };
  for (const component of ["controller", "manager", "worker"] as const) {
    const observations = input.images.filter(
      (image) => image.component === component,
    );
    if (observations.length !== expectedCounts[component]) {
      mismatches.push(`IMAGE_COUNT_MISMATCH:${component}`);
      continue;
    }
    const repository = imageRepositories[component];
    const digest = AGENTTEAMS_IMAGE_DIGESTS[component];
    for (const observation of observations) {
      if (!/^sha256:[a-f0-9]{64}$/u.test(observation.imageId))
        mismatches.push(
          `IMAGE_ID_INVALID:${component}:${observation.containerName}`,
        );
      if (
        !observation.configuredImage.startsWith(repository) ||
        !observation.repoDigests.includes(`${repository}@${digest}`)
      )
        mismatches.push(
          `IMAGE_DIGEST_MISMATCH:${component}:${observation.containerName}`,
        );
    }
  }
  return {
    method: "DOCKER_INSPECT_REPODIGEST_AND_EXACT_TOPOLOGY_V1",
    verified: mismatches.length === 0,
    mismatches: [...new Set(mismatches)].sort(),
    expected: {
      runtimeVersion: AGENTTEAMS_RUNTIME_VERSION,
      sourceCommit: AGENTTEAMS_SOURCE_COMMIT,
      sourceTarSha256: AGENTTEAMS_SOURCE_TAR_SHA256,
      teamProfile: {
        id: AGENTTEAMS_TEAM_PROFILE_ID,
        version: AGENTTEAMS_TEAM_PROFILE_VERSION,
        digest: AGENTTEAMS_TEAM_PROFILE_DIGEST,
      },
      topologyDigest: expectedTopologyDigest,
      imageDigests: AGENTTEAMS_IMAGE_DIGESTS,
    },
    actual: {
      versionProbeDigest: sha256Digest({
        versionProbe: input.versionProbe.trim(),
      }),
      teamName: teamNameActual,
      leaderName,
      roleIds,
      topologyDigest,
      images: input.images.map((image) => ({
        ...image,
        repoDigests: [...image.repoDigests],
      })),
    },
  };
}

function workspace(role: string) {
  return `/root/.copaw-worker/${role}/.copaw/workspaces/default`;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringField(value: Record<string, unknown>, key: string) {
  const result = value[key];
  if (typeof result !== "string" || result.length === 0)
    throw new PersistentRuntimeError("RUNTIME_VERSION_INCOMPATIBLE");
  return result;
}
function dateField(value: Record<string, unknown> | undefined, key: string) {
  const result = value?.[key];
  if (typeof result !== "string" || Number.isNaN(Date.parse(result)))
    throw new PersistentRuntimeError("TASK_SUBMIT_TIMEOUT");
  return new Date(result).toISOString();
}
function parseSummary(
  value: unknown,
): { payload: unknown; outputDigest: string } | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value) as {
      schemaVersion?: unknown;
      payload?: unknown;
      outputDigest?: unknown;
    };
    return parsed.schemaVersion === 1 && typeof parsed.outputDigest === "string"
      ? { payload: parsed.payload, outputDigest: parsed.outputDigest }
      : undefined;
  } catch {
    return undefined;
  }
}
function allowedGatewayOrigin(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "host.docker.internal" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.port === "" ||
    Number(url.port) < 1 ||
    Number(url.port) > 65535
  )
    throw new PersistentRuntimeError(
      "RUNTIME_UNREACHABLE",
      "MODEL_GATEWAY_ORIGIN_NOT_ALLOWLISTED",
    );
  return url.origin;
}
