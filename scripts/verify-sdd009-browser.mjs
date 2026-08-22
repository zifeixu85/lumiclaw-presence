import axe from 'axe-core';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const webUrl=process.env.SDD009_WEB_URL??'http://127.0.0.1:3199';
const apiUrl=process.env.SDD009_API_URL??'http://127.0.0.1:4199';
const evidenceDirectory=path.resolve(process.env.SDD009_EVIDENCE_ROOT??'docs/reports/evidence/sdd-009');
const diagnosticDirectory=path.resolve('.evidence/sdd-009/diagnostics');
const checks={};const screenshots=[];const consoleErrors=[];
await Promise.all([mkdir(evidenceDirectory,{recursive:true}),mkdir(diagnosticDirectory,{recursive:true})]);

await seedApprovedKnowledge();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
const page=await context.newPage();
page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
page.on('pageerror',(error)=>consoleErrors.push(error.message));
try{
  await page.goto(`${webUrl}/zh-CN/goals`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'把目标变成一条可审阅、可恢复的运营节奏。'}).waitFor();
  checks.defaultChinese=await page.locator('html').getAttribute('lang')==='zh-CN';
  checks.goalFormHasIndependentContext=await Promise.all(['目标市场','内容语言','排期时区（IANA）'].map((name)=>page.getByLabel(name).isVisible())).then((values)=>values.every(Boolean));
  checks.ownerBoundaryVisible=await page.getByText(/所有 mutation 都绑定当前本机 Owner/u).isVisible();
  checks.successSignalsNotOutcomes=await page.getByText(/不代表增长、线索、收入/u).isVisible();
  checks.selectedApprovedAccounts=await page.locator('.lc-account-selector label[data-selected="true"]').count()===2;
  await page.getByLabel('目标说明').focus();await page.keyboard.press('Tab');checks.keyboardTraversal=(await page.evaluate(()=>document.activeElement?.tagName))!=='BODY';
  await capture(page,'01-goal-form-zh.png');await assertAxe(page,'goal-form-zh');

  await page.getByRole('button',{name:'保存并激活 Goal'}).click();
  await page.getByText('运行目标已激活',{exact:true}).waitFor();
  checks.goalCreatedAndActivated=await page.getByText('当前持续运营目标',{exact:true}).isVisible();
  await page.reload({waitUntil:'networkidle'});checks.goalRefreshRecovery=await page.getByText('运行目标已激活',{exact:true}).isVisible();
  await page.getByRole('button',{name:'生成任务意图'}).click();
  await page.getByRole('heading',{name:'计划前，先看清输入与责任'}).waitFor();
  checks.intentExactlySixRoles=await page.locator('.lc-role-band article').count()===6;
  const chineseRoles=['任务协调 Agent','事实核验 Agent','市场策划 Agent','创始人内容 Agent','产品内容 Agent','独立审校 Agent'];checks.chineseRoleNamesPrimary=(await Promise.all(chineseRoles.map((name)=>page.getByText(name,{exact:true}).first().isVisible()))).every(Boolean);
  checks.englishRoleHeadingsNotPrimary=await page.getByText('Exactly six roles',{exact:true}).count()===0&&await page.getByText('Founder Identity Producer',{exact:true}).count()===0&&await page.getByText('Product Account Producer',{exact:true}).count()===0;
  checks.intentSelectedPlatforms=await page.getByText('X + XIAOHONGSHU',{exact:true}).isVisible();
  checks.intentHonestNoRun=await page.getByText(/尚未运行任何 Agent/u).isVisible();
  await capture(page,'02-mission-intent-zh.png');await assertAxe(page,'intent-zh');

  await page.getByRole('button',{name:'导入受控 Fixture'}).click();
  await page.getByRole('heading',{name:'审阅并形成新的 Plan revision'}).waitFor();
  checks.fixtureClearlyMarked=await page.getByText(/这不是 AgentTeams 真实运行/u).isVisible();
  checks.sevenDayPlan=await page.locator('.lc-plan-grid nav button').count()===3;
  checks.chineseFixtureConstraints=await page.getByText('不得声称 AgentTeams 已真实运行',{exact:true}).isVisible()&&await page.getByText('不得承诺增长、线索或收入',{exact:true}).isVisible();
  await page.getByLabel('主题 Theme').fill('Owner 调整：公开构建的治理取舍');
  const [revisionResponse]=await Promise.all([page.waitForResponse((response)=>response.url().includes('/api/v1/content-plans/')&&response.request().method()==='PATCH'),page.getByRole('button',{name:'形成新 Revision'}).click()]);
  if(!revisionResponse.ok())throw new Error(`PLAN_REVISION_FAILED:${revisionResponse.status()}:${await revisionResponse.text()}`);
  await page.getByText('CONTENT PLAN · REVISION 2',{exact:true}).waitFor();
  checks.planEditAppendsRevision=true;
  await capture(page,'03-plan-review-revision-zh.png');await assertAxe(page,'plan-zh');

  await page.getByRole('button',{name:/批准 exact/u}).click();
  const executionHeading=page.getByRole('heading',{name:'仅覆盖所选平台的执行合同'});await executionHeading.waitFor();
  checks.executionExactlySixTasks=await page.locator('.lc-dag article').count()===6;
  checks.twoSubstantiveProducerTasks=await page.locator('.lc-dag article[data-producer="true"]').count()===2;
  const producerBodies=await page.locator('.lc-dag article[data-producer="true"] p').allInnerTexts();checks.producerTasksDiffer=producerBodies.length===2&&producerBodies[0]!==producerBodies[1];
  checks.onlySelectedPlatforms=await page.locator('.lc-activation-unit').count()===3&&!await page.getByText(/BLUESKY|LINKEDIN/u).isVisible().catch(()=>false);
  checks.noArtifactsOrActions=await page.getByText(/没有 Artifact、独立 Audit 结果、ActionGrant/u).isVisible();
  await executionHeading.scrollIntoViewIfNeeded();await capture(page,'04-mission-execution-zh.png');await assertAxe(page,'execution-zh');

  const before=await api('/api/v1/local-workspace');const goal=latest(before.body.goals.goals);const firstIntent=before.body.goals.bundles.find((bundle)=>bundle.kind==='MISSION_INTENT');const firstExecution=before.body.goals.bundles.find((bundle)=>bundle.kind==='MISSION_EXECUTION');const mutation={canonicalDigest:goal.canonicalDigest,objective:`${goal.objective}（Owner 调整）`,horizonDays:goal.horizonDays,startsAt:goal.startsAt,endsAt:goal.endsAt,cadence:goal.cadence,selectedAccountIds:goal.selectedAccountIds,targetMarket:goal.targetMarket,contentLocale:goal.contentLocale,timeZone:goal.timeZone,successSignals:goal.successSignals,knowledgeSnapshotId:goal.knowledgeSnapshotId,knowledgeSnapshotDigest:goal.knowledgeSnapshotDigest};
  const patched=await api(`/api/v1/goals/${goal.goalId}`,{method:'PATCH',headers:{'content-type':'application/json','if-match':goalEtag(goal),'idempotency-key':'sdd009-browser-goal-invalidation-0001'},body:JSON.stringify(mutation)});
  if(patched.status!==200)throw new Error(`GOAL_INVALIDATION_SETUP_FAILED:${patched.status}:${patched.body.code}`);
  await page.reload({waitUntil:'networkidle'});await page.getByText('旧 generation 已保留并停止继续',{exact:true}).waitFor();
  checks.invalidationReasonVisible=await page.getByText(/GOAL_REVISION_CHANGED/u).isVisible();
  checks.recoveryActionVisible=await page.getByText(/REVIEW_AND_COMPILE_NEW_GENERATION/u).isVisible();
  await page.getByText('旧 generation 已保留并停止继续',{exact:true}).scrollIntoViewIfNeeded();await capture(page,'05-invalidation-recovery-zh.png');await assertAxe(page,'invalidation-zh');
  await page.getByRole('button',{name:'复核并激活此 Goal revision'}).click();await page.getByText('运行目标已激活',{exact:true}).waitFor();await page.getByRole('button',{name:'生成任务意图'}).click();await page.getByRole('heading',{name:'计划前，先看清输入与责任'}).waitFor();await page.getByRole('button',{name:'导入受控 Fixture'}).click();await page.getByRole('heading',{name:'审阅并形成新的 Plan revision'}).waitFor();await page.getByRole('button',{name:/批准 exact/u}).click();await page.getByRole('heading',{name:'仅覆盖所选平台的执行合同'}).waitFor();const recovered=await api('/api/v1/local-workspace');const newIntent=[...recovered.body.goals.bundles].filter((bundle)=>bundle.kind==='MISSION_INTENT').sort((left,right)=>right.generation-left.generation)[0];const newExecution=[...recovered.body.goals.bundles].filter((bundle)=>bundle.kind==='MISSION_EXECUTION').sort((left,right)=>right.generation-left.generation)[0];checks.sameMissionReplanningLineage=newIntent.missionIntentId===firstIntent.missionIntentId&&newExecution.missionIntentId===firstExecution.missionIntentId&&newIntent.generation>firstExecution.generation&&newExecution.generation>newIntent.generation&&newIntent.parentBundleDigest===firstExecution.canonicalDigest;checks.replannedDigestsDistinct=newIntent.canonicalDigest!==firstIntent.canonicalDigest&&newExecution.canonicalDigest!==firstExecution.canonicalDigest;checks.replannedSelectedPlatforms=newExecution.selectedPlatforms.join(',')==='X,XIAOHONGSHU';await capture(page,'05b-recompiled-execution-zh.png');await assertAxe(page,'recompiled-execution-zh');

  await page.goto(`${webUrl}/en/goals`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Turn a goal into a reviewable, recoverable operating rhythm.'}).waitFor();
  checks.englishParity=await page.getByRole('heading',{name:'Selected-platform MissionExecution'}).isVisible()&&await page.getByText('Mission Coordination Agent',{exact:true}).first().isVisible()&&await page.getByText(/No model call, AgentTeams run/u).isVisible();
  await capture(page,'06-goal-execution-en.png');await assertAxe(page,'execution-en');

  await page.setViewportSize({width:1024,height:900});await page.goto(`${webUrl}/zh-CN/goals`,{waitUntil:'networkidle'});checks.desktop1024NoHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
  await page.setViewportSize({width:800,height:900});await page.reload({waitUntil:'networkidle'});checks.desktopGate=await page.getByRole('heading',{name:'请使用桌面浏览器继续'}).isVisible();await capture(page,'07-desktop-gate.png');

  const failed=Object.entries(checks).filter(([,value])=>value!==true).map(([key])=>key);
  if(failed.length>0)throw new Error(`SDD009_BROWSER_CHECKS_FAILED:${failed.join(',')}`);
  if(consoleErrors.length>0)throw new Error(`SDD009_BROWSER_CONSOLE_ERRORS:${consoleErrors.join(' | ')}`);
  await writeFile(path.join(evidenceDirectory,'browser-verification.json'),`${JSON.stringify({schemaVersion:1,sdd:'SDD-009',classification:'PUBLIC_SAFE_SYNTHETIC',result:'PASS',generatedAt:new Date().toISOString(),webUrl,apiUrl,locales:['zh-CN','en'],checks,consoleErrors,screenshots},null,2)}\n`);
  console.info(JSON.stringify({status:'PASS',checks:Object.keys(checks).length,screenshots:screenshots.length,evidence:'docs/reports/evidence/sdd-009/browser-verification.json'}));
}catch(error){await page.screenshot({path:path.join(diagnosticDirectory,'browser-failure.png'),fullPage:true}).catch(()=>undefined);throw error;}finally{await browser.close();}

async function seedApprovedKnowledge(){
  let workspace=await api('/api/v1/local-workspace');if(workspace.body.profile!==null)return;
  must(await api('/api/v1/local-owner-profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({displayName:'SDD-009 公开安全 Owner'})}),201,'profile');
  must(await api('/api/v1/local-onboarding/materials-path',{method:'POST'}),200,'materials-path');
  workspace=await api('/api/v1/local-workspace');let overview=workspace.body.knowledge;
  const mutate=async(route,body,method='PUT')=>{const result=await api(route,{method,headers:knowledgeHeaders(overview.session.rowVersion,`sdd009-seed-${overview.session.rowVersion}-${route.replaceAll('/','-')}`),body:JSON.stringify(body)});if(result.status<200||result.status>299)throw new Error(`KNOWLEDGE_SEED_FAILED:${route}:${result.status}:${result.body.code}`);overview=result.body.overview;};
  await mutate('/api/v1/profiles/persona',{displayName:'林光（公开安全示例）',role:'Founder and product builder',voice:'Evidence first, concrete, and bounded.',viewpoints:['Show verifiable implementation before claims.'],expressionBoundaries:['Never promise growth, leads, or revenue.'],firstPersonRelationship:'First person is limited to public build decisions.',expressionExamples:['I will show the source and boundary before the conclusion.']});
  await mutate('/api/v1/profiles/organization',{name:'LumiClaw Public-safe Studio',brandName:'LumiClaw',description:'A public-safe engineering fixture for governed brand operations.',audiences:['AI product builders'],facts:['The source repository is Apache-2.0.'],approvedClaims:[{statement:'LumiClaw Presence is an engineering candidate.',evidence:'Repeatable public repository verification.'}]});
  await mutate('/api/v1/profiles/product',{name:'LumiClaw Presence',description:'A governed operating control-plane candidate.',valueProposition:'Bind approved knowledge, account mandates, plan revisions, and exact Owner decisions.',audiences:['Global product teams'],facts:['External action is disabled in SDD-009.'],approvedClaims:[{statement:'Goal and Plan revisions persist in PostgreSQL.',evidence:'SDD-009 migration and restart evidence.'}]});
  await mutate('/api/v1/knowledge/sources/text',{label:'SDD-009 公开安全资料',text:'Only approved engineering facts may enter the Mission compiler. AgentTeams has not run and no external action is allowed.'},'POST');
  await mutate('/api/v1/profiles/accounts/X',{platformCode:'X',accountExists:true,handleOrDisplayName:'@lumi_fixture',producerMandates:['FOUNDER_VOICE'],rolePersona:'Founder build notes',audience:['English-speaking AI builders'],targetMarket:'US',contentLocale:'en-US',contentPillars:['Build decisions'],expressionExamples:['Evidence first.'],dos:['State boundaries'],donts:['No outcome promises'],ctaPolicy:'Invite review of public evidence.',cadenceHint:'Three useful notes per week.'});
  await mutate('/api/v1/profiles/accounts/XIAOHONGSHU',{platformCode:'XIAOHONGSHU',accountExists:true,handleOrDisplayName:'LumiClaw 产品手记（示例）',producerMandates:['PRODUCT_EXPERTISE'],rolePersona:'Chinese product education',audience:['中国 AI 产品团队'],targetMarket:'CN',contentLocale:'zh-CN',contentPillars:['产品工作流'],expressionExamples:['先看证据，再看结论。'],dos:['说明适用边界'],donts:['不承诺爆款'],ctaPolicy:'邀请查看公开说明。',cadenceHint:'每周三篇有用笔记。'});
  await mutate('/api/v1/onboarding/session',{currentStep:'REVIEW',targetMarket:'SG',contentLocale:'en-US',timeZone:'Asia/Singapore'});
  if(overview.session.state!=='READY_FOR_APPROVAL'||overview.draft===null)throw new Error(`KNOWLEDGE_SEED_NOT_READY:${overview.session.state}:${overview.draft?.gaps?.join(',')}`);
  await mutate('/api/v1/knowledge/snapshots/approve',{snapshotId:overview.draft.id,canonicalDigest:overview.draft.canonicalDigest},'POST');
  if(overview.session.state!=='KNOWLEDGE_APPROVED_NEEDS_GOAL')throw new Error(`KNOWLEDGE_SEED_NOT_APPROVED:${overview.session.state}`);
}
async function api(route,init={}){const response=await fetch(`${apiUrl}${route}`,init);let body={};try{body=await response.json();}catch{}return {status:response.status,headers:response.headers,body};}
function must(result,status,label){if(result.status!==status)throw new Error(`SDD009_${label.toUpperCase()}_FAILED:${result.status}:${result.body.code}`);return result;}
function knowledgeHeaders(version,key){return {'content-type':'application/json','if-match':`"knowledge-${version}"`,'idempotency-key':key};}
function goalEtag(goal){return `"goal-${goal.goalId}-r${goal.revision}-${goal.canonicalDigest}"`;}
function latest(items){return [...items].sort((left,right)=>right.revision-left.revision)[0];}
async function capture(targetPage,name){await targetPage.waitForTimeout(180);const output=path.join(evidenceDirectory,name);await targetPage.screenshot({path:output,fullPage:false});screenshots.push({name,sha256:createHash('sha256').update(await readFile(output)).digest('hex'),viewport:targetPage.viewportSize()});}
async function assertAxe(targetPage,label){await targetPage.addScriptTag({content:axe.source});const violations=await targetPage.evaluate(async()=>{const result=await globalThis.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}});return result.violations.filter((item)=>['serious','critical'].includes(item.impact??''));});if(violations.length>0)throw new Error(`AXE_${label}:${JSON.stringify(violations.map((item)=>({id:item.id,nodes:item.nodes.map((node)=>({target:node.target,html:node.html,failureSummary:node.failureSummary}))})) )}`);}
