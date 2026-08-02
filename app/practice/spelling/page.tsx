"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Ear,
  Keyboard,
  Loader2,
  Mic,
  RefreshCw,
  SpellCheck2,
  Volume2,
  XCircle,
} from "lucide-react";

import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";
import ScoringInfoCard from "@/components/scoring/ScoringInfoCard";

import {
  readLegacyQuizLaunchContext,
  readQuizLaunchContext,
  type QuizLaunchContextV1,
} from "@/lib/quiz/quizLaunchContext";

import {
  normalizeSpokenSpelling,
  type SpellingEvaluation,
  type SpellingInputMode,
} from "@/lib/practice/spelling";

import {
  getStoredStudentKey,
} from "@/lib/studentSession";

type SpeechResultEvent = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
};

type SpeechErrorEvent = {
  error?: string;
  message?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult:
    | ((event: SpeechResultEvent) => void)
    | null;
  onerror:
    | ((event: SpeechErrorEvent) => void)
    | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor =
  new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?:
      BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?:
      BrowserSpeechRecognitionConstructor;
  }
}

type SpellingSession = {
  bookId: string;
  pageNumber: number;
  pageSource: string | null;
  sourceLineId: string | null;
  sourceLineText: string | null;
  targetWord: string;
  maskedWord: string;
  wordLength: number;
  candidateCount: number;
};

type AttemptHistoryItem = {
  id: string;
  targetWord: string;
  normalizedAnswer: string;
  inputMode: string;
  isCorrect: boolean;
  accuracy: number;
  attemptNumber: number;
  createdAt: string;
};

type ApiResponse<T> = {
  success?: boolean;
  error?: string;
} & T;

export default function SpellingPracticePage() {
  const [context, setContext] =
    useState<QuizLaunchContextV1 | null>(
      null,
    );

  const [session, setSession] =
    useState<SpellingSession | null>(
      null,
    );

  const [answer, setAnswer] =
    useState("");

  const [inputMode, setInputMode] =
    useState<SpellingInputMode>(
      "typed",
    );

  const [
    voiceTranscript,
    setVoiceTranscript,
  ] = useState("");

  const [evaluation, setEvaluation] =
    useState<SpellingEvaluation | null>(
      null,
    );

  const [history, setHistory] =
    useState<AttemptHistoryItem[]>([]);

  const [
    loadingSession,
    setLoadingSession,
  ] = useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [listening, setListening] =
    useState(false);

  const [error, setError] =
    useState("");

  const [voiceError, setVoiceError] =
    useState("");

  const [usedWords, setUsedWords] =
    useState<string[]>([]);

  const startedAtRef =
    useRef(Date.now());

  const recognitionRef =
    useRef<BrowserSpeechRecognition | null>(
      null,
    );

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(
      window.SpeechRecognition ||
        window.webkitSpeechRecognition,
    );

  const readerHref = useMemo(
    () =>
      `/reader?book=${encodeURIComponent(
        context?.book.id ??
          "class6-english",
      )}`,
    [context],
  );

  async function loadHistory(
    activeContext:
      QuizLaunchContextV1,
  ) {
    const parameters =
      new URLSearchParams({
        studentKey:
          getStoredStudentKey(),
        bookId:
          activeContext.book.id,
        pageNumber: String(
          activeContext.page.number,
        ),
      });

    const response = await fetch(
      `/api/practice/spelling/attempt?${parameters.toString()}`,
      {
        cache: "no-store",
      },
    );

    const data =
      (await response.json()) as ApiResponse<{
        attempts?: AttemptHistoryItem[];
      }>;

    if (
      response.ok &&
      data.success &&
      data.attempts
    ) {
      setHistory(data.attempts);
    }
  }

  async function loadWord(
    activeContext:
      QuizLaunchContextV1,
    excludedWords = usedWords,
  ) {
    setLoadingSession(true);
    setError("");
    setEvaluation(null);
    setAnswer("");
    setVoiceTranscript("");
    setVoiceError("");

    try {
      const response = await fetch(
        "/api/practice/spelling/session",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            bookId:
              activeContext.book.id,
            pageNumber:
              activeContext.page.number,
            sourceLineId:
              activeContext.selectedLine
                ?.id ?? null,
            excludeWords:
              excludedWords,
          }),
        },
      );

      const data =
        (await response.json()) as ApiResponse<{
          session?: SpellingSession;
        }>;

      if (
        !response.ok ||
        !data.success ||
        !data.session
      ) {
        throw new Error(
          data.error ??
            "A spelling word could not be loaded.",
        );
      }

      setSession(data.session);
      startedAtRef.current =
        Date.now();
    } catch (requestError) {
      setSession(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "A spelling word could not be loaded.",
      );
    } finally {
      setLoadingSession(false);
    }
  }

  useEffect(() => {
    const parameters =
      new URLSearchParams(
        window.location.search,
      );

    const expectedContextId =
      parameters.get("contextId");

    const activeContext =
      readQuizLaunchContext(
        expectedContextId,
      ) ??
      readLegacyQuizLaunchContext();

    if (!activeContext) {
      setError(
        "No Reader context was found. Return to the Reader and select a textbook line.",
      );
      setLoadingSession(false);
      return;
    }

    setContext(activeContext);
    void loadWord(
      activeContext,
      [],
    );
    void loadHistory(
      activeContext,
    );

    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function speakWord() {
    if (
      !session ||
      !("speechSynthesis" in window)
    ) {
      setVoiceError(
        "Speech playback is not available in this browser.",
      );
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        session.targetWord,
      );

    utterance.lang = "en-US";
    utterance.rate = 0.82;
    utterance.pitch = 1;

    window.speechSynthesis.speak(
      utterance,
    );
  }

  function startVoiceSpelling() {
    setVoiceError("");

    const Recognition =
      window.SpeechRecognition ??
      window.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceError(
        "Voice recognition is unavailable in this browser. Typed spelling remains available.",
      );
      return;
    }

    recognitionRef.current?.stop();

    const recognition =
      new Recognition();

    recognition.lang = "en-US";
    recognition.interimResults =
      false;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (
      event,
    ) => {
      const transcript =
        event.results[0]?.[0]
          ?.transcript ?? "";

      const normalized =
        normalizeSpokenSpelling(
          transcript,
        );

      setVoiceTranscript(transcript);
      setAnswer(normalized);
      setInputMode("voice");
    };

    recognition.onerror = (
      event,
    ) => {
      setVoiceError(
        event.message ||
          event.error ||
          "Voice recognition failed.",
      );
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current =
      recognition;

    try {
      setListening(true);
      recognition.start();
    } catch (recognitionError) {
      setListening(false);
      setVoiceError(
        recognitionError instanceof Error
          ? recognitionError.message
          : "Voice recognition could not start.",
      );
    }
  }

  async function submitAttempt() {
    if (
      !context ||
      !session ||
      !answer.trim()
    ) {
      setError(
        "Enter or speak your spelling first.",
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        "/api/practice/spelling/attempt",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            studentKey:
              getStoredStudentKey(),
            bookId:
              context.book.id,
            classLevel:
              context.book.classLevel,
            pageNumber:
              context.page.number,
            lessonNo:
              context.lesson.number,
            sourceLineId:
              session.sourceLineId,
            targetWord:
              session.targetWord,
            submittedAnswer:
              answer,
            inputMode,
            responseTimeMs:
              Date.now() -
              startedAtRef.current,
          }),
        },
      );

      const data =
        (await response.json()) as ApiResponse<{
          evaluation?:
            SpellingEvaluation;
        }>;

      if (
        !response.ok ||
        !data.success ||
        !data.evaluation
      ) {
        throw new Error(
          data.error ??
            "The spelling attempt could not be saved.",
        );
      }

      setEvaluation(
        data.evaluation,
      );

      setUsedWords(
        (previous) =>
          Array.from(
            new Set([
              ...previous,
              session.targetWord,
            ]),
          ),
      );

      await loadHistory(context);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The spelling attempt could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function nextWord() {
    if (!context) return;

    const nextExcluded = session
      ? Array.from(
          new Set([
            ...usedWords,
            session.targetWord,
          ]),
        )
      : usedWords;

    setUsedWords(nextExcluded);

    await loadWord(
      context,
      nextExcluded,
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <LiquidCard className="overflow-hidden p-0">
          <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-cyan-600 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-white/15 shadow-lg">
                  <SpellCheck2
                    size={29}
                  />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">
                    NCTB Voice Learning
                  </p>

                  <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                    Voice Spelling Practice
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-blue-50">
                    Listen to a word from the selected textbook page, then spell it by typing or speaking the letters.
                  </p>
                </div>
              </div>

              <Link
                href={readerHref}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-blue-800 shadow-lg"
              >
                <ArrowLeft size={17} />
                Back to Reader
              </Link>
            </div>
          </div>
        </LiquidCard>

        <ScoringInfoCard activity="SPELLING" />

        {context ? (
          <LiquidCard className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <BookOpen
                className="text-blue-700"
                size={22}
              />

              <div>
                <p className="font-black text-slate-950">
                  {context.book.title}
                </p>

                <p className="text-sm font-semibold text-slate-500">
                  Class {context.book.classLevel} · OCR page {context.page.number}
                  {context.lesson.number
                    ? ` · Lesson ${context.lesson.number}`
                    : ""}
                </p>
              </div>
            </div>

            {context.selectedLine ? (
              <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                {context.selectedLine.text}
              </p>
            ) : null}
          </LiquidCard>
        ) : null}

        {error ? (
          <LiquidCard className="border border-red-200 bg-red-50 p-5">
            <p className="font-black text-red-800">
              {error}
            </p>
          </LiquidCard>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <LiquidCard className="p-6 sm:p-8">
            {loadingSession ? (
              <div className="grid min-h-96 place-items-center">
                <div className="text-center">
                  <Loader2
                    className="mx-auto animate-spin text-blue-700"
                    size={34}
                  />

                  <p className="mt-4 font-black text-slate-700">
                    Selecting a textbook word...
                  </p>
                </div>
              </div>
            ) : session ? (
              <>
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    Listen carefully
                  </p>

                  <div className="mt-5 rounded-3xl bg-slate-950 p-7 text-white">
                    <p className="text-sm font-bold text-slate-300">
                      {session.wordLength} letters
                    </p>

                    <p className="mt-4 text-3xl font-black tracking-[0.25em] sm:text-4xl">
                      {session.maskedWord}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={speakWord}
                    className="mt-5 inline-flex items-center justify-center gap-3 rounded-2xl bg-orange-500 px-6 py-4 font-black text-white shadow-lg transition hover:bg-orange-600"
                  >
                    <Volume2 size={21} />
                    Hear the Word
                  </button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("typed");
                      setVoiceError("");
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      inputMode === "typed"
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <Keyboard
                      className="text-blue-700"
                      size={22}
                    />
                    <p className="mt-2 font-black">
                      Type the spelling
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={
                      startVoiceSpelling
                    }
                    disabled={listening}
                    className={`rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
                      inputMode === "voice"
                        ? "border-purple-600 bg-purple-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    {listening ? (
                      <Loader2
                        className="animate-spin text-purple-700"
                        size={22}
                      />
                    ) : (
                      <Mic
                        className="text-purple-700"
                        size={22}
                      />
                    )}

                    <p className="mt-2 font-black">
                      {listening
                        ? "Listening..."
                        : "Speak the letters"}
                    </p>
                  </button>
                </div>

                <label className="mt-6 block">
                  <span className="text-sm font-black text-slate-700">
                    Your spelling
                  </span>

                  <input
                    value={answer}
                    onChange={(event) => {
                      setAnswer(
                        event.target.value,
                      );
                      setInputMode("typed");
                    }}
                    disabled={Boolean(
                      evaluation,
                    )}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Type the letters here"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-4 text-xl font-black tracking-[0.12em] outline-none transition focus:border-blue-600 disabled:bg-slate-100"
                  />
                </label>

                {voiceTranscript ? (
                  <p className="mt-3 rounded-2xl bg-purple-50 p-3 text-sm font-semibold text-purple-900">
                    Heard: “{voiceTranscript}”
                  </p>
                ) : null}

                {voiceError ? (
                  <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    {voiceError}
                  </p>
                ) : null}

                {!speechSupported ? (
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Voice recognition is unavailable in this browser; typed spelling and word playback still work.
                  </p>
                ) : null}

                {!evaluation ? (
                  <button
                    type="button"
                    onClick={submitAttempt}
                    disabled={
                      submitting ||
                      !answer.trim()
                    }
                    className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-700 px-6 py-4 text-lg font-black text-white shadow-lg transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? (
                      <Loader2
                        className="animate-spin"
                        size={21}
                      />
                    ) : (
                      <SpellCheck2
                        size={21}
                      />
                    )}

                    Check Spelling
                  </button>
                ) : (
                  <div
                    className={`mt-6 rounded-3xl border p-6 ${
                      evaluation.isCorrect
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {evaluation.isCorrect ? (
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

                      <div>
                        <p className="text-xl font-black">
                          {evaluation.isCorrect
                            ? "Correct spelling"
                            : `${evaluation.accuracy}% accurate`}
                        </p>

                        <p className="text-sm font-semibold text-slate-600">
                          Correct word:{" "}
                          <span className="font-black">
                            {evaluation.targetWord}
                          </span>
                        </p>
                      </div>
                    </div>

                    {!evaluation.isCorrect ? (
                      <div className="mt-4 grid gap-3 text-sm font-semibold sm:grid-cols-3">
                        <div className="rounded-2xl bg-white p-3">
                          Missing:{" "}
                          {evaluation.missingLetters.join(
                            ", ",
                          ) || "None"}
                        </div>

                        <div className="rounded-2xl bg-white p-3">
                          Extra:{" "}
                          {evaluation.extraLetters.join(
                            ", ",
                          ) || "None"}
                        </div>

                        <div className="rounded-2xl bg-white p-3">
                          Replaced:{" "}
                          {evaluation.substitutions
                            .map(
                              (item) =>
                                `${item.received}→${item.expected}`,
                            )
                            .join(", ") ||
                            "None"}
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        void nextWord()
                      }
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white"
                    >
                      <RefreshCw size={18} />
                      Next Textbook Word
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <Ear
                    className="mx-auto text-slate-400"
                    size={40}
                  />

                  <p className="mt-4 font-black text-slate-700">
                    No spelling session is available.
                  </p>
                </div>
              </div>
            )}
          </LiquidCard>

          <LiquidCard className="p-5">
            <h2 className="text-xl font-black text-slate-950">
              Recent Attempts
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-500">
              Your latest spelling results for this textbook page.
            </p>

            <div className="mt-5 space-y-3">
              {history.length > 0 ? (
                history.map(
                  (attempt) => (
                    <div
                      key={attempt.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">
                            {attempt.targetWord}
                          </p>

                          <p className="text-xs font-semibold text-slate-500">
                            Attempt {attempt.attemptNumber} · {attempt.inputMode}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            attempt.isCorrect
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {attempt.accuracy}%
                        </span>
                      </div>
                    </div>
                  ),
                )
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  No attempts saved yet.
                </p>
              )}
            </div>
          </LiquidCard>
        </div>
      </div>
    </AppShell>
  );
}
