import {Ajv} from 'ajv';
export * from './shadow-adapter.js';

export type ImageIdentity = {
  component: 'manager' | 'worker';
  tag: 'v1.2.0';
  repository: string;
  digest: `sha256:${string}`;
};

export type RuntimeMount = {
  type: 'volume' | 'tmpfs';
  target: string;
  readOnly: boolean;
};

export type RuntimeProfile = {
  id: string;
  runtime: 'agentteams';
  version: 'v1.2.0';
  endpointMode: 'isolated-profile' | 'external';
  images: ImageIdentity[];
  publishedPorts: {container: number; hostIp: '127.0.0.1'}[];
  mounts: RuntimeMount[];
  secretRefs: string[];
  security: {
    capDrop: ['ALL'];
    noNewPrivileges: true;
    readOnlyRootFilesystem: boolean;
    pidsLimit: number;
    memoryBytes: number;
    cpus: number;
    privateNetwork: true;
    healthcheck: true;
  };
};

export type TeamRole = {
  id: string;
  responsibility: string;
  orchestrationOnly: boolean;
  permissions: ('ORCHESTRATE' | 'READ_EVIDENCE' | 'PLAN' | 'PRODUCE_FOUNDER' | 'PRODUCE_PRODUCT' | 'AUDIT')[];
  skillLocks: `${string}@1.0.0`[];
};

export type TeamProfile = {
  id: string;
  runtimeVersion: 'v1.2.0';
  executionMode: 'SHADOW_PREP_ONLY';
  externalActionAllowed: false;
  modelMaturity: 'MOCK_CONFORMANCE' | 'CANARY';
  roles: TeamRole[];
};

export type RuntimeCapabilityReport = {
  schemaVersion: '1.0.0';
  kind: 'ADAPTER_CONTRACT_SMOKE';
  status: 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  probeMode: 'CONTROLLED_FIXTURE' | 'ISOLATED_RUNTIME' | 'EXTERNAL_RUNTIME';
  runtime: 'agentteams';
  requestedVersion: 'v1.2.0';
  controllerVersion: string | null;
  buildIdentity: string | null;
  liveAgentTeamRun: false;
  limitations: string[];
};

const versionResponseSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['controller'],
  properties: {
    controller: {type: 'string', minLength: 1},
    kubeMode: {type: 'string'}
  }
} as const;

const ajv = new Ajv({allErrors: true});
const validateVersionResponse = ajv.compile(versionResponseSchema);

const forbiddenMountTargets = new Set([
  '/host-share',
  '/var/run/docker.sock',
  '/run/docker.sock',
  '/root',
  '/home'
]);

export function validateRuntimeProfile(profile: RuntimeProfile): string[] {
  const errors: string[] = [];
  if (profile.version !== 'v1.2.0') errors.push('RUNTIME_VERSION_MISMATCH');
  if (profile.images.length < 2) errors.push('RUNTIME_IMAGE_SET_INCOMPLETE');

  for (const image of profile.images) {
    if (image.tag !== 'v1.2.0') errors.push(`IMAGE_TAG_MISMATCH:${image.component}`);
    if (!/^sha256:[a-f0-9]{64}$/u.test(image.digest)) {
      errors.push(`IMAGE_DIGEST_INVALID:${image.component}`);
    }
  }

  for (const mount of profile.mounts) {
    if (
      forbiddenMountTargets.has(mount.target) ||
      mount.target.startsWith('/Users/') ||
      mount.target.startsWith('/home/')
    ) {
      errors.push(`UNSAFE_MOUNT:${mount.target}`);
    }
  }

  for (const port of profile.publishedPorts) {
    if (port.hostIp !== '127.0.0.1') errors.push(`PUBLIC_HOST_PORT:${port.container}`);
    if ([8088, 8090].includes(port.container)) errors.push(`RUNTIME_INTERNAL_PORT_PUBLISHED:${port.container}`);
  }

  if (profile.secretRefs.length > 0) errors.push('REAL_SECRET_REFERENCE_NOT_ALLOWED_IN_M0');
  if (profile.security.capDrop[0] !== 'ALL') errors.push('CAPABILITIES_NOT_DROPPED');
  if (!profile.security.noNewPrivileges) errors.push('NO_NEW_PRIVILEGES_MISSING');
  if (!profile.security.healthcheck) errors.push('HEALTHCHECK_MISSING');
  if (!profile.security.privateNetwork) errors.push('PRIVATE_NETWORK_MISSING');
  if (profile.security.pidsLimit <= 0) errors.push('PIDS_LIMIT_MISSING');
  if (profile.security.memoryBytes < 64 * 1024 * 1024) errors.push('MEMORY_LIMIT_MISSING');
  if (profile.security.cpus <= 0) errors.push('CPU_LIMIT_MISSING');
  return [...new Set(errors)].sort();
}

export function validateTeamProfile(profile: TeamProfile): string[] {
  const errors: string[] = [];
  const ids = new Set(profile.roles.map((role) => role.id));
  if (ids.size !== profile.roles.length) errors.push('TEAM_ROLE_ID_DUPLICATE');
  const expectedIds = new Set(['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor']);
  if (profile.roles.length !== 6 || profile.roles.some((role) => !expectedIds.has(role.id)) || [...expectedIds].some((id) => !ids.has(id))) errors.push('TEAM_MEMBERS_NOT_EXACTLY_SIX');
  if (profile.executionMode !== 'SHADOW_PREP_ONLY' || profile.externalActionAllowed !== false) errors.push('SHADOW_BOUNDARY_INVALID');

  const leader = profile.roles.find((role) => role.id === 'presence-mission-leader');
  if (leader === undefined || !leader.orchestrationOnly || leader.permissions.length !== 1 || leader.permissions[0] !== 'ORCHESTRATE') {
    errors.push('LEADER_NOT_ORCHESTRATION_ONLY');
  }

  const producers = profile.roles.filter((role) => role.permissions.includes('PRODUCE_FOUNDER') || role.permissions.includes('PRODUCE_PRODUCT'));
  const auditors = profile.roles.filter((role) => role.permissions.includes('AUDIT'));
  if (producers.length !== 2) errors.push('PRODUCERS_NOT_EXACTLY_TWO');
  if (auditors.length !== 1) errors.push('INDEPENDENT_AUDITOR_INVALID');
  if (auditors.some((role) => role.permissions.includes('PRODUCE_FOUNDER') || role.permissions.includes('PRODUCE_PRODUCT'))) {
    errors.push('PRODUCER_AUDITOR_NOT_SEPARATE');
  }
  const expectedSkills = new Set<string>(['evidence-and-claim-grounding@1.0.0', 'campaign-strategy@1.0.0', 'account-native-expression@1.0.0', 'independent-action-audit@1.0.0', 'trace-safe-escalation@1.0.0']);
  const actualSkills = new Set<string>(profile.roles.flatMap((role) => role.skillLocks));
  if (actualSkills.size !== 5 || [...expectedSkills].some((skill) => !actualSkills.has(skill)) || [...actualSkills].some((skill) => !expectedSkills.has(skill))) errors.push('SKILL_LOCK_SET_INVALID');
  return [...new Set(errors)].sort();
}

export async function probeRuntime(
  profile: RuntimeProfile,
  endpoint: string,
  probeMode: RuntimeCapabilityReport['probeMode'],
  fetchImplementation: typeof fetch = fetch
): Promise<RuntimeCapabilityReport> {
  const profileErrors = validateRuntimeProfile(profile);
  if (profileErrors.length > 0) {
    return report('FAILED', probeMode, null, null, profileErrors);
  }

  try {
    const response = await fetchImplementation(new URL('/api/v1/version', endpoint), {
      headers: {'accept': 'application/json'},
      signal: AbortSignal.timeout(3_000)
    });
    if (!response.ok) {
      return report('FAILED', probeMode, null, null, [`RUNTIME_HTTP_${response.status}`]);
    }
    const payload: unknown = await response.json();
    if (!validateVersionResponse(payload)) {
      return report('FAILED', probeMode, null, null, ['RUNTIME_VERSION_RESPONSE_INVALID']);
    }

    const controllerVersion = (payload as {controller: string}).controller;
    const buildIdentity = controllerVersion === 'dev' ? null : controllerVersion;
    if (controllerVersion !== 'v1.2.0') {
      const status = controllerVersion === 'dev' ? 'UNKNOWN' : 'FAILED';
      return report(status, probeMode, controllerVersion, buildIdentity, [
        controllerVersion === 'dev' ? 'CONTROLLER_BUILD_IDENTITY_UNKNOWN' : 'RUNTIME_VERSION_MISMATCH',
        'NO_LIVE_AGENTTEAM_RUN'
      ]);
    }

    return report('SUCCESS', probeMode, controllerVersion, buildIdentity, [
      'CONTROLLED_ADAPTER_AND_IMAGE_CLI_SMOKE_ONLY',
      'NO_LIVE_AGENTTEAM_RUN',
      'NO_MODEL_OR_PROVIDER_CREDENTIAL'
    ]);
  } catch (error: unknown) {
    return report('FAILED', probeMode, null, null, [
      error instanceof Error && error.name === 'TimeoutError'
        ? 'RUNTIME_DEPENDENCY_TIMEOUT'
        : 'RUNTIME_DEPENDENCY_UNREACHABLE'
    ]);
  }
}

function report(
  status: RuntimeCapabilityReport['status'],
  probeMode: RuntimeCapabilityReport['probeMode'],
  controllerVersion: string | null,
  buildIdentity: string | null,
  limitations: string[]
): RuntimeCapabilityReport {
  return {
    schemaVersion: '1.0.0',
    kind: 'ADAPTER_CONTRACT_SMOKE',
    status,
    probeMode,
    runtime: 'agentteams',
    requestedVersion: 'v1.2.0',
    controllerVersion,
    buildIdentity,
    liveAgentTeamRun: false,
    limitations
  };
}
