import assert from "node:assert/strict";
import test from "node:test";

import {
  researchWarning,
  renderWorkbenchDocument,
} from "../../dist/Infrastructure/Web/workbench.js";
import { researchWarningText } from "../../dist/Application/application-boundary.js";

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
});
