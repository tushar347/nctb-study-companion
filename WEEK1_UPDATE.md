# Week 1 Update — Scope Lock and Clickable UI Skeleton

## Project name
Class 6 English for Today Line-by-line Study Companion

## Week 1 goal
Build a small but presentable frontend prototype that demonstrates the core learning loop: Home → Book Library → Lesson Reader → Select Line → Side Help Tab → Quiz → Progress Report.

## Work completed
- Locked MVP scope to Class 6 English for Today Lesson 1 only.
- Created initial Next.js frontend structure.
- Added mock Lesson 1 content as selectable line blocks.
- Added prepared helper outputs: simple English explanation, Bangla translation, and grammar note.
- Added a short quiz flow with local scoring.
- Added a simple progress report screen.
- Added responsive layout for laptop and mobile width.

## Current demo flow
1. Student opens the app as Rafi.
2. Student clicks Continue Reading.
3. Lesson 1 opens with selectable lines.
4. Student selects a confusing line.
5. Pop-up actions and Side Help Tab show learning support.
6. Student completes a quiz.
7. Progress report updates with quiz score.

## Tools used
- Next.js
- React
- TypeScript
- CSS
- GitHub recommended for version control

## Limitations this week
- Data is stored in local TypeScript mock files only.
- No real login yet.
- No database yet.
- No AI API yet; helper outputs are prepared manually for reliability.

## Next week plan
- Add backend API routes or Express backend.
- Create SQLite database schema for students, lessons, lines, helper output, quiz questions, quiz attempts, and progress.
- Replace local mock data with API calls step by step.
