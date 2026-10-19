# Nahj Seller Marketplace — System Architecture

Status: draft for review, revised 2026-10-14 after the system analysis (`02-system-analysis.md`).
Scope: Indonesia V1 of the seller marketplace at `https://nahj.ryam.app`.
Sources: `Nahj_Final_Developer_Reference.md` (v2.0), `Nahj_Complete_UX_Specification.md` (v2.0), `Nahj_28_Screen_Visual_Boards.md`, and the existing `nahj_backend` code.

Items marked **[Decision]** are recommendations that still need confirmation. They are collected in section 13.

## 1. What this system is

A web platform where approved sellers sell prepaid Nahj subscriptions. Customers pay Nahj through QRIS or virtual account. A paid order becomes either a direct activation on the buyer's account or a set of activation codes. Sellers earn commission into a wallet and withdraw it. Staff handle applications, payments, refunds, payouts, risk and support.

It is a separate project from `nahj_backend`. The game backend keeps ownership of user accounts and of what a user can access in the app. This system owns everything about selling: sellers, orders, payments, codes, commissions, wallets, withdrawals, refunds, referrals, support and audit.

## 2. Architecture principles

These come directly from the developer reference and shape every component.

| Principle | Consequence |
| --- | --- |
| Backend is the only source of truth for money, access and allowed actions | The frontend never computes status, price, eligibility or timers. Every response carries the statuses, the allowed actions and the server time. |
| Every mutation is idempotent | Each command takes an idempotency key and stores its outcome. A timeout is resolved by looking up the original operation, never by sending a new one. |
| Database and providers are not one transaction | External calls go through an outbox. State changes and the intent to call a provider are committed together; a worker performs the call. |
| Money history is never edited | Balances are derived from an append-only double-entry ledger. Corrections are new compensating entries. |
| Authorization is by capability and relationship | Checked on the server for every API, export and file, on every request. Hiding a button is not authorization. |
| Sellers and the worker use the same commands | Automatic completion at +30 minutes calls the same unit-level fulfillment command a seller calls. |
| Sensitive exceptions need a second person | Manual adjustments, large withdrawals, admin grants and configuration changes go through one approval mechanism. |

## 3. System context

```mermaid
flowchart LR
    subgraph Clients
        Web[Web app<br/>customer / seller / admin]
        Android[Nahj Android app<br/>redeem screen]
        Apps[Nahj Android + iOS apps<br/>access refresh]
    end

    subgraph Marketplace[agent_marketing - this project]
        API[API server]
        Worker[Worker]
        DB[(MySQL<br/>schema nahj_market)]
    end

    subgraph Existing
        KC[Keycloak]
        Game[nahj_backend]
        GameDB[(MySQL<br/>schema nahj)]
    end

    Pay[Payment provider<br/>QRIS / VA]
    Payout[Payout provider]
    R2[Cloudflare R2<br/>private + public buckets]
    Mail[Email service]

    Web --> API
    Android --> API
    Apps --> Game
    API --> DB
    Worker --> DB
    API --> KC
    Worker -- admin API, events --> KC
    API --> Game
    Worker --> Game
    Game -- account events --> API
    Game --> GameDB
    Pay -- webhooks --> API
    Worker --> Pay
    Worker --> Payout
    API --> R2
    Worker --> R2
    Worker --> Mail
```

Key boundaries:

- The marketplace never reads or writes the game schema, including `users`. It calls `nahj_backend` through an internal API (section 8).
- The mobile apps keep reading access state from `nahj_backend`. Only the Android redeem screen calls the marketplace API.
- Both systems trust the same Keycloak realm (`nahj`), so one Nahj account ID is used everywhere.

## 4. Components

### 4.1 Web frontend

One single-page application with three shells (customer, seller, admin) and shared components. **[Decision]** React with TypeScript and Vite.

- Served as static files from the same origin as the API, so session cookies are host-scoped and no cross-origin setup is needed.
- Screen structure follows the 28 Boards; behaviour, states and copy follow the UX specification. **[Decision]**
- Seller shell is mobile-first. Admin shell is desktop-first.
- Public pages that are shared as links (seller profile, sale request) need link-preview metadata. The API server returns a small HTML head for those routes when the request comes from a crawler; opening a sale-request link never claims the request. QR codes for sale-request links are drawn on the client.
- Countdowns use the `serverTime` returned with each response, never the device clock alone.
- All text goes through a translation layer from the start, even if V1 ships in one language.

### 4.2 API server

Go service exposing `/api/v1`. Same language and main libraries as `nahj_backend` (Gin, sqlx, MySQL) so the team can move between projects. Internally it differs from `nahj_backend` in three ways, each required by the spec:

- **Dependencies are passed in explicitly**, not held as package globals. The acceptance tests (T01–T25) are about races, replays and provider failures; they need a fake provider and a real database in tests.
- **Authentication, authorization, idempotency, rate limiting and audit are middleware**, not repeated in each handler.
- **Each use case is one transaction boundary** with explicit row locks.

### 4.3 Worker

The same codebase started in worker mode. It runs:

- The outbox dispatcher (provider calls, emails, push hints, calls to `nahj_backend`, Keycloak admin calls).
- The scheduled jobs in section 9.

Jobs and outbox rows live in MySQL and are claimed with `SELECT … FOR UPDATE SKIP LOCKED`, so several worker instances can run safely. Each run is recorded in `job_runs`. No message broker in V1.

### 4.4 Database

MySQL 8 on the existing Cloud SQL server, in its **own schema `nahj_market`** with its own database user that has no rights on the game schema `nahj`. Reasons:

- Name clashes: the game schema already has `orders`, `items` and `user_subscription`.
- Safety: a marketplace bug or leaked credential cannot change game data.
- Backup, restore and export of money data are independent of the game.
- Each project owns its migration history.
- Same server, so no extra cost; the schema can move to its own instance later without code changes.

`script/db.sql` is a reference dump of the game schema. On the game side the only schema change is new columns on `orders`, owned and migrated by `nahj_backend`.

### 4.5 Supporting services (all existing)

| Service | Use |
| --- | --- |
| Keycloak | Sign in for customers, sellers and staff; TOTP for MFA. Admin API for session logout and MFA status; user events for security holds. |
| Cloudflare R2 | **Private bucket** for seller evidence, support attachments, dispute evidence and exports; downloads use short-lived signed URLs issued after an authorization check. **Public bucket** behind a CDN path for approved seller logos and link-preview images only. |
| Email service | Transactional email and digests. |
| FCM | Push hints, sent through `nahj_backend`, which owns device tokens. |

## 5. Backend modules

One Go module, one package per domain under `internal/`. A package exposes commands and queries; only it touches its own tables.

| Module | Owns |
| --- | --- |
| `identity` | Sessions, bearer-token verification, account lookup, staff, staff invitations, capabilities, MFA step-up, security events, rate limits. |
| `catalog` | Versioned plans (each references a `nahj_backend` VIP `itemId` and snapshots its days and `is_lifetime`), IDR prices, commission rates, referral rules, market settings. Draft, scheduled and published versions; never edits a published one. |
| `content` | Policy versions and acceptances, help articles. |
| `seller` | Applications and evidence, onboarding, public profile revisions, operating status (active, paused, suspended), directory. |
| `risk` | Risk cases and scoped holds (new sales, directory, commission release, withdrawal, unit, payment). |
| `approval` | Approval requests with initiator and independent approver; frozen payloads. |
| `sales` | Sale requests and their events, quotes, orders and their frozen economic snapshot, replacement orders. |
| `payment` | Payment attempts, provider adapter, webhook intake, reconciliation, duplicate and mismatch cases, receipts. |
| `fulfillment` | Purchased units, activation credentials, delivery and publication, replacement, redeem, direct-to-code conversion. |
| `entitlement` | Client for the `nahj_backend` grant API; local record of each grant call and its state. |
| `ledger` | Accounts, journals and postings, balances, commission accrual, maturity, debt. |
| `wallet` | Withdrawal requests, fee quotes, payout destinations and their verification, payout provider adapter. |
| `refund` | Refund requests, review, unit reservation, provider refund command, disputes, evidence and chargebacks. |
| `referral` | Referral tree, period snapshots, provisional and qualified rewards, corrections. |
| `support` | Cases, messages, internal notes, attachments, routing between seller and Nahj. |
| `notify` | Durable notification records per event, recipient and channel; read state, preferences, digests, delivery and retry. |
| `reporting` | Seller and admin dashboard summaries, seller customer references, exports. |
| `audit` | Append-only log of who did what, with reason and outcome. |
| `ops` | Outbox, job scheduler, job runs, incidents, operation lookup, recovery queues. |

Dependency direction: `sales`, `payment`, `fulfillment`, `refund`, `wallet` and `referral` may call `ledger`, `catalog`, `risk`, `approval`, `notify` and `audit`. `ledger`, `risk`, `approval` and `audit` call nothing above them. `reporting` reads from other modules' query interfaces and never writes to them.

### Suggested layout

```
agent_marketing/
  backend/
    cmd/server/          main: api | worker | migrate
    internal/<module>/   one package per row above
    internal/platform/   db, config, logging, http middleware, crypto, clock
    migrations/          versioned SQL for schema nahj_market
    locales/
  web/
    src/shells/          customer, seller, admin
    src/features/
    src/shared/
  docs/
```

## 6. Data design

### 6.1 Main tables by module

| Module | Tables |
| --- | --- |
| identity | `sessions`, `staff`, `staff_capabilities`, `staff_invitations`, `security_events`, `rate_limits`, `operations` (idempotency key → outcome) |
| catalog | `config_versions`, `plans`, `plan_prices`, `commission_rates`, `seller_rate_overrides`, `referral_rules`, `market_settings` |
| content | `policy_versions`, `policy_acceptances`, `help_articles` |
| seller | `seller_applications`, `application_revisions`, `application_evidence`, `sellers`, `seller_onboarding`, `seller_profiles`, `seller_profile_revisions`, `reserved_names` |
| risk | `risk_cases`, `holds` |
| approval | `approval_requests` |
| sales | `sale_requests`, `sale_request_events`, `sale_quotes`, `orders` |
| payment | `payment_attempts`, `provider_events`, `payment_cases` |
| fulfillment | `purchased_units`, `activation_credentials`, `deliveries`, `share_events`, `redemptions` |
| entitlement | `entitlement_grants` (local record of calls to `nahj_backend`) |
| ledger | `ledger_accounts`, `journals`, `postings`, `commissions` |
| wallet | `payout_destinations`, `withdrawal_fee_quotes`, `withdrawals` |
| refund | `refunds`, `refund_units`, `disputes`, `dispute_evidence` |
| referral | `referral_links`, `referral_periods`, `referral_awards` |
| support | `cases`, `case_messages`, `case_attachments` |
| notify | `notifications`, `notification_preferences` |
| reporting | `seller_daily_sales`, `seller_customer_refs`, `exports` |
| audit | `audit_events` |
| ops | `outbox`, `jobs`, `job_runs`, `incidents` |

Main column decisions:

- `orders.replaces_order_id` links a replacement order to the order it replaces.
- `sale_requests.claimed_by_account_id` and `claimed_at` record the single claim.
- `holds(scope, subject_type, subject_id, risk_case_id, placed_by, reason, released_at)` with scope one of `new_sales`, `directory`, `commission_release`, `withdrawal`, `unit`, `payment`.
- `approval_requests(type, subject_type, subject_id, payload, payload_version, initiator, approver, status, reason)`.
- `sellers.onboarding_status`; portal access requires `active`.
- `purchased_units.reversible_amount` and `reversible_commission` for overlap-safe reversals.
- `notifications.read_at` and `category`.
- `payout_destinations.verification_status`, `provider_ref`, `name_match`, `is_default`.

### 6.2 Constraints that enforce the business rules

| Rule | Enforced by |
| --- | --- |
| One sale request is claimed by at most one buyer | Single claim columns set under a row lock |
| One active order per sale request; replacements are explicit | Unique key on `(orders.sale_request_id, active_flag)` where only the active order carries the flag; `replaces_order_id` set on the new order |
| One winning payment per order | Unique key on `orders.winning_attempt_id`, set inside a locked transaction |
| One provider transaction is processed once | Unique key on `(provider, provider_transaction_id)` and on `provider_events.event_id` |
| Exactly the ordered number of units | Unique key on `(order_id, unit_index)` |
| At most one live code per unused unit | Unique key on `(unit_id, live_flag)` where only live rows carry the flag |
| One grant per source | Unique `client_order_id` on `nahj_backend.orders` (the unit or source ID), and a unique source key in `entitlement_grants` |
| A command runs once | Unique key on `operations.idempotency_key` |
| Ledger entries are created once per business event | Unique key on `(journal_type, source_id)` |
| The same loss is never reversed twice | `purchased_units.reversible_amount` locked and reduced in the reversal transaction |
| Approver is not the initiator | Check in the approval command and a database check constraint |
| Display names are unique | Unique key on the normalized display name; reserved-name list |
| Stale edits are rejected | `version` column checked on update |

### 6.3 Conventions

- **Money**: integer rupiah in `BIGINT`. No floating point. Commission is allocated per unit with a deterministic rounding rule, and the per-unit amounts are stored so reversals use the original values.
- **Time**: UTC in the database. Asia/Jakarta is applied only for seller reports, dashboards and referral months. Provider settlement time and backend confirmation time are separate columns.
- **Snapshots**: an order stores its accepted quote, plan version, unit price, total, commission rate, referral rate and referrer, and accepted policy versions. Later configuration changes never touch it.
- **Status**: payment, fulfillment and refund status are separate columns on an order, not one combined state.
- **Personal data**: the marketplace stores the Nahj account ID and, where the UX needs it, a masked email. On account deletion it anonymizes customer references and support content and keeps financial records under a pseudonymous ID.

### 6.4 Ledger

Standard double entry; every journal balances. Full design and rationale: `02-system-analysis.md` section 5.

**Seller accounts** (liabilities, one set per seller): `pending`, `held`, `available`, `locked`. A negative `available` is the seller's debt. **Withdrawn**, **Lifetime Net Earnings** and **Referral Earnings** are reports summed from journals, not accounts.

**Platform accounts** (per market): `provider_clearing`, `payout_funding` (assets); `sales_revenue`, `payout_fee_income` (revenue); `customer_suspense`, `refunds_payable` (liabilities); `commission_expense`, `referral_expense`, `adjustments` (expenses).

| Journal type | Debit | Credit |
| --- | --- | --- |
| `payment_accepted` | provider_clearing | sales_revenue |
| `payment_surplus` | provider_clearing | customer_suspense |
| `commission_accrued` | commission_expense | seller pending |
| `commission_matured` (168 h after settlement) | seller pending | seller available |
| `hold_placed` / `hold_released` | pending or available / held | held / pending or available |
| `referral_awarded` / `referral_reversed` | referral_expense / referrer bucket | referrer pending / referral_expense |
| `withdrawal_locked` | seller available | seller locked |
| `withdrawal_unlocked` (once) | seller locked | seller available |
| `withdrawal_paid` | seller locked (gross) | payout_funding (net), payout_fee_income (fee) |
| `withdrawal_returned` | payout_funding, fee if returned | seller available |
| `refund_approved` / `refund_completed` / `refund_cancelled` | sales_revenue / refunds_payable / refunds_payable | refunds_payable / provider_clearing / sales_revenue |
| `surplus_refunded` / `surplus_recognized` | customer_suspense | provider_clearing / sales_revenue |
| `commission_reversed` | seller pending or available | commission_expense |
| `chargeback_lost` / `chargeback_won` | sales_revenue / provider_clearing | provider_clearing / sales_revenue |
| `manual_adjustment` (after independent approval) | adjustments or seller account | the other side |

Rules:

- A Processing payout stays in `locked`. Nothing is posted until the transfer is verified, and an unknown outcome posts nothing.
- Debt is covered automatically by the next release into `available`. Pending never offsets debt early.
- A reversal debits the bucket where the original amount currently sits.
- Balances are cached per account and updated in the same transaction as the journal. A daily job re-sums postings and raises an incident on any difference.

### 6.5 Activation codes

- Generated from a cryptographic random source, long enough to be unguessable.
- Stored as a keyed hash for lookup and, separately, as an encrypted value so an authorized buyer or seller can see it again.
- Never written to logs, URLs or audit records. Shown masked by default; each reveal is audited.
- The code format (prefix, length, grouping) is a single configuration value. **[Decision]**

### 6.6 Exports

- Requested exports are rows in `exports` (requester, scope, filters, status Preparing / Ready / Expired / Failed, file key, expiry).
- A job generates the CSV, with formula neutralization, into the private bucket. The download re-checks authorization.
- Files expire after a configured period (default 24 hours) and are purged by a job.
- A code export is a fulfillment action: it publishes the exported codes to the buyer portal (D08) and is audited per code.

## 7. Identity and security

### 7.1 Sign in

| Client | Mechanism |
| --- | --- |
| Web | The API server runs the OpenID Connect login with Keycloak and issues its own secure, HTTP-only, same-site session cookie. Tokens never reach browser JavaScript. Mutations require a CSRF token. |
| Android redeem | The app sends its existing Keycloak bearer token. The same endpoints accept either a session cookie or a bearer token. Access tokens are short-lived in the realm. |
| Payment and payout webhooks | No user session. Authenticated by provider signature and source checks. |
| `nahj_backend` callbacks | Service credential on an internal endpoint. |

Guest (anonymous) app accounts are rejected for purchase and redeem.

### 7.2 Roles and capabilities

Keycloak answers "who is this". The marketplace database answers "what may they do". **[Decision]**

- A seller is an account with an approved `sellers` row **and** completed onboarding: MFA set up, current seller terms accepted, display name approved. Until then the seller sees only the onboarding checklist.
- A staff member is an account with a `staff` row and a set of capabilities, each scoped to a market. Staff are added by invitation; the last active Super Admin cannot be disabled.
- Capabilities and seller status are read on every request, so disabling staff or suspending a seller takes effect immediately in this system.
- Each API route declares the capability it needs. Each query is also filtered by relationship: a seller sees only orders attributed to them, a customer only their own.
- Actions needing independent approval go through `approval_requests`, which rejects approval by the initiator.

### 7.3 MFA

- Staff sign in always requires TOTP, enforced in Keycloak.
- Sensitive seller actions (withdrawal, payout destination change) require a fresh step-up challenge. **[Decision]** Use Keycloak re-authentication with TOTP and check the authentication time on the server.
- No SMS.

### 7.4 Sessions and security events

- Disabling staff, suspending a seller or the user choosing "sign out other devices" deletes local sessions and calls the Keycloak admin API to log out the user's Keycloak sessions.
- Keycloak user events are enabled for password reset, credential update and TOTP changes. The worker polls the Keycloak admin events API and stores them in `security_events`. Configured events place a time-limited `withdrawal` hold.
- A payout destination change notifies the previous verified email and places the same hold.
- Account, seller and staff screens list security events and active sessions from these sources.

### 7.5 Other controls

- Rate limiting with MySQL-backed fixed-window counters keyed by account, IP, email or code prefix. Covers redeem, sign-in challenges, resend cooldowns and recovery requests. Responses return the retry time.
- Upload type and size limits and malware scanning before a file becomes downloadable.
- Lookups of customers by email record a purpose in audit.
- Secrets come from environment or a secret store, never from a config file in the repository.
- Audit records store redacted before and after values; never passwords, one-time codes, tokens, full bank numbers or raw activation codes.

## 8. Integration with nahj_backend

### 8.1 Endpoints

New internal endpoints in `nahj_backend`, reachable only from the marketplace and protected by a service credential:

| Endpoint | Purpose |
| --- | --- |
| Get account | Confirm the account exists and is not a guest (`user_type` 0); return display name and masked email (email comes from Keycloak). |
| Find account by email | Admin customer lookup. Returns the account ID only. |
| Get VIP items | Existing `GET /v1/shop/products?category=vip_pass`, called with the marketplace's Keycloak service-account token. Used when Super Admin publishes a plan version. |
| Create grant | Complete an order for one source through the existing order flow: account, `itemId`, snapshotted days, `is_lifetime`, `source` and `client_order_id`. Rejects a mismatch with the item. Idempotent on `client_order_id`; a repeat returns the original result. |
| Refund grant | Mark one order refunded after a refund or chargeback and subtract its days under the refund rule (§8.2). Idempotent. |
| List grants | All VIP orders of an account across sources (store, marketplace, admin), for "My Subscription" history and Support. |
| Get access projection | Account ID, projection version, coverage, active flag, expiry or Lifetime marker, evaluation time. Used for redeem preview and for "My Subscription". |
| Send notification | Deliver an in-app or push hint to the account's devices. |

And one call in the other direction:

| Callback to the marketplace | Purpose |
| --- | --- |
| Account deleted | The marketplace anonymizes the account's customer references and support content. |

The marketplace treats `nahj_backend` as an external provider: calls go through the outbox, and an unknown result is resolved by repeating the same idempotent call.

### 8.2 Grants and the access projection in `nahj_backend`

Today access is one `user_subscription` row per pass plus `users.user_type`. Store VIP products are one-time passes (`durationInDays`), not auto-renewing subscriptions. The analysis (section 2) lists the current behaviour and five defects.

Required changes:

- **Per-purchase records in the existing `orders` table** (confirmed): every source of VIP time is one order with `source` (`store`, `marketplace`, `admin`, `legacy`). `client_order_id` is the unique source reference; for a marketplace unit it is the unit ID. Add `duration_days`, the real VIP `start_time` and `end_time`, correct `amount` and `currency`, `refunded_at` and `refunded_days`.
- **Grant** = an internal endpoint that runs the existing initiate-and-complete logic (`OrderProcess`) in one transaction, idempotent on `client_order_id`.
- **Rules** (confirmed; analysis §2.3):
  - days × 24 hours;
  - new time starts at the end of current VIP time, or now;
  - a code's days start at redemption.
- **Refund** (confirmed): early refunds are accepted and late refunds are refused; the assumed window is 48 hours after activation (catalog setting `refund_window_hours`, snapshotted on the order); the rule for unused codes is open; store purchases follow Google and Apple rules. A refund or chargeback subtracts the order's unused days, `max(0, end_time − max(start_time, now))`, and moves the user's later orders earlier by the same amount. Chargebacks cannot be refused, and under this rule a late chargeback never cuts a newer purchase.
- **Lifetime** is subscription time: the one-time item `vip_pass_lifetime`, kept at 36,500 days (100 years) to avoid misleading-naming risk. It is shown with its real date, for example "Lifetime · until 20 Oct 2126". While an account has an active `is_lifetime` order, it cannot directly activate or redeem more VIP for itself, but can buy codes for others.
- **Compatibility cache**: after every change, write `user_subscription` (the computed expiry) and `users.user_type`, so the existing apps keep working.
- **Legacy No-Ads**: existing active or suspended rows are migrated once so they resume after VIP.
- **Defects to fix**: the expiry job never resets `user_type` for existing users; the store refund handler resets `user_type` without revoking the specific purchase and crashes when no order is found; the flows have no transactions or unique constraints.
- **The apps refresh the projection** on sign in, on resume and when a push hint arrives.

## 9. Background jobs

| Job | Trigger | Behaviour |
| --- | --- | --- |
| Outbox dispatch | Continuous | Sends queued provider calls, grant calls, Keycloak admin calls, emails and push hints. Retries with backoff. |
| Payment reconciliation | Every few minutes | Queries the provider for unresolved attempts, including locally expired ones. |
| Fulfillment deadline | At `payment_confirmed_at + 30 min` per order | Completes remaining eligible units through the normal command; respects holds; never resets. |
| Deadline reminder | At a configured time before each deadline | Reminds the seller; skipped if the order is already fulfilled. |
| Fulfillment recovery | Every few minutes | Retries failed units; raises an alert for overdue orders. |
| Commission maturity | Hourly | Releases matured, unheld commission; debt is covered by the release. |
| Referral month close | Start of each Jakarta month, plus on correction | Qualifies periods and posts or reverses awards. |
| Refund and payout reconciliation | Every few minutes | Queries the original provider command for unknown outcomes. Never resends blindly. |
| Payout destination verification | Every few minutes | Resolves pending verifications with the payout provider. |
| Daily money reconciliation | Daily | Compares provider records with the ledger; differences become cases. |
| Ledger balance check | Daily | Re-sums postings against cached balances; differences become incidents. |
| Risk review and dispute deadlines | Hourly | Alerts owners of overdue risk reviews and approaching provider dispute deadlines. Never releases a hold. |
| Keycloak events | Every minute | Imports security events and places configured holds. |
| Exports | Continuous / daily | Generates requested exports; purges expired files. |
| Dashboard summaries | Every few minutes | Refreshes summaries that are not updated in the source transaction. |
| Notification retry and digest | Continuous / daily | Retries delivery only, never repeating a business effect; sends digest emails. |

## 10. Key flows

### 10.1 Payment acceptance

1. A webhook arrives, or reconciliation polls the provider.
2. The server verifies authenticity, then merchant, reference, amount and currency against the stored attempt.
3. In one transaction: store the provider event; lock the order; if it has no winning attempt, set this one, set `payment_confirmed_at` and `fulfillment_due_at`, create the purchased units, post `payment_accepted` and `commission_accrued`, schedule the deadline and reminder jobs, and queue notifications.
4. If the order already has a winner, post `payment_surplus` and open a duplicate-payment case. No new units, no new commission.
5. If any economic field does not match, post `payment_surplus` and open a mismatch case for Finance. No fulfillment.

### 10.2 Fulfillment

1. The seller, or the deadline job, calls the unit command for each eligible unit. Holds on the order's units or payment block it.
2. Direct: queue a create-grant call for the buyer's account; mark the unit fulfilled when the grant is confirmed.
3. Codes: generate the credential, publish it to the buyer's purchases, queue the email.
4. The order is complete when every eligible unit is fulfilled. Failures leave the order in recovery with the original deadline.
5. If the buyer gained Lifetime before a direct unit was fulfilled, the unit is held. With buyer consent, Support converts it to a code or starts a refund review.

### 10.3 Redeem

1. Check: look up the code by hash, read the account's projection, return a preview. Nothing is reserved. A Lifetime holder gets "You already have Lifetime access" and the code stays unused.
2. Confirm: in one transaction, lock the credential and unit, re-check holds and eligibility, mark the code consumed for this account, queue the create-grant call.
3. A repeat by the same account returns the original result. Another account gets a neutral "already used" answer.

### 10.4 Withdrawal

1. The seller gets a fee quote, passes the step-up challenge, and confirms amount, fee quote and destination. A changed fee requires a new confirmation.
2. In one transaction: check withdrawal holds, lock the seller's ledger accounts, check available funds and minimum, freeze gross, fee, net and destination, post `withdrawal_locked`.
3. Every withdrawal enters the Finance queue. Above a configured threshold a second, independent approver is required. The worker submits the payout command once.
4. Verified transfer → Paid (`withdrawal_paid`). Definite failure → Rejected and `withdrawal_unlocked` once. Unknown → stays Processing until reconciliation resolves it. A later return → Returned (`withdrawal_returned`).

### 10.5 Refund

1. A request changes nothing and opens a support case.
2. On approval, the affected units are reserved against redeem and fulfillment, `refund_approved` is posted, and one provider refund command is queued.
3. On verified completion: post `refund_completed`; void unused codes or revoke the affected grants; reverse the original commission and referral allocations; requalify the referral month.
4. A surplus-payment refund posts `surplus_refunded` only. It touches no grant and no seller account.

### 10.6 Sale request and order

1. The seller creates a sale request; each change is a `sale_request_events` row.
2. The buyer opens the link, signs in and receives a quote with a validity time.
3. On confirmation the request is claimed and the order is created with the quote snapshot. A double click returns the same order.
4. If the economics must change after a payment attempt exists, a replacement order is created with `replaces_order_id`, after the buyer sees the pending-payment warning. A late success on the old order is still accepted under its own snapshot.

## 11. API shape

- Base path `/api/v1`, grouped as `/public`, `/me` (customer), `/seller`, `/admin`, `/internal` (service callbacks) and `/webhooks/{provider}`.
- Every mutating request carries an `Idempotency-Key` header. `GET /operations/{key}` returns the stored outcome.
- Resources return separate statuses, a version number, and an `allowedActions` list. Every response includes `serverTime`.
- Errors return a safe code and a reference ID; rate-limited responses include the retry time. User-facing text is translated from the code, as in `nahj_backend`.
- Lists use server-side filters and cursor pagination. The seller directory cursor carries a per-session seed for a stable rotated order.
- Bulk commands return a result per item.
- Exports are asynchronous: a request returns an export ID whose status is polled.

## 12. Deployment, testing and operations

- **Deployment**: one Docker image for the backend, run as two services (API and worker). The web build is static files served from the same host. Database migrations run as a separate step before a new version starts.
- **Environments**: local (fake payment and payout providers, local Keycloak), staging (provider sandboxes), production.
- **Testing**: integration tests run each use case against a real MySQL instance with fake providers and a controllable clock. The 25 acceptance cases in the developer reference become automated tests.
- **Observability**: structured JSON logs with a request ID and operation key; `job_runs` and `incidents` for the operations screen; metrics for unresolved payments, overdue fulfillments, outbox age and failed jobs; alerts on each recovery queue.

## 13. Decisions

| # | Decision | Status | Affects |
| --- | --- | --- | --- |
| 1 | Screen structure: 28 Boards for structure, UX specification for behaviour | Recommended | Frontend scope |
| 2 | Frontend stack: React, TypeScript, Vite, one app with three shells | Recommended | Frontend |
| 3 | Roles: capabilities in the marketplace database; Keycloak for identity and MFA only | Recommended | Backend, Keycloak setup |
| 4 | Step-up MFA for sellers: Keycloak TOTP re-authentication | Recommended | Backend, Keycloak setup |
| 5 | Payment provider | Open | Payment adapter, refund mechanism, settlement timestamp |
| 6 | Payout provider | Open | Wallet adapter, fees |
| 7 | Entitlement contract: one order per purchase in the existing order flow; days × 24 h; stack at end; codes start at redemption; refund subtracts the order's days; no new offline grace (§8.2) | Confirmed 2026-10-20 (refund removes unused days; early refunds only) | Game backend, mobile apps |
| 8 | Code and order reference formats | Open | Backend, copy |
| 9 | Languages for V1 | Open; translation layer from day one | Frontend, emails |
| 10 | Queue technology: MySQL-backed outbox and jobs; no broker in V1 | Decided | Operations |
| 11 | Database: separate schema `nahj_market` on the same server | Decided | Operations, security |
| 12 | Lifetime = the one-time 36,500-day (100-year) VIP item, shown with its date; Lifetime holders cannot add VIP to their own account; sold on web and in stores | Confirmed 2026-10-20 | Game backend, mobile apps, Terms |
| 14 | Marketplace plans reference `nahj_backend` items by `itemId`, read through the API, with IDR prices in the marketplace catalog | Decided | Catalog, entitlement |
| 15 | Web sells all five VIP items: Weekly, Monthly, 6-Month, Yearly, Lifetime | Confirmed 2026-10-18 | Catalog |
| 13 | Withdrawal approval: every withdrawal through Finance; second approver above a threshold | Decided (UX A11) | Wallet |

## 14. Build order

1. **Foundation**: project skeleton, migrations, identity and sessions, capabilities, idempotency, rate limits, audit, approvals, holds and risk cases, policy acceptances, outbox, jobs and job runs.
2. **Catalog and sellers**: versioned configuration, seller application, onboarding and approval, profile revisions, public marketplace.
3. **Sales and payment**: sale requests, quotes, orders and replacements, payment attempts with a fake provider, acceptance and reconciliation, receipts.
4. **Fulfillment and entitlement**: units, codes, redeem, the order-flow changes and grant endpoints in `nahj_backend`, the 30-minute job.
5. **Ledger and wallet**: accounts and journals, commission, maturity, withdrawals with a fake payout provider.
6. **Refunds and disputes.**
7. **Referrals.**
8. **Support, notifications, exports and dashboards.**
9. **Real provider integration, Keycloak events, Android redeem, launch readiness.**

Steps 1–3 need no outstanding business answers. Step 4 can start on the baseline contract; the projection rule is finalized when decision 7 is confirmed. Step 9 needs decisions 5 and 6.
