export default function NCTBHeader() {
  return (
    <header className="rounded-2xl border border-emerald-200 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            NCTB Study Companion
          </p>
          <h2 className="text-xl font-bold text-slate-800">
            English Learning Assistant
          </h2>
        </div>
        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          AI Ready
        </div>
      </div>
    </header>
  );
}
