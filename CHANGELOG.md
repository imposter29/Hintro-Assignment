# Changelog

All notable implementation milestones for the Meeting Intelligence Service.

## [1.0.0] — 2026-06-07

### Project scaffolding
- Initialized TypeScript + Express project, `tsconfig.json`, npm scripts (`dev`, `build`, `start`, `db:migrate`, `db:generate`).
- Added `.env.example`, `.gitignore`, and `railway.json` for deployment.

### Database
- Authored Prisma schema: `User`, `Meeting`, `MeetingAnalysis`, `ActionItem` (with `ActionItemStatus` enum), `ReminderLog`.
- Added initial SQL migration and `migration_lock.toml`.

### Core infrastructure
- Structured JSON logger (`lib/logger.ts`) with timestamp, traceId, level, request fields.
- Trace-ID middleware: reuse/generate `x-trace-id`, attach to request/response/logs, log request lifecycle + timing.
- Standard response envelope helpers and `AppError` (`lib/http.ts`).
- Global error handler: ZodError → `VALIDATION_ERROR`, Prisma `P2002`/`P2025`, JWT errors, safe production fallback. 404 handler.
- Async handler wrapper; Zod `validate(schema, target)` middleware.
- Shared Prisma client singleton.

### Auth
- Register/login with bcrypt hashing and JWT issuance; auth middleware verifying `Bearer` tokens.

### Meetings
- Create / list (paginated) / get-by-id endpoints, all user-scoped.
- `POST /:id/analyze` — Groq analysis persisted via transactional upsert; derived `PENDING` action items created with citations.

### AI
- `lib/groq.ts`: `llama-3.3-70b-versatile`, JSON mode, transcript-only cited prompt, Zod validation of model output.

### Action items
- Create / list-with-filters / update-status / overdue endpoints.
- Overdue detection: `status != COMPLETED AND dueDate < now`.

### Reminders
- `reminder.service.ts`: hourly sweep, Resend email, `ReminderLog` write, 24h dedupe.
- `reminder.scheduler.ts`: `node-cron` `0 * * * *`, skips when Resend unconfigured.

### External integration
- `lib/mailer.ts`: Resend `sendReminderEmail(to, item)` returning `{ success, messageId, error }`.

### API surface & docs
- CORS (`*`), `/health`, `/api/evaluation`, Swagger UI at `/api/docs` (+ `/api/docs.json`).
- Graceful shutdown (SIGINT/SIGTERM).

### Documentation
- README, DECISIONS, AI_APPROACH, TESTING, CHANGELOG, CHECKLIST.

### Verification
- `npm run build` passes with no type errors.
- Boot smoke test confirms health, envelopes, auth rejection, 404, validation errors, and Swagger spec.
