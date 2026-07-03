"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LogIn, UserRound } from "lucide-react";
import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

type LoginResponse = {
  success?: boolean;
  error?: string;
  student?: {
    studentKey: string;
    email: string;
    name: string;
    classLevel: number;
    section?: string;
    rollNumber?: string;
    schoolName?: string;
    guardianName?: string;
    guardianPhone?: string;
  };
};

export default function LoginPage() {
  const [email, setEmail] = useState("demo@student.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("");

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setStudentName("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Login failed.");
      }

      if (!data.student) {
        throw new Error("Student data was not returned.");
      }

      localStorage.setItem("studentKey", data.student.studentKey);
      localStorage.setItem("studentProfile", JSON.stringify(data.student));

      setStudentName(data.student.name ?? "Student");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <LiquidCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-[28px] bg-gradient-to-br from-slate-950 to-blue-700 text-white shadow-2xl">
              <LogIn size={34} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Student Login
              </p>
              <h2 className="text-3xl font-black tracking-tight">
                Continue Learning
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                Login to connect quiz marks, game scores, and study progress to
                your student profile.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {studentName && (
            <div className="mt-5 rounded-3xl bg-emerald-50 p-5 text-emerald-800 shadow-inner">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={24} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Login successful.</p>
                  <p className="mt-1 text-sm font-semibold">
                    Welcome back, {studentName}.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/reader"
                      className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white"
                    >
                      Go to Reader
                    </Link>
                    <Link
                      href="/progress"
                      className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
                    >
                      View Progress
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={submitLogin} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-slate-500">
                Email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                placeholder="student@example.com"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-slate-500">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                placeholder="Password"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-slate-950 to-blue-700 px-6 py-4 text-sm font-black text-white shadow-xl transition hover:scale-[1.02] disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Login
            </button>
          </form>

          <div className="mt-6 rounded-3xl bg-white/65 p-5 shadow-inner">
            <div className="flex items-start gap-3">
              <UserRound size={22} className="mt-0.5 text-blue-700" />
              <div>
                <p className="font-black">New student?</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Create a profile first, then your study records will be saved
                  date by date.
                </p>

                <Link
                  href="/signup"
                  className="mt-4 inline-flex rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </LiquidCard>
      </div>
    </AppShell>
  );
}
