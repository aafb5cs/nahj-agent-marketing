-- =====================================================================
-- Nahj game database (schema nahj): changes for the Seller Marketplace
-- Draft for review. Owned and applied by nahj_backend (see
-- docs/prompts/01-nahj-backend-vip-orders.md and 02-nahj-backend-agent-codes.md).
--
-- What it does:
--   1. orders: new columns so every purchase of VIP time is one row with its
--      real VIP period (store, marketplace, admin, legacy), plus agent_code.
--   2. orders: index for reading a user's active VIP time.
--   3. marketplace_outbox: new table for store sale and refund events.
--   4. Backfill: item_category on existing orders, and one "legacy" order per
--      currently active VIP subscription, so existing VIP users keep their time.
--
-- No schema change (behaviour only):
--   * users_attributes: new keys 'agent_code' and 'agent_code_set_at'.
--   * user_subscription: becomes a copy written from orders.
--
-- Safe to run again: columns, indexes and tables are added only if missing,
-- and the backfill skips rows it already created.
-- Times: nahj_backend stores UTC (utis.GetNow returns time.Now().UTC()),
-- so this script uses UTC_TIMESTAMP(3).
--
-- Before running in production: take a backup, run on staging first,
-- and deploy the nahj_backend version that writes these columns.
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
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
CREATE PROCEDURE `mk_add_index`(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_columns VARCHAR(512))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_columns, ')');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- 1. orders: new columns
-- ---------------------------------------------------------------------
CALL mk_add_column('orders', 'source',           "VARCHAR(16) NOT NULL DEFAULT 'store' COMMENT 'store, marketplace, admin, legacy'");
CALL mk_add_column('orders', 'source_ref',       "VARCHAR(64) NULL COMMENT 'e.g. marketplace unit id'");
CALL mk_add_column('orders', 'item_category',    "VARCHAR(32) NOT NULL DEFAULT '' COMMENT 'vip_pass, gems_purchase, ...'");
CALL mk_add_column('orders', 'duration_days',    "INT NULL COMMENT 'copied from the item at completion'");
CALL mk_add_column('orders', 'is_lifetime',      "TINYINT(1) NOT NULL DEFAULT 0");
CALL mk_add_column('orders', 'refunded_at',      "DATETIME(3) NULL");
CALL mk_add_column('orders', 'refunded_seconds', "BIGINT NULL COMMENT 'unused VIP time removed on refund'");
CALL mk_add_column('orders', 'agent_code',       "VARCHAR(16) NULL COMMENT 'agent code copied from the account at completion'");

-- Existing columns keep their definitions. Their meaning becomes stricter
-- (enforced by nahj_backend code, not by this script):
--   start_time / end_time : the real VIP period of this order
--   amount / currency     : the real price and its currency
--   client_order_id       : unique source key (mk-unit-{id} for marketplace units)

-- ---------------------------------------------------------------------
-- 2. orders: index for active VIP time per user
-- ---------------------------------------------------------------------
CALL mk_add_index('orders', 'idx_user_vip', '`user_id`, `item_category`, `status`, `end_time`');

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
  COMMENT='Store sale and refund events for the marketplace, written in the same transaction as the order change';

-- ---------------------------------------------------------------------
-- 4a. Backfill item_category on existing orders
-- ---------------------------------------------------------------------
UPDATE `orders` o
JOIN `items` i ON i.item_id = o.item_id
SET o.item_category = i.item_category
WHERE o.item_category = '' AND i.item_category IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4b. One legacy order per active VIP subscription
-- Covers the user's remaining time from now until the current expiry,
-- so the new per-order calculation gives the same expiry as today.
-- user_subscription.status: 1 = active.
-- ---------------------------------------------------------------------
INSERT INTO `orders`
  (`item_id`, `user_id`, `amount`, `currency`, `item_desc`, `status`, `create_time`,
   `start_time`, `end_time`, `client_order_id`, `purchase_token`, `result`,
   `source`, `source_ref`, `item_category`, `duration_days`, `is_lifetime`)
SELECT
  IFNULL(s.plan_id, 'vip_pass_legacy'),
  s.user_id,
  NULL,
  NULL,
  'Legacy VIP time migrated from user_subscription',
  'COMPLETED',
  UTC_TIMESTAMP(3),
  UTC_TIMESTAMP(3),
  s.expired_at,
  CONCAT('legacy-sub-', s.id),
  IFNULL(s.purchase_token, ''),
  JSON_OBJECT('migratedFrom', 'user_subscription', 'subscriptionId', s.id),
  'legacy',
  CAST(s.id AS CHAR),
  'vip_pass',
  CEIL(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(3), s.expired_at) / 86400),
  IF(s.plan_id = 'vip_pass_lifetime', 1, 0)
FROM `user_subscription` s
LEFT JOIN `orders` existing ON existing.client_order_id = CONCAT('legacy-sub-', s.id)
WHERE s.status = 1
  AND s.plan_category = 'vip_pass'
  AND s.expired_at > UTC_TIMESTAMP(3)
  AND existing.id IS NULL;

-- ---------------------------------------------------------------------
-- Checks (read-only): run and compare after the backfill
-- ---------------------------------------------------------------------
-- Active VIP users by subscription vs by orders: the two counts should match.
-- SELECT COUNT(DISTINCT user_id) FROM user_subscription
--  WHERE status = 1 AND plan_category = 'vip_pass' AND expired_at > UTC_TIMESTAMP(3);
-- SELECT COUNT(DISTINCT user_id) FROM orders
--  WHERE item_category = 'vip_pass' AND status = 'COMPLETED' AND end_time > UTC_TIMESTAMP(3);
--
-- Legacy No-Ads rows that will not be migrated (No-Ads is discontinued):
-- SELECT status, COUNT(*) FROM user_subscription WHERE plan_category = 'no_ads_pass' GROUP BY status;

-- ---------------------------------------------------------------------
-- Clean up helpers
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `mk_add_column`;
DROP PROCEDURE IF EXISTS `mk_add_index`;

-- ---------------------------------------------------------------------
-- Rollback (only before nahj_backend starts writing the new columns)
-- ---------------------------------------------------------------------
-- DELETE FROM orders WHERE source = 'legacy' AND client_order_id LIKE 'legacy-sub-%';
-- DROP TABLE IF EXISTS marketplace_outbox;
-- ALTER TABLE orders DROP INDEX idx_user_vip,
--   DROP COLUMN agent_code, DROP COLUMN refunded_seconds, DROP COLUMN refunded_at,
--   DROP COLUMN is_lifetime, DROP COLUMN duration_days, DROP COLUMN item_category,
--   DROP COLUMN source_ref, DROP COLUMN source;

-- End of nahj modifications.
