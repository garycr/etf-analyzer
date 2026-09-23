import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { scanSource } from "./sast-guardrail-lib.mjs";

const walkTypeScript = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink() || lstatSync(path).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in production source: ${path}`);
    }
    return entry.isDirectory()
      ? walkTypeScript(path)
      : entry.isFile() && /\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/u.test(entry.name) ? [path] : [];
  });

const findings = walkTypeScript("src")
  .flatMap((path) => scanSource(readFileSync(path, "utf8"), path));

for (const finding of findings) {
  console.error(`${finding.fileName}:${finding.line}:${finding.column}: forbidden ${finding.call} call`);
}

if (findings.length > 0) {
  process.exitCode = 1;
}
