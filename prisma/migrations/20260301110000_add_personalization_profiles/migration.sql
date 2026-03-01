CREATE TABLE IF NOT EXISTS `visitor_profile` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `visitor_hash` VARCHAR(64) NOT NULL,
  `dateCreated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dateUpdated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastSeenAt` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `visitor_profile_hash_uq` (`visitor_hash`),
  KEY `visitor_profile_last_seen_idx` (`lastSeenAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `visitor_interest_term` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `visitor_hash` VARCHAR(64) NOT NULL,
  `term_key` VARCHAR(64) NOT NULL,
  `term_value` VARCHAR(255) NOT NULL,
  `score` DOUBLE NOT NULL DEFAULT 0,
  `dateCreated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dateUpdated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `visitor_interest_term_uq` (`visitor_hash`, `term_key`, `term_value`),
  KEY `visitor_interest_term_hash_idx` (`visitor_hash`),
  KEY `visitor_interest_term_updated_idx` (`dateUpdated`),
  CONSTRAINT `visitor_interest_term_profile_fk`
    FOREIGN KEY (`visitor_hash`) REFERENCES `visitor_profile` (`visitor_hash`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
