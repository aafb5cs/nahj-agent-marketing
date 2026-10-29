# Task for nahj_backend: per-purchase VIP time and internal endpoints for the seller marketplace

> Paste this whole file as the first message of a new Claude Code session opened in `D:\code\go\nahj\develop\nahj_backend`.
> Before writing any code, produce an implementation plan and wait for approval (see section 9).

## 1. Context

A new project, the **Nahj Seller Marketplace** (repo `agent_marketing`), lets approved sellers in Indonesia sell prepaid VIP passes on the web, either as direct activation on the buyer's account or as activation codes. It is a separate Go service with its own MySQL schema (`nahj_market`). It never reads or writes the `nahj` schema. It changes VIP access **only** through new internal endpoints in this repo.

Today this repo stores VIP access as one `user_subscription` row per user plus `users.user_type`. A buyer may have several purchases (store passes, marketplace codes, admin gifts), and one of them can be refunded without touching the others. That cannot be done with one expiry date. This task makes **every source of VIP time one row in the existing `orders` table with its exact VIP period**. VIP access is then calculated from those rows, and `user_subscription` and `user_type` are kept as a compatibility copy.

Read this repo's `CLAUDE.md` first and follow its conventions: layering `contr/` → `svc/` → `utis/`, i18n error keys in all three locales, logging prefixes, swag annotations, `utis.GetNow()`.

Reference design (in the marketplace repo; ask the user if you need it): `docs/03-database-design.md` §2, and `docs/02-system-analysis.md` §2–3.

## 2. Confirmed business rules (do not change them)

1. **One row per purchase.** Every source of VIP time is one `orders` row: store purchase, marketplace unit, admin gift, or a legacy backfill row.
2. **Duration.** An item grants `durationInDays × 24 hours`. Monthly = 30 days, never a calendar month.
3. **Stacking.** New time starts at the end of the user's current VIP time, or now if they have none. Example: Monthly bought Jan 1 and another Monthly Jan 10 → VIP until Mar 2.
4. **Codes.** Time is added only when a code is redeemed. The marketplace calls the grant endpoint at that moment.
5. **Refund or chargeback** removes only the order's **unused** time: `unused = max(0, end_time − max(start_time, now))`. Every VIP order of that user queued after it moves earlier by `unused`. An order that has already ended removes nothing.
6. **Lifetime** is the existing item `vip_pass_lifetime` (36,500 days). It is normal subscription time and stacks like any other pass. A user is a **Lifetime holder** while they have a `COMPLETED`, non-refunded order with `is_lifetime = 1` and `end_time > now`. A Lifetime holder must not get more VIP added to their own account through the marketplace (see the `rejectIfLifetime` flag in §5.2).
7. **No-Ads is discontinued.** Do not add new No-Ads logic. Existing No-Ads code paths may stay but must not break.
8. **No offline grace period** is added.
9. **Compatibility.** The current mobile apps must keep working unchanged: keep the `user_subscription` row and `users.user_type` in sync after every change, and keep all existing response shapes (`models.CompleteOrderResult`).

## 3. Current state (verify each point in code before relying on it)

| Fact | Where |
| --- | --- |
| `vip_pass` passes are one-time products with `durationInDays` in the item config. Items: `vip_pass_weekly` 7, `vip_pass_monthly` 30, `vip_pass_6month` 180, `vip_pass_yearly` 365, `vip_pass_lifetime` 36500, `vip_test_pack` 1. | `items` table, `GET /v1/shop/products?category=vip_pass` |
| `OrderProcess` extends the single active `user_subscription.expired_at` for VIP-on-VIP, and suspends the other category. | `svc/shop.go` `OrderProcess` |
| `InsertOrder` is called with `start_time = end_time = now`. `InitOrder` passes `0` as the amount and `order.Price` into the `currency` argument. | `svc/shop.go` around `InitOrder` and `CompleteMoneyOrder`; `utis/db_shop.go` `InsertOrder` |
| `orders.client_order_id` is UNIQUE. The completed result JSON is stored on the order and replayed on a repeated complete. | `utis/db_shop.go`, `svc/shop.go` |
| Expiry job bug: `if user != nil { …; continue }` runs before the `user_type` reset, so existing users never get reset. It runs every 12 h. | `background/subscribtion.go` |
| Google voided-purchase handler sets `user_type = Registered` without touching the subscription or other purchases, and dereferences `order` when it is nil. | `svc/shop.go` `RealTimeDeveloperNotification` |
| Apple restore uses `user_subscription.purchase_token` (Apple original transaction ID) for idempotency. | `svc/shop.go` `RestoreOrder`, `OrderRestoreProcess` |
| No DB transactions or row locks in these flows. | — |
| The other code checks `user.UserType == int(models.UserTypeVIP)` to decide VIP. | across `svc/` |

## 4. Schema changes

**The SQL is already written, tested and applied to the local database. Do not write your own.** It is `script/nahj_modification.sql` in the marketplace repo (`D:\code\go\nahj\develop\agent_marketing\script\nahj_modification.sql`).

- It covers this task **and** task 02: the new `orders` columns (including `agent_code`), the `idx_user_vip` index, the `marketplace_outbox` table, and both backfills below.
- It is idempotent: every column, index and table is added only if missing, and the backfill skips rows it already created.
- It was run twice on MySQL 8.4 and is applied to the local `nahj` database (Docker container `mysql8-container`, `127.0.0.1:3306`, user `root`, password `root`).

Copy it into this repo as `script/migrations/20261029_marketplace.sql`, unchanged, so the repo records what was applied. If you find something in it that is wrong for this code, stop and report it instead of changing it silently.

For reference, the `orders` changes are:

```sql
ALTER TABLE orders
  ADD COLUMN source           VARCHAR(16)  NOT NULL DEFAULT 'store',  -- store | marketplace | admin | legacy
  ADD COLUMN source_ref       VARCHAR(64)  NULL,
  ADD COLUMN item_category    VARCHAR(32)  NOT NULL DEFAULT '',
  ADD COLUMN duration_days    INT          NULL,
  ADD COLUMN is_lifetime      TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN refunded_at      DATETIME(3)  NULL,
  ADD COLUMN refunded_seconds BIGINT       NULL,
  ADD KEY idx_user_vip (user_id, item_category, status, end_time);
```

The backfill (already in the script):

- For `item_category`: set it from `items.item_category` for existing orders.
- For every **active** VIP `user_subscription` row: insert a `legacy` order with `client_order_id = 'legacy-sub-{id}'`, `start_time = now`, `end_time = expired_at`, `item_category = 'vip_pass'`, `duration_days = CEIL(remaining days)`, and `is_lifetime = 1` if the plan is `vip_pass_lifetime`. This makes current VIP users' time visible to the new calculation. Skip a row if its `legacy-sub-{id}` order already exists.

**Timezone: UTC.** `utis.GetNow()` already returns `time.Now().UTC()`, and the script uses `UTC_TIMESTAMP(3)`. Confirm the DSN `loc` and `parseTime` settings keep values in UTC when read back, and state it in the plan. The internal API must return RFC 3339 timestamps with an offset.

## 5. Core service

Create `svc/vip.go` and `utis/db_vip.go`. All functions run inside one sqlx transaction.

### 5.1 `AddVipTime`

Input: `userID`, `clientOrderID`, `itemID`, `source`, `sourceRef`, `amount`, `currency`, `rejectIfLifetime bool`.

1. `SELECT id FROM users WHERE id = ? FOR UPDATE`. A missing user → error `USER_001`. An anonymous user (`user_type = 0`) → a new error key, for example `VIP_002` "guest accounts cannot receive VIP".
2. If an order with this `client_order_id` exists:
   - `COMPLETED` with the same `user_id` and `item_id` → return the stored result (idempotent replay).
   - Different user or item → conflict error (`VIP_003`). Never add time.
3. If `rejectIfLifetime` and the user is a Lifetime holder → error `VIP_001` "account already has Lifetime", and add nothing.
4. Load the item and read `durationInDays`; `is_lifetime = (itemID == vip_pass_lifetime)`. Make the Lifetime item ID a config value, not a literal scattered in code.
5. `current_end = MAX(end_time)` over the user's `COMPLETED` `vip_pass` orders with `end_time > now`. Then `start = max(now, current_end)` and `end = start + days × 24 h`.
6. Insert or complete the order row with `status = COMPLETED`, real `start_time` and `end_time`, `amount`, `currency`, `source`, `source_ref`, `item_category = 'vip_pass'`, `duration_days`, `is_lifetime`, and the result JSON.
7. `SyncVipCache(tx, userID)` (§5.4).
8. Commit, then fire side effects outside the transaction: the existing VIP tracking goroutine, and FCM.

### 5.2 `RefundVipTime`

Input: `clientOrderID`, `reason`.

1. Lock the user row (look up the order first to get the `user_id`, then lock in a consistent order: user, then order).
2. Order missing → not found. Already `REFUNDED` → return the stored result (idempotent).
3. `unused = max(0, end_time − max(start_time, now))`. Set `status = REFUNDED`, `refunded_at = now`, `refunded_seconds = unused`, `end_time = end_time − unused`.
4. If `unused > 0`: shift every `COMPLETED` `vip_pass` order of the user with `start_time >= original end_time` earlier by `unused` (both `start_time` and `end_time`).
5. `SyncVipCache`, then commit.

### 5.3 `GetVipProjection`

Returns `{userId, active, expiresAt, lifetime, projectionVersion, evaluatedAt}`, where `expiresAt = MAX(end_time)` of `COMPLETED` `vip_pass` orders with `end_time > now`, and `lifetime` follows rule 6. `projectionVersion` can be a hash or the max order `id` plus updated time; it only needs to change whenever the result changes.

### 5.4 `SyncVipCache`

Inside the same transaction, make the compatibility copy match the projection:

- Active VIP: exactly one `user_subscription` row with `status = active`, `plan_category = 'vip_pass'`, `expired_at = expiresAt`, `plan_id` = the item of the order that ends last. Update the existing active VIP row instead of inserting duplicates. Set `users.user_type = VIP (3)`.
- No active VIP: no active VIP `user_subscription` row (move it to history the way the expiry job does). Set `user_type = Registered (1)`, but only if it was VIP (3) or AdsRemove (2). Never change Anonymous (0).

## 6. Refactor the existing flows to use the service

- **`OrderProcess`, `vip_pass` branch** (store complete): call `AddVipTime` with `source = 'store'` and the existing `client_order_id`. Keep the returned `CompleteOrderResult` shape identical (Expiry, VIPExpiry, …).
- **`OrderRestoreProcess`** (Apple restore): keep the idempotency on Apple's original transaction ID. A restore must never add a second period for the same purchase.
- **Google voided purchase (`RealTimeDeveloperNotification`)**: for a `vip_pass` order call `RefundVipTime` for that order only, instead of resetting `user_type`. Fix the nil-order dereference.
- **Apple refund notifications**, if handled anywhere: same treatment.
- **Expiry job (`background/subscribtion.go`)**: fix the `user != nil` bug. For each expired row, call `SyncVipCache` in a transaction, which downgrades `user_type` only if no other VIP order is still active. Keep history moves.
- **No-Ads branch:** do not extend it. Make sure the refactor does not break it for any existing rows.

## 7. Internal endpoints for the marketplace

### 7.1 Routing and authentication

- Route group `/internal/v1`, registered in `contr/contMgr.go`, in a new file `contr/internal.go`. Not shown in the public swagger, or tagged `internal`.
- Authentication: a Keycloak **client-credentials** token from the marketplace's service client. Verify it with the existing `VerifyToken`, then require `azp` (or `client_id`) to equal the config value `marketplace.clientId`. Add the `marketplace` section to `models.Config` and to the example configs, without secrets. Reject user tokens. Write this as a small reusable Gin middleware.

### 7.2 Endpoints

| Method and path | Body or result |
| --- | --- |
| `GET /internal/v1/accounts/{userId}` | `{userId, exists, isGuest, displayName, emailMasked}`. Read the email from Keycloak (`utis.Kcs`) if available, masked as `a***@domain`. |
| `POST /internal/v1/vip/grants` | `{clientOrderId, userId, itemId, source: "marketplace" or "admin", sourceRef, amount, currency, rejectIfLifetime}` → `{clientOrderId, status, startTime, endTime, projection}`. Calls `AddVipTime`. |
| `POST /internal/v1/vip/grants/{clientOrderId}/refund` | `{reason}` → `{clientOrderId, status, refundedSeconds, projection}`. Calls `RefundVipTime`. |
| `GET /internal/v1/vip/{userId}` | Projection (§5.3). |
| `GET /internal/v1/vip/{userId}/orders` | The user's VIP orders, newest first: `clientOrderId`, `source`, `itemId`, `startTime`, `endTime`, `isLifetime`, `status`, `refundedAt`. |
| `POST /internal/v1/notifications` | `{userId, type: "vip_changed", title, body}` → sends an FCM push through the existing `FcmClt` using the user's FCM token. This is a refresh hint only; it never grants anything. Best effort: report `sent` or `no_token`. |

Errors use the existing JSON error format with stable codes. The marketplace retries on network errors and expects idempotent replays:
- the same `clientOrderId` with the same body returns the same result;
- the same `clientOrderId` with a different body returns 409.

The marketplace uses `clientOrderId = "mk-unit-{unitId}"`.

## 8. Out of scope for this task

- Account deletion callback to the marketplace, and find-account-by-email. These come later.
- Any change to the mobile apps.
- Any change to store product configuration. Note it, but do not fix it: inconsistent Apple product IDs between `appleProductID` and `metadata.appleProductId` for Lifetime, Monthly and Yearly; passes typed `non-consumable`; `vip_test_pack` sellable.

## 9. How to work

1. **Plan first.** Read the code listed in §3 and confirm or correct each fact. Then write the plan:
   - files to add and change;
   - the timezone convention;
   - the transaction and lock order;
   - the backfill steps;
   - risks for existing store flows;
   - a test approach.
   Wait for the user's approval.
2. Work on a branch from `develop`, for example `feature/vip-orders`, in small commits. Do not push to `main` or `develop` without the user's say-so.
3. **Tests.** The repo has no working DB test harness (see `CLAUDE.md`). Add a minimal integration test setup that initializes `utis.Gdb` against the local MySQL (`root:root@tcp(127.0.0.1:3306)/`, read from an env var such as `NAHJ_TEST_MYSQL_DSN`, skip the tests when it is unset). Each test creates its own throwaway schema, loads `script/db.sql` plus the migration into it, and drops it afterwards; never run tests against the `nahj` database itself. Cover at least these scenarios:
   - Stacking: Monthly Jan 1 and Monthly Jan 10 → ends Mar 2.
   - Refund while running: refund the first on Jan 15 → it ends Jan 15, and the second runs Jan 15 → Feb 14.
   - Late refund of an ended order → 0 removed; newer orders unchanged.
   - Refund of a queued (not started) order → all its time removed; later orders shift by its full duration.
   - Idempotent grant replay; conflicting replay → 409.
   - Two concurrent grants for one user → no overlap; the periods are back to back.
   - `rejectIfLifetime` with an active Lifetime order → refused, nothing written.
   - `SyncVipCache` → one active row with the right expiry; `user_type` downgrade only when nothing is active; Anonymous unchanged.
   - Store complete through the refactored `OrderProcess` returns the same response shape as before.
   Use a controllable clock (wrap `utis.GetNow` behind a function variable that tests can override) so these dates can be tested.
4. Run `go build`, `go vet ./svc ./utis` (compare against the known pre-existing warnings) and the tests. Regenerate swagger if you change public handler annotations.
5. Finish with a short report:
   - what changed;
   - how to run the migration and the backfill;
   - new config keys;
   - new i18n keys;
   - anything you found that contradicts this brief.
