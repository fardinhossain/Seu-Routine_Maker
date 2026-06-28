import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { makeShortTitle, parseUmsHtml } from "../src/lib/parser.js";
import { extractCourseCodesFromOcr } from "../src/lib/ocr.js";
import {
  buildRoutine,
  findDuplicateCourseSelections,
  formatTime12,
  parseCodeList,
  uniqueCourseSelections,
} from "../src/lib/routine.js";

global.DOMParser = new JSDOM("").window.DOMParser;

const html = `
  <div class="ums-grid-offered-section">
    <div>CSE361.3</div>
    <div>Operating Systems</div>
    <div>3</div>
    <div><span>[MMIS] Md. Ismail</span></div>
    <div>37</div>
    <div><p>SUN # 16:30 ~ 17:50 @ SEU319</p><p>TUE # 16:30 ~ 17:50 @ SEU319</p></div>
    <div>REGULAR</div><div>Preregistered Course.</div>
  </div>`;

const courses = parseUmsHtml(html);
assert.equal(courses.length, 1);
assert.equal(courses[0].courseCode, "CSE361.3");
assert.equal(courses[0].courseTitle, "Operating Systems");
assert.equal(courses[0].shortTitle, "OS");
assert.equal(courses[0].faculty, "MMIS");
assert.deepEqual(courses[0].meetings, [
  { day: "SUN", start: "16:30", end: "17:50", room: "SEU319" },
  { day: "TUE", start: "16:30", end: "17:50", room: "SEU319" },
]);
assert.equal(makeShortTitle("Operating Systems Lab"), "OS Lab");
assert.equal(makeShortTitle("Introduction to Embedded Systems"), "ES");
assert.equal(makeShortTitle("Computer Graphics & Animation Lab"), "CGA Lab");

const conflictRoutine = buildRoutine([
  {
    courseCode: "CSE361.3",
    meetings: [{ day: "SUN", start: "13:30", end: "14:50", room: "SEU319" }],
  },
  {
    courseCode: "CSE443.5",
    meetings: [{ day: "SUN", start: "14:00", end: "15:20", room: "SEU333" }],
  },
  {
    courseCode: "CSE444.1",
    meetings: [
      { day: "SUN", start: "15:20", end: "17:20", room: "SEU613" },
      { day: "TUE", start: "13:30", end: "14:50", room: "SEU613" },
    ],
  },
]);

assert.equal(conflictRoutine.conflicts.length, 1);
assert.deepEqual(conflictRoutine.conflicts[0], {
  first: "CSE361.3",
  second: "CSE443.5",
  day: "SUN",
  start: "14:00",
  end: "14:50",
});
assert.equal(conflictRoutine.conflictIds.size, 2);
assert.equal(formatTime12("08:00"), "8:00 AM");
assert.equal(formatTime12("13:30"), "1:30 PM");
assert.equal(formatTime12("00:15"), "12:15 AM");

const sharedStartRoutine = buildRoutine([
  {
    courseCode: "CSE381.1",
    meetings: [{ day: "MON", start: "11:30", end: "12:50", room: "SEU331" }],
  },
  {
    courseCode: "CSE362.2",
    meetings: [{ day: "TUE", start: "11:30", end: "13:30", room: "SEU213A" }],
  },
]);
assert.deepEqual(sharedStartRoutine.slots, [
  { key: "11:30", start: "11:30", ends: ["12:50", "13:30"] },
]);

const repeatedCourseCodes = parseCodeList("CSE361.6\nCSE443.4\nCSE362.4\nCSE362.3");
assert.deepEqual(uniqueCourseSelections(repeatedCourseCodes), ["CSE361.6", "CSE443.4", "CSE362.4"]);
assert.deepEqual(findDuplicateCourseSelections(repeatedCourseCodes), [
  { course: "CSE362", sections: ["CSE362.4", "CSE362.3"] },
]);

assert.deepEqual(
  extractCourseCodesFromOcr("Selected: CSE 361.3, CSE443,4 and CSE 444:1", [
    { courseCode: "CSE361.3" },
    { courseCode: "CSE443.4" },
    { courseCode: "CSE444.1" },
  ]),
  ["CSE361.3", "CSE443.4", "CSE444.1"],
);

assert.deepEqual(
  extractCourseCodesFromOcr(
    [
      "CSE444: Computer Graphics & Animation Lab   Sec 1",
      "CSE361: Operating Systems (Theory)           Sec 6",
      "CSE381: Introduction to Embedded Systems     Sec 1",
      "CSE443: Computer Graphics & Animation        Sec 3",
      "CSE382: Introduction to Embedded Systems Lab Sec 2",
      "CSE362: Operating Systems Lab                 Sec 2",
      "CSE361: Operating Systems (Theory)           Sec 6",
    ].join("\n"),
    [
      { courseCode: "CSE444.1" },
      { courseCode: "CSE361.6" },
      { courseCode: "CSE381.1" },
      { courseCode: "CSE443.3" },
      { courseCode: "CSE382.2" },
      { courseCode: "CSE362.2" },
    ],
  ),
  ["CSE444.1", "CSE361.6", "CSE381.1", "CSE443.3", "CSE382.2", "CSE362.2"],
);

assert.deepEqual(
  extractCourseCodesFromOcr(
    [
      "CSE444: Computer Graphics & Animation Lab",
      "CSE361: Operating Systems",
      "CSE381: Embedded Systems",
      "Section",
      "Sec 1",
      "Sec 6",
      "Sec 1",
    ].join("\n"),
    [
      { courseCode: "CSE444.1" },
      { courseCode: "CSE361.6" },
      { courseCode: "CSE381.1" },
    ],
  ),
  ["CSE444.1", "CSE361.6", "CSE381.1"],
);

console.log("Parser and conflict checks passed.");
