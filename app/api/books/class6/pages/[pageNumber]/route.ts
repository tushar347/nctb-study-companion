import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    pageNumber: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { pageNumber } = await params;

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
      "class6-english",
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