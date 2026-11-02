import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const [html, app, serviceWorker, build] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("app.js", "utf8"),
  readFile("service-worker.js", "utf8"),
  readFile("scripts/build-static.mjs", "utf8")
]);

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML must not contain duplicate IDs");

const referencedIds = [...app.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !ids.includes(id)))];
assert.deepEqual(missingIds, [], "Every static app.js ID lookup must exist in index.html");

assert.match(html, /name=["']viewport["'][^>]*width=device-width/i, "Responsive viewport meta tag is required");
assert.ok(!html.includes('class="admin-command-hero"'), "Librarian dashboard must not contain a duplicate command hero");

function functionSource(name) {
  const marker = "async function " + name + "(";
  const start = app.indexOf(marker);
  assert.ok(start >= 0, "Expected async handler " + name);
  const next = app.slice(start + marker.length).search(/\n(?:async )?function\s+/);
  return next < 0 ? app.slice(start) : app.slice(start, start + marker.length + next);
}

for (const name of ["register", "updatePhoto", "registerBook", "recordAttendance", "uploadEbook", "publishNews"]) {
  const body = functionSource(name);
  const firstAwait = body.indexOf("await ");
  if (firstAwait >= 0) {
    assert.equal(body.slice(firstAwait).includes("event.currentTarget"), false,
      name + " must capture its form/input before awaiting");
  }
}


const librarianTabIds = [
  "borrowRequestsTab", "pendingLearnersTab", "allLearnersTab",
  "booksAdminTab", "attendanceTab", "ebooksTab", "newsAdminTab", "statisticsTab"
];
for (const tabId of librarianTabIds) {
  assert.ok(html.includes(`id="${tabId}" class="tab-content`),
    "Librarian tab panel must exist: " + tabId);
  assert.ok(html.includes(`data-tab-target="${tabId}"`),
    "Librarian desktop tab must declare its target: " + tabId);
  assert.ok(html.includes(`AMG.switchTab('${tabId}')`),
    "Librarian tab navigation must use the safe switchTab call: " + tabId);
}
assert.equal(html.includes("document.querySelector('#librarianSection .admin-tabs"), false,
  "Librarian shortcuts must not use nested-quote querySelector calls inside inline HTML attributes");
assert.ok(app.includes('target.classList.contains("tab-content")'),
  "Tab switching must validate its target before hiding the active panel");
assert.ok(app.includes('tabButton.dataset.tabTarget === tabId'),
  "Active desktop tab must be selected using its explicit data target");

console.log("AMG site structure, librarian navigation and async event-handler regression checks passed.");
