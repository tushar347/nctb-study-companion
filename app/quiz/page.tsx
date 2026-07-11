"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Gauge,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";

import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

import {
  getStoredStudentKey,
  getStoredStudentName,
} from "@/lib/studentSession";

type Difficulty =
  | "easy"
  | "medium"
  | "hard";

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
};

type GenerateResponse = {
  success: boolean;
  source?: string;
  difficulty?: Difficulty;
  requestedCount?: number;
  generatedCount?: number;
  questions?: QuizQuestion[];
  warning?: string;
  error?: string;
};

const difficultyLabels: Record<
  Difficulty,
  {
    title: string;
    description: string;
  }
> = {
  easy: {
    title: "Easy",
    description:
      "Direct facts and simple vocabulary",
  },
  medium: {
    title: "Medium",
    description:
      "Comprehension, vocabulary and grammar",
  },
  hard: {
    title: "Hard",
    description:
      "Inference, context and close distractors",
  },
};

export default function QuizPage() {
  const [studentKey, setStudentKey] =
    useState("");

  const [studentName, setStudentName] =
    useState("Student");

  const [selectedText, setSelectedText] =
    useState("");

  const [pageNumber, setPageNumber] =
    useState(0);

  const [lessonNo, setLessonNo] =
    useState(0);

  const [lessonTitle, setLessonTitle] =
    useState("Selected Book Content");

  const [difficulty, setDifficulty] =
    useState<Difficulty>("medium");

  const [questionCount, setQuestionCount] =
    useState(5);

  const [questions, setQuestions] =
    useState<QuizQuestion[]>([]);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [
    selectedAnswers,
    setSelectedAnswers,
  ] = useState<Record<number, number>>({});

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [warning, setWarning] =
    useState("");

  const [completed, setCompleted] =
    useState(false);

  const currentQuestion =
    questions[currentIndex];

  const selectedAnswer =
    selectedAnswers[currentIndex];

  const hasAnswered =
    selectedAnswer !== undefined;

  const score = useMemo(() => {
    return questions.reduce(
      (total, question, index) =>
        selectedAnswers[index] ===
        question.correctAnswerIndex
          ? total + 1
          : total,
      0,
    );
  }, [questions, selectedAnswers]);

  const answeredCount =
    Object.keys(selectedAnswers).length;

  async function generateQuiz() {
    setLoading(true);
    setError("");
    setWarning("");
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setCompleted(false);

    try {
      const response = await fetch(
        "/api/quiz/generate",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            selectedText,
            pageNumber,
            lessonNo,
            difficulty,
            questionCount,
          }),
        },
      );

      const rawResponse =
        await response.text();

      let data: GenerateResponse;

      try {
        data = JSON.parse(rawResponse);
      } catch {
        throw new Error(
          `Quiz API returned ${response.status} ${response.statusText} instead of JSON.`,
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ??
            "Quiz generation failed.",
        );
      }

      if (
        !data.questions ||
        data.questions.length === 0
      ) {
        throw new Error(
          "No valid quiz questions were generated.",
        );
      }

      setQuestions(data.questions);
      setWarning(data.warning ?? "");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Quiz generation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function chooseAnswer(
    optionIndex: number,
  ) {
    if (hasAnswered || completed) return;

    setSelectedAnswers(
      (previousAnswers) => ({
        ...previousAnswers,
        [currentIndex]: optionIndex,
      }),
    );
  }

  async function finishQuiz() {
    setCompleted(true);

    const finalScore =
      questions.reduce(
        (total, question, index) =>
          selectedAnswers[index] ===
          question.correctAnswerIndex
            ? total + 1
            : total,
        0,
      );

    fetch("/api/quiz/attempt", {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        studentKey,
        studentId: studentKey,
        lessonNo,
        lessonTitle,
        score: finalScore,
        totalQuestions:
          questions.length,
        difficulty,
        answers: selectedAnswers,
      }),
    }).catch(() => undefined);

    fetch("/api/study/track", {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        studentKey,
        activityType: "quiz_completed",
        score: finalScore,
        totalQuestions:
          questions.length,
      }),
    }).catch(() => undefined);
  }

  useEffect(() => {
    setStudentKey(getStoredStudentKey());
    setStudentName(getStoredStudentName());

    setSelectedText(
      localStorage.getItem(
        "selectedLine",
      ) ?? "",
    );

    setPageNumber(
      Number(
        localStorage.getItem(
          "selectedBookPdfPage",
        ) ?? 0,
      ),
    );

    setLessonNo(
      Number(
        localStorage.getItem(
          "selectedLessonNo",
        ) ?? 0,
      ),
    );

    setLessonTitle(
      localStorage.getItem(
        "selectedLessonTitle",
      ) ?? "Selected Book Content",
    );
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <LiquidCard className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-emerald-100 text-emerald-700">
                <Brain size={28} />
              </div>

              <div>
                <p className="text-xs font-black uppercase text-emerald-700">
                  Intelligent Quiz Builder
                </p>

                <h1 className="text-3xl font-black text-slate-900">
                  Clean Textbook Quiz
                </h1>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {studentName} ·{" "}
                  {lessonTitle}
                  {pageNumber
                    ? ` · Page ${pageNumber}`
                    : ""}
                </p>
              </div>
            </div>

            <Link
              href="/reader"
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              <ArrowLeft size={17} />
              Back to Reader
            </Link>
          </div>
        </LiquidCard>

        {questions.length === 0 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <LiquidCard className="p-6">
              <div className="flex items-center gap-3">
                <Gauge
                  className="text-blue-700"
                  size={24}
                />

                <div>
                  <h2 className="text-xl font-black">
                    Select Difficulty
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    Choose how challenging the quiz should be.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {(
                  [
                    "easy",
                    "medium",
                    "hard",
                  ] as Difficulty[]
                ).map((level) => (
                  <button
                    key={level}
                    onClick={() =>
                      setDifficulty(level)
                    }
                    className={`rounded-3xl border p-5 text-left transition ${
                      difficulty === level
                        ? "border-blue-600 bg-blue-600 text-white shadow-xl"
                        : "border-white bg-white/75 text-slate-800 hover:border-blue-300"
                    }`}
                  >
                    <p className="font-black">
                      {
                        difficultyLabels[
                          level
                        ].title
                      }
                    </p>

                    <p
                      className={`mt-1 text-sm font-semibold ${
                        difficulty === level
                          ? "text-blue-100"
                          : "text-slate-500"
                      }`}
                    >
                      {
                        difficultyLabels[
                          level
                        ].description
                      }
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <ListChecks
                    className="text-purple-700"
                    size={22}
                  />

                  <h2 className="text-lg font-black">
                    Number of Questions
                  </h2>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[3, 5, 10].map(
                    (count) => (
                      <button
                        key={count}
                        onClick={() =>
                          setQuestionCount(
                            count,
                          )
                        }
                        className={`rounded-2xl px-4 py-4 text-lg font-black ${
                          questionCount ===
                          count
                            ? "bg-purple-700 text-white"
                            : "bg-white/75 text-slate-700"
                        }`}
                      >
                        {count}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </LiquidCard>

            <LiquidCard className="p-6">
              <div className="flex items-center gap-3">
                <BookOpen
                  className="text-orange-600"
                  size={24}
                />

                <div>
                  <h2 className="text-xl font-black">
                    Quiz Source
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    Only cleaned OCR textbook content will be used.
                  </p>
                </div>
              </div>

              <div className="mt-5 min-h-48 rounded-3xl bg-white/75 p-5 text-sm font-semibold leading-7 text-slate-700 shadow-inner">
                {selectedText ||
                  (pageNumber
                    ? `The quiz will use cleaned AI-ready OCR text from PDF page ${pageNumber}.`
                    : "Return to the Reader and select a meaningful textbook sentence.")}
              </div>

              {error && (
                <div className="mt-4 rounded-3xl bg-red-50 p-4 font-bold text-red-700">
                  {error}
                </div>
              )}

              {warning && (
                <div className="mt-4 rounded-3xl bg-yellow-50 p-4 font-bold text-yellow-800">
                  {warning}
                </div>
              )}

              <button
                onClick={generateQuiz}
                disabled={
                  loading ||
                  (!selectedText &&
                    !pageNumber)
                }
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-3xl bg-emerald-600 px-6 py-4 text-lg font-black text-white shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      size={21}
                    />
                    Generating Clean Quiz...
                  </>
                ) : (
                  <>
                    <Sparkles size={21} />
                    Generate{" "}
                    {
                      difficultyLabels[
                        difficulty
                      ].title
                    }{" "}
                    Quiz
                  </>
                )}
              </button>
            </LiquidCard>
          </div>
        )}

        {questions.length > 0 &&
          !completed &&
          currentQuestion && (
            <LiquidCard className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase text-blue-700">
                    Question{" "}
                    {currentIndex + 1} of{" "}
                    {questions.length}
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-500">
                    Difficulty:{" "}
                    {
                      difficultyLabels[
                        difficulty
                      ].title
                    }
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-5 py-3 text-sm font-black shadow-md">
                  Answered {answeredCount}/
                  {questions.length}
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-slate-950 p-6 text-xl font-black leading-9 text-white">
                {currentQuestion.question}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {currentQuestion.options.map(
                  (option, optionIndex) => {
                    const isSelected =
                      selectedAnswer ===
                      optionIndex;

                    const isCorrect =
                      optionIndex ===
                      currentQuestion.correctAnswerIndex;

                    let optionClass =
                      "border-white bg-white/80 text-slate-800 hover:border-blue-400";

                    if (hasAnswered) {
                      if (isCorrect) {
                        optionClass =
                          "border-emerald-600 bg-emerald-100 text-emerald-900";
                      } else if (
                        isSelected
                      ) {
                        optionClass =
                          "border-red-600 bg-red-100 text-red-900";
                      } else {
                        optionClass =
                          "border-white bg-white/50 text-slate-500";
                      }
                    }

                    return (
                      <button
                        key={`${option}-${optionIndex}`}
                        onClick={() =>
                          chooseAnswer(
                            optionIndex,
                          )
                        }
                        disabled={hasAnswered}
                        className={`flex min-h-24 items-center gap-4 rounded-3xl border-2 p-5 text-left font-black transition ${optionClass}`}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-800">
                          {String.fromCharCode(
                            65 +
                              optionIndex,
                          )}
                        </span>

                        <span>{option}</span>
                      </button>
                    );
                  },
                )}
              </div>

              {hasAnswered && (
                <div
                  className={`mt-6 rounded-3xl p-5 ${
                    selectedAnswer ===
                    currentQuestion.correctAnswerIndex
                      ? "bg-emerald-50 text-emerald-900"
                      : "bg-red-50 text-red-900"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {selectedAnswer ===
                    currentQuestion.correctAnswerIndex ? (
                      <CheckCircle2
                        className="mt-1 shrink-0"
                        size={22}
                      />
                    ) : (
                      <XCircle
                        className="mt-1 shrink-0"
                        size={22}
                      />
                    )}

                    <div>
                      <p className="font-black">
                        {selectedAnswer ===
                        currentQuestion.correctAnswerIndex
                          ? "Correct answer"
                          : "Incorrect answer"}
                      </p>

                      <p className="mt-2 text-sm font-semibold leading-7">
                        {
                          currentQuestion.explanation
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  disabled={currentIndex === 0}
                  onClick={() =>
                    setCurrentIndex(
                      (index) =>
                        Math.max(
                          0,
                          index - 1,
                        ),
                    )
                  }
                  className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-slate-700 shadow-md disabled:opacity-40"
                >
                  <ArrowLeft size={18} />
                  Previous
                </button>

                {currentIndex <
                questions.length - 1 ? (
                  <button
                    disabled={!hasAnswered}
                    onClick={() =>
                      setCurrentIndex(
                        (index) =>
                          index + 1,
                      )
                    }
                    className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-md disabled:opacity-40"
                  >
                    Next
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button
                    disabled={
                      answeredCount !==
                      questions.length
                    }
                    onClick={finishQuiz}
                    className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 font-black text-white shadow-md disabled:opacity-40"
                  >
                    <Trophy size={18} />
                    Finish Quiz
                  </button>
                )}
              </div>
            </LiquidCard>
          )}

        {completed && (
          <LiquidCard className="p-8 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-yellow-100 text-yellow-700">
              <Trophy size={40} />
            </div>

            <h2 className="mt-5 text-3xl font-black">
              Quiz Completed
            </h2>

            <p className="mt-3 text-lg font-bold text-slate-600">
              You scored {score} out of{" "}
              {questions.length}.
            </p>

            <p className="mt-2 text-5xl font-black text-emerald-700">
              {Math.round(
                (score /
                  questions.length) *
                  100,
              )}
              %
            </p>

            <div className="mx-auto mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
              <button
                onClick={generateQuiz}
                className="flex items-center justify-center gap-2 rounded-3xl bg-blue-600 px-5 py-4 font-black text-white"
              >
                <RefreshCw size={18} />
                New Quiz
              </button>

              <Link
                href="/reader"
                className="flex items-center justify-center gap-2 rounded-3xl bg-slate-950 px-5 py-4 font-black text-white"
              >
                <BookOpen size={18} />
                Back to Book
              </Link>
            </div>
          </LiquidCard>
        )}
      </div>
    </AppShell>
  );
}