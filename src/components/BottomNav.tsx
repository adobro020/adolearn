import { NAV_ITEMS } from '../data/navigation';
import type { PageId } from '../types/navigation';
import { classNames } from '../utils/classNames';

interface BottomNavProps {
  activePage: PageId;
  onPageChange: (pageId: PageId) => void;
}

export function BottomNav({ activePage, onPageChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-20 rounded-[1.6rem] border border-white/70 bg-white/82 p-2 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-2xl md:sticky md:bottom-auto md:mx-auto md:mt-6 md:max-w-xl dark:border-slate-700/55 dark:bg-slate-950/86 dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-3 gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activePage;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPageChange(item.id)}
              className={classNames(
                'flex min-h-14 flex-col items-center justify-center rounded-2xl px-3 py-2 text-xs font-extrabold tracking-tight transition md:min-h-12 md:flex-row md:gap-2 md:text-sm',
                isActive
                  ? 'bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] md:bg-slate-950 md:text-white dark:bg-emerald-400 dark:text-slate-950 dark:shadow-[0_12px_28px_rgba(52,211,153,0.16)]'
                  : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-950 md:text-slate-500 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span aria-hidden="true" className="text-lg md:text-base">
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
