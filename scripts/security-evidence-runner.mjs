import { runSecurityEvidence } from "./security-evidence-runner-lib.mjs";

const outputDirectory = process.argv[2] ?? "security-evidence";
const checks = [
  { name: "dependency-audit", script: "test:security:audit" },
  { name: "secret-pattern-scan", script: "test:security:secrets" },
  { name: "banned-function-guardrail", script: "test:security:sast" },
];
const identity = {
  commitSha: process.env.GITHUB_SHA,
  repository: process.env.GITHUB_REPOSITORY,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  workflow: process.env.GITHUB_WORKFLOW,
  job: process.env.GITHUB_JOB,
  ref: process.env.GITHUB_REF,
};

process.exitCode = runSecurityEvidence({ identity, outputDirectory, checks });
