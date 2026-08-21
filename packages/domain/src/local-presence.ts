import {createHash} from 'node:crypto';
import {createUuidV7} from './id.js';

export const LOCAL_MATERIAL_MAX_BYTES = 2 * 1024 * 1024;
export const LOCAL_MATERIAL_ACCEPT = '.md,.txt';

export type LocalProfileState = 'PROFILE_READY' | 'ONBOARDING_COMPLETE';
export type OnboardingPath = 'UNSELECTED' | 'PUBLIC_SAFE_EXAMPLE' | 'LOCAL_MATERIALS';
export type OnboardingState = 'MATERIAL_CHOICE' | 'MATERIALS_READY' | 'CONTEXT_READY' | 'COMPLETED';
export type LocalDataMode = 'LOCAL_PRIVATE' | 'PUBLIC_SAFE_EXAMPLE';
export type MaterialState = 'READY' | 'UNSUPPORTED' | 'REJECTED' | 'FAILED';
export type ReadinessState = 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_CONFIGURED' | 'UNKNOWN';
export type ManualPublishState = 'AWAITING_RECONCILIATION';

export type ManualPublishAuthorization = {
  state: 'BLOCKED';
  reasonCode: 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED';
  auditState: 'MISSING';
  ownerDecisionState: 'MISSING';
  requiredAuthorities: readonly ['INDEPENDENT_AUDIT_PASS', 'EXACT_EXTERNAL_ACTION_OWNER_DECISION'];
  remediationCodes: readonly ['SDD_007_REQUIRED', 'CONNECTOR_SDD_REQUIRED'];
  reviewExportAllowed: true;
  externalActionAllowed: false;
  handoffCreationAllowed: false;
};

export type LocalOwnerProfile = {
  schemaVersion: 1;
  id: string;
  displayName: string;
  state: LocalProfileState;
  createdAt: string;
  updatedAt: string;
};

export type LocalOnboardingSession = {
  schemaVersion: 1;
  ownerProfileId: string;
  path: OnboardingPath;
  state: OnboardingState;
  dataMode: LocalDataMode;
  organizationId: string | null;
  campaignId: string | null;
  marketCodes: string[];
  contentLocales: string[];
  platforms: string[];
  defaultTimeZone: string | null;
  materialIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type LocalMaterialManifest = {
  schemaVersion: 1;
  id: string;
  ownerProfileId: string;
  fileName: string;
  mediaType: 'text/markdown' | 'text/plain';
  byteSize: number;
  digest: string;
  state: MaterialState;
  extractedText: string | null;
  failureCode: string | null;
  blobRef: {algorithm: 'sha256'; digest: string; size: number} | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalOnboardingContext = {
  marketCodes: string[];
  contentLocales: string[];
  platforms: string[];
  defaultTimeZone: string;
};

export type EnvironmentReadinessItem = {
  service: 'WEB' | 'API' | 'POSTGRESQL' | 'AGENTTEAMS_ADAPTER' | 'AGENTTEAMS_RUNTIME';
  state: ReadinessState;
  source: 'CLIENT_OBSERVATION' | 'API_SELF_CHECK' | 'POSTGRESQL_PROBE' | 'BUILD_CONTRACT' | 'RUNTIME_CONFIGURATION';
  checkedAt: string;
  reasonCode: string;
  remediation: string | null;
};

export type ManualPublishHandoff = {
  schemaVersion: 1;
  id: string;
  ownerProfileId: string;
  campaignId: string;
  artifactRevisionId: string;
  platform: string;
  action: 'COPY_BODY' | 'DOWNLOAD_MEDIA' | 'OPEN_OFFICIAL_PAGE' | 'OWNER_REPORTED_COMPLETE';
  state: ManualPublishState;
  evidenceReceiptId: null;
  createdAt: string;
};

export type MaterialIngestInput = {
  ownerProfileId: string;
  fileName: string;
  declaredMediaType: string;
  bytes: Uint8Array;
};

export interface LocalPresenceRepository {
  health(): Promise<boolean>;
  getProfile(): Promise<LocalOwnerProfile | undefined>;
  createProfile(displayName: string, now: Date): Promise<LocalOwnerProfile>;
  getSession(ownerProfileId: string): Promise<LocalOnboardingSession | undefined>;
  chooseExample(ownerProfileId: string, organizationId: string, campaignId: string, context: LocalOnboardingContext, now: Date): Promise<LocalOnboardingSession>;
  selectLocalMaterials(ownerProfileId: string, now: Date): Promise<LocalOnboardingSession>;
  setContext(ownerProfileId: string, context: LocalOnboardingContext, now: Date): Promise<LocalOnboardingSession>;
  completeLocalOnboarding(ownerProfileId: string, organizationId: string, campaignId: string, now: Date): Promise<LocalOnboardingSession>;
  ingestMaterial(input: MaterialIngestInput, now: Date): Promise<LocalMaterialManifest>;
  listMaterials(ownerProfileId: string): Promise<LocalMaterialManifest[]>;
  deleteMaterial(ownerProfileId: string, materialId: string): Promise<boolean>;
  recordManualHandoff(input: Omit<ManualPublishHandoff, 'schemaVersion' | 'id' | 'state' | 'evidenceReceiptId' | 'createdAt'>, now: Date): Promise<ManualPublishHandoff>;
  listManualHandoffs(ownerProfileId: string): Promise<ManualPublishHandoff[]>;
  close(): Promise<void>;
}

export class LocalPresenceContractError extends Error {
  public constructor(public readonly code: string, message = code) {
    super(message);
    this.name = 'LocalPresenceContractError';
  }
}

export function blockedManualPublishAuthorization(): ManualPublishAuthorization {
  return {
    state: 'BLOCKED',
    reasonCode: 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED',
    auditState: 'MISSING',
    ownerDecisionState: 'MISSING',
    requiredAuthorities: ['INDEPENDENT_AUDIT_PASS', 'EXACT_EXTERNAL_ACTION_OWNER_DECISION'],
    remediationCodes: ['SDD_007_REQUIRED', 'CONNECTOR_SDD_REQUIRED'],
    reviewExportAllowed: true,
    externalActionAllowed: false,
    handoffCreationAllowed: false
  };
}

export function normalizeLocalDisplayName(value: unknown): string {
  if (typeof value !== 'string') throw new LocalPresenceContractError('LOCAL_DISPLAY_NAME_REQUIRED');
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (normalized.length < 1 || normalized.length > 64 || /[\p{Cc}\p{Cf}]/u.test(normalized)) {
    throw new LocalPresenceContractError('LOCAL_DISPLAY_NAME_INVALID');
  }
  return normalized;
}

export function validateOnboardingContext(value: unknown): LocalOnboardingContext {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'contentLocales,defaultTimeZone,marketCodes,platforms') {
    throw new LocalPresenceContractError('ONBOARDING_CONTEXT_SCHEMA_INVALID');
  }
  const marketCodes = validatedUniqueCodes(value.marketCodes, 12, /^[A-Z]{2}$/u, 'MARKET_CODE_INVALID');
  const contentLocales = validatedUniqueCodes(value.contentLocales, 12, /^[a-z]{2}(?:-[A-Z]{2})?$/u, 'CONTENT_LOCALE_INVALID');
  const platforms = validatedUniqueCodes(value.platforms, 4, /^(?:X|BLUESKY|LINKEDIN|XIAOHONGSHU)$/u, 'PLATFORM_CODE_INVALID');
  if (typeof value.defaultTimeZone !== 'string' || value.defaultTimeZone.length > 80 || !isIanaTimeZone(value.defaultTimeZone)) throw new LocalPresenceContractError('TIME_ZONE_INVALID');
  return {marketCodes, contentLocales, platforms, defaultTimeZone: value.defaultTimeZone};
}

function validatedUniqueCodes(value: unknown, maxItems: number, pattern: RegExp, code: string): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems || value.some((item) => typeof item !== 'string' || !pattern.test(item))) {
    throw new LocalPresenceContractError(code);
  }
  const unique = [...new Set(value)];
  if (unique.length !== value.length) throw new LocalPresenceContractError(code);
  return unique;
}

export function prepareLocalMaterial(input: MaterialIngestInput, now = new Date()): Omit<LocalMaterialManifest, 'blobRef'> {
  const fileName = safeFileName(input.fileName);
  if (input.bytes.byteLength === 0) throw new LocalPresenceContractError('LOCAL_MATERIAL_EMPTY');
  if (input.bytes.byteLength > LOCAL_MATERIAL_MAX_BYTES) throw new LocalPresenceContractError('LOCAL_MATERIAL_TOO_LARGE');
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (['.pdf', '.doc', '.docx'].includes(extension)) throw new LocalPresenceContractError('LOCAL_MATERIAL_TYPE_PLANNED');
  if (!['.md', '.txt'].includes(extension)) throw new LocalPresenceContractError('LOCAL_MATERIAL_TYPE_UNSUPPORTED');
  const acceptedDeclared = ['text/plain', 'text/markdown', 'application/octet-stream'];
  if (!acceptedDeclared.includes(input.declaredMediaType.toLowerCase())) throw new LocalPresenceContractError('LOCAL_MATERIAL_MEDIA_TYPE_MISMATCH');
  let extractedText: string;
  try { extractedText = new TextDecoder('utf-8', {fatal: true}).decode(input.bytes); }
  catch { throw new LocalPresenceContractError('LOCAL_MATERIAL_UTF8_REQUIRED'); }
  if (extractedText.includes('\u0000')) throw new LocalPresenceContractError('LOCAL_MATERIAL_BINARY_REJECTED');
  extractedText = extractedText.replace(/\r\n?/gu, '\n').normalize('NFC').trim();
  if (extractedText.length === 0) throw new LocalPresenceContractError('LOCAL_MATERIAL_EMPTY');
  const timestamp = now.toISOString();
  const digest = createHash('sha256').update(input.bytes).digest('hex');
  return {schemaVersion: 1, id: createUuidV7(now.getTime()), ownerProfileId: input.ownerProfileId, fileName, mediaType: extension === '.md' ? 'text/markdown' : 'text/plain', byteSize: input.bytes.byteLength, digest, state: 'READY', extractedText, failureCode: null, createdAt: timestamp, updatedAt: timestamp};
}

export function isSecretBearingObject(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const forbidden = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|cookie|authorization)/iu;
  return Object.entries(value).some(([key, child]) => forbidden.test(key) || (isRecord(child) && isSecretBearingObject(child)));
}

function safeFileName(value: string): string {
  const normalized = value.normalize('NFC').trim();
  if (normalized.length < 3 || normalized.length > 180 || normalized.includes('/') || normalized.includes('\\') || normalized === '.' || normalized === '..' || /[\p{Cc}\p{Cf}]/u.test(normalized)) throw new LocalPresenceContractError('LOCAL_MATERIAL_FILE_NAME_INVALID');
  return normalized;
}

function isIanaTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat('en-US', {timeZone: value}).format(new Date(0)); return value.includes('/'); }
  catch { return false; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
