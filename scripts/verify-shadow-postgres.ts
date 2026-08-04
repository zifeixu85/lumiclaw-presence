import {createDemoCampaignDocument, sha256Digest} from '@lumiclaw/domain';
import {PostgresCampaignRepository} from '@lumiclaw/db';
import {PostgresShadowMissionRepository, PublicSafeMockMediaProvider, PublicSafeMockModelProvider, attachProviderEvidence, missionPublicEvidence, reviewRevision, runPublicSafeFlight} from '@lumiclaw/governed-shadow';
import {Pool} from 'pg';
import {mkdir, writeFile} from 'node:fs/promises';

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined) throw new Error('DATABASE_URL_REQUIRED');
const now = new Date('2026-08-04T03:00:00.000Z'); const campaign = createDemoCampaignDocument();
const campaignRepository = new PostgresCampaignRepository(connectionString); const shadowRepository = new PostgresShadowMissionRepository(connectionString);
try {
  const created = await campaignRepository.create(campaign.organizationId, campaign, 'shadow-db-campaign', sha256Digest(campaign), now);
  if (!created.ok) throw new Error(created.code);
  const started = await shadowRepository.create({campaign: created.envelope.document, campaignVersion: created.envelope.version, campaignDigest: created.envelope.digest, now}, 'shadow-db-mission', sha256Digest({sourceDigest: created.envelope.digest, fault: 'BETA_TO_GA'}));
  const creationReplay = await shadowRepository.create({campaign: created.envelope.document, campaignVersion: created.envelope.version, campaignDigest: created.envelope.digest, now}, 'shadow-db-mission', sha256Digest({sourceDigest: created.envelope.digest, fault: 'BETA_TO_GA'}));
  let flight = runPublicSafeFlight(started.mission, created.envelope.document, now); const producerTask = flight.tasks.find((item) => item.roleId === 'founder-identity-producer')!;
  const model = await new PublicSafeMockModelProvider({copy: 'PostgreSQL conformance fixture.'}, () => new Date(now.getTime() + 4_000)).generateStructured<{copy: string}>({missionId: flight.id, taskId: producerTask.id, model: 'deepseek-v4-flash', system: 'Return schema-only fixture output.', input: {sourceCampaignDigest: flight.sourceCampaignDigest}, outputSchema: {type: 'object', additionalProperties: false, required: ['copy'], properties: {copy: {type: 'string'}}}, maxAttempts: 1});
  if (!model.ok) throw new Error('MODEL_MOCK_CONFORMANCE_FAILED');
  const media = await new PublicSafeMockMediaProvider(() => new Date(now.getTime() + 4_500)).generate({organizationId: campaign.organizationId, missionId: flight.id, prompt: 'PostgreSQL conformance media fixture', rightsConfirmedSynthetic: true});
  flight = attachProviderEvidence(flight, {modelCall: model.snapshot, mediaAsset: media.asset}, new Date(now.getTime() + 5_000));
  const reviewableRevision = flight.revisions.find((revision) => revision.platform === 'X' && revision.revision === 2);
  if (reviewableRevision === undefined) throw new Error('POSTGRES_REVIEWABLE_REVISION_MISSING');
  flight = reviewRevision(flight, created.envelope.document, reviewableRevision.id, reviewableRevision.digest, 'READY_FOR_FUTURE_EXECUTION', new Date(now.getTime() + 5_500));
  const flightRoute = `/api/v1/shadow-missions/${flight.id}/public-safe-flight`; const flightRequestDigest = sha256Digest({operation: 'PUBLIC_SAFE_FLIGHT', missionId: flight.id});
  const flightSaved = await shadowRepository.replaceIdempotent(flight, started.mission.etag, flightRoute, 'shadow-db-flight', flightRequestDigest); flight = flightSaved.mission;
  const flightMutationReplay = await shadowRepository.replaceIdempotent(flight, started.mission.etag, flightRoute, 'shadow-db-flight', flightRequestDigest);
  await shadowRepository.close();
  const reopenedRepository = new PostgresShadowMissionRepository(connectionString); const reopened = await reopenedRepository.get(campaign.organizationId, flight.id); if (reopened === undefined) throw new Error('MISSION_RESTART_RECOVERY_FAILED');
  let advancedCheckpointRejected = false;
  try { await reopenedRepository.create({campaign: created.envelope.document, campaignVersion: created.envelope.version, campaignDigest: created.envelope.digest, now}, 'shadow-db-mission', sha256Digest({sourceDigest: created.envelope.digest, fault: 'BETA_TO_GA'})); }
  catch (error) { advancedCheckpointRejected = error instanceof Error && 'code' in error && error.code === 'IDEMPOTENT_RESPONSE_VERSION_ADVANCED'; }
  const crossTenant = await reopenedRepository.get(campaign.graph.identities[0]!.id, flight.id);
  const pool = new Pool({connectionString});
  const tamperTask = flight.tasks.find((task) => task.acceptedOutputDigest !== null)!;
  await pool.query("update agent_tasks set payload=jsonb_set(payload,'{acceptedOutputDigest}',to_jsonb($1::text)) where organization_id=$2 and mission_id=$3 and id=$4", ['0'.repeat(64), campaign.organizationId, flight.id, tamperTask.id]);
  let idempotentReplayNormalizedValidated = false;
  try { await reopenedRepository.getIdempotentReplay(campaign.organizationId, flightRoute, 'shadow-db-flight', flightRequestDigest); }
  catch (error) { idempotentReplayNormalizedValidated = error instanceof Error && 'code' in error && error.code === 'CONTROL_PLANE_HISTORY_DIVERGED'; }
  await pool.query("update agent_tasks set payload=jsonb_set(payload,'{acceptedOutputDigest}',to_jsonb(trim(accepted_output_digest)::text)) where organization_id=$1 and mission_id=$2 and id=$3", [campaign.organizationId, flight.id, tamperTask.id]);
  await reopenedRepository.close();
  const counts = Object.fromEntries(await Promise.all(['missions', 'agent_runs', 'agent_tasks', 'skill_locks', 'governed_artifact_revisions', 'audit_decisions', 'owner_reviews', 'trace_events', 'ledger_entries', 'model_calls', 'media_assets', 'shadow_idempotency'].map(async (table) => [table, Number((await pool.query(`select count(*)::int as count from ${table}`)).rows[0].count)])));
  const immutableHistory: Record<string, boolean> = {};
  for (const [table, assignment] of [['governed_artifact_revisions', 'revision=99'], ['audit_decisions', "status='MUTATED'"], ['owner_reviews', "decision='MUTATED'"], ['trace_events', "kind='MUTATED'"], ['ledger_entries', 'sequence=999'], ['shadow_idempotency', "response_etag='MUTATED'"]] as const) {
    try { await pool.query(`update ${table} set ${assignment} where organization_id=$1`, [campaign.organizationId]); immutableHistory[table] = false; }
    catch (error) { immutableHistory[table] = error instanceof Error && error.message.includes('GOVERNED_HISTORY_IMMUTABLE'); }
  }
  const envelopeHistoryCounts = (await pool.query("select jsonb_build_object('roleContexts',jsonb_array_length(payload->'roleContexts'),'tasks',jsonb_array_length(payload->'tasks'),'revisions',jsonb_array_length(payload->'revisions'),'audits',jsonb_array_length(payload->'audits'),'trace',jsonb_array_length(payload->'trace'),'ledger',jsonb_array_length(payload->'ledger')) as counts from missions where id=$1", [flight.id])).rows[0].counts as Record<string, number>;
  const normalizedHistoryOnly = Object.values(envelopeHistoryCounts).every((count) => count === 0);
  const idempotencyColumns = (await pool.query("select column_name from information_schema.columns where table_schema='public' and table_name='shadow_idempotency' order by column_name")).rows.map((row) => String(row.column_name));
  const idempotencyMetadataOnly = !idempotencyColumns.includes('response_payload') && idempotencyColumns.includes('response_version') && idempotencyColumns.includes('response_etag');
  const forbiddenTables = Number((await pool.query("select count(*)::int as count from information_schema.tables where table_schema='public' and table_name in ('action_grants','connectors','action_outbox')")).rows[0].count); await pool.end();
  const evidence = missionPublicEvidence(reopened) as {noAction: unknown};
  const result = {schemaVersion: 1, status: counts.missions === 1 && counts.agent_runs === 6 && counts.agent_tasks === 8 && counts.skill_locks === 5 && counts.governed_artifact_revisions === 5 && counts.audit_decisions === 5 && counts.owner_reviews === 1 && counts.model_calls === 1 && counts.media_assets === 1 && counts.shadow_idempotency === 2 && Object.keys(immutableHistory).length === 6 && Object.values(immutableHistory).every(Boolean) && normalizedHistoryOnly && idempotencyMetadataOnly && idempotentReplayNormalizedValidated && creationReplay.replayed && advancedCheckpointRejected && flightMutationReplay.replayed && crossTenant === undefined && forbiddenTables === 0 ? 'PASS' : 'FAIL', restartRecovered: reopened.state === 'NEEDS_OWNER_REVIEW', replayed: creationReplay.replayed, mutationReplayed: flightMutationReplay.replayed, idempotencyMetadataOnly, idempotencyColumns, advancedCheckpointRejected, idempotentReplayNormalizedValidated, crossTenantHidden: crossTenant === undefined, immutableHistory, normalizedHistoryOnly, envelopeHistoryCounts, counts, forbiddenTables, noAction: evidence.noAction};
  await mkdir('.evidence/sdd-002', {recursive: true}); await writeFile('.evidence/sdd-002/shadow-postgres.json', `${JSON.stringify(result, null, 2)}\n`);
  console.info(JSON.stringify({...result, evidence: '.evidence/sdd-002/shadow-postgres.json'})); if (result.status !== 'PASS') process.exitCode = 1;
} finally { await campaignRepository.close().catch(() => {}); await shadowRepository.close().catch(() => {}); }
