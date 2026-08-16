import {describe, expect, it} from 'vitest';
import {isSecretBearingObject, LocalPresenceContractError, normalizeLocalDisplayName, prepareLocalMaterial, validateOnboardingContext} from './local-presence.js';

describe('local presence contracts', () => {
  it('accepts only a bounded local display name without requiring remote identity fields', () => {
    expect(normalizeLocalDisplayName('  A梦  Owner ')).toBe('A梦 Owner');
    expect(() => normalizeLocalDisplayName('')).toThrowError(LocalPresenceContractError);
    expect(() => normalizeLocalDisplayName(`owner\u0000`)).toThrow('LOCAL_DISPLAY_NAME_INVALID');
  });

  it('keeps Market, Locale, Platform and IANA Time Zone as separate stable codes', () => {
    expect(validateOnboardingContext({marketCode: 'US', contentLocale: 'en-US', platform: 'LINKEDIN', timeZone: 'America/Los_Angeles'})).toEqual({marketCode: 'US', contentLocale: 'en-US', platform: 'LINKEDIN', timeZone: 'America/Los_Angeles'});
    expect(() => validateOnboardingContext({marketCode: 'en-US', contentLocale: 'US', platform: 'LINKEDIN', timeZone: 'UTC'})).toThrow();
  });

  it('extracts UTF-8 MD/TXT with a byte digest and rejects unsupported, binary and oversized inputs', () => {
    const now = new Date('2026-08-16T00:00:00.000Z');
    const prepared = prepareLocalMaterial({ownerProfileId: 'owner', fileName: 'brief.md', declaredMediaType: 'text/markdown', bytes: new TextEncoder().encode('# Public-safe brief\r\nHello')}, now);
    expect(prepared).toMatchObject({fileName: 'brief.md', mediaType: 'text/markdown', state: 'READY', extractedText: '# Public-safe brief\nHello', byteSize: 26});
    expect(prepared.digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(() => prepareLocalMaterial({ownerProfileId: 'owner', fileName: 'brief.pdf', declaredMediaType: 'application/pdf', bytes: new Uint8Array([1])}, now)).toThrow('LOCAL_MATERIAL_TYPE_PLANNED');
    expect(() => prepareLocalMaterial({ownerProfileId: 'owner', fileName: 'brief.txt', declaredMediaType: 'text/plain', bytes: new Uint8Array([0xff])}, now)).toThrow('LOCAL_MATERIAL_UTF8_REQUIRED');
    expect(() => prepareLocalMaterial({ownerProfileId: 'owner', fileName: 'brief.txt', declaredMediaType: 'text/plain', bytes: new Uint8Array(2 * 1024 * 1024 + 1)}, now)).toThrow('LOCAL_MATERIAL_TOO_LARGE');
  });

  it('detects nested browser-secret shaped fields', () => {
    expect(isSecretBearingObject({displayName: 'Owner'})).toBe(false);
    expect(isSecretBearingObject({profile: {apiKey: 'must-not-enter-browser'}})).toBe(true);
  });
});
