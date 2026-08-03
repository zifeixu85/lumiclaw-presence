export type DomainId = string;
export type DataMode = 'DEMO_SEED';
export type Platform = 'X' | 'BLUESKY' | 'LINKEDIN' | 'XIAOHONGSHU';
export type IdentityKind = 'PERSON' | 'PRODUCT';

export type Organization = {
  id: DomainId;
  schemaVersion: 1;
  slug: string;
  displayName: string;
  dataMode: DataMode;
  live: false;
};

export type Identity = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  kind: IdentityKind;
  displayName: string;
  publicBio: string;
};

export type Brand = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  name: string;
  positioning: string;
};

export type Product = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  brandId: DomainId;
  name: string;
  description: string;
};

export type Market = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  code: string;
  displayName: string;
  primaryLanguage: string;
};

export type ChannelAccount = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  identityId: DomainId;
  platform: Platform;
  displayHandle: string;
  connectionState: 'NOT_CONNECTED';
};

export type AccountMandate = {
  id: DomainId;
  organizationId: DomainId;
  schemaVersion: 1;
  channelAccountId: DomainId;
  identityId: DomainId;
  productId: DomainId;
  marketId: DomainId;
  role: 'FOUNDER_VOICE' | 'PRODUCT_VOICE';
  allowedActions: ['PREPARE'];
  requiresOwnerReview: true;
  validFrom: string;
  validUntil: string;
};

export type OrganizationGraph = {
  schemaVersion: 1;
  organization: Organization;
  identities: Identity[];
  brands: Brand[];
  products: Product[];
  markets: Market[];
  channelAccounts: ChannelAccount[];
  accountMandates: AccountMandate[];
};

export type ValidationIssue = {
  code:
    | 'SCHEMA_INVALID'
    | 'GRAPH_DUPLICATE_ID'
    | 'GRAPH_ORGANIZATION_SCOPE_MISMATCH'
    | 'GRAPH_BRAND_NOT_FOUND'
    | 'GRAPH_IDENTITY_NOT_FOUND'
    | 'GRAPH_PRODUCT_NOT_FOUND'
    | 'GRAPH_MARKET_NOT_FOUND'
    | 'GRAPH_ACCOUNT_NOT_FOUND'
    | 'GRAPH_MANDATE_TUPLE_MISMATCH'
    | 'GRAPH_MANDATE_EXPIRED'
    | 'CAMPAIGN_ORGANIZATION_SCOPE_MISMATCH'
    | 'CAMPAIGN_WINDOW_INVALID'
    | 'ACTIVATION_PLATFORM_SET_INVALID'
    | 'ACTIVATION_MANDATE_SCOPE_INVALID'
    | 'ACTIVATION_ACCOUNT_SCOPE_INVALID'
    | 'CLAIM_NOT_FOUND'
    | 'CLAIM_NOT_APPROVED'
    | 'CLAIM_REVOKED'
    | 'CLAIM_EXPIRED'
    | 'CLAIM_PRODUCT_SCOPE_INVALID'
    | 'CLAIM_MARKET_SCOPE_INVALID'
    | 'CLAIM_EVIDENCE_MISSING'
    | 'CAPABILITY_EXPIRED'
    | 'ARTIFACT_ACTIVATION_SCOPE_INVALID'
    | 'ARTIFACT_CAPABILITY_SCOPE_INVALID'
    | 'ARTIFACT_FIELD_REQUIRED'
    | 'ARTIFACT_TEXT_LIMIT_EXCEEDED'
    | 'ARTIFACT_ITEM_LIMIT_EXCEEDED'
    | 'MISSION_SOURCE_DIGEST_MISMATCH';
  path: string;
  message: string;
};

export type ValidationResult =
  | {ok: true}
  | {ok: false; issues: ValidationIssue[]};
