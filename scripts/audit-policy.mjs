import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const auditResult = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 60_000 });
if (auditResult.error || auditResult.signal || ![0, 1].includes(auditResult.status) || auditResult.stdout.trim() === "") {
  throw new Error(auditResult.error?.message ?? auditResult.stderr);
}
const audit = JSON.parse(auditResult.stdout);
if (audit.error || audit.metadata?.vulnerabilities === undefined || audit.vulnerabilities === undefined) {
  throw new Error("npm audit returned an invalid or operational-error response");
}
const dispositions = JSON.parse(readFileSync("policy/security-advisory-dispositions.json", "utf8"));
const severityCounts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
const moderate = Object.entries(audit.vulnerabilities).flatMap(([name, finding]) => {
  if (!(finding.severity in severityCounts) || !Array.isArray(finding.via)) throw new Error(`Malformed audit finding: ${name}`);
  severityCounts[finding.severity] += 1;
  if (finding.severity !== "moderate") return [];
  const advisories = finding.via.filter((via) => typeof via === "object" && Number.isInteger(via.source));
  if (advisories.length === 0) throw new Error(`Moderate finding lacks immutable advisory source: ${name}`);
  return advisories.map((via) => `${name}:${via.source}`);
});
for (const severity of Object.keys(severityCounts)) {
  if (audit.metadata.vulnerabilities[severity] !== severityCounts[severity]) throw new Error(`Audit ${severity} metadata mismatch`);
}
const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
if (audit.metadata.vulnerabilities.total !== total) throw new Error("Audit total metadata mismatch");
const today = new Date().toISOString().slice(0, 10);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/u.test(value)
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const dispositionIds = (dispositions.moderate ?? []).map(({ packageName, source, owner, rationale, expiry }) => {
  if (![packageName, owner, rationale].every((value) => typeof value === "string" && value.length > 0)
    || !Number.isInteger(source) || !validDate(expiry) || expiry < today) {
    throw new Error("Malformed or expired Moderate advisory disposition");
  }
  return `${packageName}:${source}`;
});
if (new Set(dispositionIds).size !== dispositionIds.length) throw new Error("Duplicate Moderate advisory disposition");
const valid = new Set(dispositionIds);
const undispositioned = moderate.filter((id) => !valid.has(id));
if (undispositioned.length > 0) {
  console.error(`Undispositioned Moderate advisories: ${undispositioned.join(", ")}`);
  process.exitCode = 1;
}
if (severityCounts.high > 0 || severityCounts.critical > 0) {
  console.error("High or Critical vulnerabilities are prohibited");
  process.exitCode = 1;
}
const stale = dispositionIds.filter((id) => !moderate.includes(id));
if (stale.length > 0) throw new Error(`Stale Moderate advisory dispositions: ${stale.join(", ")}`);
