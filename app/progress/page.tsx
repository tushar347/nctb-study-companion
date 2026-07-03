"use client";

import { useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

type Summary = {
  memory: {
    openedLessons: number[];
    selectedLines: string[];
    usedTools: string[];
    weakAreas: string[];
  };
  recentChats: unknown[];
  quizAttempts: unknown[];
};

export default function ProgressPage() {
  const [studentId, setStudentId] = useState("demo-student");
  const [summary, setSummary] = useState<Summary | null>(null);

  async function loadSummary() {
    const response = await fetch(
      `/api/research/summary?studentId=${encodeURIComponent(studentId)}`,
    );
    const data = await response.json();
    setSummary(data.summary);
  }

  return (
    <AppShell>
      <LiquidCard className="p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-blue-100 text-blue-700">
              <BarChart3 size={30} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Progress</h2>
              <p className="text-sm font-semibold text-slate-500">
                Simple student activity summary.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl bg-white/65 p-4 shadow-inner md:flex-row md:items-center">
            <input
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-sm font-bold outline-none"
            />
            <button
              onClick={loadSummary}
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-lg"
            >
              <RefreshCw size={16} />
              Load
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-blue-50/90 p-5 shadow-inner">
            <p className="text-xs font-black text-blue-700">Opened Lessons</p>
            <p className="mt-1 text-3xl font-black">
              {summary?.memory.openedLessons.length ?? 0}
            </p>
          </div>

          <div className="rounded-3xl bg-emerald-50/90 p-5 shadow-inner">
            <p className="text-xs font-black text-emerald-700">
              Selected Lines
            </p>
            <p className="mt-1 text-3xl font-black">
              {summary?.memory.selectedLines.length ?? 0}
            </p>
          </div>

          <div className="rounded-3xl bg-orange-50/90 p-5 shadow-inner">
            <p className="text-xs font-black text-orange-700">Tools Used</p>
            <p className="mt-1 text-3xl font-black">
              {summary?.memory.usedTools.length ?? 0}
            </p>
          </div>

          <div className="rounded-3xl bg-purple-50/90 p-5 shadow-inner">
            <p className="text-xs font-black text-purple-700">AI Chats</p>
            <p className="mt-1 text-3xl font-black">
              {summary?.recentChats.length ?? 0}
            </p>
          </div>
        </div>
      </LiquidCard>
    </AppShell>
  );
}
