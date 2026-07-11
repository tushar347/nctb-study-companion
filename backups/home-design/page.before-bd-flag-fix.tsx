"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  Bot,
  Calculator,
  ClipboardList,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Home,
  Languages,
  LogOut,
  School,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  getStoredStudentName,
} from "@/lib/studentSession";

type ClassOption = {
  id: number;
  title: string;
  available: boolean;
};

type BookOption = {
  id: string;
  title: string;
  subtitle: string;
  available: boolean;
  icon: LucideIcon;
};

const classOptions: ClassOption[] = [
  {
    id: 6,
    title: "Class 6",
    available: true,
  },
  {
    id: 7,
    title: "Class 7",
    available: false,
  },
  {
    id: 8,
    title: "Class 8",
    available: false,
  },
];

const bookOptions: BookOption[] = [
  {
    id: "class6-english",
    title: "English For Today",
    subtitle: "Available now",
    available: true,
    icon: BookOpen,
  },
  {
    id: "class6-bangla",
    title: "Bangla",
    subtitle: "Coming soon",
    available: false,
    icon: Languages,
  },
  {
    id: "class6-mathematics",
    title: "Mathematics",
    subtitle: "Coming soon",
    available: false,
    icon: Calculator,
  },
  {
    id: "class6-science",
    title: "Science",
    subtitle: "Coming soon",
    available: false,
    icon: FlaskConical,
  },
];

function NavigationItem({
  href,
  active = false,
  icon,
  children,
}: {
  href: string;
  active?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition duration-300 ${
        active
          ? "bg-emerald-500 text-white shadow-[0_10px_25px_rgba(16,185,129,0.35)]"
          : "text-slate-800 hover:bg-white/70 hover:text-emerald-700"
      }`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function StepHeading({
  step,
  title,
  description,
  icon,
}: {
  step: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 shadow-[0_12px_30px_rgba(217,159,26,0.22)]">
        {icon}
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-wide text-amber-700">
          {step}
        </p>

        <h2 className="mt-1 text-2xl font-black text-slate-950">
          {title}
        </h2>

        <p className="mt-2 text-sm font-medium text-slate-600">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [studentName, setStudentName] =
    useState("Student");

  const [selectedClass, setSelectedClass] =
    useState(6);

  const [selectedBook, setSelectedBook] =
    useState("class6-english");

  useEffect(() => {
    setStudentName(
      getStoredStudentName() || "Student",
    );

    const storedClass = Number(
      localStorage.getItem(
        "selectedClass",
      ) ?? 6,
    );

    const storedBook =
      localStorage.getItem(
        "selectedBookId",
      ) ?? "class6-english";

    if (storedClass === 6) {
      setSelectedClass(storedClass);
    }

    if (
      bookOptions.some(
        (book) =>
          book.id === storedBook &&
          book.available,
      )
    ) {
      setSelectedBook(storedBook);
    }
  }, []);

  function continueToReader() {
    const activeBook =
      bookOptions.find(
        (book) =>
          book.id === selectedBook,
      );

    localStorage.setItem(
      "selectedClass",
      String(selectedClass),
    );

    localStorage.setItem(
      "selectedBookId",
      selectedBook,
    );

    localStorage.setItem(
      "selectedBookTitle",
      activeBook?.title ??
        "English For Today",
    );

    router.push("/reader");
  }

  function logout() {
    localStorage.clear();
    router.push("/");
  }

  return (
    <main
      className="min-h-screen overflow-hidden px-4 py-5 text-slate-950 sm:px-6 lg:px-8"
      style={{
        background:
          "radial-gradient(circle at 8% 10%, rgba(110,231,183,0.32), transparent 28%), radial-gradient(circle at 92% 30%, rgba(253,164,175,0.30), transparent 30%), radial-gradient(circle at 50% 95%, rgba(167,243,208,0.22), transparent 32%), linear-gradient(135deg, #f8fffc 0%, #fffdfa 50%, #fff8f8 100%)",
      }}
    >
      <div className="mx-auto max-w-[1160px] space-y-5">
        <header className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/55 p-4 shadow-[0_25px_70px_rgba(63,89,75,0.16)] backdrop-blur-2xl sm:p-5">
          <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/25 blur-3xl" />

          <div className="pointer-events-none absolute left-[48%] top-[-120px] h-[300px] w-[300px] rounded-full border-[4px] border-red-400/35 bg-red-300/20 blur-[1px]" />

          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-emerald-500/25 blur-3xl" />

          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative grid h-[74px] w-[74px] shrink-0 place-items-center rounded-full border-4 border-amber-300 bg-gradient-to-br from-amber-100 via-white to-emerald-100 text-emerald-800 shadow-[0_12px_35px_rgba(49,118,84,0.28)]">
                  <BookOpen size={35} strokeWidth={2.3} />

                  <span className="absolute -bottom-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">
                    NCTB
                  </span>
                </div>

                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-slate-900">
                    NCTB AI Study Companion
                  </p>

                  <h1 className="mt-1 text-2xl font-black leading-none text-slate-950 sm:text-3xl">
                    Personalized English Learning
                  </h1>

                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Read, ask, practice, play, and improve with your AI Teacher.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/80 bg-white/60 px-4 py-3 shadow-lg backdrop-blur-xl">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <UserRound size={20} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Student
                    </p>

                    <p className="truncate text-sm font-black text-slate-950">
                      {studentName}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white/70 px-5 py-4 text-sm font-black text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <LogOut size={17} />
                  Logout
                </button>
              </div>
            </div>

            <nav className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/80 bg-white/55 p-1.5 shadow-inner backdrop-blur-xl">
              <NavigationItem
                href="/home"
                active
                icon={<Home size={16} />}
              >
                Home
              </NavigationItem>

              <NavigationItem
                href="/reader"
                icon={<BookOpen size={16} />}
              >
                Reader
              </NavigationItem>

              <NavigationItem
                href="/teacher"
                icon={<Bot size={16} />}
              >
                AI Teacher
              </NavigationItem>

              <NavigationItem
                href="/quiz"
                icon={
                  <ClipboardList size={16} />
                }
              >
                Quiz
              </NavigationItem>

              <NavigationItem
                href="/games"
                icon={<Gamepad2 size={16} />}
              >
                Games
              </NavigationItem>

              <NavigationItem
                href="/progress"
                icon={<BarChart3 size={16} />}
              >
                Progress
              </NavigationItem>
            </nav>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[0.92fr_1.15fr]">
          <div className="rounded-[30px] border border-white/80 bg-white/68 p-5 shadow-[0_24px_65px_rgba(67,88,76,0.13)] backdrop-blur-2xl sm:p-6">
            <StepHeading
              step="Step 1"
              title="Choose Class"
              description="Start with your class level."
              icon={<School size={27} />}
            />

            <div className="mt-6 space-y-4">
              {classOptions.map(
                (classItem) => {
                  const selected =
                    selectedClass ===
                    classItem.id;

                  return (
                    <button
                      type="button"
                      key={classItem.id}
                      disabled={
                        !classItem.available
                      }
                      onClick={() =>
                        setSelectedClass(
                          classItem.id,
                        )
                      }
                      className={`w-full rounded-[24px] border px-5 py-5 text-left transition duration-300 ${
                        selected
                          ? "border-emerald-400/60 bg-gradient-to-r from-emerald-100 to-emerald-400/70 text-slate-950 shadow-[0_13px_30px_rgba(16,185,129,0.25)]"
                          : "border-slate-200/80 bg-gradient-to-r from-slate-100 to-slate-300/80 text-slate-700"
                      } ${
                        classItem.available
                          ? "hover:-translate-y-1 hover:shadow-xl"
                          : "cursor-not-allowed opacity-75"
                      }`}
                      aria-pressed={selected}
                    >
                      <p className="text-xl font-black">
                        {classItem.title}
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {classItem.available
                          ? "Available"
                          : "Coming soon"}
                      </p>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/80 bg-white/68 p-5 shadow-[0_24px_65px_rgba(67,88,76,0.13)] backdrop-blur-2xl sm:p-6">
            <StepHeading
              step="Step 2"
              title="Choose Book"
              description="Select a subject book to continue."
              icon={
                <BookMarked size={27} />
              }
            />

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {bookOptions.map(
                (book) => {
                  const BookIcon =
                    book.icon;

                  const selected =
                    selectedBook ===
                    book.id;

                  return (
                    <button
                      type="button"
                      key={book.id}
                      disabled={!book.available}
                      onClick={() =>
                        setSelectedBook(
                          book.id,
                        )
                      }
                      className={`group min-h-[116px] rounded-[24px] border p-5 text-left transition duration-300 ${
                        selected
                          ? "border-emerald-500 bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-[0_18px_38px_rgba(5,150,105,0.28)]"
                          : "border-slate-200/80 bg-gradient-to-br from-slate-100 to-slate-300/90 text-slate-600"
                      } ${
                        book.available
                          ? "hover:-translate-y-1 hover:shadow-2xl"
                          : "cursor-not-allowed opacity-80"
                      }`}
                      aria-pressed={selected}
                    >
                      <BookIcon
                        size={27}
                        className={
                          selected
                            ? "text-white"
                            : "text-slate-500"
                        }
                      />

                      <p className="mt-4 text-lg font-black">
                        {book.title}
                      </p>

                      <p
                        className={`mt-1 text-sm font-medium ${
                          selected
                            ? "text-emerald-50"
                            : "text-slate-500"
                        }`}
                      >
                        {book.subtitle}
                      </p>
                    </button>
                  );
                },
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <GraduationCap
                  size={17}
                  className="text-emerald-700"
                />

                Class {selectedClass} learning workspace
              </div>

              <button
                type="button"
                onClick={continueToReader}
                disabled={
                  selectedClass !== 6 ||
                  selectedBook !==
                    "class6-english"
                }
                className="group flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-950 shadow-[0_12px_26px_rgba(51,65,85,0.18)] transition hover:-translate-y-1 hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to Reader

                <ArrowRight
                  size={17}
                  className="transition group-hover:translate-x-1"
                />
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-4 left-4 hidden h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-600 text-sm font-black text-white shadow-xl sm:grid">
        N
      </div>
    </main>
  );
}