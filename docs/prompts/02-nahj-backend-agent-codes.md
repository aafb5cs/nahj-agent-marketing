# Task for nahj_backend: agent codes on in-app store purchases (flow B)

> Paste this whole file as the first message of a new Claude Code session opened in `D:\code\go\nahj\develop\nahj_backend`.
> **Prerequisite:** the task in `01-nahj-backend-vip-orders.md` (one VIP order per purchase, `AddVipTime` and `RefundVipTime`, internal endpoints) is merged or on the same branch.
> Before writing any code, produce an implementation plan and wait for approval (see section 8).

## 1. Context

The Nahj Seller Marketplace (repo `agent_marketing`) pays agents commission. Until now it only covered web sales. This task adds a second channel:

1. An agent gives a user an **agent code**, for example `AGT-7K2M3P`.
2. The user enters it in the Nahj app.
3. The user then buys VIP through Google Play or the App Store, exactly as today.
4. The purchase is credited to the agent.

The marketplace owns agents, codes and commission. This repo:
- validates and stores the code on the user's account;
- copies it onto each VIP order at completion;
- reports store sales and store refunds to the marketplace reliably.

Read this repo's `CLAUDE.md` first and follow its conventions.

## 2. Confirmed rules (do not change them)

1. **Code format:** `AGT-` + 6 characters, or an approved alias such as `TOKOILMU`. Validation belongs to the marketplace; this repo only normalizes the input (uppercase, trim, accept a missing `AGT-` hyphen) and asks.
2. **Linking:** the user enters the code once. It is saved on the account (`users_attributes`), and the app pre-fills it for later purchases. The user can change or remove it.
3. **Attribution:** at order completion, the code currently saved on the account is copied onto that `orders` row. A later change never alters past orders.
4. **No discount:** the user pays the normal store price. Nothing about pricing or the purchase flow changes.
5. **Every completed VIP store purchase with a code** is reported to the marketplace. Purchases without a code are not reported.
6. **Every store refund of a reported purchase** is reported.
7. **Reliability:** events are written to a local outbox in the same transaction as the order change, and are sent with retries. An event is never lost and never sent for a purchase that did not happen.
8. **Apple restore** must not create a new sale. Restore deduplicates on the original transaction ID, as it does today.

## 3. Schema

**Nothing to add.** `script/migrations/20261029_marketplace.sql` (copied in task 01 from the marketplace repo's `script/nahj_modification.sql`) already contains everything this task needs, and it is applied to the local database:

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

(The block above is for reference only; do not run it again.)

`users_attributes` keys, using the existing key/value table: `agent_code` and `agent_code_set_at`. Verify the table's structure and existing helpers (`GetUserAttribute` and friends) first.

## 4. Public endpoints for the app

Add these to a new `contr/agent_code.go`, with the usual Bearer token handling. Guest users (`user_type = 0`) may save a code. The code is applied when they buy after signing in, because store purchases already require their normal flow.

| Method and path | Behaviour |
| --- | --- |
| `GET /v1/agent-code` | Returns the saved code and the agent's display name, or empty. |
| `PUT /v1/agent-code` `{code}` | Normalizes the code and calls the marketplace validate endpoint (§6). Valid → save `agent_code` and `agent_code_set_at` and return `{code, agentName}`. Invalid → error key `AGENT_001` "This agent code is not valid". Marketplace unreachable → `AGENT_002` "Could not check the code, try again". Never save an unchecked code. |
| `DELETE /v1/agent-code` | Removes the saved code. |

Add the i18n keys to all three locale files (`en`, `ar`, `id`). Rate-limit `PUT` per user (for example 10 per hour) so codes cannot be guessed. The codes are not secret, but this prevents abuse.

## 5. Changes in the purchase and refund flows

- **Completion** (`OrderProcess`, `vip_pass` branch, through `AddVipTime` from task 01), in the same transaction:
  - read the user's saved `agent_code`;
  - if present, store it in `orders.agent_code`;
  - insert a `marketplace_outbox` row `store_sale` with `event_key = store_sale:{store}:{storeTransactionId}` (unique, so a repeated complete cannot duplicate it).
  - Payload:
    ```json
    {"store":"google|apple","storeTransactionId":"…","originalTransactionId":"…",
     "userId":"…","itemId":"vip_pass_monthly","reportedPrice":75000,"reportedCurrency":"IDR",
     "purchasedAt":"2026-10-25T08:00:00Z","agentCode":"AGT-7K2M3P","nahjOrderId":"…"}
    ```
  - **Commission does not depend on the price you send.** The marketplace calculates it from its own catalog (an IDR base price per item). `reportedPrice` and `reportedCurrency` are optional, used for the currency rule and for reports:
    - Apple: take `price` and `currency` from the signed transaction (JWS v2), converted to whole currency units.
    - Google: send them only if the verified purchase data contains them. Otherwise omit both fields. Never take them from the client request.
- **Restore** (Apple): no new outbox row if the original transaction was already reported.
- **Refund** (Google voided purchase, Apple refund notification, through `RefundVipTime` from task 01): if the order has an `agent_code`, insert a `store_refund` outbox row in the same transaction: `{store, storeTransactionId, refundedAt, reason}`.
- **Admin and marketplace grants** never create outbox rows.

## 6. Calls to the marketplace

**These marketplace endpoints are not built yet.** The marketplace builds them in its own step. Implement the client against the contract below and test it with an `httptest` server that plays the marketplace. In real use, until the endpoints exist, code validation returns `AGENT_002` and outbox events simply wait and retry, so nothing is lost.

- Configuration section `marketplace`: `baseUrl`, Keycloak client credentials for this repo's service client `nahj-backend-service` (secrets only from the secret store or env, never committed), timeouts.
- Client in `utis/marketplace.go`. It fetches and caches a client-credentials token from Keycloak and refreshes it before expiry.
- Endpoints (provided by the marketplace):
  - `GET  {baseUrl}/internal/v1/agent-codes/{code}` → `{valid, agentId, displayName, agentType}`
  - `POST {baseUrl}/internal/v1/store-sales` with the store_sale payload. 200 or 409-duplicate both count as delivered.
  - `POST {baseUrl}/internal/v1/store-sales/{store}/{storeTransactionId}/refund`. 200 or 404-not-recorded both count as delivered; log the 404.
- **Outbox sender:** a background goroutine started next to the existing one in `background/`. Every few seconds it:
  - claims due rows with `SELECT … FOR UPDATE SKIP LOCKED`;
  - sends them;
  - marks them sent, or sets `attempts`, `last_error` and an exponential `next_try_at` (cap at 1 hour);
  - logs an error after 20 attempts but keeps retrying.
  It is safe to run in several instances.

## 7. Mobile app contract (for the mobile team; no app code in this repo)

| Item | Contract |
| --- | --- |
| Where | VIP purchase screen: an optional "Agent code" field, collapsed under "Have an agent code?" |
| Check | On submit, call `PUT /v1/agent-code`. On success show "Agent: {agentName} ✓". On `AGENT_001` show the error and keep the purchase available without a code. |
| Pre-fill | On opening the VIP screen, call `GET /v1/agent-code` and show the saved agent with a "Change" and "Remove" option. |
| Link | `https://nahj.ryam.app/a/{code}` opens the app (Android App Links / iOS Universal Links) and pre-fills the code; if the app is not installed it opens the store page. The web page for that path is served by the marketplace. |
| Purchase | No change to the store purchase and complete calls. The backend attaches the code itself. |
| iOS | Allowed: the code only attributes the sale and unlocks nothing. Get store-policy confirmation before release. |

## 8. How to work

1. **Plan first.** Confirm in code:
   - the `users_attributes` structure;
   - where Google and Apple verified price and currency are available;
   - the refund handlers;
   - how task 01 exposes the completion and refund transactions.
   Then write the plan and wait for approval.
2. Branch from the task 01 branch, for example `feature/agent-codes`, in small commits. Do not push to `main` or `develop` without the user's say-so.
3. **Tests**, with the harness from task 01:
   - Save a valid code; reject an invalid one; marketplace down → nothing saved.
   - A purchase with a saved code: the order has `agent_code`, and one outbox row exists.
   - A repeated complete or a restore creates no second outbox row.
   - Changing the code after purchase leaves the old order unchanged.
   - Purchase without a code: no outbox row.
   - Refund of an attributed order: one `store_refund` row.
   - Outbox sender: success marks sent; failure backs off; 409 or 404 count as delivered; two senders never send the same row twice.
4. `go build`, `go vet ./svc ./utis`, tests, and swagger for the new public endpoints.
5. Finish with a short report:
   - what changed;
   - migration steps;
   - config keys;
   - i18n keys;
   - open points (especially the Google price source).
