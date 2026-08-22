import {createHash} from 'node:crypto';
import {sha256Digest} from './canonical.js';

export const KNOWLEDGE_SOURCE_MAX_BYTES = 2 * 1024 * 1024;
export const KNOWLEDGE_PLATFORMS = ['X', 'XIAOHONGSHU'] as const;
export const KNOWLEDGE_STEPS = ['PERSONA', 'ORGANIZATION_PRODUCT', 'SOURCES', 'X_ACCOUNT', 'XIAOHONGSHU_ACCOUNT', 'MARKET_CONTEXT', 'REVIEW'] as const;

export type KnowledgePlatform = typeof KNOWLEDGE_PLATFORMS[number];
export type KnowledgeStep = typeof KNOWLEDGE_STEPS[number];
export type KnowledgeOnboardingState = 'DRAFT' | 'NEEDS_OWNER_DECISION' | 'READY_FOR_APPROVAL' | 'KNOWLEDGE_APPROVED_NEEDS_GOAL';
export type KnowledgeSourceKind = 'UPLOADED_FILE' | 'OWNER_AUTHORED_TEXT' | 'LEGACY_LOCAL_MATERIAL' | 'PUBLIC_SAFE_EXAMPLE';
export type KnowledgeSourceStatus = 'READY' | 'LEGACY_NEEDS_REVIEW' | 'DELETED' | 'BLOB_MISSING';
export type KnowledgeSnapshotState = 'DRAFT' | 'NEEDS_OWNER' | 'APPROVED' | 'SUPERSEDED';
export type KnowledgeAuthority = 'CAMPAIGN_EXPLICIT' | 'ORGANIZATION_APPROVED_PRIVATE' | 'PUBLIC_MARKET_PACK' | 'MODEL_PRIOR_SUGGESTION';
export type KnowledgeSensitivity = 'LOCAL_PRIVATE' | 'PUBLIC_SAFE';
export type KnowledgeItemKind = 'PERSONA' | 'ORGANIZATION_FACT' | 'PRODUCT_FACT' | 'CLAIM' | 'EVIDENCE' | 'ACCOUNT_PROFILE' | 'SOURCE_EXCERPT';
export type ProfileKind = 'PERSONA' | 'ORGANIZATION' | 'PRODUCT' | 'ACCOUNT';

export const KNOWLEDGE_AUTHORITY_PRIORITY: Readonly<Record<KnowledgeAuthority, number>> = {
  CAMPAIGN_EXPLICIT: 4,
  ORGANIZATION_APPROVED_PRIVATE: 3,
  PUBLIC_MARKET_PACK: 2,
  MODEL_PRIOR_SUGGESTION: 1
};

export type KnowledgeOnboardingSession = {
  ownerId: string;
  state: KnowledgeOnboardingState;
  currentStep: KnowledgeStep;
  rowVersion: number;
  targetMarket: string | null;
  contentLocale: string | null;
  timeZone: string | null;
  currentSnapshotId: string | null;
  currentSnapshotDigest: string | null;
  updatedAt: string;
};

export type PersonaProfileInput = {
  displayName: string;
  role: string;
  voice: string;
  viewpoints: string[];
  expressionBoundaries: string[];
  firstPersonRelationship: string;
  expressionExamples: string[];
};

export type OrganizationProfileInput = {
  name: string;
  brandName: string;
  description: string;
  audiences: string[];
  facts: string[];
  approvedClaims: Array<{statement: string; evidence: string}>;
};

export type ProductProfileInput = {
  name: string;
  description: string;
  valueProposition: string;
  audiences: string[];
  facts: string[];
  approvedClaims: Array<{statement: string; evidence: string}>;
};

export type AccountOperatingProfileInput = {
  platformCode: KnowledgePlatform;
  accountExists: boolean;
  handleOrDisplayName: string;
  producerMandates: Array<'FOUNDER_VOICE' | 'PRODUCT_EXPERTISE'>;
  rolePersona: string;
  audience: string[];
  targetMarket: string;
  contentLocale: string;
  contentPillars: string[];
  expressionExamples: string[];
  dos: string[];
  donts: string[];
  ctaPolicy: string;
  cadenceHint: string;
};

export type ProfileRevision = {
  id: string;
  ownerId: string;
  kind: ProfileKind;
  platformCode: KnowledgePlatform | null;
  version: number;
  digest: string;
  payload: PersonaProfileInput | OrganizationProfileInput | ProductProfileInput | AccountOperatingProfileInput;
  createdAt: string;
};

export type SourceCandidateInput = {kind: Exclude<KnowledgeItemKind, 'PERSONA' | 'ACCOUNT_PROFILE' | 'SOURCE_EXCERPT'>; value: string};
export type KnowledgeSourceInput = {ownerId: string; label: string; fileName: string; declaredMediaType: string; bytes: Uint8Array; candidates?: SourceCandidateInput[]};
export type KnowledgeTextSourceInput = {ownerId: string; label: string; text: string; candidates: SourceCandidateInput[]};

export type SourceDocumentRevision = {
  id: string;
  documentId: string;
  ownerId: string;
  version: number;
  sourceKind: KnowledgeSourceKind;
  label: string;
  fileName: string | null;
  mediaType: 'text/markdown' | 'text/plain';
  byteSize: number;
  blobDigest: string;
  blobRef: {algorithm: 'sha256'; digest: string; size: number};
  extractedTextDigest: string;
  extractedText: string;
  status: KnowledgeSourceStatus;
  sensitivity: KnowledgeSensitivity;
  createdAt: string;
  deletedAt: string | null;
};

export type KnowledgeItem = {
  id: string;
  kind: KnowledgeItemKind;
  normalizedValue: string;
  sourceRevisionIds: string[];
  profileRevisionIds: string[];
  ownerAuthority: KnowledgeAuthority;
  sensitivity: KnowledgeSensitivity;
};

export type KnowledgeConflict = {
  id: string;
  itemIds: string[];
  reasonCode: 'INCOMPATIBLE_VALUES';
  ownerResolution: {selectedItemId: string; note: string} | null;
  state: 'NEEDS_OWNER_DECISION' | 'RESOLVED';
};

export type KnowledgeGapCode = 'PERSONA_REQUIRED' | 'ORGANIZATION_REQUIRED' | 'PRODUCT_REQUIRED' | 'X_ACCOUNT_REQUIRED' | 'XIAOHONGSHU_ACCOUNT_REQUIRED' | 'SOURCE_REQUIRED' | 'MARKET_REQUIRED' | 'CONTENT_LOCALE_REQUIRED' | 'TIME_ZONE_REQUIRED' | 'SOURCE_REVIEW_REQUIRED' | 'SOURCE_BLOB_MISSING';

export type KnowledgeSnapshot = {
  id: string;
  ownerId: string;
  version: number;
  state: KnowledgeSnapshotState;
  sessionRowVersion: number;
  sourceRevisionDigests: Array<{revisionId: string; digest: string}>;
  profileRevisionDigests: Array<{revisionId: string; digest: string}>;
  itemBindings: KnowledgeItem[];
  conflictDecisions: KnowledgeConflict[];
  gaps: KnowledgeGapCode[];
  canonicalDigest: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type KnowledgeOverview = {
  session: KnowledgeOnboardingSession;
  sources: SourceDocumentRevision[];
  profiles: {persona: ProfileRevision | null; organization: ProfileRevision | null; product: ProfileRevision | null; accounts: Partial<Record<KnowledgePlatform, ProfileRevision>>};
  draft: KnowledgeSnapshot | null;
  approvedHistory: KnowledgeSnapshot[];
};

export type KnowledgeRoleContext = {
  snapshotId: string;
  snapshotDigest: string;
  ownerId: string;
  targetMarket: string;
  contentLocale: string;
  timeZone: string;
  items: Array<Pick<KnowledgeItem, 'id' | 'kind' | 'normalizedValue' | 'sourceRevisionIds' | 'profileRevisionIds' | 'ownerAuthority'>>;
  sourceDigests: Array<{revisionId: string; digest: string}>;
  profileDigests: Array<{revisionId: string; digest: string}>;
};

export type KnowledgeSnapshotSupersession = {
  eventId: string;
  ownerId: string;
  supersededSnapshotId: string;
  supersededSnapshotDigest: string;
  approvedSnapshotId: string;
  approvedSnapshotDigest: string;
  createdAt: string;
};

export interface KnowledgeRepository {
  health(): Promise<boolean>;
  ensureOwner(ownerId: string, now: Date): Promise<KnowledgeOverview>;
  getOverview(ownerId: string): Promise<KnowledgeOverview>;
  updateSession(ownerId: string, input: {currentStep: KnowledgeStep; targetMarket?: string | null; contentLocale?: string | null; timeZone?: string | null}, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview>;
  saveProfile(ownerId: string, kind: ProfileKind, platform: KnowledgePlatform | null, payload: unknown, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview>;
  ingestSource(input: KnowledgeSourceInput, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview>;
  ingestTextSource(input: KnowledgeTextSourceInput, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview>;
  getSource(ownerId: string, documentId: string): Promise<SourceDocumentRevision | undefined>;
  getProfileRevision(ownerId: string, revisionId: string): Promise<ProfileRevision | undefined>;
  deleteSource(ownerId: string, documentId: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview>;
  confirmLegacySource(ownerId: string, documentId: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview>;
  resolveConflict(ownerId: string, conflictId: string, selectedItemId: string, note: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview>;
  approveSnapshot(ownerId: string, snapshotId: string, canonicalDigest: string, expectedVersion: number, idempotencyKey: string, now: Date): Promise<KnowledgeOverview>;
  getRoleContext(ownerId: string, snapshotId: string, canonicalDigest: string): Promise<KnowledgeRoleContext>;
  listPendingSnapshotSupersessions(ownerId: string): Promise<KnowledgeSnapshotSupersession[]>;
  acknowledgeSnapshotSupersession(ownerId: string, eventId: string, now: Date): Promise<void>;
  recordSecurityRejection(ownerId: string, eventCode: string, now: Date): Promise<void>;
  close(): Promise<void>;
}

export class KnowledgeContractError extends Error {
  public constructor(public readonly code: string, message = code) { super(message); this.name = 'KnowledgeContractError'; }
}

export function validatePersonaProfile(value: unknown): PersonaProfileInput {
  assertExactObject(value, ['displayName', 'role', 'voice', 'viewpoints', 'expressionBoundaries', 'firstPersonRelationship', 'expressionExamples'], 'PERSONA_PROFILE_SCHEMA_INVALID');
  return {displayName: text(value.displayName, 120, 'PERSONA_DISPLAY_NAME_INVALID'), role: text(value.role, 300, 'PERSONA_ROLE_INVALID'), voice: text(value.voice, 1200, 'PERSONA_VOICE_INVALID'), viewpoints: textArray(value.viewpoints, 12, 500, 'PERSONA_VIEWPOINT_INVALID'), expressionBoundaries: textArray(value.expressionBoundaries, 16, 500, 'PERSONA_BOUNDARY_INVALID'), firstPersonRelationship: text(value.firstPersonRelationship, 1000, 'PERSONA_RELATIONSHIP_INVALID'), expressionExamples: textArray(value.expressionExamples, 12, 1000, 'PERSONA_EXAMPLE_INVALID')};
}

export function validateOrganizationProfile(value: unknown): OrganizationProfileInput {
  assertExactObject(value, ['name', 'brandName', 'description', 'audiences', 'facts', 'approvedClaims'], 'ORGANIZATION_PROFILE_SCHEMA_INVALID');
  return {name: text(value.name, 160, 'ORGANIZATION_NAME_INVALID'), brandName: text(value.brandName, 160, 'BRAND_NAME_INVALID'), description: text(value.description, 3000, 'ORGANIZATION_DESCRIPTION_INVALID'), audiences: textArray(value.audiences, 16, 500, 'ORGANIZATION_AUDIENCE_INVALID'), facts: textArray(value.facts, 40, 1000, 'ORGANIZATION_FACT_INVALID'), approvedClaims: claims(value.approvedClaims)};
}

export function validateProductProfile(value: unknown): ProductProfileInput {
  assertExactObject(value, ['name', 'description', 'valueProposition', 'audiences', 'facts', 'approvedClaims'], 'PRODUCT_PROFILE_SCHEMA_INVALID');
  return {name: text(value.name, 160, 'PRODUCT_NAME_INVALID'), description: text(value.description, 3000, 'PRODUCT_DESCRIPTION_INVALID'), valueProposition: text(value.valueProposition, 2000, 'PRODUCT_VALUE_INVALID'), audiences: textArray(value.audiences, 16, 500, 'PRODUCT_AUDIENCE_INVALID'), facts: textArray(value.facts, 40, 1000, 'PRODUCT_FACT_INVALID'), approvedClaims: claims(value.approvedClaims)};
}

export function validateAccountProfile(value: unknown, platform: KnowledgePlatform): AccountOperatingProfileInput {
  assertExactObject(value, ['platformCode', 'accountExists', 'handleOrDisplayName', 'producerMandates', 'rolePersona', 'audience', 'targetMarket', 'contentLocale', 'contentPillars', 'expressionExamples', 'dos', 'donts', 'ctaPolicy', 'cadenceHint'], 'ACCOUNT_PROFILE_SCHEMA_INVALID');
  if (value.platformCode !== platform || !KNOWLEDGE_PLATFORMS.includes(value.platformCode as KnowledgePlatform)) throw new KnowledgeContractError('ACCOUNT_PLATFORM_MISMATCH');
  if (typeof value.accountExists !== 'boolean') throw new KnowledgeContractError('ACCOUNT_EXISTS_CONFIRMATION_REQUIRED');
  const producerMandates = enums(value.producerMandates, ['FOUNDER_VOICE', 'PRODUCT_EXPERTISE'] as const, 2, 'ACCOUNT_MANDATE_INVALID');
  return {platformCode: platform, accountExists: value.accountExists, handleOrDisplayName: text(value.handleOrDisplayName, 160, 'ACCOUNT_HANDLE_INVALID'), producerMandates, rolePersona: text(value.rolePersona, 1000, 'ACCOUNT_ROLE_INVALID'), audience: textArray(value.audience, 16, 500, 'ACCOUNT_AUDIENCE_INVALID'), targetMarket: market(value.targetMarket), contentLocale: locale(value.contentLocale), contentPillars: textArray(value.contentPillars, 16, 500, 'ACCOUNT_PILLAR_INVALID'), expressionExamples: textArray(value.expressionExamples, 12, 1000, 'ACCOUNT_EXAMPLE_INVALID'), dos: textArray(value.dos, 20, 500, 'ACCOUNT_DO_INVALID'), donts: textArray(value.donts, 20, 500, 'ACCOUNT_DONT_INVALID'), ctaPolicy: text(value.ctaPolicy, 1000, 'ACCOUNT_CTA_INVALID'), cadenceHint: text(value.cadenceHint, 500, 'ACCOUNT_CADENCE_INVALID')};
}

export function validateKnowledgeSessionInput(value: unknown): {currentStep: KnowledgeStep; targetMarket?: string | null; contentLocale?: string | null; timeZone?: string | null} {
  if (!isRecord(value) || Object.keys(value).some((key) => !['currentStep', 'targetMarket', 'contentLocale', 'timeZone'].includes(key)) || !KNOWLEDGE_STEPS.includes(value.currentStep as KnowledgeStep)) throw new KnowledgeContractError('ONBOARDING_SESSION_SCHEMA_INVALID');
  const result: {currentStep: KnowledgeStep; targetMarket?: string | null; contentLocale?: string | null; timeZone?: string | null} = {currentStep: value.currentStep as KnowledgeStep};
  if ('targetMarket' in value) result.targetMarket = value.targetMarket === null ? null : market(value.targetMarket);
  if ('contentLocale' in value) result.contentLocale = value.contentLocale === null ? null : locale(value.contentLocale);
  if ('timeZone' in value) result.timeZone = value.timeZone === null ? null : timeZone(value.timeZone);
  return result;
}

export function validateTextSource(value: unknown): {label: string; text: string; candidates: SourceCandidateInput[]} {
  assertExactObject(value, ['label', 'text', 'candidates'], 'SOURCE_TEXT_SCHEMA_INVALID');
  const sourceText = text(value.text, KNOWLEDGE_SOURCE_MAX_BYTES, 'SOURCE_TEXT_INVALID');
  const candidates = candidateInputs(value.candidates);
  return {label: text(value.label, 180, 'SOURCE_LABEL_INVALID'), text: sourceText, candidates};
}

export function validateSourceCandidates(value: unknown): SourceCandidateInput[] { return value === undefined ? [] : candidateInputs(value); }

export function prepareKnowledgeSource(input: KnowledgeSourceInput | KnowledgeTextSourceInput, now: Date, sourceKind: KnowledgeSourceKind): Omit<SourceDocumentRevision, 'id' | 'documentId' | 'version' | 'status' | 'deletedAt'> & {candidates: SourceCandidateInput[]} {
  const bytes = 'bytes' in input ? input.bytes : new TextEncoder().encode(input.text);
  if (bytes.byteLength === 0) throw new KnowledgeContractError('SOURCE_EMPTY');
  if (bytes.byteLength > KNOWLEDGE_SOURCE_MAX_BYTES) throw new KnowledgeContractError('SOURCE_TOO_LARGE');
  let extractedText: string;
  try { extractedText = new TextDecoder('utf-8', {fatal: true}).decode(bytes).replace(/\r\n?/gu, '\n').normalize('NFC').trim(); } catch { throw new KnowledgeContractError('SOURCE_INVALID_UTF8'); }
  if (extractedText.length === 0) throw new KnowledgeContractError('SOURCE_EMPTY');
  if (extractedText.includes('\u0000')) throw new KnowledgeContractError('SOURCE_INVALID_UTF8');
  if (containsSecretValue(extractedText)) throw new KnowledgeContractError('SOURCE_SECRET_SHAPED_VALUE_FORBIDDEN');
  const label = text(input.label, 180, 'SOURCE_LABEL_INVALID');
  let mediaType: 'text/markdown' | 'text/plain' = 'text/plain';
  let fileName: string | null = null;
  if ('fileName' in input) {
    fileName = safeFileName(input.fileName);
    const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    if (['.pdf', '.doc', '.docx', '.mp3', '.m4a', '.wav'].includes(extension)) throw new KnowledgeContractError('SOURCE_TYPE_PLANNED');
    if (!['.md', '.txt'].includes(extension)) throw new KnowledgeContractError('SOURCE_TYPE_PLANNED');
    const declared = input.declaredMediaType.toLowerCase();
    if (!['text/plain', 'text/markdown', 'application/octet-stream'].includes(declared)) throw new KnowledgeContractError('SOURCE_DIGEST_MISMATCH');
    mediaType = extension === '.md' ? 'text/markdown' : 'text/plain';
  }
  const blobDigest = createHash('sha256').update(bytes).digest('hex');
  return {ownerId: input.ownerId, sourceKind, label, fileName, mediaType, byteSize: bytes.byteLength, blobDigest, blobRef: {algorithm: 'sha256', digest: blobDigest, size: bytes.byteLength}, extractedTextDigest: createHash('sha256').update(extractedText, 'utf8').digest('hex'), extractedText, sensitivity: sourceKind === 'PUBLIC_SAFE_EXAMPLE' ? 'PUBLIC_SAFE' : 'LOCAL_PRIVATE', createdAt: now.toISOString(), candidates: input.candidates ?? []};
}

export function profilePayload(kind: ProfileKind, platform: KnowledgePlatform | null, value: unknown): ProfileRevision['payload'] {
  if (kind === 'PERSONA') return validatePersonaProfile(value);
  if (kind === 'ORGANIZATION') return validateOrganizationProfile(value);
  if (kind === 'PRODUCT') return validateProductProfile(value);
  if (platform === null) throw new KnowledgeContractError('ACCOUNT_PLATFORM_REQUIRED');
  return validateAccountProfile(value, platform);
}

export function profileKnowledgeItems(revision: ProfileRevision): Array<Omit<KnowledgeItem, 'id'>> {
  const common = {sourceRevisionIds: [] as string[], profileRevisionIds: [revision.id], ownerAuthority: 'ORGANIZATION_APPROVED_PRIVATE' as const, sensitivity: 'LOCAL_PRIVATE' as const};
  const payload = revision.payload;
  if (revision.kind === 'PERSONA') return [{...common, kind: 'PERSONA', normalizedValue: JSON.stringify(payload)}];
  if (revision.kind === 'ACCOUNT') return [{...common, kind: 'ACCOUNT_PROFILE', normalizedValue: JSON.stringify(payload)}];
  const organization = revision.kind === 'ORGANIZATION' ? payload as OrganizationProfileInput : null;
  const product = revision.kind === 'PRODUCT' ? payload as ProductProfileInput : null;
  const result: Array<Omit<KnowledgeItem, 'id'>> = [];
  for (const fact of organization?.facts ?? product?.facts ?? []) result.push({...common, kind: revision.kind === 'ORGANIZATION' ? 'ORGANIZATION_FACT' : 'PRODUCT_FACT', normalizedValue: fact});
  for (const claim of organization?.approvedClaims ?? product?.approvedClaims ?? []) {
    result.push({...common, kind: 'CLAIM', normalizedValue: claim.statement});
    result.push({...common, kind: 'EVIDENCE', normalizedValue: claim.evidence});
  }
  result.push({...common, kind: revision.kind === 'ORGANIZATION' ? 'ORGANIZATION_FACT' : 'PRODUCT_FACT', normalizedValue: JSON.stringify(payload)});
  return result;
}

export function snapshotCanonicalPayload(snapshot: Omit<KnowledgeSnapshot, 'canonicalDigest' | 'approvedBy' | 'approvedAt' | 'createdAt' | 'state'>): unknown {
  return {ownerId: snapshot.ownerId, version: snapshot.version, sessionRowVersion: snapshot.sessionRowVersion, sourceRevisionDigests: snapshot.sourceRevisionDigests, profileRevisionDigests: snapshot.profileRevisionDigests, itemBindings: snapshot.itemBindings, conflictDecisions: snapshot.conflictDecisions, gaps: snapshot.gaps};
}

export function snapshotDigest(snapshot: Omit<KnowledgeSnapshot, 'canonicalDigest' | 'approvedBy' | 'approvedAt' | 'createdAt' | 'state'>): string { return sha256Digest(snapshotCanonicalPayload(snapshot)); }

export function knowledgeEtag(rowVersion: number): string { return `\"knowledge-${rowVersion}\"`; }
export function orderKnowledgeItemsForOwnerDecision<T extends Pick<KnowledgeItem, 'id' | 'ownerAuthority'>>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => KNOWLEDGE_AUTHORITY_PRIORITY[right.ownerAuthority] - KNOWLEDGE_AUTHORITY_PRIORITY[left.ownerAuthority] || left.id.localeCompare(right.id, 'en-US'));
}
export function knowledgeAuthorityRequiresOwnerConfirmation(authority: KnowledgeAuthority): boolean { return authority === 'MODEL_PRIOR_SUGGESTION'; }
export function parseKnowledgeEtag(value: string | undefined): number {
  const match = /^"knowledge-(\d+)"$/u.exec(value ?? '');
  if (match === null) throw new KnowledgeContractError('ETAG_REQUIRED');
  return Number.parseInt(match[1]!, 10);
}

export function isSecretBearingKnowledgeObject(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const forbidden = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|oauth|secret|password|cookie|authorization)/iu;
  return Object.entries(value).some(([key, child]) => forbidden.test(key) || (typeof child === 'string' && containsSecretValue(child)) || (isRecord(child) && isSecretBearingKnowledgeObject(child)) || (Array.isArray(child) && child.some((item) => isRecord(item) ? isSecretBearingKnowledgeObject(item) : typeof item === 'string' && containsSecretValue(item))));
}

function candidateInputs(value: unknown): SourceCandidateInput[] {
  if (!Array.isArray(value) || value.length > 40) throw new KnowledgeContractError('SOURCE_CANDIDATE_SCHEMA_INVALID');
  return value.map((candidate) => {
    assertExactObject(candidate, ['kind', 'value'], 'SOURCE_CANDIDATE_SCHEMA_INVALID');
    if (!['ORGANIZATION_FACT', 'PRODUCT_FACT', 'CLAIM', 'EVIDENCE'].includes(String(candidate.kind))) throw new KnowledgeContractError('SOURCE_CANDIDATE_KIND_INVALID');
    return {kind: candidate.kind as SourceCandidateInput['kind'], value: text(candidate.value, 2000, 'SOURCE_CANDIDATE_VALUE_INVALID')};
  });
}

function claims(value: unknown): Array<{statement: string; evidence: string}> {
  if (!Array.isArray(value) || value.length > 20) throw new KnowledgeContractError('APPROVED_CLAIM_INVALID');
  return value.map((claim) => { assertExactObject(claim, ['statement', 'evidence'], 'APPROVED_CLAIM_INVALID'); return {statement: text(claim.statement, 2000, 'APPROVED_CLAIM_INVALID'), evidence: text(claim.evidence, 2000, 'APPROVED_EVIDENCE_INVALID')}; });
}

function text(value: unknown, max: number, code: string): string {
  if (typeof value !== 'string') throw new KnowledgeContractError(code);
  const normalized = value.normalize('NFC').trim().replace(/[\t ]+/gu, ' ');
  if (normalized.length < 1 || Array.from(normalized).length > max || /[\p{Cc}\p{Cf}]/u.test(normalized.replace(/\n/gu, ''))) throw new KnowledgeContractError(code);
  if (containsSecretValue(normalized)) throw new KnowledgeContractError('SECRET_SHAPED_VALUE_FORBIDDEN');
  return normalized;
}
function textArray(value: unknown, maxItems: number, maxText: number, code: string): string[] { if (!Array.isArray(value) || value.length < 1 || value.length > maxItems) throw new KnowledgeContractError(code); const result = value.map((item) => text(item, maxText, code)); return [...new Set(result)]; }
function enums<const T extends readonly string[]>(value: unknown, values: T, maxItems: number, code: string): T[number][] { if (!Array.isArray(value) || value.length < 1 || value.length > maxItems || value.some((item) => typeof item !== 'string' || !values.includes(item as T[number]))) throw new KnowledgeContractError(code); return [...new Set(value)] as T[number][]; }
function market(value: unknown): string { if (typeof value !== 'string' || !/^[A-Z]{2}$/u.test(value)) throw new KnowledgeContractError('MARKET_CODE_INVALID'); return value; }
function locale(value: unknown): string { if (typeof value !== 'string' || !/^[a-z]{2}(?:-[A-Z]{2})?$/u.test(value)) throw new KnowledgeContractError('CONTENT_LOCALE_INVALID'); return value; }
function timeZone(value: unknown): string { if (typeof value !== 'string' || value.length > 80) throw new KnowledgeContractError('TIME_ZONE_INVALID'); try { new Intl.DateTimeFormat('en-US', {timeZone: value}).format(new Date(0)); } catch { throw new KnowledgeContractError('TIME_ZONE_INVALID'); } if (!value.includes('/')) throw new KnowledgeContractError('TIME_ZONE_INVALID'); return value; }
function safeFileName(value: string): string { const normalized = value.normalize('NFC').trim(); if (normalized.length < 3 || normalized.length > 180 || normalized.includes('/') || normalized.includes('\\') || /[\p{Cc}\p{Cf}]/u.test(normalized)) throw new KnowledgeContractError('SOURCE_FILE_NAME_INVALID'); return normalized; }
function containsSecretValue(value: string): boolean { return /(?:\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~-]{16,})/u.test(value); }
function assertExactObject(value: unknown, keys: readonly string[], code: string): asserts value is Record<string, unknown> { if (!isRecord(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw new KnowledgeContractError(code); }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
