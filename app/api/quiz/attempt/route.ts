import { NextResponse } from "next/server";
import { lesson, quizQuestions } from "@/data/lesson1";

type QuizAttemptBody = {
  studentId?: string;
  lessonId?: string;
  answers?: Record<string, string>;
};

export async function POST(request: Request) {
  try {
    const body: QuizAttemptBody = await request.json();

    const answers = body.answers ?? {};

    const totalMarks = quizQuestions.reduce(
      (sum, question) => sum + question.mark,
      0
    );

    const checkedAnswers = quizQuestions.map((question) => {
      const studentAnswer =
        answers[question.id]?.trim() ?? "";

      const correctAnswer =
        question.answer.trim();

      const isCorrect =
        studentAnswer.toLowerCase() ===
        correctAnswer.toLowerCase();

      return {
        questionId: question.id,
        question: question.question,
        studentAnswer,
        correctAnswer,
        isCorrect,
        mark: question.mark,
        earnedMark: isCorrect ? question.mark : 0,
      };
    });

    const score = checkedAnswers.reduce(
      (sum, item) => sum + item.earnedMark,
      0
    );

    const accuracy =
      totalMarks > 0
        ? Math.round((score / totalMarks) * 100)
        : 0;


    return NextResponse.json({
      success: true,

      studentId:
        body.studentId ?? "demo-student-rafi",

      lessonId:
        body.lessonId ?? lesson.id,

      score,

      totalMarks,

      accuracy,

      checkedAnswers,

      submittedAt:
        new Date().toISOString(),

      message:
        "Quiz attempt calculated successfully",
    });

  } catch (error) {

    console.error(
      "Quiz attempt error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid quiz attempt request body",
      },
      {
        status: 400,
      }
    );
  }
}