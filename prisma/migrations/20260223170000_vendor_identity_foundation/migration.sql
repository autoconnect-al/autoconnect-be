-- Vendor-only identity foundation
-- Phase 1: Add auth fields to vendor, add vendor_role, backfill from user/user_role.

ALTER TABLE vendor
  ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS username VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS blocked BOOLEAN NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attemptedLogin INT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password TEXT NULL,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS profileImage LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS verificationCode VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS vendor_role (
  vendor_id BIGINT UNSIGNED NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (vendor_id, role_id),
  KEY vendor_role_fk_role (role_id),
  CONSTRAINT vendor_role_fk_vendor FOREIGN KEY (vendor_id) REFERENCES vendor(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT vendor_role_fk_role_ref FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Backfill vendor auth fields from user where IDs match.
UPDATE vendor v
INNER JOIN user u ON u.id = v.id
SET
  v.name = COALESCE(NULLIF(v.name, ''), NULLIF(u.name, '')),
  v.username = COALESCE(NULLIF(v.username, ''), NULLIF(u.username, '')),
  v.blocked = COALESCE(v.blocked, u.blocked),
  v.attemptedLogin = COALESCE(v.attemptedLogin, u.attemptedLogin),
  v.password = COALESCE(NULLIF(v.password, ''), NULLIF(u.password, '')),
  v.email = COALESCE(NULLIF(v.email, ''), NULLIF(u.email, '')),
  v.profileImage = COALESCE(NULLIF(v.profileImage, ''), NULLIF(u.profileImage, '')),
  v.verified = COALESCE(v.verified, u.verified),
  v.verificationCode = COALESCE(NULLIF(v.verificationCode, ''), NULLIF(u.verificationCode, '')),
  v.phoneNumber = COALESCE(NULLIF(v.phoneNumber, ''), NULLIF(u.phone, '')),
  v.whatsAppNumber = COALESCE(NULLIF(v.whatsAppNumber, ''), NULLIF(u.whatsapp, '')),
  v.location = COALESCE(NULLIF(v.location, ''), NULLIF(u.location, '')),
  v.dateUpdated = NOW();

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
CREATE UNIQUE INDEX vendor_username_uq ON vendor (username);
CREATE UNIQUE INDEX vendor_email_uq ON vendor (email);
