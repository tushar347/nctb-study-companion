import { class6Lessons } from "@/lib/book/class6Lessons";
import {
  findExactPassageFragment,
  LocalAiError,
} from "@/lib/local-ai/ollama";
import { loadCanonicalPassage } from "@/lib/local-ai/canonicalPassage";

export async function resolveStudySource(input: {
  bookId?: unknown;
  pageNumber?: unknown;
  lessonNo?: unknown;
  selectedText?: unknown;
}) {
  let pageNumber = input.pageNumber;
  const requestedLessonNo = Number(input.lessonNo);
  const requestedBookId =
    typeof input.bookId === "string"
      ? input.bookId
      : "class6-english";

  if (pageNumber === undefined || pageNumber === null || pageNumber === "") {
    if (
      requestedBookId !== "class6-english" ||
      !Number.isInteger(requestedLessonNo) ||
      requestedLessonNo < 1
    ) {
      throw new LocalAiError(
        "Select a textbook page or lesson first.",
        400,
      );
    }

    const lesson = class6Lessons.find(
      (item) => item.lessonNo === requestedLessonNo,
    );
    if (!lesson) {
      throw new LocalAiError(
        "The selected lesson is not available for retrieval.",
        400,
      );
    }

    pageNumber = lesson.pdfStart;
  }

  const page = await loadCanonicalPassage(
    requestedBookId,
    pageNumber,
  );
  const requestedText =
    typeof input.selectedText === "string"
      ? input.selectedText
      : "";
  const selectedText = findExactPassageFragment(
    page.text,
    requestedText,
  );

  if (!selectedText) {
    throw new LocalAiError(
      "The selected text does not match the canonical textbook page.",
      400,
    );
  }

  const matchingLesson =
    page.bookId === "class6-english"
      ? class6Lessons.find(
          (item) =>
            page.pageNumber >= item.pdfStart &&
            page.pageNumber <= item.pdfEnd,
        )
      : undefined;

  return {
    ...page,
    lessonNo: matchingLesson?.lessonNo ?? 0,
    lessonTitle: matchingLesson?.title ?? null,
    selectedText,
    pageText: page.text,
  };
}
