import assert from "node:assert/strict";
import test from "node:test";

import {
  researchWarning,
  renderWorkbenchDocument,
} from "../../dist/Infrastructure/Web/workbench.js";
import { researchWarningText } from "../../dist/Application/application-boundary.js";
import {
  evaluateReadiness,
  presentFailedJob,
} from "../../dist/Application/application-boundary.js";

test("PT-UI-001 renders an accessible research workbench shell", () => {
  const html = renderWorkbenchDocument({ readiness: "Ready" });

  assert.match(html, /<header[^>]*>/);
  assert.match(html, /<nav aria-label="Primary">/);
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /<h1>ETF Analyzer<\/h1>/);
  assert.match(html, /<section[^>]+aria-labelledby="watchlist-heading"/);
  assert.match(html, /<section[^>]+aria-labelledby="analytics-heading"/);
  assert.match(html, /<section[^>]+aria-labelledby="paper-heading"/);
  assert.match(html, /<section[^>]+aria-labelledby="portfolio-heading"/);
  assert.match(html, /<section[^>]+aria-labelledby="operations-heading"/);
  assert.match(
    html,
    /href="#watchlist"[\s\S]+href="#analytics"[\s\S]+href="#evidence"[\s\S]+href="#paper"[\s\S]+href="#portfolio"[\s\S]+href="#operations"/,
  );
  assert.match(html, /<p role="status"[^>]*><span>Status: <\/span>Ready<\/p>/);
  assert.match(html, /<a class="skip-link" href="#main-content">Skip to content<\/a>/);

  assert.equal(html.split(researchWarning).length - 1, 3);
  assert.doesNotMatch(html, /tabindex="[1-9]/);
  assert.doesNotMatch(html, /onclick=/i);
  assert.equal(researchWarning, researchWarningText);
});

test("PT-UI-001 renders explicit NotReady status and rejects unknown state", () => {
  assert.match(
    renderWorkbenchDocument({ readiness: "NotReady" }),
    /<span>Status: <\/span>NotReady/,
  );
  assert.throws(
    () => renderWorkbenchDocument({ readiness: "Unknown" }),
    /Workbench readiness must be Ready or NotReady/,
  );
  assert.throws(
    () => renderWorkbenchDocument({ readiness: null }),
    /Workbench readiness must be Ready or NotReady/,
  );
});

test("PT-UI-004 keeps an authoritative empty watchlist operable", () => {
  const html = renderWorkbenchDocument({
    readiness: "Ready",
    watchlist: { orderedItems: [], version: "0" },
  });

  assert.match(html, /Watchlist version 0/);
  assert.match(html, /<p id="watchlist-empty">No instruments added\.<\/p>/);
  assert.match(html, /<ol id="watchlist-items">\s*<\/ol>/);
  assert.match(html, /<form id="watchlist-form"/);
  assert.match(html, /<noscript>Watchlist changes require JavaScript\.<\/noscript>/);
});

test("PT-UI-003A presents authoritative readiness jobs and bounded recovery", () => {
  const checkedAt = "2026-09-19T12:00:00.000Z";
  const readiness = evaluateReadiness({
    checkedAt,
    liveness: "Live",
    dependencies: {
      PostgreSQL: { ready: true, checkedAt },
      Migrations: { ready: true, checkedAt },
      FixturePolicy: { ready: false, checkedAt, errorCode: "APPLICATION_CONFIGURATION_INVALID" },
      LocalDependency: { ready: true, checkedAt },
      DenialAudit: { ready: true, checkedAt },
      LedgerIntegrity: { ready: true, checkedAt },
    },
  });
  const failedJob = presentFailedJob(Object.freeze({
    jobId: "40000000-0000-4000-8000-000000000001",
    status: "Failed",
    restartability: "Restartable",
    acceptedCount: 0,
    controllingError: Object.freeze({ code: "FIXTURE_REQUIRED_INPUT_MISSING" }),
  }));

  const html = renderWorkbenchDocument({ readiness, failedJobs: [failedJob] });

  assert.match(html, /<p role="alert"[^>]*><span>Status: <\/span>NotReady<\/p>/);
  assert.match(html, /id="readiness-details"/);
  assert.match(html, /FixturePolicy[\s\S]+NotReady[\s\S]+APPLICATION_CONFIGURATION_INVALID/);
  assert.match(html, /Application readiness is blocked\. Review readiness details\./);
  assert.match(html, /data-job-id="40000000-0000-4000-8000-000000000001"/);
  assert.match(html, /FIXTURE_REQUIRED_INPUT_MISSING/);
  assert.match(html, /The job failed\. Correct the reported cause, then retry the job\./);
  assert.match(html, /Recovery: Retry job/);
  assert.doesNotMatch(html, /secret|password/i);
});

test("PT-UI-003A renders Ready detail and nonrestartable escaped job evidence", () => {
  const checkedAt = "2026-09-19T12:30:00.000Z";
  const readiness = evaluateReadiness({
    checkedAt,
    liveness: "NotLive",
    dependencies: {
      PostgreSQL: { ready: true, checkedAt },
      Migrations: { ready: true, checkedAt },
      FixturePolicy: { ready: true, checkedAt },
      LocalDependency: { ready: true, checkedAt },
      DenialAudit: { ready: true, checkedAt },
      LedgerIntegrity: { ready: true, checkedAt },
    },
  });
  const failedJob = presentFailedJob(Object.freeze({
    jobId: "job-<unsafe>&\"",
    status: "Failed",
    restartability: "NotRestartable",
    acceptedCount: 0,
    controllingError: Object.freeze({ code: "CODE_<unsafe>&\"" }),
  }));

  const html = renderWorkbenchDocument({ readiness, failedJobs: [failedJob] });

  assert.match(html, /<p role="status"[^>]*><span>Status: <\/span>Ready<\/p>/);
  assert.match(html, /PostgreSQL[\s\S]+Migrations[\s\S]+FixturePolicy[\s\S]+LocalDependency[\s\S]+DenialAudit[\s\S]+LedgerIntegrity/);
  assert.doesNotMatch(html, /Application readiness is blocked/);
  assert.match(html, /data-job-id="job-&lt;unsafe&gt;&amp;&quot;"/);
  assert.match(html, /CODE_&lt;unsafe&gt;&amp;&quot;/);
  assert.match(html, /cannot be restarted\. Review the job details\./);
  assert.match(html, /Recovery: Review job details/);
  assert.match(html, /Dependent research: Blocked/);
  assert.doesNotMatch(html, /job-<unsafe>|CODE_<unsafe>/);
});
