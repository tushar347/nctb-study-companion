import { student } from "@/data/lesson1";

export async function GET() {
  return Response.json({
    studentId: "demo-student-rafi",
    today: {
      lessonsRead: 1,
      wordsSaved: student.savedWords,
      quizAccuracy: student.quizAccuracy,
      target: "Read 1 lesson + complete 1 quiz",
    },
    weekly: [
      { day: "Sat", studyMinutes: 8 },
      { day: "Sun", studyMinutes: 5 },
      { day: "Mon", studyMinutes: 10 },
      { day: "Tue", studyMinutes: 4 },
      { day: "Wed", studyMinutes: 9 },
      { day: "Thu", studyMinutes: 12 },
      { day: "Fri", studyMinutes: 7 },
    ],
    weakArea: "Grammar — present simple",
    note: "Mock progress data. Database persistence will be added later.",
  });
}
