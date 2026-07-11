"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  Gamepad2,
  Gauge,
  Lightbulb,
  Loader2,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Sparkles,
  Target,
  Trophy,
  XCircle,
  Zap,
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

type GameStage =
  | "setup"
  | "playing"
  | "completed";

type FeedbackState =
  | "idle"
  | "wrong"
  | "correct";

type GamePair = {
  id: string;
  left: string;
  right: string;
  explanation: string;
};

type MatchChoice = {
  pairId: string;
  text: string;
};

type GenerateResponse = {
  success: boolean;
  source?: string;
  difficulty?: Difficulty;
  pairs?: GamePair[];
  warning?: string;
  error?: string;
};

const difficultyDetails: Record<
  Difficulty,
  {
    title: string;
    description: string;
    points: number;
  }
> = {
  easy: {
    title: "Easy",
    description:
      "Direct meaning and simple relationships",
    points: 80,
  },
  medium: {
    title: "Medium",
    description:
      "Context, actions and comprehension",
    points: 100,
  },
  hard: {
    title: "Hard",
    description:
      "Inference and closely related answers",
    points: 130,
  },
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (
    let index = copy.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1),
    );

    [
      copy[index],
      copy[randomIndex],
    ] = [
      copy[randomIndex],
      copy[index],
    ];
  }

  return copy;
}

function createChoices(
  activePair: GamePair,
  allPairs: GamePair[],
): MatchChoice[] {
  const incorrectChoices = shuffle(
    allPairs
      .filter(
        (pair) =>
          pair.id !== activePair.id,
      )
      .map((pair) => ({
        pairId: pair.id,
        text: pair.right,
      })),
  ).slice(0, 3);

  return shuffle([
    {
      pairId: activePair.id,
      text: activePair.right,
    },
    ...incorrectChoices,
  ]);
}

export default function GamesPage() {
  const [studentKey, setStudentKey] =
    useState("");

  const [studentName, setStudentName] =
    useState("Student");

  const [selectedText, setSelectedText] =
    useState("");

  const [pageNumber, setPageNumber] =
    useState(0);

  const [lessonNo, setLessonNo] =
    useState(0);

  const [lessonTitle, setLessonTitle] =
    useState("Selected Book Content");

  const [difficulty, setDifficulty] =
    useState<Difficulty>("medium");

  const [pairCount, setPairCount] =
    useState(6);

  const [allPairs, setAllPairs] =
    useState<GamePair[]>([]);

  const [
    remainingPairs,
    setRemainingPairs,
  ] = useState<GamePair[]>([]);

  const [choices, setChoices] =
    useState<MatchChoice[]>([]);

  const [
    removedChoiceIds,
    setRemovedChoiceIds,
  ] = useState<string[]>([]);

  const [selectedChoiceId, setSelectedChoiceId] =
    useState<string | null>(null);

  const [stage, setStage] =
    useState<GameStage>("setup");

  const [feedback, setFeedback] =
    useState<FeedbackState>("idle");

  const [score, setScore] =
    useState(0);

  const [moves, setMoves] =
    useState(0);

  const [mistakes, setMistakes] =
    useState(0);

  const [streak, setStreak] =
    useState(0);

  const [bestStreak, setBestStreak] =
    useState(0);

  const [seconds, setSeconds] =
    useState(0);

  const [skips, setSkips] =
    useState(0);

  const [hints, setHints] =
    useState(0);

  const [hintUsed, setHintUsed] =
    useState(false);

  const [lastExplanation, setLastExplanation] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [warning, setWarning] =
    useState("");

  const activePair =
    remainingPairs[0] ?? null;

  const totalPairs =
    allPairs.length;

  const completedPairs =
    totalPairs -
    remainingPairs.length;

  const progress =
    totalPairs > 0
      ? Math.round(
          (completedPairs / totalPairs) *
            100,
        )
      : 0;

  useEffect(() => {
    setStudentKey(
      getStoredStudentKey(),
    );

    setStudentName(
      getStoredStudentName(),
    );

    setSelectedText(
      localStorage.getItem(
        "selectedLine",
      ) ?? "",
    );

    setPageNumber(
      Number(
        localStorage.getItem(
          "selectedBookPdfPage",
        ) ?? 0,
      ),
    );

    setLessonNo(
      Number(
        localStorage.getItem(
          "selectedLessonNo",
        ) ?? 0,
      ),
    );

    setLessonTitle(
      localStorage.getItem(
        "selectedLessonTitle",
      ) ?? "Selected Book Content",
    );
  }, []);

  useEffect(() => {
    if (stage !== "playing") {
      return;
    }

    const timer = window.setInterval(
      () => {
        setSeconds(
          (current) =>
            current + 1,
        );
      },
      1000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [stage]);

  useEffect(() => {
    if (
      stage !== "playing" ||
      !activePair ||
      allPairs.length < 4
    ) {
      return;
    }

    setChoices(
      createChoices(
        activePair,
        allPairs,
      ),
    );

    setRemovedChoiceIds([]);
    setSelectedChoiceId(null);
    setFeedback("idle");
    setHintUsed(false);
    setLastExplanation("");
    setError("");
  }, [
    activePair?.id,
    allPairs,
    stage,
  ]);

  async function generateGame() {
    setLoading(true);
    setError("");
    setWarning("");
    setScore(0);
    setMoves(0);
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setSeconds(0);
    setSkips(0);
    setHints(0);
    setHintUsed(false);
    setLastExplanation("");
    setSelectedChoiceId(null);
    setRemovedChoiceIds([]);

    try {
      const response = await fetch(
        "/api/games/matching",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            selectedText,
            pageNumber,
            lessonNo,
            difficulty,
            pairCount,
          }),
        },
      );

      const responseText =
        await response.text();

      let data: GenerateResponse;

      try {
        data = JSON.parse(
          responseText,
        );
      } catch {
        throw new Error(
          `Game API returned ${response.status} ${response.statusText} instead of JSON.`,
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ??
            "Game generation failed.",
        );
      }

      if (
        !data.pairs ||
        data.pairs.length < 4
      ) {
        throw new Error(
          "At least four valid matching pairs are required.",
        );
      }

      const preparedPairs =
        shuffle(data.pairs);

      setAllPairs(preparedPairs);
      setRemainingPairs(
        preparedPairs,
      );

      setWarning(
        data.warning ?? "",
      );

      setStage("playing");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Game generation failed.",
      );

      setStage("setup");
    } finally {
      setLoading(false);
    }
  }

  function finishGame(
    finalScore: number,
    finalMoves: number,
  ) {
    setScore(finalScore);
    setStage("completed");

    fetch("/api/games/attempt", {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        studentKey,
        studentId: studentKey,
        lessonNo,
        lessonTitle,
        gameType:
          "focus-two-side-match",
        difficulty,
        score: finalScore,
        moves: finalMoves,
        mistakes,
        seconds,
        skips,
        hints,
        totalPairs,
        matchedPairs: totalPairs,
      }),
    }).catch(() => undefined);

    fetch("/api/study/track", {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        studentKey,
        activityType:
          "game_completed",
        gameType:
          "focus-two-side-match",
        difficulty,
        score: finalScore,
      }),
    }).catch(() => undefined);
  }

  function chooseMatch(
    choice: MatchChoice,
  ) {
    if (
      stage !== "playing" ||
      !activePair ||
      feedback === "correct" ||
      removedChoiceIds.includes(
        choice.pairId,
      )
    ) {
      return;
    }

    const nextMoves =
      moves + 1;

    setMoves(nextMoves);
    setSelectedChoiceId(
      choice.pairId,
    );

    if (
      choice.pairId ===
      activePair.id
    ) {
      const nextStreak =
        streak + 1;

      const streakBonus =
        Math.min(
          nextStreak * 10,
          50,
        );

      const hintPenalty =
        hintUsed ? 15 : 0;

      const earnedPoints =
        difficultyDetails[
          difficulty
        ].points +
        streakBonus -
        hintPenalty;

      const nextScore =
        Math.max(
          0,
          score + earnedPoints,
        );

      setScore(nextScore);
      setStreak(nextStreak);

      setBestStreak(
        (currentBest) =>
          Math.max(
            currentBest,
            nextStreak,
          ),
      );

      setFeedback("correct");

      setLastExplanation(
        activePair.explanation,
      );

      const isFinalPair =
        remainingPairs.length === 1;

      window.setTimeout(() => {
        if (isFinalPair) {
          const completionBonus =
            Math.max(
              0,
              120 - seconds,
            );

          finishGame(
            nextScore +
              completionBonus,
            nextMoves,
          );

          return;
        }

        setRemainingPairs(
          (currentPairs) =>
            currentPairs.slice(1),
        );
      }, 750);

      return;
    }

    setFeedback("wrong");

    setMistakes(
      (current) =>
        current + 1,
    );

    setStreak(0);

    setScore(
      (current) =>
        Math.max(
          0,
          current - 10,
        ),
    );

    setRemovedChoiceIds(
      (currentIds) =>
        currentIds.includes(
          choice.pairId,
        )
          ? currentIds
          : [
              ...currentIds,
              choice.pairId,
            ],
    );

    window.setTimeout(() => {
      setFeedback("idle");
      setSelectedChoiceId(null);
    }, 550);
  }

  function useHint() {
    if (
      !activePair ||
      hintUsed ||
      feedback === "correct"
    ) {
      return;
    }

    const removableChoice =
      choices.find(
        (choice) =>
          choice.pairId !==
            activePair.id &&
          !removedChoiceIds.includes(
            choice.pairId,
          ),
      );

    if (!removableChoice) {
      return;
    }

    setRemovedChoiceIds(
      (current) => [
        ...current,
        removableChoice.pairId,
      ],
    );

    setHintUsed(true);

    setHints(
      (current) =>
        current + 1,
    );

    setScore(
      (current) =>
        Math.max(
          0,
          current - 5,
        ),
    );
  }

  function skipCurrentPair() {
    if (
      remainingPairs.length <= 1 ||
      feedback === "correct"
    ) {
      return;
    }

    setRemainingPairs(
      (currentPairs) => {
        const [
          firstPair,
          ...otherPairs
        ] = currentPairs;

        return [
          ...otherPairs,
          firstPair,
        ];
      },
    );

    setSkips(
      (current) =>
        current + 1,
    );

    setStreak(0);

    setScore(
      (current) =>
        Math.max(
          0,
          current - 5,
        ),
    );
  }

  function restartGame() {
    const restartedPairs =
      shuffle(allPairs);

    setRemainingPairs(
      restartedPairs,
    );

    setScore(0);
    setMoves(0);
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setSeconds(0);
    setSkips(0);
    setHints(0);
    setHintUsed(false);
    setLastExplanation("");
    setStage("playing");
  }

  function returnToSetup() {
    setStage("setup");
    setAllPairs([]);
    setRemainingPairs([]);
    setChoices([]);
    setRemovedChoiceIds([]);
    setSelectedChoiceId(null);
    setFeedback("idle");
    setLastExplanation("");
    setError("");
    setWarning("");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <LiquidCard className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl" />

          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-300/25 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="grid h-16 w-16 shrink-0 place-items-center rounded-[24px] bg-gradient-to-br from-emerald-500 via-blue-600 to-purple-700 text-white shadow-2xl"
                style={{
                  transform:
                    "perspective(800px) rotateX(8deg) rotateY(-8deg)",
                  transformStyle:
                    "preserve-3d",
                }}
              >
                <Gamepad2 size={31} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  Game 1
                </p>

                <h1 className="text-3xl font-black text-slate-950">
                  Focus Match
                </h1>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Match one textbook idea with its correct meaning.
                </p>
              </div>
            </div>

            <Link
              href="/reader"
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-xl"
            >
              <ArrowLeft size={17} />
              Back to Reader
            </Link>
          </div>
        </LiquidCard>

        {stage === "setup" && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <LiquidCard className="p-6">
              <div className="flex items-center gap-3">
                <Gauge
                  className="text-emerald-700"
                  size={25}
                />

                <div>
                  <h2 className="text-xl font-black">
                    Choose Difficulty
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    Select the level of relationship and reasoning.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {(
                  [
                    "easy",
                    "medium",
                    "hard",
                  ] as Difficulty[]
                ).map((level) => {
                  const selected =
                    difficulty === level;

                  return (
                    <button
                      type="button"
                      key={level}
                      onClick={() =>
                        setDifficulty(level)
                      }
                      className={`w-full rounded-3xl border p-5 text-left transition duration-300 ${
                        selected
                          ? "border-emerald-500 bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-2xl"
                          : "border-white bg-white/75 text-slate-800 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl"
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
                          selected
                            ? "text-emerald-50"
                            : "text-slate-500"
                        }`}
                      >
                        {
                          difficultyDetails[
                            level
                          ].description
                        }
                      </p>

                      <p
                        className={`mt-2 text-xs font-black ${
                          selected
                            ? "text-yellow-200"
                            : "text-emerald-700"
                        }`}
                      >
                        {
                          difficultyDetails[
                            level
                          ].points
                        }{" "}
                        base points per match
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <Target
                    className="text-purple-700"
                    size={22}
                  />

                  <h2 className="text-lg font-black">
                    Number of Rounds
                  </h2>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[4, 6, 8].map(
                    (count) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() =>
                          setPairCount(
                            count,
                          )
                        }
                        className={`rounded-2xl px-4 py-4 text-lg font-black transition hover:-translate-y-1 ${
                          pairCount === count
                            ? "bg-purple-700 text-white shadow-xl"
                            : "bg-white/75 text-slate-700"
                        }`}
                      >
                        {count}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </LiquidCard>

            <LiquidCard className="p-6">
              <div className="flex items-center gap-3">
                <BookOpen
                  className="text-blue-700"
                  size={25}
                />

                <div>
                  <h2 className="text-xl font-black">
                    Textbook Source
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    The game uses cleaned OCR content only.
                  </p>
                </div>
              </div>

              <div className="mt-5 min-h-52 rounded-3xl bg-white/75 p-5 text-sm font-semibold leading-7 text-slate-700 shadow-inner">
                {selectedText ||
                  (pageNumber
                    ? `Game content will be generated from the clean textbook text on page ${pageNumber}.`
                    : "Return to the Reader and select a meaningful textbook sentence.")}
              </div>

              <div className="mt-4 rounded-3xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
                <p className="font-black">
                  How Focus Match works
                </p>

                <p className="mt-1">
                  Read the prompt on the left and choose the correct relationship from four cards on the right.
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
                onClick={generateGame}
                disabled={
                  loading ||
                  (!selectedText &&
                    !pageNumber)
                }
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-700 px-6 py-4 text-lg font-black text-white shadow-2xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      size={22}
                    />
                    Creating Focus Match...
                  </>
                ) : (
                  <>
                    <Sparkles size={22} />
                    Start Game 1
                  </>
                )}
              </button>
            </LiquidCard>
          </div>
        )}

        {stage === "playing" &&
          activePair && (
            <>
              <LiquidCard className="p-4">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  <div className="rounded-2xl bg-blue-50 p-3 text-center">
                    <Clock3
                      className="mx-auto text-blue-700"
                      size={18}
                    />

                    <p className="mt-1 text-[10px] font-black uppercase text-slate-500">
                      Time
                    </p>

                    <p className="font-black">
                      {seconds}s
                    </p>
                  </div>

                  <div className="rounded-2xl bg-purple-50 p-3 text-center">
                    <Target
                      className="mx-auto text-purple-700"
                      size={18}
                    />

                    <p className="mt-1 text-[10px] font-black uppercase text-slate-500">
                      Round
                    </p>

                    <p className="font-black">
                      {completedPairs + 1}/
                      {totalPairs}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-red-50 p-3 text-center">
                    <XCircle
                      className="mx-auto text-red-700"
                      size={18}
                    />

                    <p className="mt-1 text-[10px] font-black uppercase text-slate-500">
                      Mistakes
                    </p>

                    <p className="font-black">
                      {mistakes}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-orange-50 p-3 text-center">
                    <Zap
                      className="mx-auto text-orange-700"
                      size={18}
                    />

                    <p className="mt-1 text-[10px] font-black uppercase text-slate-500">
                      Streak
                    </p>

                    <p className="font-black">
                      {streak}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                    <CheckCircle2
                      className="mx-auto text-emerald-700"
                      size={18}
                    />

                    <p className="mt-1 text-[10px] font-black uppercase text-slate-500">
                      Matched
                    </p>

                    <p className="font-black">
                      {completedPairs}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-yellow-50 p-3 text-center">
                    <Trophy
                      className="mx-auto text-yellow-700"
                      size={18}
                    />

                    <p className="mt-1 text-[10px] font-black uppercase text-slate-500">
                      Score
                    </p>

                    <p className="font-black">
                      {score}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-blue-600 to-purple-700 transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </LiquidCard>

              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <LiquidCard className="relative overflow-hidden p-6">
                  <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl" />

                  <div className="relative">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-xl">
                        <Brain size={22} />
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                          Left Side
                        </p>

                        <h2 className="text-xl font-black">
                          Textbook Prompt
                        </h2>
                      </div>
                    </div>

                    <div
                      className="mt-6 rounded-[30px] border border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-blue-50 p-7 shadow-[0_25px_50px_rgba(5,150,105,0.16)]"
                      style={{
                        transform:
                          "perspective(1000px) rotateY(-3deg) rotateX(2deg)",
                        transformStyle:
                          "preserve-3d",
                      }}
                    >
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
                        Match this idea
                      </p>

                      <p className="mt-5 text-xl font-black leading-9 text-slate-950">
                        {activePair.left}
                      </p>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={useHint}
                        disabled={
                          hintUsed ||
                          feedback ===
                            "correct"
                        }
                        className="flex items-center justify-center gap-2 rounded-2xl bg-yellow-100 px-4 py-3 text-sm font-black text-yellow-900 transition hover:-translate-y-1 disabled:opacity-40"
                      >
                        <Lightbulb size={17} />
                        Hint
                      </button>

                      <button
                        type="button"
                        onClick={skipCurrentPair}
                        disabled={
                          remainingPairs.length <=
                            1 ||
                          feedback ===
                            "correct"
                        }
                        className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-1 disabled:opacity-40"
                      >
                        <SkipForward size={17} />
                        Skip
                      </button>
                    </div>

                    {hintUsed && (
                      <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-yellow-900">
                        One incorrect option has been removed.
                      </div>
                    )}
                  </div>
                </LiquidCard>

                <LiquidCard className="relative overflow-hidden p-6">
                  <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-purple-300/25 blur-3xl" />

                  <div className="relative">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-700 text-white shadow-xl">
                        <Sparkles size={22} />
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-purple-700">
                          Right Side
                        </p>

                        <h2 className="text-xl font-black">
                          Choose the Correct Match
                        </h2>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {choices.map(
                        (
                          choice,
                          index,
                        ) => {
                          const removed =
                            removedChoiceIds.includes(
                              choice.pairId,
                            );

                          const isCorrect =
                            choice.pairId ===
                            activePair.id;

                          const selected =
                            selectedChoiceId ===
                            choice.pairId;

                          let cardClass =
                            "border-white bg-white/90 text-slate-800 shadow-lg hover:-translate-y-1 hover:border-purple-400 hover:shadow-2xl";

                          if (removed) {
                            cardClass =
                              "pointer-events-none scale-95 border-slate-200 bg-slate-100 text-slate-400 opacity-35";
                          }

                          if (
                            selected &&
                            feedback ===
                              "wrong"
                          ) {
                            cardClass =
                              "border-red-600 bg-red-100 text-red-900 shadow-xl";
                          }

                          if (
                            selected &&
                            feedback ===
                              "correct" &&
                            isCorrect
                          ) {
                            cardClass =
                              "border-emerald-600 bg-emerald-100 text-emerald-900 shadow-2xl";
                          }

                          return (
                            <button
                              type="button"
                              key={`${choice.pairId}-${index}`}
                              disabled={
                                removed ||
                                feedback ===
                                  "correct"
                              }
                              onClick={() =>
                                chooseMatch(
                                  choice,
                                )
                              }
                              className={`min-h-32 rounded-[26px] border-2 p-5 text-left transition duration-300 ${cardClass}`}
                              style={{
                                transform:
                                  removed
                                    ? "perspective(900px) rotateX(10deg) scale(0.94)"
                                    : `perspective(900px) rotateY(${index % 2 === 0 ? 2 : -2}deg)`,
                                transformStyle:
                                  "preserve-3d",
                              }}
                            >
                              <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-100 text-sm font-black text-purple-700">
                                {String.fromCharCode(
                                  65 +
                                    index,
                                )}
                              </span>

                              <p className="mt-4 font-black leading-7">
                                {choice.text}
                              </p>
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                </LiquidCard>
              </div>

              {feedback === "wrong" && (
                <div className="rounded-3xl bg-red-50 p-5 text-center font-black text-red-700">
                  That match is not correct. Try another option.
                </div>
              )}

              {feedback === "correct" &&
                lastExplanation && (
                  <LiquidCard className="border border-emerald-200 bg-emerald-50/90 p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className="mt-1 shrink-0 text-emerald-700"
                        size={23}
                      />

                      <div>
                        <p className="font-black text-emerald-900">
                          Correct Match
                        </p>

                        <p className="mt-2 text-sm font-semibold leading-7 text-emerald-800">
                          {lastExplanation}
                        </p>
                      </div>
                    </div>
                  </LiquidCard>
                )}

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={restartGame}
                  className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-slate-700 shadow-xl"
                >
                  <RotateCcw size={18} />
                  Restart Game
                </button>

                <button
                  type="button"
                  onClick={returnToSetup}
                  className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white shadow-xl"
                >
                  <Gauge size={18} />
                  Change Settings
                </button>
              </div>
            </>
          )}

        {stage === "completed" && (
          <LiquidCard className="relative overflow-hidden p-8 text-center">
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-yellow-300/35 blur-3xl" />

            <div className="relative">
              <div
                className="mx-auto grid h-24 w-24 place-items-center rounded-[32px] bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 text-white shadow-2xl"
                style={{
                  transform:
                    "perspective(900px) rotateX(8deg) rotateY(-8deg)",
                  transformStyle:
                    "preserve-3d",
                }}
              >
                <Trophy size={48} />
              </div>

              <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                Game 1 Completed
              </p>

              <h2 className="mt-2 text-4xl font-black text-slate-950">
                Excellent Matching!
              </h2>

              <p className="mt-3 text-lg font-bold text-slate-600">
                You completed all{" "}
                {totalPairs} rounds.
              </p>

              <p className="mt-5 text-6xl font-black text-purple-700">
                {score}
              </p>

              <p className="text-sm font-black uppercase tracking-wider text-slate-500">
                Final Score
              </p>

              <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-3xl bg-blue-50 p-4">
                  <Clock3
                    className="mx-auto text-blue-700"
                    size={21}
                  />

                  <p className="mt-2 text-xs font-black text-slate-500">
                    Time
                  </p>

                  <p className="text-xl font-black">
                    {seconds}s
                  </p>
                </div>

                <div className="rounded-3xl bg-purple-50 p-4">
                  <Target
                    className="mx-auto text-purple-700"
                    size={21}
                  />

                  <p className="mt-2 text-xs font-black text-slate-500">
                    Moves
                  </p>

                  <p className="text-xl font-black">
                    {moves}
                  </p>
                </div>

                <div className="rounded-3xl bg-red-50 p-4">
                  <XCircle
                    className="mx-auto text-red-700"
                    size={21}
                  />

                  <p className="mt-2 text-xs font-black text-slate-500">
                    Mistakes
                  </p>

                  <p className="text-xl font-black">
                    {mistakes}
                  </p>
                </div>

                <div className="rounded-3xl bg-orange-50 p-4">
                  <Zap
                    className="mx-auto text-orange-700"
                    size={21}
                  />

                  <p className="mt-2 text-xs font-black text-slate-500">
                    Best Streak
                  </p>

                  <p className="text-xl font-black">
                    {bestStreak}
                  </p>
                </div>

                <div className="rounded-3xl bg-yellow-50 p-4">
                  <Lightbulb
                    className="mx-auto text-yellow-700"
                    size={21}
                  />

                  <p className="mt-2 text-xs font-black text-slate-500">
                    Hints
                  </p>

                  <p className="text-xl font-black">
                    {hints}
                  </p>
                </div>

                <div className="rounded-3xl bg-slate-100 p-4">
                  <SkipForward
                    className="mx-auto text-slate-700"
                    size={21}
                  />

                  <p className="mt-2 text-xs font-black text-slate-500">
                    Skips
                  </p>

                  <p className="text-xl font-black">
                    {skips}
                  </p>
                </div>
              </div>

              <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={restartGame}
                  className="flex items-center justify-center gap-2 rounded-3xl bg-emerald-600 px-5 py-4 font-black text-white shadow-xl"
                >
                  <RefreshCw size={18} />
                  Play Again
                </button>

                <button
                  type="button"
                  onClick={generateGame}
                  className="flex items-center justify-center gap-2 rounded-3xl bg-purple-700 px-5 py-4 font-black text-white shadow-xl"
                >
                  <Sparkles size={18} />
                  New Matches
                </button>

                <Link
                  href="/reader"
                  className="flex items-center justify-center gap-2 rounded-3xl bg-slate-950 px-5 py-4 font-black text-white shadow-xl"
                >
                  <BookOpen size={18} />
                  Back to Book
                </Link>
              </div>
            </div>
          </LiquidCard>
        )}
      </div>
    </AppShell>
  );
}