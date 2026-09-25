import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const normalizePath = (path) => path.split(sep).join("/");
const stripAnsi = (text) => text.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");

const walkJavaScriptFiles = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? walkJavaScriptFiles(path)
      : entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });

export const discoverBusinessFiles = (root = "dist") => ["Application", "Domain"]
  .flatMap((directory) => walkJavaScriptFiles(join(root, directory)))
  .map((path) => normalizePath(relative(".", path)))
  .sort();

export const parseLineCoverage = (report) => {
  const paths = [];
  const coverage = new Map();

  for (const rawLine of report.split("\n")) {
    const line = stripAnsi(rawLine);
    const match = line.match(/^(?:ℹ |# )?( *)([^|]+?)\s+\|\s*([^|]*)\|/u);
    if (match === null) {
      continue;
    }

    const depth = match[1].length;
    const name = match[2].trim();
    paths.length = depth;
    paths[depth] = name;
    const percentageText = match[3].trim();
    const percentage = Number(percentageText);
    if (percentageText !== "" && Number.isFinite(percentage)) {
      const coveragePath = paths.join("/");
      if (coverage.has(coveragePath)) {
        throw new Error(`Duplicate coverage row: ${coveragePath}`);
      }
      coverage.set(coveragePath, percentage);
    }
  }

  return coverage;
};

export const parseTestCount = (report, expectedName) => {
  if (!["pass", "fail", "skipped"].includes(expectedName)) {
    throw new Error(`Unsupported test count: ${expectedName}`);
  }

  let count;
  for (const rawLine of report.split("\n")) {
    const match = stripAnsi(rawLine).match(/^(?:ℹ |# )?(pass|fail|skipped) (\d+)$/u);
    if (match !== null && match[1] === expectedName) {
      if (count !== undefined) {
        throw new Error(`Duplicate ${expectedName} test count`);
      }
      count = Number(match[2]);
    }
  }
  return count;
};

export const assertBusinessCoverage = (report, businessFiles, threshold = 80) => {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new Error("Coverage threshold must be between 0 and 100");
  }
  if (businessFiles.length === 0) {
    throw new Error("No compiled Domain or Application JavaScript files were discovered");
  }

  const coverage = parseLineCoverage(report);
  for (const file of businessFiles) {
    const percentage = coverage.get(file);
    if (percentage === undefined) {
      throw new Error(`${file} must appear in the Node coverage report`);
    }
    if (percentage < threshold) {
      throw new Error(`${file} line coverage ${percentage}% must be at least ${threshold}%`);
    }
  }
};
