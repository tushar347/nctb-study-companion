import type {
  ModelQuizPaper,
  ModelQuizScore,
  ModelQuizSubmission,
  WrongAnswer,
} from "./modelQuizTypes";

function normalizeAnswer(
  value: unknown,
): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()[\]{}]/g, "")
    .replace(/\s+/g, " ");
}

function isAcceptedAnswer(
  submittedAnswer: string,
  acceptedAnswers: string[],
): boolean {
  const normalizedSubmitted =
    normalizeAnswer(submittedAnswer);

  return acceptedAnswers.some(
    (answer) =>
      normalizeAnswer(answer) ===
      normalizedSubmitted,
  );
}

function countKeywordMatches(
  answer: string,
  keywords: string[],
): number {
  const normalizedAnswer =
    normalizeAnswer(answer);

  return keywords.reduce(
    (matches, keyword) => {
      const normalizedKeyword =
        normalizeAnswer(keyword);

      if (
        normalizedKeyword &&
        normalizedAnswer.includes(
          normalizedKeyword,
        )
      ) {
        return matches + 1;
      }

      return matches;
    },
    0,
  );
}

export function scoreModelQuiz(
  paper: ModelQuizPaper,
  submission: ModelQuizSubmission,
): ModelQuizScore {
  let mcqScore = 0;
  let passageScore = 0;
  let withoutCluesScore = 0;
  let withCluesScore = 0;

  const wrongAnswers: WrongAnswer[] = [];

  for (
    const question of
    paper.sections.mcq
  ) {
    const submittedAnswer =
      submission.answers.mcq[
        question.id
      ];

    if (
      submittedAnswer ===
      question.correctAnswerIndex
    ) {
      mcqScore += question.marks;
    }
    else {
      wrongAnswers.push({
        section: "mcq",
        questionId: question.id,
        submittedAnswer:
          submittedAnswer ?? null,
        correctAnswer:
          question.options[
            question.correctAnswerIndex
          ],
      });
    }
  }

  for (
    const question of
    paper.sections.passageQuestions
  ) {
    const submittedAnswer =
      submission.answers
        .passageQuestions[
        question.id
      ] ?? "";

    const exactAnswer =
      normalizeAnswer(
        submittedAnswer,
      ) ===
      normalizeAnswer(
        question.expectedAnswer,
      );

    const keywordMatches =
      countKeywordMatches(
        submittedAnswer,
        question.keywords,
      );

    const requiredKeywordMatches =
      question.keywords.length <= 1
        ? 1
        : 2;

    if (
      exactAnswer ||
      keywordMatches >=
        requiredKeywordMatches
    ) {
      passageScore += question.marks;
    }
    else {
      wrongAnswers.push({
        section: "passageQuestions",
        questionId: question.id,
        submittedAnswer,
        correctAnswer:
          question.expectedAnswer,
      });
    }
  }

  for (
    const question of
    paper.sections.fillWithoutClues
  ) {
    const submittedAnswer =
      submission.answers
        .fillWithoutClues[
        question.id
      ] ?? "";

    if (
      isAcceptedAnswer(
        submittedAnswer,
        question.acceptedAnswers,
      )
    ) {
      withoutCluesScore +=
        question.marks;
    }
    else {
      wrongAnswers.push({
        section:
          "fillWithoutClues",
        questionId: question.id,
        submittedAnswer,
        correctAnswer:
          question.acceptedAnswers.join(
            " / ",
          ),
      });
    }
  }

  for (
    const question of
    paper.sections.fillWithClues
      .questions
  ) {
    const submittedAnswer =
      submission.answers
        .fillWithClues[
        question.id
      ] ?? "";

    if (
      isAcceptedAnswer(
        submittedAnswer,
        question.acceptedAnswers,
      )
    ) {
      withCluesScore +=
        question.marks;
    }
    else {
      wrongAnswers.push({
        section: "fillWithClues",
        questionId: question.id,
        submittedAnswer,
        correctAnswer:
          question.acceptedAnswers.join(
            " / ",
          ),
      });
    }
  }

  const score =
    mcqScore +
    passageScore +
    withoutCluesScore +
    withCluesScore;

  const weakAreas: string[] = [];

  if (mcqScore < 3) {
    weakAreas.push(
      "Multiple-choice comprehension",
    );
  }

  if (passageScore < 3) {
    weakAreas.push(
      "Passage comprehension",
    );
  }

  if (withoutCluesScore < 3) {
    weakAreas.push(
      "Vocabulary without clues",
    );
  }

  if (withCluesScore < 3) {
    weakAreas.push(
      "Vocabulary with clues",
    );
  }

  return {
    score,
    total: 20,
    percentage:
      Math.round(
        (score / 20) * 100,
      ),
    sections: {
      mcq: {
        score: mcqScore,
        total: 5,
      },
      passageQuestions: {
        score: passageScore,
        total: 5,
      },
      fillWithoutClues: {
        score: withoutCluesScore,
        total: 5,
      },
      fillWithClues: {
        score: withCluesScore,
        total: 5,
      },
    },
    wrongAnswers,
    weakAreas,
  };
}
