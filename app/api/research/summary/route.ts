import { getStudentResearchSummary } from "@/lib/researchDb";
import { getSessionStudentKey } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  // Research/learning summaries are personal data — resolve the student
  // from the session cookie, not from a query string a caller controls.
  const studentId = await getSessionStudentKey();
  if (!studentId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const summary = await getStudentResearchSummary(studentId);

  return Response.json({
    studentId,
    summary,
  });
}
