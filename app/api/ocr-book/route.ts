import { ocrBook } from "@/data/ocrBook";

export async function GET() {
  return Response.json({
    book: {
      id: ocrBook.id,
      className: ocrBook.className,
      subject: ocrBook.subject,
      title: ocrBook.title,
      sourceType: ocrBook.sourceType,
      note: ocrBook.note,
    },
    lessons: ocrBook.lessons.map((lesson) => ({
      lessonNo: lesson.lessonNo,
      lessonTitle: lesson.lessonTitle,
      pageStart: lesson.pageStart,
      pageEnd: lesson.pageEnd,
      totalCharacters: lesson.text.length,
    })),
  });
}
