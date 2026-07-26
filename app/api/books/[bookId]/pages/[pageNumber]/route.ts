import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedBooks = new Set([
  "class6-english",
  "class7-english",
  "class8-english",
]);

type RouteContext = {
  params: Promise<{
    bookId: string;
    pageNumber: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const {
      bookId,
      pageNumber,
    } = await params;

    if (!allowedBooks.has(bookId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Book is not supported.",
        },
        {
          status: 404,
        },
      );
    }

    const page = Number(pageNumber);

    if (
      !Number.isInteger(page) ||
      page < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid page number.",
        },
        {
          status: 400,
        },
      );
    }

    const fileName =
      `page-${String(page).padStart(
        3,
        "0",
      )}.json`;

    const pagePath = path.join(
      process.cwd(),
      "public",
      "ocr",
      "books",
      bookId,
      "pages",
      fileName,
    );

    const raw = await readFile(
      pagePath,
      "utf-8",
    );

    const pageData = JSON.parse(
      raw.replace(/^\uFEFF/, ""),
    );

    return NextResponse.json({
      success: true,
      ...pageData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "OCR page could not be loaded.",
      },
      {
        status: 404,
      },
    );
  }
}
