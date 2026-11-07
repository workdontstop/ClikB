CREATE TABLE IF NOT EXISTS social_rooms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_a BIGINT UNSIGNED NOT NULL,
  member_b BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY social_room_pair (member_a, member_b),
  KEY social_room_member_b (member_b, id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS social_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  channel ENUM('global','post','room') NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  post_id BIGINT UNSIGNED NULL,
  room_id BIGINT UNSIGNED NULL,
  reply_id BIGINT UNSIGNED NULL,
  shared_message_id BIGINT UNSIGNED NULL,
  legacy_comment_id BIGINT UNSIGNED NULL,
  body VARCHAR(2000) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY social_legacy_comment (legacy_comment_id),
  KEY social_channel (channel, id),
  KEY social_post_messages (post_id, id),
  KEY social_room_messages (room_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS social_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipient_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('like','reply','room') NOT NULL,
  post_id BIGINT UNSIGNED NULL,
  message_id BIGINT UNSIGNED NULL,
  room_id BIGINT UNSIGNED NULL,
  event_key VARCHAR(120) NOT NULL,
  seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY social_notification_event (event_key),
  KEY social_notification_recipient (recipient_id, id),
  KEY social_notification_unread (recipient_id, seen_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS social_blocks (
  blocker_id BIGINT UNSIGNED NOT NULL,
  blocked_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  KEY social_blocks_reverse (blocked_id, blocker_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS social_reports (
  message_id BIGINT UNSIGNED NOT NULL,
  reporter_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (message_id, reporter_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS social_write_limits (
  owner_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  writes INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;
