# Testing

This document describes the test scenarios exercised, the edge cases considered, and current limitations. The project ships with a manual/curl-based verification flow (smoke-tested during development); automated test suites are listed under limitations.

---

## How to test locally

1. Start Postgres and run `npm run db:migrate:dev`.
2. `npm run dev` (or `npm run build && npm start`).
3. Use the curl commands in [README.md](README.md#api-usage-curl) or open Swagger at `/api/docs`.

A fast no-DB smoke check (server boot, envelopes, auth, 404, docs) can be run with dummy env vars:

```bash
DATABASE_URL="postgresql://u:p@localhost:5432/db" JWT_SECRET="x" PORT=3999 node dist/server.js &
curl -s localhost:3999/health                 # {"status":"UP"}
curl -s localhost:3999/api/evaluation         # candidate envelope
curl -s localhost:3999/api/meetings           # 401 UNAUTHORIZED
curl -s -X POST localhost:3999/api/auth/register -H 'Content-Type: application/json' -d '{"name":"x","email":"bad","password":"1"}'  # VALIDATION_ERROR
```

---

## Test scenarios

### Auth
- ✅ Register with valid input → 201, returns user + JWT.
- ✅ Register with short name / invalid email / short password → 400 `VALIDATION_ERROR` with per-field details.
- ✅ Register with an existing email → 409 `CONFLICT`.
- ✅ Login with correct credentials → 200 + JWT.
- ✅ Login with wrong password / unknown email → 401 `INVALID_CREDENTIALS` (same message — no user enumeration).

### Auth middleware
- ✅ Protected route with no header → 401 `UNAUTHORIZED`.
- ✅ Malformed header (no `Bearer `) → 401.
- ✅ Invalid/expired token → 401.
- ✅ Valid token → request proceeds, `req.user` populated.

### Meetings
- ✅ Create meeting with valid transcript → 201.
- ✅ Create with non-email participant / empty transcript / invalid date → 400.
- ✅ List meetings honors `?page` & `?limit`, returns pagination metadata.
- ✅ Get meeting by id (owned) → 200 with analysis + action items; unknown/other-user id → 404.
- ✅ Analyze meeting → 201, persists `MeetingAnalysis`, creates `PENDING` action items; re-running upserts (no duplicate analysis).

### Action items
- ✅ Create with valid email assignee and future due date → 201.
- ✅ Past due date → 400 (`dueDate must be in the future`).
- ✅ Linking a `meetingId` not owned by the user → 404.
- ✅ Filter by `status`, `assignee`, `meetingId`.
- ✅ Update status with valid enum → 200; invalid enum → 400; unknown id → 404.
- ✅ Overdue endpoint returns only non-completed items past due.

### System
- ✅ `/health` → `{ status: "UP" }`.
- ✅ `/api/evaluation` → candidate metadata.
- ✅ `/api/docs` serves Swagger UI; `/api/docs.json` serves the spec.

### Cross-cutting
- ✅ Every response includes a `traceId`; inbound `x-trace-id` is reused, otherwise generated.
- ✅ `x-trace-id` echoed in response headers and present in every log line.
- ✅ Errors follow the standard envelope; no stack traces leak in `NODE_ENV=production`.

### Reminders
- ✅ `runReminderSweep()` finds overdue items, sends email, writes `ReminderLog`.
- ✅ Items reminded successfully within the last 24h are skipped.
- ✅ Cron registered for `0 * * * *`; sweep is skipped with a warning when `RESEND_API_KEY` is unset.

---

## Edge cases considered

- Empty result sets (no meetings, no overdue items) return valid empty lists, not errors.
- Re-analysis overwrites the existing `MeetingAnalysis` via upsert instead of failing on the unique constraint.
- AI action items with blank assignee → stored as `"unassigned"`; unparseable due date → `null`.
- AI returns invalid JSON or off-schema output → request fails cleanly with a logged reason, nothing is persisted.
- Ownership scoping: meetings/action items are always filtered by `userId`, so users can't read or mutate others' data.
- Pagination guards: `limit` capped at 100, `page`/`limit` coerced and floored at 1.
- Email failure is recorded (`success: false`) rather than crashing the sweep; the next hourly run retries.
- Graceful shutdown on SIGINT/SIGTERM stops the cron and disconnects Prisma.

---

## Limitations

- **No automated test suite** (Jest/Vitest + Supertest) is included; verification is manual/curl + a boot smoke test. The layered `service`/`controller` split is structured to make adding unit/integration tests straightforward.
- **Citation substring verification** is not enforced (see [AI_APPROACH.md](AI_APPROACH.md)).
- **Live AI/email tests** require real `GROQ_API_KEY` / `RESEND_API_KEY` and are not mocked here.
- **Concurrency:** simultaneous `/analyze` calls on the same meeting both upsert; the last write wins (acceptable, but not serialized).
