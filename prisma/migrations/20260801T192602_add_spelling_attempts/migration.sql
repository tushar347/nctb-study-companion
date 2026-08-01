-- AddTable
CREATE TABLE "SpellingAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bookKey" TEXT NOT NULL,
    "classLevel" INTEGER,
    "pageNumber" INTEGER NOT NULL,
    "lessonNo" INTEGER,
    "sourceLineId" TEXT,
    "sourceText" TEXT,
    "targetWord" TEXT NOT NULL,
    "submittedAnswer" TEXT NOT NULL,
    "normalizedAnswer" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "responseTimeMs" INTEGER,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "missingLettersJson" TEXT NOT NULL DEFAULT '[]',
    "extraLettersJson" TEXT NOT NULL DEFAULT '[]',
    "substitutionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpellingAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SpellingAttempt"
ADD CONSTRAINT "SpellingAttempt_studentId_fkey"
FOREIGN KEY ("studentId")
REFERENCES "Student"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE INDEX "SpellingAttempt_studentId_idx"
ON "SpellingAttempt"("studentId");

CREATE INDEX "SpellingAttempt_bookKey_pageNumber_idx"
ON "SpellingAttempt"("bookKey", "pageNumber");

CREATE INDEX "SpellingAttempt_studentId_targetWord_idx"
ON "SpellingAttempt"("studentId", "targetWord");

CREATE INDEX "SpellingAttempt_createdAt_idx"
ON "SpellingAttempt"("createdAt");
