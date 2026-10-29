# Nahj Seller Marketplace: web app

React + TypeScript + Vite. One app with three areas, following the 28 screen boards:

| Area | Path | Screens |
| --- | --- | --- |
| Customer website | `/` | U01 Home, U02 Sign in, U03 Help, U04 Find a Seller, U05 Seller Profile, U06 Buy, U07 My Purchases, U08 Purchase Details, U09 My Account, U10 Support, U27 Redeem |
| Seller app (mobile first) | `/seller` | U11 Apply, U12 Home, U13 Create Sale, U14 Orders, U15 Order, U16 Wallet, U17 Referrals, U18 Settings (incl. agent code), U19 Support |
| Admin workspace | `/admin` | U20 Home, U21 Sellers, U22 Orders, U23 Customers, U24 Payouts, U25 Support, U26 Settings |

Screens follow the later team decisions, not the original boards where they differ: instant fulfillment at payment (no 30-minute timer, no seller Activate/Deliver step), five VIP passes, sellers see code counts only, agent codes for app-store sales.

## Run

The Go API serves the built app on **http://localhost:8090**, the address registered in Keycloak:

```bash
npm install
npm run build                      # writes dist/
cd ../backend && go run ./cmd/server api
```

For live reload while editing, run `npm run dev` (http://localhost:5173); it forwards `/api` to the API on :8090. Sign-in always returns to :8090, because that is the registered redirect.

## What is real

- **Real:** sign-in and sign-out through Keycloak (needs `MK_OIDC_CLIENT_SECRET` in `backend/.env`), the session, CSRF token and idempotency keys on every change (`src/lib/api.ts`).
- **Sample:** everything marked with a yellow "Sample data · step N" badge. Those screens switch to the real API as each build step is done.
