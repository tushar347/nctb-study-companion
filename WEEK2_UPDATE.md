# Week 2 Update — Backend API and Frontend Connection

## Project Name

NCTB Study Companion
Class 6 English for Today Line-by-line Study Companion

## Week 2 Summary

In Week 2, we improved the project from a static frontend prototype into an API-connected prototype. In Week 1, the app mainly used local mock data inside the frontend. In Week 2, we added backend-ready API routes using Next.js route handlers and connected the frontend to those routes.

The app still keeps the same simple learning flow, but the data is now separated through API endpoints. This makes the project more organized and prepares it for database integration in the next phase.

## Work Completed in Week 2

| Task                         | Status    | Details                                                                                                                    |
| ---------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| Created Week 2 branch        | Completed | Created and used the `week2-backend-api` branch for backend/API work.                                                      |
| Added Week 2 update file     | Completed | Added this `WEEK2_UPDATE.md` file to document progress.                                                                    |
| Added API route structure    | Completed | Created API folders inside `app/api`.                                                                                      |
| Added student API            | Completed | Created `/api/student/demo` for demo student profile data.                                                                 |
| Added book API               | Completed | Created `/api/books` for active and future book list.                                                                      |
| Added lesson API             | Completed | Created `/api/lessons/eft-c6-l1` for Lesson 1 metadata and line data.                                                      |
| Added selected line help API | Completed | Created `/api/lines/[lineId]/help` for explanation, Bangla translation, and grammar output.                                |
| Added quiz question API      | Completed | Created `/api/quiz/eft-c6-l1` for Lesson 1 quiz questions.                                                                 |
| Added quiz attempt API       | Completed | Created `/api/quiz/attempt` to calculate quiz score from submitted answers.                                                |
| Added progress API           | Completed | Created `/api/progress/demo` for daily and weekly progress data.                                                           |
| Connected frontend to API    | Completed | Updated `StudyCompanion.tsx` so the frontend loads student, book, lesson, helper, quiz, and progress data from API routes. |
| Updated README               | Completed | Cleaned the README and added Week 1 and Week 2 status.                                                                     |

## API Endpoints Added

| Endpoint                   | Method | Purpose                                            |
| -------------------------- | ------ | -------------------------------------------------- |
| `/api/student/demo`        | GET    | Returns demo student profile information.          |
| `/api/books`               | GET    | Returns active and future book list.               |
| `/api/lessons/eft-c6-l1`   | GET    | Returns Lesson 1 information and selectable lines. |
| `/api/lines/[lineId]/help` | GET    | Returns helper output for a selected line.         |
| `/api/quiz/eft-c6-l1`      | GET    | Returns Lesson 1 quiz questions.                   |
| `/api/quiz/attempt`        | POST   | Checks submitted quiz answers and returns score.   |
| `/api/progress/demo`       | GET    | Returns daily and weekly progress data.            |

## Frontend Changes

The frontend was updated so it now uses API calls instead of relying only on direct local data imports.

The app now fetches data from:

- `/api/student/demo`
- `/api/books`
- `/api/lessons/eft-c6-l1`
- `/api/lines/[lineId]/help`
- `/api/quiz/eft-c6-l1`
- `/api/quiz/attempt`
- `/api/progress/demo`

A visible Week 2 update was also added in the frontend to show that the API-connected version is running.

## Testing Done

The API routes were tested using localhost.

Tested examples:

- Opened `/api/books` in the browser and confirmed JSON output.
- Opened `/api/progress/demo` and confirmed status `200`.
- Added frontend API fetch logic and pushed it to GitHub.
- Confirmed that the Week 2 branch contains the updated API routes and frontend connection code.

## Current Status

At the end of Week 2, the project has:

- A working Week 1 frontend demo flow.
- A backend-ready API route structure.
- API endpoints for student, books, lesson lines, line help, quiz, quiz attempt, and progress.
- Frontend code connected to the API layer.
- GitHub branch updated with Week 2 work.

## Current Limitations

- The API routes still use local mock data.
- Real database saving has not been added yet.
- Real user authentication has not been added yet.
- AI helper generation has not been added yet.
- The helper output is still reviewed/prepared content, which is safer for the course demo.

## Next Work

The next phase will focus on:

- Adding database storage using SQLite or PostgreSQL.
- Saving quiz attempts permanently.
- Saving progress data permanently.
- Improving the selected-line helper output.
- Preparing the final report and presentation.
- Running the full demo path several times before submission.

## Conclusion

Week 2 successfully improved the project architecture. The project is no longer only a static frontend demo. It now has a backend-ready API layer and the frontend has been connected to that layer. This keeps the project aligned with the planned MVP and prepares it for database integration in the next phase.
