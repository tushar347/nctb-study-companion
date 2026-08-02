import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getBangladeshDateKey } from "@/lib/studentTracking";

import {
  readAloudPoints,
  speakingPoints,
  spellingPoints,
  type ScoringActivity,
} from "@/lib/scoring/policy";

export type AwardAttemptResult = {
  activityType: ScoringActivity;
  rawPoints: number;
  previousBest: number;
  pointsAwarded: number;
  maximumPoints: number;
  walletBalance: number;
  duplicate: boolean;
  dailyGoal: {
    dateKey: string;
    pointsEarned: number;
    targetPoints: number;
    activityTypes: string[];
    targetActivityTypes: number;
    completed: boolean;
  };
};

function parseStringArray(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "[]");

    return Array.isArray(parsed)
      ? parsed.map(String).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function sourceHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

async function resolveAttempt(
  studentId: string,
  activityType: "SPELLING" | "READ_ALOUD" | "SPEAKING",
  attemptId: string,
) {
  if (activityType === "SPELLING") {
    const attempt = await prisma.spellingAttempt.findFirst({
      where: {
        id: attemptId,
        studentId,
      },
    });

    if (!attempt) {
      throw new Error("The spelling attempt was not found.");
    }

    const points = spellingPoints(
      attempt.accuracy,
      attempt.isCorrect,
    );

    return {
      rawPoints: points.total,
      maximumPoints: points.maximum,
      sourceId: [
        attempt.bookKey,
        attempt.pageNumber,
        attempt.targetWord,
      ].join(":"),
    };
  }

  const practiceType =
    activityType === "READ_ALOUD"
      ? "READ_ALOUD"
      : "SPEAKING_PRACTICE";

  const attempt = await prisma.speakingAttempt.findFirst({
    where: {
      id: attemptId,
      studentId,
      practiceType,
    },
  });

  if (!attempt) {
    throw new Error("The speaking attempt was not found.");
  }

  if (activityType === "READ_ALOUD") {
    const points = readAloudPoints(
      attempt.accuracyScore ?? 0,
      attempt.completenessScore ?? 0,
    );

    return {
      rawPoints: points.total,
      maximumPoints: points.maximum,
      sourceId: [
        attempt.bookKey,
        attempt.pageNumber,
        attempt.sourceLineId ?? attempt.id,
      ].join(":"),
    };
  }

  const points = speakingPoints(
    attempt.relevanceScore ?? 0,
    attempt.completenessScore ?? 0,
    attempt.fluencyScore,
  );

  return {
    rawPoints: points.total,
    maximumPoints: points.maximum,
    sourceId: [
      attempt.bookKey,
      attempt.pageNumber,
      attempt.sourceLineId ?? attempt.id,
      sourceHash(attempt.promptText ?? ""),
    ].join(":"),
  };
}

function activityIncrement(
  activityType: "SPELLING" | "READ_ALOUD" | "SPEAKING",
) {
  if (activityType === "SPELLING") {
    return {
      spellingAttempts: {
        increment: 1,
      },
    };
  }

  if (activityType === "READ_ALOUD") {
    return {
      readAloudAttempts: {
        increment: 1,
      },
    };
  }

  return {
    speakingAttempts: {
      increment: 1,
    },
  };
}

export async function awardAttemptPoints(input: {
  studentId: string;
  activityType: "SPELLING" | "READ_ALOUD" | "SPEAKING";
  attemptId: string;
}): Promise<AwardAttemptResult> {
  const attemptData = await resolveAttempt(
    input.studentId,
    input.activityType,
    input.attemptId,
  );

  const dateKey = getBangladeshDateKey();
  const idempotencyKey = [
    "ACTIVITY",
    input.activityType,
    input.attemptId,
  ].join(":");

  const existing = await prisma.rewardTransaction.findUnique({
    where: {
      idempotencyKey,
    },
  });

  if (existing) {
    const [wallet, setting, progress] = await Promise.all([
      prisma.studentWallet.upsert({
        where: {
          studentId: input.studentId,
        },
        update: {},
        create: {
          studentId: input.studentId,
        },
      }),
      prisma.studentGoalSetting.upsert({
        where: {
          studentId: input.studentId,
        },
        update: {},
        create: {
          studentId: input.studentId,
        },
      }),
      prisma.dailyGoalProgress.findUnique({
        where: {
          studentId_dateKey: {
            studentId: input.studentId,
            dateKey,
          },
        },
      }),
    ]);

    const activityTypes = parseStringArray(
      progress?.activityTypesJson,
    );

    return {
      activityType: input.activityType,
      rawPoints: attemptData.rawPoints,
      previousBest: Math.max(
        0,
        attemptData.rawPoints - existing.pointsChange,
      ),
      pointsAwarded: existing.pointsChange,
      maximumPoints: attemptData.maximumPoints,
      walletBalance: wallet.learningPoints,
      duplicate: true,
      dailyGoal: {
        dateKey,
        pointsEarned: progress?.pointsEarned ?? 0,
        targetPoints: setting.targetPoints,
        activityTypes,
        targetActivityTypes: setting.targetActivityTypes,
        completed: Boolean(progress?.completedAt),
      },
    };
  }

  return prisma.$transaction(
    async (tx) => {
      const previous = await tx.rewardTransaction.aggregate({
        where: {
          studentId: input.studentId,
          type: "EARN_ACTIVITY_POINTS",
          sourceType: input.activityType,
          sourceId: attemptData.sourceId,
        },
        _sum: {
          pointsChange: true,
        },
      });

      const previousBest = Math.max(
        0,
        previous._sum.pointsChange ?? 0,
      );

      const pointsAwarded = Math.max(
        0,
        attemptData.rawPoints - previousBest,
      );

      const setting = await tx.studentGoalSetting.upsert({
        where: {
          studentId: input.studentId,
        },
        update: {},
        create: {
          studentId: input.studentId,
        },
      });

      const existingProgress =
        await tx.dailyGoalProgress.findUnique({
          where: {
            studentId_dateKey: {
              studentId: input.studentId,
              dateKey,
            },
          },
        });

      const activityTypes = Array.from(
        new Set([
          ...parseStringArray(
            existingProgress?.activityTypesJson,
          ),
          input.activityType,
        ]),
      );

      const nextPoints =
        (existingProgress?.pointsEarned ?? 0) +
        pointsAwarded;

      const completed =
        nextPoints >= setting.targetPoints &&
        activityTypes.length >= setting.targetActivityTypes;

      const wallet = await tx.studentWallet.upsert({
        where: {
          studentId: input.studentId,
        },
        update: {
          learningPoints: {
            increment: pointsAwarded,
          },
          lifetimePointsEarned: {
            increment: pointsAwarded,
          },
        },
        create: {
          studentId: input.studentId,
          learningPoints: pointsAwarded,
          lifetimePointsEarned: pointsAwarded,
        },
      });

      await tx.rewardTransaction.create({
        data: {
          studentId: input.studentId,
          type: "EARN_ACTIVITY_POINTS",
          pointsChange: pointsAwarded,
          creditsChange: 0,
          reason:
            pointsAwarded > 0
              ? `Earned ${pointsAwarded} learning point(s) from ${input.activityType.toLowerCase().replaceAll("_", " ")}.`
              : "Attempt saved with no additional points because it did not improve the previous best.",
          metadataJson: JSON.stringify({
            rawPoints: attemptData.rawPoints,
            maximumPoints: attemptData.maximumPoints,
            previousBest,
            improvementOnly: true,
          }),
          sourceType: input.activityType,
          sourceId: attemptData.sourceId,
          idempotencyKey,
          balanceAfter: wallet.learningPoints,
        },
      });

      const progress = await tx.dailyGoalProgress.upsert({
        where: {
          studentId_dateKey: {
            studentId: input.studentId,
            dateKey,
          },
        },
        update: {
          pointsEarned: {
            increment: pointsAwarded,
          },
          activityTypesJson: JSON.stringify(activityTypes),
          distinctActivityTypes: activityTypes.length,
          ...activityIncrement(input.activityType),
          completedAt: completed
            ? existingProgress?.completedAt ?? new Date()
            : null,
        },
        create: {
          studentId: input.studentId,
          dateKey,
          pointsEarned: pointsAwarded,
          activityTypesJson: JSON.stringify(activityTypes),
          distinctActivityTypes: activityTypes.length,
          spellingAttempts:
            input.activityType === "SPELLING" ? 1 : 0,
          readAloudAttempts:
            input.activityType === "READ_ALOUD" ? 1 : 0,
          speakingAttempts:
            input.activityType === "SPEAKING" ? 1 : 0,
          completedAt: completed ? new Date() : null,
        },
      });

      return {
        activityType: input.activityType,
        rawPoints: attemptData.rawPoints,
        previousBest,
        pointsAwarded,
        maximumPoints: attemptData.maximumPoints,
        walletBalance: wallet.learningPoints,
        duplicate: false,
        dailyGoal: {
          dateKey,
          pointsEarned: progress.pointsEarned,
          targetPoints: setting.targetPoints,
          activityTypes,
          targetActivityTypes: setting.targetActivityTypes,
          completed: Boolean(progress.completedAt),
        },
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
