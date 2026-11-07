/** Additive and safe to run again. Does not modify any existing table. */
export const FISH_VOICE_PREVIEW_SCHEMA = `CREATE TABLE IF NOT EXISTS fish_voice_previews (
 id CHAR(36) NOT NULL PRIMARY KEY,
 request_id CHAR(36) NOT NULL,
 voice_id VARCHAR(48) NOT NULL,
 reference_id CHAR(32) NOT NULL,
 model VARCHAR(40) NOT NULL,
 display_name VARCHAR(160) NOT NULL,
 preview_text TEXT NOT NULL,
 direction VARCHAR(500) NOT NULL DEFAULT '',
 content_hash CHAR(64) NOT NULL,
 s3_key VARCHAR(512) NOT NULL,
 s3_url VARCHAR(1024) NOT NULL,
 mime_type VARCHAR(80) NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uniq_fish_preview_request (request_id),
 KEY idx_fish_preview_voice (voice_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
