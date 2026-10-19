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
- PostgreSQL for local development and deployment.
- A Gemini API key only if you want to use Gemini-backed features.

## Run locally (PowerShell)

```powershell
npm install
npx prisma migrate deploy
npm run dev
```

Set `DATABASE_URL` to a PostgreSQL connection string in your local environment before running Prisma commands or the app. Open [http://localhost:3000](http://localhost:3000) after starting the dev server.

The active Prisma schema and migrations target PostgreSQL. The previous SQLite migration history is retained under `prisma/migrations_sqlite_legacy` for reference and is not used by the app.

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

## Database and deployment

The application uses PostgreSQL, including for persistent Vercel deployments. Set `DATABASE_URL` in the Vercel project environment. Vercel runs `prisma migrate deploy` through the `vercel-build` script before building the app.

The PostgreSQL baseline migration describes the existing database schema before database-backed sessions were added. On that existing database, the baseline is recorded as applied and the additive session migration creates `StudentSession` and `QuizSession` without replacing existing tables or records. For an existing database that has the same pre-session schema but has not been baselined, mark `20261020010000_postgresql_baseline` as applied before running `prisma migrate deploy`. For a new empty database, run `npx prisma migrate deploy` to create the complete schema.

Never commit `.env` files, API keys, local database files, or database backups.

## Project documentation

- [Engineering audit](./docs/ENGINEERING_AUDIT.md) — evidence and known limitations.
- [Implementation progress](./docs/IMPLEMENTATION_PROGRESS.md) — completed work, verification, and follow-up items.
