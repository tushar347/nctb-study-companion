# Engineering Audit

**Audit status:** Initial, evidence-based pass; not a complete review of every route or source file.  
**Workspace:** `tushar347/nctb-study-companion`, branch `main`  
**Local database target:** SQLite, selected by the user on 2026-10-19. The configured PostgreSQL URL was not changed or disclosed.

## Verified stack and layout

- Next.js 16.4.2, React/React DOM 19.2.7, TypeScript 6.0.3, Prisma 6.19.3, Node.js 24.15.0 (versions recorded from the current lockfile/environment).
- App Router application under `app/`, with 44 API route handlers and client/server UI under `components/`.
- Prisma schema declares SQLite. The repository has a SQLite `prisma/dev.db`; the `.env` `DATABASE_URL` scheme is PostgreSQL. Prisma commands in this audit used a process-local `file:./dev.db` override and did not edit `.env`.
- Migration lock declares SQLite. Four migrations are pending in the local database after adding the session migration; no migration was applied.
- `data/lesson1.ts` describes its passage as a course-demo sample. `lib/book/class6Lessons.ts` lists 33 lesson/page ranges, but this is not evidence that each lesson has a verified question bank.
- `research/` contains existing OCR, annotation, and evaluation materials. Their provenance and review status have not yet been audited; they are not treated here as verified research results.

## Findings

### A-01 — Student identity was trusted from cookie presence, with a shared demo fallback

- **Severity:** HIGH
- **Evidence:** `middleware.ts` allowed protected pages whenever `nctb_student_key` existed. `lib/auth.ts` previously returned the cookie value directly and substituted `demo-student` when absent. Login/signup used the student key itself as the cookie value. Reward and practice handlers also accepted caller-supplied student keys or fell back to the shared demo account.
- **Root cause:** The cookie represented an account identifier rather than a session credential, and the server-side helper did not validate a persisted session.
- **Impact:** A forged or guessed identifier could be used to select another student's data in API handlers that rely on the helper. Missing credentials could silently resolve to a shared identity.
- **Correction made:** Added a database-backed `StudentSession`; login/signup issue random opaque tokens and persist only SHA-256 token hashes; the helper now validates token existence and expiry and returns no identity for missing/invalid sessions. Session cookie remains HttpOnly, SameSite=Lax, Secure in production, and has a 30-day expiry. Added 401 checks to quiz submission, study tracking, student/research summary, game, reward, OCR helper, spelling, speaking, and read-aloud handlers. Reward/practice handlers no longer resolve identity from body/query student keys.
- **Remaining work:** Middleware still makes a cookie-presence-only decision for page redirection (not an authorization boundary). Audit every other private API for equivalent session enforcement. The new and other pending local migrations have not been applied.
- **Verification:** Prisma client generation, schema validation using the SQLite URL, TypeScript check, and production build passed. Three unit tests cover token generation, hashing, and expiry resolution; authenticated-session integration tests remain outstanding.

### A-02 — Prisma schema omitted models used by current application code

- **Severity:** HIGH
- **Evidence:** A TypeScript check against the checked-in schema failed for `SpeakingAttempt`, `SpellingAttempt`, reward inventory, and goal-progress delegates/fields. Corresponding migrations and application code exist, but the models/fields were absent from `prisma/schema.prisma`.
- **Root cause:** Schema and application/migration history had drifted.
- **Impact:** Type errors blocked type-check/build validation and the affected practice/reward features could not be represented by the generated Prisma client.
- **Correction made:** Added the models/relations/fields represented by those migrations, including idempotency fields on `RewardTransaction`; regenerated the Prisma client.
- **Remaining work:** The local database reports five pending migrations (spelling attempts, speaking attempts, scoring/rewards/goals, student sessions, and quiz sessions). All nine migrations apply on a fresh disposable SQLite database; do not migrate the existing database until its effects and configuration are separately approved.
- **Verification:** `npx prisma validate`, `npx tsc --noEmit`, and `npm run build` passed with a process-local SQLite URL.

### A-03 — Database configuration and migration history are inconsistent

- **Severity:** HIGH
- **Evidence:** Prisma schema and migration lock say SQLite; configured `.env` URL uses PostgreSQL; local `prisma/dev.db` exists. A plain `npx prisma validate` failed because the configured URL did not match the declared SQLite provider. The local database has pending migrations. The spelling, speaking, and rewards/goals migrations initially used SQLite-unsupported `ALTER TABLE ... ADD CONSTRAINT` syntax.
- **Root cause:** The database provider, environment configuration, schema, and migration SQL have not been kept in sync.
- **Impact:** Local startup/auth persistence may fail depending on which URL is used; applying migrations without review risks modifying the wrong database or failing partway.
- **Correction made:** Moved foreign-key constraints into the affected SQLite `CREATE TABLE` statements. All nine migrations now apply successfully to a fresh disposable SQLite database. No `.env` changes and no migrations were applied to `prisma/dev.db`; user selected SQLite as the local target, and PostgreSQL configuration is preserved.
- **Required follow-up:** Decide how local SQLite and future production PostgreSQL configuration will be maintained. Verify the existing local database's migration history separately and obtain authorization before migrating it.

### A-04 — Quiz scoring and submission were not authoritative or persistent on all paths

- **Severity:** HIGH
- **Evidence:** The original `/api/quiz/attempt` evaluated only the Lesson 1 bank, echoed a caller-provided student ID, and returned correct answers. `/api/quiz/submit` accepted score, total, and answer metadata from the client.
- **Root cause:** Scoring logic and persistence are split across a demo calculator and a client-trusted submission handler.
- **Impact:** Attempts can be falsified, other lesson banks are not covered by this endpoint, and the answer key is disclosed before any enforced assessment boundary.
- **Correction made:** Quiz generation now creates a session bound to the authenticated student and stores the complete answer key server-side with a two-hour expiry. The browser receives only question text/options. Both attempt and legacy submit routes now use one server-side scorer, validate one in-range answer per question, and transactionally claim the session, create the attempt, and update daily scores. Repeating the same submission replays its saved result without duplicate records; changing answers after submission returns 409. Correct answers and explanations are returned only after submission.
- **Verification:** Added scoring validation tests. TypeScript check and production build passed; six unit tests pass. All nine migrations apply on a disposable SQLite DB; no database-backed route integration test has been added.

### A-05 — Textbook-grounded AI is not consistently grounded in canonical server content

- **Severity:** HIGH
- **Evidence:** `lib/gemini.ts` sends the selected text directly to Gemini and does not retrieve a passage or source identifier. `app/api/local-ai/ask/route.ts` accepts a passage in the request body; the shown API does not establish that passage/page/book as canonical server-side content.
- **Root cause:** AI helper routes are not yet consistently coupled to a server-controlled textbook retrieval interface.
- **Impact:** Responses may be ungrounded or citations cannot be reliably traced to a canonical textbook passage. Prompt instructions alone do not verify factual correctness.
- **Correction:** Not yet implemented. Use server-side retrieval from validated book/page/lesson IDs, return source metadata, and distinguish supplemental explanations from textbook evidence.
- **Verification:** Not yet implemented; any future safeguards must be described as heuristics, not guarantees.

### A-06 — Lint baseline fails and test coverage is limited

- **Severity:** MEDIUM
- **Evidence:** The prior `next lint` script was incompatible with Next.js 16. It now invokes ESLint using a flat config, and `npm test` runs the configured `tsx` test runner. Current `npm run lint` still exits nonzero with 19 errors and 10 warnings across the repository; remaining examples include synchronous state updates in effects, an invalid hook call, explicit `any`, and `require` imports. Three session-token unit tests pass.
- **Root cause:** Linting had not been maintained against the current framework/plugin rules, and automated coverage is still sparse.
- **Impact:** The project cannot currently use the full lint command as a passing quality gate, and session/API integration behavior is not covered.
- **Correction made:** Added ESLint flat configuration and working lint/test scripts, plus token-helper tests. Two `prefer-const` errors and two unused request parameters in touched API handlers were corrected.
- **Remaining work:** Resolve and baseline the remaining lint findings; add auth/session integration, quiz scoring, retrieval, and persistence tests.
- **Verification:** `npm test` passes (6 tests); `npm run lint` remains failing as detailed above.
- **Impact:** Routine linting and regression tests cannot currently be run through project scripts.
- **Correction:** Not yet implemented. Select a Next.js 16-compatible lint setup and a minimal test runner compatible with the existing toolchain before adding test coverage.
- **Verification:** `npm run lint` failed as described; `npm test` was not run because no test script exists.

### A-07 — README status is stale relative to the current application

- **Severity:** LOW
- **Evidence:** `README.md` describes the project as a frontend demo with a mock backend and lists only early API work; the current app includes Prisma-backed accounts, OCR, practice, and rewards routes.
- **Impact:** Developers may follow obsolete setup/status instructions and mistake demo data for complete functionality.
- **Correction:** Not yet implemented. Refresh setup, environment, database, test, and feature-status documentation after the implementation baseline is stable.
- **Verification:** Documentation review.

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
2. Resolve SQLite/PostgreSQL environment and migration-history compatibility without changing `.env` or applying migrations until the migration plan is safe.
3. Add session/auth regression tests and test login, logout, expiry, forged tokens, and unauthenticated private API requests.
4. Consolidate quiz-bank selection, server-side scoring, persistence, feedback, and duplicate-submission handling; add tests without manufacturing lesson content.
5. Establish a canonical textbook content/retrieval interface and ground AI routes in server-validated source passages.
6. Resolve the lint baseline and add meaningful API/integration coverage; refresh README/setup docs and inspect OCR data provenance before marking content reviewed.
7. Continue research evaluation, accessibility, deployment, ethics, and reproducibility work only with the actual dataset/protocol evidence.

## Scope limitations

This is not a final security audit, complete route-by-route API review, verified textbook-content audit, usability/accessibility audit, or research validation. The existing `research/` data has not been evaluated for correctness, licensing, consent, or annotation quality. No participants, performance results, or experimental claims are made here.
