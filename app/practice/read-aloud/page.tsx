"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  Loader2,
  Volume2,
  XCircle,
} from "lucide-react";

import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";
import VoiceCapturePanel, {
  type VoiceCaptureValue,
} from "@/components/practice/VoiceCapturePanel";

import {
  type ReadAloudEvaluation,
} from "@/lib/practice/voiceEvaluation";

import {
  readLegacyQuizLaunchContext,
  readQuizLaunchContext,
  type QuizLaunchContextV1,
} from "@/lib/quiz/quizLaunchContext";

import {
  getStoredStudentKey,
} from "@/lib/studentSession";

type HistoryItem = {
  id: string;
  overallScore: number;
  wordsPerMinute:
    | number
    | null;
  attemptNumber: number;
};

type ApiResponse<T> = {
  success?: boolean;
  error?: string;
} & T;

export default function ReadAloudPage() {
  const [
    context,
    setContext,
  ] =
    useState<QuizLaunchContextV1 | null>(
      null,
    );

  const [
    capture,
    setCapture,
  ] =
    useState<VoiceCaptureValue>({
      transcript: "",
      durationMs: 0,
      hasRecording: false,
    });

  const [
    evaluation,
    setEvaluation,
  ] =
    useState<ReadAloudEvaluation | null>(
      null,
    );

  const [
    history,
    setHistory,
  ] = useState<HistoryItem[]>([]);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const handleCapture =
    useCallback(
      (
        value:
          VoiceCaptureValue,
      ) => {
        setCapture(value);
      },
      [],
    );

  const readerHref = useMemo(
    () =>
      `/reader?book=${encodeURIComponent(
        context?.book.id ??
          "class6-english",
      )}`,
    [context],
  );

  async function loadHistory() {
    const response =
      await fetch(
        `/api/practice/read-aloud/evaluate?studentKey=${encodeURIComponent(
          getStoredStudentKey(),
        )}`,
        {
          cache:
            "no-store",
        },
      );

    const data =
      (await response.json()) as ApiResponse<{
        attempts?:
          HistoryItem[];
      }>;

    if (
      response.ok &&
      data.attempts
    ) {
      setHistory(
        data.attempts,
      );
    }
  }

  useEffect(() => {
    const parameters =
      new URLSearchParams(
        window.location.search,
      );

    const activeContext =
      readQuizLaunchContext(
        parameters.get(
          "contextId",
        ),
      ) ??
      readLegacyQuizLaunchContext();

    if (
      !activeContext
        ?.selectedLine
    ) {
      setError(
        "Select an OCR-highlighted textbook line in the Reader first.",
      );
      return;
    }

    setContext(
      activeContext,
    );

    void loadHistory();
  }, []);

  function hearReference() {
    const text =
      context?.selectedLine
        ?.text;

    if (
      !text ||
      !(
        "speechSynthesis" in
        window
      )
    ) {
      setError(
        "Reference playback is unavailable.",
      );
      return;
    }

    window
      .speechSynthesis
      .cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        text,
      );

    utterance.lang =
      "en-US";

    utterance.rate =
      0.82;

    window
      .speechSynthesis
      .speak(
        utterance,
      );
  }

  async function submit() {
    if (
      !context
        ?.selectedLine ||
      !capture.transcript
        .trim()
    ) {
      setError(
        "Record the line or enter the recognized transcript first.",
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/practice/read-aloud/evaluate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                studentKey:
                  getStoredStudentKey(),
                bookId:
                  context.book.id,
                classLevel:
                  context.book
                    .classLevel,
                pageNumber:
                  context.page
                    .number,
                lessonNo:
                  context.lesson
                    .number,
                sourceLineId:
                  context
                    .selectedLine
                    .id,
                transcript:
                  capture
                    .transcript,
                durationMs:
                  capture
                    .durationMs,
              }),
          },
        );

      const data =
        (await response.json()) as ApiResponse<{
          evaluation?:
            ReadAloudEvaluation;
        }>;

      if (
        !response.ok ||
        !data.evaluation
      ) {
        throw new Error(
          data.error ??
            "Read Aloud evaluation failed.",
        );
      }

      setEvaluation(
        data.evaluation,
      );

      await loadHistory();
    } catch (requestError) {
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Read Aloud evaluation failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <LiquidCard className="overflow-hidden p-0">
          <div className="bg-gradient-to-r from-violet-800 via-blue-700 to-cyan-700 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-100">
                  Voice Practice
                </p>

                <h1 className="mt-1 text-4xl font-black">
                  Read Aloud
                </h1>

                <p className="mt-2 text-sm font-semibold text-blue-50">
                  Read the selected textbook line and compare the recognized words.
                </p>
              </div>

              <Link
                href={readerHref}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-violet-800"
              >
                <ArrowLeft size={18} />
                Reader
              </Link>
            </div>
          </div>
        </LiquidCard>

        {error ? (
          <LiquidCard className="border border-red-200 bg-red-50 p-5 font-black text-red-800">
            {error}
          </LiquidCard>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <LiquidCard className="p-6">
            <p className="text-xs font-black uppercase text-violet-700">
              Textbook line
            </p>

            <p className="mt-3 rounded-3xl bg-violet-50 p-5 text-lg font-black leading-8">
              {context?.selectedLine
                ?.text ??
                "No line selected."}
            </p>

            <button
              type="button"
              onClick={
                hearReference
              }
              className="mt-4 flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-black text-white"
            >
              <Volume2 size={19} />
              Hear Reference
            </button>

            <div className="mt-6">
              <VoiceCapturePanel
                onChange={
                  handleCapture
                }
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void submit()
              }
              disabled={
                submitting ||
                !capture
                  .transcript
                  .trim()
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-4 text-lg font-black text-white disabled:opacity-40"
            >
              {submitting ? (
                <Loader2
                  className="animate-spin"
                  size={20}
                />
              ) : (
                <AudioLines
                  size={20}
                />
              )}
              Check Reading
            </button>

            {evaluation ? (
              <div
                className={`mt-6 rounded-3xl border p-6 ${
                  evaluation
                    .overallScore >=
                  70
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-orange-200 bg-orange-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {evaluation
                    .overallScore >=
                  70 ? (
                    <CheckCircle2
                      className="text-emerald-700"
                      size={30}
                    />
                  ) : (
                    <XCircle
                      className="text-orange-700"
                      size={30}
                    />
                  )}

                  <p className="text-2xl font-black">
                    {evaluation.overallScore} / 100
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4">
                    Accuracy<br />
                    <strong>
                      {evaluation.accuracyScore}%
                    </strong>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    Completeness<br />
                    <strong>
                      {evaluation.completenessScore}%
                    </strong>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    Pace<br />
                    <strong>
                      {evaluation.wordsPerMinute
                        ? `${evaluation.wordsPerMinute} WPM`
                        : "--"}
                    </strong>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm font-semibold sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-3">
                    Missing:{" "}
                    {evaluation.missingWords.join(
                      ", ",
                    ) ||
                      "None"}
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    Extra:{" "}
                    {evaluation.extraWords.join(
                      ", ",
                    ) ||
                      "None"}
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    Replaced:{" "}
                    {evaluation.replacements
                      .map(
                        (item) =>
                          `${item.received}→${item.expected}`,
                      )
                      .join(
                        ", ",
                      ) ||
                      "None"}
                  </div>
                </div>
              </div>
            ) : null}
          </LiquidCard>

          <LiquidCard className="p-5">
            <h2 className="text-xl font-black">
              Recent Readings
            </h2>

            <div className="mt-4 space-y-3">
              {history.length ? (
                history.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-white p-4"
                    >
                      <div className="flex justify-between gap-3">
                        <p className="font-black">
                          Attempt {item.attemptNumber}
                        </p>

                        <span className="font-black text-violet-700">
                          {item.overallScore}%
                        </span>
                      </div>

                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.wordsPerMinute
                          ? `${item.wordsPerMinute} WPM`
                          : "Pace unavailable"}
                      </p>
                    </div>
                  ),
                )
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  No attempts yet.
                </p>
              )}
            </div>
          </LiquidCard>
        </div>
      </div>
    </AppShell>
  );
}
