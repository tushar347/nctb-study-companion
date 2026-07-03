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

    const rawLessonNo = body.lessonNo;
    const lessonNo =
      rawLessonNo === undefined || rawLessonNo === null || rawLessonNo === ""
        ? undefined
        : Number(rawLessonNo);

    const gameType = String(body.gameType ?? "grammar_game");
    const score = Number(body.score ?? 0);
    const total = Number(body.total ?? 0);
    const result = String(body.result ?? "");
    const sentence = String(body.sentence ?? "");
    const details = body.details ?? {};

    const student = await findOrCreateStudentByKey(studentKey);

    const attempt = await prisma.gameAttempt.create({
      data: {
        studentId: student.id,
        ...(lessonNo !== undefined ? { lessonNo } : {}),
        gameType,
        score,
        total,
        result,
        sentence,
        detailsJson: JSON.stringify(details),
      },
    });

    await incrementDailyStudyRecord({
      studentKey,
      gamesPlayed: 1,
      gameScore: score,
    });

    return NextResponse.json({
      success: true,
      attempt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Game attempt failed.",
      },
      { status: 500 },
    );
  }
}
