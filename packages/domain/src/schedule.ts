import type {ArtifactRevision, PublishingSchedule, ScheduleFoldPreference, ScheduleMisfirePolicy, ScheduleOccurrence} from './campaign-types.js';
import {createUuidV7} from './id.js';

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;
const RRULE_LIMIT = 50;

export type ScheduleInput = {
  organizationId: string;
  campaignId: string;
  artifactRevisions: ArtifactRevision[];
  localStart: string;
  timeZone: string;
  rrule?: string | null;
  foldPreference: ScheduleFoldPreference;
  misfirePolicy: ScheduleMisfirePolicy;
};

export function createPublishingSchedule(input: ScheduleInput, now = new Date()): {schedule: PublishingSchedule; occurrences: ScheduleOccurrence[]} {
  if (typeof input.localStart !== 'string') throw new ScheduleContractError('LOCAL_TIME_INVALID', 'Local time must use YYYY-MM-DDTHH:mm.');
  if (input.rrule !== undefined && input.rrule !== null && typeof input.rrule !== 'string') throw new ScheduleContractError('RRULE_INVALID', 'RRULE must be a string or null.');
  if (input.foldPreference !== 'EARLIER' && input.foldPreference !== 'LATER') throw new ScheduleContractError('FOLD_PREFERENCE_INVALID', 'Fold preference must be EARLIER or LATER.');
  if (input.misfirePolicy !== 'SKIP' && input.misfirePolicy !== 'HOLD_FOR_OWNER') throw new ScheduleContractError('MISFIRE_POLICY_INVALID', 'Misfire policy must be SKIP or HOLD_FOR_OWNER.');
  const rule = input.rrule === undefined || input.rrule === null || input.rrule.trim() === '' ? null : parseRrule(input.rrule);
  const walls = expandWallTimes(input.localStart, rule);
  const scheduleId = createUuidV7(now.getTime());
  const timestamp = now.toISOString();
  const schedule: PublishingSchedule = {
    id: scheduleId,
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    schemaVersion: 1,
    version: 1,
    kind: rule === null ? 'ONCE' : 'RRULE',
    localStart: input.localStart,
    timeZone: input.timeZone,
    rrule: rule === null ? null : rule.canonical,
    foldPreference: input.foldPreference,
    misfirePolicy: input.misfirePolicy,
    sourceArtifactRevisionIds: input.artifactRevisions.map((revision) => revision.id),
    status: 'ACTIVE',
    invalidationReason: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const occurrences = walls.map((wall, index) => {
    const resolved = resolveWallTime(wall, input.timeZone, input.foldPreference);
    const pastDue = resolved.instant.getTime() <= now.getTime();
    return {
      id: createUuidV7(now.getTime() + index + 1),
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      scheduleId,
      scheduleVersion: 1,
      schemaVersion: 1 as const,
      ordinal: index + 1,
      localWallTime: wall,
      scheduledForUtc: resolved.instant.toISOString(),
      utcOffsetMinutes: resolved.offsetMinutes,
      state: pastDue ? input.misfirePolicy === 'SKIP' ? 'MISSED' as const : 'NEEDS_OWNER' as const : 'PENDING' as const,
      misfireReason: pastDue ? 'PAST_DUE' as const : null
    };
  });
  return {schedule, occurrences};
}

export function invalidateStaleSchedules(schedules: PublishingSchedule[], occurrences: ScheduleOccurrence[], revisions: ArtifactRevision[], now = new Date()): {schedules: PublishingSchedule[]; occurrences: ScheduleOccurrence[]} {
  const currentIds = new Set(revisions.map((revision) => revision.id));
  const invalidatedIds = new Set<string>();
  const timestamp = now.toISOString();
  const nextSchedules = schedules.map((schedule) => {
    if (schedule.status === 'INVALIDATED' || schedule.sourceArtifactRevisionIds.every((id) => currentIds.has(id))) return schedule;
    invalidatedIds.add(schedule.id);
    return {...schedule, status: 'INVALIDATED' as const, invalidationReason: 'CONTENT_OR_ACCOUNT_EDIT' as const, updatedAt: timestamp};
  });
  return {
    schedules: nextSchedules,
    occurrences: occurrences.map((occurrence) => invalidatedIds.has(occurrence.scheduleId) && occurrence.state === 'PENDING' ? {...occurrence, state: 'INVALIDATED' as const} : occurrence)
  };
}

export function isStoredScheduleContractValid(schedule: PublishingSchedule, occurrences: ScheduleOccurrence[], artifactRevisions: ArtifactRevision[]): boolean {
  try {
    const expected = createPublishingSchedule({organizationId: schedule.organizationId, campaignId: schedule.campaignId, artifactRevisions, localStart: schedule.localStart, timeZone: schedule.timeZone, rrule: schedule.rrule, foldPreference: schedule.foldPreference, misfirePolicy: schedule.misfirePolicy}, new Date(schedule.createdAt));
    if (schedule.kind !== expected.schedule.kind || schedule.rrule !== expected.schedule.rrule) return false;
    if (occurrences.length !== expected.occurrences.length) return false;
    const actualByOrdinal = new Map(occurrences.map((item) => [item.ordinal, item]));
    return expected.occurrences.every((item) => {
      const actual = actualByOrdinal.get(item.ordinal);
      const expectedState = schedule.status === 'INVALIDATED' && item.state === 'PENDING' ? 'INVALIDATED' : item.state;
      return actual !== undefined && actual.organizationId === schedule.organizationId && actual.campaignId === schedule.campaignId && actual.scheduleId === schedule.id && actual.scheduleVersion === schedule.version && actual.localWallTime === item.localWallTime && actual.scheduledForUtc === item.scheduledForUtc && actual.utcOffsetMinutes === item.utcOffsetMinutes && actual.state === expectedState && actual.misfireReason === item.misfireReason;
    });
  } catch (error) {
    if (error instanceof ScheduleContractError || error instanceof RangeError) return false;
    throw error;
  }
}

export function resolveWallTime(localWallTime: string, timeZone: string, foldPreference: ScheduleFoldPreference): {instant: Date; offsetMinutes: number; ambiguity: 'EXACT' | 'FOLD_EARLIER' | 'FOLD_LATER'} {
  const parts = parseLocal(localWallTime);
  assertTimeZone(timeZone);
  const center = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const formatter = formatterFor(timeZone);
  const candidates: Date[] = [];
  for (let instant = center - 16 * 60 * 60 * 1000; instant <= center + 16 * 60 * 60 * 1000; instant += 60_000) {
    if (formatLocal(formatter, new Date(instant)) === localWallTime) candidates.push(new Date(instant));
  }
  if (candidates.length === 0) throw new ScheduleContractError('DST_GAP', `${localWallTime} does not exist in ${timeZone}.`);
  if (candidates.length > 2) throw new ScheduleContractError('TIME_ZONE_RESOLUTION_FAILED', 'Unexpected wall-time candidate count.');
  const instant = candidates.length === 1 ? candidates[0]! : foldPreference === 'EARLIER' ? candidates[0]! : candidates[1]!;
  const offsetMinutes = Math.round((center - instant.getTime()) / 60_000);
  return {instant, offsetMinutes, ambiguity: candidates.length === 1 ? 'EXACT' : foldPreference === 'EARLIER' ? 'FOLD_EARLIER' : 'FOLD_LATER'};
}

function parseRrule(value: string): {frequency: 'DAILY' | 'WEEKLY'; interval: number; count: number; canonical: string} {
  const normalized = value.trim().toUpperCase().replace(/^RRULE:/u, '');
  const parts = normalized.split(';');
  const fields = new Map(parts.map((part) => {
    const [key, fieldValue, ...rest] = part.split('=');
    if (key === undefined || fieldValue === undefined || rest.length > 0) throw new ScheduleContractError('RRULE_INVALID', 'RRULE fields must use KEY=VALUE.');
    return [key, fieldValue];
  }));
  if (fields.size !== parts.length || fields.size !== 3 || !fields.has('FREQ') || !fields.has('INTERVAL') || !fields.has('COUNT')) throw new ScheduleContractError('RRULE_INVALID', 'M1 RRULE requires exactly one FREQ, INTERVAL, and COUNT field.');
  const frequency = fields.get('FREQ');
  if (frequency !== 'DAILY' && frequency !== 'WEEKLY') throw new ScheduleContractError('RRULE_INVALID', 'M1 supports DAILY or WEEKLY only.');
  const interval = Number(fields.get('INTERVAL'));
  const count = Number(fields.get('COUNT'));
  if (!Number.isInteger(interval) || interval < 1 || interval > 30 || !Number.isInteger(count) || count < 1 || count > RRULE_LIMIT) throw new ScheduleContractError('RRULE_INVALID', 'INTERVAL must be 1..30 and COUNT must be 1..50.');
  return {frequency, interval, count, canonical: `FREQ=${frequency};INTERVAL=${interval};COUNT=${count}`};
}

function expandWallTimes(start: string, rule: ReturnType<typeof parseRrule> | null): string[] {
  const parsed = parseLocal(start);
  if (rule === null) return [start];
  const step = rule.frequency === 'DAILY' ? rule.interval : rule.interval * 7;
  return Array.from({length: rule.count}, (_, index) => {
    const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + index * step, parsed.hour, parsed.minute));
    return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}T${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  });
}

function parseLocal(value: string): {year: number; month: number; day: number; hour: number; minute: number} {
  const match = LOCAL_PATTERN.exec(value);
  if (match === null) throw new ScheduleContractError('LOCAL_TIME_INVALID', 'Local time must use YYYY-MM-DDTHH:mm.');
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute) throw new ScheduleContractError('LOCAL_TIME_INVALID', 'Local time components are invalid.');
  return {year, month, day, hour, minute};
}

function assertTimeZone(timeZone: string): void {
  if (typeof timeZone !== 'string' || timeZone.length === 0) throw new ScheduleContractError('TIME_ZONE_INVALID', 'An IANA time zone is required.');
  try { new Intl.DateTimeFormat('en-CA', {timeZone}).format(); } catch { throw new ScheduleContractError('TIME_ZONE_INVALID', `${timeZone} is not a supported IANA time zone.`); }
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {timeZone, calendar: 'iso8601', numberingSystem: 'latn', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
}

function formatLocal(formatter: Intl.DateTimeFormat, date: Date): string {
  const values = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export class ScheduleContractError extends Error {
  constructor(public readonly code: 'LOCAL_TIME_INVALID' | 'TIME_ZONE_INVALID' | 'FOLD_PREFERENCE_INVALID' | 'MISFIRE_POLICY_INVALID' | 'DST_GAP' | 'TIME_ZONE_RESOLUTION_FAILED' | 'RRULE_INVALID', message: string) {
    super(message);
    this.name = 'ScheduleContractError';
  }
}
