import { readFile } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  findOrCreateStudentByKey,
} from "@/lib/studentTracking";
import {
  evaluateSpelling,
  extractSpellingCandidates,
  normalizeSpelling,
  type SpellingInputMode,
} from "@/lib/practice/spelling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BOOKS = new Set([
  "class6-english",
  "class7-english",
  "class8-english",
]);

type OcrLine = {
  id?: string;
  text?: string;
  cleanText?: string;
};

type OcrPage = {
  lines?: OcrLine[];
  aiReadyLines?: OcrLine[];
};

async function resolveStudentKey(
  bodyStudentKey: unknown,
) {
  const cookieStore = await cookies();

  return (
    cookieStore
      .get("nctb_student_key")
      ?.value.trim() ||
    String(bodyStudentKey ?? "").trim() ||
    "demo-student"
  );
}

function lineText(line: OcrLine) {
  return String(
    line.cleanText ?? line.text ?? "",
  ).trim();
}

async function loadOcrPage(
  bookId: string,
  pageNumber: number,
) {
  const fileName =
    `page-${String(pageNumber).padStart(3, "0")}.json`;

  const pagePath = path.join(
    process.cwd(),
    "public",
    "ocr",
    "books",
    bookId,
    "pages",
    fileName,
  );

  const raw = await readFile(pagePath, "utf8");

  return JSON.parse(
    raw.replace(/^\uFEFF/, ""),
  ) as OcrPage;
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as {
        studentKey?: unknown;
        bookId?: unknown;
        classLevel?: unknown;
        pageNumber?: unknown;
        lessonNo?: unknown;
        sourceLineId?: unknown;
        targetWord?: unknown;
        submittedAnswer?: unknown;
        inputMode?: unknown;
        responseTimeMs?: unknown;
      };

    const studentKey =
      await resolveStudentKey(
        body.studentKey,
      );

    const bookId = String(
      body.bookId ?? "",
    ).trim();

    const pageNumber = Number(
      body.pageNumber,
    );

    const classLevel = Number(
      body.classLevel,
    );

    const lessonNoValue = Number(
      body.lessonNo,
    );

    const lessonNo =
      Number.isInteger(lessonNoValue) &&
      lessonNoValue > 0
        ? lessonNoValue
        : null;

    const sourceLineId = String(
      body.sourceLineId ?? "",
    ).trim();

    const targetWord = normalizeSpelling(
      body.targetWord,
    );

    const submittedAnswer = String(
      body.submittedAnswer ?? "",
    ).trim();

    const inputMode: SpellingInputMode =
      body.inputMode === "voice"
        ? "voice"
        : "typed";

    const responseTimeValue = Number(
      body.responseTimeMs,
    );

    const responseTimeMs =
      Number.isInteger(responseTimeValue) &&
      responseTimeValue >= 0 &&
      responseTimeValue <= 30 * 60 * 1000
        ? responseTimeValue
        : null;

    if (!ALLOWED_BOOKS.has(bookId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected textbook is not supported.",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid OCR page is required.",
        },
        { status: 400 },
      );
    }

    if (!targetWord) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The target word is missing.",
        },
        { status: 400 },
      );
    }

    if (!submittedAnswer) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter or speak a spelling before submitting.",
        },
        { status: 400 },
      );
    }

    const page = await loadOcrPage(
      bookId,
      pageNumber,
    );

    const lines =
      page.aiReadyLines &&
      page.aiReadyLines.length > 0
        ? page.aiReadyLines
        : page.lines ?? [];

    const selectedLine =
      sourceLineId
        ? lines.find(
            (line) =>
              String(line.id ?? "") === sourceLineId,
          ) ?? null
        : null;

    const selectedText =
      selectedLine
        ? lineText(selectedLine)
        : "";

    const pageText = lines
      .map(lineText)
      .filter(Boolean)
      .join("\n");

    const selectedTargets =
      extractSpellingCandidates(
        selectedText,
      );

    const pageTargets =
      extractSpellingCandidates(
        pageText,
      );

    const targetUsesSelectedLine =
      selectedTargets.includes(
        targetWord,
      );

    const targetUsesPage =
      pageTargets.includes(
        targetWord,
      );

    if (
      !targetUsesSelectedLine &&
      !targetUsesPage
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The target word is not grounded in the textbook OCR source.",
        },
        { status: 422 },
      );
    }

    const authoritativeText =
      targetUsesSelectedLine
        ? selectedText
        : pageText;

    const groundedSourceLineId =
      targetUsesSelectedLine
        ? sourceLineId || null
        : null;

    const evaluation = evaluateSpelling(
      targetWord,
      submittedAnswer,
    );

    const student =
      await findOrCreateStudentByKey(
        studentKey,
      );

    const previousAttempts =
      await prisma.spellingAttempt.count({
        where: {
          studentId: student.id,
          bookKey: bookId,
          pageNumber,
          targetWord,
        },
      });

    const attemptNumber = previousAttempts + 1;

    const [attempt] =
      await prisma.$transaction([
        prisma.spellingAttempt.create({
          data: {
            studentId: student.id,
            bookKey: bookId,
            classLevel:
              Number.isInteger(classLevel) &&
              classLevel > 0
                ? classLevel
                : null,
            pageNumber,
            lessonNo,
            sourceLineId:
              groundedSourceLineId,
            sourceText:
              authoritativeText.slice(0, 4000),
            targetWord,
            submittedAnswer,
            normalizedAnswer:
              evaluation.normalizedAnswer,
            inputMode,
            isCorrect: evaluation.isCorrect,
            accuracy: evaluation.accuracy,
            responseTimeMs,
            attemptNumber,
            missingLettersJson:
              JSON.stringify(
                evaluation.missingLetters,
              ),
            extraLettersJson:
              JSON.stringify(
                evaluation.extraLetters,
              ),
            substitutionsJson:
              JSON.stringify(
                evaluation.substitutions,
              ),
          },
        }),
        prisma.researchEvent.create({
          data: {
            studentId: student.id,
            lessonNo,
            eventType: "SPELLING_ATTEMPT",
            selectedLine:
              authoritativeText.slice(0, 1000),
            toolUsed: inputMode,
            score: evaluation.accuracy,
            total: 100,
            metadataJson:
              JSON.stringify({
                bookId,
                pageNumber,
                sourceLineId:
                  groundedSourceLineId,
                sourceScope:
                  targetUsesSelectedLine
                    ? "selected-line"
                    : "page",
                targetWord,
                attemptNumber,
                isCorrect:
                  evaluation.isCorrect,
              }),
          },
        }),
      ]);

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      attemptNumber,
      evaluation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Spelling attempt could not be saved.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const studentKey =
      await resolveStudentKey(
        url.searchParams.get("studentKey"),
      );

    const bookId =
      url.searchParams
        .get("bookId")
        ?.trim() || undefined;

    const pageValue = Number(
      url.searchParams.get("pageNumber"),
    );

    const pageNumber =
      Number.isInteger(pageValue) &&
      pageValue > 0
        ? pageValue
        : undefined;

    const student =
      await findOrCreateStudentByKey(
        studentKey,
      );

    const attempts =
      await prisma.spellingAttempt.findMany({
        where: {
          studentId: student.id,
          ...(bookId
            ? { bookKey: bookId }
            : {}),
          ...(pageNumber
            ? { pageNumber }
            : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
        select: {
          id: true,
          bookKey: true,
          pageNumber: true,
          targetWord: true,
          normalizedAnswer: true,
          inputMode: true,
          isCorrect: true,
          accuracy: true,
          attemptNumber: true,
          createdAt: true,
        },
      });

    return NextResponse.json({
      success: true,
      attempts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Spelling history could not be loaded.",
      },
      { status: 500 },
    );
  }
}
