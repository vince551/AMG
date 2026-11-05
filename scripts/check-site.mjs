import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";

// The React port moved every screen into src/. These checks guard the parts
// that the stylesheet, the Firebase rules and the security model depend on, so
// a refactor cannot silently drop them. Purely presentational HTML details are
// intentionally no longer asserted here.

async function collectSources(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSources(full)));
    else if (/\.(jsx?|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const html = await readFile("index.html", "utf8");
const designCss = await readFile("amg-design-system.css", "utf8");
const serviceWorker = await readFile("service-worker.js", "utf8");
const build = await readFile("scripts/build-static.mjs", "utf8");
const storageRules = await readFile("storage.rules", "utf8");
const firestoreRules = await readFile("firestore.rules", "utf8");
const cloudFunctions = await readFile("functions/index.js", "utf8");

const sourceFiles = await collectSources("src");
const sources = await Promise.all(sourceFiles.map(async file => ({ file, text: await readFile(file, "utf8") })));
const allSource = sources.map(item => item.text).join("\n");

function sourceOf(fragment) {
  const found = sources.find(item => item.file.replaceAll("\\", "/").endsWith(fragment));
  assert.ok(found, "Expected the React source " + fragment + " to exist");
  return found.text;
}

const main = sourceOf("src/main.jsx");
const auth = sourceOf("src/store/AuthProvider.jsx");
const library = sourceOf("src/store/LibraryProvider.jsx");
const announcementCards = sourceOf("src/components/AnnouncementCards.jsx");
const libShelf = sourceOf("src/components/LibShelf.jsx");
const booksTab = sourceOf("src/components/librarian/BooksTab.jsx");
const attendanceTab = sourceOf("src/components/librarian/AttendanceTab.jsx");
const desk = sourceOf("src/components/librarian/Desk.jsx");

// ---------------------------------------------------------------- entry point
assert.match(html, /<div id="root"><\/div>/, "Vite entry must mount the React tree into #root");
assert.ok(html.includes("/src/main.jsx"), "index.html must load the React entry module");
assert.match(html, /name=["']viewport["'][^>]*width=device-width/i, "Responsive viewport meta tag is required");
assert.ok(html.includes('href="manifest.webmanifest"'), "PWA manifest must stay linked");
assert.ok(!html.includes("app.js") && !html.includes("mobile-effects.js"), "Legacy script tags must not survive the React port");
assert.ok(!html.includes("onclick="), "Inline onclick handlers must not be used");

assert.ok(main.includes('import "../amg-design-system.css";'), "React entry must import the shared design system");
assert.ok(designCss.includes("@media (max-width: 680px)"), "Design system must include mobile layouts");
assert.ok(designCss.includes("prefers-reduced-motion: reduce"), "Design system must respect reduced motion");

// --------------------------------------------------------------- DOM id contract
// Every id the design system styles must be produced by the React tree, and no
// id may be rendered twice because all sections stay mounted.
const declaredIds = [...allSource.matchAll(/\bid=["']([A-Za-z][\w-]*)["']/g)].map(match => match[1]);
const duplicates = [...new Set(declaredIds.filter((id, index) => declaredIds.indexOf(id) !== index))];
assert.deepEqual(duplicates, [], "Rendered markup must not contain duplicate IDs");

const cssIds = [...new Set(
  [...designCss.matchAll(/#([A-Za-z][A-Za-z0-9_-]*)/g)]
    .map(match => match[1])
    .filter(name => !/^[0-9a-fA-F]{3,8}$/.test(name))
)];
const unstyledIds = cssIds.filter(id => !declaredIds.includes(id));
assert.deepEqual(unstyledIds, [], "Design-system ID selectors must be rendered by the React tree");

for (const id of ["authModal", "authTitle", "loginForm", "registrationStepTwo", "registrationNextBtn"]) {
  assert.ok(allSource.includes(`id="${id}"`), "Auth modal must keep the stylesheet contract for #" + id);
}

// ------------------------------------------------------------ librarian shell
const librarianTabIds = [
  "borrowRequestsTab", "pendingLearnersTab", "allLearnersTab",
  "booksAdminTab", "attendanceTab", "ebooksTab", "newsAdminTab", "statisticsTab"
];
for (const tabId of librarianTabIds) {
  assert.ok(allSource.includes(`id="${tabId}"`), "Librarian tab panel must exist: " + tabId);
  assert.ok(desk.includes(`"${tabId}"`), "Librarian desk must be able to open: " + tabId);
}
assert.ok(allSource.includes('id="adminMobileTabSelect"'), "Mobile dashboard picker must stay available");
assert.ok(allSource.includes('id="librarianSection"'), "Librarian workspace section must exist");

// -------------------------------------------------------------- data handling
for (const name of ["requestBook", "reviewLearner", "processRequest", "returnLoan", "registerBook", "deleteBook", "processUnifiedCode", "uploadEbook", "publishNews", "deletePost"]) {
  assert.ok(library.includes("const " + name + " = useCallback("), "Library provider must expose " + name);
}

// Async handlers must capture form/input state before the first await, because
// React clears `currentTarget` once the handler returns to the event loop.
for (const { file, text } of sources) {
  const pattern = /const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g;
  let match;
  while ((match = pattern.exec(text))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;
    while (index < text.length && depth > 0) {
      if (text[index] === "{") depth += 1;
      else if (text[index] === "}") depth -= 1;
      index += 1;
    }
    const body = text.slice(start, index - 1);
    const firstAwait = body.indexOf("await ");
    if (firstAwait < 0) continue;
    assert.equal(body.slice(firstAwait).includes("event.currentTarget"), false,
      file + ": " + match[1] + " must capture its form/input before awaiting");
  }
}

// ------------------------------------------------------------------ book covers
assert.ok(booksTab.includes('id="bookCoverGalleryInput"'), "Book registration must offer a device image picker");
assert.ok(booksTab.includes('id="bookCoverCameraInput"') && booksTab.includes('capture="environment"'),
  "Book registration must offer a rear-camera cover capture input");
assert.ok(!booksTab.includes('name="coverUrl"'), "Book registration must not require a manually entered cover URL");
assert.ok(library.includes('"book-covers/"') && library.includes('coverStoragePath'),
  "Book cover images must upload into a librarian-scoped Storage path");
assert.ok(storageRules.includes("match /book-covers/{uid}/{fileName}") && storageRules.includes("request.auth.uid == uid"),
  "Book cover uploads must be restricted to the signed-in librarian's folder");
assert.ok(cloudFunctions.includes("coverStoragePath") && cloudFunctions.includes('book-covers/"+request.auth.uid+"/'),
  "Book registration callable must validate and persist the cover storage path");

// ------------------------------------------------------------------- scanning
assert.ok(attendanceTab.includes("BrowserMultiFormatReader"), "Attendance camera scanning must include a compatible QR/barcode fallback");
assert.ok(attendanceTab.includes("codes[0].rawValue"), "Native camera detection must use the unified scan handler");
assert.ok(attendanceTab.includes("send Enter after each scan"), "USB scanner instructions must explain the Enter suffix");
assert.ok(attendanceTab.includes("1600"), "Camera scans must be de-duplicated across consecutive frames");
assert.ok(!library.includes('httpsCallable(fb.functions, "recordMemberAttendance")'),
  "Attendance check-in/out must stay on Firestore transactions");
assert.ok(library.includes("transaction.set(attendanceRef") && library.includes("transaction.update(activeAttendanceRef"),
  "Attendance must use Firestore transactions for check-in and check-out");

// -------------------------------------------------------------- membership flow
assert.ok(auth.includes("createLearnerProfile"), "Learner registration must not depend on callable Cloud Functions");
assert.ok(auth.includes("signInWithEmailAndPassword(fb.auth, email, password)"),
  "Registration must recover Auth accounts created before profile failure");
assert.ok(firestoreRules.includes("getAfter(/databases/$(database)/documents/memberNumbers/$(request.resource.data.libraryNumber))"),
  "Profile creation must be paired with a member-number reservation");
assert.ok(firestoreRules.includes("request.resource.data.isApproved == false"), "Self-registration must never grant approval");
assert.ok(library.includes('httpsCallable(fb.functions, "reviewLearnerMembership")'),
  "Membership approval must go through the librarian-only callable");
assert.ok(cloudFunctions.includes("exports.reviewLearnerMembership=onCall"), "Membership approval callable must exist in functions/index.js");
assert.ok(cloudFunctions.includes("request.auth.token.librarian!==true"), "Membership approval callable must verify the librarian claim");
assert.ok(firestoreRules.includes("request.resource.data.membershipStatus in ['Approved', 'Denied']"),
  "Librarian membership decisions must be constrained by Firestore rules");
assert.ok(firestoreRules.includes("getAfter(/databases/$(database)/documents/attendance/$(request.resource.data.attendanceId))"),
  "Presence records must be paired with an attendance record in the same transaction");
assert.ok(firestoreRules.includes("resource.data.status == 'Checked out'") &&
  firestoreRules.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['attendanceId', 'status', 'updatedAt'])"),
  "Members must be able to check in again after checking out");

// --------------------------------------------------------------- announcements
assert.ok(library.includes('announcementKind: "Announcement"') && library.includes('announcementKind: "Event"'),
  "Announcement cards must identify post type from the source collection");
assert.ok(announcementCards.includes("readingMinutes("), "Announcement reading time must be calculated from existing body text");
assert.ok(announcementCards.includes("data-kind={kind.toLowerCase()}"), "Announcement card styling must receive its automatically derived kind");
assert.ok(designCss.includes("#heroSection #homeAnnouncements") && designCss.includes("#newsSection #announcementsList"),
  "Redesigned announcement cards must cover homepage and News & Events layouts");

// --------------------------------------------------------- sample catalogue
// The shelf previews itself with sample cards while the catalogue is empty.
// They must stay display-only: no writes, and no working borrow button.
const demoBooks = sourceOf("src/lib/demoBooks.js");
assert.ok(demoBooks.includes("export const DEMO_BOOKS"), "Sample cards must live in one recognisable module");
assert.ok((demoBooks.match(/demo: true/g) || []).length >= 4, "Sample cards must be explicitly marked as demo data");
assert.ok(libShelf.includes("Boolean(book.demo)") && libShelf.includes("if (!book.demo)"),
  "Sample cards must never trigger a real borrow request");
assert.ok(!library.includes("DEMO_BOOKS"), "Sample cards must never be written to Firestore");

// --------------------------------------------------------------------- e-books
// The catalogue is public so visitors can see what is available, but every file
// stays behind an account. A Firebase download URL is an access token, so it
// must never be stored on the publicly readable document.
const ebookDocRuleStart = firestoreRules.indexOf("match /ebooks/{ebookId}");
assert.ok(ebookDocRuleStart > -1, "Firestore rules must guard the e-book catalogue");
const ebookDocRule = firestoreRules.slice(ebookDocRuleStart, ebookDocRuleStart + 300);
assert.ok(ebookDocRule.includes("allow read: if true"),
  "Visitors must be able to browse the e-book catalogue without an account");
assert.ok(!ebookDocRule.includes("allow read: if signedIn"),
  "The e-book catalogue must stay readable to signed-out visitors");

const ebookFileRuleStart = storageRules.indexOf("match /ebooks/{fileName}");
assert.ok(ebookFileRuleStart > -1, "Storage rules must define the e-book file path");
const ebookFileRule = storageRules.slice(ebookFileRuleStart, ebookFileRuleStart + 300);
assert.ok(ebookFileRule.includes("allow read: if signedIn();"),
  "E-book files must require a signed-in account");
assert.ok(!ebookFileRule.includes("allow read: if true"),
  "E-book files must never be publicly readable");

const ebookWriteStart = library.indexOf("setDoc(record, {");
assert.ok(ebookWriteStart > -1, "E-book uploads must persist their record");
assert.ok(!library.slice(ebookWriteStart, ebookWriteStart + 300).includes("downloadUrl"),
  "E-book records must not persist a tokenised download URL");
assert.ok(library.includes("getDownloadURL(storageRef(fb.storage, book.storagePath))"),
  "E-book downloads must be resolved on demand through Storage rules");
assert.ok(libShelf.includes("onOpenAuth") && libShelf.includes("Sign in to download"),
  "Guests must be invited to sign in before downloading an e-book");

// --------------------------------------------------------------------- PWA
assert.ok(serviceWorker.includes('"./manifest.webmanifest"'), "PWA app shell must cache the manifest");
assert.ok(serviceWorker.includes('"./AMG.images/logo.jpg"'), "PWA app shell must cache the artwork");
assert.ok(!serviceWorker.includes('"./app.js"'), "PWA app shell must not cache the removed legacy bundle");
const cacheVersion = serviceWorker.match(/const CACHE_NAME = "amg-library-shell-v(\d+)"/);
assert.ok(cacheVersion, "Service worker must declare a versioned AMG shell cache");
assert.ok(Number(cacheVersion[1]) >= 11, "PWA shell cache version must not move backwards");

// --------------------------------------------------------------------- build
assert.ok(build.includes('"service-worker.js"') && build.includes('"AMG.images"'), "Static build must ship the PWA shell and artwork");
assert.ok(build.includes("dist/index.html"), "Static build must verify the Vite output before deploying");
assert.ok(!build.includes('"app.js"'), "Static build must not copy the removed legacy bundle");
assert.ok(!allSource.includes("innerHTML"), "DOM must be rendered by React, not by innerHTML");
assert.ok(!allSource.includes("dangerouslySetInnerHTML"), "DOM must be rendered by React, not by dangerouslySetInnerHTML");

console.log("AMG React site structure, ID contract, librarian navigation, security and async handler checks passed.");
