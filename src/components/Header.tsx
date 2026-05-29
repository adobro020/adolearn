export function Header() {
  return (
    <header className="rounded-b-[2rem] bg-white/85 px-5 pb-6 pt-5 shadow-sm shadow-slate-200/80 ring-1 ring-white/70 backdrop-blur transition-colors md:rounded-[2rem] md:px-8 md:py-7 dark:bg-black dark:shadow-none dark:ring-zinc-800">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            AdoLearn
          </h1>
          <p className="mt-2 max-w-xl text-balance text-base font-medium leading-7 text-slate-600 sm:text-lg">
            Turn anything into a bite-sized learning path.
          </p>
        </div>
      </div>
    </header>
  );
}
