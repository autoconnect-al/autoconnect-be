-- AlterTable
ALTER TABLE `vendor` 
  ADD COLUMN `country` VARCHAR(100) NULL,
  ADD COLUMN `city` VARCHAR(100) NULL,
  ADD COLUMN `countryOfOriginForVehicles` VARCHAR(100) NULL,
  ADD COLUMN `phoneNumber` VARCHAR(50) NULL,
  ADD COLUMN `whatsAppNumber` VARCHAR(50) NULL,
  ADD COLUMN `location` VARCHAR(500) NULL,
  ADD COLUMN `useDetailsForPosts` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `car_detail`
  ADD COLUMN `country` VARCHAR(100) NULL,
  ADD COLUMN `city` VARCHAR(100) NULL,
  ADD COLUMN `countryOfOriginForVehicles` VARCHAR(100) NULL,
  ADD COLUMN `phoneNumber` VARCHAR(50) NULL,
  ADD COLUMN `whatsAppNumber` VARCHAR(50) NULL,
  ADD COLUMN `location` VARCHAR(500) NULL;
