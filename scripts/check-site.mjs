import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const [html, app, mobileCss, serviceWorker, build] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("app.js", "utf8"),
  readFile("mobile-responsive.css", "utf8"),
  readFile("service-worker.js", "utf8"),
  readFile("scripts/build-static.mjs", "utf8")
]);

const ids = [...html.matchAll(/\\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML must not contain duplicate IDs");

const referencedIds = [...app.matchAll(/\\$\\(["']([^"']+)["']\\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !ids.includes(id)))];
assert.deepEqual(missingIds, [], "Every static app.js ID lookup must exist in index.html");

assert.match(html, /name=["']viewport["'][^>]*width=device-width/i, "Responsive viewport meta tag is required");
assert.match(html, /href=["']mobile-responsive\\.css["']/i, "Mobile stylesheet must be linked");
assert.match(build, /"mobile-responsive\\.css"/, "Static build must include the mobile stylesheet");
assert.match(serviceWorker, /"\\.\\/mobile-responsive\\.css"/, "PWA app shell must cache the mobile stylesheet");
assert.match(mobileCss, /prefers-reduced-motion:\\s*reduce/, "Mobile styling must respect reduced-motion preferences");

function functionSource(name) {
  const marker = new RegExp("async\\\\s+function\\\\s+" + name + "\\\\s*\\\\(");
  const match = marker.exec(app);
  assert.ok(match, "Expected async handler " + name);
  const start = match.index;
  const next = app.slice(start + match[0].length).search(/\\n(?:async )?function\\s+/);
  return next < 0 ? app.slice(start) : app.slice(start, start + match[0].length + next);
}

for (const name of ["register", "updatePhoto", "registerBook", "recordAttendance", "uploadEbook", "publishNews"]) {
  const body = functionSource(name);
  const firstAwait = body.indexOf("await ");
  if (firstAwait >= 0) {
    assert.equal(body.slice(firstAwait).includes("event.currentTarget"), false,
      name + " must capture its form/input before awaiting");
  }
}

console.log("AMG site structure and async event-handler regression checks passed.");
