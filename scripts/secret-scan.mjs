import {execFileSync} from 'node:child_process';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const patterns = [
  {name: 'private-key', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u},
  {name: 'aws-access-key', expression: /AKIA[0-9A-Z]{16}/u},
  {name: 'github-token', expression: /gh[pousr]_[A-Za-z0-9]{30,}/u},
  {name: 'openai-like-key', expression: /sk-[A-Za-z0-9]{32,}/u},
  {name: 'slack-token', expression: /xox[baprs]-[A-Za-z0-9-]{20,}/u},
  {name: 'cookie-header', expression: /(?:^|\n)Cookie:\s*[^\n]{12,}/iu}
];

export function scanText(value) {
  return patterns.filter(({expression}) => expression.test(value)).map(({name}) => name);
}

async function scanRepository() {
  const root = process.cwd();
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root
  });
  const files = output.toString('utf8').split('\0').filter(Boolean);
  const findings = [];
  for (const file of files) {
    const absolute = path.resolve(root, file);
    const metadata = await stat(absolute);
    if (!metadata.isFile() || metadata.size > 2_000_000) continue;
    const value = await readFile(absolute);
    if (value.includes(0)) continue;
    for (const finding of scanText(value.toString('utf8'))) findings.push({file, finding});
  }
  return {files: files.length, findings};
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const result = await scanRepository();
  const evidencePath = path.join(process.cwd(), '.evidence/sdd-002/secret-scan.json');
  await mkdir(path.dirname(evidencePath), {recursive: true});
  await writeFile(evidencePath, `${JSON.stringify({
    schemaVersion: '1.0.0',
    status: result.findings.length === 0 ? 'PASS' : 'FAIL',
    generatedAt: new Date().toISOString(),
    scannedFiles: result.files,
    findings: result.findings
  }, null, 2)}\n`);
  if (result.findings.length > 0) {
    console.error(JSON.stringify({code: 'SECRET_SCAN_FAILED', ...result}, null, 2));
    process.exit(1);
  }
  console.info(JSON.stringify({status: 'PASS', scannedFiles: result.files}));
}
