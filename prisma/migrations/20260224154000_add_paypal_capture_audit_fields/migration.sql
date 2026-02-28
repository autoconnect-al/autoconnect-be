SET @schema_name := DATABASE();

SELECT COUNT(*) INTO @table_exists
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders';

SELECT COUNT(*) INTO @paypal_capture_id_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND COLUMN_NAME = 'paypalCaptureId';

SET @sql_add_paypal_capture_id := IF(
  @table_exists = 1 AND @paypal_capture_id_exists = 0,
  'ALTER TABLE `customer_orders` ADD COLUMN `paypalCaptureId` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt_add_paypal_capture_id FROM @sql_add_paypal_capture_id;
EXECUTE stmt_add_paypal_capture_id;
DEALLOCATE PREPARE stmt_add_paypal_capture_id;

SELECT COUNT(*) INTO @paypal_payer_email_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND COLUMN_NAME = 'paypalPayerEmail';

SET @sql_add_paypal_payer_email := IF(
  @table_exists = 1 AND @paypal_payer_email_exists = 0,
  'ALTER TABLE `customer_orders` ADD COLUMN `paypalPayerEmail` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt_add_paypal_payer_email FROM @sql_add_paypal_payer_email;
EXECUTE stmt_add_paypal_payer_email;
DEALLOCATE PREPARE stmt_add_paypal_payer_email;

SELECT COUNT(*) INTO @paypal_order_status_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND COLUMN_NAME = 'paypalOrderStatus';

SET @sql_add_paypal_order_status := IF(
  @table_exists = 1 AND @paypal_order_status_exists = 0,
  'ALTER TABLE `customer_orders` ADD COLUMN `paypalOrderStatus` VARCHAR(40) NULL',
  'SELECT 1'
);
PREPARE stmt_add_paypal_order_status FROM @sql_add_paypal_order_status;
EXECUTE stmt_add_paypal_order_status;
DEALLOCATE PREPARE stmt_add_paypal_order_status;

SELECT COUNT(*) INTO @paypal_capture_payload_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND COLUMN_NAME = 'paypalCapturePayload';

SET @sql_add_paypal_capture_payload := IF(
  @table_exists = 1 AND @paypal_capture_payload_exists = 0,
  'ALTER TABLE `customer_orders` ADD COLUMN `paypalCapturePayload` LONGTEXT NULL',
  'SELECT 1'
);
PREPARE stmt_add_paypal_capture_payload FROM @sql_add_paypal_capture_payload;
EXECUTE stmt_add_paypal_capture_payload;
DEALLOCATE PREPARE stmt_add_paypal_capture_payload;

SELECT COUNT(*) INTO @captured_amount_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND COLUMN_NAME = 'capturedAmount';

SET @sql_add_captured_amount := IF(
  @table_exists = 1 AND @captured_amount_exists = 0,
  'ALTER TABLE `customer_orders` ADD COLUMN `capturedAmount` FLOAT NULL',
  'SELECT 1'
);
PREPARE stmt_add_captured_amount FROM @sql_add_captured_amount;
EXECUTE stmt_add_captured_amount;
DEALLOCATE PREPARE stmt_add_captured_amount;

SELECT COUNT(*) INTO @captured_currency_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'customer_orders'
  AND COLUMN_NAME = 'capturedCurrency';

SET @sql_add_captured_currency := IF(
  @table_exists = 1 AND @captured_currency_exists = 0,
  'ALTER TABLE `customer_orders` ADD COLUMN `capturedCurrency` VARCHAR(10) NULL',
  'SELECT 1'
);
PREPARE stmt_add_captured_currency FROM @sql_add_captured_currency;
EXECUTE stmt_add_captured_currency;
DEALLOCATE PREPARE stmt_add_captured_currency;
