"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  BookOpen,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Gamepad2,
  Languages,
  Loader2,
  Minus,
  Plus,
  ScanText,
  Sparkles,
  UserRound,
} from "lucide-react";

import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

import {
  getStoredStudentKey,
  getStoredStudentName,
} from "@/lib/studentSession";

import {
  class6Lessons,
  getLessonForPage,
} from "@/lib/book/class6Lessons";


type OCRLine = {
  id: string;
  lineNumber: number;
  text: string;
  cleanText?: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  source: string;
  aiReady: boolean;
};


type PageData = {
  success: boolean;
  bookId: string;
  pageNumber: number;
  image: string;
  width: number;
  height: number;
  source: string;
  lines: OCRLine[];
  aiReadyLines: OCRLine[];
  error?: string;
};


type IndexData = {
  success: boolean;
  title: string;
  totalPdfPages: number;
  pages: Array<{
    pageNumber: number;
    lineCount?: number;
    aiReadyLineCount?: number;
    source?: string;
    error?: string;
  }>;
  error?: string;
};


type TeacherTool =
  | "simple"
  | "bangla"
  | "grammar";


function formatAIOutput(
  value: unknown,
) {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


export default function ReaderPage() {
  const [studentName, setStudentName] =
    useState("Student");

  const [studentKey, setStudentKey] =
    useState("");

  const [indexData, setIndexData] =
    useState<IndexData | null>(null);

  const [pageNumber, setPageNumber] =
    useState(6);

  const [jumpPage, setJumpPage] =
    useState("6");

  const [pageData, setPageData] =
    useState<PageData | null>(null);

  const [selectedLine, setSelectedLine] =
    useState<OCRLine | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showOverlay, setShowOverlay] =
    useState(true);

  const [zoom, setZoom] =
    useState(1);

  const [
    teacherLoading,
    setTeacherLoading,
  ] = useState(false);

  const [
    teacherResponse,
    setTeacherResponse,
  ] = useState("");

  const [
    teacherError,
    setTeacherError,
  ] = useState("");


  const totalPages =
    indexData?.totalPdfPages ?? 115;


  const activeLesson = useMemo(
    () => getLessonForPage(pageNumber),
    [pageNumber],
  );


  async function loadIndex() {
    const response = await fetch(
      "/api/books/class6/index",
      {
        cache: "no-store",
      },
    );

    const data =
      (await response.json()) as IndexData;

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ??
          "Book index could not be loaded.",
      );
    }

    setIndexData(data);
  }


  async function loadPage(
    nextPage: number,
  ) {
    const safePage = Math.min(
      totalPages,
      Math.max(1, nextPage),
    );

    setLoading(true);
    setError("");
    setSelectedLine(null);
    setTeacherResponse("");
    setTeacherError("");

    try {
      const response = await fetch(
        `/api/books/class6/pages/${safePage}`,
        {
          cache: "no-store",
        },
      );

      const data =
        (await response.json()) as PageData;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ??
            `OCR page ${safePage} is unavailable.`,
        );
      }

      setPageNumber(safePage);
      setJumpPage(String(safePage));
      setPageData(data);
    } catch (requestError) {
      setPageData(null);

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Book page could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }


  function selectBookLine(
    line: OCRLine,
  ) {
    setSelectedLine(line);
    setTeacherResponse("");
    setTeacherError("");

    const lesson =
      getLessonForPage(pageNumber);

    localStorage.setItem(
      "selectedLine",
      line.cleanText ?? line.text,
    );

    localStorage.setItem(
      "selectedBookPdfPage",
      String(pageNumber),
    );

    localStorage.setItem(
      "selectedLessonNo",
      String(lesson?.lessonNo ?? 0),
    );

    localStorage.setItem(
      "selectedLessonTitle",
      lesson?.title ?? "Book Page",
    );
  }


  async function askTeacher(
    tool: TeacherTool,
  ) {
    if (!selectedLine) {
      setTeacherError(
        "Select a highlighted book line first.",
      );

      return;
    }

    setTeacherLoading(true);
    setTeacherResponse("");
    setTeacherError("");

    try {
      const lesson =
        getLessonForPage(pageNumber);

      const response = await fetch(
        "/api/agent/learning-loop",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            studentId: studentKey,
            studentKey,
            lessonNo:
              lesson?.lessonNo ?? 0,
            selectedLine:
              selectedLine.cleanText ??
              selectedLine.text,
            requestedTool: tool,
          }),
        },
      );

      const rawResponse = await response.text();

      let data: any;

      try {
        data = JSON.parse(rawResponse);
      } catch {
        const readableError = rawResponse
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 250);

        throw new Error(
          `AI API returned ${response.status} ${response.statusText}. ${
            readableError ||
            "The server returned HTML instead of JSON."
          }`,
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message ??
            data.error ??
            "AI Teacher failed.",
        );
      }

      setTeacherResponse(
        formatAIOutput(
          data.result?.output ??
            data.output ??
            data.answer,
        ),
      );
    } catch (requestError) {
      setTeacherError(
        requestError instanceof Error
          ? requestError.message
          : "AI Teacher failed.",
      );
    } finally {
      setTeacherLoading(false);
    }
  }


  function submitJumpPage() {
    const requestedPage =
      Number(jumpPage);

    if (
      Number.isInteger(requestedPage) &&
      requestedPage >= 1 &&
      requestedPage <= totalPages
    ) {
      loadPage(requestedPage);
    }
  }


  useEffect(() => {
    const name =
      getStoredStudentName();

    const key =
      getStoredStudentKey();

    setStudentName(name);
    setStudentKey(key);

    async function startReader() {
      try {
        await loadIndex();
        await loadPage(6);
      } catch (startError) {
        setError(
          startError instanceof Error
            ? startError.message
            : "Reader could not start.",
        );

        setLoading(false);
      }
    }

    startReader();
  }, []);


  return (
    <AppShell>
      <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)_370px]">
        <LiquidCard className="p-5">
          <div className="flex items-center gap-3 rounded-3xl bg-white/75 p-4 shadow-inner">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-blue-700">
              <UserRound size={21} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-slate-500">
                Student
              </p>

              <p className="truncate font-black">
                {studentName}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <ScanText
              className="text-orange-600"
              size={24}
            />

            <div>
              <h2 className="text-xl font-black">
                Book OCR
              </h2>

              <p className="text-sm font-semibold text-slate-500">
                Local automatic extraction
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-orange-50 p-4">
            <p className="text-xs font-black uppercase text-orange-700">
              Current lesson
            </p>

            <p className="mt-1 font-black">
              {activeLesson
                ? `Lesson ${activeLesson.lessonNo}`
                : "Book Section"}
            </p>

            <p className="mt-1 text-sm font-bold text-slate-600">
              {activeLesson?.title ??
                "Front matter or sample section"}
            </p>

            <p className="mt-3 text-sm font-black text-orange-700">
              PDF Page {pageNumber} / {totalPages}
            </p>

            <p className="mt-1 text-sm font-bold text-slate-600">
              {pageData?.lines.length ?? 0} detected lines
            </p>

            <p className="mt-1 text-xs font-bold text-slate-500">
              Source: {pageData?.source ?? "--"}
            </p>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-black uppercase text-slate-500">
              Jump to lesson
            </p>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {class6Lessons.map(
                (lesson) => (
                  <button
                    key={lesson.lessonNo}
                    onClick={() =>
                      loadPage(
                        lesson.pdfStart,
                      )
                    }
                    className={`w-full rounded-2xl px-3 py-2 text-left text-xs font-black transition ${
                      activeLesson?.lessonNo ===
                      lesson.lessonNo
                        ? "bg-orange-500 text-white"
                        : "bg-white/75 text-slate-700 hover:bg-orange-50"
                    }`}
                  >
                    {lesson.lessonNo}.{" "}
                    {lesson.title}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <Link
              href="/teacher"
              className="rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white"
            >
              AI Teacher
            </Link>

            <Link
              href="/quiz"
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white"
            >
              Quiz
            </Link>

            <Link
              href="/games"
              className="rounded-2xl bg-purple-700 px-4 py-3 text-center text-sm font-black text-white"
            >
              Games
            </Link>

            <Link
              href="/progress"
              className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white"
            >
              Progress
            </Link>
          </div>
        </LiquidCard>

        <LiquidCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                <BookOpen size={24} />
              </div>

              <div>
                <p className="text-xs font-black uppercase text-blue-700">
                  Interactive textbook
                </p>

                <h1 className="text-2xl font-black">
                  English For Today
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={pageNumber <= 1}
                onClick={() =>
                  loadPage(pageNumber - 1)
                }
                className="rounded-2xl bg-white p-3 shadow-md disabled:opacity-40"
              >
                <ChevronLeft size={18} />
              </button>

              <input
                value={jumpPage}
                onChange={(event) =>
                  setJumpPage(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    submitJumpPage();
                  }
                }}
                className="w-20 rounded-2xl bg-white px-3 py-3 text-center text-sm font-black outline-none shadow-md"
              />

              <button
                onClick={submitJumpPage}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white"
              >
                Go
              </button>

              <button
                disabled={
                  pageNumber >= totalPages
                }
                onClick={() =>
                  loadPage(pageNumber + 1)
                }
                className="rounded-2xl bg-white p-3 shadow-md disabled:opacity-40"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white/70 p-3 shadow-inner">
            <button
              onClick={() =>
                setShowOverlay(
                  (current) => !current,
                )
              }
              className="flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-xs font-black text-blue-700"
            >
              {showOverlay ? (
                <EyeOff size={17} />
              ) : (
                <Eye size={17} />
              )}

              {showOverlay
                ? "Hide OCR boxes"
                : "Show OCR boxes"}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setZoom((current) =>
                    Math.max(
                      0.7,
                      current - 0.1,
                    ),
                  )
                }
                className="rounded-2xl bg-white p-3 shadow-md"
              >
                <Minus size={17} />
              </button>

              <p className="min-w-20 text-center text-sm font-black">
                {Math.round(zoom * 100)}%
              </p>

              <button
                onClick={() =>
                  setZoom((current) =>
                    Math.min(
                      2,
                      current + 0.1,
                    ),
                  )
                }
                className="rounded-2xl bg-white p-3 shadow-md"
              >
                <Plus size={17} />
              </button>
            </div>
          </div>

          {loading && (
            <div className="mt-5 flex min-h-[650px] items-center justify-center rounded-[32px] bg-slate-100">
              <Loader2
                className="animate-spin text-blue-600"
                size={38}
              />
            </div>
          )}

          {!loading && error && (
            <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-[32px] bg-red-50 p-8 text-center">
              <div>
                <AlertCircle
                  className="mx-auto text-red-600"
                  size={38}
                />

                <p className="mt-4 font-black text-red-700">
                  {error}
                </p>
              </div>
            </div>
          )}

          {!loading && pageData && (
            <div className="mt-5 max-h-[900px] overflow-auto rounded-[32px] bg-slate-200 p-4">
              <div
                className="mx-auto"
                style={{
                  width: `${zoom * 100}%`,
                  minWidth: "600px",
                  maxWidth: `${900 * zoom}px`,
                }}
              >
                <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <img
                    src={pageData.image}
                    alt={`Book page ${pageNumber}`}
                    className="block h-auto w-full select-none"
                    draggable={false}
                  />

                  {showOverlay &&
                    pageData.lines.map(
                      (line) => {
                        const selected =
                          selectedLine?.id ===
                          line.id;

                        return (
                          <button
                            key={line.id}
                            title={line.cleanText ?? line.text}
                            onClick={() =>
                              selectBookLine(
                                line,
                              )
                            }
                            className={`absolute rounded-sm border transition ${
                              selected
                                ? "border-orange-600 bg-orange-300/45"
                                : "border-blue-500/30 bg-blue-300/10 hover:border-blue-600 hover:bg-blue-300/30"
                            }`}
                            style={{
                              left: `${
                                (line.bbox.x /
                                  pageData.width) *
                                100
                              }%`,
                              top: `${
                                (line.bbox.y /
                                  pageData.height) *
                                100
                              }%`,
                              width: `${
                                (line.bbox.width /
                                  pageData.width) *
                                100
                              }%`,
                              height: `${
                                (line.bbox.height /
                                  pageData.height) *
                                100
                              }%`,
                            }}
                          />
                        );
                      },
                    )}
                </div>
              </div>
            </div>
          )}
        </LiquidCard>

        <LiquidCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-100 text-purple-700">
              <Bot size={24} />
            </div>

            <div>
              <p className="text-xs font-black uppercase text-purple-700">
                Selected book line
              </p>

              <h2 className="text-xl font-black">
                AI Study Tools
              </h2>
            </div>
          </div>

          <div className="mt-5 min-h-32 rounded-3xl bg-white/80 p-5 text-sm font-bold leading-7 shadow-inner">
            {selectedLine?.cleanText ??
              selectedLine?.text ??
              "Click a highlighted text line on the book page."}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              disabled={
                !selectedLine ||
                teacherLoading
              }
              onClick={() =>
                askTeacher("simple")
              }
              className="rounded-2xl bg-blue-600 px-2 py-4 text-xs font-black text-white disabled:opacity-40"
            >
              <Sparkles
                className="mx-auto mb-1"
                size={17}
              />
              Explain
            </button>

            <button
              disabled={
                !selectedLine ||
                teacherLoading
              }
              onClick={() =>
                askTeacher("bangla")
              }
              className="rounded-2xl bg-emerald-600 px-2 py-4 text-xs font-black text-white disabled:opacity-40"
            >
              <Languages
                className="mx-auto mb-1"
                size={17}
              />
              Bangla
            </button>

            <button
              disabled={
                !selectedLine ||
                teacherLoading
              }
              onClick={() =>
                askTeacher("grammar")
              }
              className="rounded-2xl bg-purple-700 px-2 py-4 text-xs font-black text-white disabled:opacity-40"
            >
              <Brain
                className="mx-auto mb-1"
                size={17}
              />
              Grammar
            </button>
          </div>

          {teacherError && (
            <div className="mt-4 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-700">
              {teacherError}
            </div>
          )}

          <div className="mt-5 min-h-48 whitespace-pre-wrap rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-7 shadow-inner">
            {teacherLoading ? (
              <div className="flex items-center gap-2">
                <Loader2
                  className="animate-spin"
                  size={18}
                />

                AI Teacher is working...
              </div>
            ) : (
              teacherResponse ||
              "The formatted AI answer will appear here."
            )}
          </div>

          <div className="mt-5 grid gap-3">
            <Link
              href="/quiz"
              onClick={() => {
                if (selectedLine) {
                  localStorage.setItem(
                    "selectedLine",
                    selectedLine.cleanText ??
                      selectedLine.text,
                  );
                }
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
            >
              <Brain size={17} />
              Quiz from Selected Line
            </Link>

            <Link
              href="/games"
              onClick={() => {
                if (selectedLine) {
                  localStorage.setItem(
                    "selectedLine",
                    selectedLine.cleanText ??
                      selectedLine.text,
                  );
                }
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-purple-700 px-4 py-3 text-sm font-black text-white"
            >
              <Gamepad2 size={17} />
              Game from Selected Line
            </Link>
          </div>
        </LiquidCard>
      </div>
    </AppShell>
  );
}
