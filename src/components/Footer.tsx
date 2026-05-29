import { ROBOT_GRAPHICS } from '../data/mascotGraphics';
import { classNames } from '../utils/classNames';

interface FooterProps {
  onNavigate: (path: string) => void;
  onCreateCourse: () => void;
}

const STUDY_LINKS = [
  { label: 'Active recall', path: '/study/active-recall' },
  { label: 'Spaced repetition', path: '/study/spaced-repetition' },
  { label: 'Interleaving', path: '/study/interleaving' },
  { label: 'Focused sessions', path: '/study/focused-sessions' }
];

const PRODUCT_LINKS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Create course', path: '/create' },
  { label: 'Settings', path: '/settings' }
];

export function Footer({ onNavigate, onCreateCourse }: FooterProps) {
  return (
    <footer className="border-t border-slate-200/80 bg-white/82 px-4 py-10 shadow-[0_-18px_55px_rgba(15,23,42,0.05)] backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-950/84">
      <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="group flex items-center gap-3 text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300"
            aria-label="Go to AdoLearn dashboard"
          >
            <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition group-hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-900">
              <img src={ROBOT_GRAPHICS.head} alt="" className="h-12 w-12 object-contain" />
            </span>
            <span>
              <span className="block text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">AdoLearn</span>
              <span className="block text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
                Course builder
              </span>
            </span>
          </button>
          <p className="max-w-sm text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            Turn your own notes into focused units, sections, lessons, reviews, and practice that stay stored in your browser.
          </p>
          <button
            type="button"
            onClick={onCreateCourse}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-emerald-600 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            Create a course
          </button>
        </div>

        <FooterLinkGroup title="Product" links={PRODUCT_LINKS} onNavigate={onNavigate} />
        <FooterLinkGroup title="Study techniques" links={STUDY_LINKS} onNavigate={onNavigate} />

        <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50/70 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/10">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Learn smarter</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
            The footer study pages explain practical ways to review, remember, and organize learning without crowding the homepage.
          </p>
        </div>
      </div>
      <div className="mx-auto mt-8 flex w-full max-w-7xl flex-col gap-3 border-t border-slate-200/70 pt-6 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:text-slate-400">
        <p>© {new Date().getFullYear()} AdoLearn. Built for bite-sized learning.</p>
        <p>Courses and progress are saved locally in your browser.</p>
      </div>
    </footer>
  );
}

function FooterLinkGroup({
  title,
  links,
  onNavigate
}: {
  title: string;
  links: Array<{ label: string; path: string }>;
  onNavigate: (path: string) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</h2>
      <div className="mt-4 grid gap-2">
        {links.map((link) => (
          <button
            key={link.path}
            type="button"
            onClick={() => onNavigate(link.path)}
            className={classNames(
              'w-fit rounded-full px-3 py-2 text-left text-sm font-extrabold transition',
              'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-white'
            )}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
