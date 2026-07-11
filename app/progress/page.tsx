"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  ClipboardList,
  Gamepad2,
  Loader2,
  RefreshCw,
  UserRound,
} from "lucide-react";
import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";
import {
  getStoredStudentKey,
  getStoredStudentName,
} from "@/lib/studentSession";

type StudentSummary = {
  success?: boolean;
  error?: string;
  student?: {
    studentKey: string;
    email?: string | null;
    name?: string | null;
    classLevel?: number | null;
    section?: string | null;
    rollNumber?: string | null;
    schoolName?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
  };
  totals?: {
    minutesStudied: number;
    lessonsOpened: number;
    linesSelected: number;
    aiInteractions: number;
    quizAttempts: number;
    quizScore: number;
    quizTotal: number;
    gamesPlayed: number;
    gameScore: number;
  };
  dailyRecords?: unknown[];
  recentQuizAttempts?: unknown[];
  recentGameAttempts?: unknown[];
  recentChats?: unknown[];
};

export default function ProgressPage() {
  const [studentKey, setStudentKey] = useState("");
  const [studentName, setStudentName] = useState("Student");
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSummary(key: string) {
    if (!key) {
      setError("Student login information was not found. Please login again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/students/summary?studentKey=${encodeURIComponent(key)}`,
      );

      const data: StudentSummary = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Progress summary could not be loaded.");
      }

      setSummary(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Progress summary could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const realStudentKey = getStoredStudentKey();
    const realStudentName = getStoredStudentName();

    setStudentKey(realStudentKey);
    setStudentName(realStudentName);

    loadSummary(realStudentKey);
  }, []);

  const totals = summary?.totals;

  const quizAccuracy =
    totals && totals.quizTotal > 0
      ? Math.round((totals.quizScore / totals.quizTotal) * 100)
      : 0;

  return (
    <AppShell>
      <LiquidCard className="p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-blue-100 text-blue-700">
              <BarChart3 size={30} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Student Progress
              </p>
              <h2 className="text-2xl font-black">Learning Dashboard</h2>
              <p className="text-sm font-semibold text-slate-500">
                Real progress record for the logged-in student.
              </p>
            </div>
          </div>

          <button
            onClick={() => loadSummary(studentKey)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh Progress
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-white/80 bg-white/70 p-5 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700">
              <UserRound size={24} />
            </div>

            <div>
              <p className="text-xs font-black uppercase text-slate-500">
                Logged-in Student
              </p>
              <h3 className="text-xl font-black">
                {summary?.student?.name || studentName}
              </h3>
              <p className="text-xs font-bold text-slate-500">
                Student Key: {summary?.student?.studentKey || studentKey}
              </p>
            </div>
          </div>

          {summary?.student && (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-500">Class</p>
                <p className="text-sm font-black">
                  {summary.student.classLevel ?? "N/A"}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-500">Section</p>
                <p className="text-sm font-black">
                  {summary.student.section || "N/A"}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-500">Roll</p>
                <p className="text-sm font-black">
                  {summary.student.rollNumber || "N/A"}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-500">School</p>
                <p className="text-sm font-black">
                  {summary.student.schoolName || "N/A"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-blue-50/90 p-5 shadow-inner">
            <BookOpen className="text-blue-700" size={26} />
            <p className="mt-3 text-xs font-black text-blue-700">
              Lessons Opened
            </p>
            <p className="mt-1 text-3xl font-black">
              {totals?.lessonsOpened ?? 0}
            </p>
          </div>

          <div className="rounded-3xl bg-emerald-50/90 p-5 shadow-inner">
            <Bot className="text-emerald-700" size={26} />
            <p className="mt-3 text-xs font-black text-emerald-700">
              AI Interactions
            </p>
            <p className="mt-1 text-3xl font-black">
              {totals?.aiInteractions ?? 0}
            </p>
          </div>

          <div className="rounded-3xl bg-orange-50/90 p-5 shadow-inner">
            <ClipboardList className="text-orange-700" size={26} />
            <p className="mt-3 text-xs font-black text-orange-700">
              Quiz Attempts
            </p>
            <p className="mt-1 text-3xl font-black">
              {totals?.quizAttempts ?? 0}
            </p>
          </div>

          <div className="rounded-3xl bg-purple-50/90 p-5 shadow-inner">
            <Gamepad2 className="text-purple-700" size={26} />
            <p className="mt-3 text-xs font-black text-purple-700">
              Games Played
            </p>
            <p className="mt-1 text-3xl font-black">
              {totals?.gamesPlayed ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-inner">
            <p className="text-xs font-black uppercase text-slate-500">
              Quiz Score
            </p>
            <p className="mt-2 text-3xl font-black">
              {totals?.quizScore ?? 0}/{totals?.quizTotal ?? 0}
            </p>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${quizAccuracy}%` }}
              />
            </div>

            <p className="mt-2 text-sm font-bold text-slate-600">
              Accuracy: {quizAccuracy}%
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-inner">
            <p className="text-xs font-black uppercase text-slate-500">
              Game Score
            </p>
            <p className="mt-2 text-3xl font-black">{totals?.gameScore ?? 0}</p>
            <p className="mt-2 text-sm font-bold text-slate-600">
              Total grammar game score saved in database.
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-inner">
            <p className="text-xs font-black uppercase text-slate-500">
              Lines Selected
            </p>
            <p className="mt-2 text-3xl font-black">
              {totals?.linesSelected ?? 0}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-600">
              Total textbook lines selected for learning.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-inner">
            <p className="text-sm font-black">Recent Quiz Records</p>
            <p className="mt-2 text-3xl font-black">
              {summary?.recentQuizAttempts?.length ?? 0}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Saved in QuizAttempt table.
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-inner">
            <p className="text-sm font-black">Recent Game Records</p>
            <p className="mt-2 text-3xl font-black">
              {summary?.recentGameAttempts?.length ?? 0}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Saved in GameAttempt table.
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-inner">
            <p className="text-sm font-black">Recent AI Chats</p>
            <p className="mt-2 text-3xl font-black">
              {summary?.recentChats?.length ?? 0}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Saved in ChatMessage table.
            </p>
          </div>
        </div>
      </LiquidCard>
    </AppShell>
  );
}
