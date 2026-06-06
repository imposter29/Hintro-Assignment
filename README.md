# Meeting Intelligence Service

A backend API that ingests meeting transcripts and uses an LLM (Groq · `llama-3.3-70b-versatile`) to produce **cited** summaries, action items, decisions, and follow-up suggestions. It tracks action items, detects overdue ones, and sends hourly email reminders via Resend.

## Features

- **JWT authentication** — register / login, bcrypt-hashed passwords
- **Meeting management** — create, list (paginated), fetch single meeting
- **AI analysis with citations** — every insight is grounded in a transcript timestamp + speaker + verbatim quote
- **Action item management** — create, filter, update status
- **Overdue detection** — items past due and not completed
- **Scheduled reminders** — hourly `node-cron` sweep, 24h de-duplication
- **Email integration** — Resend
- **Structured JSON logging** with per-request trace IDs
- **OpenAPI / Swagger docs** at `/api/docs`

## Tech Stack

Node.js · TypeScript · Express · PostgreSQL · Prisma · JWT · Groq SDK · node-cron · Resend · Zod · swagger-ui-express

---

## Prerequisites

- Node.js ≥ 18 (tested on 22)
- PostgreSQL ≥ 14 (local or hosted)
- A [Groq API key](https://console.groq.com/keys)
- A [Resend API key](https://resend.com/api-keys)

---

## Installation

```bash
git clone https://github.com/imposter29/Hintro-Assignment.git
cd Hintro-Assignment
npm install            # also runs `prisma generate` via postinstall
cp .env.example .env   # then fill in the values
```

---

## Environment Variables

| Variable            | Required | Description                                              | Example                                            |
| ------------------- | -------- | -------------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`      | ✅       | Runtime connection (Prisma pg driver adapter). Supabase: transaction pooler, port 6543 | `postgresql://user:pass@host:6543/postgres?pgbouncer=true` |
| `DIRECT_URL`        | ✅       | Migration connection used by the Prisma CLI (see `prisma.config.ts`). Supabase: session pooler, port 5432 | `postgresql://user:pass@host:5432/postgres` |
| `JWT_SECRET`        | ✅       | Secret used to sign JWTs                                 | `a-long-random-string`                             |
| `JWT_EXPIRES_IN`    | ⬜       | Token lifetime (default `7d`)                            | `7d`                                               |
| `GROQ_API_KEY`      | ⬜\*     | Groq API key (required to run `/analyze`)                | `gsk_...`                                          |
| `RESEND_API_KEY`    | ⬜\*     | Resend API key (required for reminder emails)            | `re_...`                                           |
| `RESEND_FROM_EMAIL` | ⬜       | Verified sender (default `onboarding@resend.dev`)        | `reminders@yourdomain.com`                         |
| `PORT`              | ⬜       | HTTP port (default `3000`)                               | `3000`                                             |
| `NODE_ENV`          | ⬜       | `development` / `production`                             | `development`                                      |

\* The server boots without `GROQ_API_KEY` / `RESEND_API_KEY`, but the AI and reminder features are disabled until they are set.

---

## Run Locally

```bash
# 1. Apply database migrations
npm run db:migrate:dev      # creates tables from prisma/migrations

# 2. Generate the Prisma client (also runs on install)
npm run db:generate

# 3. Start in watch mode
npm run dev

# OR build + run production
npm run build
npm start
```

The API is now at `http://localhost:3000`. Open the docs at **`http://localhost:3000/api/docs`**.

### npm scripts

| Script                  | Action                                       |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | Start with hot-reload (ts-node-dev)          |
| `npm run build`         | Compile TypeScript to `dist/`                |
| `npm start`             | Run compiled server                          |
| `npm run db:migrate`    | Apply migrations in production (`deploy`)    |
| `npm run db:migrate:dev`| Create/apply a dev migration                 |
| `npm run db:generate`   | Regenerate Prisma client                     |

---

## API Usage (curl)

> Every response is wrapped in `{ traceId, success, data }` or `{ traceId, success, error }`.

### Register

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"secret123"}'
```

### Login (returns a JWT)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"secret123"}'
```

Save the token:

```bash
TOKEN="<paste token from login response>"
```

### Create a meeting

```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Q3 Planning",
    "participants": ["jane@example.com", "john@example.com"],
    "meetingDate": "2026-06-01T10:00:00Z",
    "transcript": [
      { "timestamp": "00:01", "speaker": "Jane", "text": "Let'\''s ship the API by Friday." },
      { "timestamp": "00:02", "speaker": "John", "text": "I'\''ll own the deployment." }
    ]
  }'
```

### List meetings (paginated)

```bash
curl "http://localhost:3000/api/meetings?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Get a single meeting

```bash
curl http://localhost:3000/api/meetings/<MEETING_ID> \
  -H "Authorization: Bearer $TOKEN"
```

### Analyze a meeting (AI)

```bash
curl -X POST http://localhost:3000/api/meetings/<MEETING_ID>/analyze \
  -H "Authorization: Bearer $TOKEN"
```

### Create an action item

```bash
curl -X POST http://localhost:3000/api/action-items \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Deploy API",
    "assignee": "john@example.com",
    "dueDate": "2026-12-31T17:00:00Z"
  }'
```

### List / filter action items

```bash
curl "http://localhost:3000/api/action-items?status=PENDING&assignee=john@example.com" \
  -H "Authorization: Bearer $TOKEN"
```

### Update action item status

```bash
curl -X PATCH http://localhost:3000/api/action-items/<ID>/status \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"IN_PROGRESS"}'
```

### Get overdue items

```bash
curl http://localhost:3000/api/action-items/overdue \
  -H "Authorization: Bearer $TOKEN"
```

### Health / Evaluation

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/evaluation
```

---

## Getting the API Keys

### Groq

1. Sign in at <https://console.groq.com>.
2. Go to **API Keys** → **Create API Key**.
3. Copy the `gsk_...` value into `GROQ_API_KEY`.
4. The service uses the `llama-3.3-70b-versatile` model — no extra setup needed.

### Resend

1. Sign up at <https://resend.com>.
2. Go to **API Keys** → **Create API Key** and copy the `re_...` value into `RESEND_API_KEY`.
3. For development you can send from `onboarding@resend.dev` (Resend's shared test domain) — set `RESEND_FROM_EMAIL=onboarding@resend.dev`. With the test domain, Resend only delivers to the email address you signed up with.
4. For production, verify your own domain under **Domains** and set `RESEND_FROM_EMAIL=reminders@yourdomain.com`.

---

## Deployment (Railway)

1. **Create a project** at <https://railway.app> → *New Project* → *Deploy from GitHub repo* → select this repo.
2. **Add PostgreSQL**: *New* → *Database* → *Add PostgreSQL*. Railway exposes a `DATABASE_URL` variable.
3. **Set environment variables** on the service (Variables tab):
   - `DATABASE_URL` and `DIRECT_URL` → your Postgres connection strings (for Railway's own Postgres plugin both can be `${{Postgres.DATABASE_URL}}`; for Supabase use the transaction pooler for `DATABASE_URL` and the session pooler for `DIRECT_URL`)
   - `JWT_SECRET`, `JWT_EXPIRES_IN`, `GROQ_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NODE_ENV=production`
   - `PORT` is provided automatically by Railway.
4. **Build & start** are defined in `railway.json` / `package.json`:
   - Build: `npm install && npm run build`
   - Start: `npm run db:migrate && npm start` (runs migrations on boot, then serves)
5. Deploy. Once live, verify `https://<your-app>.up.railway.app/health` returns `{ "status": "UP" }` and open `/api/docs`.

> See [DECISIONS.md](DECISIONS.md), [AI_APPROACH.md](AI_APPROACH.md), [TESTING.md](TESTING.md), [CHANGELOG.md](CHANGELOG.md), and [CHECKLIST.md](CHECKLIST.md) for design rationale and verification details.
