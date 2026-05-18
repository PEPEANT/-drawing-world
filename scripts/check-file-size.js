const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SOFT_LIMIT = 250;
const WARN_LIMIT = 350;
const HARD_LIMIT = 450;

const ignoredDirs = new Set([
  ".git",
  ".playwright-mcp",
  "artifacts",
  "data",
  "node_modules"
]);

const ignoredFiles = new Set([
  "package-lock.json"
]);

const checkedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".svg"
]);

const results = [];
walk(ROOT);

const oversized = results
  .filter((file) => file.lines > SOFT_LIMIT)
  .sort((a, b) => b.lines - a.lines);
const hardFailures = oversized.filter((file) => file.lines > HARD_LIMIT);

if (oversized.length === 0) {
  console.log(`OK: no source files over ${SOFT_LIMIT} lines.`);
  process.exit(0);
}

for (const file of oversized) {
  const level = file.lines > HARD_LIMIT ? "FAIL" : file.lines > WARN_LIMIT ? "WARN" : "NOTE";
  console.log(`${level}: ${file.relativePath} has ${file.lines} lines.`);
}

if (hardFailures.length > 0) {
  console.error(`\nSplit files over ${HARD_LIMIT} lines before adding new features.`);
  process.exit(1);
}

console.log(`\nFiles over ${SOFT_LIMIT} lines are candidates for splitting.`);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(fullPath);
      }
      continue;
    }

    if (!shouldCheck(entry.name)) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    results.push({
      lines: content.split(/\r?\n/).length,
      relativePath: path.relative(ROOT, fullPath)
    });
  }
}

function shouldCheck(fileName) {
  if (ignoredFiles.has(fileName)) return false;
  return checkedExtensions.has(path.extname(fileName));
}
