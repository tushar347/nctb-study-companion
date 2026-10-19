import { prisma } from "@/lib/prisma";
import { isAiCreditLimitEnabled } from "@/lib/featureFlags";
import { findOrCreateStudentByKey } from "@/lib/studentTracking";

export const POINTS_PER_AI_CREDIT = 10;
const AI_REQUESTS_PER_HOUR = 20;

export async function getOrCreateStudentWallet(studentKey: string) {
  const student = await findOrCreateStudentByKey(studentKey);

  const wallet = await prisma.studentWallet.upsert({
    where: {
      studentId: student.id,
    },
    update: {},
    create: {
      studentId: student.id,
      aiCredits: 5,
      learningPoints: 0,
      lifetimePointsEarned: 0,
      lifetimeCreditsUsed: 0,
    },
  });

  return {
    student,
    wallet,
  };
}

export async function awardLearningPoints(input: {
  studentKey: string;
  points: number;
  reason: string;
  metadata?: unknown;
}) {
  const points = Math.max(0, Math.floor(input.points));

  const { student } = await getOrCreateStudentWallet(input.studentKey);

  const wallet = await prisma.studentWallet.update({
    where: {
      studentId: student.id,
    },
    data: {
      learningPoints: {
        increment: points,
      },
      lifetimePointsEarned: {
        increment: points,
      },
    },
  });

  const transaction = await prisma.rewardTransaction.create({
    data: {
      studentId: student.id,
      type: "EARN_POINTS",
      pointsChange: points,
      creditsChange: 0,
      reason: input.reason,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return {
    student,
    wallet,
    transaction,
    pointsAwarded: points,
  };
}

export async function redeemPointsForAiCredits(input: {
  studentKey: string;
  credits: number;
}) {
  const credits = Math.max(1, Math.floor(input.credits));
  const pointsNeeded = credits * POINTS_PER_AI_CREDIT;

  const { student, wallet } = await getOrCreateStudentWallet(input.studentKey);

  if (wallet.learningPoints < pointsNeeded) {
    return {
      success: false,
      error: `Not enough learning points. Need ${pointsNeeded} points for ${credits} AI credit(s).`,
      wallet,
      pointsNeeded,
    };
  }

  const updatedWallet = await prisma.studentWallet.update({
    where: {
      studentId: student.id,
    },
    data: {
      learningPoints: {
        decrement: pointsNeeded,
      },
      aiCredits: {
        increment: credits,
      },
    },
  });

  const transaction = await prisma.rewardTransaction.create({
    data: {
      studentId: student.id,
      type: "REDEEM_POINTS",
      pointsChange: -pointsNeeded,
      creditsChange: credits,
      reason: `Redeemed ${pointsNeeded} learning points for ${credits} AI credit(s).`,
    },
  });

  return {
    success: true,
    student,
    wallet: updatedWallet,
    transaction,
    pointsUsed: pointsNeeded,
    creditsAdded: credits,
  };
}

export async function consumeAiRequestAllowance(input: {
  studentKey: string;
  lessonNo?: number;
  selectedLine?: string;
  question?: string;
  toolUsed?: string;
}) {
  const { student } = await getOrCreateStudentWallet(input.studentKey);
  const creditsEnabled = isAiCreditLimitEnabled();
  const windowStart = new Date(Date.now() - 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const requestCount = await tx.aiUsageLog.count({
      where: {
        studentId: student.id,
        createdAt: { gte: windowStart },
      },
    });

    if (requestCount >= AI_REQUESTS_PER_HOUR) {
      return {
        success: false as const,
        error: "AI request limit reached. Please try again later.",
        status: 429,
      };
    }

    let wallet = await tx.studentWallet.findUniqueOrThrow({
      where: { studentId: student.id },
    });
    let creditsUsed = 0;

    if (creditsEnabled) {
      const updated = await tx.studentWallet.updateMany({
        where: {
          studentId: student.id,
          aiCredits: { gt: 0 },
        },
        data: {
          aiCredits: { decrement: 1 },
          lifetimeCreditsUsed: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        return {
          success: false as const,
          error: "No AI credits remain. Earn or redeem credits to continue.",
          status: 402,
        };
      }

      creditsUsed = 1;
      wallet = await tx.studentWallet.findUniqueOrThrow({
        where: { studentId: student.id },
      });
    }

    await tx.aiUsageLog.create({
      data: {
        studentId: student.id,
        lessonNo: input.lessonNo,
        toolUsed: input.toolUsed,
        creditsUsed,
      },
    });

    return {
      success: true as const,
      student,
      wallet,
      unlimited: !creditsEnabled,
    };
  });
}
