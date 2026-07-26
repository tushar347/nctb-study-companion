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
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { bookId } = await params;

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

    const indexPath = path.join(
      process.cwd(),
      "public",
      "ocr",
      "books",
      bookId,
      "index.json",
    );

    const raw = await readFile(
      indexPath,
      "utf-8",
    );

    const data = JSON.parse(
      raw.replace(/^\uFEFF/, ""),
    );

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Book index could not be loaded.",
      },
      {
        status: 404,
      },
    );
  }
}
