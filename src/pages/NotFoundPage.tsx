import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

interface NotFoundPageProps {
  onGoHome: () => void;
  onCreateCourse: () => void;
}

export function NotFoundPage({ onGoHome, onCreateCourse }: NotFoundPageProps) {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] bg-white p-6 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80 sm:p-10 dark:bg-slate-950 dark:ring-slate-800">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-500/10" aria-hidden="true" />
      <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-sky-100/70 blur-3xl dark:bg-sky-500/10" aria-hidden="true" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600">404 · Page not found</p>
          <h2 className="mt-3 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl dark:text-white">
            This lesson path wandered off course.
          </h2>
          <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-slate-600 dark:text-slate-300">
            The page you opened does not exist, moved, or needs a different course link. Head back home or create a fresh learning path.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
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

        <div className="rounded-[2rem] bg-gradient-to-br from-emerald-50 to-sky-50 p-4 ring-1 ring-emerald-100 dark:from-slate-900 dark:to-slate-950 dark:ring-slate-700">
          <img
            src={ROBOT_GRAPHICS.teacher}
            alt="A friendly robot mascot pointing to a lesson board"
            className="mx-auto h-80 w-full object-contain"
          />
        </div>
      </div>
    </section>
  );
}
