# Engineering Audit

**Audit status:** Initial, evidence-based pass; not a complete review of every route or source file.  
**Workspace:** `tushar347/nctb-study-companion`, local repair branch based on `main`
**Local database target:** SQLite, selected by the user on 2026-10-19. The configured PostgreSQL URL was not changed or disclosed.

## Verified stack and layout

- Next.js 16.4.2, React/React DOM 19.2.7, TypeScript 6.0.3, Prisma 6.19.3, Node.js 24.15.0 (versions recorded from the current lockfile/environment).
- App Router application under `app/`, with 44 API route handlers and client/server UI under `components/`.
- Prisma schema declares SQLite. The repository has a SQLite `prisma/dev.db`; the `.env` `DATABASE_URL` scheme is PostgreSQL. Prisma commands in this audit used a process-local `file:./dev.db` override and did not edit `.env`.
- Migration lock declares SQLite. The local database has all ten migrations applied, including the SQLite DateTime repair migration. A verified backup was created before the repair.
- The PostgreSQL URL in the existing `.env` remains unchanged and is incompatible with the checked-in SQLite Prisma provider. SQLite files are suitable for local development, not durable Vercel serverless persistence.
- `data/lesson1.ts` describes its passage as a course-demo sample. `lib/book/class6Lessons.ts` lists 33 lesson/page ranges, but this is not evidence that each lesson has a verified question bank.
- `research/` contains existing OCR, annotation, and evaluation materials. Their provenance and review status have not yet been audited; they are not treated here as verified research results.

## Findings

### A-01 — Student identity was trusted from cookie presence, with a shared demo fallback

- **Severity:** HIGH
- **Evidence:** `middleware.ts` allowed protected pages whenever `nctb_student_key` existed. `lib/auth.ts` previously returned the cookie value directly and substituted `demo-student` when absent. Login/signup used the student key itself as the cookie value. Reward and practice handlers also accepted caller-supplied student keys or fell back to the shared demo account.
- **Root cause:** The cookie represented an account identifier rather than a session credential, and the server-side helper did not validate a persisted session.
- **Impact:** A forged or guessed identifier could be used to select another student's data in API handlers that rely on the helper. Missing credentials could silently resolve to a shared identity.
- **Correction made:** Added a database-backed `StudentSession`; login/signup issue random opaque tokens and persist only SHA-256 token hashes; the helper now validates token existence and expiry and returns no identity for missing/invalid sessions. Session cookie remains HttpOnly, SameSite=Lax, Secure in production, and has a 30-day expiry. Added 401 checks to quiz submission, study tracking, student/research summary, game, reward, OCR helper, spelling, speaking, and read-aloud handlers. Reward/practice handlers no longer resolve identity from body/query student keys.
- **Remaining work:** Middleware still makes a cookie-presence-only decision for page redirection (not an authorization boundary). Audit every other private API for equivalent session enforcement. Authenticated-session integration tests remain outstanding.
- **Verification:** Prisma client generation, schema validation using the SQLite URL, TypeScript check, production build, and ten unit tests passed. Session token helpers have unit coverage; database-backed auth integration tests remain outstanding.

### A-02 — Prisma schema omitted models used by current application code

- **Severity:** HIGH
- **Evidence:** A TypeScript check against the checked-in schema failed for `SpeakingAttempt`, `SpellingAttempt`, reward inventory, and goal-progress delegates/fields. Corresponding migrations and application code exist, but the models/fields were absent from `prisma/schema.prisma`.
- **Root cause:** Schema and application/migration history had drifted.
- **Impact:** Type errors blocked type-check/build validation and the affected practice/reward features could not be represented by the generated Prisma client.
- **Correction made:** Added the models/relations/fields represented by those migrations, including idempotency fields on `RewardTransaction`; regenerated the Prisma client.
- **Remaining work:** Add database-backed integration tests for the affected feature models. All ten migrations apply on disposable SQLite, and the DateTime repair was applied to the local database after a verified backup.
- **Verification:** `npx prisma validate`, `npx tsc --noEmit`, and `npm run build` passed with a process-local SQLite URL.

### A-03 — Database configuration and migration history are inconsistent

- **Severity:** HIGH
- **Evidence:** Prisma schema and migration lock say SQLite; configured `.env` URL uses PostgreSQL; local `prisma/dev.db` exists. A plain `npx prisma validate` fails because the configured URL does not match the declared SQLite provider. All ten migrations are now applied locally. The spelling, speaking, and rewards/goals migrations initially used SQLite-unsupported `ALTER TABLE ... ADD CONSTRAINT` syntax.
- **Root cause:** The database provider, environment configuration, schema, and migration SQL have not been kept in sync.
- **Impact:** Local startup/auth persistence may fail depending on which URL is used; applying migrations without review risks modifying the wrong database or failing partway.
- **Correction made:** Moved foreign-key constraints into the affected SQLite `CREATE TABLE` statements and added a data-preserving repair migration to rebuild SQLite DateTime columns with `DATETIME` types. All ten migrations apply to a fresh disposable SQLite database. Applied the repair migration locally after backing up `prisma/dev.db`; `.env` remains unchanged.
- **Required follow-up:** Decide and implement a persistent production database provider and matching migrations before deployment. Do not use the current SQLite database as Vercel production storage.

### A-04 — Quiz scoring and submission were not authoritative or persistent on all paths

- **Severity:** HIGH
- **Evidence:** The original `/api/quiz/attempt` evaluated only the Lesson 1 bank, echoed a caller-provided student ID, and returned correct answers. `/api/quiz/submit` accepted score, total, and answer metadata from the client.
- **Root cause:** Scoring logic and persistence are split across a demo calculator and a client-trusted submission handler.
- **Impact:** Attempts can be falsified, other lesson banks are not covered by this endpoint, and the answer key is disclosed before any enforced assessment boundary.
- **Correction made:** Quiz generation now creates a session bound to the authenticated student and stores the complete answer key server-side with a two-hour expiry. The browser receives only question text/options. Both attempt and legacy submit routes now use one server-side scorer, validate one in-range answer per question, and transactionally claim the session, create the attempt, and update daily scores. Repeating the same submission replays its saved result without duplicate records; changing answers after submission returns 409. Correct answers and explanations are returned only after submission.
- **Verification:** Added scoring validation tests. TypeScript check and production build passed; ten unit tests pass. All ten migrations apply on disposable SQLite; database-backed route integration tests are still outstanding.

### A-05 — Canonical retrieval coverage is partial and does not certify source accuracy

- **Severity:** HIGH
- **Evidence:** Canonical OCR retrieval and selected-text matching are now used by local AI ask/check/quiz, the Gemini learning loop and quiz generation, and matching-game generation. Other legacy AI/helper routes still require route-by-route provenance review.
- **Root cause:** Source handling evolved across multiple routes and is not yet uniformly centralized.
- **Impact:** Routes outside the validated retrieval paths may still accept unverified context; matching OCR text does not prove edition provenance, OCR accuracy, or factual correctness.
- **Correction made:** Added allowlisted canonical OCR retrieval, selected-text validation, and source metadata for covered paths.
- **Remaining work:** Review all AI/helper routes and document provenance and OCR quality; do not treat retrieval as independent content verification.
- **Verification:** Canonical retrieval tests pass. No textbook provenance or OCR accuracy study has been completed.

### A-06 — Lint baseline fails and test coverage is limited

- **Severity:** MEDIUM
- **Evidence:** The prior `next lint` script was incompatible with Next.js 16. It now invokes ESLint using a flat config, and `npm test` runs the configured `tsx` test runner. Current `npm run lint` still exits nonzero with 18 errors and 10 warnings across the repository, primarily React hook/effect and render-purity findings. Ten session, quiz-scoring, and canonical-retrieval unit tests pass.
- **Root cause:** Linting had not been maintained against the current framework/plugin rules, and automated coverage is still sparse.
- **Impact:** The project cannot currently use the full lint command as a passing quality gate, and session/API integration behavior is not covered.
- **Correction made:** Added ESLint flat configuration and working lint/test scripts, plus token-helper tests. Two `prefer-const` errors and two unused request parameters in touched API handlers were corrected.
- **Remaining work:** Resolve and baseline the remaining lint findings; add auth/session integration, quiz scoring, retrieval, and persistence tests.
- **Verification:** `npm test` passes (10 tests); focused ESLint on changed authentication, AI, quiz, retrieval, and test files passes; full `npm run lint` remains failing as detailed above.

### A-07 — Production database configuration is not deployable as-is

- **Severity:** HIGH
- **Evidence:** Prisma schema and migrations use SQLite while the existing `.env` URL is PostgreSQL. Vercel serverless local files are not durable shared production storage.
- **Impact:** A deployment configured with PostgreSQL is incompatible with the generated SQLite Prisma client; SQLite file persistence is not suitable for production Vercel instances.
- **Correction:** README now documents local setup and explicitly blocks treating the current SQLite configuration as production-ready.
- **Remaining work:** Choose a persistent production database, migrate schema and migration history, and validate deployed auth/session behavior before directing production traffic.

## Work completed in this pass

- Replaced student-key cookies with opaque database-backed sessions and required a valid session in the handlers that already used the session helper.
- Removed request-supplied/fallback student identity from reward, spelling, speaking, and read-aloud handlers.
- Added session persistence to the Prisma schema and a new additive SQLite migration file.
- Reconciled missing Prisma models and fields already used by spelling, speaking, rewards, and goal-tracking code.
- Added per-student AI usage limits, optional wallet-credit deductions, bounded Gemini request timeouts, and authenticated access checks for selected AI endpoints.
- Added server-stored quiz sessions, answer-key redaction, server-authoritative scoring, transactional quiz history/daily-score updates, and idempotent same-answer replay.
- Upgraded selected direct dependencies and added the missing `iconv-lite` dependency. A targeted final CVE scan still reports three findings; the full lockfile has not been cleanly remediated.
- Regenerated the Prisma client.

## Prioritized next steps

1. Review all remaining API routes for identity, authorization, validation, data exposure, and AI/cost controls; close any routes that trust request-supplied student identifiers.
2. Migrate from local SQLite to an explicitly selected persistent production database before deploying database-backed features to Vercel.
3. Add session/auth regression tests and test login, logout, expiry, forged tokens, and unauthenticated private API requests.
4. Consolidate quiz-bank selection, server-side scoring, persistence, feedback, and duplicate-submission handling; add tests without manufacturing lesson content.
5. Establish a canonical textbook content/retrieval interface and ground AI routes in server-validated source passages.
6. Resolve the lint baseline and add meaningful API/integration coverage; inspect OCR data provenance before marking content reviewed.
7. Continue research evaluation, accessibility, deployment, ethics, and reproducibility work only with the actual dataset/protocol evidence.

## Scope limitations

This is not a final security audit, complete route-by-route API review, verified textbook-content audit, usability/accessibility audit, or research validation. The existing `research/` data has not been evaluated for correctness, licensing, consent, or annotation quality. No participants, performance results, or experimental claims are made here.
