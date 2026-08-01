import {
  readFile,
} from "fs/promises";

import path from "path";

import {
  cookies,
} from "next/headers";

import {
  NextResponse,
} from "next/server";

import {
  prisma,
} from "@/lib/prisma";

import {
  evaluateReadAloud,
} from "@/lib/practice/voiceEvaluation";

import {
  findOrCreateStudentByKey,
} from "@/lib/studentTracking";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const ALLOWED_BOOKS =
  new Set([
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

async function studentKey(
  value: unknown,
) {
  const cookieStore =
    await cookies();

  return (
    cookieStore
      .get(
        "nctb_student_key",
      )
      ?.value.trim() ||
    String(value ?? "").trim() ||
    "demo-student"
  );
}

async function loadPage(
  bookId: string,
  pageNumber: number,
) {
  const fileName =
    `page-${String(
      pageNumber,
    ).padStart(
      3,
      "0",
    )}.json`;

  const raw =
    await readFile(
      path.join(
        process.cwd(),
        "public",
        "ocr",
        "books",
        bookId,
        "pages",
        fileName,
      ),
      "utf8",
    );

  return JSON.parse(
    raw.replace(
      /^\uFEFF/,
      "",
    ),
  ) as OcrPage;
}

function lineText(
  line: OcrLine,
) {
  return String(
    line.cleanText ??
      line.text ??
      "",
  ).trim();
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        studentKey?: unknown;
        bookId?: unknown;
        classLevel?: unknown;
        pageNumber?: unknown;
        lessonNo?: unknown;
        sourceLineId?: unknown;
        transcript?: unknown;
        durationMs?: unknown;
      };

    const resolvedStudentKey =
      await studentKey(
        body.studentKey,
      );

    const bookId =
      String(
        body.bookId ?? "",
      ).trim();

    const pageNumber =
      Number(
        body.pageNumber,
      );

    const sourceLineId =
      String(
        body.sourceLineId ??
          "",
      ).trim();

    const transcript =
      String(
        body.transcript ??
          "",
      ).trim();

    if (
      !ALLOWED_BOOKS.has(
        bookId,
      ) ||
      !Number.isInteger(
        pageNumber,
      ) ||
      pageNumber < 1 ||
      !sourceLineId ||
      !transcript
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Book, OCR page, selected line, and transcript are required.",
        },
        {
          status: 400,
        },
      );
    }

    const page =
      await loadPage(
        bookId,
        pageNumber,
      );

    const lines =
      page.aiReadyLines &&
      page.aiReadyLines
        .length > 0
        ? page.aiReadyLines
        : page.lines ?? [];

    const selectedLine =
      lines.find(
        (line) =>
          String(
            line.id ?? "",
          ) ===
          sourceLineId,
      ) ?? null;

    if (!selectedLine) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected line was not found in the authoritative OCR page.",
        },
        {
          status: 422,
        },
      );
    }

    const expectedText =
      lineText(
        selectedLine,
      );

    const evaluation =
      evaluateReadAloud(
        expectedText,
        transcript,
        body.durationMs,
      );

    const student =
      await findOrCreateStudentByKey(
        resolvedStudentKey,
      );

    const previous =
      await prisma
        .speakingAttempt
        .count({
          where: {
            studentId:
              student.id,
            practiceType:
              "READ_ALOUD",
            bookKey:
              bookId,
            pageNumber,
            sourceLineId,
          },
        });

    const classLevelValue =
      Number(
        body.classLevel,
      );

    const lessonNoValue =
      Number(
        body.lessonNo,
      );

    const attemptNumber =
      previous + 1;

    const [attempt] =
      await prisma
        .$transaction([
          prisma
            .speakingAttempt
            .create({
              data: {
                studentId:
                  student.id,
                practiceType:
                  "READ_ALOUD",
                bookKey:
                  bookId,
                classLevel:
                  Number.isInteger(
                    classLevelValue,
                  )
                    ? classLevelValue
                    : null,
                pageNumber,
                lessonNo:
                  Number.isInteger(
                    lessonNoValue,
                  ) &&
                  lessonNoValue > 0
                    ? lessonNoValue
                    : null,
                sourceLineId,
                sourceText:
                  expectedText,
                promptText:
                  "Read the textbook line aloud.",
                transcript:
                  evaluation
                    .transcript,
                durationMs:
                  evaluation
                    .durationMs,
                expectedWordCount:
                  evaluation
                    .expectedWords
                    .length,
                spokenWordCount:
                  evaluation
                    .spokenWords
                    .length,
                matchedWordCount:
                  evaluation
                    .matchedWords
                    .length,
                accuracyScore:
                  evaluation
                    .accuracyScore,
                completenessScore:
                  evaluation
                    .completenessScore,
                relevanceScore:
                  null,
                fluencyScore:
                  null,
                overallScore:
                  evaluation
                    .overallScore,
                wordsPerMinute:
                  evaluation
                    .wordsPerMinute,
                attemptNumber,
                missingItemsJson:
                  JSON.stringify(
                    evaluation
                      .missingWords,
                  ),
                extraItemsJson:
                  JSON.stringify(
                    evaluation
                      .extraWords,
                  ),
                replacementsJson:
                  JSON.stringify(
                    evaluation
                      .replacements,
                  ),
                evaluationVersion:
                  "voice-practice-v1",
              },
            }),
          prisma
            .researchEvent
            .create({
              data: {
                studentId:
                  student.id,
                lessonNo:
                  Number.isInteger(
                    lessonNoValue,
                  ) &&
                  lessonNoValue > 0
                    ? lessonNoValue
                    : null,
                eventType:
                  "READ_ALOUD_ATTEMPT",
                selectedLine:
                  expectedText.slice(
                    0,
                    1000,
                  ),
                toolUsed:
                  "voice-practice",
                score:
                  evaluation
                    .overallScore,
                total: 100,
                metadataJson:
                  JSON.stringify({
                    bookId,
                    pageNumber,
                    sourceLineId,
                    attemptNumber,
                    audioStored:
                      false,
                  }),
              },
            }),
        ]);

    return NextResponse.json({
      success: true,
      attemptId:
        attempt.id,
      attemptNumber,
      evaluation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof
          Error
            ? error.message
            : "Read Aloud evaluation failed.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(
  request: Request,
) {
  try {
    const url =
      new URL(
        request.url,
      );

    const resolvedStudentKey =
      await studentKey(
        url.searchParams.get(
          "studentKey",
        ),
      );

    const student =
      await findOrCreateStudentByKey(
        resolvedStudentKey,
      );

    const attempts =
      await prisma
        .speakingAttempt
        .findMany({
          where: {
            studentId:
              student.id,
            practiceType:
              "READ_ALOUD",
          },
          orderBy: {
            createdAt:
              "desc",
          },
          take: 12,
          select: {
            id: true,
            sourceText: true,
            transcript: true,
            accuracyScore:
              true,
            completenessScore:
              true,
            overallScore:
              true,
            wordsPerMinute:
              true,
            attemptNumber:
              true,
            createdAt:
              true,
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
          error instanceof
          Error
            ? error.message
            : "Read Aloud history could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}
