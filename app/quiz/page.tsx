"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Gauge,
  GraduationCap,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
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

type McqQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  marks: number;
};

type PassageQuestion = {
  id: string;
  question: string;
  expectedAnswer: string;
  keywords: string[];
  explanation: string;
  marks: number;
};

type FillQuestion = {
  id: string;
  sentence: string;
  acceptedAnswers: string[];
  explanation: string;
  marks: number;
};

type ModelQuizPaper = {
  schemaVersion: number;
  quizId: string;
  mode: "model";
  title: string;
  bookId: string;
  classLevel: number;
  pageNumber: number;
  lessonNo: number;
  lessonTitle: string;
  difficulty: Difficulty;
  passage: string;
  instructions: string[];
  timeMinutes: number;
  totalMarks: number;
  source?: string;
  sections: {
    mcq: McqQuestion[];
    passageQuestions: PassageQuestion[];
    fillWithoutClues: FillQuestion[];
    fillWithClues: {
      clueBox: string[];
      questions: FillQuestion[];
    };
  };
};

type QuizAnswers = {
  mcq: Record<string, number>;
  passageQuestions: Record<string, string>;
  fillWithoutClues: Record<string, string>;
  fillWithClues: Record<string, string>;
};

type SectionScore = {
  score: number;
  total: number;
};

type QuizResult = {
  score: number;
  total: number;
  percentage: number;
  sections: {
    mcq: SectionScore;
    passageQuestions: SectionScore;
    fillWithoutClues: SectionScore;
    fillWithClues: SectionScore;
  };
  wrongAnswers: {
    section: string;
    questionId: string;
    submittedAnswer: string | number | null;
    correctAnswer: string;
  }[];
  weakAreas: string[];
};

type GenerateResponse = {
  success: boolean;
  paper?: ModelQuizPaper;
  source?: string;
  warning?: string;
  error?: string;
};

const emptyAnswers: QuizAnswers = {
  mcq: {},
  passageQuestions: {},
  fillWithoutClues: {},
  fillWithClues: {},
};

const difficultyDetails: Record<
  Difficulty,
  {
    title: string;
    description: string;
  }
> = {
  easy: {
    title: "Easy",
    description:
      "Direct facts, simple vocabulary and short answers.",
  },
  medium: {
    title: "Medium",
    description:
      "Balanced comprehension, vocabulary and grammar.",
  },
  hard: {
    title: "Hard",
    description:
      "Inference, close reading and stronger distractors.",
  },
};

function normalizeAnswer(
  value: unknown,
): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()[\]{}]/g, "")
    .replace(/\s+/g, " ");
}

function inferClassLevel(
  bookId: string,
): number {
  const match = bookId.match(/class(\d+)/i);

  return match ? Number(match[1]) : 6;
}

function SectionHeading({
  label,
  title,
  instruction,
  marks,
}: {
  label: string;
  title: string;
  instruction: string;
  marks: number;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-3xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
          {label}
        </p>

        <h2 className="mt-1 text-xl font-black">
          {title}
        </h2>

        <p className="mt-1 text-sm font-semibold text-slate-300">
          {instruction}
        </p>
      </div>

      <div className="w-fit rounded-2xl bg-white/10 px-4 py-2 text-sm font-black">
        {marks} marks
      </div>
    </div>
  );
}

function scorePaper(
  paper: ModelQuizPaper,
  answers: QuizAnswers,
): QuizResult {
  let mcqScore = 0;
  let passageScore = 0;
  let withoutCluesScore = 0;
  let withCluesScore = 0;

  const wrongAnswers: QuizResult["wrongAnswers"] =
    [];

  for (const question of paper.sections.mcq) {
    const submitted =
      answers.mcq[question.id];

    if (
      submitted ===
      question.correctAnswerIndex
    ) {
      mcqScore += question.marks;
    } else {
      wrongAnswers.push({
        section: "MCQ",
        questionId: question.id,
        submittedAnswer:
          submitted ?? null,
        correctAnswer:
          question.options[
            question.correctAnswerIndex
          ] ?? "",
      });
    }
  }

  for (
    const question of
    paper.sections.passageQuestions
  ) {
    const submitted =
      answers.passageQuestions[
        question.id
      ] ?? "";

    const normalizedSubmitted =
      normalizeAnswer(submitted);

    const keywordMatches =
      question.keywords.filter(
        (keyword) =>
          normalizedSubmitted.includes(
            normalizeAnswer(keyword),
          ),
      ).length;

    const requiredMatches =
      question.keywords.length >= 3
        ? 2
        : 1;

    if (
      normalizedSubmitted &&
      (normalizedSubmitted ===
        normalizeAnswer(
          question.expectedAnswer,
        ) ||
        keywordMatches >= requiredMatches)
    ) {
      passageScore += question.marks;
    } else {
      wrongAnswers.push({
        section: "Passage questions",
        questionId: question.id,
        submittedAnswer: submitted,
        correctAnswer:
          question.expectedAnswer,
      });
    }
  }

  for (
    const question of
    paper.sections.fillWithoutClues
  ) {
    const submitted =
      answers.fillWithoutClues[
        question.id
      ] ?? "";

    const correct =
      question.acceptedAnswers.some(
        (acceptedAnswer) =>
          normalizeAnswer(
            acceptedAnswer,
          ) === normalizeAnswer(submitted),
      );

    if (correct) {
      withoutCluesScore +=
        question.marks;
    } else {
      wrongAnswers.push({
        section: "Gap filling without clues",
        questionId: question.id,
        submittedAnswer: submitted,
        correctAnswer:
          question.acceptedAnswers.join(
            " / ",
          ),
      });
    }
  }

  for (
    const question of
    paper.sections.fillWithClues.questions
  ) {
    const submitted =
      answers.fillWithClues[
        question.id
      ] ?? "";

    const correct =
      question.acceptedAnswers.some(
        (acceptedAnswer) =>
          normalizeAnswer(
            acceptedAnswer,
          ) === normalizeAnswer(submitted),
      );

    if (correct) {
      withCluesScore +=
        question.marks;
    } else {
      wrongAnswers.push({
        section: "Gap filling with clues",
        questionId: question.id,
        submittedAnswer: submitted,
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
    percentage: Math.round(
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

export default function QuizPage() {
  const [studentKey, setStudentKey] =
    useState("demo-student");

  const [studentName, setStudentName] =
    useState("Student");

  const [bookId, setBookId] =
    useState("class6-english");

  const [classLevel, setClassLevel] =
    useState(6);

  const [pageNumber, setPageNumber] =
    useState(1);

  const [lessonNo, setLessonNo] =
    useState(1);

  const [lessonTitle, setLessonTitle] =
    useState("Selected Book Content");

  const [selectedText, setSelectedText] =
    useState("");

  const [difficulty, setDifficulty] =
    useState<Difficulty>("medium");

  const [paper, setPaper] =
    useState<ModelQuizPaper | null>(null);

  const [answers, setAnswers] =
    useState<QuizAnswers>(emptyAnswers);

  const [result, setResult] =
    useState<QuizResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [warning, setWarning] =
    useState("");

  const readerHref =
    `/reader?book=${encodeURIComponent(
      bookId,
    )}`;

  const answeredCount = useMemo(() => {
    return (
      Object.keys(answers.mcq).length +
      Object.values(
        answers.passageQuestions,
      ).filter((answer) =>
        answer.trim(),
      ).length +
      Object.values(
        answers.fillWithoutClues,
      ).filter((answer) =>
        answer.trim(),
      ).length +
      Object.values(
        answers.fillWithClues,
      ).filter((answer) =>
        answer.trim(),
      ).length
    );
  }, [answers]);

  useEffect(() => {
    const storedBookId =
      localStorage.getItem(
        "selectedBookId",
      ) ?? "class6-english";

    const storedPageNumber = Number(
      localStorage.getItem(
        "selectedBookPdfPage",
      ) ?? 1,
    );

    const safePageNumber =
      Number.isInteger(storedPageNumber) &&
      storedPageNumber > 0
        ? storedPageNumber
        : 1;

    const storedLessonNo = Number(
      localStorage.getItem(
        "selectedLessonNo",
      ) ?? safePageNumber,
    );

    const safeLessonNo =
      Number.isInteger(storedLessonNo) &&
      storedLessonNo > 0
        ? storedLessonNo
        : safePageNumber;

    setStudentKey(
      getStoredStudentKey() ||
        "demo-student",
    );

    setStudentName(
      getStoredStudentName() ||
        "Student",
    );

    setBookId(storedBookId);

    setClassLevel(
      Number(
        localStorage.getItem(
          "selectedClass",
        ),
      ) ||
        inferClassLevel(
          storedBookId,
        ),
    );

    setPageNumber(safePageNumber);
    setLessonNo(safeLessonNo);

    setLessonTitle(
      localStorage.getItem(
        "selectedLessonTitle",
      ) ??
        `English For Today — Page ${safePageNumber}`,
    );

    setSelectedText(
      localStorage.getItem(
        "selectedLine",
      ) ?? "",
    );
  }, []);

  async function generateModelQuiz() {
    setLoading(true);
    setError("");
    setWarning("");
    setPaper(null);
    setResult(null);
    setAnswers(emptyAnswers);

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
            mode: "model",
            bookId,
            classLevel,
            pageNumber,
            lessonNo,
            lessonTitle,
            selectedText,
            difficulty,
          }),
        },
      );

      const raw = await response.text();

      let data: GenerateResponse;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          `Quiz API returned ${response.status} instead of JSON.`,
        );
      }

      if (
        !response.ok ||
        !data.success ||
        !data.paper
      ) {
        throw new Error(
          data.error ??
            "Model question generation failed.",
        );
      }

      setPaper({
        ...data.paper,
        source:
          data.source ??
          data.paper.source,
      });

      setWarning(data.warning ?? "");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Model question generation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetPaper() {
    setPaper(null);
    setResult(null);
    setAnswers(emptyAnswers);
    setError("");
    setWarning("");
  }

  async function submitPaper() {
    if (!paper) return;

    setSubmitting(true);
    setError("");

    const scoredResult =
      scorePaper(paper, answers);

    setResult(scoredResult);

    try {
      await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          studentKey:
            studentKey ||
            "demo-student",
          studentId:
            studentKey ||
            "demo-student",
          lessonNo:
            paper.lessonNo || 1,
          lessonTitle:
            paper.lessonTitle,
          score:
            scoredResult.score,
          total:
            scoredResult.total,
          wrongAnswers:
            scoredResult.wrongAnswers,
          weakAreas:
            scoredResult.weakAreas,
          submittedAnswers: answers,
          bookId: paper.bookId,
          pageNumber:
            paper.pageNumber,
          quizMode: "model",
        }),
      });
    } catch {
      setWarning(
        "Your result is visible, but it could not be saved to the database.",
      );
    } finally {
      setSubmitting(false);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <LiquidCard className="overflow-hidden p-0">
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-white/15 shadow-lg">
                  <GraduationCap
                    size={29}
                  />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                    Bangladesh Model Question
                  </p>

                  <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                    Traditional English Model Test
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-emerald-50">
                    5 MCQs, passage-based
                    questions, gap filling
                    without clues, and gap
                    filling with a clue box.
                  </p>
                </div>
              </div>

              <Link
                href={readerHref}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-800 shadow-lg"
              >
                <ArrowLeft size={17} />
                Back to Reader
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "A",
                  "5 MCQ",
                  "5 marks",
                ],
                [
                  "B",
                  "Passage Questions",
                  "5 marks",
                ],
                [
                  "C",
                  "Without Clues",
                  "5 marks",
                ],
                [
                  "D",
                  "With Clue Box",
                  "5 marks",
                ],
              ].map(
                ([
                  section,
                  title,
                  marks,
                ]) => (
                  <div
                    key={section}
                    className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur"
                  >
                    <p className="text-xs font-black uppercase text-emerald-100">
                      Section {section}
                    </p>

                    <p className="mt-1 font-black">
                      {title}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-emerald-100">
                      {marks}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </LiquidCard>

        {!paper && (
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <LiquidCard className="p-6">
              <div className="flex items-center gap-3">
                <Gauge
                  className="text-blue-700"
                  size={24}
                />

                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Select Difficulty
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    The paper always contains
                    20 questions and 20 marks.
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
                    type="button"
                    onClick={() =>
                      setDifficulty(level)
                    }
                    className={`rounded-3xl border p-5 text-left transition ${
                      difficulty === level
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-xl"
                        : "border-slate-200 bg-white/75 text-slate-800 hover:border-emerald-300"
                    }`}
                  >
                    <p className="font-black">
                      {
                        difficultyDetails[
                          level
                        ].title
                      }
                    </p>

                    <p
                      className={`mt-1 text-sm font-semibold ${
                        difficulty === level
                          ? "text-emerald-100"
                          : "text-slate-500"
                      }`}
                    >
                      {
                        difficultyDetails[
                          level
                        ].description
                      }
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Current source
                </p>

                <p className="mt-2 text-lg font-black">
                  Class {classLevel} ·
                  English For Today
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-300">
                  PDF/OCR page {pageNumber}
                </p>

                <p className="mt-4 text-xs font-bold text-slate-400">
                  Student: {studentName}
                </p>
              </div>
            </LiquidCard>

            <LiquidCard className="p-6">
              <div className="flex items-center gap-3">
                <BookOpen
                  className="text-orange-600"
                  size={24}
                />

                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Source Passage
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    Gemini will use the selected
                    line and cleaned OCR text from
                    the current page.
                  </p>
                </div>
              </div>

              <div className="mt-5 min-h-48 rounded-3xl border border-orange-100 bg-orange-50/70 p-5 text-sm font-semibold leading-7 text-slate-700">
                {selectedText ||
                  `The complete cleaned OCR text from page ${pageNumber} will be used to create the model question.`}
              </div>

              <div className="mt-5 rounded-3xl bg-emerald-50 p-5">
                <p className="font-black text-emerald-900">
                  Full Marks: 20 · Time:
                  30 minutes
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
                  The generated paper will appear
                  as one traditional question
                  paper instead of one MCQ at a
                  time.
                </p>
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
                type="button"
                onClick={generateModelQuiz}
                disabled={
                  loading ||
                  (!selectedText &&
                    pageNumber < 1)
                }
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-3xl bg-emerald-600 px-6 py-4 text-lg font-black text-white shadow-xl transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      size={21}
                    />
                    Generating 20-mark paper...
                  </>
                ) : (
                  <>
                    <Sparkles size={21} />
                    Generate Model Question
                  </>
                )}
              </button>
            </LiquidCard>
          </div>
        )}

        {paper && (
          <>
            <LiquidCard className="p-6 sm:p-8">
              <div className="border-b-2 border-slate-900 pb-6 text-center">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                  English For Today ·
                  Class {paper.classLevel}
                </p>

                <h2 className="mt-2 text-3xl font-black text-slate-950">
                  {paper.title}
                </h2>

                <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm font-black text-slate-700">
                  <span className="rounded-full bg-slate-100 px-4 py-2">
                    Time: {paper.timeMinutes} minutes
                  </span>

                  <span className="rounded-full bg-slate-100 px-4 py-2">
                    Full Marks: {paper.totalMarks}
                  </span>

                  <span className="rounded-full bg-slate-100 px-4 py-2">
                    Page: {paper.pageNumber}
                  </span>

                  <span className="rounded-full bg-slate-100 px-4 py-2 capitalize">
                    {paper.difficulty}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
                <p className="font-black text-blue-950">
                  Instructions
                </p>

                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm font-semibold leading-6 text-blue-900">
                  {paper.instructions.map(
                    (instruction) => (
                      <li key={instruction}>
                        {instruction}
                      </li>
                    ),
                  )}
                </ol>
              </div>

              <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                  Read the passage carefully
                </p>

                <p className="mt-3 whitespace-pre-wrap text-[15px] font-semibold leading-8 text-slate-800">
                  {paper.passage}
                </p>
              </div>
            </LiquidCard>

            <LiquidCard className="p-6 sm:p-8">
              <SectionHeading
                label="Section A"
                title="Multiple-choice questions"
                instruction="Choose the best answer."
                marks={5}
              />

              <div className="space-y-7">
                {paper.sections.mcq.map(
                  (question, index) => (
                    <div
                      key={question.id}
                      className="rounded-3xl border border-slate-200 bg-white/80 p-5"
                    >
                      <p className="font-black leading-7 text-slate-900">
                        {index + 1}.{" "}
                        {question.question}
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {question.options.map(
                          (
                            option,
                            optionIndex,
                          ) => {
                            const selected =
                              answers.mcq[
                                question.id
                              ] ===
                              optionIndex;

                            return (
                              <label
                                key={`${question.id}-${optionIndex}`}
                                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm font-bold transition ${
                                  selected
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={
                                    question.id
                                  }
                                  checked={
                                    selected
                                  }
                                  disabled={
                                    Boolean(
                                      result,
                                    )
                                  }
                                  onChange={() =>
                                    setAnswers(
                                      (
                                        previous,
                                      ) => ({
                                        ...previous,
                                        mcq: {
                                          ...previous.mcq,
                                          [question.id]:
                                            optionIndex,
                                        },
                                      }),
                                    )
                                  }
                                  className="mt-1"
                                />

                                <span>
                                  {String.fromCharCode(
                                    97 +
                                      optionIndex,
                                  )}
                                  ) {option}
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>

                      {result && (
                        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
                          Correct answer:{" "}
                          {
                            question.options[
                              question.correctAnswerIndex
                            ]
                          }
                          <br />
                          {question.explanation}
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            </LiquidCard>

            <LiquidCard className="p-6 sm:p-8">
              <SectionHeading
                label="Section B"
                title="Questions from the passage"
                instruction="Answer each question in one or two complete sentences."
                marks={5}
              />

              <div className="space-y-6">
                {paper.sections.passageQuestions.map(
                  (question, index) => (
                    <div
                      key={question.id}
                      className="rounded-3xl border border-slate-200 bg-white/80 p-5"
                    >
                      <label className="font-black leading-7 text-slate-900">
                        {index + 1}.{" "}
                        {question.question}
                      </label>

                      <textarea
                        value={
                          answers
                            .passageQuestions[
                            question.id
                          ] ?? ""
                        }
                        disabled={Boolean(
                          result,
                        )}
                        onChange={(event) =>
                          setAnswers(
                            (previous) => ({
                              ...previous,
                              passageQuestions: {
                                ...previous.passageQuestions,
                                [question.id]:
                                  event.target
                                    .value,
                              },
                            }),
                          )
                        }
                        rows={3}
                        placeholder="Write your answer here..."
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold outline-none transition focus:border-emerald-500"
                      />

                      {result && (
                        <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-900">
                          Expected answer:{" "}
                          {
                            question.expectedAnswer
                          }
                          <br />
                          {question.explanation}
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            </LiquidCard>

            <LiquidCard className="p-6 sm:p-8">
              <SectionHeading
                label="Section C"
                title="Fill in the blanks without clues"
                instruction="Complete each sentence with an appropriate word. No word box is provided."
                marks={5}
              />

              <div className="space-y-5">
                {paper.sections.fillWithoutClues.map(
                  (question, index) => (
                    <div
                      key={question.id}
                      className="rounded-3xl border border-slate-200 bg-white/80 p-5"
                    >
                      <p className="font-black leading-7 text-slate-900">
                        {index + 1}.{" "}
                        {question.sentence}
                      </p>

                      <input
                        type="text"
                        value={
                          answers
                            .fillWithoutClues[
                            question.id
                          ] ?? ""
                        }
                        disabled={Boolean(
                          result,
                        )}
                        onChange={(event) =>
                          setAnswers(
                            (previous) => ({
                              ...previous,
                              fillWithoutClues:
                                {
                                  ...previous.fillWithoutClues,
                                  [question.id]:
                                    event
                                      .target
                                      .value,
                                },
                            }),
                          )
                        }
                        placeholder="Type the missing word"
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold outline-none transition focus:border-emerald-500"
                      />

                      {result && (
                        <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
                          Answer:{" "}
                          {question.acceptedAnswers.join(
                            " / ",
                          )}
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            </LiquidCard>

            <LiquidCard className="p-6 sm:p-8">
              <SectionHeading
                label="Section D"
                title="Fill in the blanks with clues"
                instruction="Choose appropriate words from the clue box."
                marks={5}
              />

              <div className="mb-6 rounded-3xl border-2 border-dashed border-purple-300 bg-purple-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
                  Clue box
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {paper.sections.fillWithClues.clueBox.map(
                    (clue) => (
                      <span
                        key={clue}
                        className="rounded-full bg-white px-4 py-2 text-sm font-black text-purple-800 shadow-sm"
                      >
                        {clue}
                      </span>
                    ),
                  )}
                </div>
              </div>

              <div className="space-y-5">
                {paper.sections.fillWithClues.questions.map(
                  (question, index) => (
                    <div
                      key={question.id}
                      className="rounded-3xl border border-slate-200 bg-white/80 p-5"
                    >
                      <p className="font-black leading-7 text-slate-900">
                        {index + 1}.{" "}
                        {question.sentence}
                      </p>

                      <select
                        value={
                          answers
                            .fillWithClues[
                            question.id
                          ] ?? ""
                        }
                        disabled={Boolean(
                          result,
                        )}
                        onChange={(event) =>
                          setAnswers(
                            (previous) => ({
                              ...previous,
                              fillWithClues: {
                                ...previous.fillWithClues,
                                [question.id]:
                                  event.target
                                    .value,
                              },
                            }),
                          )
                        }
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold outline-none transition focus:border-purple-500"
                      >
                        <option value="">
                          Select a word
                        </option>

                        {paper.sections.fillWithClues.clueBox.map(
                          (clue) => (
                            <option
                              key={clue}
                              value={clue}
                            >
                              {clue}
                            </option>
                          ),
                        )}
                      </select>

                      {result && (
                        <div className="mt-3 rounded-2xl bg-purple-50 p-4 text-sm font-bold text-purple-900">
                          Answer:{" "}
                          {question.acceptedAnswers.join(
                            " / ",
                          )}
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            </LiquidCard>

            {result ? (
              <LiquidCard className="p-6 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-yellow-100 text-yellow-700">
                      <Trophy size={31} />
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                        Model Test Result
                      </p>

                      <h2 className="mt-1 text-4xl font-black text-slate-950">
                        {result.score}/
                        {result.total}
                      </h2>

                      <p className="mt-1 font-bold text-slate-500">
                        {result.percentage}%
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={resetPaper}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                  >
                    <RefreshCw size={17} />
                    Generate Another Paper
                  </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [
                      "MCQ",
                      result.sections.mcq,
                    ],
                    [
                      "Passage",
                      result.sections
                        .passageQuestions,
                    ],
                    [
                      "Without clues",
                      result.sections
                        .fillWithoutClues,
                    ],
                    [
                      "With clues",
                      result.sections
                        .fillWithClues,
                    ],
                  ].map(
                    ([
                      label,
                      section,
                    ]) => {
                      const typedSection =
                        section as SectionScore;

                      return (
                        <div
                          key={
                            label as string
                          }
                          className="rounded-3xl bg-slate-50 p-5"
                        >
                          <p className="text-sm font-black text-slate-700">
                            {label as string}
                          </p>

                          <p className="mt-2 text-2xl font-black text-emerald-700">
                            {
                              typedSection.score
                            }
                            /
                            {
                              typedSection.total
                            }
                          </p>
                        </div>
                      );
                    },
                  )}
                </div>

                {result.weakAreas.length >
                  0 && (
                  <div className="mt-6 rounded-3xl bg-orange-50 p-5">
                    <p className="font-black text-orange-900">
                      Areas to practise
                    </p>

                    <p className="mt-2 text-sm font-semibold text-orange-800">
                      {result.weakAreas.join(
                        " · ",
                      )}
                    </p>
                  </div>
                )}
              </LiquidCard>
            ) : (
              <LiquidCard className="sticky bottom-4 p-5 shadow-2xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-slate-900">
                      Answered {answeredCount}/
                      20
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      You can submit even if some
                      answers are blank.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={submitPaper}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white shadow-xl disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2
                        className="animate-spin"
                        size={19}
                      />
                    ) : (
                      <ClipboardCheck
                        size={19}
                      />
                    )}

                    Submit Model Test
                  </button>
                </div>
              </LiquidCard>
            )}

            {warning && (
              <div className="rounded-3xl bg-yellow-50 p-4 font-bold text-yellow-800">
                {warning}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
