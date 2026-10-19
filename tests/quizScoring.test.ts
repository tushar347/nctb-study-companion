import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidQuizSubmissionError,
  parseQuizQuestions,
  scoreQuizSubmission,
} from "../lib/quizScoring";

const questions = parseQuizQuestions([
  {
    id: "q1",
    question: "Choose the right word.",
    options: ["help", "helps", "helped", "helping"],
    correctAnswerIndex: 1,
    explanation: "The singular subject takes helps.",
  },
  {
    id: "q2",
    question: "Choose the correct meaning.",
    options: ["read", "write", "learn", "sleep"],
    correctAnswerIndex: 2,
    explanation: "The passage says friends help us learn.",
  },
]);

test("scores choices against the stored answer key", () => {
  const result = scoreQuizSubmission(questions, {
    q1: 1,
    q2: 0,
  });

  assert.equal(result.score, 1);
  assert.equal(result.total, 2);
  assert.equal(result.accuracy, 50);
  assert.equal(result.checkedAnswers[1].correctAnswer, "learn");
});

test("rejects missing, extra, and invalid answers", () => {
  assert.throws(
    () => scoreQuizSubmission(questions, { q1: 1 }),
    InvalidQuizSubmissionError,
  );
  assert.throws(
    () => scoreQuizSubmission(questions, { q1: 1, q2: 2, other: 0 }),
    InvalidQuizSubmissionError,
  );
  assert.throws(
    () => scoreQuizSubmission(questions, { q1: 9, q2: 2 }),
    InvalidQuizSubmissionError,
  );
});

test("rejects malformed stored answer keys", () => {
  assert.throws(
    () =>
      parseQuizQuestions([
        {
          id: "q1",
          question: "Question",
          options: ["A", "B"],
          correctAnswerIndex: 3,
          explanation: "Explanation",
        },
      ]),
    /invalid question/i,
  );
});
