import { mkdir, rm, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = process.cwd();
const out = resolve(root, "dist");
const files = ["index.html", "amg.html", "app.js", "app.css", "style.css", "firebase-config.js"];
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of files) {
  await copyFile(join(root, file), join(out, file));
}
console.log(`Built AMG Library static site: ${files.length} files copied to dist/.`);
