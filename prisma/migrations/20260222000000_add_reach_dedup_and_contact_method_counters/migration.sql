-- Add per-contact-method counters to post table
SET @has_contact_call := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'post'
    AND COLUMN_NAME = 'contactCall'
);
SET @sql := IF(
  @has_contact_call = 0,
  'ALTER TABLE `post` ADD COLUMN `contactCall` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_contact_whatsapp := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'post'
    AND COLUMN_NAME = 'contactWhatsapp'
);
SET @sql := IF(
  @has_contact_whatsapp = 0,
  'ALTER TABLE `post` ADD COLUMN `contactWhatsapp` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_contact_email := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'post'
    AND COLUMN_NAME = 'contactEmail'
);
SET @sql := IF(
  @has_contact_email = 0,
  'ALTER TABLE `post` ADD COLUMN `contactEmail` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_contact_instagram := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'post'
    AND COLUMN_NAME = 'contactInstagram'
);
SET @sql := IF(
  @has_contact_instagram = 0,
  'ALTER TABLE `post` ADD COLUMN `contactInstagram` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add unique reach deduplication table
CREATE TABLE IF NOT EXISTS `post_reach_unique` (
  `post_id` BIGINT UNSIGNED NOT NULL,
  `visitor_hash` VARCHAR(64) NOT NULL,
  `dateCreated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`post_id`, `visitor_hash`),
  INDEX `post_reach_unique_post_idx` (`post_id`),
  CONSTRAINT `post_reach_unique_post_fk`
    FOREIGN KEY (`post_id`) REFERENCES `post`(`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
