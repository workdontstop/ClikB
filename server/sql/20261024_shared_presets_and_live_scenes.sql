-- MySQL. These are also created lazily by the authenticated routes.
-- Run with the application database selected if its runtime user lacks CREATE privileges.

CREATE TABLE IF NOT EXISTS user_scene_presets (
 id CHAR(36) NOT NULL PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
 request_id VARCHAR(80) NOT NULL, preset_kind VARCHAR(32) NOT NULL,
 revision INT UNSIGNED NOT NULL DEFAULT 1, title VARCHAR(120) NOT NULL,
 payload LONGTEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uniq_scene_preset_request (user_id,request_id),
 KEY idx_scene_preset_kind (preset_kind,updated_at), KEY idx_scene_preset_owner (user_id,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scene_live_builds (
  build_id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(16) NOT NULL,
  operation VARCHAR(32) NOT NULL,
  target_key VARCHAR(255) NOT NULL,
  tier VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,
  request_body LONGTEXT NOT NULL,
  checkpoint LONGTEXT NULL,
  final_result LONGTEXT NULL,
  charged TINYINT(1) NOT NULL DEFAULT 0,
  segments INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_scene_live_builds_user_target (user_id, target_key, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
