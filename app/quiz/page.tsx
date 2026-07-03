"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

type QuizQuestion = {
  id: string | number;
  question: string;
  context?: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  weakArea?: string;
};

export default function QuizPage() {
  const [lessonNo, setLessonNo] = useState(1);
  const [studentId, setStudentId] = useState("demo-student");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const score = useMemo(() => {
    return questions.reduce((total, question) => {
      return answers[String(question.id)] === question.correctAnswer
        ? total + 1
        : total;
    }, 0);
  }, [questions, answers]);

  async function generateQuiz() {
    setLoading(true);
    setError("");
    setQuestions([]);
    setAnswers({});

    try {
      const response = await fetch("/api/ocr-book/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lessonNo, studentId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Quiz failed.");
      }

      setQuestions(data.questions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function chooseAnswer(questionId: string | number, answer: string) {
    setAnswers((previous) => ({
      ...previous,
      [String(questionId)]: answer,
    }));
  }

  return (
    <AppShell>
      <LiquidCard className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-indigo-100 text-indigo-700">
              <ClipboardList size={30} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Lesson Quiz</h2>
              <p className="text-sm font-semibold text-slate-500">
                Practice from the current textbook lesson.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl bg-white/65 p-4 shadow-inner md:flex-row md:items-center">
            <input
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-sm font-bold outline-none"
            />

            <select
              value={lessonNo}
              onChange={(event) => setLessonNo(Number(event.target.value))}
              className="rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-sm font-bold outline-none"
            >
              {[1, 2, 3, 4, 5].map((item) => (
                <option key={item} value={item}>
                  Lesson {item}
                </option>
              ))}
            </select>

            <button
              onClick={generateQuiz}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-4 py-2 text-sm font-black text-white shadow-lg disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Generate
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-3xl bg-white/65 p-5 shadow-inner">
          <p className="text-sm font-black">
            Score: {score}/{questions.length}
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {questions.map((question, index) => {
            const selected = answers[String(question.id)];
            const answered = Boolean(selected);

            return (
              <div
                key={String(question.id)}
                className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-inner"
              >
                <p className="text-xs font-black uppercase text-slate-500">
                  Question {index + 1}
                </p>

                <p className="mt-1 text-base font-black leading-7">
                  {question.question}
                </p>

                {question.context && (
                  <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
                    {question.context}
                  </p>
                )}

                <div className="mt-4 grid gap-2">
                  {question.options.map((option) => {
                    const isSelected = selected === option;
                    const isCorrect = option === question.correctAnswer;

                    let className =
                      "border-white/80 bg-white/85 text-slate-700";

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
                        onClick={() => chooseAnswer(question.id, option)}
                        className={`flex items-start gap-3 rounded-2xl border p-3 text-left text-sm font-bold leading-6 transition ${className}`}
                      >
                        {answered && isCorrect ? (
                          <CheckCircle2 size={18} className="mt-1 shrink-0" />
                        ) : answered && isSelected && !isCorrect ? (
                          <XCircle size={18} className="mt-1 shrink-0" />
                        ) : (
                          <Circle size={18} className="mt-1 shrink-0" />
                        )}
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>

                {answered && (
                  <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-800">
                    <p className="font-black">Explanation</p>
                    <p>{question.explanation ?? "Explanation unavailable."}</p>
                  </div>
                )}
              </div>
            );
          })}

          {questions.length === 0 && !loading && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
              <ClipboardList size={40} className="mx-auto text-slate-400" />
              <p className="mt-3 text-sm font-bold text-slate-500">
                Click Generate to start a lesson quiz.
              </p>
            </div>
          )}
        </div>
      </LiquidCard>
    </AppShell>
  );
}
