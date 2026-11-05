import { mkdir, rm, copyFile, cp, stat } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = process.cwd();
const out = resolve(root, "dist");
const files = [
  "index.html",
  "amg.html",
  "app.js",
  "mobile-effects.js",
  "amg-design-system.css",
  "firebase-config.js",
  "manifest.webmanifest",
  "service-worker.js"
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(out, file));
}

await cp(join(root, "AMG.images"), join(out, "AMG.images"), { recursive: true });

// Verify the deployable output here instead of relying on shell `test -f`,
// which only exists on POSIX hosts.
const required = [...files, join("AMG.images", "logo.jpg"), join("AMG.images", "pwa-icon.svg"), join("AMG.images", "learn.jpg")];
for (const file of required) {
  const info = await stat(join(out, file));
  if (!info.isFile() || info.size === 0) throw new Error("Static build is missing or produced an empty file: " + file);
}

console.log(`Built AMG Library static site: ${required.length} verified files in dist/.`);