"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  Circle,
  ClipboardList,
  GraduationCap,
  Languages,
  Layers3,
  LibraryBig,
  Loader2,
  MessageCircle,
  RefreshCw,
  School,
  Send,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";

type LessonSummary = {
  lessonNo: number;
  lessonTitle: string;
};

type LessonLine = {
  id: string;
  text: string;
};

type AgentTool = "simple" | "bangla" | "grammar" | "chat";

type AgentResult = {
  tool: AgentTool;
  output: string;
  selectedLine: string;
  lessonNo?: number;
  lessonTitle?: string;
};

type ChatMessage = {
  role: "agent" | "student";
  text: string;
};

type ResearchSummary = {
  studentKey: string;
  name: string | null;
  memory: {
    openedLessons: number[];
    selectedLines: string[];
    usedTools: string[];
    weakAreas: string[];
  };
  recentEvents: unknown[];
  recentChats: unknown[];
  quizAttempts: unknown[];
};

type QuizQuestion = {
  id: string | number;
  question: string;
  context?: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  weakArea?: string;
};

const DEFAULT_LESSONS: LessonSummary[] = [
  { lessonNo: 1, lessonTitle: "Going to a New School" },
  { lessonNo: 2, lessonTitle: "Congratulations! Well Done!" },
  { lessonNo: 3, lessonTitle: "At a Railway Station" },
  { lessonNo: 4, lessonTitle: "Where are You From?" },
  { lessonNo: 5, lessonTitle: "Thanks for Your Work" },
];

const CLASSES = [
  {
    id: 6,
    label: "Class 6",
    status: "Available",
    active: true,
    icon: School,
  },
  {
    id: 7,
    label: "Class 7",
    status: "Coming soon",
    active: false,
    icon: GraduationCap,
  },
  {
    id: 8,
    label: "Class 8",
    status: "Coming soon",
    active: false,
    icon: Layers3,
  },
];

const BOOKS = [
  {
    id: "english-today",
    title: "English For Today",
    subtitle: "OCR reader and AI support active",
    active: true,
    icon: BookOpen,
  },
  {
    id: "bangla",
    title: "Bangla",
    subtitle: "Coming soon",
    active: false,
    icon: BookMarked,
  },
  {
    id: "mathematics",
    title: "Mathematics",
    subtitle: "Coming soon",
    active: false,
    icon: ClipboardList,
  },
  {
    id: "science",
    title: "Science",
    subtitle: "Coming soon",
    active: false,
    icon: Brain,
  },
];

function normalizeLessons(data: unknown): LessonSummary[] {
  const value = data as {
    lessons?: unknown[];
    book?: { lessons?: unknown[] };
    ocrBook?: { lessons?: unknown[] };
  };

  const rawLessons =
    value.lessons ?? value.book?.lessons ?? value.ocrBook?.lessons ?? [];

  if (!Array.isArray(rawLessons) || rawLessons.length === 0) {
    return DEFAULT_LESSONS;
  }

  return rawLessons.map((item, index) => {
    const lesson = item as {
      lessonNo?: number;
      lesson?: number;
      id?: number;
      lessonTitle?: string;
      title?: string;
      name?: string;
    };

    return {
      lessonNo: lesson.lessonNo ?? lesson.lesson ?? lesson.id ?? index + 1,
      lessonTitle:
        lesson.lessonTitle ??
        lesson.title ??
        lesson.name ??
        `Lesson ${index + 1}`,
    };
  });
}

function normalizeLessonLines(data: unknown): {
  lessonTitle: string;
  lines: LessonLine[];
} {
  const value = data as {
    lesson?: {
      lessonTitle?: string;
      title?: string;
      lines?: unknown[];
      text?: string;
    };
    lessonTitle?: string;
    title?: string;
    lines?: unknown[];
    text?: string;
  };

  const lesson = value.lesson ?? value;

  const lessonTitle =
    lesson.lessonTitle ??
    lesson.title ??
    value.lessonTitle ??
    "Selected Lesson";

  const rawLines = lesson.lines ?? value.lines ?? [];

  if (Array.isArray(rawLines) && rawLines.length > 0) {
    const lines = rawLines
      .map((item, index) => {
        if (typeof item === "string") {
          return {
            id: `line-${index + 1}`,
            text: item,
          };
        }

        const line = item as {
          id?: string;
          lineId?: string;
          text?: string;
          lineText?: string;
          content?: string;
        };

        return {
          id: line.id ?? line.lineId ?? `line-${index + 1}`,
          text: line.text ?? line.lineText ?? line.content ?? "",
        };
      })
      .filter((line) => line.text.trim().length > 0);

    return {
      lessonTitle,
      lines,
    };
  }

  const text = lesson.text ?? value.text ?? "";

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `line-${index + 1}`,
      text: line,
    }));

  return {
    lessonTitle,
    lines,
  };
}

function normalizeQuizQuestions(data: unknown): QuizQuestion[] {
  const value = data as {
    questions?: unknown[];
    quiz?: unknown[];
  };

  const rawQuestions = value.questions ?? value.quiz ?? [];

  if (!Array.isArray(rawQuestions)) {
    return [];
  }

  return rawQuestions
    .map((item, index) => {
      const question = item as {
        id?: string | number;
        question?: string;
        context?: string;
        options?: string[];
        correctAnswer?: string;
        correctAns?: string;
        explanation?: string;
        weakArea?: string;
      };

      return {
        id: question.id ?? index + 1,
        question: question.question ?? "Choose the best answer.",
        context: question.context,
        options: Array.isArray(question.options) ? question.options : [],
        correctAnswer: question.correctAnswer ?? question.correctAns ?? "",
        explanation: question.explanation,
        weakArea: question.weakArea,
      };
    })
    .filter(
      (question) => question.options.length > 0 && question.correctAnswer,
    );
}

function getToolTitle(tool: AgentTool) {
  if (tool === "simple") return "Simple Explanation";
  if (tool === "bangla") return "Bangla Meaning";
  if (tool === "grammar") return "Grammar Help";
  return "AI Study Agent";
}

function getToolIcon(tool: AgentTool) {
  if (tool === "simple") return Sparkles;
  if (tool === "bangla") return Languages;
  if (tool === "grammar") return Brain;
  return Bot;
}

export default function StudyCompanion() {
  const [studentId, setStudentId] = useState("demo-student");
  const [selectedClass, setSelectedClass] = useState(6);
  const [selectedBook, setSelectedBook] = useState("english-today");

  const [lessons, setLessons] = useState<LessonSummary[]>(DEFAULT_LESSONS);
  const [selectedLessonNo, setSelectedLessonNo] = useState(1);
  const [selectedLessonTitle, setSelectedLessonTitle] = useState(
    DEFAULT_LESSONS[0].lessonTitle,
  );
  const [lessonLines, setLessonLines] = useState<LessonLine[]>([]);
  const [selectedLine, setSelectedLine] = useState("");

  const [activeTool, setActiveTool] = useState<AgentTool>("simple");
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);

  const [grammarQuestion, setGrammarQuestion] = useState("");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      text: "Hello. I am your AI Study Agent. Choose a class, book, and lesson. Then select one line and ask me for help.",
    },
  ]);

  const [researchSummary, setResearchSummary] =
    useState<ResearchSummary | null>(null);

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizGeneratedFor, setQuizGeneratedFor] = useState<number | null>(null);

  const [loadingBook, setLoadingBook] = useState(false);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [error, setError] = useState("");

  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.lessonNo === selectedLessonNo);
  }, [lessons, selectedLessonNo]);

  const selectedToolIcon = getToolIcon(activeTool);

  const quizScore = useMemo(() => {
    return quizQuestions.reduce((score, question) => {
      const selected = quizAnswers[String(question.id)];
      if (selected && selected === question.correctAnswer) {
        return score + 1;
      }
      return score;
    }, 0);
  }, [quizQuestions, quizAnswers]);

  async function loadBook() {
    setLoadingBook(true);

    try {
      const response = await fetch("/api/ocr-book");
      const data = await response.json();
      setLessons(normalizeLessons(data));
    } catch {
      setLessons(DEFAULT_LESSONS);
    } finally {
      setLoadingBook(false);
    }
  }

  async function refreshProgress() {
    try {
      const response = await fetch(
        `/api/research/summary?studentId=${encodeURIComponent(studentId)}`,
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setResearchSummary(data.summary);
    } catch {
      // Keep the student UI working even if the progress API fails.
    }
  }

  async function loadLesson(lessonNo: number) {
    setLoadingLesson(true);
    setError("");
    setSelectedLine("");
    setAgentResult(null);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizGeneratedFor(null);

    try {
      const response = await fetch(`/api/ocr-book/lessons/${lessonNo}`);

      if (!response.ok) {
        throw new Error("Lesson could not be loaded.");
      }

      const data = await response.json();
      const normalized = normalizeLessonLines(data);
      const currentLesson = lessons.find(
        (lesson) => lesson.lessonNo === lessonNo,
      );

      setSelectedLessonNo(lessonNo);
      setSelectedLessonTitle(
        currentLesson?.lessonTitle ?? normalized.lessonTitle,
      );
      setLessonLines(normalized.lines);

      setChatMessages([
        {
          role: "agent",
          text: `Lesson ${lessonNo} is ready: ${
            currentLesson?.lessonTitle ?? normalized.lessonTitle
          }. Select any line and I will help you understand it.`,
        },
      ]);

      await refreshProgress();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load this lesson.",
      );
    } finally {
      setLoadingLesson(false);
    }
  }

  async function callAgent(tool: AgentTool, studentQuestion?: string) {
    if (!selectedLine.trim()) {
      setError("Please select one textbook line first.");
      return;
    }

    setLoadingAgent(true);
    setError("");
    setActiveTool(tool);

    try {
      const response = await fetch("/api/agent/learning-loop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          lessonNo: selectedLessonNo,
          selectedLine,
          requestedTool: tool,
          studentQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "AI helper request failed.");
      }

      setAgentResult(data.result);
      await refreshProgress();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "AI helper request failed.",
      );
    } finally {
      setLoadingAgent(false);
    }
  }

  async function askGrammarTutor() {
    const question = grammarQuestion.trim();

    if (!question) {
      setError("Please write a grammar question first.");
      return;
    }

    await callAgent("chat", question);
  }

  async function askStudyAgent() {
    const question = chatQuestion.trim();

    if (!question) {
      setError("Please write a question first.");
      return;
    }

    if (!selectedLine.trim()) {
      setError(
        "Please select one textbook line before asking the AI Study Agent.",
      );
      return;
    }

    setLoadingChat(true);
    setError("");
    setChatQuestion("");
    setChatMessages((previous) => [
      ...previous,
      {
        role: "student",
        text: question,
      },
    ]);

    try {
      const response = await fetch("/api/agent/learning-loop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          lessonNo: selectedLessonNo,
          selectedLine,
          requestedTool: "chat",
          studentQuestion: question,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "AI Study Agent request failed.");
      }

      setChatMessages((previous) => [
        ...previous,
        {
          role: "agent",
          text: data.result.output,
        },
      ]);

      await refreshProgress();
    } catch (err) {
      setChatMessages((previous) => [
        ...previous,
        {
          role: "agent",
          text:
            err instanceof Error
              ? err.message
              : "Sorry, I could not answer right now.",
        },
      ]);
    } finally {
      setLoadingChat(false);
    }
  }

  async function generateQuiz() {
    setLoadingQuiz(true);
    setError("");
    setQuizQuestions([]);
    setQuizAnswers({});

    try {
      const response = await fetch("/api/ocr-book/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonNo: selectedLessonNo,
          studentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Quiz could not be generated.");
      }

      const normalized = normalizeQuizQuestions(data);

      if (normalized.length === 0) {
        throw new Error("No quiz questions were returned.");
      }

      setQuizQuestions(normalized);
      setQuizGeneratedFor(selectedLessonNo);
      await refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed.");
    } finally {
      setLoadingQuiz(false);
    }
  }

  function selectQuizAnswer(questionId: string | number, answer: string) {
    setQuizAnswers((previous) => ({
      ...previous,
      [String(questionId)]: answer,
    }));
  }

  useEffect(() => {
    loadBook();
    loadLesson(1);
    refreshProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLesson) {
      setSelectedLessonTitle(selectedLesson.lessonTitle);
    }
  }, [selectedLesson]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eaf4ff] px-3 py-5 text-slate-900 md:px-6">
      <div className="pointer-events-none fixed left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none fixed right-[-140px] top-24 h-96 w-96 rounded-full bg-blue-400/30 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-160px] left-1/3 h-96 w-96 rounded-full bg-violet-300/30 blur-3xl" />

      <section className="relative mx-auto max-w-7xl">
        <header className="rounded-[34px] border border-white/60 bg-white/45 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-2xl md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-2xl">
                <BookOpen size={32} strokeWidth={2.4} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                  Single Page Learning Space
                </p>
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                  NCTB AI Study Companion
                </h1>
                <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">
                  Choose class, book, lesson, and one line. Then learn with AI
                  explanation, Bangla meaning, grammar support, quiz, and a
                  smart study agent.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/60 p-4 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <UserRound size={18} className="text-slate-600" />
                <label className="text-xs font-black uppercase text-slate-500">
                  Student ID
                </label>
              </div>

              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/80 bg-white/75 px-4 py-2 text-sm font-bold outline-none transition focus:border-blue-500"
              />

              <button
                onClick={refreshProgress}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-lg transition hover:scale-[1.02]"
              >
                <RefreshCw size={16} />
                Refresh Progress
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-3xl border border-red-200 bg-red-50/90 p-4 text-sm font-bold text-red-700 shadow-md backdrop-blur-xl">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.35fr_0.95fr]">
          <aside className="space-y-6">
            <section className="rounded-[30px] border border-white/60 bg-white/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                  <School size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black">Choose Class</h2>
                  <p className="text-xs font-bold text-slate-500">Start here</p>
                </div>
              </div>

              <div className="grid gap-3">
                {CLASSES.map((classItem) => {
                  const Icon = classItem.icon;

                  return (
                    <button
                      key={classItem.id}
                      onClick={() =>
                        classItem.active && setSelectedClass(classItem.id)
                      }
                      disabled={!classItem.active}
                      className={`rounded-3xl border p-4 text-left shadow-md transition ${
                        selectedClass === classItem.id
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-white/80 bg-white/65 text-slate-600"
                      } ${
                        classItem.active
                          ? "hover:scale-[1.02]"
                          : "cursor-not-allowed opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={24} />
                        <div>
                          <p className="text-lg font-black">
                            {classItem.label}
                          </p>
                          <p className="text-xs font-bold">
                            {classItem.status}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/60 bg-white/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <LibraryBig size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black">Choose Book</h2>
                  <p className="text-xs font-bold text-slate-500">
                    Select subject
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {BOOKS.map((book) => {
                  const Icon = book.icon;

                  return (
                    <button
                      key={book.id}
                      onClick={() => book.active && setSelectedBook(book.id)}
                      disabled={!book.active}
                      className={`rounded-3xl border p-4 text-left shadow-md transition ${
                        selectedBook === book.id
                          ? "border-emerald-400 bg-emerald-50/90"
                          : "border-white/80 bg-white/65"
                      } ${
                        book.active
                          ? "hover:scale-[1.02]"
                          : "cursor-not-allowed opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={24} className="text-emerald-700" />
                        <div>
                          <p className="font-black">{book.title}</p>
                          <p className="text-xs font-bold text-slate-500">
                            {book.subtitle}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          <section className="rounded-[30px] border border-white/60 bg-white/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-700">
                  <BookMarked size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black">Choose Lesson</h2>
                  <p className="text-sm font-semibold text-slate-500">
                    Then tap one textbook line
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {lessons.map((lesson) => (
                  <button
                    key={lesson.lessonNo}
                    onClick={() => loadLesson(lesson.lessonNo)}
                    className={`rounded-2xl px-4 py-2 text-sm font-black shadow-md transition hover:scale-[1.04] ${
                      selectedLessonNo === lesson.lessonNo
                        ? "bg-orange-500 text-white"
                        : "bg-white/70 text-slate-700"
                    }`}
                  >
                    L{lesson.lessonNo}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-white/80 p-5 shadow-inner">
              <p className="text-xs font-black uppercase tracking-wide text-orange-600">
                Current Lesson
              </p>
              <h3 className="mt-1 text-xl font-black">
                Lesson {selectedLessonNo}: {selectedLessonTitle}
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {loadingLesson
                  ? "Loading lesson..."
                  : `${lessonLines.length} selectable lines loaded`}
              </p>
            </div>

            <div className="mt-5 max-h-[650px] space-y-3 overflow-y-auto rounded-3xl bg-slate-50/80 p-3">
              {loadingLesson && (
                <div className="flex items-center justify-center gap-2 rounded-3xl bg-white/75 p-8 text-sm font-bold text-slate-600">
                  <Loader2 size={18} className="animate-spin" />
                  Loading lesson lines...
                </div>
              )}

              {!loadingLesson &&
                lessonLines.map((line, index) => (
                  <button
                    key={`${line.id}-${index}`}
                    onClick={() => {
                      setSelectedLine(line.text);
                      setAgentResult(null);
                      setChatMessages((previous) => [
                        ...previous,
                        {
                          role: "agent",
                          text: `Line ${index + 1} selected. Now choose Simple, Bangla, Grammar, or ask me a question.`,
                        },
                      ]);
                    }}
                    className={`w-full rounded-3xl border p-4 text-left text-sm leading-6 shadow-sm transition hover:scale-[1.01] ${
                      selectedLine === line.text
                        ? "border-blue-500 bg-blue-600 text-white shadow-lg"
                        : "border-white/90 bg-white/80 hover:border-blue-300"
                    }`}
                  >
                    <span
                      className={`mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                        selectedLine === line.text
                          ? "bg-white text-blue-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {line.text}
                  </button>
                ))}

              {!loadingLesson && lessonLines.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/75 p-8 text-center text-sm font-bold text-slate-500">
                  No lesson lines found.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[30px] border border-white/60 bg-white/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black">AI Helper</h2>
                  <p className="text-xs font-bold text-slate-500">
                    Simple, Bangla, and Grammar
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-white/80 bg-white/65 p-4">
                <p className="text-xs font-black uppercase text-slate-500">
                  Selected Line
                </p>
                <p className="mt-2 text-sm font-semibold leading-6">
                  {selectedLine || "Tap one textbook line first."}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  onClick={() => callAgent("simple")}
                  disabled={loadingAgent}
                  className="rounded-2xl bg-blue-600 px-3 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.03] disabled:opacity-60"
                >
                  Simple
                </button>
                <button
                  onClick={() => callAgent("bangla")}
                  disabled={loadingAgent}
                  className="rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.03] disabled:opacity-60"
                >
                  Bangla
                </button>
                <button
                  onClick={() => callAgent("grammar")}
                  disabled={loadingAgent}
                  className="rounded-2xl bg-orange-500 px-3 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.03] disabled:opacity-60"
                >
                  Grammar
                </button>
              </div>

              <div className="mt-4 rounded-3xl border border-white/80 bg-white/75 p-4 shadow-inner">
                <div className="flex items-center gap-2">
                  {React.createElement(selectedToolIcon, {
                    size: 18,
                    className: "text-blue-700",
                  })}
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                    {loadingAgent
                      ? "Generating..."
                      : agentResult
                        ? getToolTitle(activeTool)
                        : "AI Output"}
                  </p>
                </div>

                <div className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-800">
                  {loadingAgent
                    ? "Please wait. The AI helper is preparing your answer."
                    : (agentResult?.output ??
                      "Select a line and press Simple, Bangla, or Grammar.")}
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-white/60 bg-white/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-100 text-purple-700">
                  <Brain size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black">Grammar Ask Box</h2>
                  <p className="text-xs font-bold text-slate-500">
                    Ask about the selected line
                  </p>
                </div>
              </div>

              <textarea
                value={grammarQuestion}
                onChange={(event) => setGrammarQuestion(event.target.value)}
                placeholder='Example: Why is "were sitting" used here?'
                className="mt-4 min-h-24 w-full rounded-3xl border border-white/80 bg-white/70 p-4 text-sm font-semibold outline-none transition focus:border-purple-500"
              />

              <button
                onClick={askGrammarTutor}
                disabled={loadingAgent}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
              >
                <Brain size={16} />
                Ask Grammar Tutor
              </button>
            </section>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[30px] border border-white/60 bg-white/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg">
                <Bot size={28} />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-purple-700">
                  Smart Study Agent
                </p>
                <h2 className="text-2xl font-black">Ask Anything</h2>
                <p className="text-sm font-semibold text-slate-500">
                  The agent answers using the selected line and lesson context.
                </p>
              </div>
            </div>

            <div className="mt-5 max-h-[400px] space-y-3 overflow-y-auto rounded-3xl bg-slate-50/80 p-4">
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${
                    message.role === "student" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[84%] rounded-3xl px-4 py-3 text-sm font-semibold leading-6 shadow-md ${
                      message.role === "student"
                        ? "bg-blue-600 text-white"
                        : "bg-white/85 text-slate-800"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase">
                      {message.role === "agent" ? (
                        <>
                          <Bot size={14} className="text-purple-600" />
                          <span className="text-purple-600">
                            AI Study Agent
                          </span>
                        </>
                      ) : (
                        <>
                          <UserRound size={14} />
                          <span>Student</span>
                        </>
                      )}
                    </div>
                    {message.text}
                  </div>
                </div>
              ))}

              {loadingChat && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-3xl bg-white/85 px-4 py-3 text-sm font-black text-purple-700 shadow-md">
                    <Loader2 size={16} className="animate-spin" />
                    AI Study Agent is thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                value={chatQuestion}
                onChange={(event) => setChatQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    askStudyAgent();
                  }
                }}
                placeholder="Ask your AI Study Agent..."
                className="flex-1 rounded-3xl border border-white/80 bg-white/75 px-5 py-4 text-sm font-semibold outline-none transition focus:border-purple-500"
              />
              <button
                onClick={askStudyAgent}
                disabled={loadingChat}
                className="flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-purple-700 to-blue-700 px-6 py-4 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
              >
                <Send size={16} />
                Send
              </button>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {[
                "Explain this line simply",
                "Teach the grammar",
                "Make one quiz question",
              ].map((sample) => (
                <button
                  key={sample}
                  onClick={() => setChatQuestion(sample)}
                  className="rounded-2xl bg-purple-50/90 px-3 py-2 text-xs font-black text-purple-700 transition hover:bg-purple-100"
                >
                  {sample}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/60 bg-white/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-indigo-700">
                    Practice
                  </p>
                  <h2 className="text-2xl font-black">Lesson Quiz</h2>
                  <p className="text-sm font-semibold text-slate-500">
                    Generate a quick quiz from the current lesson.
                  </p>
                </div>
              </div>

              <button
                onClick={generateQuiz}
                disabled={loadingQuiz}
                className="flex items-center gap-2 rounded-2xl bg-indigo-700 px-4 py-2 text-sm font-black text-white shadow-md transition hover:scale-[1.02] disabled:opacity-60"
              >
                {loadingQuiz ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Generate
              </button>
            </div>

            <div className="mt-5 rounded-3xl border border-white/80 bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black">
                  Score: {quizScore}/{quizQuestions.length}
                </p>
                <p className="text-xs font-bold text-slate-500">
                  {quizGeneratedFor
                    ? `Lesson ${quizGeneratedFor}`
                    : "No quiz generated yet"}
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1">
              {quizQuestions.map((question, index) => {
                const selected = quizAnswers[String(question.id)];
                const answered = Boolean(selected);

                return (
                  <div
                    key={String(question.id)}
                    className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-inner"
                  >
                    <p className="text-xs font-black uppercase text-slate-500">
                      Question {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-black leading-6">
                      {question.question}
                    </p>

                    {question.context && (
                      <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">
                        {question.context}
                      </p>
                    )}

                    <div className="mt-3 space-y-2">
                      {question.options.map((option) => {
                        const isSelected = selected === option;
                        const isCorrect = option === question.correctAnswer;

                        let optionClass =
                          "border-white/80 bg-white/80 text-slate-700";

                        if (answered && isCorrect) {
                          optionClass =
                            "border-emerald-300 bg-emerald-50 text-emerald-800";
                        }

                        if (answered && isSelected && !isCorrect) {
                          optionClass = "border-red-300 bg-red-50 text-red-700";
                        }

                        return (
                          <button
                            key={option}
                            onClick={() =>
                              selectQuizAnswer(question.id, option)
                            }
                            className={`flex w-full items-start gap-2 rounded-2xl border p-3 text-left text-xs font-bold leading-5 transition ${optionClass}`}
                          >
                            {answered && isCorrect ? (
                              <CheckCircle2
                                size={16}
                                className="mt-0.5 shrink-0"
                              />
                            ) : answered && isSelected && !isCorrect ? (
                              <XCircle size={16} className="mt-0.5 shrink-0" />
                            ) : (
                              <Circle size={16} className="mt-0.5 shrink-0" />
                            )}
                            <span>{option}</span>
                          </button>
                        );
                      })}
                    </div>

                    {answered && (
                      <div className="mt-3 rounded-2xl bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">
                        <p className="font-black">Explanation</p>
                        <p>
                          {question.explanation ?? "Explanation unavailable."}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {quizQuestions.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
                  <ClipboardList size={32} className="mx-auto text-slate-400" />
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    Click Generate to create a lesson quiz.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[30px] border border-white/60 bg-white/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                <BarChart3 size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-blue-700">
                  Student Progress
                </p>
                <h2 className="text-2xl font-black">Progress Snapshot</h2>
                <p className="text-sm font-semibold text-slate-500">
                  This section shows simple activity information for the current
                  student.
                </p>
              </div>
            </div>

            <button
              onClick={refreshProgress}
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-md transition hover:scale-[1.02]"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-3xl bg-blue-50/90 p-5 shadow-inner">
              <p className="text-xs font-black text-blue-700">Opened Lessons</p>
              <p className="mt-1 text-3xl font-black">
                {researchSummary?.memory.openedLessons.length ?? 0}
              </p>
            </div>

            <div className="rounded-3xl bg-emerald-50/90 p-5 shadow-inner">
              <p className="text-xs font-black text-emerald-700">
                Selected Lines
              </p>
              <p className="mt-1 text-3xl font-black">
                {researchSummary?.memory.selectedLines.length ?? 0}
              </p>
            </div>

            <div className="rounded-3xl bg-orange-50/90 p-5 shadow-inner">
              <p className="text-xs font-black text-orange-700">Tools Used</p>
              <p className="mt-1 text-3xl font-black">
                {researchSummary?.memory.usedTools.length ?? 0}
              </p>
            </div>

            <div className="rounded-3xl bg-purple-50/90 p-5 shadow-inner">
              <p className="text-xs font-black text-purple-700">AI Chats</p>
              <p className="mt-1 text-3xl font-black">
                {researchSummary?.recentChats.length ?? 0}
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
