"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Gamepad2,
  HelpCircle,
  Loader2,
  Puzzle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

type LessonLine = {
  id: string;
  text: string;
};

type DetectiveQuestion = {
  sentence: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

function cleanWord(word: string) {
  return word.replace(/[“”"]/g, "").trim();
}

function normalizeSentence(sentence: string) {
  return sentence
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitWords(sentence: string) {
  return sentence
    .replace(/[.,!?;:]/g, "")
    .split(/\s+/)
    .map(cleanWord)
    .filter(Boolean);
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeLines(data: any): LessonLine[] {
  const lesson = data.lesson ?? data;
  const rawLines = lesson.lines ?? data.lines ?? [];

  if (Array.isArray(rawLines) && rawLines.length > 0) {
    return rawLines
      .map((line: any, index: number) => ({
        id: line.id ?? `line-${index + 1}`,
        text:
          typeof line === "string" ? line : (line.text ?? line.lineText ?? ""),
      }))
      .filter((line: LessonLine) => line.text.trim().length > 15);
  }

  const text = lesson.text ?? data.text ?? "";

  return text
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 15)
    .map((line: string, index: number) => ({
      id: `line-${index + 1}`,
      text: line,
    }));
}

function makeDetectiveQuestion(sentence: string): DetectiveQuestion {
  const lower = sentence.toLowerCase();
  const words = splitWords(sentence);

  const pastContinuousMatch = sentence.match(/\b(was|were)\s+\w+ing\b/i);
  const beVerb = words.find((word) =>
    ["am", "is", "are", "was", "were"].includes(word.toLowerCase()),
  );
  const preposition = words.find((word) =>
    ["in", "on", "at", "from", "to", "with", "for", "of", "by"].includes(
      word.toLowerCase(),
    ),
  );
  const conjunction = words.find((word) =>
    ["and", "but", "or", "because"].includes(word.toLowerCase()),
  );

  if (pastContinuousMatch) {
    const correct = pastContinuousMatch[0];

    return {
      sentence,
      question: "Which part shows Past Continuous Tense?",
      options: shuffle([
        correct,
        words[0] ?? "The",
        preposition ?? "at",
        words[words.length - 1] ?? "station",
      ]),
      correctAnswer: correct,
      explanation:
        "Past Continuous Tense usually uses was/were + verb-ing. Here, the action was continuing in the past.",
    };
  }

  if (beVerb) {
    return {
      sentence,
      question: "Which word is a be-verb?",
      options: shuffle([
        beVerb,
        words[0] ?? "The",
        preposition ?? "in",
        conjunction ?? "and",
      ]),
      correctAnswer: beVerb,
      explanation:
        "Be-verbs include am, is, are, was, and were. They help connect the subject with information or show tense.",
    };
  }

  if (preposition) {
    return {
      sentence,
      question: "Which word is a preposition?",
      options: shuffle([
        preposition,
        words[0] ?? "The",
        words[words.length - 1] ?? "school",
        conjunction ?? "and",
      ]),
      correctAnswer: preposition,
      explanation:
        "A preposition shows relation, place, direction, or time. Examples: in, on, at, from, to, with.",
    };
  }

  if (conjunction) {
    return {
      sentence,
      question: "Which word joins ideas or words?",
      options: shuffle([
        conjunction,
        words[0] ?? "The",
        words[words.length - 1] ?? "school",
        preposition ?? "in",
      ]),
      correctAnswer: conjunction,
      explanation:
        "A conjunction joins words, phrases, or sentences. Examples: and, but, or, because.",
    };
  }

  return {
    sentence,
    question: "Which option is a word from the sentence?",
    options: shuffle([words[0] ?? sentence, "computer", "mountain", "airport"]),
    correctAnswer: words[0] ?? sentence,
    explanation:
      "This game helps you notice important words inside a sentence before learning deeper grammar.",
  };
}

export default function GamesPage() {
  const [lessonNo, setLessonNo] = useState(1);
  const [lines, setLines] = useState<LessonLine[]>([]);
  const [selectedSentence, setSelectedSentence] = useState("");
  const [wordBank, setWordBank] = useState<string[]>([]);
  const [builtWords, setBuiltWords] = useState<string[]>([]);
  const [sentenceResult, setSentenceResult] = useState<
    "idle" | "correct" | "wrong"
  >("idle");

  const [detectiveQuestion, setDetectiveQuestion] =
    useState<DetectiveQuestion | null>(null);
  const [detectiveAnswer, setDetectiveAnswer] = useState("");
  const [detectiveResult, setDetectiveResult] = useState<
    "idle" | "correct" | "wrong"
  >("idle");

  const [score, setScore] = useState(0);
  const [stars, setStars] = useState(0);
  const [loading, setLoading] = useState(false);

  const originalWords = useMemo(() => {
    return splitWords(selectedSentence);
  }, [selectedSentence]);

  const builtSentence = builtWords.join(" ");

  async function loadLesson(nextLessonNo: number) {
    setLoading(true);
    setLessonNo(nextLessonNo);
    setSelectedSentence("");
    setWordBank([]);
    setBuiltWords([]);
    setSentenceResult("idle");
    setDetectiveQuestion(null);
    setDetectiveAnswer("");
    setDetectiveResult("idle");

    try {
      const response = await fetch(`/api/ocr-book/lessons/${nextLessonNo}`);
      const data = await response.json();
      const normalized = normalizeLines(data);
      setLines(normalized);
    } finally {
      setLoading(false);
    }
  }

  function chooseSentence(sentence: string) {
    const words = splitWords(sentence);

    setSelectedSentence(sentence);
    setBuiltWords([]);
    setWordBank(shuffle(words));
    setSentenceResult("idle");

    setDetectiveQuestion(makeDetectiveQuestion(sentence));
    setDetectiveAnswer("");
    setDetectiveResult("idle");
  }

  function addWord(word: string, index: number) {
    setBuiltWords((previous) => [...previous, word]);
    setWordBank((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
    setSentenceResult("idle");
  }

  function removeBuiltWord(word: string, index: number) {
    setWordBank((previous) => [...previous, word]);
    setBuiltWords((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
    setSentenceResult("idle");
  }

  function resetSentenceBuilder() {
    setBuiltWords([]);
    setWordBank(shuffle(originalWords));
    setSentenceResult("idle");
  }

  function checkSentenceBuilder() {
    const original = normalizeSentence(selectedSentence);
    const built = normalizeSentence(builtSentence);

    if (!selectedSentence || builtWords.length === 0) {
      setSentenceResult("wrong");
      return;
    }

    if (original === built) {
      setSentenceResult("correct");
      setScore((previous) => previous + 10);
      setStars((previous) => previous + 1);
    } else {
      setSentenceResult("wrong");
    }
  }

  function chooseDetectiveAnswer(answer: string) {
    if (!detectiveQuestion) return;

    setDetectiveAnswer(answer);

    if (answer === detectiveQuestion.correctAnswer) {
      setDetectiveResult("correct");
      setScore((previous) => previous + 10);
      setStars((previous) => previous + 1);
    } else {
      setDetectiveResult("wrong");
    }
  }

  function newRandomSentence() {
    if (lines.length === 0) return;

    const randomLine = shuffle(lines)[0];
    chooseSentence(randomLine.text);
  }

  useEffect(() => {
    const savedLine = localStorage.getItem("selectedLine");
    const savedLessonNo = Number(localStorage.getItem("selectedLessonNo") ?? 1);

    loadLesson(savedLessonNo || 1);

    if (savedLine) {
      chooseSentence(savedLine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <LiquidCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-[28px] bg-gradient-to-br from-fuchsia-600 via-purple-600 to-blue-600 text-white shadow-2xl">
              <Gamepad2 size={34} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-purple-700">
                Grammar Game Zone
              </p>
              <h2 className="text-3xl font-black tracking-tight">
                Play & Learn
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                Build sentences and find grammar clues from textbook lines.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-3xl bg-yellow-50 p-4 shadow-inner">
              <Trophy className="text-yellow-600" size={24} />
              <p className="mt-2 text-xs font-black text-yellow-700">Score</p>
              <p className="text-3xl font-black">{score}</p>
            </div>

            <div className="rounded-3xl bg-purple-50 p-4 shadow-inner">
              <Sparkles className="text-purple-600" size={24} />
              <p className="mt-2 text-xs font-black text-purple-700">Stars</p>
              <p className="text-3xl font-black">{stars}</p>
            </div>

            <div className="rounded-3xl bg-blue-50 p-4 shadow-inner">
              <Puzzle className="text-blue-600" size={24} />
              <p className="mt-2 text-xs font-black text-blue-700">Lesson</p>
              <p className="text-3xl font-black">{lessonNo}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/80 bg-white/65 p-4 shadow-inner">
            <p className="text-sm font-black">Choose Lesson</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((item) => (
                <button
                  key={item}
                  onClick={() => loadLesson(item)}
                  className={`rounded-2xl px-4 py-2 text-sm font-black shadow-md transition hover:scale-[1.04] ${
                    lessonNo === item
                      ? "bg-purple-600 text-white"
                      : "bg-white/80 text-slate-700"
                  }`}
                >
                  Lesson {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/80 bg-white/65 p-4 shadow-inner">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">Pick a Sentence</p>
                <p className="text-xs font-semibold text-slate-500">
                  Select a textbook line for both games.
                </p>
              </div>

              <button
                onClick={newRandomSentence}
                disabled={lines.length === 0}
                className="flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-lg disabled:opacity-60"
              >
                <RefreshCw size={14} />
                Random
              </button>
            </div>

            <div className="mt-4 max-h-[380px] space-y-2 overflow-y-auto rounded-3xl bg-slate-50/80 p-3">
              {loading && (
                <div className="flex items-center justify-center gap-2 rounded-3xl bg-white/80 p-6 text-sm font-bold text-slate-600">
                  <Loader2 size={18} className="animate-spin" />
                  Loading sentences...
                </div>
              )}

              {!loading &&
                lines.slice(0, 18).map((line, index) => (
                  <button
                    key={line.id}
                    onClick={() => chooseSentence(line.text)}
                    className={`w-full rounded-2xl border p-3 text-left text-xs font-bold leading-5 transition hover:scale-[1.01] ${
                      selectedSentence === line.text
                        ? "border-purple-400 bg-purple-600 text-white"
                        : "border-white/80 bg-white/85 text-slate-700"
                    }`}
                  >
                    <span className="mr-2 font-black">{index + 1}.</span>
                    {line.text}
                  </button>
                ))}
            </div>
          </div>
        </LiquidCard>

        <div className="space-y-6">
          <LiquidCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-blue-100 text-blue-700">
                <Puzzle size={30} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                  Game 1
                </p>
                <h2 className="text-2xl font-black">Sentence Builder</h2>
                <p className="text-sm font-semibold text-slate-500">
                  Tap word cards to build the correct sentence.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-white/70 p-4 shadow-inner">
              <p className="text-xs font-black uppercase text-slate-500">
                Original sentence
              </p>
              <p className="mt-2 text-sm font-semibold leading-7">
                {selectedSentence ||
                  "Choose a sentence from the left side first."}
              </p>
            </div>

            <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-xs font-black uppercase text-blue-700">
                Your sentence
              </p>

              <div className="mt-3 flex min-h-20 flex-wrap gap-2 rounded-3xl bg-white/75 p-3 shadow-inner">
                {builtWords.length === 0 && (
                  <p className="text-sm font-semibold text-slate-400">
                    Tap words below to build the sentence.
                  </p>
                )}

                {builtWords.map((word, index) => (
                  <button
                    key={`${word}-${index}`}
                    onClick={() => removeBuiltWord(word, index)}
                    className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-md transition hover:scale-[1.04]"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-white/80 bg-white/65 p-4 shadow-inner">
              <p className="text-xs font-black uppercase text-slate-500">
                Word bank
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {wordBank.map((word, index) => (
                  <button
                    key={`${word}-${index}`}
                    onClick={() => addWord(word, index)}
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-md transition hover:scale-[1.06] hover:bg-blue-50"
                  >
                    {word}
                  </button>
                ))}

                {wordBank.length === 0 && selectedSentence && (
                  <p className="text-sm font-semibold text-slate-500">
                    All words are used. Check your sentence now.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={checkSentenceBuilder}
                className="flex items-center gap-2 rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-xl transition hover:scale-[1.03]"
              >
                <ShieldCheck size={18} />
                Check Sentence
              </button>

              <button
                onClick={resetSentenceBuilder}
                className="flex items-center gap-2 rounded-3xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-xl transition hover:scale-[1.03]"
              >
                <RotateCcw size={18} />
                Reset
              </button>
            </div>

            {sentenceResult !== "idle" && (
              <div
                className={`mt-5 rounded-3xl p-4 text-sm font-bold leading-6 ${
                  sentenceResult === "correct"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {sentenceResult === "correct" ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
                    <p>
                      Great job. You built the sentence correctly. This improves
                      word order and sentence structure.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <XCircle size={20} className="mt-0.5 shrink-0" />
                    <p>
                      Try again. Check the word order carefully. Start with the
                      subject, then the verb, then the remaining information.
                    </p>
                  </div>
                )}
              </div>
            )}
          </LiquidCard>

          <LiquidCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-purple-100 text-purple-700">
                <HelpCircle size={30} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-purple-700">
                  Game 2
                </p>
                <h2 className="text-2xl font-black">Grammar Detective</h2>
                <p className="text-sm font-semibold text-slate-500">
                  Find the grammar clue hidden inside the sentence.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-white/70 p-4 shadow-inner">
              <p className="text-xs font-black uppercase text-slate-500">
                Sentence
              </p>
              <p className="mt-2 text-sm font-semibold leading-7">
                {detectiveQuestion?.sentence ||
                  "Choose a sentence to start the detective game."}
              </p>
            </div>

            <div className="mt-5 rounded-3xl border border-purple-100 bg-purple-50/70 p-4">
              <p className="text-sm font-black">
                {detectiveQuestion?.question ?? "No question yet."}
              </p>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {(detectiveQuestion?.options ?? []).map((option) => {
                  const answered = detectiveResult !== "idle";
                  const isSelected = detectiveAnswer === option;
                  const isCorrect = detectiveQuestion?.correctAnswer === option;

                  let className = "border-white/80 bg-white/85 text-slate-700";

                  if (answered && isCorrect) {
                    className =
                      "border-emerald-300 bg-emerald-50 text-emerald-800";
                  }

                  if (answered && isSelected && !isCorrect) {
                    className = "border-red-300 bg-red-50 text-red-700";
                  }

                  return (
                    <button
                      key={option}
                      onClick={() => chooseDetectiveAnswer(option)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm font-black shadow-sm transition hover:scale-[1.02] ${className}`}
                    >
                      {answered && isCorrect ? (
                        <CheckCircle2 size={18} />
                      ) : answered && isSelected && !isCorrect ? (
                        <XCircle size={18} />
                      ) : (
                        <Circle size={18} />
                      )}
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            {detectiveResult !== "idle" && detectiveQuestion && (
              <div
                className={`mt-5 rounded-3xl p-4 text-sm font-bold leading-6 ${
                  detectiveResult === "correct"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <p className="font-black">
                  {detectiveResult === "correct"
                    ? "Correct Detective Work!"
                    : "Not quite. Try to notice the grammar clue."}
                </p>
                <p className="mt-2">{detectiveQuestion.explanation}</p>
              </div>
            )}
          </LiquidCard>
        </div>
      </div>
    </AppShell>
  );
}
