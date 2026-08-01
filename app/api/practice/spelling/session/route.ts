import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import {
  extractSpellingCandidates,
  maskSpellingWord,
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
  lineNumber?: number;
  text?: string;
  cleanText?: string;
};

type OcrPage = {
  source?: string;
  lines?: OcrLine[];
  aiReadyLines?: OcrLine[];
};

function isPositiveInteger(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
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

function lineText(line: OcrLine) {
  return String(
    line.cleanText ?? line.text ?? "",
  ).trim();
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as {
        bookId?: unknown;
        pageNumber?: unknown;
        sourceLineId?: unknown;
        excludeWords?: unknown;
      };

    const bookId = String(
      body.bookId ?? "",
    ).trim();

    const pageNumber = Number(
      body.pageNumber,
    );

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

    if (!isPositiveInteger(pageNumber)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid OCR page is required.",
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

    const sourceLineId = String(
      body.sourceLineId ?? "",
    ).trim();

    const selectedLine =
      sourceLineId
        ? lines.find(
            (line) =>
              String(line.id ?? "") === sourceLineId,
          ) ?? null
        : null;

    const selectedText = selectedLine
      ? lineText(selectedLine)
      : "";

    const pageText = lines
      .map(lineText)
      .filter(Boolean)
      .join("\n");

    const excludedWords =
      Array.isArray(body.excludeWords)
        ? body.excludeWords
            .map((word) => String(word))
            .slice(0, 50)
        : [];

    const selectedCandidates =
      extractSpellingCandidates(
        selectedText,
        excludedWords,
      );

    const pageCandidates =
      extractSpellingCandidates(
        pageText,
        excludedWords,
      );

    const candidates =
      selectedCandidates.length > 0
        ? [
            ...selectedCandidates,
            ...pageCandidates.filter(
              (word) =>
                !selectedCandidates.includes(word),
            ),
          ]
        : pageCandidates;

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No suitable spelling word was found on this OCR page.",
        },
        { status: 422 },
      );
    }

    const targetWord =
      candidates[
        Math.floor(
          Math.random() *
            Math.min(candidates.length, 12),
        )
      ];

    return NextResponse.json({
      success: true,
      session: {
        bookId,
        pageNumber,
        pageSource: page.source ?? null,
        sourceLineId: selectedLine?.id ?? null,
        sourceLineText: selectedText || null,
        targetWord,
        maskedWord: maskSpellingWord(targetWord),
        wordLength: targetWord.length,
        candidateCount: candidates.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Spelling session could not be created.",
      },
      { status: 500 },
    );
  }
}
