import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

interface HeaderProps {
  onLogoClick: () => void;
}

export function Header({ onLogoClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 rounded-b-[2rem] border border-white/70 bg-white/82 px-5 py-4 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-colors md:top-4 md:rounded-[2rem] md:px-8 dark:border-slate-700/45 dark:bg-slate-950/82 dark:shadow-[0_18px_70px_rgba(0,0,0,0.28)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <button
          type="button"
          onClick={onLogoClick}
          className="group flex items-center gap-4 rounded-2xl text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300"
          aria-label="Go to AdoLearn homepage"
        >
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition group-hover:border-emerald-200 group-hover:shadow-[0_16px_36px_rgba(16,185,129,0.16)] dark:border-slate-700/70 dark:bg-slate-900">
            <img src={ROBOT_GRAPHICS.head} alt="" className="h-14 w-14 object-contain" />
          </span>
          <span className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl dark:text-white">
            AdoLearn
          </span>
        </button>
      </div>
    </header>
  );
}
