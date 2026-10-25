-- =====================================================================
-- Nahj Seller Marketplace: schema nahj_market
-- Generated from docs/database-tables.html (31 tables). Draft for review.
--
-- Run as an admin user on the Cloud SQL server (MySQL 8.4).
-- Safe to run again: every table uses CREATE TABLE IF NOT EXISTS.
--
-- Conventions:
--   * Money is BIGINT whole rupiah; rates are basis points (1000 = 10.00%).
--   * Times are DATETIME(3) in UTC; the application always writes UTC.
--   * Statuses are short VARCHAR values checked in the application.
--   * "Only one active" rules use a nullable flag (1 or NULL) in a unique key.
--   * References between tables are documented in column comments; foreign-key
--     constraints are not created in this draft.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `nahj_market`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Application user: full rights on nahj_market, no rights on nahj.
-- Replace the password with a secret from the secret store before running.
-- CREATE USER IF NOT EXISTS 'nahj_market_app'@'%' IDENTIFIED BY '<from secret store>';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON `nahj_market`.* TO 'nahj_market_app'@'%';
-- Migration user (DDL), used only by the migrate step:
-- CREATE USER IF NOT EXISTS 'nahj_market_migrate'@'%' IDENTIFIED BY '<from secret store>';
-- GRANT ALL PRIVILEGES ON `nahj_market`.* TO 'nahj_market_migrate'@'%';

USE `nahj_market`;

-- =====================================================================
-- Access
-- =====================================================================

-- staff: Nahj staff. Identity is the Keycloak account; capabilities are a JSON list here.
CREATE TABLE IF NOT EXISTS `staff` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` VARCHAR(64) NOT NULL COMMENT 'Keycloak sub',
  `display_name` VARCHAR(128) NOT NULL,
  `email_masked` VARCHAR(128) NOT NULL,
  `capabilities` JSON NOT NULL COMMENT '[{"cap":"finance.refund.approve","market":"ID"}]',
  `status` VARCHAR(12) NOT NULL COMMENT 'active, disabled',
  `last_active_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `disabled_at` DATETIME(3) NULL,
  `version` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_account_id` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Nahj staff. Identity is the Keycloak account; capabilities are a JSON list here.';

-- sessions: Web sessions after Keycloak sign-in. Only a hash of the cookie is stored.
CREATE TABLE IF NOT EXISTS `sessions` (
  `id_hash` BINARY(32) NOT NULL COMMENT 'SHA-256 of the cookie value',
  `account_id` VARCHAR(64) NOT NULL,
  `csrf_hash` BINARY(32) NOT NULL,
  `auth_time` DATETIME(3) NOT NULL COMMENT 'last Keycloak login, for step-up',
  `created_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `ip` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(255) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  PRIMARY KEY (`id_hash`),
  KEY `ix_sessions_account_id_revoked_at` (`account_id`, `revoked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Web sessions after Keycloak sign-in. Only a hash of the cookie is stored.';

-- operations: Idempotency: each mutating request key and its stored outcome.
CREATE TABLE IF NOT EXISTS `operations` (
  `idempotency_key` VARCHAR(64) NOT NULL COMMENT 'Idempotency-Key header',
  `actor` VARCHAR(80) NOT NULL,
  `command` VARCHAR(64) NOT NULL,
  `request_hash` BINARY(32) NOT NULL COMMENT 'same key, different body â†’ rejected',
  `status` VARCHAR(12) NOT NULL COMMENT 'running, done, failed',
  `http_status` INT NULL,
  `response` JSON NULL,
  `created_at` DATETIME(3) NOT NULL,
  `completed_at` DATETIME(3) NULL,
  PRIMARY KEY (`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Idempotency: each mutating request key and its stored outcome.';

-- rate_limits: Fixed-window counters: redeem, code checks, sign-in challenges, resend cooldowns.
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `bucket_key` VARCHAR(160) NOT NULL COMMENT 'e.g. redeem:acct:{id}',
  `window_start` DATETIME(3) NOT NULL,
  `hits` INT NOT NULL,
  PRIMARY KEY (`bucket_key`, `window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Fixed-window counters: redeem, code checks, sign-in challenges, resend cooldowns.';

-- =====================================================================
-- Catalog and settings
-- =====================================================================

-- plans: What is sold, versioned. Each row points to a nahj VIP item. A published row is never edited.
CREATE TABLE IF NOT EXISTS `plans` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `plan_code` VARCHAR(32) NOT NULL COMMENT 'weekly, monthly, 6month, yearly, lifetime',
  `version` INT NOT NULL,
  `status` VARCHAR(12) NOT NULL COMMENT 'draft, scheduled, published, retired',
  `effective_from` DATETIME(3) NULL,
  `item_id` VARCHAR(64) NOT NULL COMMENT 'nahj item, e.g. vip_pass_monthly',
  `duration_days` INT NOT NULL COMMENT 'copied from the item',
  `is_lifetime` TINYINT(1) NOT NULL DEFAULT 0,
  `unit_price` BIGINT NOT NULL COMMENT 'web price, IDR',
  `commission_bps` INT NOT NULL COMMENT 'default web rate',
  `store_base_price` BIGINT NOT NULL COMMENT 'IDR base for app-store commission',
  `store_commission_bps` INT NOT NULL COMMENT 'default app-store rate',
  `refund_window_hours` INT NOT NULL DEFAULT 48 COMMENT 'after activation',
  `unused_refund_days` INT NOT NULL DEFAULT 30 COMMENT 'unused codes, after payment',
  `max_quantity` INT NOT NULL,
  `web_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_by` BIGINT UNSIGNED NOT NULL COMMENT 'staff id',
  `approval_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plans_plan_code_version` (`plan_code`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='What is sold, versioned. Each row points to a nahj VIP item. A published row is never edited.';

-- settings: Every other setting as a versioned JSON value: market rules, referral rule, payment and payout routes, providers.
-- Keys: withdrawal_min Â· store_hold_hours (google 72, apple 336) Â· earning_currencies ["IDR"] Â· referral_rule {target, reward_bps} Â· payment_routes [{method, provider, priority, limits, fee}] Â· payout_routes Â· providers {code, enabled, env, credentials_ref} Â· validity times Â· reserved_names Â· retention
CREATE TABLE IF NOT EXISTS `settings` (
  `setting_key` VARCHAR(64) NOT NULL,
  `version` INT NOT NULL,
  `status` VARCHAR(12) NOT NULL COMMENT 'draft, scheduled, published, retired',
  `effective_from` DATETIME(3) NULL,
  `value` JSON NOT NULL,
  `created_by` BIGINT UNSIGNED NOT NULL,
  `approval_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`setting_key`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Every other setting as a versioned JSON value: market rules, referral rule, payment and payout routes, providers.';

-- =====================================================================
-- Policies
-- =====================================================================

-- policies: Terms, privacy, refund policy and seller terms by version and language. Acceptance is stored where it happens (order, seller).
CREATE TABLE IF NOT EXISTS `policies` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `policy_type` VARCHAR(24) NOT NULL COMMENT 'terms, privacy, refund, seller_terms',
  `version` VARCHAR(16) NOT NULL,
  `locale` VARCHAR(5) NOT NULL COMMENT 'id, en',
  `effective_from` DATETIME(3) NOT NULL,
  `content_md` MEDIUMTEXT NOT NULL,
  `status` VARCHAR(12) NOT NULL COMMENT 'draft, published',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_policies_policy_type_version_locale` (`policy_type`, `version`, `locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Terms, privacy, refund policy and seller terms by version and language. Acceptance is stored where it happens (order, seller).';

-- =====================================================================
-- Sellers and agents
-- =====================================================================

-- sellers: One row per seller or agent: application status, onboarding, profile, agent code, personal rates and wallet settings.
CREATE TABLE IF NOT EXISTS `sellers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` VARCHAR(64) NOT NULL,
  `agent_type` VARCHAR(12) NOT NULL DEFAULT 'partner' COMMENT 'partner, employee',
  `application_status` VARCHAR(16) NOT NULL COMMENT 'draft, pending_review, more_info, approved, rejected',
  `operating_status` VARCHAR(12) NOT NULL COMMENT 'onboarding, active, paused, suspended',
  `display_name` VARCHAR(80) NOT NULL COMMENT 'live, approved version',
  `display_name_norm` VARCHAR(80) NOT NULL COMMENT 'lowercase, no spaces or accents',
  `city` VARCHAR(64) NOT NULL,
  `bio` VARCHAR(500) NULL,
  `logo_file_id` BIGINT UNSIGNED NULL COMMENT 'public bucket',
  `contact` JSON NULL,
  `phone_masked` VARCHAR(32) NULL,
  `listed_in_directory` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'employees default 0',
  `referrer_seller_id` BIGINT UNSIGNED NULL COMMENT 'one level',
  `agent_code` VARCHAR(16) NULL COMMENT 'AGT-7K2M3P',
  `agent_alias` VARCHAR(16) NULL COMMENT 'e.g. TOKOILMU, after approval',
  `commission_bps` INT NULL COMMENT 'personal web rate; NULL = plan default',
  `store_commission_bps` INT NULL COMMENT 'personal store rate; employees 0',
  `store_hold_hours_google` INT NULL COMMENT 'wallet override',
  `store_hold_hours_apple` INT NULL COMMENT 'wallet override',
  `mfa_verified_at` DATETIME(3) NULL COMMENT 'onboarding',
  `terms_policy_id` BIGINT UNSIGNED NULL COMMENT 'accepted seller terms',
  `terms_accepted_at` DATETIME(3) NULL,
  `onboarded_at` DATETIME(3) NULL,
  `reviewer_staff_id` BIGINT UNSIGNED NULL,
  `decided_at` DATETIME(3) NULL,
  `decision_reason` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sellers_account_id` (`account_id`),
  UNIQUE KEY `uq_sellers_display_name_norm` (`display_name_norm`),
  UNIQUE KEY `uq_sellers_agent_code` (`agent_code`),
  UNIQUE KEY `uq_sellers_agent_alias` (`agent_alias`),
  KEY `ix_sellers_operating_status_listed_in_directory_city` (`operating_status`, `listed_in_directory`, `city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='One row per seller or agent: application status, onboarding, profile, agent code, personal rates and wallet settings.';

-- seller_revisions: Anything waiting for review: the application, profile changes, an agent alias. The approved data is copied into sellers.
CREATE TABLE IF NOT EXISTS `seller_revisions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `kind` VARCHAR(12) NOT NULL COMMENT 'application, profile, alias',
  `data` JSON NOT NULL COMMENT 'proposed values',
  `status` VARCHAR(12) NOT NULL COMMENT 'pending, approved, rejected, more_info',
  `reviewer_staff_id` BIGINT UNSIGNED NULL,
  `reason` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `decided_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_seller_revisions_status_kind` (`status`, `kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Anything waiting for review: the application, profile changes, an agent alias. The approved data is copied into sellers.';

-- =====================================================================
-- Control
-- =====================================================================

-- holds: Scoped holds with their investigation details. Each blocks one kind of action on one subject until released.
CREATE TABLE IF NOT EXISTS `holds` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `scope` VARCHAR(20) NOT NULL COMMENT 'new_sales, directory, commission_release, withdrawal, unit, payment',
  `subject_type` VARCHAR(16) NOT NULL COMMENT 'seller, unit, payment_attempt, order',
  `subject_id` VARCHAR(64) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `internal_note` TEXT NULL COMMENT 'staff only',
  `seller_message` VARCHAR(500) NULL COMMENT 'safe text for the seller',
  `owner_staff_id` BIGINT UNSIGNED NULL,
  `review_due_at` DATETIME(3) NULL,
  `placed_by` VARCHAR(80) NOT NULL COMMENT 'staff or system',
  `placed_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NULL COMMENT 'time-limited security holds',
  `released_by` VARCHAR(80) NULL,
  `released_at` DATETIME(3) NULL,
  `active_flag` TINYINT NULL COMMENT '1 while active',
  PRIMARY KEY (`id`),
  KEY `ix_holds_subject_type_subject_id_scope_active_flag` (`subject_type`, `subject_id`, `scope`, `active_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Scoped holds with their investigation details. Each blocks one kind of action on one subject until released.';

-- approvals: Actions that need a second person. The approver can never be the initiator.
CREATE TABLE IF NOT EXISTS `approvals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(32) NOT NULL COMMENT 'manual_adjustment, large_withdrawal, admin_grant, config_publish, refund_exception',
  `subject_type` VARCHAR(24) NOT NULL,
  `subject_id` VARCHAR(64) NOT NULL,
  `payload` JSON NOT NULL COMMENT 'frozen at request',
  `payload_version` INT NOT NULL,
  `initiator_staff_id` BIGINT UNSIGNED NOT NULL,
  `approver_staff_id` BIGINT UNSIGNED NULL,
  `status` VARCHAR(12) NOT NULL COMMENT 'pending, approved, rejected, executed, expired',
  `reason` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `decided_at` DATETIME(3) NULL,
  `executed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `ck_approvals_1` CHECK (approver_staff_id IS NULL OR approver_staff_id <> initiator_staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Actions that need a second person. The approver can never be the initiator.';

-- =====================================================================
-- Sales
-- =====================================================================

-- customers: Buyer profile on the marketplace side, created on first sign-in. Not an identity store.
CREATE TABLE IF NOT EXISTS `customers` (
  `account_id` VARCHAR(64) NOT NULL COMMENT 'Keycloak sub = nahj users.id',
  `display_name` VARCHAR(128) NULL,
  `email_masked` VARCHAR(128) NULL,
  `status` VARCHAR(12) NOT NULL DEFAULT 'active',
  `risk_flag` VARCHAR(32) NULL,
  `first_order_at` DATETIME(3) NULL,
  `last_order_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `anonymized_at` DATETIME(3) NULL COMMENT 'after account deletion',
  PRIMARY KEY (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Buyer profile on the marketplace side, created on first sign-in. Not an identity store.';

-- sale_requests: A seller's sale link, with its current quote. Claimed once by a buyer.
CREATE TABLE IF NOT EXISTS `sale_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token` CHAR(32) NOT NULL COMMENT 'opaque link token',
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `plan_code` VARCHAR(32) NOT NULL,
  `quantity` INT NOT NULL,
  `fulfillment_mode` VARCHAR(8) NOT NULL COMMENT 'direct, codes',
  `status` VARCHAR(12) NOT NULL COMMENT 'draft, awaiting, claimed, expired, revoked',
  `expires_at` DATETIME(3) NOT NULL COMMENT 'link validity',
  `quote_plan_id` BIGINT UNSIGNED NULL COMMENT 'current quote',
  `quote_unit_price` BIGINT NULL,
  `quote_total` BIGINT NULL,
  `quote_commission_bps` INT NULL,
  `quote_expires_at` DATETIME(3) NULL,
  `quote_version` INT NOT NULL DEFAULT 0 COMMENT 'a changed quote needs review again',
  `claimed_by_account_id` VARCHAR(64) NULL,
  `claimed_at` DATETIME(3) NULL,
  `version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sale_requests_token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='A seller''s sale link, with its current quote. Claimed once by a buyer.';

-- orders: Every sale, from both channels: web (sale link, QRIS/VA) and store (in-app purchase with agent code). Frozen snapshot and three independent statuses.
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference` VARCHAR(20) NOT NULL COMMENT 'NHO-261025-7K2M',
  `channel` VARCHAR(6) NOT NULL COMMENT 'web, store',
  `buyer_account_id` VARCHAR(64) NOT NULL,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `sale_request_id` BIGINT UNSIGNED NULL COMMENT 'web only',
  `active_flag` TINYINT NULL COMMENT '1 = active order of the request',
  `replaces_order_id` BIGINT UNSIGNED NULL,
  `plan_id` BIGINT UNSIGNED NOT NULL,
  `item_id` VARCHAR(64) NOT NULL,
  `duration_days` INT NOT NULL,
  `is_lifetime` TINYINT(1) NOT NULL,
  `quantity` INT NOT NULL COMMENT 'store: always 1',
  `unit_price` BIGINT NOT NULL COMMENT 'web price, or store base price',
  `total` BIGINT NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'IDR',
  `commission_bps` INT NOT NULL COMMENT 'web or store rate; 0 for employees',
  `referral_bps` INT NULL,
  `referrer_seller_id` BIGINT UNSIGNED NULL,
  `refund_window_hours` INT NOT NULL COMMENT 'snapshot',
  `unused_refund_days` INT NOT NULL COMMENT 'snapshot',
  `accepted_policies` JSON NULL COMMENT 'web: {"terms":"v3","refund":"v2"}',
  `fulfillment_mode` VARCHAR(8) NOT NULL COMMENT 'direct, codes (store: direct)',
  `payment_status` VARCHAR(16) NOT NULL COMMENT 'unpaid, awaiting, checking, paid, attempt_ended',
  `fulfillment_status` VARCHAR(16) NOT NULL COMMENT 'not_started, completed, recovery',
  `refund_status` VARCHAR(16) NOT NULL DEFAULT 'none' COMMENT 'none, requested, processing, partial, full',
  `winning_attempt_id` BIGINT UNSIGNED NULL COMMENT 'web',
  `payment_confirmed_at` DATETIME(3) NULL COMMENT 'set once; store: purchase time',
  `settled_at` DATETIME(3) NULL,
  `store` VARCHAR(8) NULL COMMENT 'google, apple',
  `store_transaction_id` VARCHAR(128) NULL,
  `original_transaction_id` VARCHAR(128) NULL COMMENT 'Apple restore dedup',
  `nahj_order_id` VARCHAR(64) NULL COMMENT 'client_order_id in nahj.orders',
  `agent_code` VARCHAR(16) NULL COMMENT 'as copied onto the nahj order',
  `reported_price` BIGINT NULL COMMENT 'from the store, reports only',
  `reported_currency` CHAR(3) NULL,
  `earns` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'store: currency rule',
  `store_hold_hours` INT NULL COMMENT 'frozen wallet override or default',
  `version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_reference` (`reference`),
  UNIQUE KEY `uq_orders_winning_attempt_id` (`winning_attempt_id`),
  UNIQUE KEY `uq_orders_sale_request_id_active_flag` (`sale_request_id`, `active_flag`),
  UNIQUE KEY `uq_orders_store_store_transaction_id` (`store`, `store_transaction_id`),
  CONSTRAINT `ck_orders_3` CHECK (fulfillment_mode = 'codes' OR quantity = 1),
  KEY `ix_orders_buyer_account_id_created_at` (`buyer_account_id`, `created_at`),
  KEY `ix_orders_seller_id_created_at` (`seller_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Every sale, from both channels: web (sale link, QRIS/VA) and store (in-app purchase with agent code). Frozen snapshot and three independent statuses.';

-- =====================================================================
-- Payments
-- =====================================================================

-- payment_attempts: One try to pay a web order. Several attempts can belong to one order; the first valid success wins. Providers and routes come from settings.
CREATE TABLE IF NOT EXISTS `payment_attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `provider` VARCHAR(16) NOT NULL COMMENT 'xendit, midtrans, fake',
  `method` VARCHAR(24) NOT NULL COMMENT 'qris, va_bcaâ€¦',
  `route_version` INT NOT NULL COMMENT 'settings version used',
  `merchant_id` VARCHAR(64) NOT NULL,
  `expected_amount` BIGINT NOT NULL,
  `received_amount` BIGINT NULL,
  `currency` CHAR(3) NOT NULL,
  `provider_reference` VARCHAR(128) NULL,
  `provider_transaction_id` VARCHAR(128) NULL,
  `status` VARCHAR(12) NOT NULL COMMENT 'pending, succeeded, failed, expired, unknown',
  `instructions` JSON NULL COMMENT 'QR string or VA number',
  `expires_at` DATETIME(3) NULL,
  `succeeded_at` DATETIME(3) NULL,
  `settled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_attempts_provider_provider_transaction_id` (`provider`, `provider_transaction_id`),
  KEY `ix_payment_attempts_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='One try to pay a web order. Several attempts can belong to one order; the first valid success wins. Providers and routes come from settings.';

-- provider_events: Every webhook body from payment and payout providers, stored before processing.
CREATE TABLE IF NOT EXISTS `provider_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider` VARCHAR(16) NOT NULL,
  `kind` VARCHAR(8) NOT NULL COMMENT 'payment, payout',
  `event_id` VARCHAR(128) NOT NULL,
  `attempt_id` BIGINT UNSIGNED NULL,
  `payload` JSON NOT NULL COMMENT 'raw body',
  `received_at` DATETIME(3) NOT NULL,
  `processed_at` DATETIME(3) NULL,
  `result` VARCHAR(16) NULL COMMENT 'accepted, duplicate, mismatch, ignored',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_provider_events_provider_event_id` (`provider`, `event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Every webhook body from payment and payout providers, stored before processing.';

-- =====================================================================
-- Units and codes
-- =====================================================================

-- units: One row per paid unit (10 codes = 10 rows; a store order = 1 row). Holds price, commission release, VIP grant and refund link.
CREATE TABLE IF NOT EXISTS `units` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `unit_index` INT NOT NULL COMMENT '1..quantity',
  `unit_price` BIGINT NOT NULL,
  `commission_amount` BIGINT NOT NULL COMMENT '0 for employees',
  `referral_amount` BIGINT NOT NULL DEFAULT 0,
  `reversible_amount` BIGINT NOT NULL COMMENT 'left to refund or charge back',
  `status` VARCHAR(20) NOT NULL COMMENT 'awaiting_fulfillment, issued, activated, reserved, refunded, voided',
  `activated_account_id` VARCHAR(64) NULL,
  `activated_at` DATETIME(3) NULL,
  `refund_deadline_at` DATETIME(3) NOT NULL COMMENT '30 d unused, 48 h after activation',
  `grant_client_order_id` VARCHAR(64) NULL COMMENT 'mk-unit-{id} in nahj.orders (web units)',
  `grant_status` VARCHAR(16) NULL COMMENT 'requested, granted, refused_lifetime, refunded, failed',
  `vip_start` DATETIME(3) NULL,
  `vip_end` DATETIME(3) NULL,
  `commission_status` VARCHAR(12) NOT NULL COMMENT 'pending, held, released, reversed, none',
  `commission_release_at` DATETIME(3) NULL COMMENT 'NULL until a code is redeemed or 30 d pass',
  `refund_id` BIGINT UNSIGNED NULL,
  `version` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_units_grant_client_order_id` (`grant_client_order_id`),
  UNIQUE KEY `uq_units_order_id_unit_index` (`order_id`, `unit_index`),
  KEY `ix_units_order_id_status` (`order_id`, `status`),
  KEY `ix_units_commission_status_commission_release_at` (`commission_status`, `commission_release_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='One row per paid unit (10 codes = 10 rows; a store order = 1 row). Holds price, commission release, VIP grant and refund link.';

-- codes: The activation code of a unit, including replaced ones. Keyed hash for lookup, encrypted copy for showing again; never plain text.
CREATE TABLE IF NOT EXISTS `codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `unit_id` BIGINT UNSIGNED NOT NULL,
  `code_hash` BINARY(32) NOT NULL COMMENT 'HMAC-SHA256',
  `code_encrypted` VARBINARY(256) NOT NULL COMMENT 'AES-GCM',
  `code_last4` CHAR(4) NOT NULL COMMENT 'masked display',
  `status` VARCHAR(12) NOT NULL COMMENT 'live, consumed, voided',
  `live_flag` TINYINT NULL COMMENT '1 while live',
  `replaces_code_id` BIGINT UNSIGNED NULL,
  `published_at` DATETIME(3) NULL COMMENT 'in My Purchases',
  `redeemed_account_id` VARCHAR(64) NULL,
  `redeemed_at` DATETIME(3) NULL,
  `redeem_operation_key` VARCHAR(64) NULL COMMENT 'same-account retry returns the stored result',
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_codes_code_hash` (`code_hash`),
  UNIQUE KEY `uq_codes_redeem_operation_key` (`redeem_operation_key`),
  UNIQUE KEY `uq_codes_unit_id_live_flag` (`unit_id`, `live_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='The activation code of a unit, including replaced ones. Keyed hash for lookup, encrypted copy for showing again; never plain text.';

-- =====================================================================
-- Ledger
-- =====================================================================

-- journals: One balanced business event. Never edited; corrections are new journals.
CREATE TABLE IF NOT EXISTS `journals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `journal_type` VARCHAR(40) NOT NULL COMMENT 'payment_accepted, commission_accrued, withdrawal_paidâ€¦',
  `source_type` VARCHAR(24) NOT NULL COMMENT 'unit, order, withdrawal, refund, referral_award, approval',
  `source_id` BIGINT UNSIGNED NOT NULL,
  `seller_id` BIGINT UNSIGNED NULL,
  `approval_id` BIGINT UNSIGNED NULL COMMENT 'manual adjustments',
  `memo` VARCHAR(255) NULL,
  `posted_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_journals_journal_type_source_type_source_id` (`journal_type`, `source_type`, `source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='One balanced business event. Never edited; corrections are new journals.';

-- postings: Debit and credit lines. Accounts are fixed codes; a balance is the sum of its postings.
CREATE TABLE IF NOT EXISTS `postings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `journal_id` BIGINT UNSIGNED NOT NULL,
  `account` VARCHAR(48) NOT NULL COMMENT 'seller:12:available Â· platform:provider_clearing:xendit Â· platform:commission_expense',
  `seller_id` BIGINT UNSIGNED NULL COMMENT 'for fast wallet queries',
  `debit` BIGINT NOT NULL DEFAULT 0,
  `credit` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ix_postings_account_journal_id` (`account`, `journal_id`),
  KEY `ix_postings_seller_id_account` (`seller_id`, `account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Debit and credit lines. Accounts are fixed codes; a balance is the sum of its postings.';

-- =====================================================================
-- Wallet
-- =====================================================================

-- payout_destinations: A seller's bank or e-wallet accounts. Full numbers only encrypted.
CREATE TABLE IF NOT EXISTS `payout_destinations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `type` VARCHAR(12) NOT NULL COMMENT 'bank, ewallet',
  `institution_code` VARCHAR(16) NOT NULL COMMENT 'BCA, DANAâ€¦',
  `account_number_enc` VARBINARY(256) NOT NULL,
  `account_last4` CHAR(4) NOT NULL,
  `holder_name` VARCHAR(128) NOT NULL,
  `verification_status` VARCHAR(12) NOT NULL COMMENT 'pending, verified, failed',
  `provider_ref` VARCHAR(128) NULL,
  `name_match` TINYINT(1) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL,
  `removed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='A seller''s bank or e-wallet accounts. Full numbers only encrypted.';

-- withdrawals: A seller's withdrawal, with its fee quote, frozen amounts and destination, approvals and the payout transfer.
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `destination_id` BIGINT UNSIGNED NOT NULL,
  `destination_snapshot` JSON NOT NULL COMMENT 'masked copy at confirmation',
  `gross` BIGINT NOT NULL,
  `fee` BIGINT NOT NULL,
  `net` BIGINT NOT NULL,
  `fee_quoted_at` DATETIME(3) NOT NULL COMMENT 'a stale quote needs a new confirmation',
  `status` VARCHAR(12) NOT NULL COMMENT 'pending, processing, paid, rejected, cancelled, returned',
  `finance_approver_id` BIGINT UNSIGNED NULL,
  `second_approver_id` BIGINT UNSIGNED NULL COMMENT 'above threshold',
  `payout_provider` VARCHAR(16) NULL,
  `payout_key` VARCHAR(64) NULL COMMENT 'idempotency key sent to the provider',
  `provider_ref` VARCHAR(128) NULL,
  `submitted_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_withdrawals_payout_key` (`payout_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='A seller''s withdrawal, with its fee quote, frozen amounts and destination, approvals and the payout transfer.';

-- =====================================================================
-- Refunds
-- =====================================================================

-- refunds: Refunds of selected units, surplus payments and chargebacks. Paid back by the provider, or by payout to the buyer.
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `attempt_id` BIGINT UNSIGNED NULL COMMENT 'NULL for store refunds',
  `kind` VARCHAR(12) NOT NULL COMMENT 'units, surplus, chargeback, store',
  `amount` BIGINT NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `status` VARCHAR(16) NOT NULL COMMENT 'requested, approved, processing, succeeded, failed, rejected',
  `method` VARCHAR(12) NULL COMMENT 'provider, payout, store',
  `provider_command` VARCHAR(128) NULL,
  `provider_case_id` VARCHAR(128) NULL COMMENT 'chargebacks',
  `deadline_at` DATETIME(3) NULL COMMENT 'chargeback response deadline',
  `payout_destination` JSON NULL COMMENT 'buyer''s bank or e-wallet, masked',
  `payout_provider` VARCHAR(16) NULL,
  `payout_key` VARCHAR(64) NULL,
  `payout_ref` VARCHAR(128) NULL,
  `requested_by` VARCHAR(80) NOT NULL,
  `approved_by` BIGINT UNSIGNED NULL,
  `version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refunds_payout_key` (`payout_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Refunds of selected units, surplus payments and chargebacks. Paid back by the provider, or by payout to the buyer.';

-- =====================================================================
-- Referrals
-- =====================================================================

-- referral_periods: One referred seller's Jakarta month: target, rate and net qualified sales.
CREATE TABLE IF NOT EXISTS `referral_periods` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `referrer_seller_id` BIGINT UNSIGNED NOT NULL,
  `referred_seller_id` BIGINT UNSIGNED NOT NULL,
  `period_month` CHAR(7) NOT NULL COMMENT '2026-10',
  `target_amount` BIGINT NOT NULL COMMENT 'snapshot',
  `reward_bps` INT NOT NULL COMMENT 'snapshot',
  `net_qualified_sales` BIGINT NOT NULL DEFAULT 0,
  `qualified` TINYINT(1) NOT NULL DEFAULT 0,
  `revision` INT NOT NULL DEFAULT 0 COMMENT 'increases on each correction',
  `closed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_referral_periods_referred_seller_id_period_month` (`referred_seller_id`, `period_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='One referred seller''s Jakarta month: target, rate and net qualified sales.';

-- referral_awards: Reward per qualifying unit, with its release state.
CREATE TABLE IF NOT EXISTS `referral_awards` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `period_id` BIGINT UNSIGNED NOT NULL,
  `unit_id` BIGINT UNSIGNED NOT NULL,
  `amount` BIGINT NOT NULL,
  `status` VARCHAR(12) NOT NULL COMMENT 'provisional, awarded, released, reversed',
  `release_at` DATETIME(3) NULL,
  `revision` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_referral_awards_period_id_unit_id_revision` (`period_id`, `unit_id`, `revision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Reward per qualifying unit, with its release state.';

-- =====================================================================
-- Support
-- =====================================================================

-- cases: Support cases, and Finance work items such as duplicate or mismatched payments.
CREATE TABLE IF NOT EXISTS `cases` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference` VARCHAR(20) NOT NULL,
  `kind` VARCHAR(20) NOT NULL COMMENT 'support, payment_duplicate, payment_mismatch, reconciliation',
  `customer_account_id` VARCHAR(64) NULL,
  `seller_id` BIGINT UNSIGNED NULL,
  `order_id` BIGINT UNSIGNED NULL,
  `owner` VARCHAR(8) NOT NULL COMMENT 'seller, nahj',
  `assignee_staff_id` BIGINT UNSIGNED NULL,
  `severity` VARCHAR(8) NOT NULL COMMENT 'low, normal, high',
  `status` VARCHAR(20) NOT NULL COMMENT 'open, waiting_customer, waiting_nahj, reopened, closed',
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `closed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cases_reference` (`reference`),
  KEY `ix_cases_kind_status` (`kind`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Support cases, and Finance work items such as duplicate or mismatched payments.';

-- case_messages: Public replies and internal notes, kept apart by audience. Attachments are files.
CREATE TABLE IF NOT EXISTS `case_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `author_type` VARCHAR(10) NOT NULL COMMENT 'customer, seller, staff, system',
  `author_id` VARCHAR(64) NOT NULL,
  `audience` VARCHAR(10) NOT NULL COMMENT 'public, internal',
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Public replies and internal notes, kept apart by audience. Attachments are files.';

-- =====================================================================
-- Platform
-- =====================================================================

-- notifications: One row per event, recipient and channel. Retries never repeat a business effect.
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_key` VARCHAR(160) NOT NULL,
  `recipient_type` VARCHAR(10) NOT NULL COMMENT 'customer, seller, staff',
  `recipient_id` VARCHAR(64) NOT NULL,
  `channel` VARCHAR(10) NOT NULL COMMENT 'portal, email, push',
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT NOT NULL COMMENT 'never a raw code in title or push',
  `status` VARCHAR(12) NOT NULL COMMENT 'queued, sent, failed',
  `attempts` INT NOT NULL DEFAULT 0,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `sent_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notifications_event_key_recipient_id_channel` (`event_key`, `recipient_id`, `channel`),
  KEY `ix_notifications_recipient_id_read_at` (`recipient_id`, `read_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='One row per event, recipient and channel. Retries never repeat a business effect.';

-- audit_events: Append-only record of who did what. Also holds sale-link timelines, referrer changes and imported security events.
CREATE TABLE IF NOT EXISTS `audit_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `occurred_at` DATETIME(3) NOT NULL,
  `actor_type` VARCHAR(10) NOT NULL COMMENT 'customer, seller, staff, system, service',
  `actor_id` VARCHAR(64) NOT NULL,
  `capability` VARCHAR(48) NULL,
  `action` VARCHAR(48) NOT NULL,
  `entity_type` VARCHAR(24) NOT NULL,
  `entity_id` VARCHAR(64) NOT NULL,
  `reason` VARCHAR(255) NULL,
  `before_redacted` JSON NULL,
  `after_redacted` JSON NULL,
  `outcome` VARCHAR(12) NOT NULL COMMENT 'ok, denied, failed',
  `command_ref` VARCHAR(64) NULL COMMENT 'idempotency key',
  `approver_id` BIGINT UNSIGNED NULL,
  `request_id` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_audit_events_entity_type_entity_id_occurred_at` (`entity_type`, `entity_id`, `occurred_at`),
  KEY `ix_audit_events_actor_id_occurred_at` (`actor_id`, `occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Append-only record of who did what. Also holds sale-link timelines, referrer changes and imported security events.';

-- jobs: Outbox and scheduler in one table. An outbox call is a job due now; a deadline is a job due later. Claimed with SKIP LOCKED.
CREATE TABLE IF NOT EXISTS `jobs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `kind` VARCHAR(32) NOT NULL COMMENT 'payment.create, grant.create, email.send, maturity.runâ€¦',
  `job_key` VARCHAR(160) NOT NULL COMMENT 'dedup key',
  `payload` JSON NULL,
  `run_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(12) NOT NULL COMMENT 'queued, running, done, failed',
  `attempts` INT NOT NULL DEFAULT 0,
  `locked_by` VARCHAR(64) NULL,
  `locked_until` DATETIME(3) NULL,
  `last_error` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `done_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_jobs_job_key` (`job_key`),
  KEY `ix_jobs_status_run_at` (`status`, `run_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Outbox and scheduler in one table. An outbox call is a job due now; a deadline is a job due later. Claimed with SKIP LOCKED.';

-- files: Every uploaded or generated file: evidence, attachments, logos. The file lives in R2; this row controls access.
CREATE TABLE IF NOT EXISTS `files` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_type` VARCHAR(16) NOT NULL COMMENT 'seller_revision, case_message, refund, seller',
  `owner_id` BIGINT UNSIGNED NOT NULL,
  `purpose` VARCHAR(24) NOT NULL COMMENT 'evidence, attachment, logo',
  `bucket` VARCHAR(8) NOT NULL COMMENT 'private, public',
  `file_key` VARCHAR(255) NOT NULL,
  `mime` VARCHAR(64) NOT NULL,
  `size_bytes` INT NOT NULL,
  `scan_status` VARCHAR(12) NOT NULL COMMENT 'pending, clean, rejected',
  `uploaded_by` VARCHAR(80) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_files_owner_type_owner_id` (`owner_type`, `owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Every uploaded or generated file: evidence, attachments, logos. The file lives in R2; this row controls access.';

-- End of nahj_market schema.
