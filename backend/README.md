# Nahj Seller Marketplace: backend

Go service for the marketplace at `https://nahj.ryam.app`. Design: `../docs/system-architecture.md`, tables: `../docs/database-tables.html`.

This is **build step 1, Foundation**: project skeleton, migrations, sign-in and sessions, staff capabilities, idempotency, audit, rate limits, and the jobs worker. Feature modules (catalog, sellers, sales, payments…) attach to the route groups in `internal/api`.

## Commands

One binary, three commands:

```bash
go run ./cmd/server migrate   # apply migrations in ./migrations, then exit
go run ./cmd/server api       # HTTP API on MK_HTTP_ADDR
go run ./cmd/server worker    # background jobs and scheduler
```

Configuration comes from environment variables only (see `.env.example`). Secrets are never committed.

## Tests

Integration tests run against a real MySQL. Each test creates its own schema `mkt_<random>`, migrates it and drops it.

```bash
MK_TEST_MYSQL_DSN='root:root@tcp(127.0.0.1:3306)/' go test ./...
```

Without `MK_TEST_MYSQL_DSN` the database tests are skipped.

## Layout

```
cmd/server/            main: api | worker | migrate
migrations/            NNNN_name.sql, embedded in the binary
internal/platform/     config, clock, db (transactions, migrator), ids, httpx, logging
internal/identity/     Keycloak web login, sessions, bearer tokens, staff capabilities, CSRF, step-up
internal/idempotency/  Idempotency-Key handling and GET /operations/{key}
internal/audit/        append-only audit writer with redaction
internal/ratelimit/    MySQL-backed fixed-window limiter
internal/ops/          jobs table: outbox, scheduler, worker
internal/api/          route wiring and groups for feature modules
internal/testutil/     test database and test tokens
```

## Conventions

- **Dependencies are passed in.** No package-level globals; tests build everything with a fake clock and a real database.
- **One use case = one transaction.** Use `db.WithTx`; enqueue outbox jobs with `ops.Enqueue(ctx, tx, …)` and write audit with `audit.Writer.Record(ctx, tx, …)` inside the same transaction.
- **Times** are UTC (`clock.Clock`), stored as `DATETIME(3)`. The connection forces `time_zone = '+00:00'`.
- **Responses** are `{"data": …, "serverTime": …}`; errors are `{"error": {"code", "message", "reference"}, "serverTime"}` with stable codes from `httpx`.
- **State-changing routes** in the `Me`, `Seller` and `Admin` groups automatically require CSRF (for cookie sessions) and an `Idempotency-Key`.
- **Staff routes** check capabilities per route with `identity.RequireCapability("finance.refund.approve")`. Capabilities are read on every request, so disabling staff takes effect at once.

## API so far

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/healthz` | Database ping and job queue counts |
| GET | `/api/v1/auth/login?return=/path` | Redirects to Keycloak (`&stepup=1` forces a fresh login with TOTP) |
| GET | `/api/v1/auth/callback` | Keycloak redirect target; sets the `nm_session` cookie |
| GET | `/api/v1/auth/session` | Current caller, staff capabilities and the CSRF token |
| POST | `/api/v1/auth/logout` | Ends the session |
| GET | `/api/v1/operations/{key}` | Stored outcome of one of your idempotent requests |
