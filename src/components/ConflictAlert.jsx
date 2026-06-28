import { AlertTriangle } from "lucide-react";
import { formatTime12 } from "../lib/routine";

export default function ConflictAlert({ conflicts }) {
  if (!conflicts.length) return null;

  return (
    <section className="rounded-2xl border border-rose-400/25 bg-rose-400/[.07] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-400/15 text-rose-300">
          <AlertTriangle size={17} />
        </span>
        <div>
          <h2 className="font-semibold text-rose-100">Schedule conflict{conflicts.length > 1 ? "s" : ""} found</h2>
          <p className="mt-1 text-sm text-rose-200/75">Remove at least one conflicting section before printing or exporting.</p>
          <div className="mt-2 space-y-1 text-sm text-rose-200/75">
            {conflicts.map((conflict, index) => (
              <p key={`${conflict.first}-${conflict.second}-${conflict.day}-${index}`}>
                Conflict found: <strong className="text-rose-100">{conflict.first}</strong> and <strong className="text-rose-100">{conflict.second}</strong> on {conflict.day} {formatTime12(conflict.start)}–{formatTime12(conflict.end)}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
