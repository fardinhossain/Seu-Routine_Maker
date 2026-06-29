import { timeToMinutes, WEEK_DAYS } from "./routine.js";

const dayOrder = new Map(WEEK_DAYS.map((day, index) => [day, index]));
const filterDayOrder = new Map(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, index) => [day, index]));
const dayNames = {
  SAT: "Saturday",
  SUN: "Sunday",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
};

function isLabCourse(course) {
  return /\blab(?:oratory)?\b/i.test(course.courseTitle || "");
}

function normalizeTime24(time) {
  const [hours, minutes = "00"] = String(time).split(":");
  return `${String(Number(hours)).padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function normalizedMeetings(course) {
  return course.meetings
    .map(({ day, start, end }) => ({ day, start, end }))
    .sort((left, right) =>
      (dayOrder.get(left.day) ?? 99) - (dayOrder.get(right.day) ?? 99)
      || timeToMinutes(left.start) - timeToMinutes(right.start)
      || timeToMinutes(left.end) - timeToMinutes(right.end),
    );
}

export function dayPatternKey(meetings = []) {
  return [...new Set(meetings.map((meeting) => meeting.day))]
    .sort((left, right) => (dayOrder.get(left) ?? 99) - (dayOrder.get(right) ?? 99))
    .join("|");
}

export function timeSlotKey(meeting) {
  return `${normalizeTime24(meeting.start)}|${normalizeTime24(meeting.end)}`;
}

export function getDayPatternOptions(courses = []) {
  const options = new Map();

  courses.forEach((course) => {
    const value = dayPatternKey(course.meetings);
    if (!value || options.has(value)) return;
    options.set(value, value.split("|").map((day) => dayNames[day] || day).join(" - "));
  });

  return [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => {
      const leftDays = left.value.split("|");
      const rightDays = right.value.split("|");
      return leftDays.length - rightDays.length
        || (filterDayOrder.get(leftDays[0]) ?? 99) - (filterDayOrder.get(rightDays[0]) ?? 99)
        || left.label.localeCompare(right.label);
    });
}

export function getTimeSlotOptions(courses = []) {
  const options = new Map();

  courses.forEach((course) => {
    course.meetings.forEach((meeting) => {
      const value = timeSlotKey(meeting);
      if (!options.has(value)) {
        const start = normalizeTime24(meeting.start);
        const end = normalizeTime24(meeting.end);
        options.set(value, {
          value,
          label: `${start} - ${end}`,
          start,
          end,
        });
      }
    });
  });

  return [...options.values()]
    .sort((left, right) =>
      timeToMinutes(left.start) - timeToMinutes(right.start)
      || timeToMinutes(left.end) - timeToMinutes(right.end),
    )
    .map(({ value, label }) => ({ value, label }));
}

export function matchesScheduleFilters(course, dayFilter = "ALL", timeFilter = "ALL") {
  const matchesDay = dayFilter === "ALL" || dayPatternKey(course.meetings) === dayFilter;
  const matchesTime = timeFilter === "ALL"
    || course.meetings.some((meeting) => timeSlotKey(meeting) === timeFilter);
  return matchesDay && matchesTime;
}

export function scheduleGroupKey(course) {
  return normalizedMeetings(course)
    .map((meeting) => `${meeting.day}:${meeting.start}-${meeting.end}`)
    .join("|");
}

export function groupSectionsBySchedule(courses = []) {
  const groups = new Map();

  courses.forEach((course) => {
    const key = scheduleGroupKey(course);
    if (!key) return;

    const current = groups.get(key) || {
      key,
      meetings: normalizedMeetings(course),
      courses: [],
    };
    current.courses.push(course);
    groups.set(key, current);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      courses: group.courses.sort((left, right) =>
        Number(isLabCourse(left)) - Number(isLabCourse(right))
        || left.courseCode.localeCompare(right.courseCode, undefined, { numeric: true }),
      ),
    }))
    .sort((left, right) => {
      const leftStart = Math.min(...left.meetings.map((meeting) => timeToMinutes(meeting.start)));
      const rightStart = Math.min(...right.meetings.map((meeting) => timeToMinutes(meeting.start)));
      const leftIsLabOnly = left.courses.every(isLabCourse);
      const rightIsLabOnly = right.courses.every(isLabCourse);
      const leftDay = Math.min(...left.meetings.map((meeting) => dayOrder.get(meeting.day) ?? 99));
      const rightDay = Math.min(...right.meetings.map((meeting) => dayOrder.get(meeting.day) ?? 99));
      return leftStart - rightStart
        || Number(leftIsLabOnly) - Number(rightIsLabOnly)
        || leftDay - rightDay
        || left.key.localeCompare(right.key);
    });
}
