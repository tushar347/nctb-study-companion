CREATE TABLE "SpeakingAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "practiceType" TEXT NOT NULL,
    "bookKey" TEXT NOT NULL,
    "classLevel" INTEGER,
    "pageNumber" INTEGER NOT NULL,
    "lessonNo" INTEGER,
    "sourceLineId" TEXT,
    "sourceText" TEXT NOT NULL,
    "promptText" TEXT,
    "transcript" TEXT NOT NULL,
    "durationMs" INTEGER,
    "expectedWordCount" INTEGER NOT NULL DEFAULT 0,
    "spokenWordCount" INTEGER NOT NULL DEFAULT 0,
    "matchedWordCount" INTEGER NOT NULL DEFAULT 0,
    "accuracyScore" DOUBLE PRECISION,
    "completenessScore" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION,
    "fluencyScore" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "wordsPerMinute" DOUBLE PRECISION,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "missingItemsJson" TEXT NOT NULL DEFAULT '[]',
    "extraItemsJson" TEXT NOT NULL DEFAULT '[]',
    "replacementsJson" TEXT NOT NULL DEFAULT '[]',
    "evaluationVersion" TEXT NOT NULL DEFAULT 'voice-practice-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SpeakingAttempt"
ADD CONSTRAINT "SpeakingAttempt_studentId_fkey"
FOREIGN KEY ("studentId")
REFERENCES "Student"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE INDEX "SpeakingAttempt_studentId_idx"
ON "SpeakingAttempt"("studentId");

CREATE INDEX "SpeakingAttempt_practiceType_idx"
ON "SpeakingAttempt"("practiceType");

CREATE INDEX "SpeakingAttempt_bookKey_pageNumber_idx"
ON "SpeakingAttempt"("bookKey", "pageNumber");

CREATE INDEX "SpeakingAttempt_studentId_sourceLineId_idx"
ON "SpeakingAttempt"("studentId", "sourceLineId");

CREATE INDEX "SpeakingAttempt_createdAt_idx"
ON "SpeakingAttempt"("createdAt");
