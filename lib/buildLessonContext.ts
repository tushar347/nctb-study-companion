import { ocrBook } from "@/data/ocrBook";

function splitTextIntoLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function buildLessonContext(lessonNo: number, selectedLine: string) {
  const lesson = ocrBook.lessons.find((item) => item.lessonNo === lessonNo);

  if (!lesson) {
    return {
      lessonNo,
      lessonTitle: "Unknown lesson",
      selectedLine,
      nearbyContext: selectedLine,
      fullLessonPreview: selectedLine,
    };
  }

  const lines = splitTextIntoLines(lesson.text);

  const normalizedSelectedLine = selectedLine.trim().toLowerCase();

  const selectedIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === normalizedSelectedLine,
  );

  const start = selectedIndex === -1 ? 0 : Math.max(0, selectedIndex - 2);
  const end =
    selectedIndex === -1 ? 5 : Math.min(lines.length, selectedIndex + 3);

  const nearbyContext = lines.slice(start, end).join("\n");
  const fullLessonPreview = lines.slice(0, 25).join("\n");

  return {
    lessonNo: lesson.lessonNo,
    lessonTitle: lesson.lessonTitle,
    selectedLine,
    nearbyContext,
    fullLessonPreview,
  };
}
