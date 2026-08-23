import {
  readFile,
} from "fs/promises";

import path from "path";

import {
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";

const ALLOWED_BOOKS =
  new Set([
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
  lines?: OcrLine[];
  aiReadyLines?: OcrLine[];
};

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
        bookId?: unknown;
        pageNumber?: unknown;
        sourceLineId?: unknown;
        selectedText?: unknown;
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

    const selectedText =
      String(
        body.selectedText ??
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
      !sourceLineId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid textbook line is required.",
        },
        {
          status: 400,
        },
      );
    }

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

    const page =
      JSON.parse(
        raw.replace(
          /^\uFEFF/,
          "",
        ),
      ) as OcrPage;

    /*
     * Prefer original OCR lines because
     * they contain stable IDs.
     */
    const lines =
      page.lines &&
      page.lines.length > 0
        ? page.lines
        : page.aiReadyLines ?? [];

    /*
     * Find the selected OCR line.
     */
    let selectedLine =
      lines.find(
        (line) =>
          String(
            line.id ?? "",
          ) === sourceLineId,
      ) ??
      page.lines?.find(
        (line) =>
          String(
            line.id ?? "",
          ) === sourceLineId,
      ) ??
      null;

    /*
     * If the OCR line cannot be found,
     * use the text sent from the Reader.
     *
     * This prevents speaking practice from
     * failing when the selected line exists
     * in the frontend but its OCR ID is not
     * available in the page JSON.
     */
    if (!selectedLine) {
      selectedLine = {
        id:
          sourceLineId ||
          "manual-line",

        text:
          selectedText ||
          "Practice this textbook sentence.",

        cleanText:
          selectedText ||
          "Practice this textbook sentence.",
      };
    }

    /*
     * Get the final source text.
     */
    const sourceText =
      lineText(
        selectedLine,
      );

    /*
     * Safety fallback in case the selected
     * line exists but contains empty text.
     */
    const finalSourceText =
      sourceText ||
      selectedText ||
      "Practice this textbook sentence.";

    const promptOptions = [
      "Explain this textbook line in your own words.",

      "What is the main idea of this textbook line? Answer in one or two sentences.",

      "Say what happens or what is described in this line, then add one related detail.",
    ];

    const promptIndex =
      Math.abs(
        Number(
          selectedLine.lineNumber ??
            pageNumber,
        ),
      ) %
      promptOptions.length;

    return NextResponse.json(
      {
        success: true,

        session: {
          bookId,

          pageNumber,

          sourceLineId:
            selectedLine.id ??
            sourceLineId,

          sourceText:
            finalSourceText,

          promptText:
            promptOptions[
              promptIndex
            ],
        },
      },
    );
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Speaking session could not be created.",
      },
      {
        status: 500,
      },
    );
  }
}