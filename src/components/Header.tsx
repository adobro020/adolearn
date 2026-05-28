export function Header() {
  return (
    <header className="rounded-b-[2rem] bg-white/85 px-5 pb-8 pt-6 shadow-sm shadow-slate-200/80 ring-1 ring-white/70 backdrop-blur md:rounded-[2rem] md:px-8 md:pt-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <span aria-hidden="true">🌱</span>
            Vercel-ready learning studio
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              AdoLearn
            </h1>
            <p className="mt-2 max-w-xl text-balance text-base font-medium leading-7 text-slate-600 sm:text-lg">
              Turn anything into a bite-sized learning path.
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-400 to-sky-400 p-1 shadow-lg shadow-emerald-200/60 motion-safe:animate-float-slow">
          <div className="rounded-[1.35rem] bg-white px-5 py-4 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
              Phase 15
            </p>
            <p className="text-lg font-black text-slate-900">Polished</p>
          </div>
        </div>
      </div>
    </header>
  );
}
