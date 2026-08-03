import {describe, expect, it} from 'vitest';
import {createCampaignEnvelope, advanceCampaignEnvelope} from './campaign-envelope.js';
import {createDemoCampaignDocument} from './campaign-fixture.js';

describe('campaign envelope versioning', () => {
  it('creates a stable ETag and exposes the synthetic evidence gap', () => {
    const envelope = createCampaignEnvelope(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    expect(envelope.etag).toBe(`"campaign-${envelope.document.id}-v1-${envelope.digest}"`);
    expect(envelope.readiness).toBe('NEEDS_OWNER');
    expect(envelope.gapCodes[0]).toMatch(/^CLAIM_EVIDENCE_REQUIRED:/u);
  });

  it('increments only a changed platform ArtifactRevision', () => {
    const current = createCampaignEnvelope(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    const incoming = structuredClone(current.document);
    const x = incoming.artifactRevisions.find((item) => item.platform === 'X')!;
    if (x.content.kind === 'X') x.content.posts[0] = 'A changed synthetic X draft.';
    const next = advanceCampaignEnvelope(current, incoming, new Date('2026-08-03T13:00:00.000Z'));
    expect(next.version).toBe(2);
    expect(next.digest).not.toBe(current.digest);
    expect(next.document.artifactRevisions.find((item) => item.platform === 'X')?.revision).toBe(2);
    expect(next.document.artifactRevisions.find((item) => item.platform === 'BLUESKY')?.revision).toBe(1);
  });

  it('versions the affected artifact and invalidates schedules after an account binding edit', async () => {
    const current = createCampaignEnvelope(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    const {createPublishingSchedule} = await import('./schedule.js');
    const scheduled = structuredClone(current.document);
    const preview = createPublishingSchedule({organizationId: scheduled.organizationId, campaignId: scheduled.id, artifactRevisions: scheduled.artifactRevisions, localStart: '2026-09-01T09:00', timeZone: 'UTC', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'}, new Date('2026-08-03T12:30:00.000Z'));
    scheduled.publishingSchedules.push(preview.schedule);
    scheduled.scheduleOccurrences.push(...preview.occurrences);
    const withSchedule = advanceCampaignEnvelope(current, scheduled, new Date('2026-08-03T12:30:00.000Z'));
    expect(withSchedule.document.publishingSchedules[0]?.status).toBe('ACTIVE');

    const accountEdit = structuredClone(withSchedule.document);
    accountEdit.graph.channelAccounts[0]!.displayHandle = '@lumiclaw-updated';
    const next = advanceCampaignEnvelope(withSchedule, accountEdit, new Date('2026-08-03T13:00:00.000Z'));
    expect(next.document.artifactRevisions.find((item) => item.platform === 'X')?.revision).toBe(2);
    expect(next.document.artifactRevisions.find((item) => item.platform === 'BLUESKY')?.revision).toBe(1);
    expect(next.document.publishingSchedules[0]?.status).toBe('INVALIDATED');
    expect(next.document.scheduleOccurrences[0]?.state).toBe('INVALIDATED');
  });

  it('versions only an editable DRAFT Claim without rewriting approved artifact authority', () => {
    const current = createCampaignEnvelope(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    const incoming = structuredClone(current.document);
    incoming.claims[1]!.statement = 'Updated synthetic candidate Claim.';
    const next = advanceCampaignEnvelope(current, incoming, new Date('2026-08-03T13:00:00.000Z'));
    expect(next.document.claims[1]?.version).toBe(2);
    expect(next.document.artifactRevisions.every((item) => item.revision === 1)).toBe(true);
  });

  it('retains schedule history and invalidates the previous active schedule on replacement', async () => {
    const {createPublishingSchedule} = await import('./schedule.js');
    const current = createCampaignEnvelope(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    const firstDocument = structuredClone(current.document);
    const first = createPublishingSchedule({organizationId: firstDocument.organizationId, campaignId: firstDocument.id, artifactRevisions: firstDocument.artifactRevisions, localStart: '2026-09-01T09:00', timeZone: 'UTC', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'}, new Date('2026-08-03T12:10:00.000Z'));
    firstDocument.publishingSchedules.push(first.schedule); firstDocument.scheduleOccurrences.push(...first.occurrences);
    const withFirst = advanceCampaignEnvelope(current, firstDocument, new Date('2026-08-03T12:10:00.000Z'));
    const replacementDocument = structuredClone(withFirst.document);
    const replacement = createPublishingSchedule({organizationId: replacementDocument.organizationId, campaignId: replacementDocument.id, artifactRevisions: replacementDocument.artifactRevisions, localStart: '2026-09-02T10:00', timeZone: 'UTC', foldPreference: 'EARLIER', misfirePolicy: 'HOLD_FOR_OWNER'}, new Date('2026-08-03T12:20:00.000Z'));
    replacementDocument.publishingSchedules = [replacement.schedule]; replacementDocument.scheduleOccurrences = [...replacement.occurrences];
    const next = advanceCampaignEnvelope(withFirst, replacementDocument, new Date('2026-08-03T12:20:00.000Z'));
    expect(next.document.publishingSchedules).toHaveLength(2);
    expect(next.document.publishingSchedules.find((item) => item.id === first.schedule.id)?.invalidationReason).toBe('SCHEDULE_EDIT');
    expect(next.document.publishingSchedules.find((item) => item.id === replacement.schedule.id)?.status).toBe('ACTIVE');
    expect(next.document.scheduleOccurrences.find((item) => item.scheduleId === first.schedule.id)?.state).toBe('INVALIDATED');
  });

  it('rejects browser attempts to self-approve a Claim or rewrite capability constraints', () => {
    const current = createCampaignEnvelope(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    const selfApproved = structuredClone(current.document); selfApproved.claims[1]!.status = 'APPROVED';
    expect(() => advanceCampaignEnvelope(current, selfApproved, new Date('2026-08-03T13:00:00.000Z'))).toThrow(/server-governed/u);
    const enlargedCapability = structuredClone(current.document); enlargedCapability.capabilitySnapshots[0]!.constraints.posts!.maxLength = 10_000;
    expect(() => advanceCampaignEnvelope(current, enlargedCapability, new Date('2026-08-03T13:00:00.000Z'))).toThrow(/cannot rewrite/u);
    const rewrittenApprovedClaim = structuredClone(current.document); rewrittenApprovedClaim.claims[0]!.statement = 'An unsupported replacement for an approved Claim.';
    expect(() => advanceCampaignEnvelope(current, rewrittenApprovedClaim, new Date('2026-08-03T13:00:00.000Z'))).toThrow(/approved or retired Claim/u);
    const rewrittenMission = structuredClone(current.document); rewrittenMission.missionContract.roleIds.reverse();
    expect(() => advanceCampaignEnvelope(current, rewrittenMission, new Date('2026-08-03T13:00:00.000Z'))).toThrow();
  });
});
