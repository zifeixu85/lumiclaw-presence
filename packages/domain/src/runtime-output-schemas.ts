import {sha256Digest} from './canonical.js';
import {PersistentRuntimeError,type RuntimeTaskContract} from './persistent-runtime.js';
import {Ajv,type ValidateFunction} from 'ajv';

type JsonSchema=Record<string,unknown>;
const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
const text={type:'string',minLength:1};
const textList={type:'array',items:text};
const producerRole={enum:['founder-identity-producer','product-account-producer']};
const platform={enum:['X','XIAOHONGSHU']};
const closed=(required:string[],properties:Record<string,unknown>):JsonSchema=>({type:'object',additionalProperties:false,required,properties});

const orchestration=closed(['schemaVersion','taskId','inputDigest','agentTeamsExecuted','completed'],{schemaVersion:{const:1},taskId:text,inputDigest:digest,agentTeamsExecuted:{const:true},completed:{const:true}});
const claimFreeze=closed(['schemaVersion','taskId','inputDigest','agentTeamsExecuted','frozenBindingDigest'],{schemaVersion:{const:1},taskId:text,inputDigest:digest,agentTeamsExecuted:{const:true},frozenBindingDigest:digest});
const slot=closed(['slotId','localDate','localTime','platformCode','accountProfileRevisionId','producerRole','theme','contentObjective','claimConstraints','sourceItemIds','status'],{slotId:text,localDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},localTime:{oneOf:[{type:'null'},{type:'string',pattern:'^\\d{2}:\\d{2}$'}]},platformCode:platform,accountProfileRevisionId:text,producerRole,theme:text,contentObjective:text,claimConstraints:textList,sourceItemIds:textList,status:{const:'PLANNED'}});
const brief=closed(['briefId','slotId','platformCode','accountProfileRevisionId','producerRole','theme','contentObjective','sourceItemIds','claimConstraints'],{briefId:text,slotId:text,platformCode:platform,accountProfileRevisionId:text,producerRole,theme:text,contentObjective:text,sourceItemIds:textList,claimConstraints:textList});
const sourceBinding=closed(['snapshotId','snapshotDigest','sourceItemIds','claimConstraints'],{snapshotId:text,snapshotDigest:digest,sourceItemIds:textList,claimConstraints:textList});
const plan=closed(['schemaVersion','roleId','missionIntentId','intentBundleId','intentBundleDigest','taskId','inputDigest','outputSchema','outputSchemaDigest','skillLockDigest','slots','currentBrief','sourceBindings','evidenceMaturity'],{schemaVersion:{const:2},roleId:{const:'campaign-planner'},missionIntentId:text,intentBundleId:text,intentBundleDigest:digest,taskId:text,inputDigest:digest,outputSchema:{const:'lumiclaw.content-plan.v2'},outputSchemaDigest:digest,skillLockDigest:digest,slots:{type:'array',minItems:1,maxItems:30,items:slot},currentBrief:brief,sourceBindings:{type:'array',minItems:1,items:sourceBinding},evidenceMaturity:{const:'AGENTTEAMS_RUNTIME'}});

const skillRef=closed(['id','version','digest','source','sourceDigest','license'],{id:{enum:['x-content-expression','xiaohongshu-content-expression','artifact-independent-audit']},version:{const:'1.0.0'},digest,source:{type:'string',pattern:'^skills/.+/SKILL\\.md$'},sourceDigest:digest,license:{const:'Apache-2.0'}});
const profileRef=closed(['id','version','digest','platformCode','source','checkedAt','expiresAt'],{id:text,version:{const:'1.0.0'},digest,platformCode:platform,source:text,checkedAt:{type:'string',format:'date-time'},expiresAt:{type:'string',format:'date-time'}});
const sourceRef=closed(['sourceItemId','bindingDigest'],{sourceItemId:text,bindingDigest:digest});
const mediaRef=closed(['digest','fileName','mediaType','rights','altText'],{digest,fileName:text,mediaType:{enum:['image/png','image/jpeg','image/webp']},rights:{const:'OWNER_AUTHORIZED_LOCAL'},altText:text});
const post=closed(['position','text','mediaRefs','altText'],{position:{type:'integer',minimum:1},text:{type:'string'},mediaRefs:{type:'array',items:mediaRef},altText:{oneOf:[{type:'null'},{type:'string'}]}});
const xPayload=closed(['kind','mode','posts','link','cta','language','accountProfileRevisionId','sourceBindings'],{kind:{const:'X'},mode:{enum:['SINGLE','THREAD']},posts:{type:'array',minItems:1,items:post},link:{oneOf:[{type:'null'},{type:'string'}]},cta:{oneOf:[{type:'null'},{type:'string'}]},language:text,accountProfileRevisionId:text,sourceBindings:{type:'array',items:sourceRef}});
const visual=closed(['purpose','aspectRatio','visualBrief','overlayCopy'],{purpose:text,aspectRatio:text,visualBrief:text,overlayCopy:{oneOf:[{type:'null'},{type:'string'}]}});
const imageSpec=closed(['position','purpose','aspectRatio','visualBrief','overlayCopy','altDescription','authorizedMediaRef'],{position:{type:'integer',minimum:1},purpose:text,aspectRatio:text,visualBrief:text,overlayCopy:{oneOf:[{type:'null'},{type:'string'}]},altDescription:{oneOf:[{type:'null'},{type:'string'}]},authorizedMediaRef:{oneOf:[{type:'null'},mediaRef]}});
const xhsPayload=closed(['kind','title','body','topics','cta','coverSpec','imageSpecs','language','accountProfileRevisionId','sourceBindings'],{kind:{const:'XIAOHONGSHU'},title:{type:'string'},body:{type:'string'},topics:textList,cta:{oneOf:[{type:'null'},{type:'string'}]},coverSpec:visual,imageSpecs:{type:'array',items:imageSpec},language:text,accountProfileRevisionId:text,sourceBindings:{type:'array',items:sourceRef}});
const inputBindings=closed(['executionBundle','operatingGoal','approvedPlan','knowledgeSnapshot','accountProfile','producerSkill','artifactProfile','sourceSetDigest'],{executionBundle:closed(['id','digest','generation','missionIntentId'],{id:text,digest,generation:{type:'integer',minimum:2},missionIntentId:text}),operatingGoal:closed(['id','digest'],{id:text,digest}),approvedPlan:closed(['id','digest'],{id:text,digest}),knowledgeSnapshot:closed(['id','digest'],{id:text,digest}),accountProfile:closed(['id','digest','platformCode'],{id:text,digest,platformCode:platform}),producerSkill:skillRef,artifactProfile:profileRef,sourceSetDigest:digest});
const producerSubmission=closed(['schemaVersion','evidenceMaturity','agentTeamsExecuted','submissionId','activationUnitId','producerRole','producerIdentityId','inputBindings','payload','submittedAt'],{schemaVersion:{const:3},evidenceMaturity:{const:'AGENTTEAMS_RUNTIME'},agentTeamsExecuted:{const:true},submissionId:text,activationUnitId:text,producerRole,producerIdentityId:text,inputBindings,payload:{oneOf:[xPayload,xhsPayload]},submittedAt:{type:'string',format:'date-time'}});
const producer=closed(['submissions'],{submissions:{type:'array',minItems:1,maxItems:30,items:producerSubmission}});

const finding=closed(['checkCode','result','path','message','evidenceBindings','recoveryAction'],{checkCode:{enum:['SCHEMA_AND_ORDER','SOURCE_GROUNDING','CLAIM_EVIDENCE','GOAL_AND_PLAN_FIT','ACCOUNT_VOICE','PLATFORM_CONSTRAINTS','SENSITIVE_RISK']},result:{enum:['PASS','FAIL','ESCALATE']},path:text,message:text,evidenceBindings:{type:'array',items:digest},recoveryAction:{oneOf:[{type:'null'},text]}});
const auditItem=closed(['artifactRevisionId','auditorIdentityId','evidenceBindings','findings','result'],{artifactRevisionId:text,auditorIdentityId:text,evidenceBindings:{type:'array',items:digest},findings:{type:'array',minItems:7,maxItems:7,items:finding},result:{enum:['PASS','FAIL','ESCALATE']}});
const audit=closed(['audits'],{audits:{type:'array',minItems:1,maxItems:30,items:auditItem}});
const mediaAuditFinding=closed(['checkCode','result','message','evidenceDigests','recoveryAction'],{checkCode:{enum:['REVISION_BINDING','TEXT_VISUAL_SPEC_COHERENCE','FINAL_MEDIA_MACHINE_FACTS','PROVENANCE_COMPOSITION','RIGHTS_COST','BRAND_KNOWLEDGE_SNAPSHOTS','PLATFORM_CONSTRAINTS','SENSITIVE_TEXT_SPEC_RISK']},result:{enum:['PASS','FAIL','ESCALATE']},message:text,evidenceDigests:{type:'array',minItems:1,uniqueItems:true,items:digest},recoveryAction:{oneOf:[{type:'null'},text]}});
const mediaAuditCapabilityBoundary=closed(['reviewMode','pixelInspectionPerformed','ownerVisualReviewRequired','notReviewed'],{reviewMode:{const:'TEXT_ONLY_WITH_SERVER_MACHINE_FACTS'},pixelInspectionPerformed:{const:false},ownerVisualReviewRequired:{const:true},notReviewed:{type:'array',items:{enum:['FINAL_PIXEL_VISUAL_QUALITY','HIDDEN_PIXEL_CONTENT','RENDERED_TEXT_OCR','PIXEL_TEXT_MEDIA_SEMANTICS']},uniqueItems:true,minItems:4,maxItems:4}});
const mediaAudit=closed(['schemaVersion','taskId','inputDigest','artifactRevisionId','artifactRevisionDigest','mediaSetDigest','brandSnapshotDigest','knowledgeSnapshotDigest','actualMediaDigests','result','capabilityBoundary','findings'],{schemaVersion:{const:4},taskId:text,inputDigest:digest,artifactRevisionId:text,artifactRevisionDigest:digest,mediaSetDigest:digest,brandSnapshotDigest:digest,knowledgeSnapshotDigest:digest,actualMediaDigests:{type:'array',minItems:1,items:digest},result:{enum:['PASS','FAIL','ESCALATE']},capabilityBoundary:mediaAuditCapabilityBoundary,findings:{type:'array',minItems:8,maxItems:8,items:mediaAuditFinding}});

const registry:Record<string,{kind:RuntimeTaskContract['kind'];roleIds:string[];schema:JsonSchema}>={
  'lumiclaw.orchestration-receipt.v2':{kind:'ORCHESTRATE',roleIds:['presence-mission-leader'],schema:orchestration},
  'lumiclaw.frozen-claim-set.v2':{kind:'FREEZE_CLAIMS',roleIds:['evidence-claim-steward'],schema:claimFreeze},
  'lumiclaw.content-plan.v2':{kind:'PLAN_CONTENT',roleIds:['campaign-planner'],schema:plan},
  'lumiclaw.selected-platform-artifact.sdd010':{kind:'PRODUCE_CONTENT',roleIds:['founder-identity-producer','product-account-producer'],schema:producer},
  'lumiclaw.audit-decision.sdd010':{kind:'AUDIT_CONTENT',roleIds:['independent-auditor'],schema:audit},
  'lumiclaw.media-audit-output.v4':{kind:'AUDIT_CONTENT',roleIds:['independent-auditor'],schema:mediaAudit}
};
const ajv=new Ajv({allErrors:true,strict:true,formats:{'date-time':true}});
const validators=new Map<string,ValidateFunction>();

export function runtimeOutputSchema(contract:RuntimeTaskContract):{schemaVersion:1;schemaRef:string;canonicalDigest:string;schema:JsonSchema}{
  const entry=registry[contract.outputSchema];if(entry===undefined||entry.kind!==contract.kind||!entry.roleIds.includes(contract.roleId))throw new PersistentRuntimeError('SUBMISSION_INPUT_MISMATCH','RUNTIME_OUTPUT_SCHEMA_ROLE_KIND_MISMATCH');
  const schema={$schema:'https://json-schema.org/draft/2020-12/schema',title:contract.outputSchema,...entry.schema};return {schemaVersion:1,schemaRef:contract.outputSchema,canonicalDigest:sha256Digest({schemaVersion:1,schemaRef:contract.outputSchema,schema}),schema};
}

export function parseRuntimeOutput(contract:RuntimeTaskContract,value:unknown):unknown{
  const registered=runtimeOutputSchema(contract);let validate=validators.get(registered.canonicalDigest);if(validate===undefined){validate=ajv.compile(registry[contract.outputSchema]!.schema);validators.set(registered.canonicalDigest,validate);}if(!validate(value))throw new PersistentRuntimeError('SUBMISSION_SCHEMA_INVALID','RUNTIME_OUTPUT_SCHEMA_INVALID',{schemaRef:contract.outputSchema,errors:(validate.errors??[]).map((item)=>({instancePath:item.instancePath,keyword:item.keyword}))});return structuredClone(value);
}

export const RUNTIME_OUTPUT_SCHEMA_REFS=Object.freeze(Object.keys(registry));
