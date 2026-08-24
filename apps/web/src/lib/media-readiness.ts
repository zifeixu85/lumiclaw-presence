export type MediaReadinessSummary={
  state:string;
  configured:boolean;
  profileMaturity:string;
  providerEvidence:boolean;
};

export type MediaReadinessPresentation={
  tone:'positive'|'warning'|'danger';
  messageKey:'notConfigured'|'configuredOnly'|'canaryFailed'|'canaryExpired'|'canaryReady';
  canStartRealCanary:boolean;
};

export function presentMediaReadiness(value:MediaReadinessSummary|null):MediaReadinessPresentation {
  if(value?.state==='READY'&&value.profileMaturity==='REAL_PROVIDER_CANARY_READY'&&value.providerEvidence)return {tone:'positive',messageKey:'canaryReady',canStartRealCanary:true};
  if(value?.profileMaturity==='CANARY_FAILED'||value?.state==='DEGRADED'&&value.configured)return {tone:'danger',messageKey:'canaryFailed',canStartRealCanary:true};
  if(value?.profileMaturity==='CANARY_EXPIRED'||value?.state==='STALE')return {tone:'warning',messageKey:'canaryExpired',canStartRealCanary:value.configured};
  if(value?.configured)return {tone:'warning',messageKey:'configuredOnly',canStartRealCanary:true};
  return {tone:'warning',messageKey:'notConfigured',canStartRealCanary:false};
}
