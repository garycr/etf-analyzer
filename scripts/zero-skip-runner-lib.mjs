const summaryKeys = ["tests", "pass", "fail", "cancelled", "skipped", "todo"];

export function parseTestSummary(report) {
  const entries = [...report.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gmu)];
  const summary = {};
  for (const [, key, value] of entries) {
    if (key in summary) throw new Error(`Node test summary contains duplicate ${key}`);
    summary[key] = Number(value);
  }
  for (const key of summaryKeys) {
    if (!(key in summary)) throw new Error(`Node test summary is missing ${key}`);
  }
  return summary;
}

export function assertZeroSkipSummary(report) {
  const summary = parseTestSummary(report);
  if (summary.tests === 0) throw new Error("Node test run executed zero tests");
  for (const key of ["fail", "cancelled", "skipped", "todo"]) {
    if (summary[key] !== 0) throw new Error(`Node test run reported ${summary[key]} ${key}`);
  }
  if (summary.tests !== summary.pass) {
    throw new Error(`Node test summary is inconsistent: ${summary.tests} tests and ${summary.pass} pass`);
  }
  return summary;
}
