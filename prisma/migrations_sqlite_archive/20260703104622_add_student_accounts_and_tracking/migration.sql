/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN "avatarTheme" TEXT DEFAULT 'blue';
ALTER TABLE "Student" ADD COLUMN "classLevel" INTEGER;
ALTER TABLE "Student" ADD COLUMN "email" TEXT;
ALTER TABLE "Student" ADD COLUMN "guardianName" TEXT;
ALTER TABLE "Student" ADD COLUMN "guardianPhone" TEXT;
ALTER TABLE "Student" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Student" ADD COLUMN "rollNumber" TEXT;
ALTER TABLE "Student" ADD COLUMN "schoolName" TEXT;
ALTER TABLE "Student" ADD COLUMN "section" TEXT;

-- CreateTable
CREATE TABLE "DailyStudyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "minutesStudied" INTEGER NOT NULL DEFAULT 0,
    "lessonsOpened" INTEGER NOT NULL DEFAULT 0,
    "linesSelected" INTEGER NOT NULL DEFAULT 0,
    "aiInteractions" INTEGER NOT NULL DEFAULT 0,
    "quizAttempts" INTEGER NOT NULL DEFAULT 0,
    "quizScore" INTEGER NOT NULL DEFAULT 0,
    "quizTotal" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gameScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyStudyRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER,
    "gameType" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "sentence" TEXT,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER NOT NULL,
    "lessonTitle" TEXT,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "wrongAnswersJson" TEXT NOT NULL DEFAULT '[]',
    "weakAreasJson" TEXT NOT NULL DEFAULT '[]',
    "submittedAnswersJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuizAttempt" ("createdAt", "id", "lessonNo", "lessonTitle", "score", "studentId", "total", "weakAreasJson", "wrongAnswersJson") SELECT "createdAt", "id", "lessonNo", "lessonTitle", "score", "studentId", "total", "weakAreasJson", "wrongAnswersJson" FROM "QuizAttempt";
DROP TABLE "QuizAttempt";
ALTER TABLE "new_QuizAttempt" RENAME TO "QuizAttempt";
CREATE INDEX "QuizAttempt_studentId_idx" ON "QuizAttempt"("studentId");
CREATE INDEX "QuizAttempt_lessonNo_idx" ON "QuizAttempt"("lessonNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyStudyRecord_studentId_idx" ON "DailyStudyRecord"("studentId");

-- CreateIndex
CREATE INDEX "DailyStudyRecord_dateKey_idx" ON "DailyStudyRecord"("dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStudyRecord_studentId_dateKey_key" ON "DailyStudyRecord"("studentId", "dateKey");

-- CreateIndex
CREATE INDEX "GameAttempt_studentId_idx" ON "GameAttempt"("studentId");

-- CreateIndex
CREATE INDEX "GameAttempt_lessonNo_idx" ON "GameAttempt"("lessonNo");

-- CreateIndex
CREATE INDEX "GameAttempt_gameType_idx" ON "GameAttempt"("gameType");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");
