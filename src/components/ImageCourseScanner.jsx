import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardPaste, ImageUp, LoaderCircle, ScanText, X } from "lucide-react";
import { extractCourseCodesFromOcr } from "../lib/ocr";

const MAX_IMAGE_SIZE = 12 * 1024 * 1024;

export default function ImageCourseScanner({ courses, onCodesDetected, resetKey }) {
  const inputRef = useRef(null);
  const workerRef = useRef(null);
  const scanIdRef = useRef(0);
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detectedCodes, setDetectedCodes] = useState([]);
  const [error, setError] = useState("");

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setFileName("");
    setDetectedCodes([]);
    setError("");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  useEffect(() => {
    if (courses.length) return;

    scanIdRef.current += 1;
    if (workerRef.current) {
      workerRef.current.terminate().catch(() => {});
      workerRef.current = null;
    }
    clearImage();
    setScanning(false);
  }, [courses.length]);

  useEffect(() => {
    if (!resetKey) return;

    scanIdRef.current += 1;
    if (workerRef.current) {
      workerRef.current.terminate().catch(() => {});
      workerRef.current = null;
    }
    clearImage();
    setScanning(false);
  }, [resetKey]);

  /**
   * If the screenshot has a dark background (dark theme), invert and boost
   * contrast so Tesseract — which is optimised for dark-on-light — can read
   * the text reliably.  Falls back to the original file on any error.
   */
  async function preprocessImageForOcr(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Sample edge pixels to detect whether the background is dark
        const edgeCoords = [
          [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
          [Math.floor(w / 2), 2], [Math.floor(w / 2), h - 3],
        ];
        const avgLum =
          edgeCoords.reduce((sum, [x, y]) => {
            const px = ctx.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data;
            return sum + 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
          }, 0) / edgeCoords.length;

        if (avgLum < 110) {
          // Dark theme detected → grayscale + invert + contrast stretch
          const imageData = ctx.getImageData(0, 0, w, h);
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const inv = 255 - g;
            // Stretch: push light pixels lighter, dark pixels darker
            const v = inv > 128 ? Math.min(255, inv + 50) : Math.max(0, inv - 50);
            d[i] = v;
            d[i + 1] = v;
            d[i + 2] = v;
          }
          ctx.putImageData(imageData, 0, 0);
        }

        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: "image/png" }) : file),
          "image/png",
        );
      };
      img.onerror = () => resolve(file);
      img.src = objectUrl;
    });
  }

  async function scanImage(file) {
    if (!file) return;
    if (!courses.length) {
      setError("Please parse your UMS HTML before scanning an image.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("The image is too large. Choose an image smaller than 12 MB.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setFileName(file.name || "Pasted clipboard image");
    setDetectedCodes([]);
    setError("");
    setProgress(2);
    setScanning(true);
    const scanId = scanIdRef.current + 1;
    scanIdRef.current = scanId;

    let worker;
    try {
      const { createWorker, PSM } = await import("tesseract.js");
      if (scanId !== scanIdRef.current) return;
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (scanId === scanIdRef.current && typeof message.progress === "number") {
            setProgress(Math.max(2, Math.round(message.progress * 100)));
          }
        },
      });
      if (scanId !== scanIdRef.current) {
        await worker.terminate();
        return;
      }
      workerRef.current = worker;
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      });
      const processedFile = await preprocessImageForOcr(file);
      const result = await worker.recognize(processedFile);
      if (scanId !== scanIdRef.current) return;
      const codes = extractCourseCodesFromOcr(result.data.text, courses);

      if (!codes.length) {
        setError("No matching saved course codes were detected. Try a clearer or more tightly cropped image.");
        return;
      }

      const addedCodes = onCodesDetected(codes) || [];
      if (!addedCodes.length) {
        setError("The detected courses are already selected, or another section of each course is active.");
        return;
      }

      setDetectedCodes(addedCodes);
      setProgress(100);
    } catch {
      setError("The image could not be read. Check your connection and try a clear screenshot.");
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // The worker may already be closed after a recognition failure.
        }
      }
      if (workerRef.current === worker) workerRef.current = null;
      if (scanId === scanIdRef.current) setScanning(false);
    }
  }

  async function pasteFromClipboard() {
    if (!courses.length) {
      setError("Please parse your UMS HTML before scanning an image.");
      return;
    }
    if (scanning) return;

    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find((type) => type.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], "Pasted screenshot", { type: imageType });
            await scanImage(file);
            return;
          }
        }
        setError("No image found in clipboard. Copy an image screenshot first (e.g. Snipping Tool or Ctrl+C).");
      } else {
        setError("Direct clipboard access is restricted in this browser. Press Ctrl+V on your keyboard to paste directly!");
      }
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        setError("Clipboard access was blocked. Please allow permissions or press Ctrl+V to paste directly.");
      } else {
        setError("Could not read clipboard. Try pressing Ctrl+V to paste your image directly.");
      }
    }
  }

  useEffect(() => {
    function handleGlobalPaste(event) {
      if (!courses.length || scanning) return;
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            const imageFile = new File([file], "Pasted screenshot", { type: file.type });
            scanImage(imageFile);
            event.preventDefault();
            break;
          }
        }
      }
    }

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [courses, scanning, preview]);

  return (
    <div className="mt-4 min-w-0 max-w-full rounded-xl border border-dashed border-white/15 bg-black/10 p-3 sm:rounded-2xl sm:p-3.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => scanImage(event.target.files?.[0])}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {preview ? (
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-ink-950">
            <img src={preview} alt="Course screenshot preview" className="h-full w-full object-cover" />
            {!scanning && (
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-ink-950/90 text-slate-300 hover:text-white"
                aria-label="Remove uploaded screenshot"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-mint-400/10 text-mint-300">
            <ScanText size={21} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-200">Pick codes from an image</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {fileName || "Upload a screenshot or paste an image from clipboard (Ctrl+V)."}
          </p>
          {scanning && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[.06]">
                <div className="h-full rounded-full bg-mint-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-mint-300">Reading image… {progress}%</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            className="secondary-button shrink-0"
            disabled={scanning || !courses.length}
            onClick={pasteFromClipboard}
            title={courses.length ? "Paste image from clipboard (Ctrl+V)" : "Parse UMS data first"}
          >
            {scanning ? <LoaderCircle size={16} className="animate-spin" /> : <ClipboardPaste size={16} />}
            {scanning ? "Scanning…" : "Paste image"}
          </button>

          <button
            type="button"
            className="secondary-button shrink-0"
            disabled={scanning || !courses.length}
            onClick={() => inputRef.current?.click()}
            title={courses.length ? "Upload a course screenshot" : "Parse UMS data first"}
          >
            {scanning ? <LoaderCircle size={16} className="animate-spin" /> : <ImageUp size={16} />}
            {scanning ? "Scanning…" : "Upload image"}
          </button>
        </div>
      </div>

      {detectedCodes.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-mint-400/15 bg-mint-400/[.06] px-3 py-2.5 text-xs text-mint-300">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <p>
            Added from image:{" "}
            <strong className="font-mono text-mint-300">{detectedCodes.join(", ")}</strong>
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-xs leading-5 text-rose-300" role="alert">{error}</p>}
      <p className="mt-2 text-[10px] text-slate-600">OCR runs in your browser. You can also press Ctrl+V anywhere to paste an image.</p>
    </div>
  );
}
