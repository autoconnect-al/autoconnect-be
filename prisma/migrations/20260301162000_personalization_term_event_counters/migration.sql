ALTER TABLE `visitor_interest_term`
  ADD COLUMN `search_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `score`,
  ADD COLUMN `open_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `search_count`,
  ADD COLUMN `contact_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `open_count`,
  ADD COLUMN `impression_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `contact_count`,
  ADD COLUMN `last_event_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `impression_count`;
