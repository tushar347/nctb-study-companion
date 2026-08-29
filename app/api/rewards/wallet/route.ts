import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateStudentWallet } from "@/lib/rewardSystem";
import { getSessionStudentKey } from "@/lib/auth";

export async function GET() {
  try {
    // Wallet balances and reward history are private — always resolve the
    // student from the session cookie, never from a query string, or any
    // visitor could read (and previously, via /api/debug/credits, top up)
    // another student's wallet just by guessing their key.
    const studentKey = await getSessionStudentKey();

    const { student, wallet } = await getOrCreateStudentWallet(studentKey);

    const recentTransactions = await prisma.rewardTransaction.findMany({
      where: {
        studentId: student.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      student: {
        studentKey: student.studentKey,
        name: student.name,
        classLevel: student.classLevel,
        section: student.section,
        rollNumber: student.rollNumber,
        schoolName: student.schoolName,
      },
      wallet,
      recentTransactions,
      pointRules: {
        pointsPerAiCredit: 10,
        correctQuizAnswer: 2,
        perfectQuizBonus: 5,
        correctGame: 10,
        wrongGamePractice: 1,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Wallet could not be loaded.",
      },
      { status: 500 },
    );
  }
}
