"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  BookOpen,
  Brain,
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  Sparkles,
  WifiOff,
} from "lucide-react";

import AppShell from "@/components/study/AppShell";

type BookId =
  | "class6-english"
  | "class7-english";

type Feature =
  | "quiz"
  | "ask"
  | "checker";

type StatusResponse = {
  success?: boolean;
  online?: boolean;
  modelInstalled?: boolean;
  preview?: boolean;
  message?: string;
};

type PageResponse = {
  success?: boolean;
  cleanText?: string;
  aiReadyText?: string;
  rawText?: string;
  error?: string;
  lines?: Array<{
    text?: string;
    cleanText?: string;
  }>;
  aiReadyLines?: Array<{
    text?: string;
    cleanText?: string;
  }>;
};

type Mcq = {
  question: string;
  options: string[];
  correctAnswer: string;
  evidenceQuote: string;
};

type ShortQa = {
  question: string;
  answer: string;
  evidenceQuote: string;
};

type QuizResponse = {
  success?: boolean;
  error?: string;
  quiz?: {
    mcq: Mcq;
    shortQa: ShortQa;
  };
};

type AskResponse = {
  success?: boolean;
  error?: string;
  supported?: boolean;
  answer?: string;
  evidenceQuote?: string | null;
};

type CheckerResponse = {
  success?: boolean;
  error?: string;
  verdict?:
    | "correct"
    | "partially_correct"
    | "incorrect";
  feedback?: string;
  referenceAnswer?: string;
  evidenceQuote?: string;
};

const BOOKS = {
  "class6-english": {
    title: "English For Today - Class 6",
    classLevel: 6,
    defaultPage: 12,
  },
  "class7-english": {
    title: "English For Today - Class 7",
    classLevel: 7,
    defaultPage: 23,
  },
} as const;

async function getJson<T extends {
  success?: boolean;
  error?: string;
}>(
  response: Response,
): Promise<T> {
  let result: T;

  try {
    result =
      (await response.json()) as T;
  } catch {
    throw new Error(
      "The response could not be read.",
    );
  }

  if (
    !response.ok ||
    result.success === false
  ) {
    throw new Error(
      result.error ||
        "Something went wrong. Please try again.",
    );
  }

  return result;
}

function panelClass() {
  return [
    "rounded-3xl",
    "border",
    "border-slate-200",
    "bg-white",
    "p-5",
    "shadow-sm",
    "sm:p-6",
  ].join(" ");
}

function verdictInfo(
  verdict:
    | CheckerResponse["verdict"]
    | undefined,
) {
  if (verdict === "correct") {
    return {
      label: "Correct",
      className:
        "bg-emerald-100 text-emerald-800",
    };
  }

  if (
    verdict ===
    "partially_correct"
  ) {
    return {
      label: "Almost correct",
      className:
        "bg-amber-100 text-amber-800",
    };
  }

  return {
    label: "Try again",
    className:
      "bg-rose-100 text-rose-800",
  };
}

export default function OfflineStudyPage() {
  const [status, setStatus] =
    useState<StatusResponse | null>(
      null,
    );

  const [bookId, setBookId] =
    useState<BookId>(
      "class6-english",
    );

  const [pageNumber, setPageNumber] =
    useState(12);

  const [passage, setPassage] =
    useState("");

  const [pageLoading, setPageLoading] =
    useState(false);

  const [pageError, setPageError] =
    useState("");

  const [feature, setFeature] =
    useState<Feature>("quiz");

  const [quiz, setQuiz] =
    useState<QuizResponse | null>(
      null,
    );

  const [quizLoading, setQuizLoading] =
    useState(false);

  const [quizError, setQuizError] =
    useState("");

  const [selectedOption, setSelectedOption] =
    useState("");

  const [studentQuestion, setStudentQuestion] =
    useState("");

  const [askResult, setAskResult] =
    useState<AskResponse | null>(
      null,
    );

  const [askLoading, setAskLoading] =
    useState(false);

  const [askError, setAskError] =
    useState("");

  const [studentAnswer, setStudentAnswer] =
    useState("");

  const [checkerResult, setCheckerResult] =
    useState<CheckerResponse | null>(
      null,
    );

  const [checkerLoading, setCheckerLoading] =
    useState(false);

  const [checkerError, setCheckerError] =
    useState("");

  const currentBook =
    BOOKS[bookId];

  const mcq =
    quiz?.quiz?.mcq;

  const shortQa =
    quiz?.quiz?.shortQa;

  const ready =
    Boolean(
      status?.online &&
      status?.modelInstalled,
    );

  function resetActivities() {
    setQuiz(null);
    setQuizError("");
    setSelectedOption("");

    setAskResult(null);
    setAskError("");

    setCheckerResult(null);
    setCheckerError("");
    setStudentAnswer("");
  }

  async function checkStatus() {
    try {
      const response =
        await fetch(
          "/api/local-ai/status",
          {
            cache: "no-store",
          },
        );

      const result =
        (await response.json()) as
          StatusResponse;

      setStatus(result);
    } catch {
      setStatus({
        online: false,
        modelInstalled: false,
        preview: true,
        message:
          "Offline Study is available in the computer edition.",
      });
    }
  }

  async function loadPassage(
    targetBook = bookId,
    targetPage = pageNumber,
  ) {
    setPageLoading(true);
    setPageError("");
    resetActivities();

    try {
      const safePage = Math.max(
        1,
        Math.round(targetPage),
      );

      const response =
        await fetch(
          `/api/books/${targetBook}/pages/${safePage}`,
          {
            cache: "no-store",
          },
        );

      const result =
        await getJson<PageResponse>(
          response,
        );

      const lines =
        result.aiReadyLines &&
        result.aiReadyLines.length > 0
          ? result.aiReadyLines
          : result.lines || [];

      const lineText = lines
        .map(
          (line) =>
            String(
              line.cleanText ||
              line.text ||
              "",
            ).trim(),
        )
        .filter(Boolean)
        .join("\n");

      const text = String(
        result.aiReadyText ||
        result.cleanText ||
        lineText ||
        result.rawText ||
        "",
      ).trim();

      if (text.length < 40) {
        throw new Error(
          "This page does not have enough readable text. Try another page.",
        );
      }

      setPageNumber(safePage);
      setPassage(text);
    } catch (error) {
      setPassage("");

      setPageError(
        error instanceof Error
          ? error.message
          : "The page could not be loaded.",
      );
    } finally {
      setPageLoading(false);
    }
  }

  async function generateQuiz() {
    if (passage.trim().length < 60) {
      setQuizError(
        "Choose a readable textbook page first.",
      );

      return;
    }

    setQuizLoading(true);
    setQuizError("");
    setQuiz(null);
    setSelectedOption("");
    setCheckerResult(null);

    try {
      const response =
        await fetch(
          "/api/local-ai/quiz",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              passage,
              bookId,
              pageNumber,
              classLevel:
                currentBook.classLevel,
            }),
          },
        );

      const result =
        await getJson<QuizResponse>(
          response,
        );

      if (!result.quiz) {
        throw new Error(
          "The quiz could not be created.",
        );
      }

      setQuiz(result);
    } catch (error) {
      setQuizError(
        error instanceof Error
          ? error.message
          : "The quiz could not be created.",
      );
    } finally {
      setQuizLoading(false);
    }
  }

  async function askText(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!studentQuestion.trim()) {
      setAskError(
        "Write a question first.",
      );

      return;
    }

    setAskLoading(true);
    setAskError("");
    setAskResult(null);

    try {
      const response =
        await fetch(
          "/api/local-ai/ask",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              passage,
              question:
                studentQuestion,
              bookId,
              pageNumber,
              classLevel:
                currentBook.classLevel,
            }),
          },
        );

      const result =
        await getJson<AskResponse>(
          response,
        );

      setAskResult(result);
    } catch (error) {
      setAskError(
        error instanceof Error
          ? error.message
          : "The question could not be answered.",
      );
    } finally {
      setAskLoading(false);
    }
  }

  async function checkAnswer(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!shortQa) {
      setCheckerError(
        "Make a quiz first.",
      );

      return;
    }

    if (!studentAnswer.trim()) {
      setCheckerError(
        "Write your answer first.",
      );

      return;
    }

    setCheckerLoading(true);
    setCheckerError("");
    setCheckerResult(null);

    try {
      const response =
        await fetch(
          "/api/local-ai/check-answer",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              passage,
              question:
                shortQa.question,
              referenceAnswer:
                shortQa.answer,
              studentAnswer,
              classLevel:
                currentBook.classLevel,
            }),
          },
        );

      const result =
        await getJson<CheckerResponse>(
          response,
        );

      setCheckerResult(result);
    } catch (error) {
      setCheckerError(
        error instanceof Error
          ? error.message
          : "The answer could not be checked.",
      );
    } finally {
      setCheckerLoading(false);
    }
  }

  useEffect(() => {
    void checkStatus();

    void loadPassage(
      "class6-english",
      12,
    );
  }, []);

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl space-y-6 pb-16">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20">
                  <WifiOff size={29} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                    Learn anywhere
                  </p>

                  <h1 className="text-3xl font-black sm:text-5xl">
                    Offline Study Buddy
                  </h1>
                </div>
              </div>

              <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-blue-50 sm:text-base">
                Choose a textbook page, make a quiz, ask about the text,
                and practise your answers.
              </p>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/15 px-5 py-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-blue-100">
                Offline Study
              </p>

              <div className="mt-2 flex items-center gap-2 font-black">
                {ready ? (
                  <CheckCircle2
                    size={20}
                    className="text-emerald-200"
                  />
                ) : (
                  <CircleAlert
                    size={20}
                    className="text-amber-200"
                  />
                )}

                {ready
                  ? "Ready to study"
                  : "Computer edition required"}
              </div>

              <p className="mt-1 max-w-xs text-xs font-semibold leading-5 text-blue-100">
                {status?.message ||
                  "Checking Offline Study..."}
              </p>
            </div>
          </div>
        </section>

        {status?.preview && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
            This is the online preview. Open the computer edition to use
            these tools without internet.
          </section>
        )}

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className={panelClass()}>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">
                <BookOpen size={24} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-indigo-600">
                  Step 1
                </p>

                <h2 className="text-2xl font-black">
                  Choose your lesson
                </h2>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_120px]">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Textbook
                </span>

                <select
                  value={bookId}
                  onChange={(event) => {
                    const nextBook =
                      event.target.value as
                        BookId;

                    const nextPage =
                      BOOKS[nextBook]
                        .defaultPage;

                    setBookId(nextBook);
                    setPageNumber(nextPage);

                    void loadPassage(
                      nextBook,
                      nextPage,
                    );
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-indigo-500"
                >
                  {Object.entries(
                    BOOKS,
                  ).map(
                    ([id, book]) => (
                      <option
                        key={id}
                        value={id}
                      >
                        {book.title}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Page
                </span>

                <input
                  type="number"
                  min={1}
                  max={200}
                  value={pageNumber}
                  onChange={(event) =>
                    setPageNumber(
                      Math.max(
                        1,
                        Number(
                          event.target.value,
                        ) || 1,
                      ),
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadPassage()
              }
              disabled={pageLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {pageLoading ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw size={18} />
              )}

              {pageLoading
                ? "Opening page..."
                : "Open this page"}
            </button>

            {pageError && (
              <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {pageError}
              </div>
            )}

            <label className="mt-5 grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Textbook passage
              </span>

              <textarea
                value={passage}
                onChange={(event) => {
                  setPassage(
                    event.target.value,
                  );

                  resetActivities();
                }}
                rows={18}
                className="resize-y rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold leading-7 text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
              />
            </label>
          </section>

          <div className="space-y-5">
            <nav className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  setFeature("quiz")
                }
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
                  feature === "quiz"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                <Sparkles size={18} />
                Make a Quiz
              </button>

              <button
                type="button"
                onClick={() =>
                  setFeature("ask")
                }
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
                  feature === "ask"
                    ? "bg-violet-600 text-white"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                <MessageCircleQuestion
                  size={18}
                />
                Ask the Text
              </button>

              <button
                type="button"
                onClick={() =>
                  setFeature("checker")
                }
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
                  feature === "checker"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                <Brain size={18} />
                Check My Answer
              </button>
            </nav>

            {feature === "quiz" && (
              <section className={panelClass()}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-indigo-600">
                      Step 2
                    </p>

                    <h2 className="text-2xl font-black">
                      Make a Quiz
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Get one multiple-choice and one short-answer question.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void generateQuiz()
                    }
                    disabled={
                      quizLoading ||
                      !ready
                    }
                    className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {quizLoading ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    ) : (
                      <FileQuestion
                        size={18}
                      />
                    )}

                    {quizLoading
                      ? "Making quiz..."
                      : "Make my quiz"}
                  </button>
                </div>

                {quizLoading && (
                  <div className="mt-5 rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-700">
                    Your Study Buddy is reading the passage and preparing
                    your questions.
                  </div>
                )}

                {quizError && (
                  <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
                    {quizError}
                  </div>
                )}

                {mcq && (
                  <div className="mt-6 rounded-3xl bg-indigo-50 p-5">
                    <p className="text-xs font-black uppercase tracking-wide text-indigo-600">
                      Multiple choice
                    </p>

                    <h3 className="mt-2 text-lg font-black leading-7">
                      {mcq.question}
                    </h3>

                    <div className="mt-4 grid gap-3">
                      {mcq.options.map(
                        (option, index) => {
                          const selected =
                            selectedOption ===
                            option;

                          const correct =
                            Boolean(
                              selectedOption,
                            ) &&
                            option ===
                              mcq.correctAnswer;

                          const wrong =
                            selected &&
                            option !==
                              mcq.correctAnswer;

                          return (
                            <button
                              key={`${option}-${index}`}
                              type="button"
                              onClick={() =>
                                setSelectedOption(
                                  option,
                                )
                              }
                              className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold ${
                                correct
                                  ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                                  : wrong
                                    ? "border-rose-400 bg-rose-100 text-rose-900"
                                    : "border-slate-200 bg-white hover:border-indigo-400"
                              }`}
                            >
                              <span className="mr-3 font-black">
                                {String.fromCharCode(
                                  65 + index,
                                )}
                                .
                              </span>

                              {option}
                            </button>
                          );
                        },
                      )}
                    </div>

                    {selectedOption && (
                      <div className="mt-4 rounded-2xl bg-white p-4">
                        <p className="font-black">
                          {selectedOption ===
                          mcq.correctAnswer
                            ? "Great work! That is correct."
                            : `Good try. The answer is: ${mcq.correctAnswer}`}
                        </p>

                        <p className="mt-3 border-l-4 border-indigo-400 pl-3 text-sm font-semibold italic leading-6 text-slate-600">
                          {mcq.evidenceQuote}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {shortQa && (
                  <div className="mt-5 rounded-3xl bg-violet-50 p-5">
                    <p className="text-xs font-black uppercase tracking-wide text-violet-600">
                      Short answer
                    </p>

                    <h3 className="mt-2 text-lg font-black leading-7">
                      {shortQa.question}
                    </h3>

                    <button
                      type="button"
                      onClick={() =>
                        setFeature(
                          "checker",
                        )
                      }
                      className="mt-4 rounded-2xl bg-violet-600 px-5 py-3 font-black text-white"
                    >
                      Write my answer
                    </button>
                  </div>
                )}
              </section>
            )}

            {feature === "ask" && (
              <section className={panelClass()}>
                <p className="text-xs font-black uppercase tracking-wide text-violet-600">
                  Ask about your lesson
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Ask the Text
                </h2>

                <form
                  onSubmit={askText}
                  className="mt-5"
                >
                  <textarea
                    value={studentQuestion}
                    onChange={(event) =>
                      setStudentQuestion(
                        event.target.value,
                      )
                    }
                    rows={4}
                    placeholder="What would you like to know about this passage?"
                    className="w-full resize-y rounded-3xl border border-slate-200 px-4 py-4 text-sm font-semibold outline-none focus:border-violet-500"
                  />

                  <button
                    type="submit"
                    disabled={
                      askLoading ||
                      !ready
                    }
                    className="mt-3 flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-black text-white disabled:opacity-50"
                  >
                    {askLoading && (
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    )}

                    {askLoading
                      ? "Finding the answer..."
                      : "Ask my question"}
                  </button>
                </form>

                {askError && (
                  <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
                    {askError}
                  </div>
                )}

                {askResult && (
                  <div className="mt-5 rounded-3xl bg-violet-50 p-5">
                    <p className="font-black">
                      {askResult.supported
                        ? "Answer"
                        : "Not found in this passage"}
                    </p>

                    <p className="mt-3 font-semibold leading-7 text-slate-700">
                      {askResult.answer}
                    </p>

                    {askResult.evidenceQuote && (
                      <p className="mt-4 border-l-4 border-violet-400 pl-3 text-sm font-semibold italic leading-6 text-slate-600">
                        {askResult.evidenceQuote}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            {feature === "checker" && (
              <section className={panelClass()}>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
                  Practise your answer
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Check My Answer
                </h2>

                {!shortQa ? (
                  <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
                    Make a quiz first to get a short-answer question.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 rounded-3xl bg-emerald-50 p-5">
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
                        Your question
                      </p>

                      <h3 className="mt-2 text-lg font-black leading-7">
                        {shortQa.question}
                      </h3>
                    </div>

                    <form
                      onSubmit={checkAnswer}
                      className="mt-5"
                    >
                      <textarea
                        value={studentAnswer}
                        onChange={(event) =>
                          setStudentAnswer(
                            event.target.value,
                          )
                        }
                        rows={4}
                        placeholder="Write your answer here..."
                        className="w-full resize-y rounded-3xl border border-slate-200 px-4 py-4 text-sm font-semibold outline-none focus:border-emerald-500"
                      />

                      <button
                        type="submit"
                        disabled={
                          checkerLoading ||
                          !ready
                        }
                        className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50"
                      >
                        {checkerLoading && (
                          <Loader2
                            size={18}
                            className="animate-spin"
                          />
                        )}

                        {checkerLoading
                          ? "Checking..."
                          : "Check my answer"}
                      </button>
                    </form>
                  </>
                )}

                {checkerError && (
                  <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
                    {checkerError}
                  </div>
                )}

                {checkerResult?.verdict && (
                  <div className="mt-5 rounded-3xl border border-slate-200 p-5">
                    <span
                      className={`inline-flex rounded-full px-4 py-2 text-xs font-black uppercase ${
                        verdictInfo(
                          checkerResult.verdict,
                        ).className
                      }`}
                    >
                      {
                        verdictInfo(
                          checkerResult.verdict,
                        ).label
                      }
                    </span>

                    <p className="mt-4 font-semibold leading-7 text-slate-700">
                      {checkerResult.feedback}
                    </p>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase text-slate-500">
                        Answer from the textbook
                      </p>

                      <p className="mt-2 font-bold">
                        {checkerResult.referenceAnswer}
                      </p>
                    </div>

                    <p className="mt-4 border-l-4 border-emerald-400 pl-3 text-sm font-semibold italic leading-6 text-slate-600">
                      {checkerResult.evidenceQuote}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
