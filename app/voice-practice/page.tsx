"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  AudioLines,
  BookOpen,
  MessageCircle,
  Mic2,
  SpellCheck2,
} from "lucide-react";

import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";

import {
  readLegacyQuizLaunchContext,
  readQuizLaunchContext,
  type QuizLaunchContextV1,
} from "@/lib/quiz/quizLaunchContext";

function practiceHref(
  route: string,
  context:
    | QuizLaunchContextV1
    | null,
) {
  if (!context) {
    return "/reader";
  }

  const parameters =
    new URLSearchParams({
      contextId:
        context.contextId,
      bookId:
        context.book.id,
      page: String(
        context.page.number,
      ),
    });

  return `${route}?${parameters.toString()}`;
}

export default function VoicePracticePage() {
  const [
    context,
    setContext,
  ] =
    useState<QuizLaunchContextV1 | null>(
      null,
    );

  useEffect(() => {
    setContext(
      readQuizLaunchContext() ??
        readLegacyQuizLaunchContext(),
    );
  }, []);

  const hasLine =
    Boolean(
      context?.selectedLine,
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <LiquidCard className="overflow-hidden p-0">
          <div className="bg-gradient-to-r from-cyan-800 via-blue-700 to-violet-700 p-6 text-white sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white/15">
                <Mic2 size={32} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                  English speaking activities
                </p>

                <h1 className="mt-1 text-4xl font-black">
                  Voice Practice
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-blue-50">
                  Listen, spell, read aloud, and answer questions using textbook words and lines.
                </p>
              </div>
            </div>
          </div>
        </LiquidCard>

        {!hasLine ? (
          <LiquidCard className="border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <BookOpen
                className="text-amber-700"
                size={22}
              />

              <div>
                <p className="font-black">
                  Choose a textbook line first
                </p>

                <p className="mt-1 text-sm font-semibold">
                  Open Reader and click an OCR-highlighted English line.
                </p>

                <Link
                  href="/reader"
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-700 px-4 py-3 font-black text-white"
                >
                  Open Reader
                  <ArrowRight size={17} />
                </Link>
              </div>
            </div>
          </LiquidCard>
        ) : (
          <LiquidCard className="p-5">
            <p className="text-xs font-black uppercase text-blue-700">
              Selected line
            </p>

            <p className="mt-3 rounded-2xl bg-blue-50 p-4 font-semibold leading-7">
              {context?.selectedLine
                ?.text}
            </p>
          </LiquidCard>
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title:
                "Voice Spelling",
              description:
                "Hear a textbook word and spell it by typing or speaking each letter.",
              href:
                "/practice/spelling",
              icon:
                SpellCheck2,
              button:
                "Start Spelling",
              style:
                "bg-cyan-700",
            },
            {
              title:
                "Read Aloud",
              description:
                "Record the selected line and compare the recognized words.",
              href:
                "/practice/read-aloud",
              icon:
                AudioLines,
              button:
                "Start Read Aloud",
              style:
                "bg-violet-700",
            },
            {
              title:
                "Speaking Practice",
              description:
                "Answer a lesson-based question using your own voice.",
              href:
                "/practice/speaking",
              icon:
                MessageCircle,
              button:
                "Start Speaking",
              style:
                "bg-orange-700",
            },
          ].map(
            (activity) => {
              const Icon =
                activity.icon;

              return (
                <LiquidCard
                  key={
                    activity.href
                  }
                  className="flex flex-col p-6"
                >
                  <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white shadow">
                    <Icon size={27} />
                  </div>

                  <h2 className="mt-5 text-2xl font-black">
                    {activity.title}
                  </h2>

                  <p className="mt-2 flex-1 text-sm font-semibold leading-7 text-slate-600">
                    {activity.description}
                  </p>

                  <Link
                    href={practiceHref(
                      activity.href,
                      context,
                    )}
                    className={`mt-6 flex items-center justify-between rounded-2xl px-5 py-4 font-black text-white ${activity.style}`}
                  >
                    {activity.button}
                    <ArrowRight size={18} />
                  </Link>
                </LiquidCard>
              );
            },
          )}
        </div>
      </div>
    </AppShell>
  );
}
