import axe from 'axe-core';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const baseUrl=process.env.SDD008_WEB_URL??'http://127.0.0.1:3188';
const evidenceDirectory=path.resolve('docs/reports/evidence/sdd-008');
const diagnosticDirectory=path.resolve('.evidence/sdd-008/diagnostics');
const checks={};const screenshots=[];const consoleErrors=[];
const sources=[
  {name:'founder-voice.md',mimeType:'text/markdown',buffer:Buffer.from('# Founder voice\nEvidence before claims. Never guarantee growth.')},
  {name:'product-facts.md',mimeType:'text/markdown',buffer:Buffer.from('# Product facts\nPostgreSQL is the control-plane source of truth.')},
  {name:'brand-boundaries.txt',mimeType:'text/plain',buffer:Buffer.from('The current publishing path is manual-only and Owner-gated.')}
];

await Promise.all([mkdir(evidenceDirectory,{recursive:true}),mkdir(diagnosticDirectory,{recursive:true})]);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
const page=await context.newPage();
page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
page.on('pageerror',(error)=>consoleErrors.push(error.message));

try{
  await page.goto(`${baseUrl}/zh-CN`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'先告诉我怎么称呼你。'}).waitFor();
  checks.firstOpenDisplayNameOnly=await page.locator('input').count()===1&&await secretInputs(page)===0;
  checks.sevenBusinessSteps=await page.getByText('七步设置',{exact:true}).isVisible()&&await page.locator('.lc-onboarding-step').count()===7;
  checks.defaultChinese=await page.locator('html').getAttribute('lang')==='zh-CN';
  await capture(page,'01-first-open-zh.png');await assertAxe(page,'first-open-zh');

  await page.goto(`${baseUrl}/en`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'First, tell us what to call you.'}).waitFor();
  checks.englishParityFirstOpen=await page.getByText('Seven-step setup',{exact:true}).isVisible()&&await page.getByRole('link',{name:'中文'}).isVisible();
  await assertAxe(page,'first-open-en');
  await page.goto(`${baseUrl}/zh-CN`,{waitUntil:'networkidle'});
  await page.getByLabel('本地显示名称').fill('SDD-008 测试 Owner');
  await page.getByRole('button',{name:'继续'}).click();

  await page.getByRole('heading',{name:'定义本人或创始人的表达方式。'}).waitFor();
  await page.getByLabel('公开表达名称').fill('林光');
  await page.getByLabel('角色 / 身份').fill('创始人与产品构建者');
  await page.getByLabel('语气与表达风格').fill('坦诚、具体、以证据为先');
  await page.getByLabel('用第一人称如何描述与品牌的关系').fill('只对亲历的创始人经验使用第一人称');
  await page.getByLabel(/长期坚持的观点/u).fill('先展示证据，再表达主张');
  await page.getByLabel(/表达边界 ·/u).fill('不保证增长\n不虚构客户结果');
  await page.getByLabel(/表达示例/u).fill('我会先给出可复核的来源。');
  await page.getByRole('button',{name:'保存草稿并继续'}).click();

  await page.getByRole('heading',{name:'记录品牌与产品的已知事实。'}).waitFor();
  await page.getByLabel('企业名称').fill('星河工作室');
  await page.getByLabel('品牌名称').fill('星河');
  await page.getByLabel('说明').nth(0).fill('帮助小团队建立可治理的全球品牌表达。');
  await page.getByLabel(/受众 ·/u).nth(0).fill('AI 产品创始人');
  await page.getByLabel(/确定事实/u).nth(0).fill('releaseStatus: beta\nreleaseStatus: generally available');
  await page.getByLabel('产品名称').fill('星河 Presence');
  await page.getByLabel('核心价值').fill('把来源、账号画像与 Owner 审阅绑定为可恢复知识。');
  await page.getByLabel('说明').nth(1).fill('一个面向跨市场内容运营的治理控制面。');
  await page.getByLabel(/受众 ·/u).nth(1).fill('全球产品团队');
  await page.getByLabel(/确定事实/u).nth(1).fill('publishingMode: manual-only');
  await page.getByRole('button',{name:'保存草稿并继续'}).click();

  await page.getByRole('heading',{name:'加入多份资料，不需要理解知识库字段。'}).waitFor();
  await page.locator('input[type=file]').setInputFiles(sources);
  for(const source of sources)await page.getByText(source.name,{exact:true}).waitFor();
  await page.getByLabel('来源名称').fill('创始人补充边界');
  await page.getByLabel('来源原文').fill('不把一次 Agent run 当作业务结果。');
  await page.getByRole('button',{name:'保存这份来源'}).click();
  await page.getByText('创始人补充边界',{exact:true}).waitFor();
  await page.getByLabel('来源名称').fill('产品范围补充');
  await page.getByLabel('来源原文').fill('本阶段不会创建 Goal、平台内容或发布动作。');
  await page.getByRole('button',{name:'保存这份来源'}).click();
  await page.getByText('产品范围补充',{exact:true}).waitFor();
  checks.ordinarySourcesWithoutTechnicalFields=await page.getByText(/无需填写 KnowledgeItem、JSON 或摘要/u).isVisible()&&await page.locator('input[name*=candidate i],textarea[name*=json i]').count()===0;
  checks.fiveSourcesVisible=await page.locator('.lc-source-card').count()===5;
  checks.friendlySourceStatus=await page.getByText('可用',{exact:true}).first().isVisible();
  await capture(page,'02-five-source-draft.png');await assertAxe(page,'sources');
  await page.reload({waitUntil:'networkidle'});
  checks.refreshRestoresSourceDraft=await page.getByText('founder-voice.md',{exact:true}).isVisible()&&await page.getByText('产品范围补充',{exact:true}).isVisible();
  await page.getByRole('button',{name:'继续'}).click();

  await fillAccount(page,{title:'建立 X 账号运营画像。',handle:'@xinghe_founder',role:'创始人一线构建记录',market:'US',locale:'en-US',audience:'English-speaking AI builders',pillar:'Build notes\nGovernance',example:'Evidence first, claim second.',dos:'Use concrete examples',donts:'No growth guarantees',cta:'Invite review of the documented source',cadence:'Two useful posts per week',exists:true});
  await page.getByRole('button',{name:'保存草稿并继续'}).click();
  await fillAccount(page,{title:'建立小红书账号运营画像。',handle:'星河产品笔记',role:'中文产品教育与案例拆解',market:'CN',locale:'zh-CN',audience:'中国 AI 产品团队',pillar:'产品方法\n治理实践',example:'先看来源，再看结论。',dos:'说清适用边界',donts:'不承诺爆款',cta:'邀请查看完整说明',cadence:'每周两篇有用笔记',exists:false});
  await page.getByText('创始人表达',{exact:true}).click();
  await page.getByRole('button',{name:'保存草稿并继续'}).click();
  try{await page.getByRole('heading',{name:'设置默认运营上下文，然后逐条审阅。'}).waitFor({timeout:15_000});}catch(error){await page.screenshot({path:path.join(diagnosticDirectory,'failure-xiaohongshu-submit.png'),fullPage:false});const alert=await page.getByRole('alert').allInnerTexts();throw new Error(`SDD008_XHS_SUBMIT_FAILED:${alert.join('|')}:${error instanceof Error?error.message:String(error)}`);}
  await page.getByLabel('默认目标市场').selectOption('SG');
  await page.getByLabel('默认内容语言').selectOption('en-US');
  await page.getByLabel('默认 IANA 时区').selectOption('Asia/Singapore');
  checks.defaultContextExplainsNoOverride=await page.getByText(/不会覆盖 X 或小红书各自保存的账号画像/u).isVisible();
  await page.getByRole('button',{name:'保存草稿并继续'}).click();

  await page.getByRole('heading',{name:'确认来源、事实、冲突与缺口。'}).waitFor();
  checks.platformProfilesRemainDistinct=await page.getByText('@xinghe_founder',{exact:true}).isVisible()&&await page.getByText('星河产品笔记',{exact:true}).isVisible()&&await page.getByText('US',{exact:true}).isVisible()&&await page.getByText('CN',{exact:true}).isVisible();
  checks.sourceExcerptsEnterReview=await page.getByText('来源摘录 / 待确认事实',{exact:true}).isVisible()&&await page.getByText(/不会假装自动抽取可靠事实/u).isVisible();
  checks.friendlyConflictStatus=await page.getByText('需要你的决定',{exact:true}).first().isVisible();
  checks.authorityPriorityExplainedWithoutAutoSelection=await page.getByText(/Campaign 明确决定 > 企业已批准私有知识 > 公共市场资料 > 模型待确认建议/u).isVisible()&&await page.getByText('企业已批准私有知识',{exact:true}).first().isVisible()&&await page.getByRole('radio').first().isChecked()===false;
  await page.getByRole('radio').first().check();
  await page.getByRole('button',{name:'确认选中的权威值'}).click();
  await page.getByText('可以批准',{exact:true}).waitFor();
  checks.friendlyApprovalStatus=true;
  checks.stableCodesOnlySecondary=await page.locator('code',{hasText:'READY_FOR_APPROVAL'}).isVisible()&&!await page.locator('h1,h2,h3').filter({hasText:'READY_FOR_APPROVAL'}).isVisible().catch(()=>false);
  checks.noSecretFieldsAnywhere=await secretInputs(page)===0;
  await page.locator('main').evaluate((element)=>{element.scrollTop=0;});
  await capture(page,'03-structured-review-ready.png');await assertAxe(page,'review-ready');
  await page.getByRole('button',{name:'确认并批准这份快照'}).click();
  await page.getByRole('heading',{name:'权威知识快照已经批准。'}).waitFor();
  checks.approvedFirstChineseFrameStartsAtTop=await page.getByText('LumiClaw',{exact:true}).isVisible()&&await page.getByText('本地称呼',{exact:true}).isVisible()&&await page.getByRole('heading',{name:'权威知识快照已经批准。'}).isVisible()&&await page.locator('main').evaluate((element)=>element.scrollTop===0)&&await page.evaluate(()=>document.scrollingElement?.scrollTop===0);
  checks.approvedKnowledgeCanStartNewDraft=await page.getByRole('button',{name:'更新知识（开始新草稿）'}).isVisible();
  checks.noGoalOrAgentLaunch=await page.getByRole('button',{name:'创建 Goal（已规划）'}).isDisabled()&&await page.locator('[data-runtime=running],.animate-pulse').count()===0;
  await capture(page,'04-approved-snapshot.png');await assertAxe(page,'approved-zh');
  await page.reload({waitUntil:'networkidle'});
  checks.refreshRestoresApproval=await page.getByRole('heading',{name:'权威知识快照已经批准。'}).isVisible();

  await page.goto(`${baseUrl}/en`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'The authoritative knowledge snapshot is approved.'}).waitFor();
  checks.englishParityApproved=await page.getByRole('button',{name:'Create Goal (planned)'}).isDisabled();
  await capture(page,'05-approved-snapshot-en.png');await assertAxe(page,'approved-en');

  await page.setViewportSize({width:1024,height:900});await page.goto(`${baseUrl}/zh-CN`,{waitUntil:'networkidle'});
  checks.desktop1024NoOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&document.body.scrollWidth<=document.body.clientWidth);
  await page.setViewportSize({width:800,height:900});await page.reload({waitUntil:'networkidle'});
  checks.desktopGate=await page.getByRole('heading',{name:'请使用桌面浏览器继续'}).isVisible();
  await capture(page,'06-desktop-gate.png');

  const failed=Object.entries(checks).filter(([,value])=>value!==true).map(([key])=>key);
  if(failed.length>0)throw new Error(`SDD008_BROWSER_CHECKS_FAILED:${failed.join(',')}`);
  if(consoleErrors.length>0)throw new Error(`SDD008_BROWSER_CONSOLE_ERRORS:${consoleErrors.join(' | ')}`);
  await writeFile(path.join(evidenceDirectory,'browser-verification.json'),`${JSON.stringify({schemaVersion:1,result:'PASS',generatedAt:new Date().toISOString(),baseUrl,locales:['zh-CN','en'],checks,consoleErrors,screenshots},null,2)}\n`);
  console.info(JSON.stringify({status:'PASS',checks:Object.keys(checks).length,screenshots:screenshots.length,evidence:'docs/reports/evidence/sdd-008/browser-verification.json'}));
}finally{await browser.close();}

async function fillAccount(targetPage,input){
  await targetPage.getByRole('heading',{name:input.title}).waitFor();
  if(input.exists)await targetPage.getByText('我确认这个账号实际存在',{exact:true}).click();
  await targetPage.getByLabel('Handle / 昵称').fill(input.handle);
  await targetPage.getByLabel('账号角色 / 人设').fill(input.role);
  await targetPage.getByLabel('该账号的目标市场').selectOption(input.market);
  await targetPage.getByLabel('该账号的内容语言').selectOption(input.locale);
  await targetPage.getByLabel(/受众 ·/u).fill(input.audience);
  await targetPage.getByLabel(/内容支柱 ·/u).fill(input.pillar);
  await targetPage.getByLabel(/应该怎样表达/u).fill(input.dos);
  await targetPage.getByLabel(/不要怎样表达/u).fill(input.donts);
  await targetPage.getByLabel(/表达示例/u).fill(input.example);
  await targetPage.getByLabel('行动号召边界').fill(input.cta);
  await targetPage.getByLabel('节奏提示').fill(input.cadence);
}
async function secretInputs(targetPage){return targetPage.locator('input[type=password],input[name*=key i],input[name*=secret i],input[name*=cookie i],input[name*=oauth i],textarea[name*=key i],textarea[name*=secret i]').count();}
async function capture(targetPage,name){await targetPage.waitForTimeout(220);const output=path.join(evidenceDirectory,name);await targetPage.screenshot({path:output,fullPage:false});screenshots.push({name,sha256:createHash('sha256').update(await readFile(output)).digest('hex'),viewport:targetPage.viewportSize()});}
async function assertAxe(targetPage,label){await targetPage.addScriptTag({content:axe.source});const violations=await targetPage.evaluate(async()=>{const result=await globalThis.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}});return result.violations.filter((item)=>['serious','critical'].includes(item.impact??''));});if(violations.length>0)throw new Error(`AXE_${label}:${violations.map((item)=>item.id).join(',')}`);}
