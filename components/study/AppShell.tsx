"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Gamepad2,
  GraduationCap,
  Home,
  LogOut,
  UserRound,
} from "lucide-react";

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/reader", label: "Reader", icon: BookOpen },
  { href: "/teacher", label: "AI Teacher", icon: GraduationCap },
  { href: "/quiz", label: "Quiz", icon: ClipboardList },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];

type StudentProfile = {
  studentKey?: string;
  name?: string | null;
  classLevel?: number | null;
  schoolName?: string | null;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [student, setStudent] = useState<StudentProfile | null>(null);

  useEffect(() => {
    const savedProfile = localStorage.getItem("studentProfile");

    if (savedProfile) {
      try {
        setStudent(JSON.parse(savedProfile));
      } catch {
        setStudent(null);
      }
    }
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    localStorage.removeItem("studentKey");
    localStorage.removeItem("studentProfile");
    localStorage.removeItem("selectedLine");
    localStorage.removeItem("selectedLessonNo");
    localStorage.removeItem("selectedLessonTitle");

    router.push("/");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eaf4ff] px-3 py-5 text-slate-900 md:px-6">
      <div className="pointer-events-none fixed left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none fixed right-[-140px] top-24 h-96 w-96 rounded-full bg-blue-400/30 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-160px] left-1/3 h-96 w-96 rounded-full bg-violet-300/30 blur-3xl" />

      <section className="relative mx-auto max-w-7xl">
        <header className="rounded-[34px] border border-white/60 bg-white/45 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-2xl md:p-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-2xl">
                  <BookOpen size={30} strokeWidth={2.4} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                    NCTB AI Study Companion
                  </p>
                  <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                    Personalized English Learning
                  </h1>
                  <p className="text-sm font-semibold text-slate-500">
                    Read, ask, practice, play, and improve with your AI Teacher.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 rounded-3xl border border-white/70 bg-white/65 px-4 py-3 shadow-inner">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                    <UserRound size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">
                      Student
                    </p>
                    <p className="text-sm font-black">
                      {student?.name || "Logged in"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-md transition hover:scale-[1.02]"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>

            <nav className="flex flex-wrap gap-2 rounded-3xl border border-white/70 bg-white/55 p-2 shadow-inner backdrop-blur-xl">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black transition ${
                      active
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-slate-600 hover:bg-white/80"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
