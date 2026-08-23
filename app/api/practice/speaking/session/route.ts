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
          success:false,
          error:
            "A valid textbook line is required.",
        },
        {
          status:400,
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



    // Prefer original OCR lines because they contain stable IDs
    const lines =
      page.lines && page.lines.length > 0
        ? page.lines
        : page.aiReadyLines ?? [];



    const selectedLine =
      lines.find(
        (line) =>
          String(
            line.id ?? "",
          ) === sourceLineId,
      )
      ??
      lines.find(
        (line) =>
          String(
            line.lineNumber ?? "",
          ) === sourceLineId,
      )
      ??
      null;



    if (!selectedLine) {

      return NextResponse.json(
        {
          success:false,
          error:
            "The selected line was not found in the textbook page. Please select the sentence again.",
        },
        {
          status:422,
        },
      );

    }



    const sourceText =
      lineText(
        selectedLine,
      );



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
        success:true,
        session:{
          bookId,
          pageNumber,
          sourceLineId:
            selectedLine.id ??
            sourceLineId,
          sourceText,
          promptText:
            promptOptions[
              promptIndex
            ],
        },
      },
    );


  } catch(error) {

    return NextResponse.json(
      {
        success:false,
        error:
          error instanceof Error
            ? error.message
            : "Speaking session could not be created.",
      },
      {
        status:500,
      },
    );

  }
}