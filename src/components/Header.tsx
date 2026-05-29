import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

interface HeaderProps {
  onLogoClick: () => void;
}

export function Header({ onLogoClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 rounded-b-[2rem] bg-white/88 px-5 py-4 shadow-sm shadow-slate-200/70 ring-1 ring-white/70 backdrop-blur-xl transition-colors md:top-4 md:rounded-[2rem] md:px-8 dark:bg-slate-950/86 dark:shadow-none dark:ring-slate-800/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <button
          type="button"
          onClick={onLogoClick}
          className="group flex items-center gap-4 rounded-2xl text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300"
          aria-label="Go to AdoLearn homepage"
        >
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-[1.25rem] bg-white/80 shadow-sm ring-1 ring-slate-200 transition group-hover:ring-emerald-200 dark:bg-slate-900 dark:ring-slate-700">
            <img src={ROBOT_GRAPHICS.head} alt="" className="h-14 w-14 object-contain" />
          </span>
          <span className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
            AdoLearn
          </span>
        </button>
      </div>
    </header>
  );
}
