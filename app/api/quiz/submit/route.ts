import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findOrCreateStudentByKey,
  incrementDailyStudyRecord,
} from "@/lib/studentTracking";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const studentKey = String(
      body.studentKey ?? body.studentId ?? "demo-student",
    );
    const lessonNo = Number(body.lessonNo ?? 1);
    const lessonTitle = String(body.lessonTitle ?? "");
    const score = Number(body.score ?? 0);
    const total = Number(body.total ?? 0);

    const wrongAnswers = body.wrongAnswers ?? [];
    const weakAreas = body.weakAreas ?? [];
    const submittedAnswers = body.submittedAnswers ?? [];

    const student = await findOrCreateStudentByKey(studentKey);

    const attempt = await prisma.quizAttempt.create({
      data: {
        studentId: student.id,
        lessonNo,
        lessonTitle,
        score,
        total,
        wrongAnswersJson: JSON.stringify(wrongAnswers),
        weakAreasJson: JSON.stringify(weakAreas),
        submittedAnswersJson: JSON.stringify(submittedAnswers),
      },
    });

    await incrementDailyStudyRecord({
      studentKey,
      quizAttempts: 1,
      quizScore: score,
      quizTotal: total,
    });

    return NextResponse.json({
      success: true,
      attempt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Quiz submit failed.",
      },
      { status: 500 },
    );
  }
}
