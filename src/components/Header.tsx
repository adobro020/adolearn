export function Header() {
  return (
    <header className="rounded-b-[2rem] bg-white/90 px-5 pb-6 pt-5 shadow-sm shadow-slate-200/80 ring-1 ring-white/70 backdrop-blur transition-colors md:rounded-[2rem] md:px-8 md:py-7 dark:bg-black dark:shadow-none dark:ring-zinc-700">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-[1.25rem] bg-emerald-400 text-3xl font-black text-black ring-2 ring-emerald-200 motion-safe:animate-bounce-soft" aria-hidden="true">
            ✦
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              AdoLearn
            </h1>
            <p className="mt-2 max-w-xl text-balance text-base font-semibold leading-7 text-slate-600 sm:text-lg">
              Turn anything into a bite-sized learning path.
            </p>
          </div>
        </div>
        <div className="hidden rounded-2xl px-4 py-3 text-sm font-black text-emerald-700 ring-1 ring-emerald-200 md:block dark:text-emerald-300 dark:ring-emerald-500/70">
          Learn one small win at a time
        </div>
      </div>
    </header>
  );
}
