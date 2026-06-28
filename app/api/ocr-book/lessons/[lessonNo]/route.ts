import { ocrBook } from "@/data/ocrBook";

function splitTextIntoLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => ({
      id: `ocr-line-${index + 1}`,
      paragraphNo: index + 1,
      text: line,
    }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonNo: string }> },
) {
  const { lessonNo } = await params;
  const lessonNumber = Number(lessonNo);

  const lesson = ocrBook.lessons.find((item) => item.lessonNo === lessonNumber);

  if (!lesson) {
    return Response.json(
      {
        error: "Lesson not found",
        lessonNo,
      },
      { status: 404 },
    );
  }

  return Response.json({
    bookId: ocrBook.id,
    subject: ocrBook.subject,
    lesson: {
      lessonNo: lesson.lessonNo,
      lessonTitle: lesson.lessonTitle,
      pageStart: lesson.pageStart,
      pageEnd: lesson.pageEnd,
      lines: splitTextIntoLines(lesson.text),
    },
  });
}
