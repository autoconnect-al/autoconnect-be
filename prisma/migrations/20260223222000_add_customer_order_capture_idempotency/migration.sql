SET @schema_name := DATABASE();

SELECT COUNT(*) INTO @table_exists
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders';

SELECT COUNT(*) INTO @captured_at_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND COLUMN_NAME = 'capturedAt';

SET @sql_add_captured_at := IF(
  @table_exists = 1 AND @captured_at_exists = 0,
  'ALTER TABLE `customer_orders` ADD COLUMN `capturedAt` DATETIME(0) NULL',
  'SELECT 1'
);
PREPARE stmt_add_captured_at FROM @sql_add_captured_at;
EXECUTE stmt_add_captured_at;
DEALLOCATE PREPARE stmt_add_captured_at;

SELECT COUNT(*) INTO @capture_key_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND COLUMN_NAME = 'captureKey';

SET @sql_add_capture_key := IF(
  @table_exists = 1 AND @capture_key_exists = 0,
  'ALTER TABLE `customer_orders` ADD COLUMN `captureKey` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt_add_capture_key FROM @sql_add_capture_key;
EXECUTE stmt_add_capture_key;
DEALLOCATE PREPARE stmt_add_capture_key;

SELECT COUNT(*) INTO @capture_key_uq_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND INDEX_NAME = 'customer_orders_capture_key_uq';

SET @sql_add_capture_key_uq := IF(
  @table_exists = 1 AND @capture_key_uq_exists = 0,
  'CREATE UNIQUE INDEX `customer_orders_capture_key_uq` ON `customer_orders`(`captureKey`)',
  'SELECT 1'
);
PREPARE stmt_add_capture_key_uq FROM @sql_add_capture_key_uq;
EXECUTE stmt_add_capture_key_uq;
DEALLOCATE PREPARE stmt_add_capture_key_uq;
