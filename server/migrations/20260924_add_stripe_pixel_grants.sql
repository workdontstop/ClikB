CREATE TABLE IF NOT EXISTS stripe_pixel_grants (
  session_id VARCHAR(255) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  pixels INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  UNIQUE KEY uq_stripe_pixel_grants_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
