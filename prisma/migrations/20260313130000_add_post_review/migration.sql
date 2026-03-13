CREATE TABLE IF NOT EXISTS `post_review` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT UNSIGNED NOT NULL,
    `vendor_id` BIGINT UNSIGNED NOT NULL,
    `review_type` VARCHAR(20) NOT NULL,
    `reason_key` VARCHAR(120) NULL,
    `message` TEXT NULL,
    `visitor_hash` VARCHAR(64) NOT NULL,
    `dateCreated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `dateUpdated` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `post_review_post_visitor_uq`(`post_id`, `visitor_hash`),
    INDEX `post_review_post_created_idx`(`post_id`, `dateCreated`),
    INDEX `post_review_vendor_created_idx`(`vendor_id`, `dateCreated`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `post_review`
    ADD CONSTRAINT `post_review_post_fk`
    FOREIGN KEY (`post_id`) REFERENCES `post`(`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `post_review`
    ADD CONSTRAINT `post_review_vendor_fk`
    FOREIGN KEY (`vendor_id`) REFERENCES `vendor`(`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION;
