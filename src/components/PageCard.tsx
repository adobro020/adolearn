import type { ReactNode } from 'react';

interface PageCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200/70 bg-white/88 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] backdrop-blur-sm transition duration-200 sm:p-7 dark:border-slate-700/45 dark:bg-slate-950/78 dark:shadow-[0_18px_55px_rgba(0,0,0,0.26)]">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl dark:text-white">
          {title}
        </h2>
        <p className="max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-base dark:text-slate-300">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
