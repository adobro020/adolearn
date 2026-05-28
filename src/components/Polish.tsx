import type { ReactNode } from 'react';
import { classNames } from '../utils/classNames';

interface ProgressBarProps {
  value: number;
  label?: string;
  tone?: 'emerald' | 'amber' | 'sky' | 'violet' | 'rose';
  size?: 'sm' | 'md' | 'lg';
}

const toneGradient: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  emerald: 'from-emerald-400 via-teal-400 to-sky-400',
  amber: 'from-amber-300 via-orange-400 to-rose-400',
  sky: 'from-sky-400 via-cyan-400 to-emerald-400',
  violet: 'from-violet-400 via-fuchsia-400 to-rose-400',
  rose: 'from-rose-400 via-orange-400 to-amber-300'
};

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function ProgressBar({ value, label, tone = 'emerald', size = 'md' }: ProgressBarProps) {
  const safeValue = clampPercentage(value);

  return (
    <div aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
      <div
        className={classNames(
          'overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200',
          size === 'sm' && 'h-2',
          size === 'md' && 'h-3',
          size === 'lg' && 'h-4'
        )}
      >
        <div
          className={classNames(
            'h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out',
            toneGradient[tone]
          )}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  label: string;
  caption?: string;
  size?: number;
}

export function ProgressRing({ value, label, caption, size = 88 }: ProgressRingProps) {
  const safeValue = clampPercentage(value);
  const background = `conic-gradient(#10b981 ${safeValue * 3.6}deg, #e2e8f0 0deg)`;

  return (
    <div className="flex items-center gap-3">
      <div
        className="grid shrink-0 place-items-center rounded-full p-2 shadow-inner shadow-slate-200"
        style={{ width: size, height: size, background }}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-white text-sm font-black text-slate-950">
          {safeValue}%
        </div>
      </div>
      <div>
        <p className="text-sm font-black text-slate-950">{label}</p>
        {caption ? <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{caption}</p> : null}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, message, children }: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border-2 border-dashed border-slate-200 bg-white p-6 text-center shadow-sm shadow-slate-200/70">
      <div className="absolute -left-12 -top-12 h-28 w-28 rounded-full bg-emerald-100 blur-2xl" />
      <div className="absolute -bottom-12 -right-12 h-28 w-28 rounded-full bg-sky-100 blur-2xl" />
      <div className="relative">
        <p className="text-5xl motion-safe:animate-bounce-soft" aria-hidden="true">
          {icon}
        </p>
        <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-600">{message}</p>
        {children ? <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">{children}</div> : null}
      </div>
    </div>
  );
}

interface NoticeBannerProps {
  tone: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: ReactNode;
  role?: 'status' | 'alert';
}

const noticeStyles: Record<NoticeBannerProps['tone'], string> = {
  success: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
  error: 'bg-rose-50 text-rose-900 ring-rose-100',
  warning: 'bg-amber-50 text-amber-950 ring-amber-100',
  info: 'bg-sky-50 text-sky-950 ring-sky-100'
};

const noticeIcons: Record<NoticeBannerProps['tone'], string> = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i'
};

export function NoticeBanner({ tone, title, children, role = tone === 'error' ? 'alert' : 'status' }: NoticeBannerProps) {
  return (
    <div className={classNames('flex gap-3 rounded-2xl p-4 text-sm font-bold leading-6 ring-1', noticeStyles[tone])} role={role}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/80 text-sm font-black shadow-sm" aria-hidden="true">
        {noticeIcons[tone]}
      </span>
      <div className="min-w-0">
        {title ? <p className="font-black text-slate-950">{title}</p> : null}
        <div className="whitespace-pre-line">{children}</div>
      </div>
    </div>
  );
}

interface SkeletonBlockProps {
  lines?: number;
  className?: string;
}

export function SkeletonBlock({ lines = 3, className }: SkeletonBlockProps) {
  return (
    <div className={classNames('rounded-[2rem] bg-white p-5 ring-1 ring-slate-200', className)} aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="h-3 animate-pulse rounded-full bg-slate-200"
            style={{ width: `${92 - index * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center overflow-hidden" aria-hidden="true">
      <div className="relative h-28 w-72">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="absolute h-3 w-2 rounded-sm motion-safe:animate-confetti"
            style={{
              left: `${8 + index * 5}%`,
              backgroundColor: ['#10b981', '#38bdf8', '#f59e0b', '#a855f7', '#fb7185'][index % 5],
              animationDelay: `${index * 55}ms`,
              transform: `rotate(${index * 23}deg)`
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  return (
    <span key={`${prefix}${value}${suffix}`} className="inline-block motion-safe:animate-pop-in">
      {prefix}{value}{suffix}
    </span>
  );
}
