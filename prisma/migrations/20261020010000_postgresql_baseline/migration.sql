-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER,
    "selectedLine" TEXT,
    "question" TEXT,
    "toolUsed" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "classLevel" INTEGER,
    "subject" TEXT,
    "pdfPath" TEXT,
    "coverImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookPage" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imagePath" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "rawText" TEXT,
    "cleanText" TEXT,
    "aiReadyText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER,
    "selectedLine" TEXT,
    "toolUsed" TEXT,
    "question" TEXT,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'gemini',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyGoalProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "distinctActivityTypes" INTEGER NOT NULL DEFAULT 0,
    "activityTypesJson" TEXT NOT NULL DEFAULT '[]',
    "quizAttempts" INTEGER NOT NULL DEFAULT 0,
    "gameAttempts" INTEGER NOT NULL DEFAULT 0,
    "spellingAttempts" INTEGER NOT NULL DEFAULT 0,
    "readAloudAttempts" INTEGER NOT NULL DEFAULT 0,
    "speakingAttempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyGoalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStudyRecord" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStudyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER,
    "gameType" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "sentence" TEXT,
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OCRLine" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "cleanText" TEXT,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "aiReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OCRLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER NOT NULL,
    "lessonTitle" TEXT,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "wrongAnswersJson" TEXT NOT NULL DEFAULT '[]',
    "weakAreasJson" TEXT NOT NULL DEFAULT '[]',
    "submittedAnswersJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER,
    "eventType" TEXT NOT NULL,
    "selectedLine" TEXT,
    "toolUsed" TEXT,
    "score" INTEGER,
    "total" INTEGER,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "costPoints" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTransaction" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pointsChange" INTEGER NOT NULL DEFAULT 0,
    "creditsChange" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "balanceAfter" INTEGER,

    CONSTRAINT "RewardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentKey" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "classLevel" INTEGER,
    "section" TEXT,
    "rollNumber" TEXT,
    "schoolName" TEXT,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "avatarTheme" TEXT DEFAULT 'blue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGoalSetting" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetPoints" INTEGER NOT NULL DEFAULT 60,
    "targetActivityTypes" INTEGER NOT NULL DEFAULT 3,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGoalSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMemory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "openedLessonsJson" TEXT NOT NULL DEFAULT '[]',
    "selectedLinesJson" TEXT NOT NULL DEFAULT '[]',
    "usedToolsJson" TEXT NOT NULL DEFAULT '[]',
    "weakAreasJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentReward" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rewardItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "StudentReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentWallet" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "aiCredits" INTEGER NOT NULL DEFAULT 5,
    "learningPoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimePointsEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageLog_lessonNo_idx" ON "AiUsageLog"("lessonNo");

-- CreateIndex
CREATE INDEX "AiUsageLog_studentId_idx" ON "AiUsageLog"("studentId");

-- CreateIndex
CREATE INDEX "BookPage_bookId_idx" ON "BookPage"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookPage_bookId_pageNumber_key" ON "BookPage"("bookId", "pageNumber");

-- CreateIndex
CREATE INDEX "ChatMessage_lessonNo_idx" ON "ChatMessage"("lessonNo");

-- CreateIndex
CREATE INDEX "ChatMessage_studentId_idx" ON "ChatMessage"("studentId");

-- CreateIndex
CREATE INDEX "DailyGoalProgress_completedAt_idx" ON "DailyGoalProgress"("completedAt");

-- CreateIndex
CREATE INDEX "DailyGoalProgress_dateKey_idx" ON "DailyGoalProgress"("dateKey");

-- CreateIndex
CREATE INDEX "DailyGoalProgress_studentId_idx" ON "DailyGoalProgress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGoalProgress_studentId_dateKey_key" ON "DailyGoalProgress"("studentId", "dateKey");

-- CreateIndex
CREATE INDEX "DailyStudyRecord_dateKey_idx" ON "DailyStudyRecord"("dateKey");

-- CreateIndex
CREATE INDEX "DailyStudyRecord_studentId_idx" ON "DailyStudyRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStudyRecord_studentId_dateKey_key" ON "DailyStudyRecord"("studentId", "dateKey");

-- CreateIndex
CREATE INDEX "GameAttempt_gameType_idx" ON "GameAttempt"("gameType");

-- CreateIndex
CREATE INDEX "GameAttempt_lessonNo_idx" ON "GameAttempt"("lessonNo");

-- CreateIndex
CREATE INDEX "GameAttempt_studentId_idx" ON "GameAttempt"("studentId");

-- CreateIndex
CREATE INDEX "OCRLine_pageId_idx" ON "OCRLine"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "OCRLine_pageId_lineNumber_key" ON "OCRLine"("pageId", "lineNumber");

-- CreateIndex
CREATE INDEX "QuizAttempt_lessonNo_idx" ON "QuizAttempt"("lessonNo");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_idx" ON "QuizAttempt"("studentId");

-- CreateIndex
CREATE INDEX "ResearchEvent_eventType_idx" ON "ResearchEvent"("eventType");

-- CreateIndex
CREATE INDEX "ResearchEvent_lessonNo_idx" ON "ResearchEvent"("lessonNo");

-- CreateIndex
CREATE INDEX "ResearchEvent_studentId_idx" ON "ResearchEvent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardItem_code_key" ON "RewardItem"("code");

-- CreateIndex
CREATE INDEX "RewardItem_active_idx" ON "RewardItem"("active");

-- CreateIndex
CREATE INDEX "RewardItem_costPoints_idx" ON "RewardItem"("costPoints");

-- CreateIndex
CREATE UNIQUE INDEX "RewardTransaction_idempotencyKey_key" ON "RewardTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RewardTransaction_sourceType_sourceId_idx" ON "RewardTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "RewardTransaction_studentId_idx" ON "RewardTransaction"("studentId");

-- CreateIndex
CREATE INDEX "RewardTransaction_type_idx" ON "RewardTransaction"("type");

-- CreateIndex
CREATE INDEX "SpeakingAttempt_bookKey_pageNumber_idx" ON "SpeakingAttempt"("bookKey", "pageNumber");

-- CreateIndex
CREATE INDEX "SpeakingAttempt_createdAt_idx" ON "SpeakingAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "SpeakingAttempt_practiceType_idx" ON "SpeakingAttempt"("practiceType");

-- CreateIndex
CREATE INDEX "SpeakingAttempt_studentId_idx" ON "SpeakingAttempt"("studentId");

-- CreateIndex
CREATE INDEX "SpeakingAttempt_studentId_sourceLineId_idx" ON "SpeakingAttempt"("studentId", "sourceLineId");

-- CreateIndex
CREATE INDEX "SpellingAttempt_bookKey_pageNumber_idx" ON "SpellingAttempt"("bookKey", "pageNumber");

-- CreateIndex
CREATE INDEX "SpellingAttempt_createdAt_idx" ON "SpellingAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "SpellingAttempt_studentId_idx" ON "SpellingAttempt"("studentId");

-- CreateIndex
CREATE INDEX "SpellingAttempt_studentId_targetWord_idx" ON "SpellingAttempt"("studentId", "targetWord");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentKey_key" ON "Student"("studentKey");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGoalSetting_studentId_key" ON "StudentGoalSetting"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMemory_studentId_key" ON "StudentMemory"("studentId");

-- CreateIndex
CREATE INDEX "StudentReward_rewardItemId_idx" ON "StudentReward"("rewardItemId");

-- CreateIndex
CREATE INDEX "StudentReward_studentId_idx" ON "StudentReward"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentReward_studentId_rewardItemId_key" ON "StudentReward"("studentId", "rewardItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentWallet_studentId_key" ON "StudentWallet"("studentId");

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookPage" ADD CONSTRAINT "BookPage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGoalProgress" ADD CONSTRAINT "DailyGoalProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStudyRecord" ADD CONSTRAINT "DailyStudyRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAttempt" ADD CONSTRAINT "GameAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCRLine" ADD CONSTRAINT "OCRLine_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "BookPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvent" ADD CONSTRAINT "ResearchEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAttempt" ADD CONSTRAINT "SpeakingAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpellingAttempt" ADD CONSTRAINT "SpellingAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGoalSetting" ADD CONSTRAINT "StudentGoalSetting_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMemory" ADD CONSTRAINT "StudentMemory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReward" ADD CONSTRAINT "StudentReward_rewardItemId_fkey" FOREIGN KEY ("rewardItemId") REFERENCES "RewardItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReward" ADD CONSTRAINT "StudentReward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWallet" ADD CONSTRAINT "StudentWallet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
