import {chmod,mkdtemp,readFile,stat,symlink,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';

const originalSecret=process.env.LUMICLAW_MEDIA_SECRET_ROOT;const originalStatus=process.env.LUMICLAW_MEDIA_STATUS_ROOT;
afterEach(()=>{vi.resetModules();if(originalSecret===undefined)delete process.env.LUMICLAW_MEDIA_SECRET_ROOT;else process.env.LUMICLAW_MEDIA_SECRET_ROOT=originalSecret;if(originalStatus===undefined)delete process.env.LUMICLAW_MEDIA_STATUS_ROOT;else process.env.LUMICLAW_MEDIA_STATUS_ROOT=originalStatus;});

async function isolated(){const parent=await mkdtemp(path.join(tmpdir(),'lumiclaw-sdd012-secret-'));process.env.LUMICLAW_MEDIA_SECRET_ROOT=path.join(parent,'media-secret');process.env.LUMICLAW_MEDIA_STATUS_ROOT=path.join(parent,'media-status');vi.resetModules();return import('./media-provider-secret-cli.mjs');}

describe('terminal-only isolated media Provider Secret gate',()=>{
  it('writes 0700/0600 but remains configured-without-canary and never returns the key',async()=>{const cli=await isolated();const key='public-safe-media-provider-test-value';const value=await cli.configureMediaSecret(async()=>key);const fingerprint=createHash('sha256').update(JSON.stringify({purpose:'MEDIA_PROVIDER',value:key})).digest('hex').slice(0,16);expect(value).toMatchObject({state:'STARTING',configured:true,profileMaturity:'SECRET_CONFIGURED',providerEvidence:false,canaryReceiptDigest:null,fingerprint});expect(JSON.stringify(value)).not.toContain(key);expect((await stat(process.env.LUMICLAW_MEDIA_SECRET_ROOT!)).mode&0o777).toBe(0o700);expect((await stat(path.join(process.env.LUMICLAW_MEDIA_SECRET_ROOT!,'media-provider-key'))).mode&0o777).toBe(0o600);expect(await readFile(path.join(process.env.LUMICLAW_MEDIA_SECRET_ROOT!,'media-provider-key'),'utf8')).toBe(`${key}\n`);});

  it('rejects symlink roots/files and unsafe existing file modes instead of following or replacing them',async()=>{const cli=await isolated();const root=process.env.LUMICLAW_MEDIA_SECRET_ROOT!;await cli.configureMediaSecret(async()=>'first-media-provider-value-1234');await chmod(path.join(root,'media-provider-key'),0o644);await expect(cli.configureMediaSecret(async()=>'replacement-media-provider-value')).rejects.toThrow('MEDIA_SECRET_FILE_INVALID');
    const parent=await mkdtemp(path.join(tmpdir(),'lumiclaw-sdd012-link-'));const external=path.join(parent,'external');await writeFile(external,'external-secret\n',{mode:0o600});const linkedRoot=path.join(parent,'linked-root');await symlink(parent,linkedRoot);process.env.LUMICLAW_MEDIA_SECRET_ROOT=linkedRoot;vi.resetModules();const rootCli=await import('./media-provider-secret-cli.mjs');await expect(rootCli.mediaSecretStatus()).rejects.toThrow('MEDIA_SECRET_ROOT_INVALID');
    const safeParent=await mkdtemp(path.join(tmpdir(),'lumiclaw-sdd012-file-link-'));process.env.LUMICLAW_MEDIA_SECRET_ROOT=safeParent;await symlink(external,path.join(safeParent,'media-provider-key'));vi.resetModules();const fileCli=await import('./media-provider-secret-cli.mjs');await expect(fileCli.mediaSecretStatus()).rejects.toThrow('MEDIA_SECRET_FILE_INVALID');});

  it('does not accept MODEL_PROVIDER scope as media readiness and removes only its exact media key',async()=>{const cli=await isolated();await cli.configureMediaSecret(async()=>'purpose-separated-media-value-1234');const status=await cli.mediaSecretStatus();expect(JSON.stringify(status)).not.toContain('MODEL_PROVIDER');const removed=await cli.removeMediaSecret();expect(removed).toMatchObject({state:'NOT_CONFIGURED',configured:false,fingerprint:null,profileMaturity:'NOT_RUN_NO_KEY'});await expect(readFile(path.join(process.env.LUMICLAW_MEDIA_SECRET_ROOT!,'media-provider-key'))).rejects.toMatchObject({code:'ENOENT'});});
});
