-- =====================================================================
-- LOCAL TEST DATA ONLY. Never run on staging or production.
-- Seeds the local nahj database so nahj_backend's marketplace endpoints
-- (task 01) can be tried by hand.
--
-- Tables:
--   items : the six VIP passes, with the production durations and product IDs
--   users : two test accounts (registered and guest)
-- The code itself writes orders, user_subscription and user_subscription_hist.
--
-- To grant VIP to your own Keycloak account, add a users row whose id is
-- your Keycloak user ID (the token's "sub").
-- Safe to run again: rows are inserted only if missing.
-- =====================================================================

USE `nahj`;

INSERT INTO items (id, item_id, item_type, item_sub_type, config, item_category, price, item_desc,
                   is_sallable, google_product_id, apple_product_id, item_name)
SELECT v.id, v.item_id, 'non-consumable', '', v.config, 'vip_pass', 0, v.item_name,
       1, v.google_id, v.apple_id, v.item_name
FROM (
  SELECT 9001 AS id, 'vip_pass_weekly' AS item_id, 'VIP Weekly' AS item_name,
         'com.nahj.vip.pass.7d' AS google_id, 'com.nahj.vip.pass.7d' AS apple_id,
         '{"appleProductId": "com.nahj.vip.pass.7d", "durationInDays": 7, "googleProductId": "com.nahj.vip.pass.7d"}' AS config
  UNION ALL SELECT 9002, 'vip_pass_monthly', 'VIP Monthly',
         'com.nahj.vip.pass.30d', 'com.nahj.pass.monthly',
         '{"appleProductId": "com.nahj.vip.pass.30d", "durationInDays": 30, "googleProductId": "com.nahj.vip.pass.30d"}'
  UNION ALL SELECT 9003, 'vip_pass_6month', 'VIP 6 Months',
         'com.nahj.vip.pass.180d', 'com.nahj.vip.pass.180d',
         '{"appleProductId": "com.nahj.vip.pass.180d", "durationInDays": 180, "googleProductId": "com.nahj.vip.pass.180d"}'
  UNION ALL SELECT 9004, 'vip_pass_yearly', 'VIP Yearly',
         'com.nahj.vip.pass.365d', 'com.nahj.pass.yearly',
         '{"appleProductId": "com.nahj.vip.pass.365d", "durationInDays": 365, "googleProductId": "com.nahj.vip.pass.365d"}'
  UNION ALL SELECT 9005, 'vip_pass_lifetime', 'VIP Lifetime',
         'com.nahj.vip.pass.36500d', 'com.nahj.pass.lifetime',
         '{"appleProductId": "com.nahj.vip.pass.36500d", "durationInDays": 36500, "googleProductId": "com.nahj.vip.pass.36500d"}'
  UNION ALL SELECT 9006, 'vip_test_pack', 'VIP Test Pack',
         'vip_test_pack', 'vip_test_pack',
         '{"appleProductId": "vip_test_pack", "durationInDays": 1, "googleProductId": "vip_test_pack"}'
) v
WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.item_id = v.item_id);

-- user_type: 0 guest, 1 registered, 3 VIP
INSERT INTO users (id, username, user_type)
SELECT v.id, v.username, v.user_type
FROM (
  SELECT 'test-user-registered' AS id, 'Test Registered' AS username, 1 AS user_type
  UNION ALL SELECT 'test-user-guest', 'Test Guest', 0
) v
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = v.id);

SELECT item_id, JSON_EXTRACT(config, '$.durationInDays') AS days, apple_product_id FROM items WHERE item_category = 'vip_pass';
SELECT id, user_type FROM users WHERE id LIKE 'test-user-%';
