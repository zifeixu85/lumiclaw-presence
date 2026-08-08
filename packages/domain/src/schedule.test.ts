import {describe, expect, it} from 'vitest';
import {createDemoCampaignDocument} from './campaign-fixture.js';
import {createPublishingSchedule, invalidateStaleSchedules, isStoredScheduleContractValid, resolveWallTime, ScheduleContractError} from './schedule.js';

describe('persistent schedule contract', () => {
  it('rejects a DST gap and resolves both sides of a DST fold', () => {
    expect(() => resolveWallTime('2026-03-08T02:30', 'America/New_York', 'EARLIER')).toThrowError(ScheduleContractError);
    const earlier = resolveWallTime('2026-11-01T01:30', 'America/New_York', 'EARLIER');
    const later = resolveWallTime('2026-11-01T01:30', 'America/New_York', 'LATER');
    expect(later.instant.getTime() - earlier.instant.getTime()).toBe(60 * 60 * 1000);
    expect([earlier.offsetMinutes, later.offsetMinutes]).toEqual([-240, -300]);
  });

  it('expands constrained RRULEs and applies explicit misfire policy without execution', () => {
    const document = createDemoCampaignDocument();
    const value = createPublishingSchedule({organizationId: document.organizationId, campaignId: document.id, artifactRevisions: document.artifactRevisions, localStart: '2026-08-01T09:00', timeZone: 'Asia/Singapore', rrule: 'FREQ=DAILY;INTERVAL=2;COUNT=3', foldPreference: 'EARLIER', misfirePolicy: 'HOLD_FOR_OWNER'}, new Date('2026-08-03T12:00:00.000Z'));
    expect(value.schedule.rrule).toBe('FREQ=DAILY;INTERVAL=2;COUNT=3');
    expect(value.occurrences.map((item) => item.state)).toEqual(['NEEDS_OWNER', 'NEEDS_OWNER', 'PENDING']);
    expect(value.occurrences.every((item) => item.misfireReason === null || item.misfireReason === 'PAST_DUE')).toBe(true);
  });

  it('rejects unsupported recurrence and invalidates pending occurrences on revision edit', () => {
    const document = createDemoCampaignDocument();
    expect(() => createPublishingSchedule({organizationId: document.organizationId, campaignId: document.id, artifactRevisions: document.artifactRevisions, localStart: '2026-09-01T09:00', timeZone: 'UTC', rrule: 'FREQ=MONTHLY;INTERVAL=1;COUNT=2', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'})).toThrowError(ScheduleContractError);
    expect(() => createPublishingSchedule({organizationId: document.organizationId, campaignId: document.id, artifactRevisions: document.artifactRevisions, localStart: '2026-09-01T09:00', timeZone: 'UTC', rrule: 'FREQ=DAILY;FREQ=WEEKLY;INTERVAL=1;COUNT=2', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'})).toThrowError(/exactly one/u);
    const value = createPublishingSchedule({organizationId: document.organizationId, campaignId: document.id, artifactRevisions: document.artifactRevisions, localStart: '2026-09-01T09:00', timeZone: 'UTC', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'}, new Date('2026-08-03T00:00:00.000Z'));
    const changed = structuredClone(document.artifactRevisions); changed[0]!.id = document.graph.markets[0]!.id;
    const invalidated = invalidateStaleSchedules([value.schedule], value.occurrences, changed);
    expect(invalidated.schedules[0]!.status).toBe('INVALIDATED');
    expect(invalidated.occurrences[0]!.state).toBe('INVALIDATED');
  });

  it('rejects missing or unknown schedule decision codes', () => {
    const document = createDemoCampaignDocument();
    const base = {organizationId: document.organizationId, campaignId: document.id, artifactRevisions: document.artifactRevisions, localStart: '2026-09-01T09:00', timeZone: 'UTC', foldPreference: 'EARLIER' as const, misfirePolicy: 'SKIP' as const};
    expect(() => createPublishingSchedule({...base, timeZone: ''})).toThrowError(/IANA/u);
    expect(() => createPublishingSchedule({...base, foldPreference: 'UNKNOWN' as 'EARLIER'})).toThrowError(/Fold preference/u);
    expect(() => createPublishingSchedule({...base, misfirePolicy: 'RUN' as 'SKIP'})).toThrowError(/Misfire policy/u);
  });

  it('rejects forged occurrence instants while accepting the exact stored preview', () => {
    const document = createDemoCampaignDocument();
    const value = createPublishingSchedule({organizationId: document.organizationId, campaignId: document.id, artifactRevisions: document.artifactRevisions, localStart: '2026-09-01T09:00', timeZone: 'Asia/Singapore', rrule: 'FREQ=DAILY;INTERVAL=1;COUNT=2', foldPreference: 'EARLIER', misfirePolicy: 'SKIP'}, new Date('2026-08-03T00:00:00.000Z'));
    expect(isStoredScheduleContractValid(value.schedule, value.occurrences, document.artifactRevisions)).toBe(true);
    const forged = structuredClone(value.occurrences); forged[0]!.scheduledForUtc = '2026-09-01T09:00:00.000Z';
    expect(isStoredScheduleContractValid(value.schedule, forged, document.artifactRevisions)).toBe(false);
  });
});
