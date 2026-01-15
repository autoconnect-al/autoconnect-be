-- CreateTable
CREATE TABLE `Article` (
    `id` VARCHAR(100) NOT NULL,
    `dateCreated` DATETIME(0) NOT NULL,
    `dateUpdated` DATETIME(0) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `title` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `data` JSON NULL,
    `image` VARCHAR(255) NULL,
    `appName` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_detail` (
    `id` BIGINT UNSIGNED NOT NULL,
    `dateCreated` DATETIME(0) NULL,
    `dateUpdated` DATETIME(0) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `post_id` BIGINT UNSIGNED NULL,
    `make` VARCHAR(255) NULL,
    `model` VARCHAR(255) NULL,
    `variant` VARCHAR(255) NULL,
    `registration` VARCHAR(4) NULL,
    `mileage` FLOAT NULL,
    `transmission` VARCHAR(255) NULL,
    `fuelType` VARCHAR(255) NULL,
    `engineSize` VARCHAR(255) NULL,
    `drivetrain` VARCHAR(255) NULL,
    `seats` INTEGER NULL,
    `numberOfDoors` INTEGER NULL,
    `bodyType` VARCHAR(255) NULL,
    `published` BOOLEAN NULL DEFAULT false,
    `customsPaid` BOOLEAN NULL DEFAULT false,
    `options` LONGTEXT NULL,
    `sold` BOOLEAN NULL DEFAULT false,
    `price` FLOAT NULL DEFAULT 0,
    `emissionGroup` VARCHAR(10) NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'car',
    `contact` JSON NULL,
    `priceVerified` BOOLEAN NULL DEFAULT false,
    `mileageVerified` BOOLEAN NULL DEFAULT false,

    UNIQUE INDEX `car_detail_id_uindex`(`id`),
    INDEX `car_detail_post_id_fk`(`post_id`),
    INDEX `deleted`(`deleted`, `published`, `sold`, `type`),
    INDEX `make`(`make`, `model`, `variant`),
    INDEX `mileage`(`mileage`, `price`, `transmission`, `fuelType`, `bodyType`),
    INDEX `registration`(`registration`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_make_model` (
    `Make` VARCHAR(50) NULL,
    `Model` VARCHAR(50) NULL,
    `id` INTEGER UNSIGNED NOT NULL,
    `type` VARCHAR(25) NOT NULL DEFAULT 'car',
    `isVariant` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_status` (
    `id` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `dateCreated` DATETIME(0) NULL,
    `dateUpdated` DATETIME(0) NULL,
    `entity` VARCHAR(10) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `progress` VARCHAR(20) NOT NULL,
    `vendorAccountName` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(0) NULL,
    `logger` VARCHAR(256) NULL,
    `level` VARCHAR(32) NULL,
    `message` LONGTEXT NULL,
    `thread` INTEGER NULL,
    `file` VARCHAR(255) NULL,
    `line` VARCHAR(10) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post` (
    `id` BIGINT UNSIGNED NOT NULL,
    `dateCreated` DATETIME(0) NOT NULL,
    `dateUpdated` DATETIME(0) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `caption` LONGTEXT NULL,
    `createdTime` VARCHAR(100) NULL,
    `sidecarMedias` JSON NULL,
    `vendor_id` BIGINT UNSIGNED NOT NULL,
    `live` BOOLEAN NOT NULL DEFAULT false,
    `likesCount` INTEGER NOT NULL DEFAULT 0,
    `viewsCount` INTEGER NOT NULL DEFAULT 0,
    `cleanedCaption` LONGTEXT NULL,
    `car_detail_id` BIGINT UNSIGNED NULL,
    `revalidate` BOOLEAN NULL DEFAULT false,
    `promotionTo` INTEGER NULL,
    `highlightedTo` INTEGER NULL,
    `renewTo` INTEGER NULL,
    `renewInterval` VARCHAR(10) NULL,
    `renewedTime` INTEGER NULL,
    `mostWantedTo` INTEGER NULL,

    INDEX `car_detail___fk`(`car_detail_id`),
    INDEX `dateUpdated`(`dateUpdated`, `deleted`, `live`),
    INDEX `post_FK`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `potential_vendor` (
    `id` INTEGER NOT NULL,
    `status` VARCHAR(10) NOT NULL,
    `dateCreated` DATETIME(0) NULL,
    `dateUpdated` DATETIME(0) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dateCreated` DATETIME(0) NOT NULL,
    `dateUpdated` DATETIME(0) NULL,
    `deleted` BOOLEAN NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search` (
    `id` BIGINT UNSIGNED NOT NULL,
    `dateCreated` DATETIME(0) NOT NULL,
    `dateUpdated` DATETIME(0) NULL,
    `deleted` VARCHAR(100) NOT NULL DEFAULT '0',
    `caption` LONGTEXT NULL,
    `cleanedCaption` LONGTEXT NOT NULL,
    `createdTime` BIGINT UNSIGNED NULL,
    `sidecarMedias` JSON NULL,
    `likesCount` INTEGER UNSIGNED NULL,
    `viewsCount` INTEGER UNSIGNED NULL,
    `vendorContact` JSON NULL,
    `biography` TEXT NULL,
    `accountName` VARCHAR(100) NULL,
    `vendorId` BIGINT UNSIGNED NOT NULL,
    `profilePicture` MEDIUMTEXT NULL,
    `make` VARCHAR(100) NULL,
    `model` VARCHAR(100) NULL,
    `variant` VARCHAR(255) NULL,
    `registration` YEAR NULL,
    `mileage` INTEGER UNSIGNED NULL,
    `price` INTEGER UNSIGNED NULL,
    `transmission` VARCHAR(100) NULL,
    `fuelType` VARCHAR(100) NULL,
    `engineSize` DECIMAL(10, 0) NULL,
    `drivetrain` VARCHAR(100) NULL,
    `seats` TINYINT UNSIGNED NULL,
    `numberOfDoors` TINYINT UNSIGNED NULL,
    `bodyType` VARCHAR(100) NULL,
    `emissionGroup` VARCHAR(100) NULL,
    `contact` JSON NULL,
    `customsPaid` BOOLEAN NULL,
    `options` JSON NULL,
    `sold` BOOLEAN NULL,
    `type` VARCHAR(100) NULL,
    `promotionTo` INTEGER UNSIGNED NULL,
    `highlightedTo` INTEGER UNSIGNED NULL,
    `renewTo` INTEGER UNSIGNED NULL,
    `renewInterval` VARCHAR(100) NULL,
    `renewedTime` INTEGER UNSIGNED NULL,
    `mostWantedTo` INTEGER UNSIGNED NULL,
    `minPrice` INTEGER NULL,
    `maxPrice` INTEGER NULL,
    `canExchange` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `username` VARCHAR(255) NOT NULL,
    `blocked` BOOLEAN NOT NULL,
    `attemptedLogin` INTEGER NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `deleted` BOOLEAN NOT NULL,
    `dateCreated` DATETIME(0) NOT NULL,
    `dateUpdated` DATETIME(0) NULL,
    `profileImage` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_token` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` BIGINT NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `used` BOOLEAN NOT NULL DEFAULT false,

    INDEX `password_reset_token_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_role` (
    `user_id` BIGINT NOT NULL,
    `role_id` INTEGER NOT NULL,

    INDEX `user_role_FK`(`user_id`),
    INDEX `user_role_FK_1`(`role_id`),
    UNIQUE INDEX `user_role_user_id_IDX`(`user_id`, `role_id`),
    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor` (
    `id` BIGINT UNSIGNED NOT NULL,
    `dateCreated` DATETIME(0) NOT NULL,
    `dateUpdated` DATETIME(0) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `contact` JSON NULL,
    `accountName` VARCHAR(100) NULL,
    `profilePicture` LONGTEXT NULL,
    `accountExists` BOOLEAN NOT NULL DEFAULT true,
    `initialised` BOOLEAN NULL,
    `biography` VARCHAR(255) NULL,

    INDEX `dateUpdated`(`dateUpdated`),
    INDEX `deleted`(`deleted`, `accountName`, `accountExists`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `car_detail` ADD CONSTRAINT `car_detail_post_id_fk` FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post` ADD CONSTRAINT `car_detail___fk` FOREIGN KEY (`car_detail_id`) REFERENCES `car_detail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post` ADD CONSTRAINT `post_FK` FOREIGN KEY (`vendor_id`) REFERENCES `vendor`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
