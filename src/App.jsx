import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCode2,
  FileDown,
  MonitorSmartphone,
  MoreVertical,
  Printer,
  Sparkles,
  TableProperties,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import AppHeader from "./components/AppHeader";
import ConflictAlert from "./components/ConflictAlert";
import CoursePicker from "./components/CoursePicker";
import DataPolicyModal from "./components/DataPolicyModal";
import ImportPanel from "./components/ImportPanel";
import LoadingScreen from "./components/LoadingScreen";
import RoutineTable from "./components/RoutineTable";
import ShortNameEditor from "./components/ShortNameEditor";
import { parseUmsHtml } from "./lib/parser";
import { buildRoutine, findDuplicateCourseSelections, parseCodeList, uniqueCourseSelections } from "./lib/routine";
import { clearRoutineStorage, readStoredValue, STORAGE_KEYS, writeStoredValue } from "./lib/storage";

function loadInitialState() {
  const selectedCodes = readStoredValue(STORAGE_KEYS.selectedCodes, []);
  return {
    rawHtml: readStoredValue(STORAGE_KEYS.rawHtml, ""),
    courses: readStoredValue(STORAGE_KEYS.courses, []),
    selectedCodes,
    codeInput: selectedCodes.join("\n"),
    shortNames: readStoredValue(STORAGE_KEYS.shortNames, {}),
  };
}

export default function App() {
  const initial = useMemo(loadInitialState, []);
  const [rawHtml, setRawHtml] = useState(initial.rawHtml);
  const [courses, setCourses] = useState(initial.courses);
  const [selectedCodes, setSelectedCodes] = useState(initial.selectedCodes);
  const [codeInput, setCodeInput] = useState(initial.codeInput);
  const [shortNames, setShortNames] = useState(initial.shortNames);
  const [message, setMessage] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [exporting, setExporting] = useState("");
  const [importSuccessMessage, setImportSuccessMessage] = useState(
    initial.rawHtml && initial.courses.length
      ? `${initial.courses.length} course sections parsed and saved in this browser.`
      : "",
  );
  const [imageResetKey, setImageResetKey] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showPostAdvisingInstructions, setShowPostAdvisingInstructions] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(() => window.location.hash !== "#routine");
  const [loadingScreenLeaving, setLoadingScreenLeaving] = useState(false);
  const [showDataPolicy, setShowDataPolicy] = useState(false);
  const routineRef = useRef(null);

  const selectedCourses = useMemo(() => {
    const lookup = new Map(courses.map((course) => [course.courseCode.toUpperCase(), course]));
    return selectedCodes.map((code) => lookup.get(code)).filter(Boolean);
  }, [courses, selectedCodes]);
  const routine = useMemo(() => buildRoutine(selectedCourses), [selectedCourses]);
  const missingDraftCodes = useMemo(() => {
    const available = new Set(courses.map((course) => course.courseCode.toUpperCase()));
    return parseCodeList(codeInput).filter((code) => !available.has(code));
  }, [codeInput, courses]);
  const duplicateSelections = useMemo(
    () => findDuplicateCourseSelections(parseCodeList(codeInput)),
    [codeInput],
  );
  const draftConflicts = useMemo(() => {
    const draftCodes = new Set(uniqueCourseSelections(parseCodeList(codeInput)));
    const draftCourses = courses.filter((course) => draftCodes.has(course.courseCode.toUpperCase()));
    return buildRoutine(draftCourses).conflicts;
  }, [codeInput, courses]);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.shortNames, shortNames);
  }, [shortNames]);

  useEffect(() => {
    if (!showLoadingScreen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fadeTimer = window.setTimeout(() => setLoadingScreenLeaving(true), 2500);
    const removeTimer = window.setTimeout(() => {
      setShowLoadingScreen(false);
      document.body.style.overflow = previousOverflow;
    }, 3000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const available = new Set(courses.map((course) => course.courseCode.toUpperCase()));
    const validCodes = uniqueCourseSelections(parseCodeList(codeInput).filter((code) => available.has(code)));
    setSelectedCodes(validCodes);
    writeStoredValue(STORAGE_KEYS.selectedCodes, validCodes);
  }, [codeInput, courses]);

  useEffect(() => {
    if (showLoadingScreen || window.location.hash !== "#routine") return undefined;

    const scrollTimer = window.setTimeout(() => {
      routineRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);

    return () => window.clearTimeout(scrollTimer);
  }, [showLoadingScreen]);

  function showMessage(type, text) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage((current) => current?.text === text ? null : current), 6000);
  }

  function handleParse(htmlOverride) {
    const htmlToParse = typeof htmlOverride === "string" ? htmlOverride : rawHtml;
    setImportSuccessMessage("");
    setParsing(true);
    window.setTimeout(() => {
      try {
        const parsed = parseUmsHtml(htmlToParse);
        setCourses(parsed);
        writeStoredValue(STORAGE_KEYS.rawHtml, htmlToParse);
        writeStoredValue(STORAGE_KEYS.courses, parsed);
        setImportSuccessMessage(`${parsed.length} course sections parsed and saved in this browser.`);
      } catch (error) {
        showMessage("error", error.message || "The HTML could not be parsed.");
      } finally {
        setParsing(false);
      }
    }, 40);
  }

  function handleClear() {
    setSelectedCodes([]);
    setCodeInput("");
    setImageResetKey((current) => current + 1);
    writeStoredValue(STORAGE_KEYS.selectedCodes, []);
    showMessage("success", "Routine cleared. Your parsed course data is still saved.");
  }

  function handleClearHtml() {
    clearRoutineStorage();
    setRawHtml("");
    setCourses([]);
    setSelectedCodes([]);
    setCodeInput("");
    setShortNames({});
    setImportSuccessMessage("");
    setImageResetKey((current) => current + 1);
    showMessage("success", "Imported HTML, parsed sections, and routine data were cleared.");
  }

  function handleReset() {
    if (!window.confirm("Reset the imported HTML, parsed courses, routine, and custom short names?")) return;
    clearRoutineStorage();
    setRawHtml("");
    setCourses([]);
    setSelectedCodes([]);
    setCodeInput("");
    setShortNames({});
    setImportSuccessMessage("");
    setImageResetKey((current) => current + 1);
    showMessage("success", "All saved routine data has been reset.");
  }

  function changeShortName(code, value) {
    setShortNames((current) => ({ ...current, [code]: value }));
  }

  async function captureRoutine() {
    if (!routineRef.current) return null;
    const { default: html2canvas } = await import("html2canvas");
    const target = routineRef.current;
    const table = target.querySelector("table");
    const desktopTableWidth = 96 + routine.slots.length * 176;
    const exportWidth = Math.max(table?.scrollWidth || 0, desktopTableWidth, 960);
    const exportHeight = Math.max(target.scrollHeight, 1024);

    return html2canvas(target, {
      backgroundColor: "#0d182b",
      scale: 2,
      useCORS: true,
      logging: false,
      width: exportWidth,
      height: exportHeight,
      windowWidth: Math.max(exportWidth, 1280),
      windowHeight: exportHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDocument) => {
        const clonedRoutine = clonedDocument.querySelector('[data-routine-capture="true"]');
        if (!clonedRoutine) return;

        clonedRoutine.style.width = `${exportWidth}px`;
        clonedRoutine.style.maxWidth = "none";
        clonedRoutine.style.overflow = "visible";

        const clonedScrollArea = clonedRoutine.querySelector(".routine-scroll");
        if (clonedScrollArea) {
          clonedScrollArea.style.width = "100%";
          clonedScrollArea.style.overflow = "visible";
        }

        clonedRoutine.querySelectorAll(".sticky").forEach((element) => {
          element.style.position = "static";
        });
      },
    });
  }

  async function exportPng() {
    try {
      setExporting("png");
      const canvas = await captureRoutine();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = "seu-weekly-routine.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      showMessage("error", "The PNG could not be created. Try the print option instead.");
    } finally {
      setExporting("");
    }
  }

  async function exportPdf() {
    try {
      setExporting("pdf");
      const [{ jsPDF }, canvas] = await Promise.all([import("jspdf"), captureRoutine()]);
      if (!canvas) return;
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height, undefined, "FAST");
      pdf.save("seu-weekly-routine.pdf");
    } catch {
      showMessage("error", "The PDF could not be created. Try downloading a PNG instead.");
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950 text-slate-200">
      {showLoadingScreen && <LoadingScreen leaving={loadingScreenLeaving} />}
      <AppHeader />

      <main className="mx-auto w-full min-w-0 max-w-[1500px] px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8 lg:pt-14">
        <section className="relative mb-8 w-full min-w-0 overflow-hidden rounded-2xl border border-white/[.06] bg-[radial-gradient(circle_at_85%_20%,rgba(88,221,184,.11),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.035),rgba(255,255,255,.01))] px-5 py-8 sm:mb-10 sm:rounded-3xl sm:px-10 sm:py-10 lg:px-14 lg:py-14">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-mint-400/10" />
          <div className="pointer-events-none absolute -right-4 -top-8 h-40 w-40 rounded-full border border-mint-400/10" />
          <div className="relative">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-mint-400/15 bg-mint-400/[.06] px-3 py-1.5 text-xs font-medium text-mint-300">
              <Sparkles size={13} /> Built for SEU Students
            </span>
            <h1 className="max-w-2xl break-words text-[2rem] font-semibold leading-[1.12] tracking-[-.04em] text-white sm:text-5xl sm:leading-[1.08] lg:text-6xl">
              Your classes, finally in <span className="text-mint-400">one clear view.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Import your UMS data, choose section codes, and build a clean routine automatically.
            </p>

            <button
              type="button"
              onClick={() => setShowInstructions((current) => !current)}
              className="secondary-button mt-6 border-mint-400/20 bg-mint-400/[.06] text-mint-300 hover:border-mint-400/40 hover:bg-mint-400/[.1]"
              aria-expanded={showInstructions}
              aria-controls="ums-instructions"
            >
              <BookOpen size={17} />
              {showInstructions ? "Hide instructions" : "How to use"}
              <ChevronDown size={16} className={`transition-transform ${showInstructions ? "rotate-180" : ""}`} />
            </button>

            {showInstructions && (
              <div id="ums-instructions" className="mt-8">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-white/[.08] bg-ink-950/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-400/10 text-mint-300">
                    <TableProperties size={16} />
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-600">01</span>
                </div>
                <p className="text-sm font-semibold text-slate-100">Open Advising Table</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Sign in to UMS and go to <strong className="text-slate-300">Advising Table</strong>.</p>
              </div>

              <div className="rounded-2xl border border-white/[.08] bg-ink-950/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-400/10 text-mint-300">
                    <CheckCircle2 size={16} />
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-600">02</span>
                </div>
                <p className="text-sm font-semibold text-slate-100">Select Preregistered</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Set <strong className="text-slate-300">View Sections By</strong> to <strong className="text-slate-300">Preregistered</strong>.</p>
              </div>

              <div className="rounded-2xl border border-white/[.08] bg-ink-950/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-400/10 text-mint-300">
                    <FileCode2 size={16} />
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-600">03</span>
                </div>
                <p className="text-sm font-semibold text-slate-100">Save the page file</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  <span className="block">
                    Desktop: press <kbd className="rounded bg-white/[.07] px-1.5 py-0.5 font-mono text-slate-300">Ctrl+S</kbd>.
                  </span>
                  <span className="mt-1 block">
                    Mobile: tap <MoreVertical size={12} className="inline" /> then <strong className="text-slate-300">Download</strong>. MHTML files are supported.
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-white/[.08] bg-ink-950/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-400/10 text-mint-300">
                    <UploadCloud size={16} />
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-600">04</span>
                </div>
                <p className="text-sm font-semibold text-slate-100">Import your UMS file</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Upload the saved <strong className="text-slate-300">HTML or MHTML</strong> file. Course sections are parsed and saved automatically.</p>
              </div>

              <div className="rounded-2xl border border-white/[.08] bg-ink-950/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-400/10 text-mint-300">
                    <WandSparkles size={16} />
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-600">05</span>
                </div>
                <p className="text-sm font-semibold text-slate-100">Open Magic Organizer</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Filter by <strong className="text-slate-300">course, teacher, or day</strong>, then select one section for each course. Duplicate and conflicting choices show a warning.</p>
              </div>

              <div className="rounded-2xl border border-white/[.08] bg-ink-950/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-400/10 text-mint-300">
                    <CalendarDays size={16} />
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-600">06</span>
                </div>
                <p className="text-sm font-semibold text-slate-100">Create your routine</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Click <strong className="text-slate-300">Create Routine</strong>. A new tab opens and scrolls directly to your completed weekly routine.</p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-mint-400/20 bg-mint-400/[.055] p-4 sm:flex-row sm:items-center sm:p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-400/12 text-mint-300">
                <CheckCircle2 size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setShowPostAdvisingInstructions((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-mint-300 transition hover:text-mint-200"
                  aria-expanded={showPostAdvisingInstructions}
                  aria-controls="post-advising-instructions"
                >
                  <span>After successfully completing course advising</span>
                  <ChevronDown size={17} className={`shrink-0 transition-transform ${showPostAdvisingInstructions ? "rotate-180" : ""}`} />
                </button>
                {showPostAdvisingInstructions && (
                <ol id="post-advising-instructions" className="mt-3 grid gap-2 text-xs leading-5 text-slate-400 sm:text-sm sm:leading-6 lg:grid-cols-3">
                  <li className="flex gap-2">
                    <span className="font-mono font-bold text-mint-400">1.</span>
                    <span>Go to <strong className="text-slate-200">Student Dashboard</strong> and open <strong className="text-slate-200">Registered Courses</strong>.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono font-bold text-mint-400">2.</span>
                    <span>Save that page as an <strong className="text-slate-200">HTML file</strong>, then upload it under <strong className="text-slate-200">Add your UMS export</strong>. It will parse automatically.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono font-bold text-mint-400">3.</span>
                    <span>Take a clear screenshot of the <strong className="text-slate-200">Registered Courses</strong> table and upload it under <strong className="text-slate-200">Pick codes from an image</strong>.</span>
                  </li>
                </ol>
                )}
              </div>
            </div>
              </div>
            )}
          </div>
        </section>

        {message && (
          <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            message.type === "error"
              ? "border-rose-400/25 bg-rose-400/[.08] text-rose-200"
              : message.type === "warning"
                ? "border-amber-400/25 bg-amber-400/[.08] text-amber-200"
                : "border-mint-400/20 bg-mint-400/[.07] text-mint-300"
          }`} role="status">
            {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-2">
          <ImportPanel
            rawHtml={rawHtml}
            setRawHtml={setRawHtml}
            onParse={handleParse}
            onClearHtml={handleClearHtml}
            courseCount={courses.length}
            parsing={parsing}
            successMessage={importSuccessMessage}
          />
          <CoursePicker
            courses={courses}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            conflicts={draftConflicts}
            duplicateSelections={duplicateSelections}
            missingCodes={courses.length ? missingDraftCodes : []}
            imageResetKey={imageResetKey}
            onClear={handleClear}
            onReset={handleReset}
          />
        </div>

        {selectedCourses.length > 0 && (
          <div id="routine" className="mt-8 space-y-5 scroll-mt-5">
            <ShortNameEditor courses={selectedCourses} shortNames={shortNames} onChange={changeShortName} />
            <ConflictAlert conflicts={routine.conflicts} />

            <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-mint-400">Your result</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Weekly class routine</h2>
              </div>
              <div className="no-print grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <button type="button" className="secondary-button px-2 sm:px-4" onClick={() => window.print()} disabled={routine.conflicts.length > 0 || duplicateSelections.length > 0} title={routine.conflicts.length || duplicateSelections.length ? "Resolve section conflicts first" : "Print routine"}>
                  <Printer size={16} /> Print
                </button>
                <button type="button" className="secondary-button px-2 sm:px-4" onClick={exportPng} disabled={Boolean(exporting) || routine.conflicts.length > 0 || duplicateSelections.length > 0} title={routine.conflicts.length || duplicateSelections.length ? "Resolve section conflicts first" : "Download routine as PNG"}>
                  <Download size={16} /> {exporting === "png" ? "Creating…" : "PNG"}
                </button>
                <button type="button" className="secondary-button px-2 sm:px-4" onClick={exportPdf} disabled={Boolean(exporting) || routine.conflicts.length > 0 || duplicateSelections.length > 0} title={routine.conflicts.length || duplicateSelections.length ? "Resolve section conflicts first" : "Download routine as PDF"}>
                  <FileDown size={16} /> {exporting === "pdf" ? "Creating…" : "PDF"}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-400/[.07] px-3.5 py-3 text-xs leading-5 text-sky-200 sm:hidden">
              <MonitorSmartphone className="mt-0.5 shrink-0" size={17} />
              <p><strong className="text-sky-100">Use Desktop Mode for a better view.</strong></p>
            </div>

            <RoutineTable ref={routineRef} selectedCourses={selectedCourses} routine={routine} shortNames={shortNames} />
          </div>
        )}

        {!selectedCourses.length && (
          <section className="mt-8 rounded-3xl border border-dashed border-white/10 bg-white/[.015] px-6 py-14 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[.04] text-slate-500">
              <Sparkles size={20} />
            </span>
            <h2 className="mt-4 font-semibold text-slate-300">Your routine will appear here</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Import course data and add section codes—the routine will update automatically.</p>
          </section>
        )}
      </main>

      <footer className="border-t border-white/[.06] bg-[#060d18] px-4 py-12 text-center sm:py-14">
        <button
          type="button"
          onClick={() => setShowDataPolicy(true)}
          className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/[.035] px-3.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-mint-400/25 hover:bg-mint-400/[.06] hover:text-mint-300"
        >
          User Data Policy
        </button>
        <p className="text-xl font-bold tracking-[-.03em] text-white sm:text-2xl">
          SEU <span className="text-mint-400">Routine Maker</span>
        </p>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          Made with <span role="img" aria-label="love">❤️</span> for SEU students.
        </p>
        <p className="mt-5 text-sm text-slate-500">
          Developed by{" "}
          <a
            href="https://mdfardin.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-mint-400 transition hover:text-mint-300 hover:underline hover:underline-offset-4"
          >
            @Fardin_Hossain
          </a>
        </p>
      </footer>

      {showDataPolicy && <DataPolicyModal onClose={() => setShowDataPolicy(false)} />}
    </div>
  );
}
