import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateStudentWallet } from "@/lib/rewardSystem";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentKey = searchParams.get("studentKey") ?? "demo-student";

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
