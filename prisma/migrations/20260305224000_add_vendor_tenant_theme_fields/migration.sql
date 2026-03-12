-- Split 1 (ATC-11): vendor tenant + theme fields

SET @has_subdomain := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'subdomain'
);
SET @sql := IF(
  @has_subdomain = 0,
  'ALTER TABLE `vendor` ADD COLUMN `subdomain` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_custom_domain := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'customDomain'
);
SET @sql := IF(
  @has_custom_domain = 0,
  'ALTER TABLE `vendor` ADD COLUMN `customDomain` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_theme := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'theme'
);
SET @sql := IF(
  @has_theme = 0,
  'ALTER TABLE `vendor` ADD COLUMN `theme` VARCHAR(50) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_primary_color := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'primaryColor'
);
SET @sql := IF(
  @has_primary_color = 0,
  'ALTER TABLE `vendor` ADD COLUMN `primaryColor` VARCHAR(7) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_secondary_color := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'secondaryColor'
);
SET @sql := IF(
  @has_secondary_color = 0,
  'ALTER TABLE `vendor` ADD COLUMN `secondaryColor` VARCHAR(7) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_logo := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'logo'
);
SET @sql := IF(
  @has_logo = 0,
  'ALTER TABLE `vendor` ADD COLUMN `logo` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_banner := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'banner'
);
SET @sql := IF(
  @has_banner = 0,
  'ALTER TABLE `vendor` ADD COLUMN `banner` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_subdomain_uq := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND INDEX_NAME = 'vendor_subdomain_uq'
);
SET @sql := IF(
  @has_subdomain_uq = 0,
  'ALTER TABLE `vendor` ADD UNIQUE INDEX `vendor_subdomain_uq` (`subdomain`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_custom_domain_uq := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND INDEX_NAME = 'vendor_custom_domain_uq'
);
SET @sql := IF(
  @has_custom_domain_uq = 0,
  'ALTER TABLE `vendor` ADD UNIQUE INDEX `vendor_custom_domain_uq` (`customDomain`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
