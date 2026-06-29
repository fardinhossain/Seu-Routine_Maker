function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fuzzyChar(ch) {
  const c = ch.toUpperCase();
  if (c === "0") return "[0OQ]";
  if (c === "1") return "[1IL|]";
  if (c === "2") return "[2Z]";
  if (c === "3") return "[3E]";
  if (c === "4") return "[4A]";
  if (c === "5") return "[5S]";
  if (c === "6") return "[6G]";
  if (c === "7") return "[7T]";
  if (c === "8") return "[8B]";
  if (c === "9") return "[9q]";
  if (c === "O") return "[O0Q]";
  if (c === "I") return "[I1L|]";
  if (c === "L") return "[L1I]";
  if (c === "S") return "[S5]";
  if (c === "Z") return "[Z2]";
  if (c === "B") return "[B8]";
  if (c === "G") return "[G6]";
  if (c === "E") return "[E3]";
  if (c === "A") return "[A4]";
  if (c === "T") return "[T7]";
  return escapeRegExp(c);
}

function fuzzyPart(str) {
  return [...str].map(fuzzyChar).join("[\\s._-]?");
}

export function extractCourseCodesFromOcr(text = "", courses = []) {
  const source = text
    .toUpperCase()
    .replace(/[\u00a0\u200B-\u200D\uFEFF]/g, " ")
    .replace(/[‐‑‒–—]/g, "-");
  const found = [];
  const availableCodes = new Set(courses.map((course) => course.courseCode.toUpperCase()));

  // Pre-parse courses so we reuse structured data in multiple strategies.
  const parsedCourses = courses
    .map((course) => {
      const code = course.courseCode.toUpperCase();
      const m = code.match(/^([A-Z-]+)(\d{2,4})\.(\d+)$/);
      return m ? { code, prefix: m[1], number: m[2], section: m[3] } : null;
    })
    .filter(Boolean);

  // --- Strategy 1: line-by-line with explicit SEC keyword ---
  let lineOffset = 0;
  source.split(/\r?\n/).forEach((line) => {
    const baseMatch = line.match(/\b([A-Z]{2,6})\s*(\d{2,4})\b/);
    const sectionMatch = line.match(/\bSEC(?:TION)?\s*[:#.-]?\s*(\d{1,3})\b/i);

    if (baseMatch && sectionMatch) {
      const code = `${baseMatch[1]}${baseMatch[2]}.${sectionMatch[1]}`;
      if (availableCodes.has(code)) found.push({ code, index: lineOffset + baseMatch.index });
    }
    lineOffset += line.length + 1;
  });

  // --- Strategy 2: parallel columns (code: ... section: ...) ---
  const baseColumn = [...source.matchAll(/\b([A-Z]{2,6})\s*(\d{2,4})\s*:/g)];
  const sectionColumn = [...source.matchAll(/\bSEC(?:TION)?\s*[:#.-]?\s*(\d{1,3})\b/gi)];
  if (baseColumn.length > 0 && baseColumn.length === sectionColumn.length) {
    baseColumn.forEach((baseMatch, index) => {
      const code = `${baseMatch[1]}${baseMatch[2]}.${sectionColumn[index][1]}`;
      if (availableCodes.has(code)) found.push({ code, index: baseMatch.index });
    });
  }

  // --- Strategy 3: per-course fuzzy regex (handles OCR character substitutions) ---
  // The separator allows 0–4 chars that can be any mix of whitespace / punctuation,
  // covering OCR variations like "CSE362.2", "CSE362 2", "CSE38I,I", "CSE44A.3".
  parsedCourses.forEach(({ code, prefix, number, section }) => {
    const pattern = new RegExp(
      `(?:^|[^A-Z])${fuzzyPart(prefix)}\\s*${fuzzyPart(number)}(?:[\\s.,;:_\\-'"~|]{0,4})${fuzzyPart(section)}(?:$|[^0-9A-Z])`,
      "i",
    );
    const result = pattern.exec(source);
    if (result) found.push({ code, index: result.index });
  });

  // --- Strategy 4: line-level fallback —————————————————————————————————————
  // When OCR drops the section number entirely (e.g. reads "CSE362" instead of
  // "CSE362.2" because the small section digit wasn't recognised on a dark row),
  // we still detect the code by:
  //   1. Finding the base code (prefix + number) on any line (fuzzy),
  //   2. Checking that the expected section digit appears within 25 characters
  //      immediately after the end of the base code match on that same line.
  // We only run this for codes not yet detected by Strategies 1-3.
  const detectedSoFar = new Set(found.map((f) => f.code));
  lineOffset = 0;
  for (const line of source.split(/\r?\n/)) {
    for (const { code, prefix, number, section } of parsedCourses) {
      if (detectedSoFar.has(code)) continue;

      const basePat = new RegExp(
        `(?:^|[^A-Z0-9])${fuzzyPart(prefix)}\\s*${fuzzyPart(number)}(?:[^0-9A-Z]|$)`,
        "i",
      );
      const baseMatch = basePat.exec(line);
      if (!baseMatch) continue;

      // Window: from the last consumed char of the base match to +25 chars.
      const winStart = baseMatch.index + baseMatch[0].length - 1;
      const window = line.slice(Math.max(0, winStart), winStart + 25);
      // The section digit must appear as the first significant thing in the window
      // (optionally preceded by up to 3 separator characters).
      const secPat = new RegExp(`^[^0-9A-Z]{0,3}${fuzzyPart(section)}(?:[^0-9]|$)`, "i");
      if (secPat.test(window)) {
        found.push({ code, index: lineOffset + baseMatch.index });
        detectedSoFar.add(code);
      }
    }
    lineOffset += line.length + 1;
  }

  const earliestMatches = new Map();
  found.forEach((item) => {
    const current = earliestMatches.get(item.code);
    if (!current || item.index < current.index) earliestMatches.set(item.code, item);
  });

  return [...earliestMatches.values()]
    .sort((left, right) => left.index - right.index)
    .map((item) => item.code);
}
