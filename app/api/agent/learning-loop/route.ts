import { getSessionStudentKey } from "@/lib/auth";
import {
  generateStudyAid,
  isGeminiConfigured,
  normalizeStudyText,
  toGeminiAction,
} from "@/lib/gemini";
import { consumeAiRequestAllowance } from "@/lib/rewardSystem";
import { resolveStudySource } from "@/lib/local-ai/resolveStudySource";
import { LocalAiError } from "@/lib/local-ai/ollama";

export const runtime = "nodejs";

type RequestBody = {
  studentId?: string;
  studentKey?: string;
  lessonNo?: number | string;
  selectedLine?: string;
  text?: string;
  requestedTool?: string;
  action?: string;
  studentQuestion?: string;
  bookId?: string;
  pageNumber?: number | string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const studentKey = await getSessionStudentKey();
    if (!studentKey) {
      return Response.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const action = toGeminiAction(
      body.action ?? body.requestedTool ?? "explain",
    );
    const source = await resolveStudySource({
      bookId: body.bookId,
      pageNumber: body.pageNumber,
      lessonNo: body.lessonNo,
      selectedText: body.text ?? body.selectedLine,
    });
    const safeText = normalizeStudyText(source.selectedText);

    if (!isGeminiConfigured()) {
      return Response.json(
        { success: false, error: "AI service is not configured." },
        { status: 503 },
      );
    }

    const usage = await consumeAiRequestAllowance({
      studentKey,
      ...(source.lessonNo > 0 ? { lessonNo: source.lessonNo } : {}),
      toolUsed: "study_aid",
    });
    if (!usage.success) {
      return Response.json(
        { success: false, error: usage.error },
        { status: usage.status },
      );
    }

    const output = await generateStudyAid({
      action,
      text: safeText,
    });

    return Response.json({
      success: true,
      action,
      output,
      text: safeText,
      source: {
        bookId: source.bookId,
        pageNumber: source.pageNumber,
        classLevel: source.classLevel,
        lessonNo: source.lessonNo || null,
      },
    });
  } catch (error) {
    console.error(
      "[api/agent/learning-loop] AI failed",
      error instanceof Error ? error.name : "Unknown error",
    );

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Sorry, I couldn't generate the answer right now. Please try again.";
    const inputError = error instanceof LocalAiError ? error : null;

    return Response.json(
      {
        success: false,
        error:
          inputError ||
          message.includes("Please select") ||
          message.includes("too long")
            ? message
            : "Sorry, I couldn't generate the answer right now. Please try again.",
      },
      {
        status:
          inputError
            ? inputError.status
            : message.includes("Please select") || message.includes("too long")
              ? 400
              : 500,
      },
    );
  }
}
