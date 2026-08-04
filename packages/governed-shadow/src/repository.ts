import {sha256Digest} from '@lumiclaw/domain';
import {Pool, type PoolClient} from 'pg';
import {createShadowMission, ShadowContractError} from './mission.js';
import type {AuditDecision, ShadowMission, ShadowMissionRepository, StartShadowMissionInput} from './types.js';

type Idempotency = {requestDigest: string; missionId: string; responseVersion: number; responseEtag: string};

export class MemoryShadowMissionRepository implements ShadowMissionRepository {
  readonly #missions = new Map<string, ShadowMission>(); readonly #idempotency = new Map<string, Idempotency>();
  async health(): Promise<boolean> { return true; }
  async create(input: StartShadowMissionInput, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}> {
    const key = `${input.campaign.organizationId}:${input.campaign.id}:${idempotencyKey}`; const previous = this.#idempotency.get(key);
    if (previous !== undefined) {
      if (previous.requestDigest !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
      const current = this.#missions.get(previous.missionId); if (current === undefined) throw new ShadowContractError('MISSION_NOT_FOUND', previous.missionId);
      validateMemoryReplay(current, previous);
      return {mission: structuredClone(current), replayed: true};
    }
    const existing = [...this.#missions.values()].find((item) => item.organizationId === input.campaign.organizationId && item.campaignId === input.campaign.id && item.sourceCampaignDigest === input.campaignDigest);
    const mission = existing ?? createShadowMission(input); this.#missions.set(mission.id, structuredClone(mission)); this.#idempotency.set(key, {requestDigest, missionId: mission.id, responseVersion: mission.version, responseEtag: mission.etag});
    return {mission: structuredClone(mission), replayed: existing !== undefined};
  }
  async get(organizationId: string, missionId: string): Promise<ShadowMission | undefined> { const mission = this.#missions.get(missionId); return mission?.organizationId === organizationId ? structuredClone(mission) : undefined; }
  async getByCampaign(organizationId: string, campaignId: string): Promise<ShadowMission[]> { return [...this.#missions.values()].filter((item) => item.organizationId === organizationId && item.campaignId === campaignId).map((item) => structuredClone(item)); }
  async replace(mission: ShadowMission, expectedEtag: string): Promise<ShadowMission> { const current = this.#missions.get(mission.id); if (current === undefined) throw new ShadowContractError('MISSION_NOT_FOUND', mission.id); if (current.etag !== expectedEtag) throw new ShadowContractError('MISSION_VERSION_CONFLICT', 'Mission ETag is stale.'); this.#missions.set(mission.id, structuredClone(mission)); return structuredClone(mission); }
  async getIdempotentReplay(organizationId: string, route: string, idempotencyKey: string, requestDigest: string): Promise<ShadowMission | undefined> {
    const previous = this.#idempotency.get(`${organizationId}:${route}:${idempotencyKey}`);
    if (previous === undefined) return undefined;
    if (previous.requestDigest !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
    const current = this.#missions.get(previous.missionId); if (current === undefined) throw new ShadowContractError('MISSION_NOT_FOUND', previous.missionId);
    validateMemoryReplay(current, previous);
    return structuredClone(current);
  }
  async replaceIdempotent(mission: ShadowMission, expectedEtag: string, route: string, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}> {
    const key = `${mission.organizationId}:${route}:${idempotencyKey}`; const previous = this.#idempotency.get(key);
    if (previous !== undefined) {
      if (previous.requestDigest !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
      const current = this.#missions.get(previous.missionId); if (current === undefined) throw new ShadowContractError('MISSION_NOT_FOUND', previous.missionId);
      validateMemoryReplay(current, previous);
      return {mission: structuredClone(current), replayed: true};
    }
    const saved = await this.replace(mission, expectedEtag);
    this.#idempotency.set(key, {requestDigest, missionId: mission.id, responseVersion: saved.version, responseEtag: saved.etag});
    return {mission: saved, replayed: false};
  }
  async close(): Promise<void> {}
}

export class PostgresShadowMissionRepository implements ShadowMissionRepository {
  readonly #pool: Pool;
  constructor(connectionString: string) { this.#pool = new Pool({connectionString, max: 8}); this.#pool.on('error', () => console.error(JSON.stringify({code: 'POSTGRES_SHADOW_IDLE_CLIENT_ERROR'}))); }
  async health(): Promise<boolean> { const result = await this.#pool.query("select to_regclass('public.missions') as marker"); return result.rows[0]?.marker === 'missions'; }
  async create(input: StartShadowMissionInput, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}> {
    return this.#transaction(async (client) => {
      const route = `/api/v1/campaigns/${input.campaign.id}/shadow-missions`; await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`${input.campaign.organizationId}:${route}:${idempotencyKey}`]);
      const replay = await client.query('select request_digest, mission_id, response_version, response_etag from shadow_idempotency where organization_id=$1 and route=$2 and idempotency_key=$3', [input.campaign.organizationId, route, idempotencyKey]);
      if (replay.rowCount !== 0) {
        if (String(replay.rows[0].request_digest).trim() !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
        return {mission: await validateIdempotentReplay(client, input.campaign.organizationId, replay.rows[0]), replayed: true};
      }
      const existing = await client.query('select id from missions where organization_id=$1 and campaign_id=$2 and source_campaign_digest=$3', [input.campaign.organizationId, input.campaign.id, input.campaignDigest]);
      const mission = existing.rowCount === 0 ? createShadowMission(input) : (await readMission(client, input.campaign.organizationId, existing.rows[0].id as string))!;
      if (existing.rowCount === 0) await persistMission(client, mission, true);
      await client.query('insert into shadow_idempotency(organization_id,route,idempotency_key,request_digest,mission_id,response_version,response_etag) values($1,$2,$3,$4,$5,$6,$7)', [mission.organizationId, route, idempotencyKey, requestDigest, mission.id, mission.version, mission.etag]);
      return {mission, replayed: existing.rowCount !== 0};
    });
  }
  async get(organizationId: string, missionId: string): Promise<ShadowMission | undefined> { const client = await this.#pool.connect(); try { return await readMission(client, organizationId, missionId); } finally { client.release(); } }
  async getByCampaign(organizationId: string, campaignId: string): Promise<ShadowMission[]> { const client = await this.#pool.connect(); try { const result = await client.query('select id from missions where organization_id=$1 and campaign_id=$2 order by created_at desc', [organizationId, campaignId]); return (await Promise.all(result.rows.map((row) => readMission(client, organizationId, row.id as string)))).filter((mission): mission is ShadowMission => mission !== undefined); } finally { client.release(); } }
  async replace(mission: ShadowMission, expectedEtag: string): Promise<ShadowMission> { return this.#transaction(async (client) => { const locked = await client.query('select etag from missions where organization_id=$1 and id=$2 for update', [mission.organizationId, mission.id]); if (locked.rowCount === 0) throw new ShadowContractError('MISSION_NOT_FOUND', mission.id); if (locked.rows[0].etag !== expectedEtag) throw new ShadowContractError('MISSION_VERSION_CONFLICT', 'Mission ETag is stale.'); await persistMission(client, mission, false); return mission; }); }
  async getIdempotentReplay(organizationId: string, route: string, idempotencyKey: string, requestDigest: string): Promise<ShadowMission | undefined> {
    const client = await this.#pool.connect();
    try {
      const result = await client.query('select request_digest,mission_id,response_version,response_etag from shadow_idempotency where organization_id=$1 and route=$2 and idempotency_key=$3', [organizationId, route, idempotencyKey]);
      if (result.rowCount === 0) return undefined;
      if (String(result.rows[0].request_digest).trim() !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
      return await validateIdempotentReplay(client, organizationId, result.rows[0]);
    } finally { client.release(); }
  }
  async replaceIdempotent(mission: ShadowMission, expectedEtag: string, route: string, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}> {
    return this.#transaction(async (client) => {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`${mission.organizationId}:${route}:${idempotencyKey}`]);
      const replay = await client.query('select request_digest,mission_id,response_version,response_etag from shadow_idempotency where organization_id=$1 and route=$2 and idempotency_key=$3', [mission.organizationId, route, idempotencyKey]);
      if (replay.rowCount !== 0) {
        if (String(replay.rows[0].request_digest).trim() !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
        return {mission: await validateIdempotentReplay(client, mission.organizationId, replay.rows[0]), replayed: true};
      }
      const locked = await client.query('select etag from missions where organization_id=$1 and id=$2 for update', [mission.organizationId, mission.id]);
      if (locked.rowCount === 0) throw new ShadowContractError('MISSION_NOT_FOUND', mission.id);
      if (locked.rows[0].etag !== expectedEtag) throw new ShadowContractError('MISSION_VERSION_CONFLICT', 'Mission ETag is stale.');
      await persistMission(client, mission, false);
      await client.query('insert into shadow_idempotency(organization_id,route,idempotency_key,request_digest,mission_id,response_version,response_etag) values($1,$2,$3,$4,$5,$6,$7)', [mission.organizationId, route, idempotencyKey, requestDigest, mission.id, mission.version, mission.etag]);
      return {mission, replayed: false};
    });
  }
  async close(): Promise<void> { await this.#pool.end(); }
  async #transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> { const client = await this.#pool.connect(); try { await client.query('begin'); const value = await operation(client); await client.query('commit'); return value; } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); } }
}

async function validateIdempotentReplay(client: PoolClient, organizationId: string, row: Record<string, unknown>): Promise<ShadowMission> {
  const current = await readMission(client, organizationId, String(row.mission_id));
  if (current === undefined) throw new ShadowContractError('MISSION_NOT_FOUND', String(row.mission_id));
  if (current.version !== Number(row.response_version) || current.etag !== String(row.response_etag)) {
    throw new ShadowContractError('IDEMPOTENT_RESPONSE_VERSION_ADVANCED', 'The normalized Mission advanced beyond the immutable idempotency checkpoint; stale aggregate history is never replayed.');
  }
  return current;
}

function validateMemoryReplay(current: ShadowMission, replay: Idempotency): void {
  validateReconstructedMission(current);
  if (current.version !== replay.responseVersion || current.etag !== replay.responseEtag) {
    throw new ShadowContractError('IDEMPOTENT_RESPONSE_VERSION_ADVANCED', 'The Mission advanced beyond the immutable idempotency checkpoint.');
  }
}

async function readMission(client: PoolClient, organizationId: string, missionId: string): Promise<ShadowMission | undefined> {
  const result = await client.query('select organization_id,id,campaign_id,source_campaign_version,source_campaign_digest,runtime,runtime_version,runtime_project_id,state,version,etag,payload,live,external_action_allowed,created_at,updated_at from missions where organization_id=$1 and id=$2', [organizationId, missionId]);
  if (result.rowCount === 0) return undefined;
  const row = result.rows[0] as Record<string, unknown>;
  const envelope = row.payload as ShadowMission;
  const historyKeys = ['roleContexts', 'skillLocks', 'tasks', 'revisions', 'audits', 'reviews', 'trace', 'ledger', 'modelCalls', 'mediaAssets'] as const;
  if (historyKeys.some((key) => !Array.isArray(envelope[key]) || envelope[key].length !== 0)) throw new ShadowContractError('CONTROL_PLANE_HISTORY_DIVERGED', 'Mission JSON is an envelope only; normalized PostgreSQL rows are the sole history source.');
  const history = await readNormalizedHistory(client, organizationId, missionId);
  const mission = {
    ...envelope,
    organizationId: String(row.organization_id), id: String(row.id), campaignId: String(row.campaign_id),
    sourceCampaignVersion: Number(row.source_campaign_version), sourceCampaignDigest: String(row.source_campaign_digest).trim(),
    runtime: String(row.runtime), runtimeVersion: String(row.runtime_version), runtimeProjectId: String(row.runtime_project_id),
    state: String(row.state), version: Number(row.version), etag: String(row.etag), live: Boolean(row.live), externalActionAllowed: Boolean(row.external_action_allowed),
    createdAt: new Date(row.created_at as string | number | Date).toISOString(), updatedAt: new Date(row.updated_at as string | number | Date).toISOString(),
    ...history
  } as ShadowMission;
  validateReconstructedMission(mission);
  return mission;
}

async function readNormalizedHistory(client: PoolClient, organizationId: string, missionId: string): Promise<Pick<ShadowMission, 'roleContexts' | 'skillLocks' | 'tasks' | 'revisions' | 'audits' | 'reviews' | 'trace' | 'ledger' | 'modelCalls' | 'mediaAssets'>> {
  const specs = [
    ['roleContexts', 'agent_runs', 'role_id'], ['skillLocks', 'skill_locks', 'id'], ['tasks', 'agent_tasks', 'id'],
    ['revisions', 'governed_artifact_revisions', 'created_at,id'], ['audits', 'audit_decisions', 'created_at,id'], ['reviews', 'owner_reviews', 'created_at,id'],
    ['trace', 'trace_events', 'sequence'], ['ledger', 'ledger_entries', 'sequence'], ['modelCalls', 'model_calls', 'created_at,id'], ['mediaAssets', 'media_assets', 'created_at,id']
  ] as const;
  const history: Record<string, unknown[]> = {};
  for (const [key, table, order] of specs) {
    const rows = await client.query(`select payload from ${table} where organization_id=$1 and mission_id=$2 order by ${order}`, [organizationId, missionId]);
    history[key] = rows.rows.map((row) => row.payload);
  }
  const audits = history.audits as AuditDecision[];
  const superseded = new Map(audits.filter((audit) => audit.supersedesAuditId !== null).map((audit) => [audit.supersedesAuditId!, audit]));
  history.audits = audits.map((audit) => {
    const superseding = superseded.get(audit.id);
    if (superseding === undefined) return audit;
    const invalidated = {...audit, status: 'INVALIDATED' as const, invalidatedByRevisionId: superseding.revisionId, digest: ''};
    return {...invalidated, digest: sha256Digest(invalidated)};
  });
  return history as Pick<ShadowMission, 'roleContexts' | 'skillLocks' | 'tasks' | 'revisions' | 'audits' | 'reviews' | 'trace' | 'ledger' | 'modelCalls' | 'mediaAssets'>;
}

function validateReconstructedMission(mission: ShadowMission): void {
  const expectedEtag = `"mission-${mission.id}-v${mission.version}-${sha256Digest({...mission, etag: ''}).slice(0, 16)}"`;
  const traceValid = mission.trace.every((event, index) => event.missionId === mission.id && event.sequence === index + 1);
  const ledgerValid = mission.ledger.every((entry, index) => {
    const {entryDigest, ...base} = entry;
    return entry.missionId === mission.id && entry.sequence === index + 1 && entry.previousEntryDigest === (mission.ledger[index - 1]?.entryDigest ?? null) && entryDigest === sha256Digest(base);
  });
  const taskValid = mission.tasks.every((task) => task.missionId === mission.id
    && (task.inputProjectionDigest === null || /^[a-f0-9]{64}$/u.test(task.inputProjectionDigest))
    && (task.runtimeAck === null || (task.runtimeAck.taskId === task.id && task.runtimeAck.inputProjectionSchema === task.inputProjectionSchema && task.runtimeAck.inputProjectionDigest === task.inputProjectionDigest))
    && (task.runtimeSubmission === null || (task.runtimeSubmission.taskId === task.id && task.runtimeSubmission.inputProjectionSchema === task.inputProjectionSchema && task.runtimeSubmission.inputProjectionDigest === task.inputProjectionDigest)));
  if (mission.etag !== expectedEtag || !traceValid || !ledgerValid || !taskValid) throw new ShadowContractError('CONTROL_PLANE_HISTORY_DIVERGED', 'Normalized PostgreSQL history cannot reconstruct the exact Mission ETag/chain/bindings.');
}

async function persistMission(client: PoolClient, mission: ShadowMission, insert: boolean): Promise<void> {
  const envelope = missionEnvelope(mission);
  const values = [mission.organizationId, mission.id, mission.campaignId, mission.sourceCampaignVersion, mission.sourceCampaignDigest, mission.runtime, mission.runtimeVersion, mission.runtimeProjectId, mission.state, mission.version, mission.etag, envelope, mission.createdAt, mission.updatedAt];
  if (insert) await client.query('insert into missions(organization_id,id,campaign_id,source_campaign_version,source_campaign_digest,runtime,runtime_version,runtime_project_id,state,version,etag,payload,live,external_action_allowed,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,false,$13,$14)', values);
  else await client.query('update missions set state=$3,version=$4,etag=$5,payload=$6,updated_at=$7 where organization_id=$1 and id=$2', [mission.organizationId, mission.id, mission.state, mission.version, mission.etag, envelope, mission.updatedAt]);
  for (const context of mission.roleContexts) await client.query('insert into agent_runs(organization_id,mission_id,role_id,identity_id,context_digest,permissions,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(organization_id,mission_id,role_id) do update set payload=excluded.payload', [mission.organizationId, mission.id, context.roleId, context.identityId, context.contextDigest, JSON.stringify(context.permissions), context, mission.createdAt]);
  for (const lock of mission.skillLocks) await client.query('insert into skill_locks(organization_id,mission_id,id,name,version,digest,payload) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing', [mission.organizationId, mission.id, lock.id, lock.name, lock.version, lock.digest, lock]);
  for (const task of mission.tasks) await client.query('insert into agent_tasks(organization_id,mission_id,id,role_id,input_digest,skill_lock_digest,state,attempt,accepted_output_digest,payload,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(organization_id,mission_id,id) do update set input_digest=excluded.input_digest,state=excluded.state,attempt=excluded.attempt,accepted_output_digest=excluded.accepted_output_digest,payload=excluded.payload,updated_at=excluded.updated_at', [mission.organizationId, mission.id, task.id, task.roleId, task.inputDigest, task.skillLockDigest, task.state, task.attempt, task.acceptedOutputDigest, task, mission.updatedAt]);
  for (const revision of mission.revisions) await client.query('insert into governed_artifact_revisions(organization_id,mission_id,campaign_id,id,activation_unit_id,platform,revision,digest,parent_revision_id,producer_role_id,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict do nothing', [mission.organizationId, mission.id, mission.campaignId, revision.id, revision.activationUnitId, revision.platform, revision.revision, revision.digest, revision.parentRevisionId, revision.producerRoleId, revision, revision.createdAt]);
  for (const audit of mission.audits) await client.query('insert into audit_decisions(organization_id,mission_id,id,revision_id,revision_digest,auditor_identity_id,outcome,status,digest,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict do nothing', [mission.organizationId, mission.id, audit.id, audit.revisionId, audit.revisionDigest, audit.auditorIdentityId, audit.outcome, audit.status, audit.digest, audit, audit.createdAt]);
  for (const review of mission.reviews) await client.query('insert into owner_reviews(organization_id,mission_id,id,revision_id,revision_digest,decision,authority,creates_action_grant,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict do nothing', [mission.organizationId, mission.id, review.id, review.revisionId, review.revisionDigest, review.decision, review.authority, false, review, review.createdAt]);
  for (const event of mission.trace) await client.query('insert into trace_events(organization_id,mission_id,id,sequence,kind,payload,created_at) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing', [mission.organizationId, mission.id, event.id, event.sequence, event.kind, event, event.createdAt]);
  for (const entry of mission.ledger) await client.query('insert into ledger_entries(organization_id,mission_id,id,sequence,entry_digest,previous_entry_digest,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing', [mission.organizationId, mission.id, entry.id, entry.sequence, entry.entryDigest, entry.previousEntryDigest, entry, entry.createdAt]);
  for (const call of mission.modelCalls) await client.query('insert into model_calls(organization_id,mission_id,id,provider,model,input_digest,output_digest,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing', [mission.organizationId, mission.id, call.id, call.provider, call.model, call.inputDigest, call.outputDigest, call, call.createdAt]);
  for (const asset of mission.mediaAssets) await client.query('insert into media_assets(organization_id,mission_id,id,content_digest,provider,approval_state,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing', [mission.organizationId, mission.id, asset.id, asset.contentDigest, asset.provider, asset.approvalState, asset, asset.createdAt]);
  if (sha256Digest(missionPublicNoAction(mission)) !== sha256Digest({externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0})) throw new ShadowContractError('EXTERNAL_ACTION_BOUNDARY_VIOLATION', 'Mission persistence rejected an action-capable state.');
  const reconstructed = await readMission(client, mission.organizationId, mission.id);
  if (reconstructed === undefined || sha256Digest(reconstructed) !== sha256Digest(mission)) throw new ShadowContractError('CONTROL_PLANE_HISTORY_DIVERGED', 'Normalized PostgreSQL rows did not reconstruct the exact persisted Mission.');
}

function missionPublicNoAction(mission: ShadowMission) { return {externalActionAllowed: mission.externalActionAllowed, actionGrantCount: mission.actionGrantCount, connectorCount: mission.connectorCount, externalActionCount: mission.externalActionCount}; }

function missionEnvelope(mission: ShadowMission): ShadowMission {
  return {...structuredClone(mission), roleContexts: [] as unknown as ShadowMission['roleContexts'], skillLocks: [] as unknown as ShadowMission['skillLocks'], tasks: [] as unknown as ShadowMission['tasks'], revisions: [], audits: [], reviews: [], trace: [], ledger: [], modelCalls: [], mediaAssets: []};
}
