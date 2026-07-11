"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  School,
  Sparkles,
  UserRound,
} from "lucide-react";

type AuthMode = "login" | "signup";

type Student = {
  studentKey: string;
  email: string;
  name: string;
  classLevel?: number;
  section?: string;
  rollNumber?: string;
  schoolName?: string;
  guardianName?: string;
  guardianPhone?: string;
};

type AuthResponse = {
  success?: boolean;
  error?: string;
  student?: Student;
};

export default function AuthEntryPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [loginForm, setLoginForm] = useState({
    email: "demo@student.com",
    password: "123456",
  });

  const [signupForm, setSignupForm] = useState({
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

  function saveStudentAndEnter(student: Student) {
    localStorage.setItem("studentKey", student.studentKey);
    localStorage.setItem("studentProfile", JSON.stringify(student));

    router.push("/home");
    router.refresh();
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data: AuthResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Login failed.");
      }

      if (!data.student) {
        throw new Error("Student data was not returned.");
      }

      saveStudentAndEnter(data.student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...signupForm,
          classLevel: Number(signupForm.classLevel),
        }),
      });

      const data: AuthResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Signup failed.");
      }

      if (!data.student) {
        throw new Error("Student data was not returned.");
      }

      saveStudentAndEnter(data.student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eaf4ff] px-4 py-6 text-slate-900">
      <div className="pointer-events-none fixed left-[-140px] top-[-120px] h-96 w-96 rounded-full bg-cyan-300/50 blur-3xl" />
      <div className="pointer-events-none fixed right-[-160px] top-16 h-[520px] w-[520px] rounded-full bg-blue-500/25 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-180px] left-1/3 h-[460px] w-[460px] rounded-full bg-purple-400/25 blur-3xl" />

      <section className="relative mx-auto grid min-h-[calc(100vh-48px)] max-w-7xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[42px] border border-white/60 bg-white/45 p-6 shadow-[0_30px_100px_rgba(15,23,42,0.18)] backdrop-blur-2xl md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-blue-700 shadow-inner">
            <Sparkles size={15} />
            Personalized AI Learning Platform
          </div>

          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
            Learn English with your own{" "}
            <span className="bg-gradient-to-r from-blue-700 via-purple-700 to-cyan-600 bg-clip-text text-transparent">
              AI Teacher
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600 md:text-lg">
            Read NCTB textbook lines, ask your AI Teacher, play grammar games,
            take quizzes, and save your daily study progress automatically.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/70 bg-white/65 p-5 shadow-xl">
              <BookOpen className="text-blue-700" size={30} />
              <p className="mt-4 text-lg font-black">Textbook Reader</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Learn line by line from lessons.
              </p>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/65 p-5 shadow-xl">
              <GraduationCap className="text-purple-700" size={30} />
              <p className="mt-4 text-lg font-black">AI Teacher</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Get explanation, Bangla meaning, and grammar help.
              </p>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/65 p-5 shadow-xl">
              <CheckCircle2 className="text-emerald-700" size={30} />
              <p className="mt-4 text-lg font-black">Progress Saved</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Quiz marks and game scores stay connected.
              </p>
            </div>
          </div>

          <div className="relative mt-8 overflow-hidden rounded-[36px] border border-white/70 bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 p-6 text-white shadow-2xl">
            <div className="absolute right-[-40px] top-[-40px] h-40 w-40 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute bottom-[-70px] left-[-60px] h-48 w-48 rounded-full bg-cyan-300/20 blur-2xl" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
              <div className="grid h-24 w-24 place-items-center rounded-[34px] border border-white/30 bg-white/20 shadow-2xl backdrop-blur-xl">
                <Bot size={52} />
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-wide text-cyan-100">
                  Meet your AI Teacher
                </p>
                <h2 className="mt-1 text-3xl font-black">
                  Friendly, personal, and always ready to explain.
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-blue-50">
                  The AI Teacher helps students understand difficult textbook
                  lines, grammar patterns, sentence order, and vocabulary
                  through simple language.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[42px] border border-white/60 bg-white/55 p-5 shadow-[0_30px_100px_rgba(15,23,42,0.18)] backdrop-blur-2xl md:p-6">
          <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/70 bg-white/60 p-2 shadow-inner">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                mode === "login"
                  ? "bg-slate-950 text-white shadow-lg"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              Login
            </button>

            <button
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                mode === "signup"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              Signup
            </button>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-xl">
              {mode === "login" ? (
                <LockKeyhole size={28} />
              ) : (
                <UserRound size={28} />
              )}
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                {mode === "login" ? "Welcome back" : "Create profile"}
              </p>
              <h2 className="text-3xl font-black">
                {mode === "login" ? "Student Login" : "Student Signup"}
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                {mode === "login"
                  ? "Enter your account to continue learning."
                  : "Register once to save learning records."}
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Email
                </span>
                <div className="flex items-center gap-3 rounded-3xl border border-white/80 bg-white/80 px-4 py-3 shadow-inner">
                  <Mail size={18} className="text-slate-500" />
                  <input
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-sm font-bold outline-none"
                    placeholder="student@example.com"
                  />
                </div>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Password
                </span>
                <div className="flex items-center gap-3 rounded-3xl border border-white/80 bg-white/80 px-4 py-3 shadow-inner">
                  <LockKeyhole size={18} className="text-slate-500" />
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((previous) => ({
                        ...previous,
                        password: event.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-sm font-bold outline-none"
                    placeholder="Password"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-slate-950 to-blue-700 px-6 py-4 text-sm font-black text-white shadow-xl transition hover:scale-[1.02] disabled:opacity-60"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Enter Learning Space
              </button>
            </form>
          ) : (
            <form onSubmit={submitSignup} className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Student Name
                  </span>
                  <input
                    value={signupForm.name}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
                    placeholder="Student name"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Email
                  </span>
                  <input
                    value={signupForm.email}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
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
                    value={signupForm.password}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        password: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
                    placeholder="Min 6 chars"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Class
                  </span>
                  <select
                    value={signupForm.classLevel}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        classLevel: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
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
                    value={signupForm.section}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        section: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
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
                    value={signupForm.rollNumber}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        rollNumber: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
                    placeholder="12"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-slate-500">
                    School Name
                  </span>
                  <input
                    value={signupForm.schoolName}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        schoolName: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
                    placeholder="School name"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Guardian Name
                  </span>
                  <input
                    value={signupForm.guardianName}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        guardianName: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
                    placeholder="Guardian name"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Guardian Phone
                  </span>
                  <input
                    value={signupForm.guardianPhone}
                    onChange={(event) =>
                      setSignupForm((previous) => ({
                        ...previous,
                        guardianPhone: event.target.value,
                      }))
                    }
                    className="rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-bold outline-none shadow-inner focus:border-blue-500"
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
                Create Account & Enter
              </button>
            </form>
          )}

          <div className="mt-6 rounded-3xl bg-blue-50/90 p-5 shadow-inner">
            <div className="flex items-start gap-3">
              <School size={22} className="mt-0.5 text-blue-700" />
              <div>
                <p className="font-black">Protected learning space</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                  Students must login or signup before entering Reader, AI
                  Teacher, Quiz, Games, or Progress.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
