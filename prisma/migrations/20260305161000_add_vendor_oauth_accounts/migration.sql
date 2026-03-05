CREATE TABLE IF NOT EXISTS `vendor_oauth_account` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `vendor_id` BIGINT UNSIGNED NOT NULL,
  `provider` VARCHAR(50) NOT NULL,
  `provider_user_id` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `dateCreated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dateUpdated` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_oauth_account_provider_user_uq` (`provider`, `provider_user_id`),
  UNIQUE KEY `vendor_oauth_account_provider_email_uq` (`provider`, `email`),
  KEY `vendor_oauth_account_vendor_fk_idx` (`vendor_id`),
  CONSTRAINT `vendor_oauth_account_vendor_fk`
    FOREIGN KEY (`vendor_id`) REFERENCES `vendor`(`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
);
