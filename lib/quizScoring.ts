export type QuizQuestionForScoring = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
};

export type CheckedQuizAnswer = {
  questionId: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
};

export type QuizScore = {
  score: number;
  total: number;
  accuracy: number;
  answers: Record<string, number>;
  checkedAnswers: CheckedQuizAnswer[];
};

export class InvalidQuizSubmissionError extends Error {}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(
    (item): item is string => typeof item === "string",
  );
}

export function parseQuizQuestions(
  value: unknown,
): QuizQuestionForScoring[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Stored quiz has no questions.");
  }

  const questions: QuizQuestionForScoring[] = [];
  const ids = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Stored quiz contains an invalid question.");
    }

    const question = item as Record<string, unknown>;
    const options = question.options;
    const correctAnswerIndex = question.correctAnswerIndex;
    if (
      typeof question.id !== "string" ||
      !question.id ||
      ids.has(question.id) ||
      typeof question.question !== "string" ||
      !question.question ||
      !isStringArray(options) ||
      options.length < 2 ||
      typeof correctAnswerIndex !== "number" ||
      !Number.isInteger(correctAnswerIndex) ||
      correctAnswerIndex < 0 ||
      correctAnswerIndex >= options.length ||
      typeof question.explanation !== "string"
    ) {
      throw new Error("Stored quiz contains an invalid question.");
    }

    ids.add(question.id);
    questions.push({
      id: question.id,
      question: question.question,
      options,
      correctAnswerIndex,
      explanation: question.explanation,
    });
  }

  return questions;
}

export function scoreQuizSubmission(
  questions: QuizQuestionForScoring[],
  submittedAnswers: unknown,
): QuizScore {
  if (
    !submittedAnswers ||
    typeof submittedAnswers !== "object" ||
    Array.isArray(submittedAnswers)
  ) {
    throw new InvalidQuizSubmissionError("Answers must be an object.");
  }

  const answers = submittedAnswers as Record<string, unknown>;
  const questionIds = new Set(questions.map((question) => question.id));
  const submittedIds = Object.keys(answers);

  if (
    submittedIds.length !== questions.length ||
    submittedIds.some((id) => !questionIds.has(id))
  ) {
    throw new InvalidQuizSubmissionError(
      "Submit exactly one answer for every quiz question.",
    );
  }

  const normalizedAnswers: Record<string, number> = {};
  const checkedAnswers = questions.map((question) => {
    if (!Object.hasOwn(answers, question.id)) {
      throw new InvalidQuizSubmissionError(
        "Submit exactly one answer for every quiz question.",
      );
    }

    const answerIndex = answers[question.id];
    if (
      typeof answerIndex !== "number" ||
      !Number.isInteger(answerIndex) ||
      answerIndex < 0 ||
      answerIndex >= question.options.length
    ) {
      throw new InvalidQuizSubmissionError(
        "Answer selections must be valid option indexes.",
      );
    }

    const selectedIndex = answerIndex;
    normalizedAnswers[question.id] = selectedIndex;
    const isCorrect =
      selectedIndex === question.correctAnswerIndex;

    return {
      questionId: question.id,
      question: question.question,
      studentAnswer: question.options[selectedIndex],
      correctAnswer: question.options[question.correctAnswerIndex],
      isCorrect,
      explanation: question.explanation,
    };
  });

  const score = checkedAnswers.filter((answer) => answer.isCorrect).length;

  return {
    score,
    total: questions.length,
    accuracy: Math.round((score / questions.length) * 100),
    answers: normalizedAnswers,
    checkedAnswers,
  };
}
