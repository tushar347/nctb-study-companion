import { NextResponse } from "next/server";
import { incrementDailyStudyRecord } from "@/lib/studentTracking";
import { getSessionStudentKey } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Study activity is recorded against the logged-in student, not
    // whatever key the client sends.
    const studentKey = await getSessionStudentKey();
    const activityType = String(body.activityType ?? "");

    if (!activityType) {
      return NextResponse.json(
        {
          error: "activityType is required.",
        },
        { status: 400 },
      );
    }

    const increment = {
      studentKey,
      lessonsOpened: activityType === "lesson_opened" ? 1 : 0,
      linesSelected: activityType === "line_selected" ? 1 : 0,
      aiInteractions: activityType === "ai_interaction" ? 1 : 0,
      minutesStudied: Number(body.minutesStudied ?? 0),
    };

    const record = await incrementDailyStudyRecord(increment);

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Study tracking failed.",
      },
      { status: 500 },
    );
  }
}
