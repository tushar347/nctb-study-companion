import { NextResponse } from "next/server";
import { ocrBook } from "@/data/ocrBook";

export const dynamic = "force-dynamic";

type OcrLesson = {
  lessonNo: number;
  lessonTitle?: string;
  text?: string;
  lines?: string[];
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function cleanLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 25)
    .filter((line) => !line.toLowerCase().startsWith("image:"))
    .filter((line) => !line.toLowerCase().includes("choose the best answer"))
    .slice(0, 80);
}

function pickRandom<T>(items: T[], count: number) {
  return shuffle(items).slice(0, count);
}

function detectWeakArea(text: string) {
  const lower = text.toLowerCase();

  if (
    lower.includes("is ") ||
    lower.includes("are ") ||
    lower.includes("was ") ||
    lower.includes("were ") ||
    lower.includes("have ") ||
    lower.includes("has ")
  ) {
    return "Grammar";
  }

  if (text.length < 45) {
    return "Vocabulary";
  }

  return "Reading comprehension";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lessonNo = Number(body.lessonNo ?? 1);

    const lesson = (ocrBook.lessons as OcrLesson[]).find(
      (item) => item.lessonNo === lessonNo,
    );

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    const lessonText =
      lesson.text ??
      (Array.isArray(lesson.lines) ? lesson.lines.join("\n") : "");

    const lines = cleanLines(lessonText);

    if (lines.length < 4) {
      return NextResponse.json(
        { error: "Not enough lesson text to generate quiz." },
        { status: 400 },
      );
    }

    const selectedLines = pickRandom(lines, Math.min(5, lines.length));

    const questions = selectedLines.map((correctLine, index) => {
      const distractors = pickRandom(
        lines.filter((line) => line !== correctLine),
        3,
      );

      const options = shuffle([correctLine, ...distractors]);

      return {
        id: `${lessonNo}-${Date.now()}-${index + 1}`,
        question: "Which sentence belongs to this lesson?",
        context: `Lesson ${lessonNo}: ${lesson.lessonTitle ?? "English For Today"}`,
        options,
        correctAnswer: correctLine,
        explanation: `The correct answer is taken directly from Lesson ${lessonNo}.`,
        weakArea: detectWeakArea(correctLine),
      };
    });

    return NextResponse.json({
      lessonNo,
      lessonTitle: lesson.lessonTitle,
      questions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Quiz generation failed.",
      },
      { status: 500 },
    );
  }
}
