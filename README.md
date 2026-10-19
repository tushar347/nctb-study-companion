# NCTB Study Companion

A Next.js study companion prototype for NCTB English for Today. Students can read OCR-backed textbook pages, request learning support, practice with quizzes and language activities, and track rewards and progress.

## Current capabilities

- Student sign-up, login, and database-backed sessions.
- Class 6 and Class 7 English OCR page retrieval and reading tools.
- AI study help, quizzes, and matching activities grounded in locally available OCR text where supported.
- Server-side quiz answer storage, scoring, and attempt history.
- Spelling, speaking, read-aloud, study tracking, and rewards features.
- Local AI and Gemini integrations, subject to their required configuration.

This is an evolving course/research prototype, not a production-readiness, security, accessibility, or textbook-content certification. OCR retrieval checks that selected text matches locally stored page content; it does not independently verify the source edition or OCR accuracy.

## Requirements

- Node.js and npm (the current development environment uses Node.js 24).
- SQLite for local development.
- A Gemini API key only if you want to use Gemini-backed features.

## Run locally (PowerShell)

```powershell
npm install
$env:DATABASE_URL = "file:./dev.db"
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite URL is relative to the Prisma schema directory and uses `prisma/dev.db`.

Set `DATABASE_URL` in the same PowerShell session before running Prisma commands or the app. Do not replace or commit an existing `.env` file or database URL as part of local setup. The committed migrations create and update the local schema; back up any existing database before applying new migrations.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Enables Gemini-backed generation and study help. |
| `GEMINI_MODEL` | Overrides the Gemini model; defaults are selected by the application. |
| `AI_CREDITS_ENABLED` | Enables wallet-credit deductions when set to `true`; request limits still apply independently. |

For tests and checks:

```powershell
npm test
npx tsc --noEmit
npm run lint
```

The current full lint baseline has existing UI hook/effect findings; see [docs/IMPLEMENTATION_PROGRESS.md](./docs/IMPLEMENTATION_PROGRESS.md) for the latest verification results and outstanding work.

## Database and deployment status

The checked-in Prisma schema and migrations target **SQLite for local development**. A PostgreSQL `DATABASE_URL` is not compatible with this schema. SQLite files on Vercel's serverless runtime are not a durable shared production database, so this configuration is **not ready for a persistent Vercel deployment**. Do not point a Vercel PostgreSQL URL at this SQLite Prisma client. Before deploying database-backed features, choose and configure a persistent production database, migrate the Prisma provider and migration history for that database, and validate the deployment environment.

Never commit `.env` files, API keys, local database files, or database backups.

## Project documentation

- [Engineering audit](./docs/ENGINEERING_AUDIT.md) — evidence and known limitations.
- [Implementation progress](./docs/IMPLEMENTATION_PROGRESS.md) — completed work, verification, and follow-up items.
