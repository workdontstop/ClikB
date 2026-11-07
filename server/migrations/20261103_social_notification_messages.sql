-- Apply after 20261103_social_chat.sql. Existing notification rows retain their data.
ALTER TABLE social_notifications
  MODIFY COLUMN kind ENUM('like','reply','room','welcome','credit') NOT NULL;

SET @clikb_notification_body_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'social_notifications' AND COLUMN_NAME = 'body'),
  'SELECT 1',
  'ALTER TABLE social_notifications ADD COLUMN body VARCHAR(500) NULL'
);
PREPARE clikb_notification_body FROM @clikb_notification_body_ddl;
EXECUTE clikb_notification_body;
DEALLOCATE PREPARE clikb_notification_body;
