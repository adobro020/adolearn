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
      className="fixed inset-x-3 bottom-3 z-20 rounded-3xl bg-slate-950/90 p-2 shadow-2xl shadow-slate-900/25 backdrop-blur md:sticky md:bottom-auto md:mx-auto md:mt-6 md:max-w-xl md:bg-white/80 md:ring-1 md:ring-slate-200"
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
                'flex min-h-14 flex-col items-center justify-center rounded-2xl px-3 py-2 text-xs font-extrabold transition md:min-h-12 md:flex-row md:gap-2 md:text-sm',
                isActive
                  ? 'bg-white text-emerald-700 shadow-sm md:bg-emerald-600 md:text-white'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white md:text-slate-500 md:hover:bg-slate-100 md:hover:text-slate-900'
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
