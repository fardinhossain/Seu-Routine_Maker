function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fuzzyChar(ch) {
  const c = ch.toUpperCase();
  if (c === "0") return "[0OQ]";
  if (c === "1") return "[1IL|i!\\]\\[]";
  if (c === "2") return "[2Zz]";
  if (c === "3") return "[3EB]";
  if (c === "4") return "[4A]";
  if (c === "5") return "[5Ss]";
  if (c === "6") return "[6bG]";
  if (c === "7") return "[7T]";
  if (c === "8") return "[8B]";
  if (c === "9") return "[9gq]";
  if (c === "O") return "[O0Q]";
  if (c === "I") return "[I1L|]";
  if (c === "L") return "[L1I|]";
  if (c === "S") return "[S5]";
  if (c === "Z") return "[Z2]";
  if (c === "B") return "[B83]";
  if (c === "G") return "[G6Cc]";
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

  const baseColumn = [...source.matchAll(/\b([A-Z]{2,6})\s*(\d{2,4})\s*:/g)];
  const sectionColumn = [...source.matchAll(/\bSEC(?:TION)?\s*[:#.-]?\s*(\d{1,3})\b/gi)];
  if (baseColumn.length > 0 && baseColumn.length === sectionColumn.length) {
    baseColumn.forEach((baseMatch, index) => {
      const code = `${baseMatch[1]}${baseMatch[2]}.${sectionColumn[index][1]}`;
      if (availableCodes.has(code)) found.push({ code, index: baseMatch.index });
    });
  }

  courses.forEach((course) => {
    const code = course.courseCode.toUpperCase();
    const match = code.match(/^([A-Z-]+)(\d{2,4})\.(\d+)$/);
    if (!match) return;

    const [, prefix, number, section] = match;
    const pattern = new RegExp(
      `(?:^|[^A-Z])${fuzzyPart(prefix)}\\s*${fuzzyPart(number)}(?:\\s*(?:[.,:;\\-_/'"~\\|]|SEC(?:TION)?|S)?\\s*)${fuzzyPart(section)}(?:$|[^0-9A-Z])`,
      "i",
    );
    const result = pattern.exec(source);
    if (result) found.push({ code, index: result.index });
  });

  const earliestMatches = new Map();
  found.forEach((item) => {
    const current = earliestMatches.get(item.code);
    if (!current || item.index < current.index) earliestMatches.set(item.code, item);
  });

  return [...earliestMatches.values()]
    .sort((left, right) => left.index - right.index)
    .map((item) => item.code);
}
