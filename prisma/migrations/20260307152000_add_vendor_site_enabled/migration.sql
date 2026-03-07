-- Split 2 (ATC-11 revised): vendor site enable/disable flag

SET @has_site_enabled := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'siteEnabled'
);
SET @sql := IF(
  @has_site_enabled = 0,
  'ALTER TABLE `vendor` ADD COLUMN `siteEnabled` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `vendor`
SET `siteEnabled` = CASE
  WHEN (
    COALESCE(TRIM(`subdomain`), '') <> ''
    OR COALESCE(TRIM(`customDomain`), '') <> ''
    OR COALESCE(TRIM(`siteConfig`), '') <> ''
  )
  THEN 1
  ELSE 0
END;
