import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {buildManualPublishPackage,controlledAuditFindings,createArtifactAuditDecision,createArtifactOwnerDecision,createArtifactRevision,createControlledProducerSubmission,verifyManualPublishPackage} from '@lumiclaw/domain';
import {approveContentPlanV2,compileMissionIntentV2,continueSelectedPlatformMissionV2,importPlannerSubmissionV2} from '@lumiclaw/mission-compiler';
import {controlledPlannerSubmission,createV2Fixture} from '../packages/mission-compiler/dist/v2-fixture.js';

const timestamp='2026-08-22T08:00:00.000Z';
const output=path.resolve('docs/reports/evidence/sdd-010/golden-contracts.json');
const scenarios=[
  createScenario({name:'x-single',platform:'X',xMode:'SINGLE'}),
  createScenario({name:'x-thread',platform:'X',xMode:'THREAD'}),
  createScenario({name:'xiaohongshu-image-note',platform:'XIAOHONGSHU'})
];
const manifest={schemaVersion:1,sdd:'SDD-010',classification:'PUBLIC_SAFE_SYNTHETIC',contractVersion:'lumiclaw.artifact-publish.v3',generatedAt:timestamp,deterministic:true,agentTeamsExecuted:false,modelExecuted:false,scenarios};
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(manifest,null,2)}\n`);
console.info(JSON.stringify({status:'PASS',output:'docs/reports/evidence/sdd-010/golden-contracts.json',scenarios:scenarios.length}));

function createScenario(config){
  const fixture=createV2Fixture({name:`sdd010-${config.name}`,horizonDays:7,platforms:[config.platform],dualMandateSingleAccount:true});
  const intent=compileMissionIntentV2({goal:fixture.goal,knowledge:fixture.knowledge,accountProfiles:fixture.accounts});
  const submission=controlledPlannerSubmission(fixture.goal,fixture.accounts);
  const plan=importPlannerSubmissionV2(intent,submission,timestamp);
  const approved=approveContentPlanV2(intent,plan,plan.canonicalDigest,timestamp);
  const execution=continueSelectedPlatformMissionV2(intent,approved);
  const unit=execution.activationUnits.find((candidate)=>candidate.platformCode===config.platform);
  if(unit===undefined)throw new Error(`SDD010_GOLDEN_UNIT_MISSING:${config.platform}`);
  const producer=createControlledProducerSubmission(execution,unit,{xMode:config.xMode??'THREAD',submittedAt:timestamp});
  const revision=createArtifactRevision({ownerId:execution.ownerId,submission:producer,bundle:execution,revision:1,parentRevisionId:null,createdAt:timestamp});
  const audit=createArtifactAuditDecision({ownerId:execution.ownerId,revision,auditorIdentityId:'controlled-independent-auditor-a5',result:'PASS',findings:controlledAuditFindings('PASS'),evidenceBindings:[revision.inputBindings.knowledgeSnapshot.digest,revision.inputBindings.approvedPlan.digest],createdAt:timestamp});
  const decision=createArtifactOwnerDecision({ownerId:execution.ownerId,revision,audit,result:'APPROVE',ownerIdentityId:execution.ownerId,decidedAt:timestamp});
  const pack=buildManualPublishPackage({ownerId:execution.ownerId,revision,audit,decision,createdAt:timestamp});
  const verification=verifyManualPublishPackage(pack);
  if(!verification.ok)throw new Error(`SDD010_GOLDEN_PACKAGE_INVALID:${verification.code}`);
  return {name:config.name,platformCode:revision.platformCode,mode:revision.payload.kind==='X'?revision.payload.mode:'IMAGE_NOTE',selectedPlatforms:execution.selectedPlatforms,activationUnitId:unit.activationUnitId,executionDigest:execution.canonicalDigest,artifactRevisionId:revision.id,artifactRevisionDigest:revision.canonicalDigest,auditDecisionDigest:audit.canonicalDigest,ownerDecisionDigest:decision.canonicalDigest,exactInputDigest:pack.exactInputDigest,manifestDigest:pack.manifestDigest,profileDigest:revision.inputBindings.artifactProfile.digest,producerSkillDigest:revision.inputBindings.producerSkill.digest,sourceSkillDigest:revision.inputBindings.producerSkill.sourceDigest,orderedFiles:pack.orderedFiles.map((file)=>({position:file.position,fileName:file.fileName,digest:file.digest})),payload:revision.payload};
}
