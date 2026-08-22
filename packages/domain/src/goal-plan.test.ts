import {describe,expect,it} from 'vitest';
import {GoalPlanContractError,createOperatingGoalRevision,expectedPlanDates,validateOperatingGoalInput} from './goal-plan.js';

const base={objective:'Run a governed, reviewable public-safe operating rhythm.',horizonDays:7 as const,startsAt:'2026-08-24',endsAt:'2026-08-30',cadence:'DAILY' as const,selectedAccountIds:['account-x-revision'],targetMarket:'US',contentLocale:'en-US',timeZone:'Asia/Singapore',successSignals:[{code:'PUBLISHING_CADENCE' as const,observation:'Record slots that reach Owner review.'}],knowledgeSnapshotId:'snapshot-approved',knowledgeSnapshotDigest:'a'.repeat(64)};

describe('SDD-009 Goal/Plan closed schemas',()=>{
  it.each([{horizonDays:7 as const,endsAt:'2026-08-30'},{horizonDays:30 as const,endsAt:'2026-09-22'}])('accepts an exact $horizonDays-day local-date window',({horizonDays,endsAt})=>{
    const value=validateOperatingGoalInput({...base,horizonDays,endsAt});expect(value.horizonDays).toBe(horizonDays);expect(expectedPlanDates({...value,cadence:'DAILY'})).toHaveLength(horizonDays);
  });
  it('keeps Market, Content Locale and IANA Time Zone as independent stable codes',()=>{
    const value=validateOperatingGoalInput({...base,targetMarket:'CN',contentLocale:'en-US',timeZone:'America/Los_Angeles'});expect(value).toMatchObject({targetMarket:'CN',contentLocale:'en-US',timeZone:'America/Los_Angeles'});
  });
  it.each([
    [{...base,endsAt:'2026-08-31'},'GOAL_TIME_WINDOW_INVALID'],
    [{...base,timeZone:'Singapore-ish'},'TIME_ZONE_INVALID'],
    [{...base,selectedAccountIds:[]},'ACCOUNT_NOT_SELECTED'],
    [{...base,successSignals:[{code:'PUBLISHING_CADENCE',observation:'Guarantee follower growth and revenue.'}]},'SUCCESS_SIGNAL_BUSINESS_OUTCOME_FORBIDDEN'],
    [{...base,secret:'forbidden'},'GOAL_SCHEMA_INVALID']
  ])('fails closed on invalid Goal input', (value,code)=>expect(()=>validateOperatingGoalInput(value)).toThrowError(expect.objectContaining({code})));
  it('creates new immutable revision digests without timestamp-dependent canonicalization',()=>{
    const first=createOperatingGoalRevision({ownerId:'owner',goalId:'goal',revision:1,state:'DRAFT',parentDigest:null,value:base,createdAt:'2026-08-22T00:00:00.000Z'});const same=createOperatingGoalRevision({ownerId:'owner',goalId:'goal',revision:1,state:'DRAFT',parentDigest:null,value:base,createdAt:'2026-08-23T00:00:00.000Z'});expect(same.canonicalDigest).toBe(first.canonicalDigest);const second=createOperatingGoalRevision({ownerId:'owner',goalId:'goal',revision:2,state:'ACTIVE',parentDigest:first.canonicalDigest,value:base,createdAt:'2026-08-23T00:00:00.000Z'});expect(second.canonicalDigest).not.toBe(first.canonicalDigest);expect(second.parentDigest).toBe(first.canonicalDigest);
  });
  it('keeps stable error codes',()=>expect(new GoalPlanContractError('PRODUCER_COVERAGE_REQUIRED').code).toBe('PRODUCER_COVERAGE_REQUIRED'));
});
