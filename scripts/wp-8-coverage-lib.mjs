import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const normalizePath = (path) => path.split(sep).join("/");

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

  for (const line of report.split("\n")) {
    const match = line.match(/^(?:ℹ )?( *)([^|]+?)\s+\|\s*([^|]*)\|/u);
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
      coverage.set(paths.join("/"), percentage);
    }
  }

  return coverage;
};

export const assertBusinessCoverage = (report, businessFiles, threshold = 80) => {
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
