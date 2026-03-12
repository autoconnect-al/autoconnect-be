-- ATC-18: vendor identity flags

SET @has_is_vendor := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'isVendor'
);
SET @sql := IF(
  @has_is_vendor = 0,
  'ALTER TABLE `vendor` ADD COLUMN `isVendor` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_is_normal_user := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'isNormalUser'
);
SET @sql := IF(
  @has_is_normal_user = 0,
  'ALTER TABLE `vendor` ADD COLUMN `isNormalUser` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_is_reposter := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'isReposter'
);
SET @sql := IF(
  @has_is_reposter = 0,
  'ALTER TABLE `vendor` ADD COLUMN `isReposter` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `vendor`
SET `isNormalUser` = CASE
  WHEN COALESCE(`accountExists`, 0) = 0
    AND COALESCE(`initialised`, 0) = 0
  THEN 1
  WHEN LOWER(COALESCE(`accountName`, '')) LIKE '%new vendor%'
  THEN 1
  ELSE 0
END;

UPDATE `vendor`
SET `isVendor` = CASE
  WHEN `isNormalUser` = 0 THEN 1
  ELSE 0
END;

UPDATE `vendor`
SET `isReposter` = CASE
  WHEN `isVendor` = 1
    AND (
      LOWER(COALESCE(`biography`, '')) LIKE '%postoni makinen tuaj%'
      OR LOWER(COALESCE(`biography`, '')) LIKE '%postoni makinën tuaj%'
      OR LOWER(COALESCE(`biography`, '')) LIKE '%postoni veturen tuaj%'
      OR LOWER(COALESCE(`biography`, '')) LIKE '%postoni veturën tuaj%'
      OR LOWER(COALESCE(`biography`, '')) LIKE '%shesim per ju%'
      OR LOWER(COALESCE(`biography`, '')) LIKE '%shesim për ju%'
      OR LOWER(COALESCE(`biography`, '')) LIKE '%komision%'
    )
  THEN 1
  ELSE 0
END;
