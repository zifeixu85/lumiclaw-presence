import {GoalPlanContractError, createDemoCampaignDocument, sha256Digest} from '@lumiclaw/domain';
import {describe, expect, it} from 'vitest';
import {approveContentPlanV2, compileMissionAdapterInput, compileMissionIntentV2, continueSelectedPlatformMissionV2, importPlannerSubmissionV2, reviseContentPlanV2} from './index.js';
import {controlledPlannerSubmission, createV2Fixture} from './v2-fixture.js';

describe('M1 mission compiler smoke', () => {
  it('imports one persisted digest into six separated non-live adapter roles', () => {
    const input = compileMissionAdapterInput(createDemoCampaignDocument(), new Date('2026-08-03T12:00:00.000Z'));
    expect(input.live).toBe(false);
    expect(input.externalActionAllowed).toBe(false);
    expect(input.roles).toHaveLength(6);
    expect(input.roles.find((role) => role.id === 'presence-mission-leader')).toEqual(expect.objectContaining({orchestrationOnly: true, permissions: ['ORCHESTRATE']}));
    expect(input.roles.find((role) => role.id === 'independent-auditor')?.permissions).toEqual(['AUDIT']);
    expect(input.artifacts.map((item) => item.platform)).toEqual(['X', 'XIAOHONGSHU', 'BLUESKY', 'LINKEDIN']);
  });
});

describe('SDD-009 selected-platform compiler v2', () => {
  it.each([7,30] as const)('compiles a deterministic %s-day Intent → controlled plan → exact approval → Execution lineage', (horizonDays) => {
    const fixture = createV2Fixture({horizonDays});
    const first = compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});
    const second = compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});
    expect(second).toEqual(first);
    expect(first.roles).toHaveLength(6);
    expect(first.roleContexts).toHaveLength(6);
    expect(first.roles.find((role) => role.roleId === 'presence-mission-leader')).toMatchObject({orchestrationOnly:true});
    const submission = controlledPlannerSubmission(fixture.goal,fixture.accounts);
    const draft = importPlannerSubmissionV2(first,submission,'2026-08-22T01:00:00.000Z');
    expect(draft.slots).toHaveLength(horizonDays);
    expect(draft.state).toBe('NEEDS_OWNER');
    const approved = approveContentPlanV2(first,draft,draft.canonicalDigest,'2026-08-22T02:00:00.000Z');
    const execution = continueSelectedPlatformMissionV2(first,approved);
    expect(continueSelectedPlatformMissionV2(first,approved)).toEqual(execution);
    expect(execution.parentBundleDigest).toBe(first.canonicalDigest);
    expect(execution.approvedPlanDigest).toBe(approved.canonicalDigest);
    expect(execution.roles).toHaveLength(6);
    expect(execution.tasks.filter((task) => task.kind === 'PRODUCE_CONTENT')).toHaveLength(2);
    expect(execution.evidenceContract).toEqual({agentTeamsExecuted:false,fixtureAllowed:true,externalActionAllowed:false});
  });

  it.each([
    {platform:'X' as const, forbidden:['XIAOHONGSHU','BLUESKY','LINKEDIN']},
    {platform:'XIAOHONGSHU' as const, forbidden:['X','BLUESKY','LINKEDIN']}
  ])('never materializes unselected platforms for $platform-only dual-mandate input', ({platform,forbidden}) => {
    const fixture = createV2Fixture({platforms:[platform],dualMandateSingleAccount:true});
    const intent = compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});
    const draft = importPlannerSubmissionV2(intent,controlledPlannerSubmission(fixture.goal,fixture.accounts),'2026-08-22T01:00:00.000Z');
    const execution = continueSelectedPlatformMissionV2(intent,approveContentPlanV2(intent,draft,draft.canonicalDigest,'2026-08-22T02:00:00.000Z'));
    expect(execution.selectedPlatforms).toEqual([platform]);
    expect(new Set(execution.activationUnits.map((unit) => unit.platformCode))).toEqual(new Set([platform]));
    expect(new Set(execution.expectedArtifactSchemas.map((schema) => schema.platformCode))).toEqual(new Set([platform]));
    for (const code of forbidden) expect(execution.selectedPlatforms).not.toContain(code);
    const serialized = JSON.stringify(execution);
    for (const code of forbidden) expect(serialized).not.toContain(`\"${code}\"`);
  });

  it('assigns different substantive X Founder and XHS Product work to the two Producers', () => {
    const fixture = createV2Fixture();
    const intent = compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});
    const draft = importPlannerSubmissionV2(intent,controlledPlannerSubmission(fixture.goal,fixture.accounts),'2026-08-22T01:00:00.000Z');
    const execution = continueSelectedPlatformMissionV2(intent,approveContentPlanV2(intent,draft,draft.canonicalDigest,'2026-08-22T02:00:00.000Z'));
    const producers = execution.tasks.filter((task) => task.kind === 'PRODUCE_CONTENT');
    expect(producers.map((task) => task.roleId).sort()).toEqual(['founder-identity-producer','product-account-producer']);
    expect(producers[0]?.inputDigest).not.toBe(producers[1]?.inputDigest);
    expect(producers[0]?.mandate).not.toBe(producers[1]?.mandate);
    expect(new Set(execution.activationUnits.map((unit) => unit.platformCode))).toEqual(new Set(['X','XIAOHONGSHU']));
  });

  it('fails closed on missing Producer coverage rather than creating an empty Leader substitute', () => {
    const fixture = createV2Fixture({platforms:['X'],missingProductCoverage:true});
    expect(() => compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts})).toThrowError(expect.objectContaining({code:'PRODUCER_COVERAGE_REQUIRED'}));
  });

  it('validates Planner role/input/schema/skill digests and exact Plan approval', () => {
    const fixture = createV2Fixture();
    const intent = compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});
    const submission = controlledPlannerSubmission(fixture.goal,fixture.accounts);
    expect(() => importPlannerSubmissionV2(intent,{...submission,skillLockDigest:'0'.repeat(64)},'2026-08-22T01:00:00.000Z')).toThrowError(expect.objectContaining({code:'PLANNER_SUBMISSION_SKILL_MISMATCH'}));
    expect(() => importPlannerSubmissionV2(intent,{...submission,roleId:'independent-auditor' as 'campaign-planner'},'2026-08-22T01:00:00.000Z')).toThrowError(expect.objectContaining({code:'PLANNER_SUBMISSION_ROLE_MISMATCH'}));
    expect(() => importPlannerSubmissionV2(intent,{...submission,inputDigest:'0'.repeat(64)},'2026-08-22T01:00:00.000Z')).toThrowError(expect.objectContaining({code:'PLANNER_SUBMISSION_INPUT_MISMATCH'}));
    expect(() => importPlannerSubmissionV2(intent,{...submission,outputSchemaDigest:'0'.repeat(64)},'2026-08-22T01:00:00.000Z')).toThrowError(expect.objectContaining({code:'PLANNER_SUBMISSION_SCHEMA_MISMATCH'}));
    expect(() => importPlannerSubmissionV2(intent,{...submission,slots:submission.slots.slice(0,-1)},'2026-08-22T01:00:00.000Z')).toThrowError(expect.objectContaining({code:'PLAN_SLOT_COVERAGE_INVALID'}));
    const impossible=structuredClone(submission);impossible.slots[0]!.localDate='2026-02-30';
    expect(() => importPlannerSubmissionV2(intent,impossible,'2026-08-22T01:00:00.000Z')).toThrowError(expect.objectContaining({code:'PLAN_SCHEMA_INVALID'}));
    const draft = importPlannerSubmissionV2(intent,submission,'2026-08-22T01:00:00.000Z');
    expect(() => approveContentPlanV2(intent,draft,'0'.repeat(64),'2026-08-22T02:00:00.000Z')).toThrowError(expect.objectContaining({code:'PLAN_DIGEST_MISMATCH'}));
  });

  it('appends same-Mission Intent, Plan and Execution generations without overwriting history',()=>{
    const fixture=createV2Fixture();const first=compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});const submission1=controlledPlannerSubmission(fixture.goal,fixture.accounts);const plan1=importPlannerSubmissionV2(first,submission1,'2026-08-22T01:00:00.000Z');const approved1=approveContentPlanV2(first,plan1,plan1.canonicalDigest,'2026-08-22T02:00:00.000Z');const execution1=continueSelectedPlatformMissionV2(first,approved1);
    const nextGoal={...fixture.goal,revision:fixture.goal.revision+1,canonicalDigest:'b'.repeat(64)};const nextKnowledge={...fixture.knowledge,snapshotId:nextGoal.knowledgeSnapshotId,snapshotDigest:nextGoal.knowledgeSnapshotDigest};const second=compileMissionIntentV2({goal:nextGoal,knowledge:nextKnowledge,accountProfiles:fixture.accounts,lineage:{generation:execution1.generation+1,parentBundleId:execution1.bundleId,parentBundleDigest:execution1.canonicalDigest}});
    expect(second.missionIntentId).toBe(first.missionIntentId);expect(second.generation).toBeGreaterThan(execution1.generation);expect(second.parentBundleDigest).toBe(execution1.canonicalDigest);
    const planner=second.tasks.find((task)=>task.roleId==='campaign-planner')!;const template=controlledPlannerSubmission(nextGoal,fixture.accounts);const submission2={...template,intentBundleId:second.bundleId,intentBundleDigest:second.canonicalDigest,taskId:planner.taskId,inputDigest:planner.inputDigest,skillLockDigest:planner.skillLockDigest};const plan2=importPlannerSubmissionV2(second,submission2,'2026-08-23T01:00:00.000Z',approved1);expect(plan2.planId).toBe(plan1.planId);expect(plan2.revision).toBe(approved1.revision+1);expect(plan2.parentDigest).toBe(approved1.canonicalDigest);const approved2=approveContentPlanV2(second,plan2,plan2.canonicalDigest,'2026-08-23T02:00:00.000Z');const execution2=continueSelectedPlatformMissionV2(second,approved2);expect(execution2.generation).toBeGreaterThan(second.generation);expect(execution2.bundleId).not.toBe(execution1.bundleId);
  });

  it('creates a new revision and digest for an Owner slot edit', () => {
    const fixture = createV2Fixture();
    const intent = compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});
    const draft = importPlannerSubmissionV2(intent,controlledPlannerSubmission(fixture.goal,fixture.accounts),'2026-08-22T01:00:00.000Z');
    const slots = structuredClone(draft.slots); slots[0]!.theme = 'Owner 调整后的构建者主题';
    const currentBrief = {...draft.currentBrief,theme:slots[0]!.theme};
    const revised = reviseContentPlanV2(intent,draft,{slots,currentBrief,sourceBindings:draft.sourceBindings},draft.canonicalDigest,'2026-08-22T01:30:00.000Z');
    expect(revised.revision).toBe(2);
    expect(revised.parentDigest).toBe(draft.canonicalDigest);
    expect(revised.canonicalDigest).not.toBe(draft.canonicalDigest);
  });

  it('rejects stale Snapshot, account digest and unsupported compiler version', () => {
    const fixture = createV2Fixture();
    expect(() => compileMissionIntentV2({goal:fixture.goal,knowledge:{...fixture.knowledge,snapshotDigest:'0'.repeat(64)},accountProfiles:fixture.accounts})).toThrowError(expect.objectContaining({code:'KNOWLEDGE_SNAPSHOT_STALE'}));
    expect(() => compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:[{...fixture.accounts[0]!,digest:'0'.repeat(64)},fixture.accounts[1]!]})).toThrowError(expect.objectContaining({code:'ACCOUNT_PROFILE_MISSING'}));
    expect(() => compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts,compilerVersion:'3.0.0'})).toThrowError(expect.objectContaining({code:'COMPILER_VERSION_UNSUPPORTED'}));
  });

  it('property-checks that unselected platform codes never enter 40 deterministic outputs',()=>{
    for(let index=0;index<40;index+=1){const platform=index%2===0?'X':'XIAOHONGSHU';const forbidden=platform==='X'?'XIAOHONGSHU':'X';const fixture=createV2Fixture({platforms:[platform],dualMandateSingleAccount:true,horizonDays:index%3===0?30:7});const intent=compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});const draft=importPlannerSubmissionV2(intent,controlledPlannerSubmission(fixture.goal,fixture.accounts),'2026-08-22T01:00:00.000Z');const execution=continueSelectedPlatformMissionV2(intent,approveContentPlanV2(intent,draft,draft.canonicalDigest,'2026-08-22T02:00:00.000Z'));expect(JSON.stringify(execution)).not.toContain(`\"${forbidden}\"`);expect(JSON.stringify(execution)).not.toContain('"BLUESKY"');expect(JSON.stringify(execution)).not.toContain('"LINKEDIN"');}
  });

  it('preserves the v1 exact-four adapter without v2 fields or platform changes', () => {
    const input = compileMissionAdapterInput(createDemoCampaignDocument(),new Date('2026-08-03T12:00:00.000Z'));
    expect(input.schemaVersion).toBe(1);
    expect(input.artifacts.map((item) => item.platform)).toEqual(['X','XIAOHONGSHU','BLUESKY','LINKEDIN']);
    expect(input).not.toHaveProperty('missionIntentId');
    expect(sha256Digest(input)).toBe('95ff9637ffbbc531f6f02f731b7428c2534731f27847b0f9e0fe7160ef481d8b');
  });

  it('uses stable contract errors', () => {
    expect(new GoalPlanContractError('PLAN_NOT_APPROVED').code).toBe('PLAN_NOT_APPROVED');
  });
});
