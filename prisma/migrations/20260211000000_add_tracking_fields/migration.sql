-- Add tracking fields to post table
ALTER TABLE `post` ADD COLUMN `reach` INT NOT NULL DEFAULT 0;
ALTER TABLE `post` ADD COLUMN `clicks` INT NOT NULL DEFAULT 0;
ALTER TABLE `post` ADD COLUMN `contact` INT NOT NULL DEFAULT 0;

-- Add vendor page impression tracking to vendor table
ALTER TABLE `vendor` ADD COLUMN `vendor_page_impression` INT NOT NULL DEFAULT 0;
