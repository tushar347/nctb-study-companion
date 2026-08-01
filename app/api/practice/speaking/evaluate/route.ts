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
  evaluateSpeakingPractice,
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

async function resolveStudentKey(
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

function lineText(
  line: OcrLine,
) {
  return String(
    line.cleanText ??
      line.text ??
      "",
  ).trim();
}

async function resolveLine(
  bookId: string,
  pageNumber: number,
  sourceLineId: string,
) {
  const raw =
    await readFile(
      path.join(
        process.cwd(),
        "public",
        "ocr",
        "books",
        bookId,
        "pages",
        `page-${String(
          pageNumber,
        ).padStart(
          3,
          "0",
        )}.json`,
      ),
      "utf8",
    );

  const page =
    JSON.parse(
      raw.replace(
        /^\uFEFF/,
        "",
      ),
    ) as OcrPage;

  const lines =
    page.aiReadyLines &&
    page.aiReadyLines
      .length > 0
      ? page.aiReadyLines
      : page.lines ?? [];

  return (
    lines.find(
      (line) =>
        String(
          line.id ?? "",
        ) ===
        sourceLineId,
    ) ?? null
  );
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
        promptText?: unknown;
        transcript?: unknown;
        durationMs?: unknown;
      };

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

    const promptText =
      String(
        body.promptText ??
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
      !promptText ||
      !transcript
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Book, page, selected line, prompt, and spoken response are required.",
        },
        {
          status: 400,
        },
      );
    }

    const selectedLine =
      await resolveLine(
        bookId,
        pageNumber,
        sourceLineId,
      );

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

    const sourceText =
      lineText(
        selectedLine,
      );

    const evaluation =
      evaluateSpeakingPractice(
        sourceText,
        promptText,
        transcript,
        body.durationMs,
      );

    const student =
      await findOrCreateStudentByKey(
        await resolveStudentKey(
          body.studentKey,
        ),
      );

    const previous =
      await prisma
        .speakingAttempt
        .count({
          where: {
            studentId:
              student.id,
            practiceType:
              "SPEAKING_PRACTICE",
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
                  "SPEAKING_PRACTICE",
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
                sourceText,
                promptText,
                transcript:
                  evaluation
                    .transcript,
                durationMs:
                  evaluation
                    .durationMs,
                expectedWordCount:
                  evaluation
                    .sourceKeywords
                    .length,
                spokenWordCount:
                  evaluation
                    .transcript
                    .split(
                      /\s+/,
                    )
                    .filter(
                      Boolean,
                    )
                    .length,
                matchedWordCount:
                  evaluation
                    .matchedKeywords
                    .length,
                accuracyScore:
                  null,
                completenessScore:
                  evaluation
                    .responseLengthScore,
                relevanceScore:
                  evaluation
                    .relevanceScore,
                fluencyScore:
                  evaluation
                    .fluencyScore,
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
                      .missedKeywords,
                  ),
                extraItemsJson:
                  "[]",
                replacementsJson:
                  "[]",
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
                  "SPEAKING_PRACTICE_ATTEMPT",
                selectedLine:
                  sourceText.slice(
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
                    promptText,
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
            : "Speaking Practice evaluation failed.",
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

    const student =
      await findOrCreateStudentByKey(
        await resolveStudentKey(
          url.searchParams.get(
            "studentKey",
          ),
        ),
      );

    const attempts =
      await prisma
        .speakingAttempt
        .findMany({
          where: {
            studentId:
              student.id,
            practiceType:
              "SPEAKING_PRACTICE",
          },
          orderBy: {
            createdAt:
              "desc",
          },
          take: 12,
          select: {
            id: true,
            promptText: true,
            transcript: true,
            relevanceScore:
              true,
            completenessScore:
              true,
            fluencyScore:
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
            : "Speaking history could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}
