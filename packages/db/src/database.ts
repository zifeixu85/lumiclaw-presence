import type {ColumnType, Generated} from 'kysely';

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type Json = ColumnType<unknown, unknown, unknown>;

export type CampaignsTable = {
  organization_id: string; id: string; version: number; digest: string; etag: string;
  readiness: 'SAVED' | 'BLOCKED' | 'NEEDS_OWNER'; gap_codes: Json; document: Json; created_at: Timestamp; updated_at: Timestamp;
};
export type CampaignSnapshotsTable = {organization_id: string; campaign_id: string; version: number; digest: string; document: Json; created_at: Timestamp};
export type EvidenceRefsTable = {organization_id: string; id: string; campaign_id: string; content_digest: string; payload: Json; created_at: Timestamp};
export type ClaimsTable = {organization_id: string; id: string; campaign_id: string; version: number; status: string; subject_id: string; effective_from: Timestamp; effective_until: Timestamp; payload: Json; created_at: Timestamp};
export type CapabilitySnapshotsTable = {organization_id: string; id: string; campaign_id: string; channel_account_id: string; platform: string; captured_at: Timestamp; expires_at: Timestamp; payload: Json};
export type ArtifactRevisionsTable = {organization_id: string; id: string; campaign_id: string; activation_unit_id: string; platform: string; revision: number; digest: string; payload: Json; created_at: Timestamp};
export type IdempotencyRecordsTable = {organization_id: string; method: string; route: string; idempotency_key: string; request_digest: string; status_code: number; response_body: Json; response_etag: string | null; created_at: Generated<Timestamp>; expires_at: Timestamp};

export type OrganizationsTable = {id: string; schema_version: number; slug: string; display_name: string; data_mode: 'DEMO_SEED'; live: false; created_at: Generated<Timestamp>};
export type IdentitiesTable = {organization_id: string; id: string; schema_version: number; kind: string; display_name: string; public_bio: string; created_at: Generated<Timestamp>};
export type BrandsTable = {organization_id: string; id: string; schema_version: number; name: string; positioning: string; created_at: Generated<Timestamp>};
export type ProductsTable = {organization_id: string; id: string; schema_version: number; brand_id: string; name: string; description: string; created_at: Generated<Timestamp>};
export type MarketsTable = {organization_id: string; id: string; schema_version: number; code: string; display_name: string; primary_language: string; created_at: Generated<Timestamp>};
export type ChannelAccountsTable = {organization_id: string; id: string; schema_version: number; identity_id: string; platform: string; display_handle: string; connection_state: 'NOT_CONNECTED'; created_at: Generated<Timestamp>};
export type AccountMandatesTable = {organization_id: string; id: string; schema_version: number; channel_account_id: string; identity_id: string; product_id: string; market_id: string; role: string; allowed_actions: Json; requires_owner_review: true; valid_from: Timestamp; valid_until: Timestamp; created_at: Generated<Timestamp>};

export type Database = {
  foundation_metadata: {key: string; value: Json; created_at: Generated<Timestamp>};
  organizations: OrganizationsTable; identities: IdentitiesTable; brands: BrandsTable; products: ProductsTable; markets: MarketsTable;
  channel_accounts: ChannelAccountsTable; account_mandates: AccountMandatesTable;
  campaigns: CampaignsTable; campaign_snapshots: CampaignSnapshotsTable; evidence_refs: EvidenceRefsTable; claims: ClaimsTable;
  capability_snapshots: CapabilitySnapshotsTable; artifact_revisions: ArtifactRevisionsTable; idempotency_records: IdempotencyRecordsTable;
};
