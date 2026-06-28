import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, RotateCcw, Search, Trash2, X, Zap } from "lucide-react";
import { courseIdentity, formatTime12, parseCodeList } from "../lib/routine";
import ImageCourseScanner from "./ImageCourseScanner";

export default function CoursePicker({
  courses,
  codeInput,
  setCodeInput,
  conflicts,
  duplicateSelections,
  missingCodes,
  imageResetKey,
  onClear,
  onReset,
}) {
  const [search, setSearch] = useState("");
  const draftCodes = parseCodeList(codeInput);
  const conflictCodes = useMemo(
    () => [...new Set(conflicts.flatMap((conflict) => [conflict.first, conflict.second]))],
    [conflicts],
  );
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return courses
      .filter((course) =>
        course.courseCode.toLowerCase().includes(term) || course.courseTitle.toLowerCase().includes(term),
      )
      .slice(0, 7);
  }, [courses, search]);

  function addCourse(code) {
    const identity = courseIdentity(code);
    const next = [...draftCodes.filter((item) => courseIdentity(item) !== identity), code];
    setCodeInput(next.join("\n"));
    setSearch("");
  }

  function removeCourse(code) {
    setCodeInput(draftCodes.filter((item) => item !== code).join("\n"));
  }

  function keepSection(sectionToKeep) {
    const identity = courseIdentity(sectionToKeep);
    setCodeInput(
      draftCodes
        .filter((code) => courseIdentity(code) !== identity || code === sectionToKeep)
        .join("\n"),
    );
  }

  function addDetectedCourses(codes) {
    const next = [...draftCodes];
    const added = [];
    codes.forEach((code) => {
      const identity = courseIdentity(code);
      if (!next.some((item) => courseIdentity(item) === identity)) {
        next.push(code);
        added.push(code);
      }
    });
    setCodeInput(next.join("\n"));
    return added;
  }

  return (
    <section className="panel h-full p-5 sm:p-6" aria-labelledby="courses-heading">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-mint-400">
          <span className="step-number">2</span>
          Pick sections
        </div>
        <h2 id="courses-heading" className="text-xl font-semibold text-white">Choose your courses</h2>
        <p className="mt-1 text-sm text-slate-400">Use comma, spaces, or a new line between codes.</p>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-400">Section codes</span>
        <textarea
          value={codeInput}
          onChange={(event) => setCodeInput(event.target.value)}
          className="field min-h-28 resize-y font-mono text-sm uppercase"
          placeholder={"CSE361.3\nCSE362.2\nCSE443.4"}
          spellCheck="false"
        />
      </label>

      <ImageCourseScanner courses={courses} onCodesDetected={addDetectedCourses} resetKey={imageResetKey} />

      {draftCodes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {draftCodes.map((code) => (
            <span key={code} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.045] px-2.5 py-1.5 font-mono text-xs text-slate-200">
              {code}
              <button type="button" onClick={() => removeCourse(code)} className="text-slate-500 transition hover:text-rose-300" aria-label={`Remove ${code}`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {duplicateSelections.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[.09] p-3.5" role="alert">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={17} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-100">Choose only one section per course</p>
              <p className="mt-1 text-xs text-amber-200/80">Only the first section is active until you choose which one to keep.</p>
              <div className="mt-3 space-y-3">
                {duplicateSelections.map((duplicate) => (
                  <div key={duplicate.course}>
                    <p className="mb-1.5 font-mono text-xs font-semibold text-amber-100">{duplicate.course}</p>
                    <div className="flex flex-wrap gap-2">
                      {duplicate.sections.map((section) => (
                        <button
                          type="button"
                          key={section}
                          onClick={() => keepSection(section)}
                          className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-amber-100 transition hover:border-amber-300/45 hover:bg-amber-300/15"
                        >
                          Keep {section}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/[.09] p-3.5" role="alert">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 shrink-0 text-rose-300" size={17} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-100">
                Live conflict detected
              </p>
              <p className="mt-1 text-xs text-rose-200/80">
                Remove at least one conflicting section before using this routine.
              </p>
              <div className="mt-1.5 space-y-1 text-xs leading-5 text-rose-200/80">
                {conflicts.map((conflict, index) => (
                  <p key={`${conflict.first}-${conflict.second}-${conflict.day}-${index}`}>
                    <strong className="text-rose-100">{conflict.first}</strong> and{" "}
                    <strong className="text-rose-100">{conflict.second}</strong>
                    {" · "}{conflict.day} {formatTime12(conflict.start)}–{formatTime12(conflict.end)}
                  </p>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {conflictCodes.map((code) => (
                  <button
                    type="button"
                    key={code}
                    onClick={() => removeCourse(code)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/25 bg-rose-300/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-rose-100 transition hover:border-rose-300/45 hover:bg-rose-300/15"
                  >
                    <X size={12} /> Remove {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {missingCodes.length > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[.08] p-3.5 text-xs leading-5 text-amber-200" role="status">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          <p>
            Section{missingCodes.length === 1 ? "" : "s"} not found:{" "}
            <strong className="font-mono text-amber-100">{missingCodes.join(", ")}</strong>
          </p>
        </div>
      )}

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" size={16} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="field pl-10 text-sm"
          placeholder={courses.length ? "Search saved sections…" : "Parse course data to enable search"}
          disabled={!courses.length}
        />
        {matches.length > 0 && (
          <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-[#40516b] bg-ink-850 p-1.5 shadow-2xl">
            {matches.map((course) => (
              <button
                type="button"
                key={course.courseCode}
                onClick={() => addCourse(course.courseCode)}
                className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/[.06]"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-semibold text-mint-300">{course.courseCode}</span>
                  <span className="block truncate text-xs text-slate-400">{course.courseTitle}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">{course.faculty}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-mint-400/15 bg-mint-400/[.06] px-3 py-2.5 text-xs font-medium text-mint-300 sm:mr-auto sm:w-auto sm:justify-start">
          <Zap size={15} /> Routine updates automatically
        </span>
        <button type="button" className="secondary-button flex-1 sm:flex-none" onClick={onClear}>
          <Trash2 size={16} /> Clear routine
        </button>
        <button type="button" className="danger-button flex-1 sm:flex-none" onClick={onReset}>
          <RotateCcw size={15} /> Reset saved data
        </button>
      </div>
    </section>
  );
}
