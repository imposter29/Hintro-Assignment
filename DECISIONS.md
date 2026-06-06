# Architecture & Technology Decisions

This document records the key technology choices, the reasoning behind them, and the trade-offs accepted.

---

## 1. Database — PostgreSQL + Prisma ORM

**Decision:** PostgreSQL as the datastore, accessed through Prisma.

**Why:**
- The domain is relational (users → meetings → analyses/action items → reminder logs) with clear foreign keys, so a relational DB is the natural fit.
- PostgreSQL natively supports `String[]` (participants) and `JSONB` (transcript, citations, AI output), which lets us store semi-structured AI results without a second datastore.
- Prisma gives a type-safe client generated from a single schema, first-class migrations, and readable query code — which speeds development and reduces runtime errors.

**Prisma 7 specifics:** This project runs Prisma 7, which moves the connection URL out of `schema.prisma`:
- The runtime connection is provided by a **driver adapter** (`@prisma/adapter-pg` over `pg`), constructed in `src/lib/prisma.ts` from `DATABASE_URL`.
- The CLI (migrate/studio) reads its connection from `prisma.config.ts`, which uses `DIRECT_URL`.
- This split lets the app use a pooled (transaction-mode) connection while migrations use a direct (session-mode) connection — important for Supabase, whose direct host is IPv6-only and whose transaction pooler can't run migrations.

**Trade-offs:**
- Prisma adds a build step (`prisma generate`) and a cold-start cost.
- Prisma 7's adapter model adds two extra dependencies (`pg`, `@prisma/adapter-pg`) and a config file, in exchange for explicit, environment-appropriate connections.
- Storing AI output as `JSONB` means those fields aren't strongly typed at the DB layer — we compensate by validating with Zod before persisting.
- An ORM hides SQL; for very complex queries you may need raw SQL (`$queryRaw`), which we didn't need here.

---

## 2. Authentication — JWT

**Decision:** Stateless JWTs (`jsonwebtoken`), passwords hashed with `bcryptjs`.

**Why:**
- Stateless tokens require no session store, which keeps the service horizontally scalable and simple to deploy on Railway.
- Bearer tokens are trivial for API clients and Swagger to use.
- bcrypt is a battle-tested adaptive password hash.

**Trade-offs:**
- JWTs can't be revoked before expiry without extra infrastructure (a denylist). We accept this and keep a moderate `7d` expiry.
- The secret must be protected — it's read from `JWT_SECRET` and never logged.

---

## 3. AI Provider — Groq (`llama-3.3-70b-versatile`)

**Decision:** Groq's hosted Llama 3.3 70B with JSON mode.

**Why:**
- Groq's inference is extremely fast and low-latency, which matters for a synchronous `/analyze` endpoint.
- `llama-3.3-70b-versatile` is capable enough for structured extraction and summarization.
- The SDK supports `response_format: { type: "json_object" }`, which forces syntactically valid JSON and dramatically reduces parsing failures.

**Trade-offs:**
- JSON mode guarantees valid JSON but not a valid *schema* — so we validate the parsed output with Zod and reject/raise on mismatch.
- Hosted model = network dependency and rate limits; `/analyze` is synchronous, so very long transcripts could be slow. A queue/worker could be added later.

---

## 4. External Integration — Resend (email)

**Decision:** Resend SDK for transactional reminder emails.

**Why:**
- Simple, modern API with an official SDK and a shared test domain (`onboarding@resend.dev`) that needs zero DNS setup for development.
- Clean separation: `lib/mailer.ts` returns `{ success, messageId, error }` so the scheduler can log every attempt without try/catch sprawl.

**Trade-offs:**
- The test domain only delivers to the account owner's address — production requires domain verification.
- Email is fire-and-forget; we record success/failure in `ReminderLog` but don't implement retry/backoff (the hourly sweep naturally retries next hour, bounded by the 24h dedupe window).

---

## 5. Validation — Zod

**Decision:** Zod schemas validated by a reusable `validate(schema, target)` middleware.

**Why:**
- Single source of truth: each schema both validates input and infers the TypeScript type (`z.infer`), eliminating drift between types and runtime checks.
- `ZodError` is caught centrally in the error handler and rendered as the required `VALIDATION_ERROR` shape with per-field `details`.
- `z.coerce.date()` / `z.coerce.number()` cleanly handle query-string and JSON date coercion.

**Trade-offs:**
- Validation runs at the edge of every request (small overhead), which is an acceptable cost for safety.
- We also re-validate the AI's output with Zod — duplicating some shape definitions between `lib/groq.ts` and the request schemas — but this is deliberate: the two boundaries (client input vs. model output) have different rules.

---

## Cross-cutting decisions

- **Layered modules** (`routes → controller → service`) keep HTTP concerns out of business logic and make services unit-testable.
- **Trace IDs** on every request/response/log line make debugging across the async reminder flow tractable.
- **Standard response envelope** (`{ traceId, success, data | error }`) gives clients one predictable contract.
- **Graceful degradation:** the server boots without `GROQ_API_KEY`/`RESEND_API_KEY` so reviewers can explore auth/CRUD without every key configured; those features fail clearly when invoked without keys.
