import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const verifierPath = new URL('./verify-sdd007-agentteams-driver.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

describe('SDD-007 real AgentTeams production-path verifier', () => {
  it('binds evidence to the authorized source and runs the production mission worker path', () => {
    const source = readFileSync(verifierPath, 'utf8');
    expect(source).toContain("const authorizedBase='2b5673d0c408060034297328cd2522f4d9578ad1'");
    expect(source).toContain("git(['rev-parse','HEAD'])");
    expect(source).toContain("git(['branch','--show-current'])");
    expect(source).toContain("execFileSync('git',['merge-base','--is-ancestor',authorizedBase,sourceHead]");
    expect(source).toContain("new PersistentMissionWorker('sdd007-real-production-worker'");
    expect(source).toContain("productionWorkerPath:'PersistentMissionWorker.tick'");
    expect(source).toContain('leaderGatewayCalls:0');
    expect(source).toContain("docker',['inspect','--format','{{.Config.Hostname}}'");
    expect(source).toContain('workerContainerHostnameMatchedInspect:true');
    expect(source).not.toContain('remoteWorkerCalls.length!==5');
    expect(source).toContain('durableSubmissionIntentCount:runtime.intentCount');
    expect(source).toContain('durableCompletionConfirmedCount:runtime.confirmedCount');
    expect(source).toContain("this.crashBarrier='SUBMIT_STAGE'");
    expect(source).toContain("this.crashBarrier='FINALIZE_COMPLETE'");
    expect(source).toContain("graph.jobs.find((job)=>job.roleId==='presence-mission-leader')");
    expect(source).toContain('runtimeTaskId===leaderJob.taskContractId');
    expect(source).not.toContain('graph.jobs[0]');
    expect(source).toContain('async function verify()');
    expect(source.indexOf('class ProductionPathRuntime')).toBeLessThan(source.indexOf('await verify();'));
    expect(source).toContain('worker=makeWorker();workerRestartCount+=1');
    expect(source).toContain('submitStageRecovered:runtime.submissionRecoveryCount===1');
    expect(source).toContain('completionOutboxRecovered:runtime.completionRecoveryCount===1');
    expect(source).toContain("dependency?.state==='ACCEPTED'&&pending!==undefined&&this.confirmed.has(pending.batch.id)");
    expect(source).toMatch(/async finalizeMaterialization[^]*?this\.pending\.push[^]*?return \{accepted:true,duplicate:false/);
    expect(source).toMatch(/async confirmRuntimeCompletion[^]*?this\.confirmed\.add[^]*?state==='WAITING_DEPENDENCY'/);
    expect(source).not.toMatch(/roleId\s*===\s*['"]presence-mission-leader['"]\s*\?\s*driver\./);
  });

  it('builds every package consumed by the real verifier from a clean checkout', () => {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {scripts: Record<string, string>};
    expect(packageJson.scripts['verify:agentteams-real']).toContain('npm run build:packages');
    expect(packageJson.scripts['verify:agentteams-real']).toContain('npm run build --workspace @lumiclaw/mission-worker');
  });

  it('uses an independent lease-token authority instead of trusting the presented token', () => {
    const source = readFileSync(verifierPath, 'utf8');
    expect(source).toContain('this.leaseTokens=new Map()');
    expect(source).toContain("leaseToken:this.leaseTokens.get(jobId)??''");
    expect(source).toContain('lease.job.leaseTokenHash!==sha256Digest(leaseToken)');
  });
});
