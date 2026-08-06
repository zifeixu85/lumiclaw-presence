import {createUuidV7} from '@lumiclaw/domain';
import {createHash} from 'node:crypto';
import type {MediaAsset} from './types.js';

export type MediaGenerationRequest = {organizationId: string; missionId: string; prompt: string; rightsConfirmedSynthetic: true};
export type GeneratedMedia = {asset: MediaAsset; content: Uint8Array};
export interface MediaGenerationProvider { generate(request: MediaGenerationRequest): Promise<GeneratedMedia>; }

export class PublicSafeMockMediaProvider implements MediaGenerationProvider {
  constructor(private readonly now: () => Date = () => new Date()) {}
  async generate(request: MediaGenerationRequest): Promise<GeneratedMedia> {
    if (request.rightsConfirmedSynthetic !== true) throw new MediaProviderError('MEDIA_SYNTHETIC_RIGHTS_REQUIRED', false);
    const label = escapeXml(request.prompt.slice(0, 72));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#101513"/><circle cx="1035" cy="145" r="185" fill="#d9ff5f" opacity=".92"/><path d="M0 500 Q350 360 690 520 T1200 430 V630 H0Z" fill="#24302b"/><text x="72" y="170" fill="#f4f0e8" font-family="ui-sans-serif,system-ui" font-size="62" font-weight="700">LumiClaw Presence</text><text x="76" y="245" fill="#b9c3bd" font-family="ui-sans-serif,system-ui" font-size="28">${label}</text><text x="76" y="560" fill="#d9ff5f" font-family="ui-monospace,monospace" font-size="20">SHADOW · SYNTHETIC · NOT APPROVED</text></svg>`;
    const content = new TextEncoder().encode(svg); const contentDigest = rawContentDigest(content); const now = this.now();
    const asset: MediaAsset = {schemaVersion: 1, id: id(now, contentDigest), organizationId: request.organizationId, missionId: request.missionId, contentDigest, mimeType: 'image/svg+xml', bytes: content.byteLength, provider: 'PUBLIC_SAFE_MOCK', maturity: 'MOCK_CONFORMANCE', rights: {basis: 'SYNTHETIC_GENERATED', commercialUseReviewed: false, ownerApprovalRequired: true}, costReceipt: {currency: 'USD', amount: 0, estimated: false}, approvalState: 'UNREVIEWED', createdAt: now.toISOString()};
    return {asset, content};
  }
}

export class EvoLinkMediaProvider implements MediaGenerationProvider {
  constructor(private readonly apiKey: string | undefined) {}
  async generate(request: MediaGenerationRequest): Promise<GeneratedMedia> {
    if (request.rightsConfirmedSynthetic !== true) throw new MediaProviderError('MEDIA_SYNTHETIC_RIGHTS_REQUIRED', false);
    if (this.apiKey === undefined || this.apiKey.trim().length === 0) throw new MediaProviderError('EVOLINK_CANARY_KEY_REQUIRED', false);
    throw new MediaProviderError('EVOLINK_CANARY_NOT_ENABLED', false);
  }
}

export class MediaProviderError extends Error {
  constructor(public readonly code: 'MEDIA_SYNTHETIC_RIGHTS_REQUIRED' | 'EVOLINK_CANARY_KEY_REQUIRED' | 'EVOLINK_CANARY_NOT_ENABLED', public readonly retryable: boolean) { super(code); this.name = 'MediaProviderError'; }
}

export function verifyContentAddressedIngest(asset: MediaAsset, content: Uint8Array): boolean {
  return asset.bytes === content.byteLength && asset.contentDigest === rawContentDigest(content) && asset.approvalState === 'UNREVIEWED';
}

function escapeXml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
function rawContentDigest(content: Uint8Array): string { return createHash('sha256').update(content).digest('hex'); }
function id(now: Date, digest: string): string { return createUuidV7(now.getTime(), Uint8Array.from(Array.from({length: 10}, (_, index) => Number.parseInt(digest.slice(index * 2, index * 2 + 2), 16)))); }
