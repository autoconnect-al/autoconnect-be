-- Split 3 (ATC-11): vendor site builder config

SET @has_site_config := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'siteConfig'
);
SET @sql := IF(
  @has_site_config = 0,
  'ALTER TABLE `vendor` ADD COLUMN `siteConfig` LONGTEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
