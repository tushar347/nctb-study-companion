"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, Loader2, Send } from "lucide-react";
import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

type LessonSummary = {
  lessonNo: number;
  lessonTitle: string;
};

type LessonLine = {
  id: string;
  text: string;
};

const defaultLessons: LessonSummary[] = [
  { lessonNo: 1, lessonTitle: "Going to a New School" },
  { lessonNo: 2, lessonTitle: "Congratulations! Well Done!" },
  { lessonNo: 3, lessonTitle: "At a Railway Station" },
  { lessonNo: 4, lessonTitle: "Where are You From?" },
  { lessonNo: 5, lessonTitle: "Thanks for Your Work" },
];

function normalizeLines(data: any) {
  const lesson = data.lesson ?? data;
  const lessonTitle = lesson.lessonTitle ?? lesson.title ?? "Selected Lesson";
  const rawLines = lesson.lines ?? data.lines ?? [];

  if (Array.isArray(rawLines) && rawLines.length > 0) {
    return {
      lessonTitle,
      lines: rawLines.map((line: any, index: number) => ({
        id: line.id ?? `line-${index + 1}`,
        text:
          typeof line === "string" ? line : (line.text ?? line.lineText ?? ""),
      })),
    };
  }

  const text = lesson.text ?? data.text ?? "";

  return {
    lessonTitle,
    lines: text
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map((line: string, index: number) => ({
        id: `line-${index + 1}`,
        text: line,
      })),
  };
}

export default function ReaderPage() {
  const [lessons] = useState(defaultLessons);
  const [lessonNo, setLessonNo] = useState(1);
  const [lessonTitle, setLessonTitle] = useState(defaultLessons[0].lessonTitle);
  const [lines, setLines] = useState<LessonLine[]>([]);
  const [selectedLine, setSelectedLine] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadLesson(nextLessonNo: number) {
    setLoading(true);
    setSelectedLine("");

    try {
      const response = await fetch(`/api/ocr-book/lessons/${nextLessonNo}`);
      const data = await response.json();
      const normalized = normalizeLines(data);
      const lesson = lessons.find((item) => item.lessonNo === nextLessonNo);

      setLessonNo(nextLessonNo);
      setLessonTitle(lesson?.lessonTitle ?? normalized.lessonTitle);
      setLines(normalized.lines);
    } finally {
      setLoading(false);
    }
  }

  function selectLine(line: string) {
    setSelectedLine(line);
    localStorage.setItem("selectedLine", line);
    localStorage.setItem("selectedLessonNo", String(lessonNo));
    localStorage.setItem("selectedLessonTitle", lessonTitle);
  }

  useEffect(() => {
    loadLesson(1);
  }, []);

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <LiquidCard className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-700">
              <BookMarked size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Select Lesson</h2>
              <p className="text-sm font-semibold text-slate-500">
                Choose a lesson and tap one line.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {lessons.map((lesson) => (
              <button
                key={lesson.lessonNo}
                onClick={() => loadLesson(lesson.lessonNo)}
                className={`rounded-2xl px-4 py-2 text-sm font-black shadow-md transition hover:scale-[1.04] ${
                  lessonNo === lesson.lessonNo
                    ? "bg-orange-500 text-white"
                    : "bg-white/70 text-slate-700"
                }`}
              >
                Lesson {lesson.lessonNo}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-3xl bg-white/65 p-5 shadow-inner">
            <p className="text-xs font-black uppercase text-orange-600">
              Current Lesson
            </p>
            <h3 className="mt-1 text-xl font-black">
              Lesson {lessonNo}: {lessonTitle}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {loading ? "Loading..." : `${lines.length} lines loaded`}
            </p>
          </div>

          {selectedLine && (
            <Link
              href="/teacher"
              className="mt-5 flex items-center justify-center gap-2 rounded-3xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-xl transition hover:scale-[1.02]"
            >
              Open in AI Teacher
              <Send size={16} />
            </Link>
          )}
        </LiquidCard>

        <LiquidCard className="p-5">
          <h2 className="text-2xl font-black">Textbook Lines</h2>
          <p className="text-sm font-semibold text-slate-500">
            Select one line for explanation or grammar help.
          </p>

          <div className="mt-5 max-h-[680px] space-y-3 overflow-y-auto rounded-3xl bg-slate-50/80 p-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 rounded-3xl bg-white/75 p-8 text-sm font-bold text-slate-600">
                <Loader2 size={18} className="animate-spin" />
                Loading lesson...
              </div>
            )}

            {!loading &&
              lines.map((line, index) => (
                <button
                  key={`${line.id}-${index}`}
                  onClick={() => selectLine(line.text)}
                  className={`w-full rounded-3xl border p-4 text-left text-sm leading-6 shadow-sm transition hover:scale-[1.01] ${
                    selectedLine === line.text
                      ? "border-blue-500 bg-blue-600 text-white"
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
          </div>
        </LiquidCard>
      </div>
    </AppShell>
  );
}
