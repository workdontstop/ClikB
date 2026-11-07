-- Existing member records and authored content keep their IDs.
CREATE TABLE IF NOT EXISTS creative_profiles (
  member_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  username_key VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY creative_profile_username (username_key),
  KEY creative_profile_owner (owner_id, deleted_at, member_id)
);
