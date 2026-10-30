# Task for nahj_backend: marketplace VIP grants, store VIP periods, and store refunds

> Paste this whole file as the first message of a new Claude Code session opened in `D:\code\go\nahj\develop\nahj_backend`.
> Before writing any code, produce an implementation plan and wait for approval (see section 10).

## 0. The most important rule: this service is in production

`nahj_backend` serves the live Android and iOS apps. **Add new code beside the existing flows. Change as few existing lines as possible.**

- Do **not** rewrite, restructure or "clean up" `OrderProcess`, `OrderRestoreProcess`, `RestoreOrder`, `InitOrder`, `CompleteMoneyOrder`, `RealTimeDeveloperNotification`, `background/subscribtion.go`, `utis.GetNow` or any other existing function, except for the exact edits listed in section 6.
- Do not fix other bugs you find. List them in the report instead (section 10). Some known ones are in section 3.2.
- Every edit to an existing file must be small and easy to review on its own.
- The current mobile apps must keep working unchanged, and all existing response shapes stay identical.

## 1. Context

A new project, the **Nahj Seller Marketplace** (repo `agent_marketing`), lets approved sellers sell prepaid VIP passes on the web, either as direct activation on the buyer's account or as activation codes. It is a separate Go service with its own MySQL schema (`nahj_market`). It never reads or writes the `nahj` schema. It changes VIP access **only** through new internal endpoints in this repo.

This task adds:

1. **Internal endpoints** so the marketplace can grant and refund VIP time.
2. **The VIP period on store VIP orders**, so one purchase can be refunded without touching the others.
3. **Store refunds that remove only the unused time:** a new Apple refund notification endpoint, and the same logic for Google voided purchases.

Read this repo's `CLAUDE.md` first and follow its conventions: layering `contr/` → `svc/` → `utis/`, i18n error keys in all three locales, logging prefixes, swag annotations.

Reference design (in the marketplace repo; ask the user if you need it): `docs/03-database-design.md` §2.

## 2. Confirmed business rules (do not change them)

1. **Source of truth stays as it is:** `user_subscription.expired_at` (one active row per user) and `users.user_type`. Nothing else decides VIP access.
2. **Duration.** An item grants `durationInDays × 24 hours`. Monthly = 30 days, never a calendar month.
3. **Stacking.** New time starts at the end of the user's current VIP time, or now if they have none. Example: Monthly bought Jan 1 and another Monthly Jan 10 → VIP until Mar 2.
4. **Codes.** Time is added only when a code is redeemed. The marketplace calls the grant endpoint at that moment.
5. **Refund or chargeback** removes only the order's **unused** time: `unused = max(0, end_time − max(start_time, now))`, subtracted from `expired_at`. Every order of that user with a recorded period that starts at or after the refunded order's original end moves earlier by `unused`. An order that has already ended removes nothing.
6. **Lifetime** is the existing item `vip_pass_lifetime` (36,500 days). A user is a **Lifetime holder** while the active VIP row has more than `marketplace.lifetimeThresholdYears` (default 50) years left. A Lifetime holder must not get more VIP added through the marketplace when the request sets `rejectIfLifetime`.
7. **No-Ads is discontinued.** Do not add No-Ads logic. Existing No-Ads code stays as it is.
8. **No offline grace period** is added.

## 3. Current state (verified 2026-10-30; confirm each point before relying on it)

### 3.1 Facts this task builds on

| Fact | Where |
| --- | --- |
| VIP passes are one-time items with `durationInDays` in `item.Config`: weekly 7, monthly 30, 6month 180, yearly 365, lifetime 36500, test pack 1. | `items` table |
| `OrderProcess`, `vip_pass` branch: with an active VIP row it extends `expired_at` by the duration; with an active No-Ads row it suspends it and inserts a VIP row; otherwise it inserts a VIP row. Then it sets `user_type = 3` and starts `UpdateUserVIPTracking`. `result.VIPExpiry` is the new expiry. | `svc/shop.go` ~1861 |
| `GetActiveUserSubscriptionByUserID` returns the row with `status = 1 AND expired_at > now`. | `utis/db_subscribtion.go` |
| `CompleteMoneyOrder` (the app's complete call) verifies with Google (`res.OrderID` is the `GPA.…` order id) or Apple (`verifyRes.TransactionID`, `OriginalTransactionID`), calls `OrderProcess`, then saves the result with `UpdateOrderResultAndStatusByID`. A repeated call returns the stored result. | `svc/shop.go` ~1260 |
| Google `OneTimeProductNotification` is a **second completion path**: it can complete the same order through `OrderProcess`, then `UpdateOrderResultByID`. | `svc/shop.go` `RealTimeDeveloperNotification` |
| Google `VoidedPurchaseNotification` has `PurchaseToken` and `OrderID`. The handler looks the order up by purchase token, sets `REFUNDED`, sends an FCM push, and for `vip_pass` sets `user_type = Registered` (which removes all VIP, not only this purchase). The app's complete call never stores the purchase token, so the lookup usually finds nothing, and the code then dereferences a nil `order`. | same function |
| **Apple refund notifications are not handled anywhere.** There is no App Store Server Notifications endpoint. | — |
| Orders are inserted with `start_time = end_time = now`. These columns are not read anywhere for money orders. `UpdateOrderTime` exists. | `utis/db_shop.go` |
| No existing query uses `SELECT *` on `orders`, so new columns do not affect existing reads. | `utis/db_shop.go` |
| `VerifyToken` checks only the RS256 signature and `exp`; `getTokenClaims` reads claims without verification. | `contr/uti.go` |
| `script/db.sql` is partial and outdated (no `orders`, `items`, `user_subscription`, `users_attributes`). | `CLAUDE.md` |
| The production container has no `TZ`, so `loc=Local` in the DSN means UTC there. A developer PC may not be UTC. | `Dockerfile`, `config/conf.yml` |

### 3.2 Known bugs that this task must NOT fix (list them in the report)

- The expiry job never resets `user_type` for existing users (`if user != nil { …; continue }` in `background/subscribtion.go`).
- Store receipts are not checked for reuse across orders (Google: `ObfuscatedExternalAccountId` is not compared with the order; Apple: product and transaction reuse are not checked).
- `CompleteMoneyOrder` without a prior init inserts a `COMPLETED` row and then dereferences a nil `order`.
- On Android, the order is set to `COMPLETED` before `OrderProcess` runs.

## 4. Schema

**The SQL is already written, tested and applied to the local database. Do not write your own.** It is `script/nahj_modification.sql` in the marketplace repo (`D:\code\go\nahj\develop\agent_marketing\script\nahj_modification.sql`).

- It covers this task **and** task 02. It only adds things:
  - six columns on `orders` (`source`, `source_ref`, `duration_days`, `refunded_at`, `refunded_seconds`, `agent_code`), with `ALGORITHM=INSTANT`;
  - one index `idx_user_start (user_id, start_time)`, online;
  - the `marketplace_outbox` table.
- There is no backfill. It is idempotent.
- It is applied to the local `nahj` database (Docker container `mysql8-container`, `127.0.0.1:3306`, user `root`, password `root`).
- The current production code keeps working with these columns present, so the script can run before the deploy.

Copy it into this repo as `script/migrations/20261030_marketplace.sql`, unchanged. If you find something wrong in it, stop and report it instead of changing it.

**Timezone: UTC.** Write times with `utis.GetNow()`. The internal API returns RFC 3339 timestamps with an offset. Use `loc=UTC` in the test DSN. Do not change the production DSN; just state the assumption that production runs in UTC.

## 5. New code (new files only)

Put the logic in `svc/vip.go` and the SQL in `utis/db_vip.go`. Each function below runs in **one** sqlx transaction, and locks in this order: the `users` row first, then the order. Use a package variable `var vipNow = utis.GetNow` so tests can control the clock; do not change `utis.GetNow`.

### 5.1 `GrantVipTime` (marketplace and admin)

Input: `userID`, `clientOrderID`, `itemID`, `source` (`marketplace` or `admin`), `sourceRef`, `amount`, `currency`, `rejectIfLifetime`.

1. `SELECT … FROM users WHERE id = ? FOR UPDATE`. Missing → `USER_001`. Guest (`user_type = 0`) → new key `VIP_002` "guest accounts cannot receive VIP".
2. If an order with this `client_order_id` exists:
   - same user and item → return its stored result (idempotent replay);
   - otherwise → `VIP_003`, HTTP 409. Never add time.
3. Read the active subscription row. If `rejectIfLifetime` and the user is a Lifetime holder (rule 6) → `VIP_001` "account already has Lifetime", and write nothing.
4. Load the item; it must be `vip_pass`. Read `durationInDays`.
5. Mirror the `vip_pass` branch of `OrderProcess`, but with transaction-aware SQL:
   - active VIP row: `start = max(now, expired_at)`, `end = start + days × 24 h`, and set `expired_at = end`;
   - active No-Ads row: suspend it as `OrderProcess` does, and insert a VIP row with `start = now`;
   - no row: insert a VIP row.

   Then set `user_type = 3`.
6. Insert the order:
   - `status = COMPLETED`, `source`, `source_ref`;
   - real `start_time`, `end_time` and `duration_days`;
   - `amount` and `currency` in their correct columns;
   - `result` = the JSON of the response.
7. Commit. Then start `UpdateUserVIPTracking(user, true)` outside the transaction.

### 5.2 `RecordStoreVipPeriod` (called after a store completion)

Input: the order, the item, the `CompleteOrderResult`, and a `StorePurchase` struct (define it in `models/`):

| Field | Google | Apple |
| --- | --- | --- |
| `Store` | `google` | `apple` |
| `TransactionID` | the order id (`GPA.…`) | the transaction id |
| `OriginalTransactionID` | — | the original transaction id |
| `Country` | `regionCode` | `storefront` |
| `PriceMilli`, `Currency` | — | from the signed transaction |
| `PurchasedAt` | from the store | from the store |

Task 02 also uses this struct.

- Only for `vip_pass` items, and only when `result.VIPExpiry` is set: `end = *result.VIPExpiry`, `start = end − days × 24 h`.
- `UPDATE orders SET start_time, end_time, duration_days, source = 'store', source_ref = TransactionID`.
- If it fails: log it and return. **It must never change the response or fail the purchase.**

### 5.3 `RefundVipTime`

Input: an order ID and a reason (`marketplace`, `google_voided`, `apple_refund`).

1. Lock the `users` row, then the order.
2. If `refunded_at` is already set, return the stored result (idempotent). Do not use `status` for this: the Google handler already sets `REFUNDED` before calling you.
3. Work out the unused time:
   - **with a recorded period** (`duration_days` not null): `unused = max(0, end_time − max(start_time, now))`. Then set `end_time −= unused`, and shift later recorded orders (`duration_days IS NOT NULL AND status = 'COMPLETED' AND start_time >= original end`) earlier by `unused`;
   - **older store order without a period:** `unused = min(item duration, time left on the active VIP row)`. No shift.
4. Set `status = REFUNDED`, `refunded_at = now`, `refunded_seconds = unused`.
5. If `unused > 0`, subtract it from the active VIP row's `expired_at`.
6. If that leaves no VIP time:
   - move the row to history and delete it, as the expiry job does;
   - set `user_type = 1`, but only if it is 3; never change 0;
   - after commit, start `UpdateUserVIPTracking(user, false)`.

### 5.4 `GetVipStatus`

From the active VIP row: `{userId, active, expiresAt, lifetime, version, evaluatedAt}`. `version` is any value that changes when `expired_at` or the row changes, for example a hash of the row ID and `expired_at`.

### 5.5 Apple refund notifications (new endpoint)

- `POST /v1/shop/apple/notifications`, in a new file `contr/apple_notifications.go`, with the logic in svc.
- Verify the signed payload with the `go-iap` library already in `vendor/`, including the certificate chain. Check the bundle ID against `apple.bundleId` config. Reject unverified payloads with 400.
- `notificationType = REFUND`: decode the signed transaction. Find the order by `source_ref = transactionId` and call `RefundVipTime(order, "apple_refund")`.
  - **No matching order** (a purchase from before this release): find the user through `user_subscription.purchase_token = originalTransactionId` and the item through its Apple product ID.
  - Insert an order row `client_order_id = "apple-refund-{transactionId}"` (`source = store`, `REFUNDED`) as the idempotency key, and remove `min(duration, time left)`.
  - If neither the order nor the user can be found, log it and return 200.
- **Other types** (including `REFUND_REVERSED`, `CONSUMPTION_REQUEST`, `TEST`): log them and return 200. Do not grant anything back.
- Always return 200 after a verified payload is handled or ignored, so Apple does not retry forever.
- In the report, say what the user must set in App Store Connect (production and sandbox server notification URLs, version 2).

## 6. Edits to existing files (complete list; nothing else)

| File | Edit |
| --- | --- |
| `svc/shop.go` `CompleteMoneyOrder` | Declare one `storePurchase` variable next to `appTxId`, and fill it inside the existing Android and iOS cases. After the final `UpdateOrderResultAndStatusByID` succeeds, add `if item.ItemCategory == models.ItemCategoryVipPass { RecordStoreVipPeriod(…) }`. |
| `svc/shop.go` `RealTimeDeveloperNotification`, one-time product branch | After `UpdateOrderResultByID` succeeds, the same `RecordStoreVipPeriod` call (Google). |
| `svc/shop.go` `RealTimeDeveloperNotification`, voided branch | 1. If the purchase-token lookup returns nil, look up by `source_ref = notification.OrderID`. 2. If still nil, log it and `return nil` (this also removes the nil dereference). 3. In the `vip_pass` case, replace `UpdateUserStatus(…, Registered)` with `RefundVipTime(order, "google_voided")`. Leave everything else in the branch as it is. |
| `utis/googleplay.go` | Add `RegionCode` to `PurchaseVerificationResult` and fill it. Additive only. |
| `utis/iap.go` | Add `Price`, `Currency` and `Storefront` to `VerifiedTransaction` and fill them from the parsed transaction. Additive only. |
| `contr/contMgr.go` | One line to register the internal route group, and one for the Apple notification route (or put that in `ShopApis`). |
| `models/conf.go` + example configs | New `marketplace` section: `clientId`, `issuer`, `lifetimeThresholdYears`. No secrets. |
| `locales/errors/{en,ar,id}.json` | New keys `VIP_001` to `VIP_003`, plus any internal-API keys. |

The Google voided change is the only behaviour change for existing users: a refunded VIP purchase now removes only its unused time instead of all VIP. It was confirmed by the product owner on 2026-10-30. Keep it in its own commit so it can be dropped if review rejects it.

## 7. Internal endpoints for the marketplace

### 7.1 Routing and authentication

- Route group `/internal/v1`, in a new file `contr/internal.go`. Tag it `internal`, or leave it out of the public swagger.
- Authentication: a Keycloak **client-credentials** token from the marketplace's service client. Write a small Gin middleware, used only by this group:
  - verify the token as `VerifyToken` does;
  - then read the claims **from the verified token**: `iss` must equal `marketplace.issuer`, and `azp` must equal `marketplace.clientId`;
  - reject user tokens;
  - if `marketplace.clientId` is empty, reject every request (fail closed).

### 7.2 Endpoints

| Method and path | Body or result |
| --- | --- |
| `GET /internal/v1/accounts/{userId}` | `{userId, exists, isGuest, displayName, emailMasked}`. Read the email from Keycloak (`utis.Kcs`) if available, masked as `a***@domain`. |
| `POST /internal/v1/vip/grants` | `{clientOrderId, userId, itemId, source: "marketplace" or "admin", sourceRef, amount, currency, rejectIfLifetime}` → `{clientOrderId, status, startTime, endTime, vip}`. Calls `GrantVipTime`. |
| `POST /internal/v1/vip/grants/{clientOrderId}/refund` | `{reason}` → `{clientOrderId, status, refundedSeconds, vip}`. Calls `RefundVipTime`; only for orders with `source` `marketplace` or `admin`. |
| `GET /internal/v1/vip/{userId}` | `GetVipStatus`. |
| `GET /internal/v1/vip/{userId}/orders` | The user's orders with a recorded period (`duration_days` not null), newest first: `clientOrderId`, `source`, `itemId`, `startTime`, `endTime`, `status`, `refundedAt`. |
| `POST /internal/v1/notifications` | `{userId, type: "vip_changed", title, body}` → an FCM push through `FcmClt` using the user's FCM token. A refresh hint only; it never grants anything. Best effort: report `sent` or `no_token`. |

Errors use the existing JSON error format with stable codes. The marketplace retries on network errors and expects idempotent replays:
- the same `clientOrderId` with the same body returns the same result;
- the same `clientOrderId` with a different body returns 409.

The marketplace uses `clientOrderId = "mk-unit-{unitId}"`.

## 8. Accepted limitation

The existing store flow does not take the user row lock. A store purchase and a marketplace grant for the same user in the same instant could race on `expired_at`. This is accepted so the store flow stays unchanged. Mention it in the report.

## 9. Out of scope

- Everything in section 3.2.
- The account deletion callback to the marketplace, and find-account-by-email.
- Any change to the mobile apps or to store product configuration. Notes for the report: Apple product IDs differ between `appleProductID` and `metadata.appleProductId` for Lifetime, Monthly and Yearly; passes are typed `non-consumable`; `vip_test_pack` is sellable.

## 10. How to work

1. **Plan first.** Read the code in section 3 and confirm or correct each fact. Then write the plan:
   - new files;
   - the exact edits from section 6, with the lines they touch;
   - the transaction and lock order;
   - how the Apple payload is verified;
   - risks to existing flows;
   - the test approach.

   Wait for the user's approval.
2. **Branch.** Work on a branch from `develop`, for example `feature/marketplace-vip`, in small commits: migration copy, new service, store hooks, Google voided change (its own commit), Apple endpoint, internal API. Do not push to `main` or `develop` without the user's say-so.
3. **Tests**, in a new test file that skips when `NAHJ_TEST_MYSQL_DSN` is unset (for example `root:root@tcp(127.0.0.1:3306)/?parseTime=true&loc=UTC`), so a plain `go test` behaves as before.
   - Each test creates a throwaway schema, loads the schema, initializes `utis.Gdb` against it, and drops the schema afterwards. Never use the `nahj` database itself.
   - For the schema, dump the local `nahj` table definitions without data (`mysqldump --no-data`) into `svc/testdata/schema.sql`, then run the migration on top (it must be a no-op). Ask the user to confirm the local schema matches production.
   - Cover at least:
     - stacking: Monthly Jan 1 and Monthly Jan 10 → `expired_at` Mar 2;
     - refund while running on Jan 15 → the first ends Jan 15, the second runs Jan 15 → Feb 14, `expired_at` Feb 14;
     - late refund of an ended order → 0 removed;
     - refund of a queued order → all its time removed, later orders shift;
     - refund of an older store order without a period → `min(duration, time left)`;
     - refund that leaves no VIP → row moved to history, `user_type` 3 → 1, guest (0) unchanged;
     - idempotent grant replay; conflicting replay → 409; repeated refund → nothing more removed;
     - two concurrent grants for one user → back-to-back periods;
     - `rejectIfLifetime` with more than 50 years left → refused, nothing written;
     - grant when the user has an active No-Ads row → No-Ads suspended, VIP row inserted, as `OrderProcess` does;
     - `RecordStoreVipPeriod` sets the period from `VIPExpiry`, and a failure does not change the result;
     - Apple notification: a refund for a known order, an unknown older purchase, a repeated notification, an unverified payload → 400;
     - middleware: a user token, a wrong `azp`, and an empty config are all rejected.
4. **Checks.** Run `go build`, `go vet ./svc ./utis` (compare against the known pre-existing warnings) and the tests. Regenerate swagger for the new public Apple endpoint.
5. **Report.** Finish with a short report:
   - what changed: new files, plus a list of every edited existing line;
   - how to run the migration;
   - new config keys;
   - new i18n keys;
   - the App Store Connect setup;
   - the bugs from section 3.2 and any others you found (not fixed);
   - anything that contradicts this brief.
