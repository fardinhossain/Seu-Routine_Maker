import { forwardRef } from "react";
import { CalendarRange } from "lucide-react";
import { formatTime12, WEEK_DAYS, timeToMinutes } from "../lib/routine";

const CARD_STYLES = [
  "border-cyan-300/20 bg-cyan-300/[.09] text-cyan-100",
  "border-violet-300/20 bg-violet-300/[.09] text-violet-100",
  "border-amber-300/20 bg-amber-300/[.09] text-amber-100",
  "border-emerald-300/20 bg-emerald-300/[.09] text-emerald-100",
  "border-sky-300/20 bg-sky-300/[.09] text-sky-100",
  "border-fuchsia-300/20 bg-fuchsia-300/[.09] text-fuchsia-100",
];

function CourseCard({ entry, selectedCourses, conflict, shortNames }) {
  const colorIndex = selectedCourses.findIndex((course) => course.courseCode === entry.course.courseCode);
  const style = conflict
    ? "border-rose-400/55 bg-rose-400/15 text-rose-50 ring-1 ring-rose-400/20"
    : CARD_STYLES[Math.max(0, colorIndex) % CARD_STYLES.length];

  return (
    <article className={`rounded-xl border p-3 ${style}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-bold tracking-wide">{entry.course.courseCode}</p>
        {conflict && <span className="rounded bg-rose-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">Conflict</span>}
      </div>
      <p className="mt-2 text-sm font-bold leading-tight">{shortNames[entry.course.courseCode] || entry.course.shortTitle}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] opacity-70">
        <span>{entry.room}</span>
        <span>{entry.course.faculty}</span>
      </div>
    </article>
  );
}

const RoutineTable = forwardRef(function RoutineTable(
  { selectedCourses, routine, shortNames },
  ref,
) {
  const sessions = routine.entries.length;
  const weeklyMinutes = routine.entries.reduce(
    (total, entry) => total + timeToMinutes(entry.end) - timeToMinutes(entry.start),
    0,
  );

  return (
    <section ref={ref} data-routine-capture="true" className="print-area max-w-full overflow-hidden rounded-2xl border border-[#34445c]/70 bg-ink-800 shadow-glow sm:rounded-3xl">
      <div className="flex flex-col gap-4 border-b border-white/[.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint-400/10 text-mint-300">
            <CalendarRange size={21} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">My weekly routine</h2>
            <p className="text-sm text-slate-500">Seven days, one clear view.</p>
          </div>
        </div>
        <div className="flex w-full divide-x divide-white/10 rounded-xl border border-white/[.07] bg-white/[.025] text-center sm:w-auto">
          <div className="flex-1 px-2 py-2 sm:px-4">
            <strong className="block text-sm text-slate-100">{selectedCourses.length}</strong>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Courses</span>
          </div>
          <div className="flex-1 px-2 py-2 sm:px-4">
            <strong className="block text-sm text-slate-100">{sessions}</strong>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Sessions</span>
          </div>
          <div className="flex-1 px-2 py-2 sm:px-4">
            <strong className="block text-sm text-slate-100">{(weeklyMinutes / 60).toFixed(1)}h</strong>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Weekly</span>
          </div>
        </div>
      </div>

      <div className="routine-scroll overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left">
          <thead>
            <tr className="bg-black/10">
              <th className="sticky left-0 z-20 min-w-20 border-b border-r border-white/[.07] bg-[#111d31] px-3 py-4 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500 sm:min-w-24 sm:px-4">
                Day
              </th>
              {routine.slots.map((slot) => (
                <th key={slot.key} className="min-w-[150px] border-b border-r border-white/[.07] px-3 py-3 last:border-r-0 sm:min-w-[176px] sm:px-4">
                  <span className="block font-mono text-sm font-semibold text-slate-200">{formatTime12(slot.start)}</span>
                  <span className="mt-0.5 block font-mono text-[10px] font-normal text-slate-500">
                    to{" "}
                    {slot.ends.map((end, index) => (
                      <span key={end}>
                        <strong className="font-semibold text-white">{formatTime12(end)}</strong>
                        {index < slot.ends.length - 1 && <span> / </span>}
                      </span>
                    ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEK_DAYS.map((day) => (
              <tr key={day}>
                <th className="sticky left-0 z-10 border-b border-r border-white/[.07] bg-[#111d31] px-3 py-4 align-top text-xs font-bold tracking-[.14em] text-slate-400 sm:px-4 sm:py-5">
                  {day}
                </th>
                {routine.slots.map((slot) => {
                  const cellEntries = routine.entries.filter((entry) => entry.day === day && entry.slotKey === slot.key);
                  return (
                    <td key={`${day}-${slot.key}`} className="h-24 border-b border-r border-white/[.07] p-1.5 align-top last:border-r-0 sm:h-28 sm:p-2">
                      <div className="space-y-2">
                        {cellEntries.map((entry) => (
                          <CourseCard
                            key={entry.id}
                            entry={entry}
                            selectedCourses={selectedCourses}
                            conflict={routine.conflictIds.has(entry.id)}
                            shortNames={shortNames}
                          />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});

export default RoutineTable;
