import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const [html, app, mobileCss, serviceWorker, build, premiumCss] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("app.js", "utf8"),
  readFile("mobile-responsive.css", "utf8"),
  readFile("service-worker.js", "utf8"),
  readFile("scripts/build-static.mjs", "utf8"),
  readFile("premium-redesign.css", "utf8")
]);

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML must not contain duplicate IDs");

const referencedIds = [...app.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !ids.includes(id)))];
assert.deepEqual(missingIds, [], "Every static app.js ID lookup must exist in index.html");

assert.match(html, /name=["']viewport["'][^>]*width=device-width/i, "Responsive viewport meta tag is required");
assert.ok(html.includes('href="mobile-responsive.css"'), "Mobile stylesheet must be linked");
assert.ok(build.includes('"mobile-responsive.css"'), "Static build must include the mobile stylesheet");
assert.ok(serviceWorker.includes('"./mobile-responsive.css"'), "PWA app shell must cache the mobile stylesheet");
assert.ok(html.includes('href="premium-redesign.css"'), "Premium visual system must be linked after existing styles");
assert.ok(build.includes('"premium-redesign.css"'), "Static build must include the premium stylesheet");
assert.ok(serviceWorker.includes('"./premium-redesign.css"'), "PWA app shell must cache the premium stylesheet");
assert.ok(premiumCss.includes("@media (max-width: 760px)"), "Premium visual system must include mobile layouts");
assert.ok(premiumCss.includes("prefers-reduced-motion: reduce"), "Premium visual system must respect reduced motion");
assert.ok(mobileCss.includes("prefers-reduced-motion: reduce"), "Mobile styling must respect reduced-motion preferences");

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

console.log("AMG site structure and async event-handler regression checks passed.");
