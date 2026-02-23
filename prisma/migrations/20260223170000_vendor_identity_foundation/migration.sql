-- Vendor-only identity foundation
-- Phase 1: Add auth fields to vendor, add vendor_role, backfill from user/user_role.

SET @has_vendor_name := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'name'
);
SET @sql := IF(
  @has_vendor_name = 0,
  'ALTER TABLE `vendor` ADD COLUMN `name` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_username := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'username'
);
SET @sql := IF(
  @has_vendor_username = 0,
  'ALTER TABLE `vendor` ADD COLUMN `username` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_blocked := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'blocked'
);
SET @sql := IF(
  @has_vendor_blocked = 0,
  'ALTER TABLE `vendor` ADD COLUMN `blocked` BOOLEAN NULL DEFAULT FALSE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_attempted_login := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'attemptedLogin'
);
SET @sql := IF(
  @has_vendor_attempted_login = 0,
  'ALTER TABLE `vendor` ADD COLUMN `attemptedLogin` INT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_password := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'password'
);
SET @sql := IF(
  @has_vendor_password = 0,
  'ALTER TABLE `vendor` ADD COLUMN `password` TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_email := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'email'
);
SET @sql := IF(
  @has_vendor_email = 0,
  'ALTER TABLE `vendor` ADD COLUMN `email` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_profile_image := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'profileImage'
);
SET @sql := IF(
  @has_vendor_profile_image = 0,
  'ALTER TABLE `vendor` ADD COLUMN `profileImage` LONGTEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_verified := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'verified'
);
SET @sql := IF(
  @has_vendor_verified = 0,
  'ALTER TABLE `vendor` ADD COLUMN `verified` BOOLEAN NULL DEFAULT TRUE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_verification_code := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND COLUMN_NAME = 'verificationCode'
);
SET @sql := IF(
  @has_vendor_verification_code = 0,
  'ALTER TABLE `vendor` ADD COLUMN `verificationCode` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS vendor_role (
  vendor_id BIGINT UNSIGNED NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (vendor_id, role_id),
  KEY vendor_role_fk_role (role_id),
  CONSTRAINT vendor_role_fk_vendor FOREIGN KEY (vendor_id) REFERENCES vendor(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT vendor_role_fk_role_ref FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Backfill vendor auth fields from user where IDs match.
SET @has_user_name := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'name'
);
SET @sql := IF(
  @has_user_name = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.name = COALESCE(NULLIF(v.name, ''''''), NULLIF(u.name, ''''''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_username := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'username'
);
SET @sql := IF(
  @has_user_username = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.username = COALESCE(NULLIF(v.username, ''''''), NULLIF(u.username, ''''''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_blocked := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'blocked'
);
SET @sql := IF(
  @has_user_blocked = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.blocked = COALESCE(v.blocked, u.blocked)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_attempted_login := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'attemptedLogin'
);
SET @sql := IF(
  @has_user_attempted_login = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.attemptedLogin = COALESCE(v.attemptedLogin, u.attemptedLogin)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_password := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'password'
);
SET @sql := IF(
  @has_user_password = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.password = COALESCE(NULLIF(v.password, ''''''), NULLIF(u.password, ''''''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_email := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'email'
);
SET @sql := IF(
  @has_user_email = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.email = COALESCE(NULLIF(v.email, ''''''), NULLIF(u.email, ''''''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_profile_image := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'profileImage'
);
SET @sql := IF(
  @has_user_profile_image = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.profileImage = COALESCE(NULLIF(v.profileImage, ''''''), NULLIF(u.profileImage, ''''''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_phone := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'phone'
);
SET @sql := IF(
  @has_user_phone = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.phoneNumber = COALESCE(NULLIF(v.phoneNumber, ''''''), NULLIF(u.phone, ''''''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_whatsapp := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'whatsapp'
);
SET @sql := IF(
  @has_user_whatsapp = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.whatsAppNumber = COALESCE(NULLIF(v.whatsAppNumber, ''''''), NULLIF(u.whatsapp, ''''''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_location := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'location'
);
SET @sql := IF(
  @has_user_location = 1,
  'UPDATE vendor v INNER JOIN user u ON u.id = v.id SET v.location = COALESCE(NULLIF(v.location, ''''''), NULLIF(u.location, ''''''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Some legacy DBs do not have user.verified / user.verificationCode.
-- Keep vendor defaults for those fields in this baseline backfill.
UPDATE vendor
SET
  verified = COALESCE(verified, TRUE),
  verificationCode = COALESCE(NULLIF(verificationCode, ''), NULL),
  dateUpdated = NOW();

-- Backfill roles from user_role to vendor_role only for existing vendors.
INSERT IGNORE INTO vendor_role (vendor_id, role_id)
SELECT ur.user_id, ur.role_id
FROM user_role ur
INNER JOIN vendor v ON v.id = ur.user_id;

-- Normalize empty auth identifiers so unique indexes can be created safely.
UPDATE vendor
SET username = NULL
WHERE username IS NOT NULL AND TRIM(username) = '';

UPDATE vendor
SET email = NULL
WHERE email IS NOT NULL AND TRIM(email) = '';

-- Resolve duplicate non-empty usernames by suffixing with vendor id.
UPDATE vendor v
INNER JOIN (
  SELECT username, MIN(id) AS keep_id
  FROM vendor
  WHERE username IS NOT NULL
  GROUP BY username
  HAVING COUNT(*) > 1
) d ON d.username = v.username AND v.id <> d.keep_id
SET v.username = CONCAT(v.username, '_', v.id);

-- Resolve duplicate non-empty emails by assigning deterministic placeholder.
UPDATE vendor v
INNER JOIN (
  SELECT email, MIN(id) AS keep_id
  FROM vendor
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING COUNT(*) > 1
) d ON d.email = v.email AND v.id <> d.keep_id
SET v.email = CONCAT('vendor+', v.id, '@local.invalid');

-- Optional uniqueness constraints for cutover safety.
SET @has_vendor_username_uq := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND INDEX_NAME = 'vendor_username_uq'
);
SET @sql := IF(
  @has_vendor_username_uq = 0,
  'CREATE UNIQUE INDEX `vendor_username_uq` ON `vendor` (`username`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_vendor_email_uq := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor'
    AND INDEX_NAME = 'vendor_email_uq'
);
SET @sql := IF(
  @has_vendor_email_uq = 0,
  'CREATE UNIQUE INDEX `vendor_email_uq` ON `vendor` (`email`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
