const COURSE_CODE_PATTERN = /\b[A-Z]{2,}[A-Z0-9-]*\d{2,4}(?:\.\d+)+\b/i;
const COURSE_CODE_COUNT_PATTERN = /\b[A-Z]{2,}[A-Z0-9-]*\d{2,4}(?:\.\d+)+\b/gi;
const DASHBOARD_SECTION_CODE_PATTERN = /\b[A-Z]{2,4}\d{3,4}\.\d{1,2}\b/g;
const DASHBOARD_SECTION_CODE_TEST = /\b[A-Z]{2,4}\d{3,4}\.\d{1,2}\b/i;
const DASHBOARD_SCHEDULE_PATTERN = /\b(SUN|MON|TUE|WED|THU|FRI|SAT)\s*#\s*(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})\s*@\s*([A-Z0-9-]+)\b/g;
const DASHBOARD_SCHEDULE_TEST = /\b(SUN|MON|TUE|WED|THU|FRI|SAT)\s*#\s*(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})\s*@\s*([A-Z0-9-]+)\b/i;
const DASHBOARD_TEACHER_PATTERN = /\[([A-Z]{2,6})\]\s*([^<\n]+)/;
const DASHBOARD_SOURCE_TYPE = "dashboard-registered-courses";
const MEETING_PATTERN = /\b(SAT|SUN|MON|TUE|WED|THU|FRI)\s*#\s*(\d{1,2}:\d{2})\s*(?:~|–|—|-)\s*(\d{1,2}:\d{2})\s*@\s*([^\s,;|<]+)/gi;

function decodeBytes(bytes, charset = "utf-8") {
  try {
    return new TextDecoder(charset.replace(/["']/g, "").trim() || "utf-8").decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  }
}

function decodeQuotedPrintable(value, charset) {
  const source = value.replace(/=\r?\n/g, "");
  const bytes = [];
  const encoder = new TextEncoder();

  for (let index = 0; index < source.length; index += 1) {
    const hex = source.slice(index + 1, index + 3);
    if (source[index] === "=" && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }

    const codePoint = source.codePointAt(index);
    const character = String.fromCodePoint(codePoint);
    bytes.push(...encoder.encode(character));
    if (codePoint > 0xffff) index += 1;
  }

  return decodeBytes(bytes, charset);
}

function decodeBase64(value, charset) {
  const binary = atob(value.replace(/\s+/g, ""));
  return decodeBytes([...binary].map((character) => character.charCodeAt(0)), charset);
}

function decodeMimePart(part) {
  const separator = part.search(/\r?\n\r?\n/);
  if (separator < 0) return "";

  const headers = part.slice(0, separator);
  const body = part.slice(separator).replace(/^\r?\n\r?\n/, "").replace(/\r?\n$/, "");
  const encoding = headers.match(/Content-Transfer-Encoding:\s*([^\s;]+)/i)?.[1]?.toLowerCase();
  const charset = headers.match(/charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s;]+))/i);
  const charsetName = charset?.[1] || charset?.[2] || charset?.[3] || "utf-8";

  if (encoding === "quoted-printable") return decodeQuotedPrintable(body, charsetName);
  if (encoding === "base64") return decodeBase64(body, charsetName);
  return body;
}

export function extractHtmlPayload(rawDocument = "") {
  const looksLikeMhtml = /Content-Type:\s*multipart\/related/i.test(rawDocument)
    || (/MIME-Version:/i.test(rawDocument) && /Content-Type:\s*text\/html/i.test(rawDocument));
  if (!looksLikeMhtml) return rawDocument;

  const boundaryMatch = rawDocument.match(
    /boundary\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s;\r\n]+))/i,
  );
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2] || boundaryMatch?.[3];
  const parts = boundary ? rawDocument.split(`--${boundary}`) : [rawDocument];
  const htmlPart = parts.find((part) => /Content-Type:\s*text\/html\b/i.test(part));

  if (!htmlPart) {
    throw new Error("The MHTML file does not contain a readable HTML page.");
  }

  const html = decodeMimePart(htmlPart);
  if (!html.trim()) {
    throw new Error("The HTML page inside the MHTML file is empty.");
  }
  return html;
}

function cleanText(value = "") {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSectionCode(value = "") {
  return cleanText(value).toUpperCase().replace(/\s+/g, "");
}

function sectionCodeParts(sectionCode = "") {
  const normalized = normalizeSectionCode(sectionCode);
  const match = normalized.match(/^([A-Z]{2,4}\d{3,4})\.(\d{1,2})$/);
  return {
    baseCourseCode: match?.[1] || normalized.split(".")[0] || "",
    section: match?.[2] || "",
  };
}

function textWithBreaks(element) {
  if (!element) return "";

  const lines = [...element.querySelectorAll("p, li")]
    .map((node) => cleanText(node.textContent))
    .filter(Boolean);

  if (lines.length) return lines.join("\n");

  const clone = element.cloneNode(true);
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  return clone.textContent || "";
}

function structuralText(node) {
  if (!node) return "";

  const blockTags = new Set([
    "ARTICLE",
    "DIV",
    "LI",
    "MAIN",
    "OL",
    "P",
    "SECTION",
    "TABLE",
    "TBODY",
    "TD",
    "TH",
    "THEAD",
    "TR",
    "UL",
  ]);

  function visit(current) {
    if (!current) return "";
    if (current.nodeType === 3) return current.textContent || "";
    if (![1, 9, 11].includes(current.nodeType)) return "";

    const tagName = current.tagName || "";
    if (tagName === "BR") return "\n";

    const childText = [...current.childNodes].map((child) => visit(child)).join("");
    return blockTags.has(tagName) ? `${childText}\n` : childText;
  }

  return visit(node)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function directText(element) {
  return cleanText(
    [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent || "")
      .join(" "),
  );
}

function countMatches(source, pattern) {
  pattern.lastIndex = 0;
  return [...String(source).matchAll(pattern)].length;
}

function uniqueMeetings(meetings = []) {
  const seen = new Set();
  return meetings.filter((meeting) => {
    const key = `${meeting.day}-${meeting.start}-${meeting.end}-${meeting.room}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseMeetings(element) {
  const source = textWithBreaks(element);
  const meetings = [];
  let match;

  MEETING_PATTERN.lastIndex = 0;
  while ((match = MEETING_PATTERN.exec(source)) !== null) {
    const meeting = {
      day: match[1].toUpperCase(),
      start: match[2].padStart(5, "0"),
      end: match[3].padStart(5, "0"),
      room: match[4].replace(/[.)]+$/, "").toUpperCase(),
    };

    const key = `${meeting.day}-${meeting.start}-${meeting.end}-${meeting.room}`;
    if (!meetings.some((item) => `${item.day}-${item.start}-${item.end}-${item.room}` === key)) {
      meetings.push(meeting);
    }
  }

  return meetings;
}

function extractDashboardSectionCodeMatches(source = "") {
  const matches = [];
  const normalizedSource = String(source).toUpperCase();
  let match;

  DASHBOARD_SECTION_CODE_PATTERN.lastIndex = 0;
  while ((match = DASHBOARD_SECTION_CODE_PATTERN.exec(normalizedSource)) !== null) {
    matches.push({
      code: normalizeSectionCode(match[0]),
      index: match.index,
    });
  }

  return matches;
}

function extractDashboardSectionCodes(source = "") {
  return extractDashboardSectionCodeMatches(source).map((match) => match.code);
}

function parseDashboardSchedules(source = "") {
  const schedules = [];
  const normalizedSource = String(source).toUpperCase();
  let match;

  DASHBOARD_SCHEDULE_PATTERN.lastIndex = 0;
  while ((match = DASHBOARD_SCHEDULE_PATTERN.exec(normalizedSource)) !== null) {
    schedules.push({
      day: match[1].toUpperCase(),
      start: match[2].padStart(5, "0"),
      end: match[3].padStart(5, "0"),
      room: match[4].replace(/[.)]+$/, "").toUpperCase(),
    });
  }

  return uniqueMeetings(schedules);
}

function parseDashboardTeacher(source = "") {
  const match = String(source).match(DASHBOARD_TEACHER_PATTERN);
  if (!match) {
    return { teacherInitial: "TBA", teacherName: "" };
  }

  const scheduleStart = match[2].search(/\b(SUN|MON|TUE|WED|THU|FRI|SAT)\s*#/i);
  const rawName = scheduleStart >= 0 ? match[2].slice(0, scheduleStart) : match[2];
  const teacherName = cleanText(rawName).replace(/\s+[^\s@]+@[^\s@]+\.[^\s@]+.*$/i, "").trim();

  return {
    teacherInitial: cleanText(match[1]).toUpperCase(),
    teacherName,
  };
}

function dashboardLines(source = "") {
  return String(source)
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean);
}

function isDashboardTitleNoise(line = "", sectionCode = "") {
  const normalized = cleanText(line);
  const upper = normalized.toUpperCase();

  if (!normalized) return true;
  if (normalizeSectionCode(normalized) === sectionCode) return true;
  if (DASHBOARD_SECTION_CODE_TEST.test(normalized)) return true;
  if (DASHBOARD_SCHEDULE_TEST.test(normalized)) return true;
  if (/^\[[A-Z]{2,6}\]/.test(upper)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(normalized)) return true;
  if (["COURSE", "FACULTY", "SCHEDULE", "REGISTERED COURSES", "STUDENT DASHBOARD"].includes(upper)) return true;

  return false;
}

function inferDashboardTitle(source = "", sectionCode = "") {
  const lines = dashboardLines(source);
  const codeLineIndex = lines.findIndex((line) => {
    const match = line.match(DASHBOARD_SECTION_CODE_TEST);
    return match && normalizeSectionCode(match[0]) === sectionCode;
  });
  const lineCandidate = lines
    .slice(Math.max(0, codeLineIndex + 1))
    .find((line) => !isDashboardTitleNoise(line, sectionCode));

  if (lineCandidate) return lineCandidate;

  const compactSource = cleanText(source);
  const codeIndex = compactSource.toUpperCase().indexOf(sectionCode);
  if (codeIndex < 0) return "Untitled course";

  const afterCode = compactSource.slice(codeIndex + sectionCode.length).trim();
  const stopIndexes = [
    afterCode.search(DASHBOARD_TEACHER_PATTERN),
    afterCode.search(DASHBOARD_SCHEDULE_TEST),
  ].filter((index) => index >= 0);
  const titleEnd = stopIndexes.length ? Math.min(...stopIndexes) : afterCode.length;
  const inlineTitle = cleanText(afterCode.slice(0, titleEnd));

  return inlineTitle || "Untitled course";
}

export function makeShortTitle(title = "") {
  const normalized = cleanText(title).toLowerCase();
  const knownTitles = {
    "operating systems": "OS",
    "operating systems lab": "OS Lab",
    "introduction to embedded systems": "ES",
    "introduction to embedded systems lab": "ES Lab",
    "computer graphics & animation": "CGA",
    "computer graphics and animation": "CGA",
    "computer graphics & animation lab": "CGA Lab",
    "computer graphics and animation lab": "CGA Lab",
  };

  if (knownTitles[normalized]) return knownTitles[normalized];

  const isLab = /\blab(?:oratory)?\b/i.test(title);
  const words = cleanText(title)
    .replace(/\blab(?:oratory)?\b/gi, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !["introduction", "intro", "to", "of", "the", "and", "for"].includes(word.toLowerCase()));

  const acronym = words.length > 1
    ? words.map((word) => word[0]).join("").toUpperCase().slice(0, 6)
    : (words[0] || "Course").slice(0, 5).toUpperCase();

  return `${acronym}${isLab ? " Lab" : ""}`;
}

function parseDashboardCourseBlock(source = "", preferredCode = "") {
  const sectionCode = normalizeSectionCode(preferredCode || extractDashboardSectionCodes(source)[0] || "");
  if (!sectionCode) return null;

  const schedules = parseDashboardSchedules(source);
  if (!schedules.length) return null;

  const { baseCourseCode, section } = sectionCodeParts(sectionCode);
  const courseTitle = inferDashboardTitle(source, sectionCode);
  const shortTitle = makeShortTitle(courseTitle);
  const { teacherInitial, teacherName } = parseDashboardTeacher(source);

  return {
    courseCode: sectionCode,
    sectionCode,
    baseCourseCode,
    section,
    courseTitle,
    shortTitle,
    shortName: shortTitle,
    credits: "",
    faculty: teacherInitial,
    facultyName: teacherName,
    teacherInitial,
    teacherName,
    meetings: schedules,
    schedules,
    sourceType: DASHBOARD_SOURCE_TYPE,
  };
}

function mergeCourseEntries(entries = []) {
  const courses = new Map();

  entries.filter(Boolean).forEach((entry) => {
    const current = courses.get(entry.courseCode);
    if (!current) {
      courses.set(entry.courseCode, entry);
      return;
    }

    current.meetings = uniqueMeetings([...current.meetings, ...entry.meetings]);
    current.schedules = current.meetings;
    if (current.courseTitle === "Untitled course" && entry.courseTitle !== "Untitled course") {
      current.courseTitle = entry.courseTitle;
      current.shortTitle = entry.shortTitle;
      current.shortName = entry.shortName;
    }
    if (current.faculty === "TBA" && entry.faculty !== "TBA") {
      current.faculty = entry.faculty;
      current.teacherInitial = entry.teacherInitial;
      current.facultyName = entry.facultyName;
      current.teacherName = entry.teacherName;
    }
  });

  return [...courses.values()].sort((a, b) =>
    a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }),
  );
}

function findDashboardCourseBlocks(document) {
  const blocks = [];
  const seen = new Set();
  const elements = [...document.querySelectorAll("td, th, li, div, span, p")];
  const codeElements = elements.filter((element) => {
    const ownText = directText(element);
    const text = ownText || (element.children.length ? "" : cleanText(element.textContent));
    return DASHBOARD_SECTION_CODE_TEST.test(text);
  });

  codeElements.forEach((element) => {
    const match = (directText(element) || cleanText(element.textContent)).match(DASHBOARD_SECTION_CODE_TEST);
    const sectionCode = normalizeSectionCode(match?.[0] || "");
    let current = element;
    let fallback = null;

    while (current && current !== document.body) {
      const source = structuralText(current);
      const codes = extractDashboardSectionCodes(source);
      const schedules = parseDashboardSchedules(source);

      if (codes.includes(sectionCode) && schedules.length) {
        const candidate = { source, sectionCode };
        if (codes.length === 1) {
          fallback = candidate;
          break;
        }
        if (!fallback) fallback = candidate;
      }

      current = current.parentElement;
    }

    if (!fallback) return;

    const key = `${fallback.sectionCode}-${fallback.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      blocks.push(fallback);
    }
  });

  return blocks;
}

function parseDashboardTextChunks(source = "") {
  const codeMatches = extractDashboardSectionCodeMatches(source);
  return codeMatches.map((match, index) => {
    const nextMatch = codeMatches[index + 1];
    const chunk = source.slice(match.index, nextMatch?.index ?? source.length);
    return {
      source: chunk,
      sectionCode: match.code,
    };
  });
}

function parseDashboardRegisteredCourses(document) {
  const source = structuralText(document.body || document);
  const codeMatches = extractDashboardSectionCodeMatches(source);
  const scheduleCount = countMatches(source.toUpperCase(), DASHBOARD_SCHEDULE_PATTERN);
  const stats = {
    courseSectionCodeCount: codeMatches.length,
    scheduleLineCount: scheduleCount,
  };

  if (!codeMatches.length) return { courses: [], ...stats };
  if (!scheduleCount) {
    return {
      courses: [],
      error: "Course sections found, but no timetable schedule found.",
      ...stats,
    };
  }

  let blocks = findDashboardCourseBlocks(document);
  let courses = mergeCourseEntries(
    blocks.map((block) => parseDashboardCourseBlock(block.source, block.sectionCode)),
  );

  if (!courses.length) {
    blocks = parseDashboardTextChunks(source);
    courses = mergeCourseEntries(
      blocks.map((block) => parseDashboardCourseBlock(block.source, block.sectionCode)),
    );
  }

  return { courses, ...stats };
}

function attachParseDebug(courses, debug) {
  Object.defineProperty(courses, "parseDebug", {
    value: debug,
    enumerable: false,
    configurable: true,
  });

  return courses;
}

function logParseDebug(debug) {
  if (typeof console === "undefined" || typeof console.info !== "function") return;
  console.info("UMS parser debug", {
    courseSectionCodesFound: debug.courseSectionCodesFound,
    scheduleLinesFound: debug.scheduleLinesFound,
    sourceType: debug.sourceType,
    courses: debug.courses,
  });
}

function rowCells(row) {
  if (row.tagName === "TR") {
    return [...row.children].filter((cell) => ["TD", "TH"].includes(cell.tagName));
  }
  return [...row.children];
}

function parseRow(row) {
  const cells = rowCells(row);
  if (cells.length < 6) return null;

  const texts = cells.map((cell) => cleanText(cell.textContent));
  const codeMatch = texts[0]?.match(COURSE_CODE_PATTERN);
  if (!codeMatch) return null;

  const code = codeMatch[0].toUpperCase().replace(/\s/g, "");
  const scheduleOptions = cells
    .map((cell) => parseMeetings(cell))
    .sort((a, b) => b.length - a.length);
  const meetings = scheduleOptions[0] || [];
  if (!meetings.length) return null;

  const facultyText = texts[3] || texts.find((text) => /\[[A-Z0-9]+\]/i.test(text)) || "";
  const facultyMatch = facultyText.match(/\[([^\]]+)\]/);
  const title = texts[1] || "Untitled course";

  return {
    courseCode: code,
    courseTitle: title,
    shortTitle: makeShortTitle(title),
    credits: texts[2] || "",
    faculty: facultyMatch ? facultyMatch[1].trim().toUpperCase() : "TBA",
    facultyName: facultyText.replace(/^\s*\[[^\]]+\]\s*/, "").trim(),
    meetings,
  };
}

export function parseUmsHtml(rawHtml) {
  if (!rawHtml || !rawHtml.trim()) {
    throw new Error("Please upload or paste your UMS HTML first.");
  }

  const htmlPayload = extractHtmlPayload(rawHtml);
  const document = new DOMParser().parseFromString(htmlPayload, "text/html");
  const rows = [
    ...document.querySelectorAll("table tr"),
    ...document.querySelectorAll(".ums-grid-offered-section"),
  ];

  const courses = new Map();
  rows.forEach((row) => {
    const parsed = parseRow(row);
    if (!parsed) return;

    const current = courses.get(parsed.courseCode);
    if (!current) {
      courses.set(parsed.courseCode, parsed);
      return;
    }

    const existing = new Set(current.meetings.map((item) => JSON.stringify(item)));
    parsed.meetings.forEach((meeting) => {
      if (!existing.has(JSON.stringify(meeting))) current.meetings.push(meeting);
    });
  });

  const result = [...courses.values()].sort((a, b) =>
    a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }),
  );

  if (result.length) {
    const source = structuralText(document.body || document);
    const debug = {
      courseSectionCodesFound: countMatches(source, COURSE_CODE_COUNT_PATTERN),
      scheduleLinesFound: countMatches(source, MEETING_PATTERN),
      sourceType: "offered-sections",
      courses: result,
    };
    logParseDebug(debug);
    return attachParseDebug(result, debug);
  }

  const dashboardResult = parseDashboardRegisteredCourses(document);
  if (dashboardResult.error) {
    const debug = {
      courseSectionCodesFound: dashboardResult.courseSectionCodeCount,
      scheduleLinesFound: dashboardResult.scheduleLineCount,
      sourceType: DASHBOARD_SOURCE_TYPE,
      courses: [],
    };
    logParseDebug(debug);
    throw new Error(dashboardResult.error);
  }

  if (dashboardResult.courses.length) {
    const debug = {
      courseSectionCodesFound: dashboardResult.courseSectionCodeCount,
      scheduleLinesFound: dashboardResult.scheduleLineCount,
      sourceType: DASHBOARD_SOURCE_TYPE,
      courses: dashboardResult.courses,
    };
    logParseDebug(debug);
    return attachParseDebug(dashboardResult.courses, debug);
  }

  throw new Error(
    "No valid course sections with timetable data were found. Make sure this is a saved UMS Offered Sections HTML or MHTML page.",
  );
}
