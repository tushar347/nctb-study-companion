import { readFile } from "fs/promises";
import path from "path";
import { class6Lessons, getLessonForPage } from "@/lib/book/class6Lessons";

type OcrLine = {
  id: string;
  lineNumber: number;
  text: string;
  cleanText?: string;
};

type OcrPage = {
  pageNumber: number;
  lines: OcrLine[];
};

const CONTEXT_LINES_BEFORE = 4;
const CONTEXT_LINES_AFTER = 4;

async function readOcrPage(pageNumber: number): Promise<OcrPage | null> {
  try {
    const fileName = `page-${String(pageNumber).padStart(3, "0")}.json`;
    const pagePath = path.join(
      process.cwd(),
      "public",
      "ocr",
      "books",
      "class6-english",
      "pages",
      fileName,
    );
    const raw = await readFile(pagePath, "utf-8");
    return JSON.parse(raw.replace(/^\uFEFF/, "")) as OcrPage;
  } catch {
    return null;
  }
}

function lineText(line: OcrLine) {
  return (line.cleanText ?? line.text ?? "").trim();
}

/**
 * Retrieval step for the AI Teacher (agentic learning-loop).
 *
 * Grounds the prompt in the same OCR-extracted textbook data the student is
 * actually looking at in the Reader (public/ocr/books/.../pages/*.json),
 * instead of the old 5-lesson mock file in data/ocrBook.ts. Retrieves the
 * page containing the selected line, locates that line by its stable OCR
 * line id, and pulls a window of surrounding lines as grounding context.
 *
 * If the selected line sits near the top/bottom of a page, this also pulls
 * a few lines from the previous/next page so the context window doesn't
 * get cut short at a page boundary.
 */
export async function buildPageContext({
  pageNumber,
  lineId,
  fallbackSelectedLine,
  fallbackLessonNo,
}: {
  pageNumber: number;
  lineId?: string;
  fallbackSelectedLine: string;
  fallbackLessonNo?: number;
}) {
  const lesson =
    getLessonForPage(pageNumber) ??
    class6Lessons.find((item) => item.lessonNo === fallbackLessonNo) ??
    null;

  const page = await readOcrPage(pageNumber);

  if (!page || !page.lines?.length) {
    return {
      lessonNo: lesson?.lessonNo ?? fallbackLessonNo ?? 0,
      lessonTitle: lesson?.title ?? "Unknown lesson",
      selectedLine: fallbackSelectedLine,
      nearbyContext: fallbackSelectedLine,
      retrieved: false,
    };
  }

  let index = lineId
    ? page.lines.findIndex((line) => line.id === lineId)
    : -1;

  // Fallback: match by normalized text if the id wasn't sent or didn't match.
  if (index === -1) {
    const normalized = fallbackSelectedLine.trim().toLowerCase();
    index = page.lines.findIndex(
      (line) => lineText(line).toLowerCase() === normalized,
    );
  }

  if (index === -1) {
    // Last resort: still ground the answer in the real page instead of
    // nothing, even though we couldn't pinpoint the exact line.
    return {
      lessonNo: lesson?.lessonNo ?? fallbackLessonNo ?? 0,
      lessonTitle: lesson?.title ?? "Unknown lesson",
      selectedLine: fallbackSelectedLine,
      nearbyContext: page.lines.map(lineText).join("\n"),
      retrieved: true,
    };
  }

  const before = page.lines
    .slice(Math.max(0, index - CONTEXT_LINES_BEFORE), index)
    .map(lineText);

  let after = page.lines
    .slice(index + 1, index + 1 + CONTEXT_LINES_AFTER)
    .map(lineText);

  // If the selected line is near the bottom of the page, pull a few lines
  // from the top of the next page so context doesn't cut off mid-idea.
  const missingAfter = CONTEXT_LINES_AFTER - after.length;
  if (missingAfter > 0) {
    const nextPage = await readOcrPage(pageNumber + 1);
    if (nextPage?.lines?.length) {
      after = after.concat(
        nextPage.lines.slice(0, missingAfter).map(lineText),
      );
    }
  }

  const nearbyContext = [...before, lineText(page.lines[index]), ...after]
    .filter(Boolean)
    .join("\n");

  return {
    lessonNo: lesson?.lessonNo ?? fallbackLessonNo ?? 0,
    lessonTitle: lesson?.title ?? "Unknown lesson",
    selectedLine: fallbackSelectedLine,
    nearbyContext,
    retrieved: true,
  };
}
