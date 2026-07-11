import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const indexPath = path.join(
      process.cwd(),
      "public",
      "ocr",
      "books",
      "class6-english",
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
