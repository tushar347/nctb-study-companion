import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForPrisma = globalThis as unknown as {
  ocrPrisma?: PrismaClient;
};

const prisma =
  globalForPrisma.ocrPrisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.ocrPrisma = prisma;
}

type OCRInputLine = {
  id?: string;
  lineNumber?: number;
  text?: string;
  cleanText?: string;
  confidence?: number | string;
  aiReady?: boolean;

  x?: number;
  y?: number;
  width?: number;
  height?: number;

  bbox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
};

function cleanOCRText(value: unknown): string {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/^[•●▪◦]\s*/g, "")
    .replace(/^\s*\d+[\.\)]\s*$/g, "")
    .replace(/^\s*[A-Da-d][\.\)]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAIReady(text: string): boolean {
  if (text.length < 4) {
    return false;
  }

  if (!/[A-Za-z]/.test(text)) {
    return false;
  }

  if (/^[A-Da-d\d\s.()]+$/.test(text)) {
    return false;
  }

  return true;
}

export async function POST() {
  let stage = "starting";

  try {
    const client = prisma as any;

    const bookDelegate = client.book;
    const pageDelegate = client.bookPage;
    const lineDelegate =
      client.oCRLine ??
      client.ocrLine ??
      client.OCRLine;

    if (!bookDelegate) {
      throw new Error(
        `Prisma Book delegate is missing. Available delegates: ${Object.keys(
          client,
        )
          .filter(
            (key) =>
              !key.startsWith("_") &&
              !key.startsWith("$"),
          )
          .join(", ")}`,
      );
    }

    if (!pageDelegate) {
      throw new Error(
        "Prisma BookPage delegate is missing. Run prisma migrate and prisma generate.",
      );
    }

    if (!lineDelegate) {
      throw new Error(
        `Prisma OCRLine delegate is missing. Available delegates: ${Object.keys(
          client,
        )
          .filter(
            (key) =>
              !key.startsWith("_") &&
              !key.startsWith("$"),
          )
          .join(", ")}`,
      );
    }

    stage = "locating OCR folder";

    const ocrFolder = path.join(
      process.cwd(),
      "public",
      "ocr",
      "books",
      "test",
    );

    const availableFiles = await readdir(ocrFolder);

    const jsonFiles = availableFiles
      .filter((fileName) =>
        /^page-\d+-lines\.json$/i.test(fileName),
      )
      .sort((first, second) => {
        const firstPage =
          Number(first.match(/\d+/)?.[0] ?? 0);

        const secondPage =
          Number(second.match(/\d+/)?.[0] ?? 0);

        return firstPage - secondPage;
      });

    if (jsonFiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          stage,
          error:
            "No page-XXX-lines.json file was found.",
          folder: ocrFolder,
          availableFiles,
        },
        {
          status: 404,
        },
      );
    }

    stage = "creating book";

    const bookTitle =
      "English For Today Class 6";

    let book = await bookDelegate.findFirst({
      where: {
        title: bookTitle,
      },
    });

    if (!book) {
      book = await bookDelegate.create({
        data: {
          title: bookTitle,
          classLevel: 6,
          subject: "English",
          pdfPath:
            "/books/class6-english-for-today.pdf",
        },
      });
    }

    let importedPages = 0;
    let importedLines = 0;

    const pageResults: Array<{
      pageNumber: number;
      lineCount: number;
      fileName: string;
    }> = [];

    for (const fileName of jsonFiles) {
      stage = `reading ${fileName}`;

      const pageMatch = fileName.match(
        /^page-(\d+)-lines\.json$/i,
      );

      if (!pageMatch) {
        continue;
      }

      const pageNumber = Number(pageMatch[1]);

      const filePath = path.join(
        ocrFolder,
        fileName,
      );

      const rawFile = await readFile(
        filePath,
        "utf-8",
      );

      const parsed = JSON.parse(
        rawFile.replace(/^\uFEFF/, ""),
      ) as OCRInputLine[];

      if (!Array.isArray(parsed)) {
        throw new Error(
          `${fileName} does not contain a JSON array.`,
        );
      }

      const normalizedLines = parsed
        .map((line, index) => {
          const box = line.bbox ?? line;

          const text = cleanOCRText(
            line.cleanText ?? line.text,
          );

          return {
            lineNumber: Number(
              line.lineNumber ?? index + 1,
            ),

            text,

            cleanText: text,

            x: Math.round(
              Number(box.x ?? 0),
            ),

            y: Math.round(
              Number(box.y ?? 0),
            ),

            width: Math.round(
              Number(box.width ?? 0),
            ),

            height: Math.round(
              Number(box.height ?? 0),
            ),

            confidence: Number(
              line.confidence ?? 0,
            ),

            aiReady:
              line.aiReady !== false &&
              isAIReady(text),
          };
        })
        .filter(
          (line) =>
            line.text.length > 0 &&
            line.width >= 0 &&
            line.height >= 0,
        );

      const rawText = normalizedLines
        .map((line) => line.text)
        .join("\n");

      const aiReadyText = normalizedLines
        .filter((line) => line.aiReady)
        .map((line) => line.cleanText)
        .join("\n");

      stage = `saving page ${pageNumber}`;

      const existingPage =
        await pageDelegate.findFirst({
          where: {
            bookId: book.id,
            pageNumber,
          },
        });

      let bookPage;

      if (existingPage) {
        bookPage = await pageDelegate.update({
          where: {
            id: existingPage.id,
          },

          data: {
            imagePath:
              `/ocr/books/test/page-${pageNumber}.png`,

            rawText,

            cleanText: rawText,

            aiReadyText,
          },
        });
      } else {
        bookPage = await pageDelegate.create({
          data: {
            bookId: book.id,

            pageNumber,

            imagePath:
              `/ocr/books/test/page-${pageNumber}.png`,

            rawText,

            cleanText: rawText,

            aiReadyText,
          },
        });
      }

      stage = `deleting previous lines for page ${pageNumber}`;

      await lineDelegate.deleteMany({
        where: {
          pageId: bookPage.id,
        },
      });

      stage = `creating OCR lines for page ${pageNumber}`;

      for (const line of normalizedLines) {
        await lineDelegate.create({
          data: {
            pageId: bookPage.id,

            lineNumber: line.lineNumber,

            text: line.text,

            cleanText: line.cleanText,

            x: line.x,

            y: line.y,

            width: line.width,

            height: line.height,

            confidence:
              Number.isFinite(line.confidence)
                ? line.confidence
                : 0,

            aiReady: line.aiReady,
          },
        });
      }

      importedPages += 1;
      importedLines += normalizedLines.length;

      pageResults.push({
        pageNumber,
        lineCount: normalizedLines.length,
        fileName,
      });
    }

    stage = "completed";

    return NextResponse.json({
      success: true,
      stage,
      bookId: book.id,
      bookTitle: book.title,
      importedPages,
      importedLines,
      pages: pageResults,
    });
  } catch (error) {
    console.error(
      `OCR import failed at stage: ${stage}`,
      error,
    );

    return NextResponse.json(
      {
        success: false,
        stage,

        error:
          error instanceof Error
            ? error.message
            : String(error),

        stack:
          error instanceof Error
            ? error.stack
            : null,
      },
      {
        status: 500,
      },
    );
  }
}
