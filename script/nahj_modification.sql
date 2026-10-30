-- =====================================================================
-- Nahj game database (schema nahj): changes for the Seller Marketplace
-- Owned and applied by nahj_backend (see
-- docs/prompts/01-nahj-backend-vip-orders.md and 02-nahj-backend-agent-codes.md).
--
-- nahj_backend is in production, so this script only ADDS things:
--   1. orders: six nullable or defaulted columns, added with ALGORITHM=INSTANT
--      (no table copy, no long lock).
--   2. orders: one index, added online (ALGORITHM=INPLACE, LOCK=NONE).
--   3. marketplace_outbox: new table for store sale and refund events.
-- No existing column, index or row is changed. No backfill.
--
-- No schema change (behaviour only):
--   * users_attributes: new keys 'agent_code' and 'agent_code_set_at'.
--
-- user_subscription.expired_at and users.user_type stay the source of truth
-- for VIP access. orders.start_time / end_time / duration_days are filled for
-- marketplace grants and for store VIP orders completed after the release,
-- so a refund can remove exactly that order's unused time.
--
-- Safe to run again: columns, indexes and tables are added only if missing.
-- Times are UTC (utis.GetNow returns time.Now().UTC()).
--
-- Before running in production: take a backup and run on staging first.
-- The current nahj_backend keeps working with these columns present
-- (no query uses SELECT * on orders), so the script can run before the deploy.
-- =====================================================================

USE `nahj`;

-- ---------------------------------------------------------------------
-- Helpers: add a column or an index only if it does not exist yet
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `mk_add_column`;
DROP PROCEDURE IF EXISTS `mk_add_index`;
DELIMITER $$
CREATE PROCEDURE `mk_add_column`(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition VARCHAR(512))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column) THEN
    -- INSTANT fails instead of silently copying the table if it is not possible
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition, ', ALGORITHM=INSTANT');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
CREATE PROCEDURE `mk_add_index`(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_columns VARCHAR(512))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_columns, '), ALGORITHM=INPLACE, LOCK=NONE');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- 1. orders: new columns
-- ---------------------------------------------------------------------
CALL mk_add_column('orders', 'source',           "VARCHAR(16) NOT NULL DEFAULT 'store' COMMENT 'store, marketplace, admin'");
CALL mk_add_column('orders', 'source_ref',       "VARCHAR(64) NULL COMMENT 'marketplace unit id, Google order id (GPA.) or Apple transaction id'");
CALL mk_add_column('orders', 'duration_days',    "INT NULL COMMENT 'set when start_time/end_time hold the real VIP period'");
CALL mk_add_column('orders', 'refunded_at',      "DATETIME(3) NULL");
CALL mk_add_column('orders', 'refunded_seconds', "BIGINT NULL COMMENT 'unused VIP time removed on refund'");
CALL mk_add_column('orders', 'agent_code',       "VARCHAR(16) NULL COMMENT 'agent code copied from the account at completion'");

-- Existing columns keep their definitions. For rows with duration_days set,
-- start_time / end_time are the real VIP period of that order.

-- ---------------------------------------------------------------------
-- 2. orders: a user's orders by period (refund shift, order list)
-- ---------------------------------------------------------------------
CALL mk_add_index('orders', 'idx_user_start', '`user_id`, `start_time`');

-- ---------------------------------------------------------------------
-- 3. marketplace_outbox
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marketplace_outbox` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_type`  VARCHAR(24)  NOT NULL COMMENT 'store_sale, store_refund',
  `event_key`   VARCHAR(160) NOT NULL COMMENT 'e.g. store_sale:google:GPA.1234',
  `payload`     JSON         NOT NULL,
  `attempts`    INT          NOT NULL DEFAULT 0,
  `next_try_at` DATETIME(3)  NOT NULL,
  `sent_at`     DATETIME(3)  NULL,
  `last_error`  VARCHAR(255) NULL,
  `created_at`  DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_marketplace_outbox_event_key` (`event_key`),
  KEY `idx_pending` (`sent_at`, `next_try_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Store sale and refund events for the marketplace';

-- ---------------------------------------------------------------------
-- Clean up helpers
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `mk_add_column`;
DROP PROCEDURE IF EXISTS `mk_add_index`;

-- ---------------------------------------------------------------------
-- Rollback (only before nahj_backend starts writing the new columns)
-- ---------------------------------------------------------------------
-- DROP TABLE IF EXISTS marketplace_outbox;
-- ALTER TABLE orders DROP INDEX idx_user_start,
--   DROP COLUMN agent_code, DROP COLUMN refunded_seconds, DROP COLUMN refunded_at,
--   DROP COLUMN duration_days, DROP COLUMN source_ref, DROP COLUMN source;

-- End of nahj modifications.
