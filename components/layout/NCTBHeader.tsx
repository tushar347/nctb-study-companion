"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Home, Gamepad2, GraduationCap } from "lucide-react";

type NCTBHeaderProps = {
  children?: React.ReactNode;
};

export default function NCTBHeader({ children }: NCTBHeaderProps) {
  return (
    <header
      className="
        relative
        overflow-hidden
        rounded-[32px]
        border
        border-white/60
        bg-white/70
        p-5
        shadow-xl
        backdrop-blur-xl
      "
    >
      {/* Bangladesh gradient decoration */}
      <div
        className="
          absolute
          inset-0
          -z-10
          opacity-30
        "
        style={{
          background:
            "linear-gradient(120deg,#006a4e 0%,#006a4e 45%,#f42a41 45%,#f42a41 100%)",
        }}
      />

      <div
        className="
          flex
          flex-col
          gap-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="
              grid
              h-14
              w-14
              place-items-center
              rounded-3xl
              bg-white
              shadow-lg
            "
          >
            <GraduationCap size={30} className="text-emerald-700" />
          </div>

          <div>
            <h1
              className="
                text-xl
                font-black
                text-slate-900
              "
            >
              NCTB Study Companion
            </h1>

            <p
              className="
                text-sm
                font-bold
                text-slate-600
              "
            >
              Smart learning platform
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="
            flex
            flex-wrap
            gap-2
          "
        >
          <Link
            href="/home"
            className="
              flex
              items-center
              gap-2
              rounded-2xl
              bg-white/80
              px-4
              py-2
              text-sm
              font-black
              shadow
              transition
              hover:scale-105
            "
          >
            <Home size={16} />
            Home
          </Link>

          <Link
            href="/reader"
            className="
              flex
              items-center
              gap-2
              rounded-2xl
              bg-white/80
              px-4
              py-2
              text-sm
              font-black
              shadow
              transition
              hover:scale-105
            "
          >
            <BookOpen size={16} />
            Book
          </Link>

          <Link
            href="/games"
            className="
              flex
              items-center
              gap-2
              rounded-2xl
              bg-white/80
              px-4
              py-2
              text-sm
              font-black
              shadow
              transition
              hover:scale-105
            "
          >
            <Gamepad2 size={16} />
            Games
          </Link>
        </nav>
      </div>

      {children}
    </header>
  );
}
