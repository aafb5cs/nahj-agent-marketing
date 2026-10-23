# Nahj Seller Marketplace — System Analysis

Date: 2026-10-14.
Inputs: `system-architecture.md` (draft), `01-business-analysis-review.md`, the developer reference and UX specification v2.0, the 28 boards, the `nahj_backend` source, and the game schema dump in `script/db.sql`.

This document records what the analysis found and what was decided. `system-architecture.md` has been updated to match.

## 1. Summary

- The architecture holds. The changes are in the data model and in a set of supporting features the UX specification needs.
- The "existing Nahj entitlement contract" that the specs refer to is partly present in `nahj_backend`. Section 2 documents it and proposes a baseline, so entitlement work no longer waits for a missing document.
- The entitlement contract is confirmed (section 2.3): every purchase is an order in the existing `nahj_backend` order flow, days × 24 h, new time added to the end, codes start at redemption, and refunds subtract the order's days. One detail is open: subtracting full or unused days.
- Lifetime is subscription time: a one-time, long-duration VIP item whose length the business sets (section 3).
- Six data-model changes were accepted (section 4), and the missing ledger events are resolved (section 5).
- Every gap from the UX specification has a resolution (section 6).
- The marketplace uses its own schema on the same MySQL server (section 7).

## 2. Entitlements in `nahj_backend` today

### 2.1 What exists

| Topic | Current behaviour | Source |
| --- | --- | --- |
| Products | Only VIP is sold: Weekly (7 days), Monthly (30), 6-Month (180), Yearly (365) and Lifetime (36,500), each with `durationInDays` in its metadata (section 3.1). No-Ads (`no_ads_pass`) is retired; old rows may still exist. | `items` table, `/v1/shop/products` |
| Store billing | VIP is a **one-time product**, not an auto-renewing subscription. Google subscription notifications are ignored and `auto_renew` is always 0. | `svc/shop.go` `RealTimeDeveloperNotification` |
| Storage | One `user_subscription` row per active pass, plus `users.user_type` (0 guest, 1 registered, 2 ads removed, 3 VIP). | `models/shop.go`, `models/users.go` |
| Buying VIP while VIP is active | The new days are added to the existing row's `expired_at`. | `OrderProcess` |
| Buying VIP while No-Ads is active (legacy) | No-Ads is suspended and VIP starts now. **Intended:** No-Ads resumes when VIP expires. | `OrderProcess` |
| Duration | `durationInDays × 24 hours`. No calendar months. | `OrderProcess` |
| Expiry | A background job runs every 12 hours by default, moves expired rows to history and deletes them. | `background/subscribtion.go` |
| Lifetime | A normal pass of 36,500 days (section 3). | `vip_pass_lifetime` |
| Coverage, offline grace | Not present. | — |

Because store VIP is also prepaid time, "how prepaid web time combines with a store subscription" has a simple answer: both are prepaid VIP time and use the same stacking rule. The spec's warning about not cancelling store auto-renewal does not apply to the current products.

### 2.2 Defects found

These matter because the grants work builds on this code.

| # | Defect | Effect |
| --- | --- | --- |
| 1 | The legacy No-Ads "resume" is not implemented. Nothing sets a suspended row back to Active, the expiry job only reads Active rows, and the suspended row's `expired_at` is never moved forward. | Suspended No-Ads time runs out while VIP is active and never comes back. Suspended rows are never cleaned up. |
| 2 | The expiry job has `if user != nil { …; continue }` before the `user_type` reset. | For every existing user, `user_type` stays VIP after expiry. Any client that reads `user_type` keeps granting VIP. |
| 3 | A store refund (voided purchase) sets `user_type` to Registered but leaves the `user_subscription` row active. It also dereferences `order` when no order is found. | One refund removes VIP even if other paid time remains, while the row still says active. A missing order crashes the handler. |
| 4 | No transactions or unique constraints in these flows. | Concurrent purchases or replayed notifications can apply time twice. |
| 5 | Expiry granularity is 12 hours. | Access can outlive its expiry by up to 12 hours. |

The per-order model in section 2.3 fixes 1–4 by design. Defect 5 goes away once access is read from the computed projection instead of from a row that a job deletes.

### 2.3 Entitlement contract (decision 7)

This writes down today's behaviour, with the defects fixed, as the "existing contract" the specs require. Product-owner answers of 2026-10-18 are marked.

1. **Coverage.** V1 has one coverage: VIP. Every item grants VIP.
2. **One record per purchase: the existing `orders` flow.** *Confirmed.* Every source of VIP time is one row in the existing `nahj_backend` `orders` table: store purchases (as today), marketplace units, admin exception grants. `client_order_id` is already unique, so for a marketplace unit it is the unit ID, which makes the call idempotent. The marketplace calls an internal endpoint that runs the same initiate-and-complete logic (`OrderProcess`) inside one transaction. This replaces the separate `access_grants` table proposed earlier. Changes needed on `orders`:
   - `source` (`store`, `marketplace`, `admin`, `legacy`) and the source reference;
   - `duration_days`, copied from the item at completion;
   - `start_time` and `end_time` holding the real VIP period of that order (today both are set to the insert time);
   - correct `amount` and `currency` (today `amount` is 0 and the price is written into `currency`);
   - `refunded_at` and `refunded_days`.
3. **Duration.** *Confirmed.* An item grants `durationInDays × 24 hours`. Monthly is exactly 30 days, not a calendar month.
4. **Stacking.** *Confirmed.* New time starts at the end of the current VIP time, or now if there is none. Example: Monthly on Jan 1 and another Monthly on Jan 10 give VIP until Mar 2.
5. **Unused codes.** *Confirmed.* A code's days start when it is redeemed, not when it was paid for.
6. **Refund.** *Confirmed 2026-10-20.*
   - **Early refunds are accepted and late refunds are refused.** *Working assumption (2026-10-20):* the window is **48 hours after activation**, meaning after the code is redeemed or the direct activation is applied. It is the versioned catalog setting `refund_window_hours = 48`, snapshotted on each order. After the window, a buyer's refund request is refused; Finance can still make an exception with an approval.
   - **Unused codes** (never redeemed): *confirmed 2026-10-21.* A bulk buyer can return the codes that were never used, and keep the used ones. The period is **30 days after payment**, a configurable setting (`unused_refund_days = 30`). It applies to every plan, including Weekly, because an unused code's days have not started.
   - **Commission on codes** (confirmed 2026-10-21). A code unit's commission is released at the later of two times:
     - 168 hours after settlement;
     - the code is redeemed, or its 30-day refund period ends, whichever comes first.
     So a refunded unused code never has released commission, which prevents seller debt and the buy-commission-refund collusion. Direct activations keep the normal 168-hour rule.
   - **Short plans.** For a redeemed Weekly pass, 48 hours is 2 of its 7 days. The window is therefore a per-plan setting, so Weekly can have a shorter window (for example 24 hours) if needed. The default is 48 hours for all plans.
   - **Store purchases** follow Google and Apple refund rules, not this window. Their refunds arrive as store notifications and use the same days rule below.
   - **Days removed:** the refunded order's **unused** days, `max(0, end_time − max(start_time, now))`. Later orders of the user move earlier by the same amount, and the order is marked refunded. For an early refund this is almost the whole order. A code that was never redeemed has no days to remove; it is simply voided.
   - **Chargebacks cannot be refused.** The payment provider can reverse a payment at any time. The same unused-days rule applies, so a late chargeback of an order that has already ended removes no days and never cuts a newer purchase. Finance handles the money loss, and Support can review the account.
7. **Offline grace.** *Confirmed: option A.* Nothing new. The app keeps its current offline behaviour, and the mobile team documents it.
8. **Compatibility.** `nahj_backend` keeps writing `user_subscription` and `users.user_type` after every change, so the current apps keep working.
9. **No-Ads is removed.** *Confirmed 2026-10-21.* Ads were removed from the game because children's apps earn no ad income, so No-Ads has no value. No migration is needed. Remaining rows are left to expire, `user_type` 2 is no longer written, and defect 1 in section 2.2 no longer matters.

## 3. Lifetime

### 3.1 Lifetime already exists in the app

The live VIP products, from `GET /v1/shop/products?category=vip_pass` (the same data is in the game table `items`):

| `itemId` | Days | Store product IDs | Store price (USD) |
| --- | --- | --- | --- |
| `vip_pass_weekly` | 7 | `com.nahj.vip.pass.7d` | 1.99 |
| `vip_pass_monthly` | 30 | `com.nahj.vip.pass.30d` | 4.49 |
| `vip_pass_6month` | 180 | `com.nahj.vip.pass.180d` | 22.99 |
| `vip_pass_yearly` | 365 | `com.nahj.vip.pass.365d` | 39.99 |
| `vip_pass_lifetime` | 36,500 | `com.nahj.vip.pass.36500d` | 89.99 |
| `vip_test_pack` | 1 | `vip_test_pack` | 1.85 |

**Lifetime is a 36,500-day (100-year) VIP pass.** It is already sold in both stores and goes through the same code path as every other pass: its days are added to the end of the current expiry. This is the "existing Nahj contract" for Lifetime that the specs say to reuse.

### 3.2 What the specs add

| Rule | Where |
| --- | --- |
| Lifetime is a one-time purchase; Monthly and Yearly are prepaid without renewal. | Dev Ref §1 |
| A Lifetime holder who directly activates or redeems more VIP gets no benefit. The request is rejected and the code is not consumed. | D03; UX §6 |
| When creating a sale, a Lifetime holder choosing direct activation is offered a gift code instead. | UX C04 |
| If the buyer becomes a Lifetime holder after paying but before direct fulfillment, the unit is held. Support converts it to a code or refunds it, with the buyer's consent. | Dev Ref §5.2; UX §5.3 |
| A Lifetime refund must not erase the account's other grants. | Dev Ref §5.3; T11 |
| Results show "Lifetime access" or "No expiry date" instead of a date. | UX C10.3, C11, N01.3 |

### 3.3 Definition

1. **Lifetime is subscription time.** *Confirmed.* Lifetime is a one-time purchase of a long VIP period, kept at **36,500 days (100 years)** to avoid misleading-naming risk under Indonesian consumer-protection law (UU 8/1999). Its length is the item's `durationInDays`. It stacks and is refunded like any other order (section 2.3). No new algorithm is needed, which matches D03.
2. **Lifetime holder.** The catalog marks the plan `is_lifetime`, and the order records it. An account is a Lifetime holder while it has a completed, unrefunded `is_lifetime` order whose period has not ended.
3. **Existing time is not lost.** A Lifetime order is stacked after the user's remaining time, so the remaining days are used first.
4. **Refund of Lifetime.** Only that order's days are subtracted, using the refund rule in section 2.3 item 6.
5. **What a Lifetime holder can do.** *Confirmed.*
   - Directly activating or redeeming VIP onto their own account: rejected, and the code is kept.
   - Buying codes for others: allowed.
   - In the apps: VIP store purchases are hidden. A store purchase that still arrives is stacked after the Lifetime period and stays visible to Support.
6. **Display.** *Confirmed 2026-10-20:* show the real expiry date, with the Lifetime label. Example: "Lifetime · until 20 Oct 2126". The projection returns both the date and an `is_lifetime` flag.

### 3.4 Problems in the current product data

| # | Problem | Why it matters |
| --- | --- | --- |
| 1 | The top-level `appleProductID` differs from `metadata.appleProductId` for Lifetime, Monthly and Yearly (for example `com.nahj.pass.lifetime` vs `com.nahj.vip.pass.36500d`). | It is unclear which ID Apple verification uses. A mismatch can make a valid purchase fail or map to the wrong item. |
| 2 | Every pass has type `non-consumable`. | On Apple, a non-consumable can be bought only once and is restored forever. A 7-day or 30-day pass should be a consumable or a non-renewing subscription. Repeat purchases and "Restore" must not create duplicate grants; deduplication must use the store transaction ID. |
| 3 | `vip_test_pack` is `isSallable: true` in the production list. | Real users can buy a test product. |
| 4 | The Monthly item name is `"Monthly VIP Pass`, with a stray quote. | Visible copy. |
| 5 | Prices are store prices in USD, with no currency field. | The marketplace needs its own IDR prices in its catalog. Store prices are not reused. |
| 6 | `total: 200` with 6 results for `category=vip_pass`. | The total ignores the category filter. Minor, but paging on it would be wrong. |

### 3.5 How the marketplace uses the items

- **Owner.** `nahj_backend` owns the items. Each marketplace plan version references one `itemId` and adds what only the marketplace has: IDR price, commission rate, availability and display order.
- **Read through the API, not the database.** The marketplace reads items from `GET /v1/shop/products?category=vip_pass` with its own Keycloak service-account token (client credentials). It does not use a user's token, and it does not read the game DB, so the schema boundary in section 7 holds.
- **Snapshot.** When Super Admin publishes a plan version, the marketplace copies `itemId`, `durationInDays` and `is_lifetime` into it. Orders snapshot the plan version, so a later item change never changes a sold unit.
- **Grant.** Create-grant sends the `itemId` and the snapshotted days. `nahj_backend` rejects a mismatch instead of guessing.
- **Which items the web sells** is catalog configuration. *Confirmed:* all five (Weekly, Monthly, 6-Month, Yearly, Lifetime). `vip_test_pack` is excluded.

### 3.6 Questions

- Mobile team: do the apps hide VIP purchases for a Lifetime holder?
- Store team: problems 1–3 in section 3.4.

## 4. Accepted data-model changes

| # | Change | Form |
| --- | --- | --- |
| 1 | Replacement orders | `orders.replaces_order_id`. A sale request is claimed once (`sale_requests.claimed_by_account_id`, `claimed_at`). A unique key on `(sale_request_id, active_flag)` allows one active order per request; replaced orders clear the flag. |
| 2 | Grants without a unit | Every grant is an order in the existing `nahj_backend` `orders` table, with `source` (`store`, `marketplace`, `admin`, `legacy`) and `client_order_id` as the unique source reference (section 2.3 item 2). An admin exception grant is an `admin` order with no payment. The marketplace keeps `entitlement_grants` as its local record of the calls it made. |
| 3 | Scoped holds | `risk_cases` plus `holds(scope, subject_type, subject_id, risk_case_id, placed_by, released_at)`. Scopes: `new_sales`, `directory`, `commission_release`, `withdrawal`, `unit`, `payment`. This replaces `seller_holds`. |
| 4 | Generic approvals | `approval_requests(type, subject, payload, initiator, approver, status, reason)`. A check constraint plus application logic ensures approver ≠ initiator. The approved payload is frozen, and executing it requires the stored version. |
| 5 | Quotes | `sale_quotes(sale_request_id, catalog_version, unit_price, quantity, total, expires_at, version)` and `withdrawal_fee_quotes(seller, amount, method, fee, net, expires_at)`. An order and a withdrawal each reference the quote they accepted. |
| 6 | Ledger events | Section 5. |

## 5. Ledger: missing events and how to fix them

### 5.1 The problem

The draft ledger had only the seller buckets and three platform accounts. Three real events had no account to post to:

- a payout that comes back after it was marked Paid;
- a manual correction;
- money that never belonged to a seller, such as a surplus or mismatched payment and its refund.

The draft also treated Withdrawn as a bucket. The developer reference says Pending, Held, Available and Locked are the only current buckets, and that Withdrawn is a cumulative figure. Daily reconciliation also needs ledger accounts that mirror the money held at the payment and payout providers.

### 5.2 Accounts

Standard double entry. Every journal's debits equal its credits.

**Seller accounts**, one set per seller: `pending`, `held`, `available`, `locked`. These are amounts Nahj owes the seller (liabilities), so a balance is credits minus debits. A negative `available` is the seller's debt.

**Platform accounts**, one set per market:

| Account | Kind | Holds |
| --- | --- | --- |
| `provider_clearing` | Asset | Customer money collected by the payment provider. Reconciled daily against provider reports. |
| `payout_funding` | Asset | Nahj's balance at the payout provider. Reconciled against payout reports. |
| `sales_revenue` | Revenue | Gross subscription sales. |
| `customer_suspense` | Liability | Surplus, duplicate and mismatched payments, which are not revenue. |
| `refunds_payable` | Liability | Approved refunds not yet confirmed by the provider. |
| `commission_expense` | Expense | Direct commission. |
| `referral_expense` | Expense | Referral rewards. |
| `payout_fee_income` | Revenue | Withdrawal fees charged to sellers. |
| `adjustments` | Expense | Counterpart for approved manual corrections. |

Moving cash from the providers to the bank is outside the marketplace. Finance records it in its accounting system, and reconciliation works on the provider accounts above.

### 5.3 Journal types

Each journal has a unique key on `(journal_type, source_id)` and links to its business event. Seller-side journals carry the seller ID.

| Journal type | Debit | Credit | Source ID |
| --- | --- | --- | --- |
| `payment_accepted` | provider_clearing | sales_revenue | winning payment attempt |
| `payment_surplus` | provider_clearing | customer_suspense | duplicate or mismatched attempt |
| `commission_accrued` | commission_expense | seller pending | unit |
| `commission_matured` | seller pending | seller available | unit. For a code unit, only after the code is redeemed or its unused-refund period ends (section 2.3 item 6). |
| `hold_placed` | seller pending or available | seller held | hold |
| `hold_released` | seller held | seller pending or available | hold |
| `referral_awarded` | referral_expense | referrer pending | referral award |
| `referral_reversed` | referrer pending or available | referral_expense | award revision |
| `withdrawal_locked` | seller available (gross) | seller locked (gross) | withdrawal |
| `withdrawal_unlocked` | seller locked | seller available | withdrawal, at most once |
| `withdrawal_paid` | seller locked (gross) | payout_funding (net) and payout_fee_income (fee) | withdrawal |
| `withdrawal_returned` | payout_funding (net), and payout_fee_income (fee) if the fee is returned | seller available | payout return event |
| `refund_approved` | sales_revenue | refunds_payable | refund |
| `refund_completed` | refunds_payable | provider_clearing | refund |
| `refund_cancelled` | refunds_payable | sales_revenue | refund, on a definite provider failure that Finance rolls back |
| `surplus_refunded` | customer_suspense | provider_clearing | surplus refund. Touches no seller account and no grant. |
| `surplus_recognized` | customer_suspense | sales_revenue | Finance decision to keep a surplus |
| `commission_reversed` | seller pending or available | commission_expense | refunded or charged-back unit |
| `chargeback_lost` | sales_revenue | provider_clearing | dispute |
| `chargeback_won` | provider_clearing | sales_revenue | dispute |
| `manual_adjustment` | adjustments or a seller account | the other side | approval request. Posted only after independent approval. |

### 5.4 Rules

- **Withdrawn and Lifetime Net Earnings** are reports, not accounts. Withdrawn is the sum of `withdrawal_paid` minus `withdrawal_returned`. Lifetime Net Earnings is accrued commission and rewards minus reversals. Referral Earnings is the referral part of that.
- **Processing payouts stay in `locked`.** `withdrawal_paid` is posted only on a verified transfer. An unknown outcome posts nothing, which matches the rule that an uncertain payout stays locked.
- **A returned payout** moves the money back to `available` and keeps the earlier Paid journal. Whether the fee is returned is a Finance setting and is open question 5.
- **Debt** needs no journal of its own. A reversal can make `available` negative, and the next `commission_matured` or `referral_awarded` release covers it automatically. Pending amounts never offset debt early, because `commission_reversed` posts to `pending` while the commission is still pending.
- **Reversal source.** A reversal debits the bucket where the original amount currently sits, read from the unit's allocation state inside the same transaction.
- **Refund and chargeback overlap (T13).** Each unit stores its remaining reversible amount. Every reversal journal locks the unit and reduces that amount in the same transaction. A second loss on the same unit fails the check instead of reversing twice.
- **Balances** are cached per account and updated in the same transaction as the journal. A daily job re-sums postings and raises an incident on any difference.

## 6. Other gaps and their resolutions

Each item below is now in `system-architecture.md`.

| Gap | Resolution |
| --- | --- |
| Async exports | `exports` table and an export job. CSV with formula neutralization. Files go to private R2 with an expiry (configurable, default 24 hours) and are re-authorized on download. A code export publishes the codes to the buyer portal and is audited, as D08 requires. A purge job deletes expired files. |
| Seller onboarding gate | `sellers.onboarding_status`. Portal access requires MFA set up (read from Keycloak), current seller terms accepted, and an approved display name. Approval alone creates the seller in `onboarding`. |
| Session and token revocation | Capabilities are read from the marketplace database on every request, so disabling staff or suspending a seller takes effect immediately in this system. The marketplace also calls the Keycloak admin API to log out the user's sessions. Bearer access tokens are kept short-lived in the realm. |
| Security events and the post-recovery hold | Keycloak user events are enabled (password reset, TOTP change, credential update). The worker polls the Keycloak admin events API and stores them in `security_events`. Defined events place a time-limited `withdrawal` hold. Payout destination changes are already marketplace events. |
| Public files | A second R2 bucket, public behind a CDN path, holds only approved seller logos and link-preview images. They are copied there when a profile revision is approved. Evidence and attachments stay private. |
| Rate limits | MySQL-backed fixed-window counters (`rate_limits`), keyed by account, IP, code prefix or email, for redeem, sign-in challenges, resend cooldowns and recovery requests. Responses include the retry time. There is no Redis in the stack. |
| Server time | Every response includes `serverTime`, so the client can show countdowns without trusting its own clock. |
| Policies and help content | `policy_versions` (type, version, effective date, content) and `policy_acceptances` (account, policy version, time, context). Orders store the accepted versions. `help_articles` holds categories and search, edited by Super Admin. |
| Notifications | `read_at`, a category, mark-all-read, and `notification_preferences` that separate optional from essential messages. The commission-released email can be a daily digest. A "deadline approaching" reminder job is added. |
| Payout destinations | Verification status (pending, verified, failed), provider reference, account-name match, default flag, and removal only when unused. A change notifies the previous verified email and places a withdrawal hold. |
| Staff management | `staff_invitations`, `staff.last_active_at`, MFA status read from Keycloak, and a rule that the last active Super Admin cannot be disabled. |
| Seller customers (S08) | `seller_customer_refs`: an opaque reference per seller and account, with masked email, order count and last status. Account deletion anonymizes it. |
| Dashboards | Summary tables updated in the same transaction as their source events where cheap (daily sales per seller in Jakarta time), otherwise refreshed by a job. |
| Directory | `seller_profiles.city`, a name index, and a per-session random seed in the cursor for a stable rotated order. |
| Profile and application history | `seller_profile_revisions` (draft, pending, approved, rejected; the approved one is live), `application_evidence`, assigned reviewer, unique display name, and a reserved-name list. |
| Sale request timeline | `sale_request_events`. Statuses: Draft, Awaiting, Claimed, Expired, Revoked. A QR code is generated on the client from the link. |
| Support details | Severity, assignee separate from status, Waiting for Customer and Waiting for Nahj, Reopened. Ownership moves automatically when the seller is paused, suspended or overdue. A refund request opens a case. |
| Disputes | `dispute_evidence`, provider deadline, and a deadline-alert job. |
| Operations | `job_runs` (last success, backlog, failures) and `incidents`. A risk-review overdue alert job never auto-releases a hold. |
| Configuration | Draft, scheduled and published states with owner, reason and effective time on `config_versions`, plus a launch-readiness check. |
| Grant history and admin search | New `nahj_backend` endpoints: list grants for an account across sources, and find an account by email. Every lookup by email records its purpose in audit. |
| Account deletion | `nahj_backend` notifies the marketplace through an internal endpoint. The marketplace anonymizes customer references and support data and keeps financial records with a pseudonymous ID. |
| Receipts | A receipt is generated from the order snapshot and served as HTML or PDF. The collecting entity (PT Ryam Technology Solution) and its tax details come from market settings. |
| Withdrawal approval | Follows UX A11: every withdrawal enters a Finance queue, and Finance submits it. A second independent approver is required above a configured threshold. |
| Architecture inconsistencies | "Four things" becomes the full endpoint list. The marketplace does not read game tables, including `users`; the read-only shortcut is dropped because `users` has no email and the boundary stays clean. |

## 7. Database placement

**Decision: a separate schema on the same Cloud SQL server.** For example, `nahj_market`, with its own database user.

| Reason | Detail |
| --- | --- |
| Name clashes | The game schema already has `orders`, `items` and `user_subscription`. The marketplace needs `orders` too. |
| Safety | The marketplace user has no rights on game tables, so a bug or a leaked credential cannot change game data. This is the money system; its blast radius should be small. |
| Backups and restore | One schema can be restored or exported without touching the other, which Finance investigations and incidents need. |
| Migrations | Each project owns its own migration history with no ordering conflicts. |
| Cost | Same server, so there is no extra instance and no extra network hop. |
| Future | The schema can move to its own instance later without code changes. |

What this means for `script/db.sql`: it is the game schema (`nahj`) and stays a reference for the integration work. The new columns on its `orders` table (section 2.3 item 2) belong there, because `nahj_backend` owns them. All marketplace tables go into `backend/migrations/` of this project and are created in `nahj_market`.

## 8. Source documents

`docs/sourcec doc/` holds the original `.docx` and `.pdf`, including the UI images, and stays as it is. Markdown versions and `boards_images/` exist in `nahj_backend/feature/agent_marketing/Nahj_Markdown/`. When the repository is created, copy those into `docs/specs/` so the developers have the readable text and the images in one place.

## 9. Remaining open questions

1. ~~Refund windows~~: decided. 48 hours after activation for used subscriptions (configurable per plan); 30 days after payment for unused codes (configurable), with code commission released at redemption or period end (section 2.3 item 6).
2. ~~No-Ads rows in production~~: resolved, No-Ads is removed (section 2.3 item 9).
3. Which payment and payout providers? One provider that does both QRIS/VA pay-in and disbursement would reduce the integration work.
4. Commercial values: prices, commission rate, referral target and rate, withdrawal fee, validity periods, quantity cap.
5. Is the withdrawal fee returned to the seller when a payout comes back? (Section 5.3 assumes yes.)
6. Refund policy, seller verification documents, Terms and Privacy, tax treatment, V1 languages.

## 10. Later decisions that change the specification

| Date | Decision | Spec rule changed | Effect |
| --- | --- | --- | --- |
| 2026-10-23 | Fulfillment is instant at payment: direct units are activated and codes are published to the buyer automatically. | Dev Ref §5.1 (30-minute seller window, seller and worker share the command); UX seller fulfillment screens; T06–T08 | No deadline job, no deadline reminder, no seller Deliver/Activate step. Seller copy/share of codes is no longer a delivery step. The recovery job and Operations alert stay. Acceptance tests T06–T08 are rewritten for instant fulfillment. |
