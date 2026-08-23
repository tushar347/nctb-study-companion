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
  Loader2,
  MessageCircle,
  Volume2,
} from "lucide-react";

import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";
import ScoringInfoCard from "@/components/scoring/ScoringInfoCard";

import VoiceCapturePanel, {
  type VoiceCaptureValue,
} from "@/components/practice/VoiceCapturePanel";

import {
  type SpeakingEvaluation,
} from "@/lib/practice/voiceEvaluation";

import {
  readLegacyQuizLaunchContext,
  readQuizLaunchContext,
  type QuizLaunchContextV1,
} from "@/lib/quiz/quizLaunchContext";

import {
  getStoredStudentKey,
} from "@/lib/studentSession";

type Session = {
  sourceText: string;
  promptText: string;
};

type HistoryItem = {
  id: string;
  overallScore: number;
  relevanceScore: number | null;
  attemptNumber: number;
};

type ApiResponse<T> = {
  success?: boolean;
  error?: string;
} & T;

/*
 * Context saved by Reader when the user clicks
 * "Voice Practice from Selected Line".
 */
type VoicePracticeContext = {
  book: {
    id: string;
    classLevel?: number;
  };

  page: {
    number: number;
  };

  lesson: {
    number: number;
    title?: string;
  };

  selectedLine: {
    id: string;
    text?: string;
    cleanText?: string;
  };
};

type SpeakingContext =
  | QuizLaunchContextV1
  | VoicePracticeContext;

export default function SpeakingPracticePage() {
  const [
    context,
    setContext,
  ] = useState<SpeakingContext | null>(
    null,
  );

  const [
    session,
    setSession,
  ] = useState<Session | null>(
    null,
  );

  const [
    capture,
    setCapture,
  ] = useState<VoiceCaptureValue>({
    transcript: "",
    durationMs: 0,
    hasRecording: false,
  });

  const [
    evaluation,
    setEvaluation,
  ] = useState<SpeakingEvaluation | null>(
    null,
  );

  const [
    history,
    setHistory,
  ] = useState<HistoryItem[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /*
   * Update voice capture state.
   */
  const handleCapture =
    useCallback(
      (value: VoiceCaptureValue) => {
        setCapture(value);
      },
      [],
    );

  /*
   * Reader URL.
   */
  const readerHref = useMemo(
    () =>
      `/reader?book=${encodeURIComponent(
        context?.book.id ??
          "class6-english",
      )}`,
    [context],
  );

  /*
   * Read the context saved by Reader.
   *
   * Priority:
   * 1. voicePracticeContext
   * 2. contextId quiz context
   * 3. legacy quiz context
   */
  useEffect(() => {
    const saved =
      localStorage.getItem(
        "voicePracticeContext",
      );

    if (saved) {
      try {
        const parsed =
          JSON.parse(
            saved,
          ) as VoicePracticeContext;

        if (
          parsed?.book?.id &&
          parsed?.page?.number &&
          parsed?.selectedLine?.id
        ) {
          setContext(parsed);
          return;
        }
      } catch {
        localStorage.removeItem(
          "voicePracticeContext",
        );
      }
    }

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
      activeContext?.selectedLine
    ) {
      setContext(activeContext);
      return;
    }

    setError(
      "Select an OCR-highlighted textbook line in the Reader first.",
    );

    setLoading(false);
  }, []);

  /*
   * Load recent speaking attempts.
   */
  async function loadHistory() {
    const response =
      await fetch(
        `/api/practice/speaking/evaluate?studentKey=${encodeURIComponent(
          getStoredStudentKey(),
        )}`,
        {
          cache: "no-store",
        },
      );

    const data =
      (await response.json()) as ApiResponse<{
        attempts?: HistoryItem[];
      }>;

    if (
      response.ok &&
      data.attempts
    ) {
      setHistory(data.attempts);
    }
  }

  /*
   * Load speaking practice session
   * after context becomes available.
   */
  useEffect(() => {
    if (!context) {
      return;
    }

    void (async () => {
      try {
        setLoading(true);
        setError("");

        /*
         * Safely get the selected line.
         */
        const selectedLine =
          context.selectedLine;

        if (!selectedLine?.id) {
          throw new Error(
            "The selected textbook line is missing.",
          );
        }

        /*
         * Get the actual selected text.
         *
         * cleanText is preferred when available.
         * text is used as fallback.
         */
        const selectedText =
          selectedLine.text ??
          "";

        /*
         * Create/load the speaking session.
         */
        const response =
          await fetch(
            "/api/practice/speaking/session",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  bookId:
                    context.book.id,

                  pageNumber:
                    context.page.number,

                  sourceLineId:
                    selectedLine.id,

                  /*
                   * Send the actual OCR-selected
                   * textbook text to the API.
                   */
                  selectedText,
                }),
            },
          );

        const data =
          (await response.json()) as ApiResponse<{
            session?: Session;
          }>;

        if (
          !response.ok ||
          !data.session
        ) {
          throw new Error(
            data.error ??
              "Speaking session could not be loaded.",
          );
        }

        setSession(data.session);

        await loadHistory();
      } catch (
        requestError
      ) {
        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Speaking session could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [context]);

  /*
   * Text-to-speech for the question.
   */
  function hearQuestion() {
    if (
      !session ||
      !(
        "speechSynthesis" in
        window
      )
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        session.promptText,
      );

    utterance.lang = "en-US";
    utterance.rate = 0.85;

    window.speechSynthesis.speak(
      utterance,
    );
  }

  /*
   * Submit spoken answer.
   */
  async function submit() {
    if (
      !context?.selectedLine ||
      !session ||
      !capture.transcript.trim()
    ) {
      setError(
        "Record or enter your spoken answer first.",
      );

      return;
    }

    /*
     * Safe local reference.
     */
    const selectedLine =
      context.selectedLine;

    if (!selectedLine?.id) {
      setError(
        "The selected textbook line is missing.",
      );

      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/practice/speaking/evaluate",
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
                  context.page.number,

                lessonNo:
                  context.lesson
                    .number,

                sourceLineId:
                  selectedLine.id,

                /*
                 * Also send the selected text
                 * to the evaluation API.
                 */
                selectedText:
                  selectedLine.text ??
                  "",

                promptText:
                  session.promptText,

                transcript:
                  capture.transcript,

                durationMs:
                  capture.durationMs,
              }),
          },
        );

      const data =
        (await response.json()) as ApiResponse<{
          evaluation?: SpeakingEvaluation;
        }>;

      if (
        !response.ok ||
        !data.evaluation
      ) {
        throw new Error(
          data.error ??
            "Speaking evaluation failed.",
        );
      }

      setEvaluation(
        data.evaluation,
      );

      await loadHistory();
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Speaking evaluation failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">

        {/* Header */}
        <LiquidCard className="overflow-hidden p-0">
          <div className="bg-gradient-to-r from-orange-700 via-rose-700 to-violet-700 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-100">
                  Voice Practice
                </p>

                <h1 className="mt-1 text-4xl font-black">
                  Speaking Practice
                </h1>

                <p className="mt-2 text-sm font-semibold text-orange-50">
                  Answer a lesson-based question in your own words.
                </p>
              </div>

              <Link
                href={readerHref}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-orange-800"
              >
                <ArrowLeft size={18} />
                Reader
              </Link>

            </div>
          </div>
        </LiquidCard>

        {/* Scoring information */}
        <ScoringInfoCard
          activity="SPEAKING"
        />

        {/* Error */}
        {error ? (
          <LiquidCard className="border border-red-200 bg-red-50 p-5 font-black text-red-800">
            {error}
          </LiquidCard>
        ) : null}

        {/* Loading */}
        {loading ? (
          <LiquidCard className="grid min-h-72 place-items-center">
            <Loader2
              className="animate-spin text-orange-700"
              size={34}
            />
          </LiquidCard>
        ) : session ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

            {/* Main practice card */}
            <LiquidCard className="p-6">

              {/* Source line */}
              <p className="text-xs font-black uppercase text-orange-700">
                Source line
              </p>

              <p className="mt-3 rounded-3xl bg-orange-50 p-5 font-semibold leading-8">
                {session.sourceText}
              </p>

              {/* Question */}
              <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">

                <p className="text-xs font-black uppercase text-orange-300">
                  Your question
                </p>

                <p className="mt-2 text-xl font-black leading-8">
                  {session.promptText}
                </p>

                <button
                  type="button"
                  onClick={
                    hearQuestion
                  }
                  className="mt-4 flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 font-black"
                >
                  <Volume2 size={18} />
                  Hear Question
                </button>

              </div>

              {/* Voice recorder */}
              <div className="mt-6">
                <VoiceCapturePanel
                  onChange={
                    handleCapture
                  }
                />
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={() =>
                  void submit()
                }
                disabled={
                  submitting ||
                  !capture.transcript.trim()
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-700 px-5 py-4 text-lg font-black text-white disabled:opacity-40"
              >
                {submitting ? (
                  <Loader2
                    className="animate-spin"
                    size={20}
                  />
                ) : (
                  <MessageCircle
                    size={20}
                  />
                )}

                Check My Answer
              </button>

              {/* Evaluation */}
              {evaluation ? (
                <div className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-6">

                  <p className="text-2xl font-black">
                    Practice result:{" "}
                    {evaluation.overallScore}{" "}
                    / 100
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">

                    <div className="rounded-2xl bg-white p-4">
                      Topic coverage
                      <br />

                      <strong>
                        {evaluation.relevanceScore}
                        %
                      </strong>
                    </div>

                    <div className="rounded-2xl bg-white p-4">
                      Response length
                      <br />

                      <strong>
                        {evaluation.responseLengthScore}
                        %
                      </strong>
                    </div>

                    <div className="rounded-2xl bg-white p-4">
                      Pace
                      <br />

                      <strong>
                        {evaluation.wordsPerMinute
                          ? `${evaluation.wordsPerMinute} WPM`
                          : "--"}
                      </strong>
                    </div>

                  </div>

                  <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold">
                    Covered ideas:{" "}
                    {evaluation.matchedKeywords.join(
                      ", ",
                    ) ||
                      "None yet"}
                  </p>

                  <p className="mt-3 rounded-2xl bg-white p-4 text-sm font-semibold">
                    Ideas to include next time:{" "}
                    {evaluation.missedKeywords.join(
                      ", ",
                    ) ||
                      "You covered all key words."}
                  </p>

                </div>
              ) : null}

            </LiquidCard>

            {/* History */}
            <LiquidCard className="p-5">

              <h2 className="text-xl font-black">
                Recent Answers
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
                            Attempt{" "}
                            {item.attemptNumber}
                          </p>

                          <span className="font-black text-orange-700">
                            {item.overallScore}%
                          </span>

                        </div>

                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Topic coverage:{" "}
                          {item.relevanceScore ?? 0}
                          %
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
        ) : null}

      </div>
    </AppShell>
  );
}
