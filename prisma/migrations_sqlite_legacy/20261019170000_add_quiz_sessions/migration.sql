CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER NOT NULL,
    "lessonTitle" TEXT,
    "questionsJson" TEXT NOT NULL,
    "answersJson" TEXT,
    "resultJson" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizSession_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "QuizSession_studentId_idx" ON "QuizSession"("studentId");
CREATE INDEX "QuizSession_expiresAt_idx" ON "QuizSession"("expiresAt");
