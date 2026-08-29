import { generateStudyAid, toGeminiAction } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      requestedTool?: string;
      text?: string;
      selectedLine?: string;
      studentQuestion?: string;
    };

    const action = toGeminiAction(
      body.action ?? body.requestedTool ?? "explain",
    );
    const text = String(body.text ?? body.selectedLine ?? "").trim();

    if (!text) {
      return Response.json(
        {
          success: false,
          error: "Please select some text first.",
        },
        { status: 400 },
      );
    }

    const output = await generateStudyAid({ action, text });

    return Response.json({
      success: true,
      action,
      output,
      text,
    });
  } catch (error) {
    console.error("[api/ai] Gemini generation failed", error);

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Sorry, I couldn't generate the answer right now. Please try again.";

    return Response.json(
      {
        success: false,
        error:
          message.includes("Please select") || message.includes("too long")
            ? message
            : "Sorry, I couldn't generate the answer right now. Please try again.",
      },
      {
        status:
          message.includes("Please select") || message.includes("too long")
            ? 400
            : 500,
      },
    );
  }
}
