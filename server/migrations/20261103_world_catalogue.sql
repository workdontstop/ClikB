-- Existing World character rows keep their IDs and media. Both changes can
-- be retried if a database client stops after the first ALTER TABLE.
SET @clikb_world_asset_type_ddl = IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'characters' AND COLUMN_NAME = 'asset_type'),
    'SELECT 1',
    'ALTER TABLE characters ADD COLUMN asset_type ENUM(''character'', ''environment'', ''object'') NOT NULL DEFAULT ''character'''
);
PREPARE clikb_world_asset_type FROM @clikb_world_asset_type_ddl;
EXECUTE clikb_world_asset_type;
DEALLOCATE PREPARE clikb_world_asset_type;

SET @clikb_world_catalogue_revision_ddl = IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'world_models' AND COLUMN_NAME = 'catalog_revision'),
    'SELECT 1',
    'ALTER TABLE world_models ADD COLUMN catalog_revision INT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE clikb_world_catalogue_revision FROM @clikb_world_catalogue_revision_ddl;
EXECUTE clikb_world_catalogue_revision;
DEALLOCATE PREPARE clikb_world_catalogue_revision;
