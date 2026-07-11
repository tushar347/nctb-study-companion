"use client";

import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Layers3,
  LibraryBig,
  School,
} from "lucide-react";
import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

const classes = [
  { id: 6, label: "Class 6", status: "Available", active: true },
  { id: 7, label: "Class 7", status: "Coming soon", active: false },
  { id: 8, label: "Class 8", status: "Coming soon", active: false },
];

const books = [
  {
    id: "english",
    title: "English For Today",
    status: "Available now",
    active: true,
    icon: BookOpen,
  },
  {
    id: "bangla",
    title: "Bangla",
    status: "Coming soon",
    active: false,
    icon: LibraryBig,
  },
  {
    id: "math",
    title: "Mathematics",
    status: "Coming soon",
    active: false,
    icon: Layers3,
  },
  {
    id: "science",
    title: "Science",
    status: "Coming soon",
    active: false,
    icon: GraduationCap,
  },
];

export default function HomePage() {
  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <LiquidCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-blue-100 text-blue-700">
              <School size={30} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Step 1
              </p>
              <h2 className="text-2xl font-black">Choose Class</h2>
              <p className="text-sm font-semibold text-slate-500">
                Start with your class level.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {classes.map((item) => (
              <button
                key={item.id}
                disabled={!item.active}
                className={`rounded-3xl border p-5 text-left shadow-md transition ${
                  item.active
                    ? "border-blue-400 bg-blue-600 text-white hover:scale-[1.02]"
                    : "border-white/70 bg-white/55 text-slate-400"
                }`}
              >
                <p className="text-xl font-black">{item.label}</p>
                <p className="text-sm font-bold">{item.status}</p>
              </button>
            ))}
          </div>
        </LiquidCard>

        <LiquidCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-emerald-100 text-emerald-700">
              <LibraryBig size={30} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Step 2
              </p>
              <h2 className="text-2xl font-black">Choose Book</h2>
              <p className="text-sm font-semibold text-slate-500">
                Select a subject book to continue.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {books.map((book) => {
              const Icon = book.icon;

              return (
                <button
                  key={book.id}
                  disabled={!book.active}
                  className={`rounded-3xl border p-5 text-left shadow-md transition ${
                    book.active
                      ? "border-emerald-300 bg-emerald-50 hover:scale-[1.02]"
                      : "border-white/70 bg-white/55 opacity-60"
                  }`}
                >
                  <Icon size={28} className="text-emerald-700" />
                  <p className="mt-3 text-lg font-black">{book.title}</p>
                  <p className="text-sm font-bold text-slate-500">
                    {book.status}
                  </p>
                </button>
              );
            })}
          </div>

          <Link
            href="/reader"
            className="mt-6 inline-flex rounded-3xl bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-xl transition hover:scale-[1.02]"
          >
            Continue to Reader
          </Link>
        </LiquidCard>
      </div>
    </AppShell>
  );
}
