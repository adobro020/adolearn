import type { ReactNode } from 'react';

interface PageCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80 transition duration-200 sm:p-7 dark:bg-slate-950 dark:shadow-none dark:ring-zinc-800">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-600">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
