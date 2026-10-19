PRAGMA foreign_keys=OFF;

CREATE TABLE "SpellingAttempt_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "accuracy" REAL NOT NULL,
    "responseTimeMs" INTEGER,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "missingLettersJson" TEXT NOT NULL DEFAULT '[]',
    "extraLettersJson" TEXT NOT NULL DEFAULT '[]',
    "substitutionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpellingAttempt_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "SpellingAttempt_new" (
    "id", "studentId", "bookKey", "classLevel", "pageNumber", "lessonNo",
    "sourceLineId", "sourceText", "targetWord", "submittedAnswer",
    "normalizedAnswer", "inputMode", "isCorrect", "accuracy",
    "responseTimeMs", "attemptNumber", "missingLettersJson",
    "extraLettersJson", "substitutionsJson", "createdAt"
)
SELECT
    "id", "studentId", "bookKey", "classLevel", "pageNumber", "lessonNo",
    "sourceLineId", "sourceText", "targetWord", "submittedAnswer",
    "normalizedAnswer", "inputMode", "isCorrect", "accuracy",
    "responseTimeMs", "attemptNumber", "missingLettersJson",
    "extraLettersJson", "substitutionsJson", "createdAt"
FROM "SpellingAttempt";

DROP TABLE "SpellingAttempt";
ALTER TABLE "SpellingAttempt_new" RENAME TO "SpellingAttempt";
CREATE INDEX "SpellingAttempt_studentId_idx" ON "SpellingAttempt"("studentId");
CREATE INDEX "SpellingAttempt_bookKey_pageNumber_idx" ON "SpellingAttempt"("bookKey", "pageNumber");
CREATE INDEX "SpellingAttempt_studentId_targetWord_idx" ON "SpellingAttempt"("studentId", "targetWord");
CREATE INDEX "SpellingAttempt_createdAt_idx" ON "SpellingAttempt"("createdAt");

CREATE TABLE "SpeakingAttempt_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "accuracyScore" REAL,
    "completenessScore" REAL,
    "relevanceScore" REAL,
    "fluencyScore" REAL,
    "overallScore" REAL NOT NULL,
    "wordsPerMinute" REAL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "missingItemsJson" TEXT NOT NULL DEFAULT '[]',
    "extraItemsJson" TEXT NOT NULL DEFAULT '[]',
    "replacementsJson" TEXT NOT NULL DEFAULT '[]',
    "evaluationVersion" TEXT NOT NULL DEFAULT 'voice-practice-v1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpeakingAttempt_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "SpeakingAttempt_new" (
    "id", "studentId", "practiceType", "bookKey", "classLevel",
    "pageNumber", "lessonNo", "sourceLineId", "sourceText", "promptText",
    "transcript", "durationMs", "expectedWordCount", "spokenWordCount",
    "matchedWordCount", "accuracyScore", "completenessScore",
    "relevanceScore", "fluencyScore", "overallScore", "wordsPerMinute",
    "attemptNumber", "missingItemsJson", "extraItemsJson",
    "replacementsJson", "evaluationVersion", "createdAt"
)
SELECT
    "id", "studentId", "practiceType", "bookKey", "classLevel",
    "pageNumber", "lessonNo", "sourceLineId", "sourceText", "promptText",
    "transcript", "durationMs", "expectedWordCount", "spokenWordCount",
    "matchedWordCount", "accuracyScore", "completenessScore",
    "relevanceScore", "fluencyScore", "overallScore", "wordsPerMinute",
    "attemptNumber", "missingItemsJson", "extraItemsJson",
    "replacementsJson", "evaluationVersion", "createdAt"
FROM "SpeakingAttempt";

DROP TABLE "SpeakingAttempt";
ALTER TABLE "SpeakingAttempt_new" RENAME TO "SpeakingAttempt";
CREATE INDEX "SpeakingAttempt_studentId_idx" ON "SpeakingAttempt"("studentId");
CREATE INDEX "SpeakingAttempt_practiceType_idx" ON "SpeakingAttempt"("practiceType");
CREATE INDEX "SpeakingAttempt_bookKey_pageNumber_idx" ON "SpeakingAttempt"("bookKey", "pageNumber");
CREATE INDEX "SpeakingAttempt_studentId_sourceLineId_idx" ON "SpeakingAttempt"("studentId", "sourceLineId");
CREATE INDEX "SpeakingAttempt_createdAt_idx" ON "SpeakingAttempt"("createdAt");

CREATE TABLE "StudentGoalSetting_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "targetPoints" INTEGER NOT NULL DEFAULT 60,
    "targetActivityTypes" INTEGER NOT NULL DEFAULT 3,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentGoalSetting_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "StudentGoalSetting_new" (
    "id", "studentId", "targetPoints", "targetActivityTypes", "timezone",
    "enabled", "createdAt", "updatedAt"
)
SELECT
    "id", "studentId", "targetPoints", "targetActivityTypes", "timezone",
    "enabled", "createdAt", "updatedAt"
FROM "StudentGoalSetting";

DROP TABLE "StudentGoalSetting";
ALTER TABLE "StudentGoalSetting_new" RENAME TO "StudentGoalSetting";
CREATE UNIQUE INDEX "StudentGoalSetting_studentId_key"
ON "StudentGoalSetting"("studentId");

CREATE TABLE "DailyGoalProgress_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyGoalProgress_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "DailyGoalProgress_new" (
    "id", "studentId", "dateKey", "pointsEarned",
    "distinctActivityTypes", "activityTypesJson", "quizAttempts",
    "gameAttempts", "spellingAttempts", "readAloudAttempts",
    "speakingAttempts", "completedAt", "createdAt", "updatedAt"
)
SELECT
    "id", "studentId", "dateKey", "pointsEarned",
    "distinctActivityTypes", "activityTypesJson", "quizAttempts",
    "gameAttempts", "spellingAttempts", "readAloudAttempts",
    "speakingAttempts", "completedAt", "createdAt", "updatedAt"
FROM "DailyGoalProgress";

DROP TABLE "DailyGoalProgress";
ALTER TABLE "DailyGoalProgress_new" RENAME TO "DailyGoalProgress";
CREATE UNIQUE INDEX "DailyGoalProgress_studentId_dateKey_key"
ON "DailyGoalProgress"("studentId", "dateKey");
CREATE INDEX "DailyGoalProgress_studentId_idx" ON "DailyGoalProgress"("studentId");
CREATE INDEX "DailyGoalProgress_dateKey_idx" ON "DailyGoalProgress"("dateKey");
CREATE INDEX "DailyGoalProgress_completedAt_idx" ON "DailyGoalProgress"("completedAt");

CREATE TABLE "RewardItem_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "costPoints" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "StudentReward_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "rewardItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME,
    CONSTRAINT "StudentReward_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentReward_rewardItemId_fkey"
      FOREIGN KEY ("rewardItemId") REFERENCES "RewardItem_new"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "RewardItem_new" (
    "id", "code", "name", "description", "rewardType", "costPoints",
    "active", "metadataJson", "createdAt", "updatedAt"
)
SELECT
    "id", "code", "name", "description", "rewardType", "costPoints",
    "active", "metadataJson", "createdAt", "updatedAt"
FROM "RewardItem";

INSERT INTO "StudentReward_new" (
    "id", "studentId", "rewardItemId", "quantity", "acquiredAt",
    "consumedAt"
)
SELECT
    "id", "studentId", "rewardItemId", "quantity", "acquiredAt",
    "consumedAt"
FROM "StudentReward";

DROP TABLE "StudentReward";
DROP TABLE "RewardItem";
ALTER TABLE "RewardItem_new" RENAME TO "RewardItem";
ALTER TABLE "StudentReward_new" RENAME TO "StudentReward";
CREATE UNIQUE INDEX "RewardItem_code_key" ON "RewardItem"("code");
CREATE INDEX "RewardItem_active_idx" ON "RewardItem"("active");
CREATE INDEX "RewardItem_costPoints_idx" ON "RewardItem"("costPoints");
CREATE UNIQUE INDEX "StudentReward_studentId_rewardItemId_key"
ON "StudentReward"("studentId", "rewardItemId");
CREATE INDEX "StudentReward_studentId_idx" ON "StudentReward"("studentId");
CREATE INDEX "StudentReward_rewardItemId_idx" ON "StudentReward"("rewardItemId");

PRAGMA foreign_keys=ON;
