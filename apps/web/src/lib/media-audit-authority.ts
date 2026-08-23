type AuditEvidence={result:'PASS'|'FAIL'|'ESCALATE';evidenceMaturity:string;agentTeamsExecuted:boolean;authoritativeForOperations:boolean;runtimeReceiptBinding:unknown|null};

export function mediaAuditAuthority(audit:AuditEvidence|undefined){
  const authoritative=audit!==undefined&&audit.evidenceMaturity==='AGENTTEAMS_RUNTIME'&&audit.agentTeamsExecuted===true&&audit.authoritativeForOperations===true&&audit.runtimeReceiptBinding!==null;
  return {
    evidenceMaturity:audit?.evidenceMaturity??'NOT_RUN',
    agentTeamsExecuted:audit?.agentTeamsExecuted??false,
    authoritativeForOperations:authoritative,
    canOwnerApprove:authoritative&&audit?.result==='PASS',
    canCreatePackage:authoritative&&audit?.result==='PASS',
    nextState:authoritative?'AUTHORITATIVE_AUDIT_READY':'WAITING_FOR_SDD_007_ACCEPTED_AUDITOR_RECEIPT'
  } as const;
}
