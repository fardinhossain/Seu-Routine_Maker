export const STORAGE_KEYS = {
  rawHtml: "seu-routine.raw-html",
  courses: "seu-routine.courses",
  selectedCodes: "seu-routine.selected-codes",
  shortNames: "seu-routine.short-names",
  showFullCourse: "seu-routine.show-full-course",
  showFullTeacher: "seu-routine.show-full-teacher",
};

export function readStoredValue(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
  } catch {
    return fallback;
  }
}

export function writeStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearRoutineStorage() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}
