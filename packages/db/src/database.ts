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
export type LocalOnboardingSessionsTable = {owner_profile_id: string; schema_version: 1; path: 'UNSELECTED' | 'PUBLIC_SAFE_EXAMPLE' | 'LOCAL_MATERIALS'; state: 'MATERIAL_CHOICE' | 'MATERIALS_READY' | 'CONTEXT_READY' | 'COMPLETION_PENDING' | 'COMPLETED'; data_mode: 'LOCAL_PRIVATE' | 'PUBLIC_SAFE_EXAMPLE'; organization_id: string | null; campaign_id: string | null; completion_digest: string | null; market_code: string | null; content_locale: string | null; platform: string | null; time_zone: string | null; market_codes: Json; content_locales: Json; platforms: Json; default_time_zone: string | null; material_ids: Json; knowledge_state: 'DRAFT' | 'NEEDS_OWNER_DECISION' | 'READY_FOR_APPROVAL' | 'KNOWLEDGE_APPROVED_NEEDS_GOAL'; current_step: 'PERSONA' | 'ORGANIZATION_PRODUCT' | 'SOURCES' | 'X_ACCOUNT' | 'XIAOHONGSHU_ACCOUNT' | 'MARKET_CONTEXT' | 'REVIEW'; row_version: number; target_market: string | null; knowledge_content_locale: string | null; knowledge_time_zone: string | null; current_knowledge_snapshot_id: string | null; current_knowledge_snapshot_digest: string | null; created_at: Timestamp; updated_at: Timestamp};
export type LocalMaterialManifestsTable = {owner_profile_id: string; id: string; schema_version: 1; file_name: string; media_type: 'text/markdown' | 'text/plain'; byte_size: number; digest: string; state: 'READY' | 'UNSUPPORTED' | 'REJECTED' | 'FAILED'; extracted_text: string | null; failure_code: string | null; blob_ref: Json | null; created_at: Timestamp; updated_at: Timestamp};
export type ManualPublishHandoffsTable = {owner_profile_id: string; id: string; schema_version: 1; campaign_id: string; artifact_revision_id: string; platform: string; action: 'COPY_BODY' | 'DOWNLOAD_MEDIA' | 'OPEN_OFFICIAL_PAGE' | 'OWNER_REPORTED_COMPLETE'; state: 'AWAITING_RECONCILIATION'; evidence_receipt_id: string | null; created_at: Timestamp};
export type SourceDocumentsTable = {owner_profile_id: string; id: string; source_kind: 'UPLOADED_FILE' | 'OWNER_AUTHORED_TEXT' | 'LEGACY_LOCAL_MATERIAL' | 'PUBLIC_SAFE_EXAMPLE'; label: string; sensitivity: 'LOCAL_PRIVATE' | 'PUBLIC_SAFE'; created_at: Timestamp; deleted_at: Timestamp | null};
export type SourceDocumentRevisionsTable = {owner_profile_id: string; id: string; document_id: string; version: number; source_kind: SourceDocumentsTable['source_kind']; label: string; file_name: string | null; media_type: 'text/markdown' | 'text/plain'; byte_size: number; blob_digest: string; blob_ref: Json; extracted_text_digest: string; extracted_text: string; candidate_items: Json; status: 'READY' | 'LEGACY_NEEDS_REVIEW' | 'BLOB_MISSING'; sensitivity: 'LOCAL_PRIVATE' | 'PUBLIC_SAFE'; created_at: Timestamp};
export type KnowledgeProfileRevisionsTable = {owner_profile_id: string; id: string; kind: 'PERSONA' | 'ORGANIZATION' | 'PRODUCT' | 'ACCOUNT'; platform_code: 'X' | 'XIAOHONGSHU' | null; version: number; digest: string; payload: Json; created_at: Timestamp};
export type KnowledgeItemsTable = {owner_profile_id: string; id: string; kind: 'PERSONA' | 'ORGANIZATION_FACT' | 'PRODUCT_FACT' | 'CLAIM' | 'EVIDENCE' | 'ACCOUNT_PROFILE' | 'SOURCE_EXCERPT'; normalized_value: string; source_revision_id: string | null; profile_revision_id: string | null; owner_authority: 'CAMPAIGN_EXPLICIT' | 'ORGANIZATION_APPROVED_PRIVATE' | 'PUBLIC_MARKET_PACK' | 'MODEL_PRIOR_SUGGESTION'; sensitivity: 'LOCAL_PRIVATE' | 'PUBLIC_SAFE'; created_at: Timestamp};
export type KnowledgeItemSourceBindingsTable = {owner_profile_id: string; knowledge_item_id: string; source_revision_id: string};
export type KnowledgeConflictResolutionsTable = {owner_profile_id: string; conflict_key: string; selected_item_id: string; note: string; resolved_at: Timestamp};
export type KnowledgeSnapshotsTable = {owner_profile_id: string; id: string; version: number; state: 'DRAFT' | 'NEEDS_OWNER' | 'APPROVED' | 'SUPERSEDED'; session_row_version: number; canonical_digest: string; source_revision_digests: Json; profile_revision_digests: Json; item_bindings: Json; conflict_decisions: Json; gaps: Json; approved_by: string | null; approved_at: Timestamp | null; created_at: Timestamp};
export type KnowledgeSnapshotSourceBindingsTable = {owner_profile_id: string; snapshot_id: string; source_revision_id: string; source_digest: string};
export type KnowledgeIdempotencyRecordsTable = {owner_profile_id: string; route: string; idempotency_key: string; request_digest: string; response_body: Json; created_at: Timestamp};
export type KnowledgeAuditEventsTable = {owner_profile_id: string; id: string; event_code: string; target_type: string; target_id: string | null; redacted_metadata: Json; created_at: Timestamp};

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
  source_documents: SourceDocumentsTable; source_document_revisions: SourceDocumentRevisionsTable; knowledge_profile_revisions: KnowledgeProfileRevisionsTable; knowledge_items: KnowledgeItemsTable; knowledge_item_source_bindings: KnowledgeItemSourceBindingsTable; knowledge_conflict_resolutions: KnowledgeConflictResolutionsTable; knowledge_snapshots: KnowledgeSnapshotsTable; knowledge_snapshot_source_bindings: KnowledgeSnapshotSourceBindingsTable; knowledge_idempotency_records: KnowledgeIdempotencyRecordsTable; knowledge_audit_events: KnowledgeAuditEventsTable;
};
