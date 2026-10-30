# Task for nahj_backend: agent codes on in-app store purchases (flow B)

> Paste this whole file as the first message of a new Claude Code session opened in `D:\code\go\nahj\develop\nahj_backend`.
> **Prerequisite:** task 01 (`01-nahj-backend-vip-orders.md`) is merged, or this branch starts from its branch. Task 01 provides `RecordStoreVipPeriod`, the `StorePurchase` struct, `RefundVipTime`, the Apple refund endpoint and the test harness.
> Before writing any code, produce an implementation plan and wait for approval (see section 9).

## 0. The most important rule: this service is in production

**Add new code. Change as few existing lines as possible.** This task hooks into the functions task 01 created; it does not edit the store purchase, restore or refund flows again. The only edits to existing files are the ones listed in section 7. Do not fix other bugs you find; list them in the report.

## 1. Context

The Nahj Seller Marketplace (repo `agent_marketing`) pays agents commission. Buyers and agents can be in **many countries**, and in-app purchases through Google Play and the App Store with an agent referral are a main channel:

1. An agent gives a user an **agent code**, for example `AGT-7K2M3P`.
2. The user enters it in the Nahj app.
3. The user then buys VIP through Google Play or the App Store, exactly as today.
4. The purchase is credited to the agent.

The marketplace owns agents, codes and commission. This repo:
- validates and stores the code on the user's account;
- copies it onto each VIP store order at completion;
- reports store sales and store refunds to the marketplace reliably.

Read this repo's `CLAUDE.md` first and follow its conventions.

## 2. Confirmed rules (do not change them)

1. **Code format:** `AGT-` + 6 characters, or an approved alias such as `TOKOILMU`. Validation belongs to the marketplace; this repo only normalizes the input (uppercase, trim, accept a missing `AGT-` hyphen) and asks.
2. **Linking:** the user enters the code once. It is saved on the account (`users_attributes`), and the app pre-fills it for later purchases. The user can change or remove it.
3. **Attribution:** at order completion, the code currently saved on the account is copied onto that `orders` row. A later change never alters past orders.
4. **No discount:** the user pays the normal store price. Nothing about pricing or the purchase flow changes.
5. **Every completed VIP store purchase with a code** is reported to the marketplace. Purchases without a code are not reported.
6. **Every store refund of a reported purchase** is reported: Google voided purchases and Apple refund notifications.
7. **Reliability:** an event is written to a local outbox and sent with retries. It is never sent for a purchase that did not complete.
8. **Apple restore** never creates a sale.
9. **Commission does not depend on anything this repo sends about price.** The marketplace calculates it from its own catalog. This repo reports the store's country and, where the store gives them, price and currency, for the marketplace's rules and reports.

## 3. Schema

**Nothing to add.** `script/migrations/20261030_marketplace.sql` (copied in task 01) already has `orders.agent_code` and the `marketplace_outbox` table:

```sql
-- reference only; already applied, do not run again
ALTER TABLE orders ADD COLUMN agent_code VARCHAR(16) NULL;

CREATE TABLE marketplace_outbox (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_type    VARCHAR(24)  NOT NULL,         -- store_sale | store_refund
  event_key     VARCHAR(160) NOT NULL UNIQUE,  -- store_sale:google:GPA.1234 / store_refund:apple:2000000123
  payload       JSON         NOT NULL,
  attempts      INT          NOT NULL DEFAULT 0,
  next_try_at   DATETIME(3)  NOT NULL,
  sent_at       DATETIME(3)  NULL,
  last_error    VARCHAR(255) NULL,
  created_at    DATETIME(3)  NOT NULL,
  KEY idx_pending (sent_at, next_try_at)
);
```

The code is stored in `users_attributes` under the keys `agent_code` and `agent_code_set_at`. The helpers `GetUserAttribute` and `SetUserAttribute` exist in `utis/users_attributes.go`. There is no delete helper, so add one; it is a new function.

## 4. Public endpoints for the app (new files)

Add these in a new `contr/agent_code.go`, with the usual Bearer token handling, and the logic in new svc and utis files.

| Method and path | Behaviour |
| --- | --- |
| `GET /v1/agent-code` | Returns the saved code and the agent's display name, or empty. |
| `PUT /v1/agent-code` `{code}` | Normalizes the code and calls the marketplace validate endpoint (section 6). Valid → save `agent_code` and `agent_code_set_at` and return `{code, agentName}`. Invalid → `AGENT_001` "This agent code is not valid". Marketplace unreachable → `AGENT_002` "Could not check the code, try again". Never save an unchecked code. |
| `DELETE /v1/agent-code` | Removes the saved code. |

- Guests (`user_type = 0`) may save a code. `InitOrder` already stops guests from buying (outside test mode), so the code applies after they register. Check that registering keeps the same user ID; if it doesn't, say so in the plan.
- Rate-limit `PUT` per user, for example 10 per hour. An in-memory limiter per instance is enough. The codes are not secret; this only prevents abuse.
- Add the i18n keys to all three locale files (`en`, `ar`, `id`).

## 5. Hooks in task 01's functions (new code only)

- **`RecordStoreVipPeriod`** (called after a VIP store purchase completes). In one small transaction, together with the period update:
  1. read the user's saved `agent_code`;
  2. if present, set `orders.agent_code`;
  3. insert a `store_sale` outbox row with `event_key = store_sale:{store}:{TransactionID}`. The key is unique, so a second completion path (the app's complete call and the Google notification) or a retry cannot duplicate it: use `INSERT IGNORE`, or handle the duplicate error.

  Payload, built from the `StorePurchase` struct:

  ```json
  {"store":"google|apple","storeTransactionId":"GPA.1234-5678-9012-34567","originalTransactionId":"…",
   "userId":"…","itemId":"vip_pass_monthly","purchasedAt":"2026-10-25T08:00:00Z",
   "agentCode":"AGT-7K2M3P","nahjOrderId":"…",
   "country":"ID","reportedPriceMilli":4990,"reportedCurrency":"USD"}
  ```

  - `country`: Google `regionCode` (ISO 3166 alpha-2), or Apple `storefront` (ISO 3166 alpha-3), sent exactly as the store gives it. The marketplace normalizes it.
  - `reportedPriceMilli` and `reportedCurrency`: **Apple only**, from the signed transaction (price in thousandths of the currency unit). Google's purchase data has no price, so omit both. Never take any of these from the client request.

  As in task 01, a failure here is logged and never changes the purchase response. If the process dies after the purchase completes and before this transaction commits, that one sale is not reported. This is accepted, because the store flows have no transactions and stay that way; log it clearly.
- **`RefundVipTime`**, when the reason is `google_voided` or `apple_refund`: if the order has an `agent_code`, insert a `store_refund` outbox row **in the same transaction**, with `event_key = store_refund:{store}:{TransactionID}` and payload `{store, storeTransactionId, refundedAt, reason}`.
- **Restore** has no hook, so it never reports a sale.
- **Marketplace and admin grants** (`GrantVipTime`) never create outbox rows.

## 6. Calls to the marketplace (new files)

**These marketplace endpoints are not built yet.** The marketplace builds them in its own step. Implement the client against the contract below and test it with an `httptest` server that plays the marketplace. In real use, until the endpoints exist, code validation returns `AGENT_002` and outbox events wait and retry, so nothing is lost.

- **Configuration:** add to the `marketplace` section:
  - `baseUrl`;
  - the Keycloak client-credentials settings for this repo's service client `nahj-backend-service` (the secret only from the secret store or an env variable, never committed);
  - timeouts;
  - `outboxEnabled` (default false, so the sender stays off until the marketplace is ready).
- **Client** in `utis/marketplace.go`. It fetches and caches a client-credentials token from Keycloak (check whether `utis.Kcs` can do this) and refreshes it before expiry.
- **Endpoints** (provided by the marketplace):
  - `GET  {baseUrl}/internal/v1/agent-codes/{code}` → `{valid, agentId, displayName, agentType}`
  - `POST {baseUrl}/internal/v1/store-sales` with the store_sale payload. 200 or 409-duplicate both count as delivered.
  - `POST {baseUrl}/internal/v1/store-sales/{store}/{storeTransactionId}/refund`. 200 or 404-not-recorded both count as delivered; log the 404.
- **Outbox sender:** a new goroutine in a new file in `background/`. Every few seconds it:
  - claims due rows with `SELECT … FOR UPDATE SKIP LOCKED`;
  - sends them;
  - marks them sent, or sets `attempts`, `last_error` and an exponential `next_try_at` (capped at 1 hour);
  - logs an error after 20 attempts but keeps retrying.

  It is safe to run in several instances, and it does nothing when `outboxEnabled` is false (rows still accumulate).

## 7. Edits to existing files (complete list; nothing else)

| File | Edit |
| --- | --- |
| `contr/contMgr.go` | One line to register the agent-code routes. |
| `background/bgMgr.go` (or wherever `StartBgs` starts the existing job) | One line to start the outbox sender. |
| `models/conf.go` + example configs | New keys in the `marketplace` section (no secrets). |
| `locales/errors/{en,ar,id}.json` | `AGENT_001`, `AGENT_002`, plus a rate-limit key if needed. |
| `models/users_attributes.go` | Constants for the two new keys. |

## 8. Mobile app contract (for the mobile team; no app code in this repo)

| Item | Contract |
| --- | --- |
| Where | VIP purchase screen: an optional "Agent code" field, collapsed under "Have an agent code?" |
| Check | On submit, call `PUT /v1/agent-code`. On success show "Agent: {agentName} ✓". On `AGENT_001` show the error and keep the purchase available without a code. |
| Pre-fill | On opening the VIP screen, call `GET /v1/agent-code` and show the saved agent with "Change" and "Remove" options. |
| Link | `https://nahj.ryam.app/a/{code}` opens the app (Android App Links / iOS Universal Links) and pre-fills the code. If the app is not installed it opens the store page. The marketplace serves the web page for that path. |
| Purchase | No change to the store purchase and complete calls. The backend attaches the code itself. |
| iOS | Allowed: the code only attributes the sale and unlocks nothing. Get store-policy confirmation before release. |

## 9. How to work

1. **Plan first.** Confirm in code:
   - the `users_attributes` structure and helpers;
   - that `StorePurchase` from task 01 carries the store transaction ID, the country, and Apple's price and currency;
   - how `RecordStoreVipPeriod` and `RefundVipTime` run their transactions;
   - whether registering keeps the guest's user ID.

   Then write the plan and wait for approval.
2. **Branch.** Branch from the task 01 branch, for example `feature/agent-codes`, in small commits. Do not push to `main` or `develop` without the user's say-so.
3. **Tests**, with the harness from task 01:
   - Save a valid code; reject an invalid one; marketplace down → nothing saved; rate limit applies.
   - A purchase with a saved code: the order has `agent_code`, and one outbox row exists with the right country (and price for Apple).
   - Both Google completion paths, or a repeated call, create only one outbox row.
   - Changing the code after a purchase leaves the old order unchanged.
   - A purchase without a code: no outbox row.
   - Refund of an attributed order (Google voided, Apple refund): one `store_refund` row, in the same transaction as the refund.
   - Outbox sender: success marks sent; failure backs off; 409 or 404 count as delivered; two senders never send the same row twice; `outboxEnabled = false` sends nothing.
4. **Checks.** Run `go build`, `go vet ./svc ./utis`, the tests, and swagger for the new public endpoints.
5. **Report.** Finish with a short report:
   - what changed: new files, plus a list of every edited existing line;
   - config keys;
   - i18n keys;
   - open points.
