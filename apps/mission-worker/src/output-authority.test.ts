import {
  artifactProfiles,
  artifactSkills,
  controlledAuditFindings,
  sha256Digest,
  type ArtifactRevisionV3,
} from '@lumiclaw/domain';
import {describe, expect, it} from 'vitest';
import {createRuntimeAuditCandidate} from './output-authority.js';

const ownerId = 'owner-public-safe';
const actor = '@independent-auditor:matrix.local';
const revision: ArtifactRevisionV3 = {
  schemaVersion: 3,
  id: 'artifact-revision-1',
  ownerId,
  activationUnitId: 'unit-x',
  platformCode: 'X',
  revision: 1,
  parentRevisionId: null,
  producerRole: 'founder-identity-producer',
  producerIdentityId: '@founder-identity-producer:matrix.local',
  origin: 'AGENT',
  evidenceMaturity: 'AGENTTEAMS_RUNTIME',
  agentTeamsExecuted: true,
  artifactProfileRef: artifactProfiles.X,
  payload: {kind: 'X', mode: 'SINGLE', posts: [{position: 1, text: 'Public-safe governed revision.', mediaRefs: [], altText: null}], link: null, cta: null, language: 'en-US', accountProfileRevisionId: 'account-x', sourceBindings: []},
  inputBindings: {
    executionBundle: {id: 'bundle-1', digest: sha256Digest('bundle'), generation: 2, missionIntentId: 'mission-1'},
    operatingGoal: {id: 'goal-1', digest: sha256Digest('goal')},
    approvedPlan: {id: 'plan-1', digest: sha256Digest('plan')},
    knowledgeSnapshot: {id: 'snapshot-1', digest: sha256Digest('snapshot')},
    accountProfile: {id: 'account-x', digest: sha256Digest('account'), platformCode: 'X'},
    producerSkill: artifactSkills.X,
    artifactProfile: artifactProfiles.X,
    sourceSetDigest: sha256Digest([]),
  },
  canonicalDigest: sha256Digest('revision'),
  state: 'AWAITING_AUDIT',
  createdAt: '2026-08-23T01:00:00.000Z',
};
const modelValue = {artifactRevisionId: revision.id, auditorIdentityId: actor, evidenceBindings: [revision.canonicalDigest], findings: controlledAuditFindings('PASS'), result: 'PASS'};

describe('runtime audit authority clock', () => {
  it('uses only trusted worker time for the canonical audit timestamp', () => {
    const trustedAt = new Date('2026-09-01T00:00:00.000Z');
    const candidate = createRuntimeAuditCandidate(ownerId, revision, actor, modelValue, trustedAt);
    expect(candidate.payload).toMatchObject({createdAt: trustedAt.toISOString()});
    expect(() => createRuntimeAuditCandidate(ownerId, revision, actor, {...modelValue, createdAt: '2000-01-01T00:00:00.000Z'}, trustedAt)).toThrowError(expect.objectContaining({code: 'SUBMISSION_SCHEMA_INVALID'}));
  });

  it('rejects the same audit payload at trusted time after the platform profile expires', () => {
    expect(() => createRuntimeAuditCandidate(ownerId, revision, actor, modelValue, new Date('2026-09-22T00:00:00.000Z'))).toThrowError(expect.objectContaining({code: 'SUBMISSION_INPUT_MISMATCH', message: 'PLATFORM_CONSTRAINT_STALE'}));
  });
});
