import { readFile } from "fs/promises";
import path from "path";
import { LocalAiError, normalizeText } from "@/lib/local-ai/ollama";

const BOOK_CLASS_LEVELS = {
  "class6-english": 6,
  "class7-english": 7,
} as const;

type CanonicalPassage = {
  bookId: keyof typeof BOOK_CLASS_LEVELS;
  pageNumber: number;
  classLevel: 6 | 7;
  text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getLineText(line: unknown): string {
  if (!isRecord(line)) return "";

  const text = line.cleanText ?? line.text;
  return typeof text === "string" ? text.trim() : "";
}

export async function loadCanonicalPassage(
  rawBookId: unknown,
  rawPageNumber: unknown,
): Promise<CanonicalPassage> {
  if (
    typeof rawBookId !== "string" ||
    !Object.hasOwn(BOOK_CLASS_LEVELS, rawBookId)
  ) {
    throw new LocalAiError("Select a supported textbook.", 400);
  }

  const pageNumber = Number(rawPageNumber);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    throw new LocalAiError("Select a valid textbook page.", 400);
  }

  const bookId = rawBookId as keyof typeof BOOK_CLASS_LEVELS;
  const fileName = `page-${String(pageNumber).padStart(3, "0")}.json`;
  const filePath = path.join(
    process.cwd(),
    "public",
    "ocr",
    "books",
    bookId,
    "pages",
    fileName,
  );

  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (
      isRecord(error) &&
      error.code === "ENOENT"
    ) {
      throw new LocalAiError(
        "The selected textbook page is not available.",
        404,
      );
    }
    throw error;
  }

  let page: unknown;
  try {
    page = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    throw new LocalAiError(
      "The selected textbook page could not be read.",
      422,
    );
  }

  if (!isRecord(page)) {
    throw new LocalAiError(
      "The selected textbook page has invalid content.",
      422,
    );
  }

  let passage = "";
  if (typeof page.aiReadyText === "string") {
    passage = page.aiReadyText;
  } else {
    const lines = Array.isArray(page.aiReadyLines)
      ? page.aiReadyLines
      : Array.isArray(page.lines)
        ? page.lines.filter(
            (line) =>
              !isRecord(line) ||
              line.aiReady !== false,
          )
        : [];
    passage = lines.map(getLineText).filter(Boolean).join("\n");
  }

  const text = normalizeText(passage).slice(0, 12_000);
  if (text.length < 20) {
    throw new LocalAiError(
      "The selected textbook page has too little clean text.",
      422,
    );
  }

  return {
    bookId,
    pageNumber,
    classLevel: BOOK_CLASS_LEVELS[bookId],
    text,
  };
}
