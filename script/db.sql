-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: nahj
-- ------------------------------------------------------
-- Server version	8.4.8-google

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '81f5d02b-35bb-11f1-ac0a-42010a5a6004:1-105975';

--
-- Table structure for table `achievements`
--

DROP TABLE IF EXISTS `achievements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `achievements` (
  `id` varchar(64) NOT NULL,
  `achieve_type` varchar(64) DEFAULT NULL,
  `name` varchar(64) DEFAULT NULL,
  `description` varchar(256) DEFAULT NULL,
  `config` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_achieve_type` (`achieve_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `after_play_records`
--

DROP TABLE IF EXISTS `after_play_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `after_play_records` (
  `level_id` varchar(64) NOT NULL,
  `sticker_id` varchar(64) DEFAULT '',
  `status` varchar(64) DEFAULT '',
  `lastu_update` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `game_id` varchar(64) DEFAULT '',
  `game_level_id` varchar(64) DEFAULT '',
  `nonce` varchar(64) DEFAULT '',
  `sign` varchar(64) DEFAULT '',
  `request_id` varchar(64) DEFAULT '',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `level_no` bigint DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3201 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `apis_response`
--

DROP TABLE IF EXISTS `apis_response`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `apis_response` (
  `request_id` varchar(128) NOT NULL,
  `create_time` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `response_body` json DEFAULT (json_object()),
  PRIMARY KEY (`request_id`),
  UNIQUE KEY `request_id_UNIQUE` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `app_config`
--

DROP TABLE IF EXISTS `app_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_config` (
  `config_id` varchar(64) NOT NULL,
  `int_data` bigint DEFAULT '0',
  `string_data` varchar(45) DEFAULT '',
  `config_version` int DEFAULT '0',
  `config` json DEFAULT (json_object()),
  PRIMARY KEY (`config_id`),
  UNIQUE KEY `config_id_UNIQUE` (`config_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `avatars`
--

DROP TABLE IF EXISTS `avatars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `avatars` (
  `id` varchar(64) NOT NULL,
  `type` varchar(32) DEFAULT 'NONE',
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `config` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_verify`
--

DROP TABLE IF EXISTS `email_verify`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verify` (
  `id` varchar(128) NOT NULL,
  `email` varchar(128) NOT NULL,
  `verify_code` varchar(32) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_UNIQUE` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `game_records`
--

DROP TABLE IF EXISTS `game_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_records` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `earned_score` int DEFAULT NULL,
  `success_attempts` int DEFAULT NULL,
  `failed_attempts` int DEFAULT NULL,
  `total_attempts` int DEFAULT NULL,
  `game_id` varchar(64) DEFAULT NULL,
  `level_id` varchar(64) DEFAULT NULL,
  `time_spent` int DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `stars_earned` int DEFAULT NULL,
  `extra_points` int DEFAULT NULL,
  `result_status` varchar(64) DEFAULT NULL,
  `sign` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_user_game` (`user_id`,`game_id`),
  KEY `idx_user_completed` (`user_id`,`completed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `games`
--

DROP TABLE IF EXISTS `games`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `games` (
  `id` varchar(64) NOT NULL,
  `type` varchar(64) DEFAULT NULL,
  `name` varchar(64) DEFAULT NULL,
  `description` varchar(256) DEFAULT NULL,
  `skill` varchar(32) DEFAULT NULL,
  `config` json DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `game_id` varchar(64) NOT NULL,
  `level_id` varchar(64) NOT NULL,
  `level_seq` bigint DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_skill` (`skill`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `item_id` varchar(64) DEFAULT NULL,
  `item_type` varchar(32) DEFAULT NULL,
  `item_sub_type` varchar(32) DEFAULT '',
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `config` json DEFAULT (json_object()),
  `item_category` varchar(32) DEFAULT '',
  `price` decimal(12,2) DEFAULT '0.00',
  `item_desc` varchar(256) DEFAULT '',
  `discount` int DEFAULT '0',
  `period` varchar(64) DEFAULT '',
  `is_sallable` tinyint(1) DEFAULT '1',
  `last_update` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `available_until` datetime(3) DEFAULT '2125-12-29 22:00:00.123',
  `google_product_id` varchar(64) DEFAULT '',
  `apple_product_id` varchar(64) DEFAULT '',
  `price_gems` int DEFAULT '0',
  `price_points` int DEFAULT '0',
  `item_name` varchar(128) DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_id_UNIQUE` (`item_id`)
) ENGINE=InnoDB AUTO_INCREMENT=301 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `level`
--

DROP TABLE IF EXISTS `level`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `level` (
  `id` varchar(64) NOT NULL,
  `type` varchar(64) DEFAULT NULL,
  `name` varchar(64) DEFAULT NULL,
  `description` varchar(256) DEFAULT NULL,
  `game_id` varchar(64) DEFAULT NULL,
  `config` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_game_id` (`game_id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `main_record`
--

DROP TABLE IF EXISTS `main_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `main_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `shown_number` int DEFAULT NULL,
  `is_completed` tinyint(1) DEFAULT NULL,
  `stars_earned` int DEFAULT NULL,
  `score_earned` int DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `time_spent` int DEFAULT NULL,
  `success_attempts` int DEFAULT NULL,
  `total_attempts` int DEFAULT NULL,
  `game_id` varchar(64) DEFAULT NULL,
  `level_id` varchar(64) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `medal` varchar(16) DEFAULT NULL,
  `stage_type` varchar(16) DEFAULT NULL,
  `nonce` varchar(64) DEFAULT NULL,
  `sign` varchar(64) DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `request_id` varchar(64) DEFAULT '',
  `is_regular` tinyint DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_main_record_user_level_score` (`user_id`,`level_id`,`score_earned` DESC),
  KEY `idx_main_record_request_id` (`request_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5697 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notification_candidates`
--

DROP TABLE IF EXISTS `notification_candidates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_candidates` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `template_id` varchar(64) NOT NULL DEFAULT '',
  `trigger_at` datetime NOT NULL,
  `process_at` datetime NOT NULL,
  `placeholders` json DEFAULT NULL,
  `processed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_unprocessed` (`user_id`,`processed`,`process_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `item_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `amount` int DEFAULT NULL,
  `currency` varchar(64) DEFAULT NULL,
  `item_desc` varchar(256) DEFAULT NULL,
  `status` varchar(32) NOT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `start_time` datetime(3) DEFAULT NULL,
  `end_time` datetime(3) DEFAULT NULL,
  `client_order_id` varchar(64) NOT NULL,
  `purchase_token` varchar(512) DEFAULT '',
  `result` json DEFAULT (json_object()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_order_id_UNIQUE` (`client_order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=375 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `points_gems_orders`
--

DROP TABLE IF EXISTS `points_gems_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `points_gems_orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `item_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `amount` int DEFAULT NULL,
  `currency` varchar(64) DEFAULT NULL,
  `item_desc` varchar(256) DEFAULT NULL,
  `status` varchar(32) NOT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `start_time` datetime(3) DEFAULT NULL,
  `end_time` datetime(3) DEFAULT NULL,
  `client_order_id` varchar(64) NOT NULL,
  `result` json DEFAULT (json_object()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_order_id_UNIQUE` (`client_order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=262 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stages`
--

DROP TABLE IF EXISTS `stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `type` varchar(64) NOT NULL,
  `game_id` varchar(64) NOT NULL,
  `medel` varchar(64) DEFAULT '',
  `config` json DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unlock_tr`
--

DROP TABLE IF EXISTS `unlock_tr`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unlock_tr` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `level_id` varchar(64) DEFAULT NULL,
  `unlock_way` varchar(64) DEFAULT NULL,
  `unlock_time` datetime(3) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `unlock_price` int DEFAULT '0',
  `unlock_currency` varchar(32) DEFAULT '',
  `user_id` varchar(64) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=180 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_achievements`
--

DROP TABLE IF EXISTS `user_achievements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_achievements` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `achievement_id` varchar(64) DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_all_columns` (`id`,`user_id`,`achievement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_daily_reward`
--

DROP TABLE IF EXISTS `user_daily_reward`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_daily_reward` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `claim_status` varchar(32) DEFAULT 'inactive',
  `claim_date` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `day_seq` int DEFAULT '0',
  `metadata` json DEFAULT NULL,
  `claim_id` varchar(64) DEFAULT '',
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `seq_date` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=903 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_stickers`
--

DROP TABLE IF EXISTS `user_stickers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_stickers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) DEFAULT NULL,
  `sticker_id` varchar(64) DEFAULT NULL,
  `earned_time` datetime(3) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `sticker_status` varchar(32) DEFAULT '',
  `game_id` varchar(64) DEFAULT '',
  `sticker_part_id` varchar(64) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1504 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_subscription`
--

DROP TABLE IF EXISTS `user_subscription`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_subscription` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `subscription_date` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `plan_id` varchar(64) DEFAULT NULL,
  `status` tinyint DEFAULT '0',
  `expired_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `auto_renew` tinyint DEFAULT '0',
  `cancel_at` datetime(3) DEFAULT NULL,
  `purchase_token` varchar(256) DEFAULT '',
  `suspend_time` datetime(3) DEFAULT '2200-01-01 00:00:00.000',
  `plan_category` varchar(32) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_subscription_hist`
--

DROP TABLE IF EXISTS `user_subscription_hist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_subscription_hist` (
  `id` bigint NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `subscription_date` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `plan_id` varchar(64) DEFAULT NULL,
  `status` tinyint DEFAULT '0',
  `expired_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `auto_renew` tinyint DEFAULT '0',
  `cancel_at` datetime(3) DEFAULT NULL,
  `PurchaseToken` varchar(512) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_tracking`
--

DROP TABLE IF EXISTS `user_tracking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_tracking` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `user_event` varchar(64) DEFAULT '',
  `event_date` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `int_data` bigint DEFAULT '0',
  `string_data` varchar(45) DEFAULT '',
  `metadata` json NOT NULL DEFAULT (json_object()),
  `is_done` tinyint DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5611 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(64) NOT NULL,
  `username` varchar(255) NOT NULL,
  `total_points` bigint DEFAULT '0',
  `current_level_id` varchar(64) DEFAULT '',
  `user_title` varchar(255) DEFAULT 'starter',
  `total_frozen_points` bigint DEFAULT '0',
  `device_id` varchar(128) DEFAULT '',
  `lives_count` int DEFAULT '5',
  `age` int DEFAULT '0',
  `total_gem` bigint DEFAULT '0',
  `points_last_update` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `frozen_points_last_update` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `gem_last_update` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `total_bronze_medal` int DEFAULT '0',
  `total_silver_medal` int DEFAULT '0',
  `total_gold_medal` int DEFAULT '0',
  `gem_wreath` varchar(128) DEFAULT '',
  `user_type` tinyint NOT NULL DEFAULT '0',
  `last_success_records` int DEFAULT '0',
  `current_level_seq` bigint NOT NULL DEFAULT '1',
  `time_zone` varchar(64) DEFAULT '',
  `gender` varchar(16) DEFAULT 'm',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_attributes`
--

DROP TABLE IF EXISTS `users_attributes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_attributes` (
  `user_id` varbinary(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `value` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`user_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_avatars`
--

DROP TABLE IF EXISTS `users_avatars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_avatars` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) DEFAULT NULL,
  `avatar_id` varchar(64) DEFAULT NULL,
  `earned_time` datetime(3) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `avatar_status` varchar(32) DEFAULT 'NONE',
  `metadata` json DEFAULT (json_object()),
  `expire_time` datetime(3) DEFAULT '2200-10-01 23:59:29.999',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=783 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_certs`
--

DROP TABLE IF EXISTS `users_certs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_certs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `cert_id` varchar(64) NOT NULL,
  `earned_time` datetime(3) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `metadata` json NOT NULL DEFAULT (json_object()),
  `game_id` varchar(64) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=371 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_done_activities`
--

DROP TABLE IF EXISTS `users_done_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_done_activities` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `activity_id` varchar(64) NOT NULL,
  `achieve_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `metadata` json NOT NULL DEFAULT (_utf8mb4'{}'),
  `earned_points` bigint DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=266 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_done_mega_stickers`
--

DROP TABLE IF EXISTS `users_done_mega_stickers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_done_mega_stickers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(65) NOT NULL DEFAULT '',
  `sticker_id` varchar(64) NOT NULL DEFAULT '',
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `earned_time` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_done_stickers`
--

DROP TABLE IF EXISTS `users_done_stickers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_done_stickers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(65) NOT NULL DEFAULT '',
  `sticker_id` varchar(64) NOT NULL DEFAULT '',
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `earned_time` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=246 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_frames`
--

DROP TABLE IF EXISTS `users_frames`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_frames` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) DEFAULT NULL,
  `frame_id` varchar(64) DEFAULT NULL,
  `earned_time` datetime(3) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `frame_status` varchar(32) DEFAULT 'NONE',
  `metadata` json DEFAULT (json_object()),
  `expire_time` datetime(3) DEFAULT '2200-10-01 23:59:29.999',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1287 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_gem_wreath`
--

DROP TABLE IF EXISTS `users_gem_wreath`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_gem_wreath` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `gem_wreath_id` varchar(64) DEFAULT NULL,
  `earned_time` varchar(64) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `status` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=118 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_items`
--

DROP TABLE IF EXISTS `users_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) DEFAULT NULL,
  `item_id` varchar(64) DEFAULT NULL,
  `earned_time` varchar(64) DEFAULT '',
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `item_status` varchar(32) DEFAULT NULL,
  `item_type` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_letters`
--

DROP TABLE IF EXISTS `users_letters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_letters` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `users_id` varchar(64) NOT NULL DEFAULT '',
  `letter_id` varchar(32) NOT NULL DEFAULT '',
  `letter_progress` int NOT NULL DEFAULT '0',
  `last_update` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `letter_level` int NOT NULL DEFAULT '0',
  `is_letter_unlocked` binary(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1463 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_lives`
--

DROP TABLE IF EXISTS `users_lives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_lives` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) DEFAULT NULL,
  `no_lives` int DEFAULT '0',
  `change_at` datetime(3) DEFAULT NULL,
  `last_ad_watched_date` datetime(3) DEFAULT NULL,
  `ads_watched_today` int DEFAULT '0',
  `last_exp_purchase_date` datetime(3) DEFAULT NULL,
  `exp_purchase_today` int DEFAULT '0',
  `last_time_restored_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=408 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_medals`
--

DROP TABLE IF EXISTS `users_medals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_medals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) DEFAULT NULL,
  `medal_id` varchar(64) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `earned_time` datetime(3) DEFAULT NULL,
  `level_id` varchar(64) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4686 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_shop_pack`
--

DROP TABLE IF EXISTS `users_shop_pack`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_shop_pack` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) DEFAULT NULL,
  `pack_id` varchar(64) DEFAULT NULL,
  `earned_time` datetime(3) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `pack_status` varchar(32) DEFAULT 'NONE',
  `metadata` json DEFAULT (json_object()),
  `category` varchar(32) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_titles`
--

DROP TABLE IF EXISTS `users_titles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_titles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `title_id` varchar(64) DEFAULT NULL,
  `earned_time` varchar(64) DEFAULT NULL,
  `create_time` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `title_status` varchar(32) DEFAULT NULL,
  `is_jewel` tinyint(1) DEFAULT '0',
  `is_special` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=410 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-14 20:19:16
