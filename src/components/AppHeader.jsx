import { CalendarDays, Database } from "lucide-react";

export default function AppHeader({ courseCount }) {
  return (
    <header className="border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex min-w-0 max-w-[1500px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint-400 text-ink-950 shadow-[0_0_24px_rgba(88,221,184,.18)]">
            <CalendarDays size={20} strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold tracking-tight text-white">SEU Routine</p>
            <p className="text-xs text-slate-500">Advising companion</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {courseCount > 0 && (
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-xs text-slate-300 sm:flex">
              <Database size={13} className="text-mint-400" />
              {courseCount} sections saved
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
