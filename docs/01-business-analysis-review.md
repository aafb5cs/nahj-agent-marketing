# Nahj Seller Marketplace — Business Analysis Completeness Review

Reviewed on 2026-10-14. Sources, all in this folder:

- `Nahj_Final_Developer_Reference.md` (v2.0, read in full)
- `Nahj_28_Screen_Visual_Boards.md` (read in full)
- `Nahj_Complete_UX_Specification.md` (v2.0; sections 1–3 and 5–8 read in full, section 4 sampled: G01, G02, S01, S02, A15, A18, plus keyword searches across the rest)

The copies under `Nahj_Markdown/` are byte-identical to the three files above.

## 1. Verdict

**The business rules are complete enough to design the data model and core services. The analysis is not complete enough to start building screens, integrate a payment provider, or launch.**

The lifecycle and money rules are detailed and consistent across the two v2.0 documents. What is missing falls into five groups:

1. The two documents that describe the screens contradict each other on scope (28 screens versus about 100).
2. Several source documents that the specs rely on are not in this folder.
3. Every commercial value and every external provider is left as "configuration" with no actual value or choice.
4. The specs depend on "existing Nahj" entitlement rules that are neither written down here nor present in the current backend.
5. Some business topics are not covered at all (tax, language, launch scope).

Groups 1 and 4 block design work. Groups 2, 3 and 5 block launch but not the start of backend work.

## 2. What is complete

These areas are specified well enough to implement without further business input.

| Area | Where | Status |
| --- | --- | --- |
| Roles and what each may and may not do | Dev Ref §2 | Complete |
| Entities and their invariants | Dev Ref §3 | Complete |
| Order and payment lifecycle, including duplicate, late and mismatched payments | Dev Ref §4 | Complete |
| 30-minute fulfillment window and automatic completion | Dev Ref §5.1, UX §5.1 | Complete |
| Direct activation versus codes, bulk, replacement, copy/share | Dev Ref §5.2, UX §5.2–5.3 | Complete |
| Redeem flow and every error state, with copy | UX §6 | Complete |
| Commission calculation, 168-hour maturity, ledger buckets, seller debt | Dev Ref §6 | Complete (rates missing, see §5) |
| Withdrawal lifecycle | Dev Ref §6 | Complete (fee and methods missing) |
| Refund, partial refund and chargeback effects | Dev Ref §7 | Complete (eligibility policy missing) |
| Seller referral, monthly qualification and corrections | Dev Ref §8 | Complete (target and rate missing) |
| Support ownership and case states | Dev Ref §9, UX §5.5 | Complete |
| Notification events, channels and privacy rules | UX §5.4 | Complete |
| Audit requirements | Dev Ref §9 | Complete |
| Acceptance tests T01–T25 | Dev Ref §12 | Complete |
| Decisions D01–D10 | UX §1 | Final rule stated for each |

## 3. Conflicts between the documents

The boards document and the UX specification describe different products at the screen level. Neither says which one wins. The boards document has no version number; the UX specification calls itself the "approved build baseline".

| Topic | 28 Screen Boards | UX Specification v2.0 |
| --- | --- | --- |
| Screen count | 28 screens (U01–U28). "Tabs, dialogs and states do not add screens." | 102 concrete screens in the index (G, C, S, A, N families), each with its own route. |
| Admin navigation | 7 items: Home, Sellers, Orders, Customers, Payouts, Support, Settings. Audit, risk, ledger and reconciliation are "never extra screens". | Grouped sidebar with separate pages for payments, entitlements, codes, refunds, disputes, ledger, risk cases, staff and audit log (A06–A13, A19, A20). |
| Sign in | One screen with Sign In / Create Account tabs and Google. | Separate routes for customer, seller and admin sign in. |
| Seller "More" menu | Referrals, Support, Settings. | Customers, Referrals, Support, Notifications, Profile, Settings, Security. |
| Routes | `/p/NJH-…` for a sale request, `/join/AB12C` for referral, `/account` with a Subscription tab. | `/requests/:token`, `/subscription` and `/account` as separate pages. |
| Home hero text | "Learn with Nahj — A structured learning journey for young minds." | "More Arabic learning, with Nahj." |
| Code format | `NAHJ-7K2M-****-9D4F` and `NHJ-XXXX-XXXX` | Placeholder `NHJ-XXXX-XXXX-XXXX` |
| Order reference | `NHJ-2024-0012`, `NJH-241029-004`, `NHO-78421` | Not defined |

The boards mark their data as illustrative, so the differing prices and fees on them are not conflicts. The code and reference formats still need one decision.

**Decision needed:** which document defines the screen list for V1. The business rules are the same either way, so backend work is not affected; frontend scope differs by roughly a factor of three.

## 4. Source documents referenced but not in this folder

| Document | Referenced by | Why it matters |
| --- | --- | --- |
| Product Logic Review | Both v2.0 documents ("approved") | The reasoning behind D01–D10; only the one-line final rules are here. |
| The "brief" | UX A15 ("per brief") | Original business requirements. |
| Existing Nahj entitlement contract (duration, coverage, source overlap, offline grace) | D03, Dev Ref §5.3, UX §6.1 ("separately approved") | See §6 below. |
| Terms, Privacy Policy, Refund Policy, Seller Terms | UX G06, S01; Dev Ref §1 ("accepted policy versions") | Orders must record the accepted policy version; the refund policy defines eligibility. |
| Help Center articles | UX G06, boards U03 | Content for launch. |
| Ryam visual references, logos, design tokens | UX §2.4 | Needed for UI production. |

## 5. Values and choices left open

The specs deliberately say that these are "configuration, not decisions" and forbid using the sample numbers. Someone still has to supply each one before launch, and the first three before integration work can start.

| Item | What is stated | What is missing |
| --- | --- | --- |
| Payment provider | QRIS and virtual account, Indonesia | Which provider; its sandbox; whether it gives a trusted settlement timestamp (commission maturity depends on it). |
| Refund mechanism | "Provider policy determines supported refund mechanisms" | How money is returned for QRIS and VA payments, and to which destination, if the provider cannot refund to the source. |
| Payout provider | Bank account and e-wallet | Which provider; supported banks and e-wallets; limits; fee. |
| Plans | Monthly, Yearly, Lifetime | Actual prices, benefits, and what each plan unlocks in the app. |
| Commission | Price × seller rate, seller override first | Default rate. |
| Referral | One level, monthly target | Target amount and rate. |
| Withdrawal | Minimum Rp500,000 (fixed) | Fee, and who absorbs provider cost changes in practice. |
| Refund policy | Window and version are configurable | The window, and whether a used direct activation can be refunded. |
| Validity periods | Request, quote and payment-attempt expiry are separate | Each duration. |
| Quantity | Any quantity above 1 uses codes | Maximum quantity per order. |
| Seller verification | "Evidence upload appears only when requested" | Which documents are required, and when. |
| Support | "Configure actual response windows" | Response and escalation targets. |
| Reminder | "Deadline approaching" notice to seller | How long before the deadline. |
| Data retention | Mentioned as a setting | Retention periods. |

## 6. Dependency on existing Nahj rules that are not defined

Decision D03 and Dev Ref §5.3 say to reuse the "existing Nahj duration, calendar arithmetic, coverage, source-overlap and offline-grace behavior", and state that no new entitlement algorithm is authorized.

Findings in the current `nahj_backend` code:

- The words lifetime, coverage, grace and overlap do not appear anywhere in the Go source.
- Subscription state is one record per user with a single expiry date, an auto-renew flag and a store purchase token (`models/shop.go`, `UserSubscription`).
- The purchasable passes are `vip_pass` and `no_ads_pass`. The UX spec says not to show the old VIP or ad controls, and does not say what a web plan maps to.

So the contract the specs point to either lives outside this backend (for example in the mobile app) or has not been written. These questions need a business answer:

1. What does each web plan unlock, in terms of the app's existing passes?
2. What is "Lifetime" in the app today, and does it exist as a store product?
3. If a user with an active store subscription buys or redeems a prepaid plan, how is the time combined?
4. What is "coverage", and can two plans have different coverage in V1?
5. How long does the app keep access offline after a grant is revoked?

Refunds and chargebacks require revoking one purchase while keeping the others, which the single-expiry record cannot represent. This is the largest technical consequence of the gap.

## 7. Topics not covered

Not found in the documents; some may be answered in the missing sources.

| Topic | Gap |
| --- | --- |
| Language | All copy is English. The market is Indonesia, and the existing app supports English, Arabic and Indonesian. No statement on whether V1 ships in Indonesian. |
| Tax | Withholding on seller commission is "Finance-configured; do not invent it". Nothing on VAT for the customer price or on tax invoices. Receipts are specified; invoices are not. |
| Launch scope | Everything is V1 in one release. No priority order, no minimum launch set, no timeline. |
| Business goals and volumes | No targets, expected seller or order counts, or success measures. |
| Seller exit | No rule for a seller who leaves or is permanently suspended with a balance below the withdrawal minimum. |
| Reporting | Daily reconciliation is specified. Business reports for management (sales, sellers, revenue) are not. |
| Existing accounts | The app has anonymous accounts and Google and Apple linking. Guests cannot redeem (stated). Which sign-in providers the web offers is "as configured". |
| Store policy | Android gets a redeem screen; iOS gets none. The specs defer to the "established mobile distribution review process"; no owner or outcome is recorded. |
| Staff provisioning | Staff have no public registration. Who creates the first Super Admin, and how staff are onboarded, is not described. |

## 8. Questions for the product owner

In priority order. Items 1–3 block design; the rest block integration or launch.

1. Which screen set is V1: the 28 boards or the 102-screen specification?
2. Can you provide the Product Logic Review, the brief, and the existing entitlement contract?
3. What does each plan unlock in the app, and how does prepaid time combine with a store subscription? (§6)
4. Which payment provider and which payout provider?
5. How are QRIS and VA payments refunded?
6. What are the prices, default commission rate, referral target and rate, and withdrawal fee?
7. What is the refund policy (window, used activations)?
8. Does V1 need Indonesian, and Arabic?
9. What are the tax rules for customer prices and seller commissions?
10. Which documents must a seller provide to be approved?
11. Is there a minimum launch set, or must all of V1 ship together?
12. Who owns the app store policy review for Android redeem?
