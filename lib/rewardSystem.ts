import { prisma } from "@/lib/prisma";
import { findOrCreateStudentByKey } from "@/lib/studentTracking";

export const POINTS_PER_AI_CREDIT = 10;

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

export async function useAiTeacherCredit(input: {
  studentKey: string;
  lessonNo?: number;
  selectedLine?: string;
  question?: string;
  toolUsed?: string;
}) {
  const { student, wallet } = await getOrCreateStudentWallet(input.studentKey);

  if (wallet.aiCredits <= 0) {
    return {
      success: false,
      error:
        "No AI Teacher credits left. Play quiz or grammar games to earn points, then redeem points for more AI credits.",
      wallet,
    };
  }

  const updatedWallet = await prisma.studentWallet.update({
    where: {
      studentId: student.id,
    },
    data: {
      aiCredits: {
        decrement: 1,
      },
      lifetimeCreditsUsed: {
        increment: 1,
      },
    },
  });

  const usageLog = await prisma.aiUsageLog.create({
    data: {
      studentId: student.id,
      lessonNo: input.lessonNo,
      selectedLine: input.selectedLine,
      question: input.question,
      toolUsed: input.toolUsed,
      creditsUsed: 1,
    },
  });

  const transaction = await prisma.rewardTransaction.create({
    data: {
      studentId: student.id,
      type: "USE_AI_CREDIT",
      pointsChange: 0,
      creditsChange: -1,
      reason: `Used 1 AI Teacher credit for ${input.toolUsed ?? "AI Teacher"}.`,
      metadataJson: JSON.stringify({
        lessonNo: input.lessonNo,
        selectedLine: input.selectedLine,
        question: input.question,
        toolUsed: input.toolUsed,
      }),
    },
  });

  return {
    success: true,
    student,
    wallet: updatedWallet,
    usageLog,
    transaction,
  };
}
