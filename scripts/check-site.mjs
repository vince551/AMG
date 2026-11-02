import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const [html, app, designCss, serviceWorker, build, storageRules, cloudFunctions, firestoreRules] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("app.js", "utf8"),
  readFile("amg-design-system.css", "utf8"),
  readFile("service-worker.js", "utf8"),
  readFile("scripts/build-static.mjs", "utf8"),
  readFile("storage.rules", "utf8"),
  readFile("functions/index.js", "utf8"),
  readFile("firestore.rules", "utf8")
]);

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML must not contain duplicate IDs");

const referencedIds = [...app.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !ids.includes(id)))];
assert.deepEqual(missingIds, [], "Every static app.js ID lookup must exist in index.html");

assert.match(html, /name=["']viewport["'][^>]*width=device-width/i, "Responsive viewport meta tag is required");
assert.ok(html.includes('href="amg-design-system.css"'), "Fresh AMG design system must be linked");
assert.ok(build.includes('"amg-design-system.css"'), "Static build must include the new design system");
assert.ok(serviceWorker.includes('"./amg-design-system.css"'), "PWA app shell must cache the new design system");
assert.ok(designCss.includes("@media (max-width: 680px)"), "Design system must include mobile layouts");
assert.ok(designCss.includes("prefers-reduced-motion: reduce"), "Design system must respect reduced motion");
assert.ok(!html.includes('class="admin-command-hero"'), "Librarian dashboard must not contain a duplicate command hero");

assert.ok(html.includes('id="bookCoverGalleryInput"'), "Book registration must offer a device image picker");
assert.ok(html.includes('id="bookCoverCameraInput"') && html.includes('capture="environment"'), "Book registration must offer a rear-camera cover capture input");
assert.ok(!html.includes('name="coverUrl"'), "Book registration must not require a manually entered cover URL");
assert.ok(app.includes('book-covers/"+state.user.uid+"/'), "Book cover images must upload into a librarian-scoped Storage path");
assert.ok(app.includes('BrowserMultiFormatReader'), "Attendance camera scanning must include a compatible QR/barcode fallback");
assert.ok(app.includes('handleCameraScan(codes[0].rawValue)'), "Native camera detection must use the unified scan handler");
assert.ok(html.includes('send Enter after each scan'), "USB scanner instructions must explain the Enter suffix");
assert.ok(storageRules.includes('match /book-covers/{uid}/{fileName}') && storageRules.includes("request.auth.uid == uid"), "Book cover uploads must be restricted to the signed-in librarian's folder");
assert.ok(cloudFunctions.includes('coverStoragePath') && cloudFunctions.includes('book-covers/"+request.auth.uid+"/'), "Book registration callable must validate and persist the cover storage path");

assert.ok(app.includes('announcementKind:"Announcement"') && app.includes('announcementKind:"Event"'), "Announcement cards must identify post type from the source collection");
assert.ok(app.includes('readingMinutes+" min read"'), "Announcement reading time must be calculated from existing body text");
assert.ok(app.includes("card.dataset.kind=kind.toLowerCase()"), "Announcement card styling must receive its automatically derived kind");
assert.ok(designCss.includes('#heroSection #homeAnnouncements') && designCss.includes('#newsSection #announcementsList'), "Redesigned announcement cards must cover homepage and News & Events layouts");
assert.ok(serviceWorker.includes('amg-library-shell-v9'), "PWA cache must refresh for the announcement redesign");




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


assert(app.includes("createLearnerProfileOnSpark"), "Learner registration must not depend on callable Cloud Functions");
assert(app.includes("signInWithEmailAndPassword(state.auth, email, password)"), "Registration must recover Auth accounts created before profile failure");
assert(firestoreRules.includes("getAfter(/databases/$(database)/documents/memberNumbers/$(request.resource.data.libraryNumber))"), "Profile creation must be paired with a member-number reservation");
assert(firestoreRules.includes("request.resource.data.isApproved == false"), "Self-registration must never grant approval");
