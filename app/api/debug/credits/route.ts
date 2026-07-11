import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const studentKey = String(body.studentKey ?? "").trim();
    const credits = Number(body.credits ?? 50);

    if (!studentKey) {
      return NextResponse.json(
        { error: "studentKey is required." },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { studentKey },
    });

    if (!student) {
      return NextResponse.json(
        { error: `Student not found: ${studentKey}` },
        { status: 404 }
      );
    }

    const wallet = await prisma.studentWallet.upsert({
      where: {
        studentId: student.id,
      },
      update: {
        aiCredits: {
          increment: credits,
        },
      },
      create: {
        studentId: student.id,
        aiCredits: credits,
        learningPoints: 0,
        lifetimePointsEarned: 0,
        lifetimeCreditsUsed: 0,
      },
    });

    await prisma.rewardTransaction.create({
      data: {
        studentId: student.id,
        type: "ADMIN_ADD_CREDITS",
        pointsChange: 0,
        creditsChange: credits,
        reason: `Added ${credits} AI Teacher credits manually for demo.`,
      },
    });

    return NextResponse.json({
      success: true,
      student: {
        name: student.name,
        studentKey: student.studentKey,
      },
      wallet,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Credit update failed.",
      },
      { status: 500 }
    );
  }
}