import { copyFile, cp, mkdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

// Vite owns index.html and the hashed bundle in dist/assets. This script only
// adds the files that stay outside the bundler: the PWA shell, the artwork and
// the standalone long-form page.

const root = process.cwd();
const out = resolve(root, "dist");

const staticFiles = [
  "amg.html",
  "manifest.webmanifest",
  "service-worker.js"
];

await mkdir(out, { recursive: true });
for (const file of staticFiles) {
  await copyFile(join(root, file), join(out, file));
}
await cp(join(root, "AMG.images"), join(out, "AMG.images"), { recursive: true });

const indexPath = join(out, "index.html");
const indexHtml = await readFile(indexPath, "utf8");

// The emitted entry bundles are content-hashed, so resolve them from the built
// HTML instead of hard-coding names.
const assetRefs = [...indexHtml.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map(match => match[1]);
if (assetRefs.length < 2) {
  throw new Error("dist/index.html must reference a hashed script and stylesheet bundle");
}

const required = [
  "index.html",
  join("AMG.images", "logo.jpg"),
  join("AMG.images", "pwa-icon.svg"),
  join("AMG.images", "learn.jpg"),
  join("AMG.images", "soma.jpg"),
  join("AMG.images", "toto.jpg"),
  ...staticFiles,
  ...assetRefs
];

// Verify the deployable output here instead of relying on shell `test -f`,
// which only exists on POSIX hosts.
for (const file of required) {
  const info = await stat(join(out, file));
  if (!info.isFile() || info.size === 0) {
    throw new Error("Static build is missing or produced an empty file: " + file);
  }
}

console.log(`Built AMG Library site: ${required.length} verified files in dist/.`);
