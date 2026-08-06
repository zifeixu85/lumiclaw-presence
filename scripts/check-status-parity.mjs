import {readFile} from 'node:fs/promises';
import path from 'node:path';

const statePattern = /`(NOT_STARTED|IN_PROGRESS|BLOCKED|EVIDENCE_READY|ACCEPTED|DEFERRED|SUPERSEDED)`/u;
const modulePattern = /\|\s*(M\d+-\d+)\s*\|/u;

export function extractModuleStates(markdown) {
  const result = new Map();
  for (const line of markdown.split('\n')) {
    const moduleId = modulePattern.exec(line)?.[1];
    const state = statePattern.exec(line)?.[1];
    if (moduleId !== undefined && state !== undefined) result.set(moduleId, state);
  }
  return result;
}

export function compareModuleStates(left, right) {
  const ids = [...new Set([...left.keys(), ...right.keys()])].sort();
  return ids
    .filter((id) => left.get(id) !== right.get(id))
    .map((id) => ({id, english: left.get(id) ?? null, chinese: right.get(id) ?? null}));
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const root = process.cwd();
  const english = extractModuleStates(await readFile(path.join(root, 'IMPLEMENTATION-STATUS.md'), 'utf8'));
  const chinese = extractModuleStates(await readFile(path.join(root, 'IMPLEMENTATION-STATUS.zh-CN.md'), 'utf8'));
  const mismatches = compareModuleStates(english, chinese);
  if (english.size === 0 || mismatches.length > 0) {
    console.error(JSON.stringify({code: 'IMPLEMENTATION_STATUS_PARITY_FAILED', mismatches}, null, 2));
    process.exit(1);
  }
  console.info(JSON.stringify({status: 'PASS', modules: english.size}));
}
