import type {CampaignDocument, CampaignEnvelope, MissionContract} from './campaign-types.js';

export type CampaignSummary = {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  digest: string;
  readiness: CampaignEnvelope['readiness'];
  gapCodes: string[];
  updatedAt: string;
  mode: 'DEMO_SEED';
  live: false;
};

export type MutationFailureCode =
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'CAMPAIGN_VERSION_CONFLICT'
  | 'CAMPAIGN_NOT_FOUND';

export type MutationResult =
  | {ok: true; envelope: CampaignEnvelope; replayed: boolean}
  | {ok: false; code: MutationFailureCode; current?: CampaignEnvelope};

export interface CampaignRepository {
  health(): Promise<boolean>;
  list(organizationId: string): Promise<CampaignSummary[]>;
  get(organizationId: string, campaignId: string): Promise<CampaignEnvelope | undefined>;
  getMissionContract(organizationId: string, campaignId: string): Promise<{contract: MissionContract; digest: string; version: number; readiness: CampaignEnvelope['readiness']; gapCodes: string[]} | undefined>;
  create(organizationId: string, document: CampaignDocument, idempotencyKey: string, requestDigest: string, now?: Date): Promise<MutationResult>;
  update(organizationId: string, campaignId: string, document: CampaignDocument, expectedEtag: string, idempotencyKey: string, requestDigest: string, now?: Date): Promise<MutationResult>;
  close(): Promise<void>;
}
