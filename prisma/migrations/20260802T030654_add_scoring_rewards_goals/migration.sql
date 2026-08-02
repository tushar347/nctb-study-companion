ALTER TABLE "RewardTransaction"
ADD COLUMN "sourceType" TEXT;

ALTER TABLE "RewardTransaction"
ADD COLUMN "sourceId" TEXT;

ALTER TABLE "RewardTransaction"
ADD COLUMN "idempotencyKey" TEXT;

ALTER TABLE "RewardTransaction"
ADD COLUMN "balanceAfter" INTEGER;

CREATE UNIQUE INDEX "RewardTransaction_idempotencyKey_key"
ON "RewardTransaction"("idempotencyKey");

CREATE INDEX "RewardTransaction_sourceType_sourceId_idx"
ON "RewardTransaction"("sourceType", "sourceId");

CREATE TABLE "StudentGoalSetting" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetPoints" INTEGER NOT NULL DEFAULT 60,
    "targetActivityTypes" INTEGER NOT NULL DEFAULT 3,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGoalSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentGoalSetting_studentId_key"
ON "StudentGoalSetting"("studentId");

ALTER TABLE "StudentGoalSetting"
ADD CONSTRAINT "StudentGoalSetting_studentId_fkey"
FOREIGN KEY ("studentId")
REFERENCES "Student"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyGoalProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyGoalProgress_studentId_dateKey_key"
ON "DailyGoalProgress"("studentId", "dateKey");

CREATE INDEX "DailyGoalProgress_studentId_idx"
ON "DailyGoalProgress"("studentId");

CREATE INDEX "DailyGoalProgress_dateKey_idx"
ON "DailyGoalProgress"("dateKey");

CREATE INDEX "DailyGoalProgress_completedAt_idx"
ON "DailyGoalProgress"("completedAt");

ALTER TABLE "DailyGoalProgress"
ADD CONSTRAINT "DailyGoalProgress_studentId_fkey"
FOREIGN KEY ("studentId")
REFERENCES "Student"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardItem_code_key"
ON "RewardItem"("code");

CREATE INDEX "RewardItem_active_idx"
ON "RewardItem"("active");

CREATE INDEX "RewardItem_costPoints_idx"
ON "RewardItem"("costPoints");

CREATE TABLE "StudentReward" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rewardItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "StudentReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentReward_studentId_rewardItemId_key"
ON "StudentReward"("studentId", "rewardItemId");

CREATE INDEX "StudentReward_studentId_idx"
ON "StudentReward"("studentId");

CREATE INDEX "StudentReward_rewardItemId_idx"
ON "StudentReward"("rewardItemId");

ALTER TABLE "StudentReward"
ADD CONSTRAINT "StudentReward_studentId_fkey"
FOREIGN KEY ("studentId")
REFERENCES "Student"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "StudentReward"
ADD CONSTRAINT "StudentReward_rewardItemId_fkey"
FOREIGN KEY ("rewardItemId")
REFERENCES "RewardItem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
