CREATE TABLE `prompt_import_job` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `runId` VARCHAR(80) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  `totalItems` INT UNSIGNED NOT NULL DEFAULT 0,
  `checkpointIndex` INT UNSIGNED NOT NULL DEFAULT 0,
  `processedItems` INT UNSIGNED NOT NULL DEFAULT 0,
  `lastError` LONGTEXT NULL,
  `dateCreated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dateUpdated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `dateFinished` DATETIME(0) NULL,
  UNIQUE INDEX `prompt_import_job_run_id_uq`(`runId`),
  INDEX `prompt_import_job_status_updated_idx`(`status`, `dateUpdated`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
