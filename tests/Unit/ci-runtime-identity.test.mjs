import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../../.github/workflows/ci.yml", import.meta.url);
const nodeVersionUrl = new URL("../../.node-version", import.meta.url);
const packageUrl = new URL("../../package.json", import.meta.url);

function jobBlocks(workflow) {
  const jobs = new Map();
  let currentJob;
  let inJobs = false;

  for (const line of workflow.split("\n")) {
    if (line === "jobs:") {
      inJobs = true;
      continue;
    }
    if (!inJobs) {
      continue;
    }
    const jobHeading = line.match(/^  ([a-z][a-z-]+):\s*$/u);
    if (jobHeading) {
      currentJob = jobHeading[1];
      jobs.set(currentJob, []);
    } else if (currentJob) {
      jobs.get(currentJob).push(line);
    }
  }

  return new Map([...jobs].map(([name, lines]) => [name, lines.join("\n")]));
}

test("PT-CI-001 pins the runner generation and exact Node runtime identity", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const nodeVersion = await readFile(nodeVersionUrl, "utf8").catch(() => "");
  const jobs = jobBlocks(workflow);
  const nodeJobs = ["build-and-test", "browser-accessibility", "security-audit"];

  assert.equal(nodeVersion.trim(), "20.20.2", ".node-version must govern the exact Node patch");
  assert.deepEqual([...jobs.keys()], [
    "build-and-test",
    "browser-accessibility",
    "security-audit",
    "codeql",
  ], "the contract must cover the complete CI job set");

  for (const [name, job] of jobs) {
    assert.match(job, /^\s+runs-on:\s*ubuntu-24\.04\s*$/mu, `${name} must select Ubuntu 24.04`);
    assert.match(job, /name:\s*Verify runtime identity[\s\S]*?test "\$VERSION_ID" = "24\.04"/u,
      `${name} must verify its observed Ubuntu release`);
  }

  for (const name of nodeJobs) {
    const job = jobs.get(name);
    assert.match(job, /node-version:\s*['"]?20\.20\.2['"]?\s*$/mu,
      `${name} must select Node 20.20.2`);
    assert.match(job, /name:\s*Verify runtime identity[\s\S]*?test "\$\(node --version\)" = "v20\.20\.2"/u,
      `${name} must verify its observed Node patch`);
  }
});

test("PT-CI-002 retains immutable action and container references", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const actionReferences = [...workflow.matchAll(/^\s+-?\s*uses:\s*([^@\s]+)@([^\s]+)\s*$/gmu)];
  const imageReferences = [...workflow.matchAll(/^\s+image:\s*([^\s]+)\s*$/gmu)];

  assert.equal(actionReferences.length, 11, "every expected action reference must remain covered");
  for (const [, action, identity] of actionReferences) {
    assert.match(identity, /^[a-f0-9]{40}$/u, `${action} must use a full commit SHA`);
  }

  assert.equal(imageReferences.length, 2, "PostgreSQL and Playwright images must remain covered");
  for (const [, image] of imageReferences) {
    assert.match(image, /@sha256:[a-f0-9]{64}$/u, `${image} must use a SHA-256 digest`);
  }
});

test("PT-CI-003 runs the complete browser suite through the zero-skip gate", async () => {
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  const browserScript = packageJson.scripts["test:browser"];

  assert.match(browserScript, /zero-skip-runner\.mjs/u);
  assert.doesNotMatch(browserScript, /--test-name-pattern/u,
    "filtering a Node test file reports excluded tests as skips under Node 20");
  assert.match(browserScript, /tests\/Integration\/workbench-accessibility\.test\.mjs/u);
});

test("PT-CI-004 builds and uploads one commit-bound release candidate", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));

  assert.match(packageJson.scripts["release:package"], /scripts\/release-package\.mjs/u);
  assert.match(workflow, /name:\s*Build immutable release candidate[\s\S]*?ETF_RELEASE_CANDIDATE:\s*v0\.1\.0-rc\.1[\s\S]*?npm run release:package/u);
  assert.match(workflow, /name:\s*Upload immutable release candidate[\s\S]*?name:\s*etf-analyzer-v0\.1\.0-rc\.1-\$\{\{ github\.sha \}\}[\s\S]*?path:\s*release\//u);
  assert.match(workflow, /name:\s*Upload immutable release candidate[\s\S]*?if-no-files-found:\s*error[\s\S]*?retention-days:\s*90/u);
});
