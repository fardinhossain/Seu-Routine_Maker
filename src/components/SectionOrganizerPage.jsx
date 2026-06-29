import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  CircleHelp,
  Clock3,
  Copy,
  Eraser,
  Eye,
  FilterX,
  Search,
  Sparkles,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import RoutineTable from "./RoutineTable";
import {
  getDayPatternOptions,
  getTimeSlotOptions,
  groupSectionsBySchedule,
  matchesScheduleFilters,
} from "../lib/sectionGroups";
import {
  buildRoutine,
  courseIdentity,
  formatTime12,
  uniqueCourseSelections,
} from "../lib/routine";
import { readStoredValue, STORAGE_KEYS, writeStoredValue } from "../lib/storage";

function initialOrganizerData() {
  const courses = readStoredValue(STORAGE_KEYS.courses, []);
  const shortNames = readStoredValue(STORAGE_KEYS.shortNames, {});
  const availableCodes = new Set(courses.map((course) => course.courseCode));
  const selected = uniqueCourseSelections(
    readStoredValue(STORAGE_KEYS.selectedCodes, []).filter((code) => availableCodes.has(code)),
  );
  return { courses, selected, shortNames };
}

function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return Promise.resolve();
}

export default function SectionOrganizerPage() {
  const initial = useMemo(initialOrganizerData, []);
  const [courses] = useState(initial.courses);
  const [shortNames] = useState(initial.shortNames);
  const [selectedCodes, setSelectedCodes] = useState(initial.selected);
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("ALL");
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState("ALL");
  const [timeMenuOpen, setTimeMenuOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState("ALL");
  const [teacherMenuOpen, setTeacherMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState(null);
  const [pendingConflict, setPendingConflict] = useState(null);
  const [showRoutinePreview, setShowRoutinePreview] = useState(false);

  const allGroups = useMemo(() => groupSectionsBySchedule(courses), [courses]);
  const dayOptions = useMemo(() => getDayPatternOptions(courses), [courses]);
  const timeOptions = useMemo(() => getTimeSlotOptions(courses), [courses]);
  const courseOptions = useMemo(() => {
    const options = new Map();
    courses.forEach((course) => {
      const identity = courseIdentity(course.courseCode);
      if (!options.has(identity)) options.set(identity, course.courseTitle);
    });
    return [...options.entries()].sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );
  }, [courses]);
  const teacherOptions = useMemo(() => {
    const options = new Map();
    courses
      .filter((course) => courseFilter === "ALL" || courseIdentity(course.courseCode) === courseFilter)
      .forEach((course) => {
        const faculty = course.faculty || "TBA";
        const fullName = course.facultyName || "";
        if (!options.has(faculty)) {
          options.set(faculty, fullName ? `[${faculty}] ${fullName}` : faculty);
        }
      });
    return [...options.entries()].sort(([, left], [, right]) => left.localeCompare(right));
  }, [courseFilter, courses]);
  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allGroups
      .map((group) => ({
        ...group,
        courses: group.courses.filter((course) =>
          (!term
            || course.courseCode.toLowerCase().includes(term)
            || course.courseTitle.toLowerCase().includes(term)
            || course.faculty.toLowerCase().includes(term)
            || (course.facultyName || "").toLowerCase().includes(term))
          && (courseFilter === "ALL" || courseIdentity(course.courseCode) === courseFilter)
          && (teacherFilter === "ALL" || course.faculty === teacherFilter)
          && matchesScheduleFilters(course, dayFilter, timeFilter),
        ),
      }))
      .filter((group) => group.courses.length > 0);
  }, [allGroups, courseFilter, dayFilter, search, teacherFilter, timeFilter]);
  const selectedCourseTitle = courseFilter === "ALL"
    ? "All courses"
    : `${courseFilter} — ${courseOptions.find(([code]) => code === courseFilter)?.[1] || "Course"}`;
  const selectedTeacherTitle = teacherFilter === "ALL"
    ? "All teachers"
    : teacherOptions.find(([faculty]) => faculty === teacherFilter)?.[1] || teacherFilter;
  const selectedTimeTitle = timeFilter === "ALL"
    ? "All"
    : timeOptions.find((option) => option.value === timeFilter)?.label || "All";
  const selectedDayTitle = dayFilter === "ALL"
    ? "All"
    : dayOptions.find((option) => option.value === dayFilter)?.label || "All";

  const selectedCourses = useMemo(() => {
    const lookup = new Map(courses.map((course) => [course.courseCode, course]));
    return selectedCodes.map((code) => lookup.get(code)).filter(Boolean);
  }, [courses, selectedCodes]);
  const routine = useMemo(() => buildRoutine(selectedCourses), [selectedCourses]);
  const conflictCodes = useMemo(
    () => new Set(routine.conflicts.flatMap((conflict) => [conflict.first, conflict.second])),
    [routine.conflicts],
  );
  const generatedCodes = selectedCodes.join("\n");
  const activeFilterCount = [
    search.trim(),
    courseFilter !== "ALL",
    teacherFilter !== "ALL",
    timeFilter !== "ALL",
    dayFilter !== "ALL",
  ].filter(Boolean).length;

  function closeFilterMenus() {
    setCourseMenuOpen(false);
    setTeacherMenuOpen(false);
    setTimeMenuOpen(false);
    setDayMenuOpen(false);
  }

  function clearFilters() {
    setSearch("");
    setCourseFilter("ALL");
    setTeacherFilter("ALL");
    setTimeFilter("ALL");
    setDayFilter("ALL");
    closeFilterMenus();
  }

  useEffect(() => {
    if (!showRoutinePreview) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") setShowRoutinePreview(false);
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showRoutinePreview]);

  function conflictsForCandidate(course, baseCodes = selectedCodes) {
    const lookup = new Map(courses.map((item) => [item.courseCode, item]));
    const plannedCourses = [
      ...baseCodes.map((code) => lookup.get(code)).filter(Boolean),
      course,
    ];
    return buildRoutine(plannedCourses).conflicts.filter((conflict) =>
      conflict.first === course.courseCode || conflict.second === course.courseCode,
    );
  }

  function toggleSection(course) {
    setNotice("");
    setCopied(false);
    if (selectedCodes.includes(course.courseCode)) {
      setSelectedCodes((current) => current.filter((code) => code !== course.courseCode));
      setPendingReplacement(null);
      return;
    }

    const identity = courseIdentity(course.courseCode);
    const previousCode = selectedCodes.find((code) => courseIdentity(code) === identity);
    if (previousCode) {
      setPendingReplacement({ previousCode, nextCourse: course });
      return;
    }

    const conflicts = conflictsForCandidate(course);
    if (conflicts.length) {
      setPendingConflict({ course, conflicts });
      return;
    }

    setSelectedCodes((current) => [...current, course.courseCode]);
  }

  function confirmReplacement() {
    if (!pendingReplacement) return;
    const { previousCode, nextCourse } = pendingReplacement;
    const identity = courseIdentity(nextCourse.courseCode);
    const remainingCodes = selectedCodes.filter((code) => courseIdentity(code) !== identity);
    const conflicts = conflictsForCandidate(nextCourse, remainingCodes);
    if (conflicts.length) {
      setPendingReplacement(null);
      setPendingConflict({ course: nextCourse, conflicts });
      return;
    }
    setSelectedCodes((current) => [
      ...current.filter((code) => courseIdentity(code) !== identity),
      nextCourse.courseCode,
    ]);
    setNotice(`${previousCode} was replaced by ${nextCourse.courseCode}.`);
    setPendingReplacement(null);
  }

  async function handleCopy() {
    if (!generatedCodes) return;
    await copyText(generatedCodes);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function prepareRoutineLink(event) {
    if (!selectedCodes.length) {
      event.preventDefault();
      return;
    }
    writeStoredValue(STORAGE_KEYS.selectedCodes, selectedCodes);
  }

  if (!courses.length) {
    return (
      <main className="grid min-h-screen place-items-center bg-ink-950 px-4 text-center text-slate-200">
        <section className="panel max-w-lg p-7 sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-400/10 text-mint-300">
            <WandSparkles size={25} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-white">Import course data first</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Upload and parse a UMS HTML or MHTML file before opening the Magic Section Organizer.
          </p>
          <a href="#" className="primary-button mt-6">
            <ArrowLeft size={16} /> Back to Routine Maker
          </a>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-ink-950 font-sans text-slate-200">
      <header className="border-b border-white/[.06] bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4 lg:px-8">
          <a href="#" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white">
            <ArrowLeft size={17} /> <span className="hidden sm:inline">Back to Routine Maker</span><span className="sm:hidden">Back</span>
          </a>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/15 bg-mint-400/[.06] px-2.5 py-1.5 text-[11px] font-medium text-mint-300 sm:gap-2 sm:px-3 sm:text-xs">
            <WandSparkles size={14} /> Magic Organizer
          </span>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1500px] px-3 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8 lg:pt-12">
        <section className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[.07] bg-[radial-gradient(circle_at_90%_20%,rgba(32,222,214,.1),transparent_35%),rgba(255,255,255,.025)] p-4 sm:rounded-3xl sm:p-8 lg:p-10">
          <div className="relative min-w-0 max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-mint-400">
              <Sparkles size={14} /> Smart section planning
            </span>
            <h1 className="mt-3 break-words text-2xl font-semibold leading-tight tracking-[-.04em] text-white sm:text-5xl">
              Find the best sections by <span className="text-mint-400">day and time.</span>
            </h1>
            <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-slate-400 sm:mt-4 sm:text-base">
              Sections with identical schedules are grouped together. Select one section per course, check conflicts, then copy the generated codes or open your completed routine in a new tab.
            </p>
          </div>
        </section>

        <section className="panel mt-5 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowInstructions((current) => !current)}
            className="flex w-full min-w-0 items-center gap-2 px-3 py-3 text-left transition hover:bg-white/[.025] sm:gap-3 sm:px-5 sm:py-4"
            aria-expanded={showInstructions}
            aria-controls="organizer-instructions"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-mint-400/10 text-mint-300 sm:h-9 sm:w-9 sm:rounded-xl">
              <CircleHelp size={16} className="sm:h-[18px] sm:w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs font-semibold text-white sm:text-sm">How to select sections</strong>
              <span className="mt-0.5 hidden text-xs text-slate-500 sm:block">Open the quick selection guide</span>
            </span>
            <ChevronDown
              size={18}
              className={`shrink-0 text-slate-500 transition-transform ${showInstructions ? "rotate-180" : ""}`}
            />
          </button>

          {showInstructions && (
            <div id="organizer-instructions" className="border-t border-white/[.07] px-4 py-4 sm:px-5">
              <ol className="grid gap-3 text-sm leading-6 text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <li className="rounded-xl border border-white/[.07] bg-white/[.025] p-3.5">
                  <span className="font-mono text-xs font-bold text-mint-400">01</span>
                  <p className="mt-1.5"><strong className="text-slate-200">Filter the list.</strong> Choose a course or teacher, then select an exact <strong className="text-slate-300">Time Slot</strong> or a single/combined <strong className="text-slate-300">Day of Week</strong>. Filters work together.</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Use the violet arrow to collapse the controls, or <strong className="text-violet-300">Clear</strong> to reset search and every filter.</p>
                </li>
                <li className="rounded-xl border border-white/[.07] bg-white/[.025] p-3.5">
                  <span className="font-mono text-xs font-bold text-mint-400">02</span>
                  <p className="mt-1.5"><strong className="text-slate-200">Select sections.</strong> Pick one section for each course. Selecting another section of the same course asks before replacing it.</p>
                </li>
                <li className="rounded-xl border border-white/[.07] bg-white/[.025] p-3.5">
                  <span className="font-mono text-xs font-bold text-mint-400">03</span>
                  <p className="mt-1.5"><strong className="text-slate-200">Resolve warnings.</strong> Time conflicts turn red and are blocked, so choose a different conflict-free section.</p>
                </li>
                <li className="rounded-xl border border-white/[.07] bg-white/[.025] p-3.5">
                  <span className="font-mono text-xs font-bold text-mint-400">04</span>
                  <p className="mt-1.5"><strong className="text-slate-200">Create the result.</strong> Use Quick Preview on this page, copy the generated codes, or click <strong className="text-mint-300">Create Routine</strong> to open your routine in a new tab.</p>
                </li>
              </ol>
            </div>
          )}
        </section>

        <section className="panel mt-3 min-w-0 p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Filter sections</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {activeFilterCount ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}` : "Showing every available section"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltersOpen((current) => !current);
                  closeFilterMenus();
                }}
                className="grid h-10 w-10 place-items-center rounded-full border border-violet-400/30 bg-violet-400/15 text-violet-200 transition hover:border-violet-300/50 hover:bg-violet-400/25 hover:text-white sm:h-11 sm:w-11"
                aria-label={filtersOpen ? "Collapse filters" : "Expand filters"}
                aria-expanded={filtersOpen}
                aria-controls="organizer-filters"
              >
                {filtersOpen ? <ChevronsUp size={20} /> : <ChevronsDown size={20} />}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!activeFilterCount}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/15 px-4 text-sm font-semibold text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-400/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:px-5"
              >
                <FilterX size={17} /> Clear
              </button>
            </div>
          </div>

          {filtersOpen && <div id="organizer-filters" className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_minmax(190px,1fr)_minmax(180px,1fr)_170px_190px] xl:items-end">
            <label className="block min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:mb-2 sm:gap-2 sm:text-xs"><Search size={14} /> Search sections</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="field px-3 py-2.5 text-base sm:text-sm"
                placeholder="Search by code, title, or faculty…"
              />
            </label>
            <div className="relative min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:mb-2 sm:gap-2 sm:text-xs"><BookOpen size={14} /> Filter by course</span>
              <button
                type="button"
                onClick={() => {
                  setCourseMenuOpen((current) => !current);
                  setTeacherMenuOpen(false);
                  setTimeMenuOpen(false);
                  setDayMenuOpen(false);
                }}
                className={`field flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-base sm:text-sm ${courseMenuOpen ? "border-mint-400/50 ring-2 ring-mint-400/10" : ""}`}
                aria-label="Filter sections by course"
                aria-haspopup="listbox"
                aria-expanded={courseMenuOpen}
              >
                <span className="min-w-0 truncate text-slate-200">{selectedCourseTitle}</span>
                <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${courseMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {courseMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Courses"
                  className="absolute left-0 right-0 z-40 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-2xl shadow-black/50"
                >
                  {[["ALL", "All courses"], ...courseOptions].map(([code, title]) => {
                    const label = code === "ALL" ? title : `${code} — ${title}`;
                    const active = courseFilter === code;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        key={code}
                        onClick={() => {
                          setCourseFilter(code);
                          setTeacherFilter("ALL");
                          setCourseMenuOpen(false);
                        }}
                        className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm leading-5 transition ${
                          active
                            ? "bg-mint-400/15 text-mint-200"
                            : "text-slate-300 hover:bg-white/[.06] hover:text-white"
                        }`}
                      >
                        <span className="min-w-0 break-words">{label}</span>
                        {active && <Check size={15} className="mt-0.5 shrink-0 text-mint-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:mb-2 sm:gap-2 sm:text-xs"><UserRound size={14} /> Filter by teacher</span>
              <button
                type="button"
                onClick={() => {
                  setTeacherMenuOpen((current) => !current);
                  setCourseMenuOpen(false);
                  setTimeMenuOpen(false);
                  setDayMenuOpen(false);
                }}
                className={`field flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-base sm:text-sm ${teacherMenuOpen ? "border-mint-400/50 ring-2 ring-mint-400/10" : ""}`}
                aria-label="Filter sections by teacher"
                aria-haspopup="listbox"
                aria-expanded={teacherMenuOpen}
              >
                <span className="min-w-0 truncate text-slate-200">{selectedTeacherTitle}</span>
                <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${teacherMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {teacherMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Teachers"
                  className="absolute left-0 right-0 z-40 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-2xl shadow-black/50"
                >
                  {[["ALL", "All teachers"], ...teacherOptions].map(([faculty, label]) => {
                    const active = teacherFilter === faculty;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        key={faculty}
                        onClick={() => {
                          setTeacherFilter(faculty);
                          setTeacherMenuOpen(false);
                        }}
                        className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm leading-5 transition ${
                          active
                            ? "bg-mint-400/15 text-mint-200"
                            : "text-slate-300 hover:bg-white/[.06] hover:text-white"
                        }`}
                      >
                        <span className="min-w-0 break-words">{label}</span>
                        {active && <Check size={15} className="mt-0.5 shrink-0 text-mint-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:mb-2 sm:gap-2 sm:text-xs"><Clock3 size={14} /> Time Slot</span>
              <button
                type="button"
                onClick={() => {
                  setTimeMenuOpen((current) => !current);
                  setCourseMenuOpen(false);
                  setTeacherMenuOpen(false);
                  setDayMenuOpen(false);
                }}
                className={`field flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-base sm:text-sm ${timeMenuOpen ? "border-mint-400/50 ring-2 ring-mint-400/10" : ""}`}
                aria-label="Filter sections by time slot"
                aria-haspopup="listbox"
                aria-expanded={timeMenuOpen}
              >
                <span className="min-w-0 truncate text-slate-200">{selectedTimeTitle}</span>
                <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${timeMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {timeMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Time slots"
                  className="absolute left-0 right-0 z-40 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-2xl shadow-black/50"
                >
                  {[{ value: "ALL", label: "All" }, ...timeOptions].map((option) => {
                    const active = timeFilter === option.value;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        key={option.value}
                        onClick={() => {
                          setTimeFilter(option.value);
                          setTimeMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          active
                            ? "bg-mint-400/15 text-mint-200"
                            : "text-slate-300 hover:bg-white/[.06] hover:text-white"
                        }`}
                      >
                        <span>{option.label}</span>
                        {active && <Check size={15} className="shrink-0 text-mint-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:mb-2 sm:gap-2 sm:text-xs"><CalendarDays size={14} /> Day of Week</span>
              <button
                type="button"
                onClick={() => {
                  setDayMenuOpen((current) => !current);
                  setCourseMenuOpen(false);
                  setTeacherMenuOpen(false);
                  setTimeMenuOpen(false);
                }}
                className={`field flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-base sm:text-sm ${dayMenuOpen ? "border-mint-400/50 ring-2 ring-mint-400/10" : ""}`}
                aria-label="Filter sections by day of week"
                aria-haspopup="listbox"
                aria-expanded={dayMenuOpen}
              >
                <span className="min-w-0 truncate text-slate-200">{selectedDayTitle}</span>
                <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${dayMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {dayMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Meeting days"
                  className="absolute left-0 right-0 z-40 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-2xl shadow-black/50"
                >
                  {[{ value: "ALL", label: "All" }, ...dayOptions].map((option) => {
                    const active = dayFilter === option.value;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        key={option.value}
                        onClick={() => {
                          setDayFilter(option.value);
                          setDayMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          active
                            ? "bg-mint-400/15 text-mint-200"
                            : "text-slate-300 hover:bg-white/[.06] hover:text-white"
                        }`}
                      >
                        <span className="min-w-0 break-words">{option.label}</span>
                        {active && <Check size={15} className="shrink-0 text-mint-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>}
          <div className="mt-3 grid min-w-0 grid-cols-3 gap-1.5 text-center text-[10px] text-slate-500 sm:mt-4 sm:flex sm:flex-wrap sm:gap-2 sm:text-left sm:text-xs">
            <span className="min-w-0 rounded-full bg-white/[.035] px-1.5 py-1"><strong className="font-medium">{courses.length}</strong> <span className="sm:hidden">Sections</span><span className="hidden sm:inline">sections</span></span>
            <span className="min-w-0 rounded-full bg-white/[.035] px-1.5 py-1"><strong className="font-medium">{allGroups.length}</strong> <span className="sm:hidden">Groups</span><span className="hidden sm:inline">schedule groups</span></span>
            <span className="min-w-0 rounded-full bg-mint-400/[.07] px-1.5 py-1 text-mint-300"><strong className="font-medium">{selectedCodes.length}</strong> selected</span>
          </div>
        </section>

        <div className="mt-4 grid min-w-0 gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-3 sm:space-y-4">
            {visibleGroups.map((group) => (
              <article key={group.key} className="panel overflow-hidden">
                <header className="border-b border-white/[.07] bg-ink-950/30 px-3 py-3 sm:px-5 sm:py-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-400/10 text-mint-300"><Clock3 size={16} /></span>
                    {group.meetings.map((meeting) => (
                      <span key={`${meeting.day}-${meeting.start}`} className="max-w-full rounded-lg border border-white/[.08] bg-white/[.03] px-2 py-1.5 font-mono text-[11px] text-slate-300 sm:px-2.5 sm:text-xs">
                        <strong className="text-mint-300">{meeting.day}</strong> · {formatTime12(meeting.start)}–{formatTime12(meeting.end)}
                      </span>
                    ))}
                    <span className="w-full pl-10 text-[11px] text-slate-500 sm:ml-auto sm:w-auto sm:pl-0 sm:text-xs">{group.courses.length} section{group.courses.length === 1 ? "" : "s"}</span>
                  </div>
                </header>

                <div className="grid gap-2.5 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                  {group.courses.map((course) => {
                    const selected = selectedCodes.includes(course.courseCode);
                    const hasConflict = conflictCodes.has(course.courseCode);
                    const hasReplacementWarning = pendingReplacement
                      && (pendingReplacement.previousCode === course.courseCode
                        || pendingReplacement.nextCourse.courseCode === course.courseCode);
                    const hasPendingConflict = pendingConflict
                      && (pendingConflict.course.courseCode === course.courseCode
                        || pendingConflict.conflicts.some((conflict) =>
                          conflict.first === course.courseCode || conflict.second === course.courseCode));
                    const rooms = [...new Set(course.meetings.map((meeting) => meeting.room))].join(" / ");
                    return (
                      <button
                        type="button"
                        key={course.courseCode}
                        onClick={() => toggleSection(course)}
                        className={`min-w-0 rounded-xl border p-3.5 text-left transition ${
                          hasReplacementWarning || hasPendingConflict || hasConflict
                            ? "border-rose-400/45 bg-rose-400/[.1]"
                            : selected
                              ? "border-mint-400/45 bg-mint-400/[.1] ring-1 ring-mint-400/15"
                              : "border-white/[.08] bg-white/[.025] hover:border-mint-400/25 hover:bg-white/[.045]"
                        }`}
                        aria-pressed={selected}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-mono text-sm font-bold text-white">{course.courseCode}</span>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                            hasReplacementWarning || hasPendingConflict
                              ? "border-rose-400 bg-rose-400/20 text-rose-200"
                              : selected
                                ? "border-mint-400 bg-mint-400 text-ink-950"
                                : "border-white/15"
                          }`}>
                            {hasReplacementWarning || hasPendingConflict
                              ? <AlertTriangle size={12} strokeWidth={2.5} />
                              : selected && <Check size={13} strokeWidth={3} />}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm font-semibold leading-5 text-slate-200 sm:line-clamp-2">{course.courseTitle}</p>
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span className="min-w-0 break-words text-slate-400">
                            {course.facultyName || course.faculty}
                          </span>
                          <span>{rooms}</span>
                          {course.credits && <span>{course.credits} cr.</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}

            {!visibleGroups.length && (
              <div className="rounded-2xl border border-dashed border-white/10 px-5 py-14 text-center text-sm text-slate-500">
                No sections match the selected filters.
              </div>
            )}
          </section>

          <aside id="selected-codes" className="order-first min-w-0 lg:order-none lg:sticky lg:top-5 lg:self-start">
            <div className="panel p-3 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-mint-400">Generated field</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Selected course codes</h2>
                </div>
                <span className="rounded-full bg-mint-400/10 px-2.5 py-1 text-xs font-semibold text-mint-300">{selectedCodes.length}</span>
              </div>

              {notice && <p className="mt-3 rounded-lg bg-amber-400/[.08] px-3 py-2 text-xs text-amber-200">{notice}</p>}

              <textarea
                readOnly
                value={generatedCodes}
                className="field mt-4 min-h-40 resize-none font-mono text-sm"
                placeholder="Select sections to generate codes…"
                aria-label="Generated selected course codes"
              />

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={handleCopy} disabled={!selectedCodes.length} className="secondary-button px-2">
                  {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy codes"}
                </button>
                <button type="button" onClick={() => { setSelectedCodes([]); setPendingReplacement(null); setPendingConflict(null); }} disabled={!selectedCodes.length} className="danger-button px-2">
                  <Eraser size={15} /> Clear
                </button>
              </div>

              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowRoutinePreview(true)}
                  disabled={!selectedCodes.length}
                  className="secondary-button px-2"
                >
                  <Eye size={16} /> Quick Preview
                </button>
                <a
                  href="#routine"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={prepareRoutineLink}
                  aria-disabled={!selectedCodes.length}
                  className={`primary-button w-full px-2 ${!selectedCodes.length ? "pointer-events-none opacity-50" : ""}`}
                >
                  <CalendarDays size={16} /> Create Routine
                </a>
              </div>

              {routine.conflicts.length > 0 && (
                <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/[.08] p-3 text-xs text-rose-200">
                  <p className="flex items-center gap-2 font-semibold text-rose-100"><AlertTriangle size={15} /> Resolve {routine.conflicts.length} conflict{routine.conflicts.length === 1 ? "" : "s"}</p>
                  <div className="mt-2 space-y-1.5">
                    {routine.conflicts.map((conflict, index) => (
                      <p key={`${conflict.first}-${conflict.second}-${index}`}>
                        {conflict.first} / {conflict.second} · {conflict.day} {formatTime12(conflict.start)}–{formatTime12(conflict.end)}
                      </p>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </aside>
        </div>
      </main>

      {showRoutinePreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="routine-preview-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowRoutinePreview(false);
          }}
        >
          <section className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-2xl shadow-black/70 sm:rounded-3xl">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[.08] bg-ink-900 px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-mint-400">Quick Preview</p>
                <h2 id="routine-preview-title" className="mt-0.5 truncate text-lg font-semibold text-white">Your weekly routine</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRoutinePreview(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-400 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-200"
                aria-label="Close routine preview"
              >
                <X size={19} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-4">
              <RoutineTable
                selectedCourses={selectedCourses}
                routine={routine}
                shortNames={shortNames}
              />
            </div>
          </section>
        </div>
      )}

      {pendingReplacement && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="replace-section-title"
        >
          <section className="w-full max-w-md rounded-2xl border border-rose-400/30 bg-ink-900 p-5 shadow-2xl shadow-black/60 sm:p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-400/15 text-rose-300">
              <AlertTriangle size={22} />
            </span>
            <h2 id="replace-section-title" className="mt-4 text-xl font-semibold text-white">Course already selected</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              You already selected <strong className="text-rose-200">{pendingReplacement.previousCode}</strong>. Do you want to replace it with <strong className="text-rose-200">{pendingReplacement.nextCourse.courseCode}</strong>?
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPendingReplacement(null)}
                className="secondary-button w-full"
              >
                Keep {pendingReplacement.previousCode}
              </button>
              <button
                type="button"
                onClick={confirmReplacement}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/35 bg-rose-400/15 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/25"
              >
                Replace section
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingConflict && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="schedule-conflict-title"
        >
          <section className="w-full max-w-md rounded-2xl border border-rose-400/30 bg-ink-900 p-5 shadow-2xl shadow-black/60 sm:p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-400/15 text-rose-300">
              <AlertTriangle size={22} />
            </span>
            <h2 id="schedule-conflict-title" className="mt-4 text-xl font-semibold text-white">Schedule conflict detected</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              <strong className="text-rose-200">{pendingConflict.course.courseCode}</strong> overlaps with an already selected section. This section was not added.
            </p>
            <div className="mt-4 space-y-2">
              {pendingConflict.conflicts.map((conflict, index) => {
                const otherCode = conflict.first === pendingConflict.course.courseCode
                  ? conflict.second
                  : conflict.first;
                return (
                  <div key={`${conflict.first}-${conflict.second}-${index}`} className="rounded-xl border border-rose-400/15 bg-rose-400/[.07] px-3.5 py-3 text-sm text-rose-100">
                    <strong>{pendingConflict.course.courseCode}</strong> and <strong>{otherCode}</strong>
                    <span className="mt-1 block text-xs text-rose-200/75">
                      {conflict.day} · {formatTime12(conflict.start)}–{formatTime12(conflict.end)}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPendingConflict(null)}
              className="danger-button mt-5 w-full"
            >
              Choose another section
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
