export const WEEK_DAYS = ["SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"];

export function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime12(time) {
  const [hoursText, minutes = "00"] = String(time).split(":");
  const hours = Number(hoursText);
  if (!Number.isFinite(hours)) return time;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

export function normalizeSectionCode(value = "") {
  const source = String(value)
    .toUpperCase()
    .replace(/[\u00a0\u200B-\u200D\uFEFF]/g, " ")
    .trim();
  const match = source.match(/\b([A-Z]{2,6})\s*(\d{2,4})\s*[.,:]\s*(\d{1,3})\b/);

  if (match) return `${match[1]}${match[2]}.${match[3]}`;
  return source.replace(/\s+/g, "");
}

export function parseCodeList(value = "") {
  const source = String(value)
    .toUpperCase()
    .replace(/[\u00a0\u200B-\u200D\uFEFF]/g, " ")
    .replace(/\b([A-Z]{2,6})\s*(\d{2,4})\s*[.,:]\s*(\d{1,3})\b/g, "$1$2.$3");

  return [...new Set(
    source
      .split(/[\s,;]+/)
      .map((code) => normalizeSectionCode(code))
      .filter(Boolean),
  )];
}

export function courseIdentity(code = "") {
  return normalizeSectionCode(code).split(".")[0];
}

export function uniqueCourseSelections(codes = []) {
  const seenCourses = new Set();
  return codes.filter((code) => {
    const identity = courseIdentity(code);
    if (!identity || seenCourses.has(identity)) return false;
    seenCourses.add(identity);
    return true;
  });
}

export function findDuplicateCourseSelections(codes = []) {
  const grouped = new Map();
  codes.forEach((code) => {
    const identity = courseIdentity(code);
    if (!identity) return;
    grouped.set(identity, [...(grouped.get(identity) || []), code]);
  });

  return [...grouped.entries()]
    .filter(([, sections]) => sections.length > 1)
    .map(([course, sections]) => ({ course, sections }));
}

function isLabCourse(course = {}) {
  return /\blab(?:oratory)?\b/i.test([
    course.courseTitle,
    course.shortTitle,
    course.shortName,
  ].filter(Boolean).join(" "));
}

export function buildRoutine(courses) {
  const mergeMorningSlots = courses.some((course) =>
    isLabCourse(course)
      && course.meetings.some((meeting) => timeToMinutes(meeting.start) === 8 * 60),
  );

  const entries = courses.flatMap((course) =>
    course.meetings.map((meeting, meetingIndex) => {
      const startMinutes = timeToMinutes(meeting.start);
      const useMergedMorningSlot = mergeMorningSlots
        && (startMinutes === 8 * 60 || startMinutes === 8 * 60 + 30);

      return {
        ...meeting,
        course,
        id: `${course.courseCode}-${meeting.day}-${meeting.start}-${meeting.end}-${meetingIndex}`,
        slotKey: useMergedMorningSlot ? "08:00/08:30" : meeting.start,
      };
    }),
  );

  const slotMap = new Map();
  entries.forEach((entry) => {
    const slot = slotMap.get(entry.slotKey) || {
      key: entry.slotKey,
      start: entry.start,
      ranges: [],
      ends: [],
    };

    if (!slot.ranges.some((range) => range.start === entry.start && range.end === entry.end)) {
      slot.ranges.push({ start: entry.start, end: entry.end });
    }
    slotMap.set(entry.slotKey, slot);
  });
  const slots = [...slotMap.values()]
    .map((slot) => {
      slot.ranges.sort((left, right) =>
        timeToMinutes(left.start) - timeToMinutes(right.start)
          || timeToMinutes(left.end) - timeToMinutes(right.end),
      );

      const starts = [...new Set(slot.ranges.map((range) => range.start))];
      const ends = [...new Set(slot.ranges.map((range) => range.end))];
      const result = {
        key: slot.key,
        start: starts[0],
        ends,
      };

      if (starts.length > 1) result.starts = starts;
      return result;
    })
    .sort((left, right) => timeToMinutes(left.start) - timeToMinutes(right.start));

  const conflictIds = new Set();
  const conflicts = [];

  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const first = entries[left];
      const second = entries[right];
      const overlaps = first.day === second.day
        && first.course.courseCode !== second.course.courseCode
        && timeToMinutes(first.start) < timeToMinutes(second.end)
        && timeToMinutes(second.start) < timeToMinutes(first.end);

      if (!overlaps) continue;

      conflictIds.add(first.id);
      conflictIds.add(second.id);
      const start = timeToMinutes(first.start) > timeToMinutes(second.start) ? first.start : second.start;
      const end = timeToMinutes(first.end) < timeToMinutes(second.end) ? first.end : second.end;
      conflicts.push({
        first: first.course.courseCode,
        second: second.course.courseCode,
        day: first.day,
        start,
        end,
      });
    }
  }

  return { entries, slots, conflictIds, conflicts };
}
