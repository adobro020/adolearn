interface NotFoundPageProps {
  onGoHome: () => void;
  onCreateCourse: () => void;
}

export function NotFoundPage({ onGoHome, onCreateCourse }: NotFoundPageProps) {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] bg-white px-6 py-8 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80 sm:px-10 sm:py-12 dark:bg-slate-950 dark:ring-slate-800">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-500/10" aria-hidden="true" />
      <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-sky-100/70 blur-3xl dark:bg-sky-500/10" aria-hidden="true" />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600">404 | Page not found</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl dark:text-white">
          This page wandered off course.
        </h2>
        <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-600 dark:text-slate-300">
          The page you opened does not exist or may have moved. Head back home or create a fresh learning path.
        </p>

        <div className="mt-8 w-full max-w-2xl rounded-[2.25rem] bg-gradient-to-br from-emerald-50 to-sky-50 p-4 ring-1 ring-emerald-100 dark:from-slate-900 dark:to-slate-950 dark:ring-slate-700">
          <img
            src="/assets/robot/robot-404.png"
            alt="A puzzled robot mascot holding a 404 sign"
            className="mx-auto h-[26rem] w-full object-contain sm:h-[34rem]"
          />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onGoHome}
            className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-emerald-400 dark:text-slate-950"
          >
            Go home
          </button>
          <button
            type="button"
            onClick={onCreateCourse}
            className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
          >
            Create a course
          </button>
        </div>
      </div>
    </section>
  );
}
