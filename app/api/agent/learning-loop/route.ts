import { useAiTeacherCredit } from "@/lib/rewardSystem";
import { buildLessonContext } from "@/lib/buildLessonContext";
import {
  getMemorySummaryForAgent,
  logResearchEvent,
  saveChatMessage,
  updateMemoryAfterAgent,
} from "@/lib/researchDb";

export const runtime = "nodejs";

type RequestedTool = "simple" | "bangla" | "grammar" | "quiz" | "chat";

type RequestBody = {
  studentId?: string;
  studentKey?: string;
  lessonNo: number;
  selectedLine: string;
  requestedTool: RequestedTool;
  studentQuestion?: string;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
};

function fallbackAnswer(tool: RequestedTool, selectedLine: string) {
  return {
    tool,
    output:
      "AI is not configured yet. Add GEMINI_API_KEY in .env.local and restart the server.",
    selectedLine,
  };
}

function buildPrompt({
  requestedTool,
  selectedLine,
  studentQuestion,
  lessonTitle,
  nearbyContext,
  memorySummary,
}: {
  requestedTool: RequestedTool;
  selectedLine: string;
  studentQuestion?: string;
  lessonTitle: string;
  nearbyContext: string;
  memorySummary: unknown;
}) {
  return `
You are an AI Teacher for Class 6 English textbook learners in Bangladesh.

Lesson title:
${lessonTitle}

Selected textbook line:
${selectedLine}

Nearby textbook context:
${nearbyContext}

Student memory summary:
${JSON.stringify(memorySummary, null, 2)}

Requested tool:
${requestedTool}

Student question:
${studentQuestion ?? "No extra question"}

Task:
Return a short, student-friendly answer.

Rules:
- If requestedTool is "simple", explain the line in very simple English.
- If requestedTool is "bangla", give the natural Bangla meaning of the selected line.
- If requestedTool is "grammar", teach grammar from the selected line like an English-medium literature-based grammar lesson.
- If requestedTool is "chat", answer the student's question using the selected line, nearby lesson context, and student memory.
- Use simple language for Class 6 students.
- Keep the answer focused and useful.
`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    const studentKey = String(body.studentKey ?? body.studentId ?? "").trim();

    if (
      !studentKey ||
      !body.lessonNo ||
      !body.selectedLine ||
      !body.requestedTool
    ) {
      return Response.json(
        {
          error:
            "studentKey/studentId, lessonNo, selectedLine, and requestedTool are required",
        },
        { status: 400 },
      );
    }

    /**
     * AI CREDIT SYSTEM
     * Every successful AI Teacher request uses 1 AI credit.
     * If the student has 0 credits, the request stops before generating an answer.
     */
    const creditResult = await useAiTeacherCredit({
      studentKey,
      lessonNo: Number(body.lessonNo),
      selectedLine: body.selectedLine,
      question: body.studentQuestion,
      toolUsed: body.requestedTool,
    });

    if (!creditResult.success) {
      return Response.json(
        {
          success: false,
          error: creditResult.error,
          wallet: creditResult.wallet,
          needsRedeem: true,
          message:
            "No AI Teacher credits left. Play quiz or grammar games to earn learning points, then redeem points for more AI Teacher credits.",
        },
        { status: 402 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    const lessonContext = buildLessonContext(
      Number(body.lessonNo),
      body.selectedLine,
    );

    await updateMemoryAfterAgent({
      studentKey,
      lessonNo: Number(body.lessonNo),
      selectedLine: body.selectedLine,
      toolUsed: body.requestedTool,
    });

    await logResearchEvent({
      studentKey,
      lessonNo: Number(body.lessonNo),
      eventType: "agent_tool_request",
      selectedLine: body.selectedLine,
      toolUsed: body.requestedTool,
      metadata: {
        studentQuestion: body.studentQuestion ?? null,
        aiCreditUsed: true,
      },
    });

    const memorySummary = await getMemorySummaryForAgent(studentKey);

    if (!apiKey) {
      const fallback = fallbackAnswer(body.requestedTool, body.selectedLine);

      await saveChatMessage({
        studentKey,
        lessonNo: Number(body.lessonNo),
        selectedLine: body.selectedLine,
        toolUsed: body.requestedTool,
        question: body.studentQuestion,
        answer: fallback.output,
        source: "fallback",
      });

      return Response.json({
        success: true,
        result: {
          ...fallback,
          lessonNo: Number(body.lessonNo),
          lessonTitle: lessonContext.lessonTitle,
        },
        source: "fallback",
        memory: memorySummary,
        wallet: creditResult.wallet,
        creditUsed: 1,
      });
    }

    const prompt = buildPrompt({
      requestedTool: body.requestedTool,
      selectedLine: body.selectedLine,
      studentQuestion: body.studentQuestion,
      lessonTitle: lessonContext.lessonTitle,
      nearbyContext: lessonContext.nearbyContext,
      memorySummary,
    });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const fallback = fallbackAnswer(body.requestedTool, body.selectedLine);

      await saveChatMessage({
        studentKey,
        lessonNo: Number(body.lessonNo),
        selectedLine: body.selectedLine,
        toolUsed: body.requestedTool,
        question: body.studentQuestion,
        answer: fallback.output,
        source: "fallback",
      });

      return Response.json({
        success: true,
        result: {
          ...fallback,
          lessonNo: Number(body.lessonNo),
          lessonTitle: lessonContext.lessonTitle,
        },
        source: "fallback",
        memory: memorySummary,
        wallet: creditResult.wallet,
        creditUsed: 1,
      });
    }

    const geminiData = (await geminiResponse.json()) as GeminiResponse;

    const output =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "No response generated.";

    await saveChatMessage({
      studentKey,
      lessonNo: Number(body.lessonNo),
      selectedLine: body.selectedLine,
      toolUsed: body.requestedTool,
      question: body.studentQuestion,
      answer: output,
      source: "gemini",
    });

    return Response.json({
      success: true,
      result: {
        tool: body.requestedTool,
        output,
        selectedLine: body.selectedLine,
        lessonNo: Number(body.lessonNo),
        lessonTitle: lessonContext.lessonTitle,
      },
      source: "gemini",
      memory: memorySummary,
      wallet: creditResult.wallet,
      creditUsed: 1,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Agentic learning loop failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
