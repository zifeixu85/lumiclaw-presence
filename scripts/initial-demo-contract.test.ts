import {describe, expect, it} from 'vitest';
import {
  DEMO_CONFIG,
  InitialDemoError,
  assertExactDemoTargets,
  assertPublicSafeEvidence,
  validatePreparedMission
} from './initial-demo-contract.mjs';

const digest = (character: string) => character.repeat(64);

function preparedMission() {
  const platforms = ['X', 'BLUESKY', 'LINKEDIN', 'XIAOHONGSHU'];
  const revisions = [
    {id: 'x-v1', platform: 'X', revision: 1, digest: digest('1')},
    {id: 'bluesky-v1', platform: 'BLUESKY', revision: 1, digest: digest('2')},
    {id: 'linkedin-v1', platform: 'LINKEDIN', revision: 1, digest: digest('3')},
    {id: 'xiaohongshu-v1', platform: 'XIAOHONGSHU', revision: 1, digest: digest('4')},
    {id: 'x-v2', platform: 'X', revision: 2, digest: digest('5')}
  ];
  return {
    id: 'mission-public-safe', state: 'NEEDS_OWNER_REVIEW', providerMode: 'PUBLIC_SAFE_MOCK', providerMaturity: 'MOCK_CONFORMANCE',
    externalActionAllowed: false, actionGrantCount: 0, connectorCount: 0, externalActionCount: 0,
    roleContexts: DEMO_CONFIG.roleIds.map((roleId) => ({roleId})),
    tasks: Array.from({length: 8}, (_, index) => ({id: `task-${index + 1}`})),
    skillLocks: Array.from({length: 5}, (_, index) => ({id: `skill-${index + 1}`})),
    revisions,
    audits: [
      {revisionId: 'x-v1', outcome: 'FAIL', status: 'INVALIDATED', issues: [{code: 'CLAIM_OVERREACH', nextResponsibleRoleId: 'founder-identity-producer', evidenceRefIds: ['evidence-public-safe']}]},
      ...platforms.map((platform) => ({revisionId: platform === 'X' ? 'x-v2' : `${platform.toLowerCase()}-v1`, outcome: 'PASS', status: 'ACTIVE', issues: []}))
    ],
    reviews: [], fault: {deniedRevisionId: 'x-v1', correctedRevisionId: 'x-v2'}
  };
}

describe('initial demo contract', () => {
  it('freezes exact destructive targets and rejects every override', () => {
    expect(assertExactDemoTargets(DEMO_CONFIG.root, DEMO_CONFIG.project, DEMO_CONFIG.evidenceRoot)).toEqual(DEMO_CONFIG);
    expect(() => assertExactDemoTargets(DEMO_CONFIG.root, 'another-project', DEMO_CONFIG.evidenceRoot)).toThrowError(/INITIAL_DEMO_PROJECT_TARGET_INVALID/u);
    expect(() => assertExactDemoTargets(DEMO_CONFIG.root, DEMO_CONFIG.project, DEMO_CONFIG.root)).toThrowError(/INITIAL_DEMO_EVIDENCE_TARGET_INVALID/u);
  });

  it('accepts only the exact prepared Auditor-fail-closed shape', () => {
    const summary = validatePreparedMission(preparedMission(), 'PREPARED');
    expect(summary).toMatchObject({roles: 6, tasks: 8, skillLocks: 5, revisions: 5, audits: 5, activePassRevisions: 4, reviews: 0, deniedRevisionId: 'x-v1'});
    const unsafe = preparedMission(); unsafe.externalActionCount = 1;
    expect(() => validatePreparedMission(unsafe, 'PREPARED')).toThrowError(/INITIAL_DEMO_EXTERNAL_ACTION_BOUNDARY_INVALID/u);
    const selfApproved = preparedMission(); selfApproved.audits[0].issues[0].nextResponsibleRoleId = 'independent-auditor';
    expect(() => validatePreparedMission(selfApproved, 'PREPARED')).toThrowError(/INITIAL_DEMO_AUDITOR_FAULT_INVALID/u);
  });

  it('accepts the exact completed non-executable review shape', () => {
    const completed = preparedMission(); completed.state = 'SHADOW_COMPLETE'; completed.reviews = completed.audits.slice(1).map((audit) => ({revisionId: audit.revisionId, authority: 'NON_EXECUTABLE_OWNER_REVIEW', createsActionGrant: false}));
    expect(validatePreparedMission(completed, 'COMPLETED')).toMatchObject({reviews: 4, state: 'SHADOW_COMPLETE'});
  });

  it('rejects credential, prompt, header, ticket, and private path evidence', () => {
    expect(assertPublicSafeEvidence({status: 'PASS', maturity: 'MOCK_CONFORMANCE', secretPresent: false})).toBe(true);
    for (const value of [
      {authorization: 'Bearer public-safe-marker'},
      {runtimeTicket: 'ticket-public-safe-marker'},
      {rawPrompt: 'prompt-public-safe-marker'},
      {path: '/Users/example/private/evidence.json'},
      {note: 'DEEPSEEK_API_KEY=public-safe-marker'}
    ]) expect(() => assertPublicSafeEvidence(value)).toThrow(InitialDemoError);
  });
});
