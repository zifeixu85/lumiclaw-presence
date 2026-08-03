import {describe, expect, it} from 'vitest';
import {scanText} from './secret-scan.mjs';

describe('secret hygiene gate', () => {
  it('detects generated secret-like fixtures without committing one', () => {
    const fakePrivateKey = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');
    expect(scanText(fakePrivateKey)).toContain('private-key');
    expect(scanText(fakeAwsKey)).toContain('aws-access-key');
  });

  it('allows documentation phrases and explicit non-live markers', () => {
    expect(scanText('Never commit an API key. DEMO_SEED / NOT_LIVE.')).toEqual([]);
  });
});
