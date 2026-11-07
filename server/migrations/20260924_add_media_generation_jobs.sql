USE superdata;

CREATE TABLE IF NOT EXISTS media_generation_jobs (
  job_key VARCHAR(512) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  provider_job_id VARCHAR(255) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  route VARCHAR(128) NOT NULL,
  pixels INT UNSIGNED NOT NULL,
  action_label VARCHAR(120) NOT NULL,
  model_endpoint VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  charged_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_key),
  UNIQUE KEY uq_media_generation_provider_job (provider, provider_job_id),
  KEY idx_media_generation_user_status (user_id, status),
  KEY idx_media_generation_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
