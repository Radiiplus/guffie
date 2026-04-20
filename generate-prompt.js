import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(frontendRoot, "prompt.txt");
const ignoredDirectories = new Set([".git", "node_modules", ".zed", "dist"]);
const ignoredFiles = new Set(["package-lock.json", "prompt.txt", "countries.json"]);
const ignoredExtensions = new Set([
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".ico",
  ".tif",
  ".tiff",
]);

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();

    if (
      !entry.isFile() ||
      ignoredFiles.has(entry.name) ||
      ignoredExtensions.has(extension)
    ) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

async function buildPrompt() {
  const files = await collectFiles(frontendRoot);
  const sections = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    sections.push(`--- FILE: ${filePath} ---\n${content}`);
  }

  const output = `${sections.join("\n\n")}\n`;
  await fs.writeFile(outputFile, output, "utf8");

  console.log(`Wrote ${files.length} files to ${outputFile}`);
}

buildPrompt().catch((error) => {
  console.error("Failed to generate prompt.txt");
  console.error(error);
  process.exitCode = 1;
});
