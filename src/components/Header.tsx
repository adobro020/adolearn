import { NAV_ITEMS } from '../data/navigation';
import type { PageId } from '../types/navigation';
import { classNames } from '../utils/classNames';
import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

interface HeaderProps {
  activePage: string;
  onLogoClick: () => void;
  onPageChange: (pageId: PageId) => void;
}

function resolveActiveNav(activePage: string): PageId {
  if (activePage === 'create' || activePage === 'settings') {
    return activePage;
  }

  return 'dashboard';
}

export function Header({ activePage, onLogoClick, onPageChange }: HeaderProps) {
  const activeNav = resolveActiveNav(activePage);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/75 bg-white/88 px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.07)] backdrop-blur-2xl transition-colors dark:border-slate-800/80 dark:bg-slate-950/92 dark:shadow-[0_12px_40px_rgba(0,0,0,0.32)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <button
          type="button"
          onClick={onLogoClick}
          className="group flex min-w-0 items-center gap-3 text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300"
          aria-label="Go to AdoLearn homepage"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.08)] transition group-hover:border-emerald-200 group-hover:shadow-[0_14px_32px_rgba(16,185,129,0.16)] dark:border-slate-700/70 dark:bg-slate-900">
            <img src={ROBOT_GRAPHICS.head} alt="" className="h-12 w-12 object-contain" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl dark:text-white">
              AdoLearn
            </span>
            <span className="block truncate text-[0.68rem] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
              Course builder
            </span>
          </span>
        </button>

        <nav className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200/80 bg-white/75 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:gap-1.5" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeNav;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPageChange(item.id)}
                className={classNames(
                  'rounded-full px-3 py-2 text-sm font-extrabold tracking-tight transition sm:px-5',
                  isActive
                    ? 'bg-slate-950 text-white shadow-[0_10px_28px_rgba(15,23,42,0.16)] dark:bg-transparent dark:text-white dark:ring-1 dark:ring-emerald-400/55'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
