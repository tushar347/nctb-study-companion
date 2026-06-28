# Week 2 Update — Backend API and Data Connection

## Project name

Class 6 English for Today Line-by-line Study Companion

## Week 2 goal

The main goal of Week 2 is to move the project from a fully local mock-data frontend toward a backend-ready structure. In Week 1, we built the clickable UI skeleton. In Week 2, we are adding API routes and organizing the data model so the app can later connect with a real database.

## Work planned for Week 2

- Clean the GitHub repository and fix the README merge-conflict issue.
- Create simple backend/API routes for the demo data.
- Organize lesson, line, helper, quiz, and progress data in a backend-friendly format.
- Connect the frontend screens to API responses step by step.
- Keep the current UI flow unchanged so the demo remains stable.
- Prepare the project for SQLite or PostgreSQL database integration.
- Keep AI helper integration optional and continue using reviewed helper outputs for reliability.

## Current Week 1 foundation

The Week 1 frontend already includes:

- Home screen with demo student profile.
- Book library with Class 6 English for Today active.
- Lesson 1 reader with selectable line blocks.
- Pop-up actions for Explain, Translate, Grammar, and Quiz.
- Side Help Tab with prepared helper output.
- Short quiz with local score calculation.
- Progress report with mock daily and weekly data.

## Week 2 technical tasks

### 1. API route setup

Create API routes for:

- Student profile
- Book list
- Lesson 1 details
- Lesson lines
- Helper output for selected line
- Quiz questions
- Quiz attempt submission
- Progress report

### 2. Suggested API endpoints

| Endpoint                   | Method | Purpose                                                  |
| -------------------------- | ------ | -------------------------------------------------------- |
| `/api/student/demo`        | GET    | Return demo student profile                              |
| `/api/books`               | GET    | Return active and future book list                       |
| `/api/lessons/eft-c6-l1`   | GET    | Return Lesson 1 metadata and lines                       |
| `/api/lines/[lineId]/help` | GET    | Return explanation, Bangla translation, and grammar note |
| `/api/quiz/eft-c6-l1`      | GET    | Return Lesson 1 quiz questions                           |
| `/api/quiz/attempt`        | POST   | Submit answers and calculate score                       |
| `/api/progress/demo`       | GET    | Return daily and weekly progress                         |

### 3. Data model preparation

The backend data should follow these main entities:

- students
- books
- lessons
- lesson_lines
- line_help
- quiz_questions
- quiz_attempts
- saved_words
- progress

For Week 2, these can still be stored in local TypeScript or JSON files, but the structure should match the future database tables.

## What will be completed by the end of Week 2

By the end of Week 2, the app should still show the same demo journey, but the data should come through API routes instead of being used directly inside the frontend component.

Expected flow:

1. Student opens the app.
2. Frontend loads demo student data from API.
3. Student opens Lesson 1.
4. Lesson lines load from API.
5. Student selects a line.
6. Helper output loads using the selected line ID.
7. Student completes quiz.
8. Quiz score is calculated and progress is updated or prepared for saving.

## Week 2 limitations

- Real user authentication is not required yet.
- Full database integration may remain incomplete if API routes are working.
- AI API integration is optional and should not be added before the core flow is stable.
- Public textbook content should be limited to demo-safe sample content.

## Week 2 success criteria

- README file is clean and has no merge-conflict markers.
- The project runs using `npm install` and `npm run dev`.
- API routes return correct JSON data.
- The frontend can fetch lesson/helper/quiz/progress data from the API.
- The full demo path still works without breaking the Week 1 UI.
- The project is ready for database integration in the next phase.
