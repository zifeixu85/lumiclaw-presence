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
export type PublishingSchedulesTable = {organization_id: string; id: string; campaign_id: string; version: number; kind: string; time_zone: string; local_start: string; rrule: string | null; status: string; payload: Json; created_at: Timestamp; updated_at: Timestamp};
export type ScheduleOccurrencesTable = {organization_id: string; id: string; campaign_id: string; schedule_id: string; schedule_version: number; ordinal: number; scheduled_for: Timestamp; state: string; payload: Json};
export type LocalOwnerProfilesTable = {id: string; singleton_key: true; schema_version: 1; display_name: string; state: 'PROFILE_READY' | 'ONBOARDING_COMPLETE'; created_at: Timestamp; updated_at: Timestamp};
export type LocalOnboardingSessionsTable = {owner_profile_id: string; schema_version: 1; path: 'UNSELECTED' | 'PUBLIC_SAFE_EXAMPLE' | 'LOCAL_MATERIALS'; state: 'MATERIAL_CHOICE' | 'MATERIALS_READY' | 'CONTEXT_READY' | 'COMPLETED'; data_mode: 'LOCAL_PRIVATE' | 'PUBLIC_SAFE_EXAMPLE'; organization_id: string | null; campaign_id: string | null; market_code: string | null; content_locale: string | null; platform: string | null; time_zone: string | null; material_ids: Json; created_at: Timestamp; updated_at: Timestamp};
export type LocalMaterialManifestsTable = {owner_profile_id: string; id: string; schema_version: 1; file_name: string; media_type: 'text/markdown' | 'text/plain'; byte_size: number; digest: string; state: 'READY' | 'UNSUPPORTED' | 'REJECTED' | 'FAILED'; extracted_text: string | null; failure_code: string | null; blob_ref: Json | null; created_at: Timestamp; updated_at: Timestamp};
export type ManualPublishHandoffsTable = {owner_profile_id: string; id: string; schema_version: 1; campaign_id: string; artifact_revision_id: string; platform: string; action: 'COPY_BODY' | 'DOWNLOAD_MEDIA' | 'OPEN_OFFICIAL_PAGE' | 'OWNER_REPORTED_COMPLETE'; state: 'AWAITING_RECONCILIATION'; evidence_receipt_id: string | null; created_at: Timestamp};

export type OrganizationsTable = {id: string; schema_version: number; slug: string; display_name: string; data_mode: 'DEMO_SEED' | 'LOCAL_PRIVATE'; live: false; created_at: Generated<Timestamp>};
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
  publishing_schedules: PublishingSchedulesTable; schedule_occurrences: ScheduleOccurrencesTable;
  local_owner_profiles: LocalOwnerProfilesTable; local_onboarding_sessions: LocalOnboardingSessionsTable; local_material_manifests: LocalMaterialManifestsTable; manual_publish_handoffs: ManualPublishHandoffsTable;
};
