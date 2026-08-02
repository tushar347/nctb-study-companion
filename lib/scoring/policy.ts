export type ScoringActivity =
  | "QUIZ"
  | "GAME"
  | "SPELLING"
  | "READ_ALOUD"
  | "SPEAKING";

export const SCORING_MESSAGES: Record<ScoringActivity, string> = {
  QUIZ:
    "Earn 2 points for each quiz mark, 5 for completion, and 5 more for a perfect 20/20. Maximum: 50 points.",
  GAME:
    "Correct answers matter most. Completion, fewer mistakes, and a small speed bonus can earn up to 30 points.",
  SPELLING:
    "Earn up to 4 points for letter accuracy and 1 extra point for the exact spelling. Maximum: 5 points per word.",
  READ_ALOUD:
    "Matched words and completeness earn up to 20 points. Your accent is not graded.",
  SPEAKING:
    "Topic coverage, answer completeness, and steady pace earn up to 20 points. Your accent is not graded.",
};

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

function part(percentage: number, maximum: number) {
  return Math.round((clamp(percentage) / 100) * maximum);
}

export function gradePerformance(percentage: number) {
  const safe = clamp(percentage);

  if (safe >= 90) return { grade: "A+", label: "Excellent" };
  if (safe >= 80) return { grade: "A", label: "Very Good" };
  if (safe >= 70) return { grade: "B", label: "Good" };
  if (safe >= 60) return { grade: "C", label: "Developing" };
  if (safe >= 40) return { grade: "D", label: "Needs Practice" };

  return { grade: "F", label: "Try Again" };
}

export function quizPoints(score: number, total: number) {
  const safeTotal = Math.max(1, Math.round(total));
  const safeScore = clamp(Math.round(score), 0, safeTotal);
  const performance = Math.round((safeScore / safeTotal) * 40);
  const completion = 5;
  const bonus = safeScore === safeTotal ? 5 : 0;

  return {
    performance,
    completion,
    bonus,
    total: performance + completion + bonus,
    maximum: 50,
  };
}

export function gamePoints(input: {
  score: number;
  total: number;
  mistakes?: number;
  durationMs?: number | null;
}) {
  const safeTotal = Math.max(1, Math.round(input.total));
  const safeScore = clamp(Math.round(input.score), 0, safeTotal);
  const accuracy = Math.round((safeScore / safeTotal) * 100);
  const performance = part(accuracy, 20);
  const completion = 5;
  const mistakes = Math.max(0, Math.round(input.mistakes ?? 0));
  const mistakeBonus = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : mistakes <= 4 ? 1 : 0;
  const duration = Number(input.durationMs);
  const speedBonus =
    Number.isFinite(duration) && duration > 0 && duration <= 90000
      ? 2
      : Number.isFinite(duration) && duration > 0 && duration <= 180000
        ? 1
        : 0;

  return {
    performance,
    completion,
    bonus: mistakeBonus + speedBonus,
    total: performance + completion + mistakeBonus + speedBonus,
    maximum: 30,
  };
}

export function spellingPoints(accuracy: number, isCorrect: boolean) {
  const performance = part(accuracy, 4);
  const bonus = isCorrect ? 1 : 0;

  return {
    performance,
    completion: 0,
    bonus,
    total: performance + bonus,
    maximum: 5,
  };
}

export function readAloudPoints(accuracy: number, completeness: number) {
  const performance = part(accuracy, 12);
  const bonus = part(completeness, 6);
  const completion = 2;

  return {
    performance,
    completion,
    bonus,
    total: performance + completion + bonus,
    maximum: 20,
  };
}

export function speakingPoints(
  relevance: number,
  completeness: number,
  fluency: number | null,
) {
  const performance = part(relevance, 12);
  const completenessPoints = part(completeness, 5);
  const fluencyPoints = part(fluency ?? 70, 2);
  const completion = 1;

  return {
    performance,
    completion,
    bonus: completenessPoints + fluencyPoints,
    total: performance + completion + completenessPoints + fluencyPoints,
    maximum: 20,
  };
}
