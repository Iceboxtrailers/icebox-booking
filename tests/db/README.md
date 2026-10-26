# Database tests

Tests that run the app's real queries, transactions and row locks against a real Postgres. The unit tests
(`npm test`, in `src/`) need no database; these do, and CI runs both.

## Run them

Start any local Postgres with an empty database whose name contains `test`, then:

```bash
docker run --rm -d --name icebox-test-db -p 54329:5432 -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=icebox_test postgres:17
TEST_DATABASE_URL=postgresql://ci:ci@localhost:54329/icebox_test npm run test:db
```

(PowerShell: `$env:TEST_DATABASE_URL = "postgresql://ci:ci@localhost:54329/icebox_test"; npm run test:db`.)
`npm run test:db` applies the migrations (`prisma migrate deploy`), then runs `tests/db/**/*.test.ts` one file
at a time. To run a single file, apply the migrations once, then
`TEST_DATABASE_URL=… npx tsx --test tests/db/confirm-reservation.test.ts`.

## Safety

These tests **empty every table** before each test. Three checks keep them away from anything real: the runner
refuses a `TEST_DATABASE_URL` that is not on `localhost`, `harness.ts` refuses a database whose name does not
contain `test` (or is not `ci`), and the network is replaced by a fake mail service (nothing leaves the machine).
Never point `TEST_DATABASE_URL` at the production database (`.env.local` points there).

## How it works

- `env.ts` is loaded first. The app reaches Neon over WebSockets, which a plain Postgres does not speak, so a
  small proxy in the test process (`ws-proxy.ts`) turns each WebSocket back into a TCP connection (what Neon's
  own `wsproxy` does). The code under test is the real code, unchanged.
- `harness.ts` exports `setupDatabase()` (empty tables before each test, clean exit after), the fake mail service
  (`mail`) and row builders (`makeClient`, `makeTrailer`, `makeBooking`). Import it before any `@/lib` module.
- Dates in fixtures are far in the future (2099) so the tests never expire; tests about "now" freeze the clock
  with `mock.timers.enable({ apis: ["Date"] })`.
- A test that needs another service answers it itself by wrapping `globalThis.fetch` (see `quickbooks.test.ts`,
  which plays Intuit) and restores it afterwards.

## Try a screen on the test database

To click through the app itself without touching the real data (`.env.local` points to it), leave the proxy
running and start the app against the test database. `NEON_LOCAL_WS_PROXY` is only read outside Vercel.

```bash
TEST_DATABASE_URL=postgresql://ci:ci@localhost:54329/icebox_test npx tsx tests/db/serve.ts
# in another terminal; the empty variables keep Stripe and the file store out of it
DATABASE_URL=postgresql://ci:ci@localhost:54329/icebox_test NEON_LOCAL_WS_PROXY=127.0.0.1:54330/v1 STORAGE_PROVIDER=local BLOB_READ_WRITE_TOKEN= STRIPE_SECRET_KEY= NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= npm run dev
```

The database is empty after a test run: create an owner (`AdminUser` with a bcrypt `passwordHash`) and the trailers
you need, then sign in at `/admin/login`.

## What is covered

| File | What it protects |
| --- | --- |
| `confirm-reservation.test.ts` | the first client to finish gets the trailer (8 at once, several rounds), double clicks, touching dates, refusals |
| `availability.test.ts` | which bookings block a trailer, end-exclusive dates, flexible windows, the trailer lock |
| `rate-limit.test.ts` | counters under simultaneous requests, windows, sweeping, fail-open |
| `audit-journal.test.ts` | paging without repeats or gaps, topic filters, names, the count of problems |
| `traffic-report.test.ts` | visits, funnel and breakdowns computed by SQL; the conversion rate |
| `confirmation-email.test.ts` | what the e-mail claims, attachment, failure records, the "last send failed" banner |
| `start-reservation.test.ts` | resuming an unfinished booking, the daily cap |
| `clients.test.ts` | one account per e-mail, guests may share one, the partial index stays |
| `contract-delivery.test.ts` | the contract carries the delivery set on the booking; an unsigned contract is made again when the terms change, a signed one never |
| `quickbooks.test.ts` | the invoice lines (rental + transport) sent to a fake Intuit, links forgotten when the company changes, what the reservation sheet says |

When you change one of those behaviours, change its test too. When you add a query that is more than a plain
`findMany`, add a test here. A good test fails when the code is broken on purpose (remove the `FOR UPDATE` in
`withTrailerLock` and the race test fails with "8 clients got the same trailer").
