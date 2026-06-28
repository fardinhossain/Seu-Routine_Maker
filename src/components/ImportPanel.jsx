import { useRef, useState } from "react";
import { CheckCircle2, FileCode2, LoaderCircle, Trash2, UploadCloud } from "lucide-react";

export default function ImportPanel({
  rawHtml,
  setRawHtml,
  onParse,
  onClearHtml,
  courseCount,
  parsing,
  successMessage,
}) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);

  function loadFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".html") && !file.name.toLowerCase().endsWith(".htm")) {
      setFileName("Please choose an HTML file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const html = String(reader.result || "");
      setRawHtml(html);
      setFileName(file.name);
      onParse(html);
    };
    reader.readAsText(file);
  }

  function clearHtmlInput() {
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
    onClearHtml();
  }

  return (
    <section className="panel h-full p-5 sm:p-6" aria-labelledby="import-heading">
      <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-mint-400">
            <span className="step-number">1</span>
            Import data
          </div>
          <h2 id="import-heading" className="text-xl font-semibold text-white">Add your UMS export</h2>
          <p className="mt-1 text-sm text-slate-400">Upload the saved page or paste its raw HTML.</p>
        </div>
        <div className="flex w-full shrink-0 flex-wrap justify-start gap-2 sm:w-auto sm:justify-end">
          {courseCount > 0 && successMessage && (
            <span className="flex items-center gap-1.5 rounded-full bg-mint-400/10 px-2.5 py-1 text-xs font-medium text-mint-300">
              <CheckCircle2 size={13} /> {courseCount} parsed
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <button
          type="button"
          disabled={parsing}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            loadFile(event.dataTransfer.files[0]);
          }}
          className={`group flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed px-5 text-center transition ${
            dragging ? "border-mint-400 bg-mint-400/10" : "border-white/15 bg-white/[.025] hover:border-mint-400/45 hover:bg-mint-400/[.035]"
          }`}
        >
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-mint-400 transition group-hover:-translate-y-0.5">
            <UploadCloud size={23} />
          </span>
          <span className="text-sm font-semibold text-slate-200">Drop your .html file here</span>
          <span className="mt-1 max-w-52 truncate text-xs text-slate-500">{fileName || "or click to browse your computer"}</span>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".html,.htm,text/html"
            onChange={(event) => loadFile(event.target.files?.[0])}
          />
        </button>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <FileCode2 size={14} /> Or paste raw HTML
          </span>
          <textarea
            value={rawHtml}
            onChange={(event) => setRawHtml(event.target.value)}
            onBlur={() => {
              if (rawHtml.trim()) onParse(rawHtml);
            }}
            className="field min-h-36 resize-y font-mono text-xs leading-5 lg:min-h-44"
            placeholder={'<div class="ums-grid-offered-section">…</div>'}
            spellCheck="false"
          />
        </label>
      </div>

      {!parsing && (successMessage || rawHtml) && (
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
          {successMessage && (
            <div className="flex flex-1 items-start gap-2.5 rounded-xl border border-mint-400/20 bg-mint-400/[.07] px-3.5 py-3 text-sm text-mint-300" role="status">
              <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
              <span>{successMessage}</span>
            </div>
          )}
          {rawHtml && (
            <button
              type="button"
              onClick={clearHtmlInput}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/15 bg-rose-400/[.045] px-4 py-3 text-sm font-medium text-rose-300/80 transition hover:border-rose-400/30 hover:bg-rose-400/[.09] hover:text-rose-200"
              title="Clear imported HTML, parsed sections, and routine data"
            >
              <Trash2 size={15} /> Clear HTML
            </button>
          )}
        </div>
      )}

      {parsing && (
        <div className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-mint-400/15 bg-mint-400/[.06] px-3.5 py-2.5 text-xs font-medium text-mint-300 sm:w-auto">
          <LoaderCircle className="animate-spin" size={15} />
          Parsing and saving sections…
        </div>
      )}
    </section>
  );
}
