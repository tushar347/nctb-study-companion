"use client";

import React, { useEffect, useState } from "react";

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

const DEFAULT_LESSONS: LessonSummary[] = [
  { lessonNo: 1, lessonTitle: "Going to a New School" },
  { lessonNo: 2, lessonTitle: "Congratulations! Well Done!" },
  { lessonNo: 3, lessonTitle: "At a Railway Station" },
  { lessonNo: 4, lessonTitle: "Where are You From?" },
  { lessonNo: 5, lessonTitle: "Thanks for Your Work" },
];

const CLASSES = [
  { id: 6, label: "Class 6", emoji: "🎒", active: true },
  { id: 7, label: "Class 7", emoji: "📚", active: false },
  { id: 8, label: "Class 8", emoji: "🧠", active: false },
];

const BOOKS = [
  {
    id: "english-today",
    title: "English For Today",
    emoji: "📘",
    subtitle: "Available now",
    active: true,
  },
  {
    id: "bangla",
    title: "Bangla",
    emoji: "📗",
    subtitle: "Coming soon",
    active: false,
  },
  {
    id: "math",
    title: "Mathematics",
    emoji: "📐",
    subtitle: "Coming soon",
    active: false,
  },
  {
    id: "science",
    title: "Science",
    emoji: "🔬",
    subtitle: "Coming soon",
    active: false,
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

function getToolTitle(tool: AgentTool) {
  if (tool === "simple") return "Simple Explanation";
  if (tool === "bangla") return "Bangla Meaning";
  if (tool === "grammar") return "Grammar Tutor";
  return "AI Study Agent";
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
      text: "Hello 👋 I am your AI Study Agent. Choose class, book, lesson, then select one line. I will help you understand it.",
    },
  ]);

  const [researchSummary, setResearchSummary] =
    useState<ResearchSummary | null>(null);

  const [loadingLesson, setLoadingLesson] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState("");

  async function loadBook() {
    try {
      const response = await fetch("/api/ocr-book");
      const data = await response.json();
      setLessons(normalizeLessons(data));
    } catch {
      setLessons(DEFAULT_LESSONS);
    }
  }

  async function refreshResearchSummary() {
    try {
      const response = await fetch(
        `/api/research/summary?studentId=${encodeURIComponent(studentId)}`,
      );

      if (!response.ok) return;

      const data = await response.json();
      setResearchSummary(data.summary);
    } catch {
      // Keep UI running even if research API fails.
    }
  }

  async function loadLesson(lessonNo: number) {
    setLoadingLesson(true);
    setError("");
    setSelectedLine("");
    setAgentResult(null);

    try {
      const response = await fetch(`/api/ocr-book/lessons/${lessonNo}`);

      if (!response.ok) {
        throw new Error("Lesson API failed.");
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
          text: `Welcome back 👋 I opened Lesson ${lessonNo}: ${
            currentLesson?.lessonTitle ?? normalized.lessonTitle
          }. Select any line and I will help you.`,
        },
      ]);

      await refreshResearchSummary();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load the lesson.",
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
        throw new Error(data.error ?? "Agent API failed.");
      }

      setAgentResult(data.result);
      await refreshResearchSummary();
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
        throw new Error(data.error ?? "Chatbot request failed.");
      }

      setChatMessages((previous) => [
        ...previous,
        {
          role: "agent",
          text: data.result.output,
        },
      ]);

      await refreshResearchSummary();
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

  useEffect(() => {
    loadBook();
    loadLesson(1);
    refreshResearchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[#eef6ff] px-3 py-5 text-slate-900 md:px-6">
      <section className="mx-auto max-w-7xl">
        <header className="rounded-[32px] border border-white bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)] md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 text-3xl shadow-xl">
                📚
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                  Week 4 Research Build
                </p>
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                  NCTB AI Study Companion
                </h1>
                <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">
                  A child-friendly textbook reader with AI explanation, Bangla
                  meaning, grammar help, RAG chatbot, and research progress
                  data.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-white/90 p-4 shadow-lg">
              <label className="text-xs font-black uppercase text-slate-500">
                Student ID
              </label>
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold outline-none focus:border-blue-500"
              />
              <button
                onClick={refreshResearchSummary}
                className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-md transition hover:scale-[1.02]"
              >
                Refresh Progress
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-md">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.7fr_1.35fr_0.95fr]">
          <aside className="space-y-6">
            <section className="rounded-[30px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-xl">
                  1️⃣
                </div>
                <div>
                  <h2 className="text-xl font-black">Choose Class</h2>
                  <p className="text-xs font-bold text-slate-500">Start here</p>
                </div>
              </div>

              <div className="grid gap-3">
                {CLASSES.map((classItem) => (
                  <button
                    key={classItem.id}
                    onClick={() =>
                      classItem.active && setSelectedClass(classItem.id)
                    }
                    disabled={!classItem.active}
                    className={`rounded-3xl border p-4 text-left shadow-md transition ${
                      selectedClass === classItem.id
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    } ${
                      classItem.active
                        ? "hover:scale-[1.02]"
                        : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{classItem.emoji}</span>
                      <div>
                        <p className="text-lg font-black">{classItem.label}</p>
                        <p className="text-xs font-bold">
                          {classItem.active ? "Available now" : "Coming soon"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-xl">
                  2️⃣
                </div>
                <div>
                  <h2 className="text-xl font-black">Choose Book</h2>
                  <p className="text-xs font-bold text-slate-500">
                    Select subject
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {BOOKS.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => book.active && setSelectedBook(book.id)}
                    disabled={!book.active}
                    className={`rounded-3xl border p-4 text-left shadow-md transition ${
                      selectedBook === book.id
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    } ${
                      book.active
                        ? "hover:scale-[1.02]"
                        : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{book.emoji}</span>
                      <div>
                        <p className="font-black">{book.title}</p>
                        <p className="text-xs font-bold text-slate-500">
                          {book.subtitle}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className="rounded-[30px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-xl">
                  3️⃣
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
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    L{lesson.lessonNo}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 shadow-inner">
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

            <div className="mt-5 max-h-[650px] space-y-3 overflow-y-auto rounded-3xl bg-slate-50 p-3">
              {lessonLines.map((line, index) => (
                <button
                  key={`${line.id}-${index}`}
                  onClick={() => {
                    setSelectedLine(line.text);
                    setAgentResult(null);
                    setChatMessages((previous) => [
                      ...previous,
                      {
                        role: "agent",
                        text: `Good choice ✅ I selected line ${index + 1}. Now press Simple, Bangla, Grammar, or ask me a question.`,
                      },
                    ]);
                  }}
                  className={`w-full rounded-3xl border p-4 text-left text-sm leading-6 shadow-sm transition hover:scale-[1.01] ${
                    selectedLine === line.text
                      ? "border-blue-500 bg-blue-600 text-white shadow-lg"
                      : "border-slate-200 bg-white hover:border-blue-300"
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
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                  No OCR lesson lines found. Check lesson API.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[30px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-xl">
                  🤖
                </div>
                <div>
                  <h2 className="text-xl font-black">AI Helper</h2>
                  <p className="text-xs font-bold text-slate-500">
                    Simple • Bangla • Grammar
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-500">
                  Selected Line
                </p>
                <p className="mt-2 text-sm font-semibold leading-6">
                  {selectedLine || "Tap a textbook line first."}
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

              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-inner">
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                  {loadingAgent
                    ? "Generating..."
                    : agentResult
                      ? getToolTitle(activeTool)
                      : "AI Output"}
                </p>
                <div className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-800">
                  {agentResult?.output ??
                    "Select a line and press Simple, Bangla, or Grammar."}
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-100 text-xl">
                  🧑‍🏫
                </div>
                <div>
                  <h2 className="text-xl font-black">Grammar Ask Box</h2>
                  <p className="text-xs font-bold text-slate-500">
                    Ask line-based grammar
                  </p>
                </div>
              </div>

              <textarea
                value={grammarQuestion}
                onChange={(event) => setGrammarQuestion(event.target.value)}
                placeholder='Example: Why is "were sitting" used here?'
                className="mt-4 min-h-24 w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-purple-500"
              />

              <button
                onClick={askGrammarTutor}
                disabled={loadingAgent}
                className="mt-3 w-full rounded-2xl bg-purple-700 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
              >
                Ask Grammar Tutor
              </button>
            </section>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[30px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 text-2xl text-white shadow-lg">
                🧠
              </div>
              <div>
                <p className="text-xs font-black uppercase text-purple-700">
                  RAG Chatbot Foundation
                </p>
                <h2 className="text-2xl font-black">AI Study Agent</h2>
                <p className="text-sm font-semibold text-slate-500">
                  It works like a smart study employee for the student.
                </p>
              </div>
            </div>

            <div className="mt-5 max-h-[400px] space-y-3 overflow-y-auto rounded-3xl bg-slate-50 p-4">
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
                        : "bg-white text-slate-800"
                    }`}
                  >
                    {message.role === "agent" && (
                      <p className="mb-1 text-xs font-black uppercase text-purple-600">
                        AI Study Agent
                      </p>
                    )}
                    {message.text}
                  </div>
                </div>
              ))}

              {loadingChat && (
                <div className="flex justify-start">
                  <div className="rounded-3xl bg-white px-4 py-3 text-sm font-black text-purple-700 shadow-md">
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
                className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold outline-none focus:border-purple-500"
              />
              <button
                onClick={askStudyAgent}
                disabled={loadingChat}
                className="rounded-3xl bg-gradient-to-r from-purple-700 to-blue-700 px-6 py-4 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
              >
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
                  className="rounded-2xl bg-purple-50 px-3 py-2 text-xs font-black text-purple-700 transition hover:bg-purple-100"
                >
                  {sample}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-blue-700">
                  Research Data
                </p>
                <h2 className="text-2xl font-black">Progress Dashboard</h2>
                <p className="text-sm font-semibold text-slate-500">
                  Live from SQLite + Prisma database.
                </p>
              </div>

              <button
                onClick={refreshResearchSummary}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-md transition hover:scale-[1.02]"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-blue-50 p-5 shadow-inner">
                <p className="text-xs font-black text-blue-700">
                  Opened Lessons
                </p>
                <p className="mt-1 text-3xl font-black">
                  {researchSummary?.memory.openedLessons.length ?? 0}
                </p>
              </div>

              <div className="rounded-3xl bg-emerald-50 p-5 shadow-inner">
                <p className="text-xs font-black text-emerald-700">
                  Selected Lines
                </p>
                <p className="mt-1 text-3xl font-black">
                  {researchSummary?.memory.selectedLines.length ?? 0}
                </p>
              </div>

              <div className="rounded-3xl bg-orange-50 p-5 shadow-inner">
                <p className="text-xs font-black text-orange-700">Tools Used</p>
                <p className="mt-1 text-3xl font-black">
                  {researchSummary?.memory.usedTools.length ?? 0}
                </p>
              </div>

              <div className="rounded-3xl bg-purple-50 p-5 shadow-inner">
                <p className="text-xs font-black text-purple-700">AI Chats</p>
                <p className="mt-1 text-3xl font-black">
                  {researchSummary?.recentChats.length ?? 0}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black">Recently Selected Lines</p>
              <div className="mt-3 space-y-2">
                {(researchSummary?.memory.selectedLines ?? [])
                  .slice(-4)
                  .reverse()
                  .map((line, index) => (
                    <p
                      key={`${line}-${index}`}
                      className="rounded-2xl bg-white p-3 text-xs font-semibold leading-5 shadow-sm"
                    >
                      {line}
                    </p>
                  ))}

                {(researchSummary?.memory.selectedLines.length ?? 0) === 0 && (
                  <p className="text-sm font-semibold text-slate-500">
                    No saved interaction yet.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black">Recent Tools Used</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {(researchSummary?.memory.usedTools ?? [])
                  .slice(-10)
                  .join(", ") || "No tools used yet."}
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
