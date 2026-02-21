-- Add per-contact-method counters to post table
ALTER TABLE `post`
  ADD COLUMN IF NOT EXISTS `contactCall` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `contactWhatsapp` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `contactEmail` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `contactInstagram` INT NOT NULL DEFAULT 0;

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
