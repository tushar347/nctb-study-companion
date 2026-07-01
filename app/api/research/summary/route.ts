import { getStudentResearchSummary } from "@/lib/researchDb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") ?? "demo-student";

  const summary = await getStudentResearchSummary(studentId);

  return Response.json({
    studentId,
    summary,
  });
}
