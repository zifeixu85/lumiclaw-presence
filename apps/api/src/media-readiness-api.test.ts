import {describe,expect,it} from 'vitest';
import {buildApi} from './server.js';

const base={configured:true,fingerprint:'configured-fingerprint',updatedAt:'2026-08-24T00:00:00.000Z',profileRef:'media-capability://wan-text-to-image/v1',checkedAt:'2026-08-24T00:00:01.000Z',expiresAt:null,providerEvidence:false,canaryReceiptDigest:null};

describe('SDD-012 media readiness API truth boundary',()=>{
  it.each([
    ['configured without call',{...base,state:'STARTING' as const,profileMaturity:'SECRET_CONFIGURED' as const}],
    ['failed canary',{...base,state:'DEGRADED' as const,profileMaturity:'CANARY_FAILED' as const,expiresAt:'2026-08-25T00:00:00.000Z',canaryReceiptDigest:'a'.repeat(64)}],
    ['expired canary',{...base,state:'STALE' as const,profileMaturity:'CANARY_EXPIRED' as const,expiresAt:'2026-08-23T00:00:00.000Z',canaryReceiptDigest:'b'.repeat(64)}],
    ['persisted successful canary',{...base,state:'READY' as const,profileMaturity:'REAL_PROVIDER_CANARY_READY' as const,expiresAt:'2026-08-25T00:00:00.000Z',providerEvidence:true,canaryReceiptDigest:'c'.repeat(64)}]
  ])('reports %s without inferring evidence from provider mode',async(_name,readiness)=>{const app=buildApi({mediaReadinessProbe:async()=>readiness});try{const response=await app.inject({method:'GET',url:'/api/v1/media/readiness'});expect(response.statusCode).toBe(200);expect(response.json()).toMatchObject({...readiness,purpose:'MEDIA_PROVIDER',controlledFake:{providerEvidence:false},browserSecretInputAllowed:false,modelProviderGateIndependent:true});}finally{await app.close();}});
});
