import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

export function Header() {
  return (
    <header className="sticky top-0 z-30 rounded-b-[2rem] bg-white/90 px-5 py-4 shadow-sm shadow-slate-200/80 ring-1 ring-white/70 backdrop-blur transition-colors md:top-4 md:rounded-[2rem] md:px-8 dark:bg-black/95 dark:shadow-none dark:ring-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center gap-4">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-[1.25rem] bg-white/80 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800" aria-hidden="true">
          <img src={ROBOT_GRAPHICS.head} alt="" className="h-14 w-14 object-contain" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          AdoLearn
        </h1>
      </div>
    </header>
  );
}
