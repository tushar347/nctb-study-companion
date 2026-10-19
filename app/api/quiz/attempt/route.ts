import { NextResponse } from "next/server";
import { getSessionStudentKey } from "@/lib/auth";
import {
  isInvalidQuizSubmission,
  submitQuizAttempt,
} from "@/lib/quizAttempts";

export async function POST(request: Request) {
  try {
    const studentKey = await getSessionStudentKey();
    if (!studentKey) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 },
      );
    }
    const result = await submitQuizAttempt(studentKey, body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (isInvalidQuizSubmission(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }

    console.error("Quiz attempt submission failed:", error);
    return NextResponse.json(
      { success: false, error: "Quiz submission failed." },
      { status: 500 },
    );
  }
}
