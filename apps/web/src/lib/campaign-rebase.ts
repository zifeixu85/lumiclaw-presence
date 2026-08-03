import type {CampaignDocument} from '@lumiclaw/domain';

export function rebaseCampaignDraft(base: CampaignDocument, local: CampaignDocument, server: CampaignDocument): {document: CampaignDocument; conflictPaths: string[]} {
  const conflictPaths: string[] = [];
  const merged = mergeThreeWay(base, local, server, '', conflictPaths) as CampaignDocument;
  return {document: merged, conflictPaths};
}

function mergeThreeWay(base: unknown, local: unknown, server: unknown, path: string, conflicts: string[]): unknown {
  const serializedBase = JSON.stringify(base);
  if (JSON.stringify(local) === serializedBase) return structuredClone(server);
  if (JSON.stringify(server) === serializedBase || JSON.stringify(local) === JSON.stringify(server)) return structuredClone(local);
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(server) && base.length === local.length && base.length === server.length) return base.map((item, index) => mergeThreeWay(item, local[index], server[index], `${path}/${index}`, conflicts));
  if (isRecord(base) && isRecord(local) && isRecord(server)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(server)]);
    return Object.fromEntries([...keys].map((key) => [key, mergeThreeWay(base[key], local[key], server[key], `${path}/${key}`, conflicts)]));
  }
  conflicts.push(path || '/');
  return structuredClone(local);
}

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
