import {sha256Digest} from '@lumiclaw/domain';
import {Pool, type PoolClient} from 'pg';
import {createShadowMission, ShadowContractError} from './mission.js';
import type {ShadowMission, ShadowMissionRepository, StartShadowMissionInput} from './types.js';

type Idempotency = {requestDigest: string; missionId: string; response: ShadowMission};

export class MemoryShadowMissionRepository implements ShadowMissionRepository {
  readonly #missions = new Map<string, ShadowMission>(); readonly #idempotency = new Map<string, Idempotency>();
  async health(): Promise<boolean> { return true; }
  async create(input: StartShadowMissionInput, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}> {
    const key = `${input.campaign.organizationId}:${input.campaign.id}:${idempotencyKey}`; const previous = this.#idempotency.get(key);
    if (previous !== undefined) {
      if (previous.requestDigest !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
      return {mission: structuredClone(previous.response), replayed: true};
    }
    const existing = [...this.#missions.values()].find((item) => item.organizationId === input.campaign.organizationId && item.campaignId === input.campaign.id && item.sourceCampaignDigest === input.campaignDigest);
    const mission = existing ?? createShadowMission(input); this.#missions.set(mission.id, structuredClone(mission)); this.#idempotency.set(key, {requestDigest, missionId: mission.id, response: structuredClone(mission)});
    return {mission: structuredClone(mission), replayed: existing !== undefined};
  }
  async get(organizationId: string, missionId: string): Promise<ShadowMission | undefined> { const mission = this.#missions.get(missionId); return mission?.organizationId === organizationId ? structuredClone(mission) : undefined; }
  async getByCampaign(organizationId: string, campaignId: string): Promise<ShadowMission[]> { return [...this.#missions.values()].filter((item) => item.organizationId === organizationId && item.campaignId === campaignId).map((item) => structuredClone(item)); }
  async replace(mission: ShadowMission, expectedEtag: string): Promise<ShadowMission> { const current = this.#missions.get(mission.id); if (current === undefined) throw new ShadowContractError('MISSION_NOT_FOUND', mission.id); if (current.etag !== expectedEtag) throw new ShadowContractError('MISSION_VERSION_CONFLICT', 'Mission ETag is stale.'); this.#missions.set(mission.id, structuredClone(mission)); return structuredClone(mission); }
  async getIdempotentReplay(organizationId: string, route: string, idempotencyKey: string, requestDigest: string): Promise<ShadowMission | undefined> {
    const previous = this.#idempotency.get(`${organizationId}:${route}:${idempotencyKey}`);
    if (previous === undefined) return undefined;
    if (previous.requestDigest !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
    return structuredClone(previous.response);
  }
  async replaceIdempotent(mission: ShadowMission, expectedEtag: string, route: string, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}> {
    const key = `${mission.organizationId}:${route}:${idempotencyKey}`; const previous = this.#idempotency.get(key);
    if (previous !== undefined) {
      if (previous.requestDigest !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
      return {mission: structuredClone(previous.response), replayed: true};
    }
    const saved = await this.replace(mission, expectedEtag);
    this.#idempotency.set(key, {requestDigest, missionId: mission.id, response: structuredClone(saved)});
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
      const replay = await client.query('select request_digest, mission_id, response_payload from shadow_idempotency where organization_id=$1 and route=$2 and idempotency_key=$3', [input.campaign.organizationId, route, idempotencyKey]);
      if (replay.rowCount !== 0) {
        if (String(replay.rows[0].request_digest).trim() !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
        return {mission: replay.rows[0].response_payload as ShadowMission, replayed: true};
      }
      const existing = await client.query('select payload from missions where organization_id=$1 and campaign_id=$2 and source_campaign_digest=$3', [input.campaign.organizationId, input.campaign.id, input.campaignDigest]);
      const mission = existing.rowCount === 0 ? createShadowMission(input) : existing.rows[0].payload as ShadowMission;
      if (existing.rowCount === 0) await persistMission(client, mission, true);
      await client.query('insert into shadow_idempotency(organization_id,route,idempotency_key,request_digest,mission_id,response_etag,response_payload) values($1,$2,$3,$4,$5,$6,$7)', [mission.organizationId, route, idempotencyKey, requestDigest, mission.id, mission.etag, mission]);
      return {mission, replayed: existing.rowCount !== 0};
    });
  }
  async get(organizationId: string, missionId: string): Promise<ShadowMission | undefined> { const client = await this.#pool.connect(); try { return await readMission(client, organizationId, missionId); } finally { client.release(); } }
  async getByCampaign(organizationId: string, campaignId: string): Promise<ShadowMission[]> { const client = await this.#pool.connect(); try { const result = await client.query('select id from missions where organization_id=$1 and campaign_id=$2 order by created_at desc', [organizationId, campaignId]); return (await Promise.all(result.rows.map((row) => readMission(client, organizationId, row.id as string)))).filter((mission): mission is ShadowMission => mission !== undefined); } finally { client.release(); } }
  async replace(mission: ShadowMission, expectedEtag: string): Promise<ShadowMission> { return this.#transaction(async (client) => { const locked = await client.query('select etag from missions where organization_id=$1 and id=$2 for update', [mission.organizationId, mission.id]); if (locked.rowCount === 0) throw new ShadowContractError('MISSION_NOT_FOUND', mission.id); if (locked.rows[0].etag !== expectedEtag) throw new ShadowContractError('MISSION_VERSION_CONFLICT', 'Mission ETag is stale.'); await persistMission(client, mission, false); return mission; }); }
  async getIdempotentReplay(organizationId: string, route: string, idempotencyKey: string, requestDigest: string): Promise<ShadowMission | undefined> {
    const result = await this.#pool.query('select request_digest,response_payload from shadow_idempotency where organization_id=$1 and route=$2 and idempotency_key=$3', [organizationId, route, idempotencyKey]);
    if (result.rowCount === 0) return undefined;
    if (String(result.rows[0].request_digest).trim() !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
    return result.rows[0].response_payload as ShadowMission;
  }
  async replaceIdempotent(mission: ShadowMission, expectedEtag: string, route: string, idempotencyKey: string, requestDigest: string): Promise<{mission: ShadowMission; replayed: boolean}> {
    return this.#transaction(async (client) => {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`${mission.organizationId}:${route}:${idempotencyKey}`]);
      const replay = await client.query('select request_digest,response_payload from shadow_idempotency where organization_id=$1 and route=$2 and idempotency_key=$3', [mission.organizationId, route, idempotencyKey]);
      if (replay.rowCount !== 0) {
        if (String(replay.rows[0].request_digest).trim() !== requestDigest) throw new ShadowContractError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different body.');
        return {mission: replay.rows[0].response_payload as ShadowMission, replayed: true};
      }
      const locked = await client.query('select etag from missions where organization_id=$1 and id=$2 for update', [mission.organizationId, mission.id]);
      if (locked.rowCount === 0) throw new ShadowContractError('MISSION_NOT_FOUND', mission.id);
      if (locked.rows[0].etag !== expectedEtag) throw new ShadowContractError('MISSION_VERSION_CONFLICT', 'Mission ETag is stale.');
      await persistMission(client, mission, false);
      await client.query('insert into shadow_idempotency(organization_id,route,idempotency_key,request_digest,mission_id,response_etag,response_payload) values($1,$2,$3,$4,$5,$6,$7)', [mission.organizationId, route, idempotencyKey, requestDigest, mission.id, mission.etag, mission]);
      return {mission, replayed: false};
    });
  }
  async close(): Promise<void> { await this.#pool.end(); }
  async #transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> { const client = await this.#pool.connect(); try { await client.query('begin'); const value = await operation(client); await client.query('commit'); return value; } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); } }
}

async function readMission(client: PoolClient, organizationId: string, missionId: string): Promise<ShadowMission | undefined> {
  const result = await client.query('select state,version,etag,payload from missions where organization_id=$1 and id=$2', [organizationId, missionId]);
  if (result.rowCount === 0) return undefined;
  const mission = result.rows[0].payload as ShadowMission;
  if (mission.state !== result.rows[0].state || mission.version !== result.rows[0].version || mission.etag !== result.rows[0].etag) throw new ShadowContractError('CONTROL_PLANE_HISTORY_DIVERGED', 'Mission aggregate metadata diverged from normalized PostgreSQL state.');
  await verifyNormalizedHistory(client, mission);
  return mission;
}

async function verifyNormalizedHistory(client: PoolClient, mission: ShadowMission): Promise<void> {
  const specs: {table: string; expected: unknown[]; order: string}[] = [
    {table: 'agent_runs', expected: mission.roleContexts, order: 'role_id'},
    {table: 'skill_locks', expected: mission.skillLocks, order: 'id'},
    {table: 'agent_tasks', expected: mission.tasks, order: 'id'},
    {table: 'governed_artifact_revisions', expected: mission.revisions, order: 'id'},
    {table: 'audit_decisions', expected: mission.audits, order: 'id'},
    {table: 'owner_reviews', expected: mission.reviews, order: 'id'},
    {table: 'trace_events', expected: mission.trace, order: 'sequence'},
    {table: 'ledger_entries', expected: mission.ledger, order: 'sequence'},
    {table: 'model_calls', expected: mission.modelCalls, order: 'id'},
    {table: 'media_assets', expected: mission.mediaAssets, order: 'id'}
  ];
  for (const spec of specs) {
    const result = await client.query(`select payload from ${spec.table} where organization_id=$1 and mission_id=$2 order by ${spec.order}`, [mission.organizationId, mission.id]);
    const normalized = result.rows.map((row) => row.payload);
    const byDigest = (values: unknown[]) => values.map((value) => sha256Digest(value)).sort();
    if (sha256Digest(byDigest(normalized)) !== sha256Digest(byDigest(spec.expected))) throw new ShadowContractError('CONTROL_PLANE_HISTORY_DIVERGED', `${spec.table} diverged from the Mission aggregate.`);
  }
}

async function persistMission(client: PoolClient, mission: ShadowMission, insert: boolean): Promise<void> {
  const values = [mission.organizationId, mission.id, mission.campaignId, mission.sourceCampaignVersion, mission.sourceCampaignDigest, mission.runtime, mission.runtimeVersion, mission.runtimeProjectId, mission.state, mission.version, mission.etag, mission, mission.createdAt, mission.updatedAt];
  if (insert) await client.query('insert into missions(organization_id,id,campaign_id,source_campaign_version,source_campaign_digest,runtime,runtime_version,runtime_project_id,state,version,etag,payload,live,external_action_allowed,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,false,$13,$14)', values);
  else await client.query('update missions set state=$3,version=$4,etag=$5,payload=$6,updated_at=$7 where organization_id=$1 and id=$2', [mission.organizationId, mission.id, mission.state, mission.version, mission.etag, mission, mission.updatedAt]);
  for (const context of mission.roleContexts) await client.query('insert into agent_runs(organization_id,mission_id,role_id,identity_id,context_digest,permissions,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(organization_id,mission_id,role_id) do update set payload=excluded.payload', [mission.organizationId, mission.id, context.roleId, context.identityId, context.contextDigest, JSON.stringify(context.permissions), context, mission.createdAt]);
  for (const lock of mission.skillLocks) await client.query('insert into skill_locks(organization_id,mission_id,id,name,version,digest,payload) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing', [mission.organizationId, mission.id, lock.id, lock.name, lock.version, lock.digest, lock]);
  for (const task of mission.tasks) await client.query('insert into agent_tasks(organization_id,mission_id,id,role_id,input_digest,skill_lock_digest,state,attempt,accepted_output_digest,payload,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(organization_id,mission_id,id) do update set state=excluded.state,attempt=excluded.attempt,accepted_output_digest=excluded.accepted_output_digest,payload=excluded.payload,updated_at=excluded.updated_at', [mission.organizationId, mission.id, task.id, task.roleId, task.inputDigest, task.skillLockDigest, task.state, task.attempt, task.acceptedOutputDigest, task, mission.updatedAt]);
  for (const revision of mission.revisions) await client.query('insert into governed_artifact_revisions(organization_id,mission_id,campaign_id,id,activation_unit_id,platform,revision,digest,parent_revision_id,producer_role_id,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict do nothing', [mission.organizationId, mission.id, mission.campaignId, revision.id, revision.activationUnitId, revision.platform, revision.revision, revision.digest, revision.parentRevisionId, revision.producerRoleId, revision, revision.createdAt]);
  for (const audit of mission.audits) await client.query('insert into audit_decisions(organization_id,mission_id,id,revision_id,revision_digest,auditor_identity_id,outcome,status,digest,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict do nothing', [mission.organizationId, mission.id, audit.id, audit.revisionId, audit.revisionDigest, audit.auditorIdentityId, audit.outcome, audit.status, audit.digest, audit, audit.createdAt]);
  for (const review of mission.reviews) await client.query('insert into owner_reviews(organization_id,mission_id,id,revision_id,revision_digest,decision,authority,creates_action_grant,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict do nothing', [mission.organizationId, mission.id, review.id, review.revisionId, review.revisionDigest, review.decision, review.authority, false, review, review.createdAt]);
  for (const event of mission.trace) await client.query('insert into trace_events(organization_id,mission_id,id,sequence,kind,payload,created_at) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing', [mission.organizationId, mission.id, event.id, event.sequence, event.kind, event, event.createdAt]);
  for (const entry of mission.ledger) await client.query('insert into ledger_entries(organization_id,mission_id,id,sequence,entry_digest,previous_entry_digest,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing', [mission.organizationId, mission.id, entry.id, entry.sequence, entry.entryDigest, entry.previousEntryDigest, entry, entry.createdAt]);
  for (const call of mission.modelCalls) await client.query('insert into model_calls(organization_id,mission_id,id,provider,model,input_digest,output_digest,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing', [mission.organizationId, mission.id, call.id, call.provider, call.model, call.inputDigest, call.outputDigest, call, call.createdAt]);
  for (const asset of mission.mediaAssets) await client.query('insert into media_assets(organization_id,mission_id,id,content_digest,provider,approval_state,payload,created_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing', [mission.organizationId, mission.id, asset.id, asset.contentDigest, asset.provider, asset.approvalState, asset, asset.createdAt]);
  if (sha256Digest(missionPublicNoAction(mission)) !== sha256Digest({externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0})) throw new ShadowContractError('EXTERNAL_ACTION_BOUNDARY_VIOLATION', 'Mission persistence rejected an action-capable state.');
  await verifyNormalizedHistory(client, mission);
}

function missionPublicNoAction(mission: ShadowMission) { return {externalActionAllowed: mission.externalActionAllowed, actionGrantCount: mission.actionGrantCount, connectorCount: mission.connectorCount, externalActionCount: mission.externalActionCount}; }
