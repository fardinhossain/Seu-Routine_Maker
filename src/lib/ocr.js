function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fuzzyChar(ch) {
  const c = ch.toUpperCase();
  if (c === "0") return "[0OQ]";
  if (c === "1") return "[1IL|!]";
  if (c === "2") return "[2Z]";
  if (c === "3") return "[3ES]";
  if (c === "4") return "[4AH]";
  if (c === "5") return "[5S]";
  if (c === "6") return "[6GB]";
  if (c === "7") return "[7T]";
  if (c === "8") return "[8B]";
  if (c === "9") return "[9GQ]";
  if (c === "O") return "[O0Q]";
  if (c === "I") return "[I1L|!]";
  if (c === "L") return "[L1I]";
  if (c === "S") return "[S53]";
  if (c === "Z") return "[Z2]";
  if (c === "B") return "[B86]";
  if (c === "G") return "[G69]";
  if (c === "E") return "[E3]";
  if (c === "A") return "[A4]";
  if (c === "H") return "[H4]";
  if (c === "T") return "[T7]";
  return escapeRegExp(c);
}

function fuzzyPart(str) {
  return [...str].map(fuzzyChar).join("[\\s._-]?");
}

const TITLE_STOP_WORDS = new Set([
  "A",
  "AN",
  "AND",
  "COURSE",
  "FOR",
  "IN",
  "INTRODUCTION",
  "OF",
  "ON",
  "THE",
  "TO",
  "WITH",
]);

function normalizeOcrText(value = "") {
  return String(value)
    .toUpperCase()
    .replace(/[\u00a0\u200B-\u200D\uFEFF]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-");
}

function normalizeTitleText(value = "") {
  return normalizeOcrText(value)
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTitleWords(value = "") {
  return normalizeTitleText(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !TITLE_STOP_WORDS.has(word));
}

function isCloseWord(left = "", right = "") {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  if (Math.min(left.length, right.length) < 5) return false;

  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }

  return edits + (left.length - i) + (right.length - j) <= 1;
}

function lineContainsWord(lineWords, word) {
  return lineWords.some((lineWord) => isCloseWord(lineWord, word));
}

function lineMatchesTitle(line, titleWords, titleHasLab) {
  const lineWords = normalizeTitleText(line).split(" ").filter(Boolean);
  if (!lineWords.length) return false;

  const lineHasLab = lineContainsWord(lineWords, "LAB");
  if (titleHasLab && !lineHasLab) return false;
  if (!titleHasLab && lineHasLab) return false;

  const requiredWords = titleWords.filter((word) => word !== "LAB");
  if (requiredWords.length < 2) return false;

  return requiredWords.every((word) => lineContainsWord(lineWords, word));
}

export function extractCourseCodesFromOcr(text = "", courses = []) {
  const source = normalizeOcrText(text);
  const found = [];
  const availableCodes = new Set(courses.map((course) => course.courseCode.toUpperCase()));
  const lines = [];
  let currentOffset = 0;

  source.split(/\r?\n/).forEach((line) => {
    lines.push({ line, offset: currentOffset });
    currentOffset += line.length + 1;
  });

  const parsedCourses = courses
    .map((course) => {
      const code = course.courseCode.toUpperCase();
      const m = code.match(/^([A-Z-]+)(\d{2,4})\.(\d+)$/);
      if (!m) return null;

      const titleWords = significantTitleWords(course.courseTitle || "");
      return {
        code,
        prefix: m[1],
        number: m[2],
        section: m[3],
        titleKey: titleWords.join(" "),
        titleWords,
        titleHasLab: titleWords.includes("LAB"),
      };
    })
    .filter(Boolean);

  // Strategy 1: line-by-line with explicit SEC keyword.
  lines.forEach(({ line, offset }) => {
    const baseMatch = line.match(/\b([A-Z]{2,6})\s*(\d{2,4})\b/);
    const sectionMatch = line.match(/\bSEC(?:TION)?\s*[:#.-]?\s*(\d{1,3})\b/i);

    if (baseMatch && sectionMatch) {
      const code = `${baseMatch[1]}${baseMatch[2]}.${sectionMatch[1]}`;
      if (availableCodes.has(code)) found.push({ code, index: offset + baseMatch.index });
    }
  });

  // Strategy 2: parallel columns (code: ... section: ...).
  const baseColumn = [...source.matchAll(/\b([A-Z]{2,6})\s*(\d{2,4})\s*:/g)];
  const sectionColumn = [...source.matchAll(/\bSEC(?:TION)?\s*[:#.-]?\s*(\d{1,3})\b/gi)];
  if (baseColumn.length > 0 && baseColumn.length === sectionColumn.length) {
    baseColumn.forEach((baseMatch, index) => {
      const code = `${baseMatch[1]}${baseMatch[2]}.${sectionColumn[index][1]}`;
      if (availableCodes.has(code)) found.push({ code, index: baseMatch.index });
    });
  }

  // Strategy 3: per-course fuzzy regex for OCR substitutions and missing dots.
  parsedCourses.forEach(({ code, prefix, number, section }) => {
    const pattern = new RegExp(
      `(?:^|[^A-Z])${fuzzyPart(prefix)}\\s*${fuzzyPart(number)}(?:[\\s.,;:_\\-'"~|]{0,4})${fuzzyPart(section)}(?:$|[^0-9A-Z])`,
      "i",
    );
    const result = pattern.exec(source);
    if (result) found.push({ code, index: result.index });
  });

  const detectedSoFar = new Set(found.map((f) => f.code));

  // Strategy 4: same-line base code plus nearby section digit.
  for (const { line, offset } of lines) {
    for (const { code, prefix, number, section } of parsedCourses) {
      if (detectedSoFar.has(code)) continue;

      const basePat = new RegExp(
        `(?:^|[^A-Z0-9])${fuzzyPart(prefix)}\\s*${fuzzyPart(number)}(?:[^0-9A-Z]|$)`,
        "i",
      );
      const baseMatch = basePat.exec(line);
      if (!baseMatch) continue;

      const winStart = baseMatch.index + baseMatch[0].length - 1;
      const windowText = line.slice(Math.max(0, winStart), winStart + 25);
      const secPat = new RegExp(`^[^0-9A-Z]{0,3}${fuzzyPart(section)}(?:[^0-9]|$)`, "i");
      if (secPat.test(windowText)) {
        found.push({ code, index: offset + baseMatch.index });
        detectedSoFar.add(code);
      }
    }
  }

  // Strategy 5: unique title fallback for small mobile screenshots.
  const titleGroups = new Map();
  parsedCourses.forEach((course) => {
    if (course.titleWords.length < 2) return;
    titleGroups.set(course.titleKey, [...(titleGroups.get(course.titleKey) || []), course]);
  });
  const uniqueTitleCourses = [...titleGroups.values()]
    .filter((group) => group.length === 1)
    .map(([course]) => course);

  for (const { line, offset } of lines) {
    for (const course of uniqueTitleCourses) {
      if (detectedSoFar.has(course.code)) continue;
      if (!lineMatchesTitle(line, course.titleWords, course.titleHasLab)) continue;
      found.push({ code: course.code, index: offset });
      detectedSoFar.add(course.code);
    }
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
