import {describe,expect,it} from 'vitest';
import {presentMediaReadiness,type MediaReadinessSummary} from './media-readiness';

const base:MediaReadinessSummary={state:'STARTING',configured:true,profileMaturity:'SECRET_CONFIGURED',providerEvidence:false};

describe('SDD-012 Web media readiness presentation',()=>{
  it.each([
    ['not configured',null,{tone:'warning',messageKey:'notConfigured',canStartRealCanary:false}],
    ['configured without canary',base,{tone:'warning',messageKey:'configuredOnly',canStartRealCanary:true}],
    ['failed canary',{...base,state:'DEGRADED',profileMaturity:'CANARY_FAILED'},{tone:'danger',messageKey:'canaryFailed',canStartRealCanary:true}],
    ['expired canary',{...base,state:'STALE',profileMaturity:'CANARY_EXPIRED'},{tone:'warning',messageKey:'canaryExpired',canStartRealCanary:true}],
    ['persisted successful canary',{...base,state:'READY',profileMaturity:'REAL_PROVIDER_CANARY_READY',providerEvidence:true},{tone:'positive',messageKey:'canaryReady',canStartRealCanary:true}]
  ] as const)('renders %s without inferring evidence from configured mode',(_name,value,expected)=>{expect(presentMediaReadiness(value)).toEqual(expected);});

  it('does not accept an inconsistent READY response without provider evidence',()=>{expect(presentMediaReadiness({...base,state:'READY',profileMaturity:'REAL_PROVIDER_CANARY_READY',providerEvidence:false})).toMatchObject({tone:'warning',messageKey:'configuredOnly'});});
});
