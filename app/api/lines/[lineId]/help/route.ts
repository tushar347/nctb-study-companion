import { lesson, lessonLines } from "@/data/lesson1";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const { lineId } = await params;

  const selectedLine = lessonLines.find((line) => line.id === lineId);

  if (!selectedLine) {
    return Response.json(
      {
        error: "Line not found",
        lineId,
      },
      { status: 404 },
    );
  }

  return Response.json({
    lessonId: lesson.id,
    lineId: selectedLine.id,
    paragraphNo: selectedLine.paragraphNo,
    selectedLine: selectedLine.text,
    helper: selectedLine.helper,
  });
}
