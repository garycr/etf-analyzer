import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { findSecrets } from "./secret-guardrail-lib.mjs";

const git = (arguments_, options = {}) => {
  const result = spawnSync("git", arguments_, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error || result.signal || result.status !== 0) throw new Error(result.error?.message ?? result.stderr.toString("utf8"));
  return result.stdout;
};
const allowlist = JSON.parse(readFileSync("policy/secret-allowlist.json", "utf8"));
const today = new Date().toISOString().slice(0, 10);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/u.test(value)
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const allowlistEntries = (allowlist.entries ?? []).map(({ sha256, owner, rationale, expiry, paths }) => {
  if (!/^[0-9a-f]{64}$/u.test(sha256) || ![owner, rationale].every((value) => typeof value === "string" && value.length > 0)
    || !validDate(expiry) || expiry < today || !Array.isArray(paths) || paths.length === 0
    || paths.some((path) => typeof path !== "string" || path.length === 0)) throw new Error("Malformed or expired secret allowlist entry");
  return { sha256, paths: new Set(paths) };
});
if (new Set(allowlistEntries.map(({ sha256 }) => sha256)).size !== allowlistEntries.length) throw new Error("Duplicate secret allowlist entry");
const isAllowed = ({ sha256, path }) => allowlistEntries.some((entry) => entry.sha256 === sha256 && entry.paths.has(path));
const inspect = (path, text) => findSecrets(text).map(({ pattern, value }) => ({
  path,
  pattern,
  sha256: createHash("sha256").update(value).digest("hex"),
}));
const decodePaths = (buffer) => buffer.toString("utf8").split("\0").filter((path) => path !== "");
const commits = git(["rev-list", "--all"]).toString("utf8").trim().split("\n").filter((commit) => commit !== "");
const historyFindings = commits.flatMap((commit) => decodePaths(git(["ls-tree", "-r", "--name-only", "-z", commit]))
  .flatMap((path) => inspect(path, git(["show", `${commit}:${path}`]).toString("utf8"))));
const stagedPaths = decodePaths(git(["ls-files", "--cached", "-z"]));
const stagedFindings = stagedPaths.flatMap((path) => inspect(path, git(["show", `:${path}`]).toString("utf8")));
const workingPaths = decodePaths(git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]));
const workingFindings = workingPaths.flatMap((path) => inspect(path, readFileSync(path).toString("utf8")));
const unapproved = [...historyFindings, ...stagedFindings, ...workingFindings].filter((finding) => !isAllowed(finding));
if (unapproved.length > 0) {
  console.error(`Unapproved secret signatures: ${[...new Map(unapproved.map((finding) => [finding.sha256, finding])).values()]
    .map(({ path, pattern, sha256 }) => `${path}:${pattern}:${sha256}`).join(", ")}`);
  process.exitCode = 1;
}
