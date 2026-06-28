import { student } from "@/data/lesson1";

export async function GET() {
  return Response.json({
    id: "demo-student-rafi",
    name: student.name,
    className: student.className,
    savedWords: student.savedWords,
    quizAccuracy: student.quizAccuracy,
    weeklyStudyDays: student.weeklyStudyDays,
  });
}
