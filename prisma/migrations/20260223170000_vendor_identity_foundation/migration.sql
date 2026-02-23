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
  v.name = COALESCE(v.name, u.name),
  v.username = COALESCE(v.username, u.username),
  v.blocked = COALESCE(v.blocked, u.blocked),
  v.attemptedLogin = COALESCE(v.attemptedLogin, u.attemptedLogin),
  v.password = COALESCE(v.password, u.password),
  v.email = COALESCE(v.email, u.email),
  v.profileImage = COALESCE(v.profileImage, u.profileImage),
  v.verified = COALESCE(v.verified, u.verified),
  v.verificationCode = COALESCE(v.verificationCode, u.verificationCode),
  v.phoneNumber = COALESCE(v.phoneNumber, u.phone),
  v.whatsAppNumber = COALESCE(v.whatsAppNumber, u.whatsapp),
  v.location = COALESCE(v.location, u.location),
  v.dateUpdated = NOW();

-- Backfill roles from user_role to vendor_role only for existing vendors.
INSERT IGNORE INTO vendor_role (vendor_id, role_id)
SELECT ur.user_id, ur.role_id
FROM user_role ur
INNER JOIN vendor v ON v.id = ur.user_id;

-- Optional uniqueness constraints for cutover safety.
CREATE UNIQUE INDEX vendor_username_uq ON vendor (username);
CREATE UNIQUE INDEX vendor_email_uq ON vendor (email);
