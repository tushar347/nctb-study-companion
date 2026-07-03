"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  GraduationCap,
  Loader2,
  School,
  UserPlus,
} from "lucide-react";
import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

type SignupResponse = {
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

export default function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    classLevel: "6",
    section: "",
    rollNumber: "",
    schoolName: "",
    guardianName: "",
    guardianPhone: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentKey, setStudentKey] = useState("");

  function updateField(name: string, value: string) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function submitSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setStudentKey("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          classLevel: Number(form.classLevel),
        }),
      });

      const data: SignupResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Signup failed.");
      }

      if (!data.student) {
        throw new Error("Student data was not returned.");
      }

      localStorage.setItem("studentKey", data.student.studentKey);
      localStorage.setItem("studentProfile", JSON.stringify(data.student));

      setStudentKey(data.student.studentKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <LiquidCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-[28px] bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-2xl">
              <UserPlus size={34} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Student Account
              </p>
              <h2 className="text-3xl font-black tracking-tight">
                Create Student Profile
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                Signup will save student information, quiz marks, game scores,
                and date-by-date study records.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-blue-50/90 p-5 shadow-inner">
            <School className="text-blue-700" size={28} />
            <h3 className="mt-3 text-xl font-black">What will be saved?</h3>
            <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
              <li>Student profile and class information</li>
              <li>Daily study activity</li>
              <li>Quiz attempts and marks</li>
              <li>Grammar game scores</li>
              <li>AI Teacher usage history</li>
            </ul>
          </div>

          {studentKey && (
            <div className="mt-5 rounded-3xl bg-emerald-50 p-5 text-emerald-800 shadow-inner">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={24} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Signup successful.</p>
                  <p className="mt-1 text-sm font-semibold">
                    Student Key: {studentKey}
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
        </LiquidCard>

        <LiquidCard className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-100 text-purple-700">
              <GraduationCap size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Signup Form</h2>
              <p className="text-sm font-semibold text-slate-500">
                Fill student details carefully.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submitSignup} className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Student Name
                </span>
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="Demo Student"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Email
                </span>
                <input
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="student@example.com"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Password
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="Minimum 6 characters"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Class
                </span>
                <select
                  value={form.classLevel}
                  onChange={(event) =>
                    updateField("classLevel", event.target.value)
                  }
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                >
                  <option value="6">Class 6</option>
                  <option value="7">Class 7</option>
                  <option value="8">Class 8</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Section
                </span>
                <input
                  value={form.section}
                  onChange={(event) =>
                    updateField("section", event.target.value)
                  }
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="A"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Roll Number
                </span>
                <input
                  value={form.rollNumber}
                  onChange={(event) =>
                    updateField("rollNumber", event.target.value)
                  }
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="12"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  School Name
                </span>
                <input
                  value={form.schoolName}
                  onChange={(event) =>
                    updateField("schoolName", event.target.value)
                  }
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="Demo School"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Guardian Name
                </span>
                <input
                  value={form.guardianName}
                  onChange={(event) =>
                    updateField("guardianName", event.target.value)
                  }
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="Guardian Name"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Guardian Phone
                </span>
                <input
                  value={form.guardianPhone}
                  onChange={(event) =>
                    updateField("guardianPhone", event.target.value)
                  }
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="01700000000"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-blue-700 to-purple-700 px-6 py-4 text-sm font-black text-white shadow-xl transition hover:scale-[1.02] disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Create Account
            </button>
          </form>

          <p className="mt-5 text-center text-sm font-semibold text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-black text-blue-700">
              Login here
            </Link>
          </p>
        </LiquidCard>
      </div>
    </AppShell>
  );
}
