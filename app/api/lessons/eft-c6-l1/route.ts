import { lesson, lessonLines } from "@/data/lesson1";

export async function GET() {
  return Response.json({
    lesson,
    lines: lessonLines.map((line) => ({
      id: line.id,
      paragraphNo: line.paragraphNo,
      text: line.text,
    })),
    totalLines: lessonLines.length,
  });
}
