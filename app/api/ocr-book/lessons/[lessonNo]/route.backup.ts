import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    lessonNo: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { lessonNo } = await params;
    const lessonNumber = Number(lessonNo);

    if (!Number.isFinite(lessonNumber) || lessonNumber < 1 || lessonNumber > 33) {
      return NextResponse.json(
        {
          success: false,
          message: "Lesson number must be between 1 and 33.",
        },
        { status: 400 },
      );
    }

    const fileName = `lesson-${String(lessonNumber).padStart(2, "0")}.json`;

    const filePath = path.join(
      process.cwd(),
      "public",
      "ocr",
      "lessons_json",
      fileName,
    );

    const raw = await readFile(filePath, "utf-8");
    const lesson = JSON.parse(raw);

    return NextResponse.json({
      success: true,
      lesson: {
        lessonNo: lesson.lessonNo,
        lessonTitle: lesson.title,
        title: lesson.title,
        textbookPageStart: lesson.textbookPageStart,
        textbookPageEnd: lesson.textbookPageEnd,
        pdfPageStart: lesson.pdfPageStart,
        pdfPageEnd: lesson.pdfPageEnd,
        lines: lesson.lines ?? [],
        aiReadyLines: lesson.aiReadyLines ?? [],
        rawText: lesson.rawText ?? "",
        cleanText: lesson.cleanText ?? "",
        aiReadyText: lesson.aiReadyText ?? "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          "OCR JSON file was not found. Make sure public/ocr/lessons_json/lesson-XX.json exists.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 404 },
    );
  }
}
