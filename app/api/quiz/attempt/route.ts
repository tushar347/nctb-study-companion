import { lesson, quizQuestions } from "@/data/lesson1";

type QuizAttemptBody = {
  studentId?: string;
  lessonId?: string;
  answers?: Record<string, string>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuizAttemptBody;
    const answers = body.answers ?? {};

    const totalMarks = quizQuestions.reduce(
      (total, question) => total + question.mark,
      0,
    );

    const checkedAnswers = quizQuestions.map((question) => {
      const studentAnswer = answers[question.id] ?? "";
      const isCorrect = studentAnswer === question.answer;

      return {
        questionId: question.id,
        studentAnswer,
        correctAnswer: question.answer,
        isCorrect,
        mark: question.mark,
        earnedMark: isCorrect ? question.mark : 0,
      };
    });

    const score = checkedAnswers.reduce(
      (total, item) => total + item.earnedMark,
      0,
    );
    const accuracy =
      totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

    return Response.json({
      studentId: body.studentId ?? "demo-student-rafi",
      lessonId: body.lessonId ?? lesson.id,
      score,
      totalMarks,
      accuracy,
      checkedAnswers,
      submittedAt: new Date().toISOString(),
      message:
        "Quiz attempt calculated successfully. Database saving will be added later.",
    });
  } catch {
    return Response.json(
      {
        error: "Invalid quiz attempt request body",
      },
      { status: 400 },
    );
  }
}
