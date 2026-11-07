-- Additive creation snapshots. Apply before advertising draft capabilities.
ALTER TABLE posts ADD COLUMN allow_remix TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS creation_drafts (
  draft_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  creation_id VARCHAR(160) NOT NULL,
  post_id BIGINT UNSIGNED NOT NULL,
  guest_scope CHAR(64) NULL,
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  digest CHAR(64) NOT NULL,
  snapshot LONGTEXT NOT NULL,
  image_projection_digest LONGTEXT NULL,
  lifecycle VARCHAR(20) NOT NULL DEFAULT 'unpublished',
  preparation_state VARCHAR(20) NOT NULL DEFAULT 'ready',
  source_post_id BIGINT UNSIGNED NULL,
  source_revision BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (draft_id),
  UNIQUE KEY creation_owner (user_id, creation_id),
  UNIQUE KEY creation_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creation_draft_operations (
  user_id BIGINT UNSIGNED NOT NULL,
  creation_id VARCHAR(160) NOT NULL,
  operation_id VARCHAR(160) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  response LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, creation_id, operation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creation_draft_assets (
  draft_id CHAR(36) NOT NULL,
  asset_hash CHAR(64) NOT NULL,
  asset_url TEXT NOT NULL,
  PRIMARY KEY (draft_id, asset_hash),
  KEY retained_asset (asset_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creation_remix_jobs (
  job_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  guest_scope CHAR(64) NULL,
  request_id VARCHAR(160) NOT NULL,
  source_post_id BIGINT UNSIGNED NOT NULL,
  source_revision BIGINT UNSIGNED NOT NULL,
  draft_id CHAR(36) NOT NULL,
  post_id BIGINT UNSIGNED NOT NULL,
  creation_id VARCHAR(160) NOT NULL,
  source_snapshot LONGTEXT NOT NULL,
  source_projection LONGTEXT NOT NULL,
  copy_map LONGTEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'preparing',
  error_code VARCHAR(60) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id),
  UNIQUE KEY remix_request (user_id, request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
