import {describe,expect,it} from 'vitest';
import {mediaAuditAuthority} from './media-audit-authority.js';

describe('SDD-012 media audit presentation authority',()=>{
  it('shows a controlled PASS without enabling operational approval or package',()=>{
    expect(mediaAuditAuthority({result:'PASS',evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false,authoritativeForOperations:false,runtimeReceiptBinding:null})).toEqual({evidenceMaturity:'CONTROLLED_FIXTURE',agentTeamsExecuted:false,authoritativeForOperations:false,canOwnerApprove:false,canCreatePackage:false,nextState:'WAITING_FOR_SDD_007_ACCEPTED_AUDITOR_RECEIPT'});
  });
  it('does not infer an accepted AgentTeams receipt while no runtime contract is integrated',()=>{
    expect(mediaAuditAuthority(undefined)).toMatchObject({evidenceMaturity:'NOT_RUN',agentTeamsExecuted:false,authoritativeForOperations:false,canOwnerApprove:false,canCreatePackage:false});
  });
});
