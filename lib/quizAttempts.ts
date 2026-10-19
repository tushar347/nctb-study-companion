import { prisma } from "@/lib/prisma";
import {
  InvalidQuizSubmissionError,
  parseQuizQuestions,
  scoreQuizSubmission,
} from "@/lib/quizScoring";
import {
  findOrCreateStudentByKey,
  getBangladeshDateKey,
} from "@/lib/studentTracking";

type ApiResult = {
  status: number;
  body: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function replayStoredResult(
  session: {
    submittedAt: Date | null;
    answersJson: string | null;
    resultJson: string | null;
  },
  answersJson: string,
): ApiResult | null {
  if (!session.submittedAt) return null;
  if (session.answersJson !== answersJson) {
    return {
      status: 409,
      body: { success: false, error: "This quiz has already been submitted." },
    };
  }

  if (!session.resultJson) {
    throw new Error("Submitted quiz is missing its saved result.");
  }

  const result: unknown = JSON.parse(session.resultJson);
  if (!isRecord(result) || result.success !== true) {
    throw new Error("Submitted quiz has an invalid saved result.");
  }

  return { status: 200, body: result };
}

export async function submitQuizAttempt(
  studentKey: string,
  body: unknown,
): Promise<ApiResult> {
  if (!isRecord(body) || typeof body.quizId !== "string") {
    return {
      status: 400,
      body: { success: false, error: "A valid quiz ID is required." },
    };
  }

  const student = await findOrCreateStudentByKey(studentKey);
  const session = await prisma.quizSession.findFirst({
    where: {
      id: body.quizId,
      studentId: student.id,
    },
  });

  if (!session) {
    return {
      status: 404,
      body: { success: false, error: "Quiz session not found." },
    };
  }

  const questions = parseQuizQuestions(
    JSON.parse(session.questionsJson) as unknown,
  );
  const score = scoreQuizSubmission(questions, body.answers);
  const canonicalAnswersJson = JSON.stringify(score.answers);

  const replay = replayStoredResult(session, canonicalAnswersJson);
  if (replay) return replay;

  const submittedAt = new Date();
  if (session.expiresAt <= submittedAt) {
    return {
      status: 410,
      body: { success: false, error: "This quiz session has expired." },
    };
  }

  const wrongAnswers = score.checkedAnswers
    .filter((answer) => !answer.isCorrect)
    .map(({ questionId, question, studentAnswer, correctAnswer }) => ({
      questionId,
      question,
      studentAnswer,
      correctAnswer,
    }));

  const dateKey = getBangladeshDateKey(submittedAt);
  const result = await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.quizSession.updateMany({
      where: {
        id: session.id,
        studentId: student.id,
        submittedAt: null,
        expiresAt: { gt: submittedAt },
      },
      data: {
        submittedAt,
        answersJson: canonicalAnswersJson,
      },
    });

    if (claimed.count !== 1) return null;

    const attempt = await transaction.quizAttempt.create({
      data: {
        studentId: student.id,
        lessonNo: session.lessonNo,
        lessonTitle: session.lessonTitle,
        score: score.score,
        total: score.total,
        wrongAnswersJson: JSON.stringify(wrongAnswers),
        weakAreasJson: "[]",
        submittedAnswersJson: canonicalAnswersJson,
      },
    });

    await transaction.dailyStudyRecord.upsert({
      where: {
        studentId_dateKey: {
          studentId: student.id,
          dateKey,
        },
      },
      update: {
        quizAttempts: { increment: 1 },
        quizScore: { increment: score.score },
        quizTotal: { increment: score.total },
      },
      create: {
        studentId: student.id,
        dateKey,
        quizAttempts: 1,
        quizScore: score.score,
        quizTotal: score.total,
      },
    });

    const response = {
      success: true,
      score: score.score,
      total: score.total,
      accuracy: score.accuracy,
      checkedAnswers: score.checkedAnswers,
      attemptId: attempt.id,
      submittedAt: submittedAt.toISOString(),
    };

    await transaction.quizSession.update({
      where: { id: session.id },
      data: { resultJson: JSON.stringify(response) },
    });

    return response;
  });

  if (result) return { status: 200, body: result };

  const updatedSession = await prisma.quizSession.findUnique({
    where: { id: session.id },
  });
  if (!updatedSession) {
    return {
      status: 404,
      body: { success: false, error: "Quiz session not found." },
    };
  }

  const racedReplay = replayStoredResult(
    updatedSession,
    canonicalAnswersJson,
  );
  if (racedReplay) return racedReplay;

  return {
    status: 410,
    body: { success: false, error: "This quiz session has expired." },
  };
}

export function isInvalidQuizSubmission(
  error: unknown,
): error is InvalidQuizSubmissionError {
  return error instanceof InvalidQuizSubmissionError;
}
