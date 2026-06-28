import { lesson, quizQuestions } from "@/data/lesson1";

export async function GET() {
  return Response.json({
    lessonId: lesson.id,
    title: `${lesson.title} Quiz`,
    totalQuestions: quizQuestions.length,
    totalMarks: quizQuestions.reduce(
      (total, question) => total + question.mark,
      0,
    ),
    questions: quizQuestions.map((question) => ({
      id: question.id,
      type: question.type,
      question: question.question,
      options: question.options,
      mark: question.mark,
    })),
  });
}
