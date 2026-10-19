# Implementation Progress

Last updated: 2026-10-19

## Completed

- Inspected repository status, scripts, README, Prisma schema/migration lock, auth, selected API routes, quiz paths, AI helpers, and lesson metadata.
- Recorded the evidence and known limitations in [ENGINEERING_AUDIT.md](./ENGINEERING_AUDIT.md).
- Replaced student-key cookies with random opaque, database-backed sessions. Only token hashes are persisted; cookies are HttpOnly, SameSite=Lax, Secure in production, and expire after 30 days.
- Added 401 checks to private quiz submission, study tracking, student/research summary, game, reward, OCR helper, spelling, speaking, and read-aloud handlers. Removed request-supplied student identity fallbacks from reward and practice routes.
- Added per-student AI request limiting (20 logged requests per hour), optional atomic wallet-credit deductions controlled by `AI_CREDITS_ENABLED`, and a 20-second timeout in the shared Gemini helper.
- Made quiz scoring server-authoritative: quiz sessions are bound to the authenticated student, answer keys remain server-side, and scoring/persistence/daily totals are updated transactionally. Repeat submissions with the same answers replay the saved result without duplicate attempts.
- Grounded AI quiz generation, local AI study/quiz/check-answer requests, the Gemini learning loop, and matching games in canonical OCR pages. Client-selected text must match AI-ready page content; responses include textbook source metadata.
- Added per-student request limits and timeout handling to the paid AI routes covered above. Matching-game fallback generation also requires an authenticated student.
- Reconciled Prisma models and fields used by current speaking, spelling, reward, and goal-progress code, and added `StudentSession` plus a SQLite migration file.
- Repaired SQLite-incompatible foreign-key syntax in pending spelling, speaking, and rewards/goals migrations. Verified all nine migrations apply to a fresh disposable SQLite database; the existing local database was not migrated.
- Added token-helper unit tests, an ESLint flat configuration, project `test`/`lint` scripts, and the missing `iconv-lite` runtime dependency.
- Updated direct dependency versions for Next.js/ESLint config, PDF.js, and PostCSS, and refreshed the lockfile.

## Verification

| Command/check | Result |
| --- | --- |
| Prisma client generation | Passed (Prisma Client 6.19.3) |
| Prisma schema validation with process-local `DATABASE_URL=file:./dev.db` | Passed |
| `npx tsc --noEmit` after the latest API and source-retrieval edits | Passed |
| Production `npm run build` with process-local SQLite URL | Passed (Next.js 16.4.2; emits the existing middleware-to-proxy deprecation warning) |
| `npm test` | Passed (10 session-token, quiz-scoring, and canonical-retrieval tests) |
| Focused ESLint on changed authentication, AI, quiz, retrieval, and test files | Passed |
| `npm run lint` | Fails with 18 errors and 10 warnings, mainly React effect/hook rules and render purity in UI files. These remaining findings are not represented as resolved. |
| `npm audit --omit=dev` | Reports 3 high-severity advisories via `deepmerge-ts@7.1.5`; npm's suggested fix requires the breaking Prisma 7 upgrade. |
| `appmod-cve-assessment` targeted final scan | Reports `braces@3.0.3` (high, no fix listed), `deepmerge-ts@7.1.5` (high, fix requires 8.0.0+), and `postcss-selector-parser@6.1.4` (medium, fix requires 7.1.6+). Report: session artifact `final-cve-report.json`. The scan covered direct dependencies and the three previously identified transitive packages, not every lockfile entry. |
| Prisma migration deployment to disposable SQLite | Passed; all nine migrations applied successfully. No migration was applied to `prisma/dev.db`. |
| Local `prisma/dev.db` migration status | Read-only check reports five pending migrations. No migration was applied. |

Plain Prisma commands still read `.env`, whose PostgreSQL URL conflicts with the SQLite datasource; validation/build checks used a process-local SQLite override. The existing `.env` and `prisma/dev.db` were not edited. Do not apply migrations to the existing database until SQLite compatibility and data impact are verified.

## Files changed

Authentication/session code and routes; private API handlers; AI usage controls and Gemini helper; Prisma schema and a new session migration; token tests; ESLint/package scripts and dependencies; and the audit/progress documentation. The complete changed-file list is available from the working tree diff.

## Remaining work

1. Complete the route-by-route API authorization and data-exposure review; some legacy/backup handlers may need separate review.
2. Add database-backed quiz API integration tests, including session ownership, expiry, invalid answers, and idempotent concurrent submissions.
3. Verify SQLite migration history in a disposable database; preserve the existing local database until safe and separately authorized.
4. Resolve local SQLite and future production PostgreSQL configuration without disclosing or silently changing `.env`.
5. Review OCR/content provenance, research protocols, ethics/privacy, accessibility, evaluation, CI, and deployment documentation against actual evidence. Retrieval validates text against local OCR; it does not certify textbook provenance.
6. Address the remaining lint baseline and evaluate the Prisma 7 / Tailwind 4 transitive-CVE upgrade paths as separate compatibility work.

This is incomplete engineering work, not a final security, content, accessibility, research, or deployment sign-off.
