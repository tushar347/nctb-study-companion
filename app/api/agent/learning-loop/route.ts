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
  studentId: string;
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
You are an AI study companion for Class 6 English textbook learners in Bangladesh.

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

    if (
      !body.studentId ||
      !body.lessonNo ||
      !body.selectedLine ||
      !body.requestedTool
    ) {
      return Response.json(
        {
          error:
            "studentId, lessonNo, selectedLine, and requestedTool are required",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    const lessonContext = buildLessonContext(body.lessonNo, body.selectedLine);

    await updateMemoryAfterAgent({
      studentKey: body.studentId,
      lessonNo: body.lessonNo,
      selectedLine: body.selectedLine,
      toolUsed: body.requestedTool,
    });

    await logResearchEvent({
      studentKey: body.studentId,
      lessonNo: body.lessonNo,
      eventType: "agent_tool_request",
      selectedLine: body.selectedLine,
      toolUsed: body.requestedTool,
      metadata: {
        studentQuestion: body.studentQuestion ?? null,
      },
    });

    const memorySummary = await getMemorySummaryForAgent(body.studentId);

    if (!apiKey) {
      const fallback = fallbackAnswer(body.requestedTool, body.selectedLine);

      await saveChatMessage({
        studentKey: body.studentId,
        lessonNo: body.lessonNo,
        selectedLine: body.selectedLine,
        toolUsed: body.requestedTool,
        question: body.studentQuestion,
        answer: fallback.output,
        source: "fallback",
      });

      return Response.json({
        result: fallback,
        source: "fallback",
        memory: memorySummary,
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
        studentKey: body.studentId,
        lessonNo: body.lessonNo,
        selectedLine: body.selectedLine,
        toolUsed: body.requestedTool,
        question: body.studentQuestion,
        answer: fallback.output,
        source: "fallback",
      });

      return Response.json({
        result: fallback,
        source: "fallback",
        memory: memorySummary,
      });
    }

    const geminiData = (await geminiResponse.json()) as GeminiResponse;

    const output =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "No response generated.";

    await saveChatMessage({
      studentKey: body.studentId,
      lessonNo: body.lessonNo,
      selectedLine: body.selectedLine,
      toolUsed: body.requestedTool,
      question: body.studentQuestion,
      answer: output,
      source: "gemini",
    });

    return Response.json({
      result: {
        tool: body.requestedTool,
        output,
        selectedLine: body.selectedLine,
        lessonNo: body.lessonNo,
        lessonTitle: lessonContext.lessonTitle,
      },
      source: "gemini",
      memory: memorySummary,
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
