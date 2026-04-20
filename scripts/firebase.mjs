import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const distDir = join(rootDir, "dist");
const filesToCopy = ["firebase.json", ".firebaserc"];

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

for (const file of filesToCopy) {
  const from = join(rootDir, file);
  const to = join(distDir, file);

  if (!existsSync(from)) {
    console.warn(`Skipped missing file: ${file}`);
    continue;
  }

  copyFileSync(from, to);
  console.log(`Copied ${file} -> dist/${file}`);
}
