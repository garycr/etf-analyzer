import {
  researchWarningText,
  type BlockedStatePresentation,
  type CanonicalValuePresentation,
  type FailedJobForPresentation,
  type FailedJobPresentation,
  type ReadinessSnapshot,
} from "../../Application/application-boundary.js";

export const researchWarning = researchWarningText;

export type WorkbenchReadiness = "Ready" | "NotReady";

export interface WorkbenchWatchlistItem {
  readonly instrumentId: string;
  readonly displayName: string;
  readonly validationState: "Valid" | "Invalid";
  readonly position: string;
}

export interface WorkbenchWatchlist {
  readonly orderedItems: readonly WorkbenchWatchlistItem[];
  readonly version: string;
}

export interface WorkbenchAnalyticsResult {
  readonly state: "Result" | "NoSignal";
  readonly signals: readonly Readonly<{
    instrumentId: string;
    label: string;
    score: string;
  }>[];
  readonly metrics: readonly Readonly<{
    metricId: string;
    value: string;
  }>[];
  readonly warnings: readonly string[];
}

export interface WorkbenchEvidenceResult {
  readonly state: "Available";
  readonly evidenceId: string;
  readonly reproducibilityStatus: "Complete";
  readonly evaluationAt: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
}

export type WorkbenchAnalytics = WorkbenchAnalyticsResult | BlockedStatePresentation;
export type WorkbenchEvidence = WorkbenchEvidenceResult | BlockedStatePresentation;

export type WorkbenchOrderState =
  | "Draft"
  | "Submitted"
  | "Accepted"
  | "Partial"
  | "Filled"
  | "Rejected"
  | "Canceled"
  | "Expired";

export interface WorkbenchPaperOrder {
  readonly orderId: string;
  readonly instrumentId: string;
  readonly state: WorkbenchOrderState;
  readonly statePresentation: CanonicalValuePresentation;
  readonly aggregateVersion: string;
  readonly side: "Buy" | "Sell";
  readonly requestedQuantity: string;
  readonly filledQuantity: string;
  readonly openQuantity: string;
  readonly unitPrice: string;
  readonly tradeDate: string;
  readonly confirmationRequired: BlockedStatePresentation | null;
  readonly transitionHistory: readonly Readonly<{
    transition: string;
    sourceState: string;
    targetState: string;
    occurredAt: string;
  }>[];
}

export interface WorkbenchPortfolioResult {
  readonly reconciliationState: "Reconciled";
  readonly portfolioId: string;
  readonly portfolioVersion: string;
  readonly asOf: string;
  readonly cash: string;
  readonly realizedPnL: string;
  readonly totalEquity: string;
  readonly lots: readonly Readonly<{
    lotId: string;
    instrumentId: string;
    acquiredAt: string;
    ledgerSequence: string;
    openQuantity: string;
    openBasis: string;
  }>[];
  readonly positions: readonly Readonly<{
    instrumentId: string;
    quantity: string;
    basis: string;
    valuation: string;
    unrealizedPnL: string;
  }>[];
}

export type WorkbenchPortfolio = WorkbenchPortfolioResult | BlockedStatePresentation;

export interface WorkbenchDocumentInput {
  readonly readiness: WorkbenchReadiness | ReadinessSnapshot;
  readonly failedJobs?: readonly FailedJobPresentation<FailedJobForPresentation>[];
  readonly watchlist?: WorkbenchWatchlist;
  readonly analytics?: WorkbenchAnalytics;
  readonly evidence?: WorkbenchEvidence;
  readonly paperOrder?: WorkbenchPaperOrder;
  readonly portfolio?: WorkbenchPortfolio;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderReadinessDetails(readiness: ReadinessSnapshot): string {
  const dependencies = readiness.dependencies.map((dependency) => `
          <li>
            <strong>${escapeHtml(dependency.dependency)}</strong>
            <span>${escapeHtml(dependency.state)}</span>
            ${dependency.code === null ? "" : `<code>${escapeHtml(dependency.code)}</code>`}
          </li>`).join("");
  const error = readiness.controllingError === null
    ? ""
    : `<p>${escapeHtml(readiness.controllingError.message)}</p>
        <p>Recovery: ${escapeHtml(readiness.controllingError.recovery.label)}</p>`;
  return `<div id="readiness-details">
      <p>Checked ${escapeHtml(readiness.checkedAt)} ${escapeHtml(readiness.displayTimezone)}; liveness ${escapeHtml(readiness.liveness)}.</p>
        <ul>${dependencies}
        </ul>
        ${error}
      </div>`;
}

function renderFailedJobs(
  failedJobs: readonly FailedJobPresentation<FailedJobForPresentation>[],
): string {
  if (failedJobs.length === 0) return "<p>No active jobs.</p>";
  return `<ul>${failedJobs.map((presentation) => `
          <li data-job-id="${escapeHtml(presentation.recoveryTarget.jobId)}">
            <strong>Failed job</strong>
            <code>${escapeHtml(presentation.error.code)}</code>
            <p>${escapeHtml(presentation.error.message)}</p>
            <p>Recovery: ${escapeHtml(presentation.error.recovery.label)}</p>
            <p>Dependent research: ${escapeHtml(presentation.dependentResearch)}</p>
          </li>`).join("")}
        </ul>`;
}

function renderWatchlist(watchlist: WorkbenchWatchlist | undefined): string {
  if (watchlist === undefined) return "<p>No instruments added.</p>";
  const items = watchlist.orderedItems.length === 0
    ? ""
    : watchlist.orderedItems.map((item, index) => `
          <li data-instrument-id="${escapeHtml(item.instrumentId)}" data-position="${escapeHtml(item.position)}">
            <strong>${escapeHtml(item.displayName)}</strong>
            <code>${escapeHtml(item.instrumentId)}</code>
            <span>Validation: ${escapeHtml(item.validationState)}</span>
            <div class="watchlist-actions">
              <button type="button" data-action="move-up" data-boundary-disabled="${index === 0}"${index === 0 ? " disabled" : ""}>Move ${escapeHtml(item.displayName)} up</button>
              <button type="button" data-action="move-down" data-boundary-disabled="${index === watchlist.orderedItems.length - 1}"${index === watchlist.orderedItems.length - 1 ? " disabled" : ""}>Move ${escapeHtml(item.displayName)} down</button>
              <button type="button" data-action="remove">Remove ${escapeHtml(item.displayName)}</button>
            </div>
          </li>`).join("");
  return `<div id="watchlist-controls" data-version="${escapeHtml(watchlist.version)}">
        <p id="watchlist-version">Watchlist version ${escapeHtml(watchlist.version)}</p>
        <p id="watchlist-status" role="status" aria-live="polite"></p>
        <form id="watchlist-form">
          <label for="watchlist-instrument-id">Instrument ID</label>
          <input id="watchlist-instrument-id" name="instrumentId" required>
          <label for="watchlist-display-name">Display name</label>
          <input id="watchlist-display-name" name="displayName" required>
          <button type="submit">Add or update</button>
        </form>
        <noscript>Watchlist changes require JavaScript.</noscript>
        <p id="watchlist-empty"${items === "" ? "" : " hidden"}>No instruments added.</p>
        <ol id="watchlist-items">${items}
        </ol>
      </div>`;
}

function renderBlockedState(presentation: BlockedStatePresentation): string {
  const recovery = presentation.recovery === null
    ? ""
    : `<button type="button" data-operation="${escapeHtml(presentation.recovery.targetOperation)}" data-requires-confirmation="${presentation.recovery.requiresConfirmation}">${escapeHtml(presentation.recovery.label)}</button>`;
  return `<div class="blocked-state" role="${escapeHtml(presentation.programmaticRole)}" data-state="${escapeHtml(presentation.state)}">
        <strong>${escapeHtml(presentation.statusText)}</strong>
        <p>${escapeHtml(presentation.causeText)}</p>
        ${recovery}
      </div>`;
}

function renderAnalytics(analytics: WorkbenchAnalytics | undefined): string {
  if (analytics === undefined) return "<p>No published result.</p>";
  if ("statusText" in analytics) {
    return renderBlockedState(analytics);
  }
  const signals = analytics.state === "NoSignal"
    ? '<p role="status" data-state="NoSignal">No signal. Evaluation completed with no publishable signal.</p>'
    : `<ul class="analytics-signals">${analytics.signals.map((signal) => `
          <li><strong>${escapeHtml(signal.instrumentId)}</strong> <span>${escapeHtml(signal.label)}</span> <data value="${escapeHtml(signal.score)}">${escapeHtml(signal.score)}</data></li>`).join("")}
        </ul>`;
  const metrics = analytics.metrics.length === 0
    ? ""
    : `<dl>${analytics.metrics.map((metric) => `<dt>${escapeHtml(metric.metricId)}</dt><dd>${escapeHtml(metric.value)}</dd>`).join("")}</dl>`;
  const warnings = analytics.warnings.length === 0
    ? ""
    : `<ul class="analytics-warnings">${analytics.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
  return `${signals}${metrics}${warnings}`;
}

function renderEvidence(evidence: WorkbenchEvidence | undefined): string {
  if (evidence === undefined) return "<p>No authorized evidence selected.</p>";
  if (evidence.state !== "Available") return renderBlockedState(evidence);
  return `<dl id="evidence-details">
        <dt>Evidence ID</dt><dd>${escapeHtml(evidence.evidenceId)}</dd>
        <dt>Reproducibility</dt><dd>${escapeHtml(evidence.reproducibilityStatus)}</dd>
        <dt>Evaluation time</dt><dd>${escapeHtml(evidence.evaluationAt)}</dd>
        <dt>Rule</dt><dd>${escapeHtml(evidence.ruleId)} ${escapeHtml(evidence.ruleVersion)}</dd>
      </dl>`;
}

function renderPaperOrder(order: WorkbenchPaperOrder | undefined): string {
  if (order === undefined) return "<p>No hypothetical orders.</p>";
  const transitions = order.transitionHistory.length === 0
    ? "<p>No recorded transitions.</p>"
    : `<ol id="order-transition-history">${order.transitionHistory.map((transition) => `
          <li data-transition="${escapeHtml(transition.transition)}">
            <span>${escapeHtml(transition.sourceState)} to ${escapeHtml(transition.targetState)}</span>
            <time datetime="${escapeHtml(transition.occurredAt)}">${escapeHtml(transition.occurredAt)}</time>
          </li>`).join("")}
        </ol>`;
  return `<div id="paper-order-details" data-order-id="${escapeHtml(order.orderId)}" data-version="${escapeHtml(order.aggregateVersion)}">
        <p role="status">Order status: <span id="order-status" data-state="${escapeHtml(order.state)}">${escapeHtml(order.statePresentation.visibleText)}</span></p>
        <dl>
          <dt>Instrument</dt><dd>${escapeHtml(order.instrumentId)}</dd>
          <dt>Side</dt><dd>${escapeHtml(order.side)}</dd>
          <dt>Requested quantity</dt><dd>${escapeHtml(order.requestedQuantity)}</dd>
          <dt>Filled quantity</dt><dd>${escapeHtml(order.filledQuantity)}</dd>
          <dt>Open quantity</dt><dd>${escapeHtml(order.openQuantity)}</dd>
          <dt>Unit price</dt><dd>${escapeHtml(order.unitPrice)}</dd>
          <dt>Trade date</dt><dd>${escapeHtml(order.tradeDate)}</dd>
        </dl>
        ${order.confirmationRequired === null ? "" : renderBlockedState(order.confirmationRequired)}
        ${transitions}
      </div>`;
}

function renderPortfolio(portfolio: WorkbenchPortfolio | undefined): string {
  if (portfolio === undefined) return "<p>No reconciled portfolio selected.</p>";
  if ("statusText" in portfolio) return renderBlockedState(portfolio);
  const positions = portfolio.positions.length === 0
    ? "<p>No positions.</p>"
    : `<table id="portfolio-positions">
        <caption>Positions</caption>
        <thead><tr><th>Instrument</th><th>Quantity</th><th>Basis</th><th>Valuation</th><th>Unrealized P&amp;L</th></tr></thead>
        <tbody>${portfolio.positions.map((position) => `<tr>
          <th scope="row">${escapeHtml(position.instrumentId)}</th>
          <td>${escapeHtml(position.quantity)}</td>
          <td>${escapeHtml(position.basis)}</td>
          <td>${escapeHtml(position.valuation)}</td>
          <td>${escapeHtml(position.unrealizedPnL)}</td>
        </tr>`).join("")}</tbody>
      </table>`;
  const lots = portfolio.lots.length === 0
    ? "<p>No open lots.</p>"
    : `<table id="portfolio-lots">
        <caption>Open lots</caption>
        <thead><tr><th>Instrument</th><th>Acquired</th><th>Ledger sequence</th><th>Open quantity</th><th>Open basis</th></tr></thead>
        <tbody>${portfolio.lots.map((lot) => `<tr data-lot-id="${escapeHtml(lot.lotId)}">
          <th scope="row">${escapeHtml(lot.instrumentId)}</th>
          <td>${escapeHtml(lot.acquiredAt)}</td>
          <td>${escapeHtml(lot.ledgerSequence)}</td>
          <td>${escapeHtml(lot.openQuantity)}</td>
          <td>${escapeHtml(lot.openBasis)}</td>
        </tr>`).join("")}</tbody>
      </table>`;
  return `<div id="portfolio-details" data-portfolio-id="${escapeHtml(portfolio.portfolioId)}" data-version="${escapeHtml(portfolio.portfolioVersion)}" data-reconciliation-state="${escapeHtml(portfolio.reconciliationState)}">
        <p>As of ${escapeHtml(portfolio.asOf)}</p>
        <dl>
          <dt>Cash</dt><dd>${escapeHtml(portfolio.cash)}</dd>
          <dt>Realized P&amp;L</dt><dd>${escapeHtml(portfolio.realizedPnL)}</dd>
          <dt>Total equity</dt><dd>${escapeHtml(portfolio.totalEquity)}</dd>
        </dl>
        ${positions}
        ${lots}
      </div>`;
}

export function renderWorkbenchDocument(
  input: WorkbenchDocumentInput,
): string {
  if (
    input.readiness === null ||
    (typeof input.readiness !== "object" &&
    input.readiness !== "Ready" &&
    input.readiness !== "NotReady")
  ) {
    throw new TypeError("Workbench readiness must be Ready or NotReady");
  }
  const readinessState = typeof input.readiness === "object"
    ? input.readiness.state
    : input.readiness;
  const readinessRole = readinessState === "Ready" ? "status" : "alert";
  const readinessDetails = typeof input.readiness === "object"
    ? renderReadinessDetails(input.readiness)
    : input.readiness === "NotReady"
    ? `<div id="readiness-details">
      <p>Application status is unavailable. Retry the request or review local diagnostics.</p>
      </div>`
    : "";
  const jobs = renderFailedJobs(input.failedJobs ?? []);
  const watchlist = renderWatchlist(input.watchlist);
  const analytics = renderAnalytics(input.analytics);
  const evidence = renderEvidence(input.evidence);
  const paperOrder = renderPaperOrder(input.paperOrder);
  const portfolio = renderPortfolio(input.portfolio);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ETF Analyzer</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17211b;
      --muted: #56625b;
      --paper: #f5f7f2;
      --surface: #ffffff;
      --line: #cbd2ca;
      --forest: #174c3c;
      --signal: #b83b2d;
      --gold: #d8a23f;
      --focus: #0067b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--paper);
      font-family: "Aptos", "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    a { color: inherit; }
    a:focus-visible { outline: 3px solid var(--focus); outline-offset: 4px; }
    .skip-link {
      position: fixed;
      inset: 0 auto auto 1rem;
      z-index: 10;
      padding: .75rem 1rem;
      color: white;
      background: var(--focus);
      transform: translateY(-120%);
    }
    .skip-link:focus { transform: translateY(1rem); }
    header {
      color: white;
      background: var(--forest);
      border-bottom: 5px solid var(--gold);
    }
    .header-inner, main {
      width: min(100% - 2rem, 90rem);
      margin-inline: auto;
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 5.5rem;
      gap: 2rem;
    }
    h1, h2 { font-family: "Charter", "Georgia", serif; letter-spacing: 0; }
    h1 { margin: 0; font-size: 1.75rem; }
    nav ul { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; margin: 0; padding: 0; list-style: none; }
    nav a { text-decoration-thickness: 2px; text-underline-offset: .3rem; }
    main { padding-block: 2rem 4rem; }
    .workspace-status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-block: 0 1.25rem;
      border-bottom: 1px solid var(--line);
    }
    .workspace-status p { margin: 0; font-weight: 700; }
    .workspace-status span { color: var(--muted); font-weight: 500; }
    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(16rem, .8fr) minmax(26rem, 1.7fr);
      gap: 0 2rem;
    }
    section { min-width: 0; padding-block: 1.75rem; border-bottom: 1px solid var(--line); }
    section h2 { margin: 0 0 .75rem; font-size: 1.35rem; }
    section p { max-width: 72ch; margin: .4rem 0; color: var(--muted); }
    form, .watchlist-actions { display: flex; flex-wrap: wrap; align-items: end; gap: .5rem; }
    input, button { min-height: 2.75rem; font: inherit; }
    input { max-width: 100%; border: 1px solid var(--line); padding: .5rem; }
    button { border: 1px solid var(--forest); padding: .45rem .75rem; color: var(--forest); background: var(--surface); }
    button:focus-visible, input:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
    button:disabled { color: var(--muted); border-color: var(--line); }
    #watchlist-items li { display: grid; gap: .4rem; margin-block: 1rem; }
    .warning {
      color: var(--ink);
      font-weight: 650;
      border-inline-start: 4px solid var(--signal);
      padding-inline-start: .75rem;
    }
    @media (max-width: 52rem) {
      .header-inner { align-items: flex-start; flex-direction: column; padding-block: 1.25rem; gap: 1rem; }
      .workspace-grid { display: block; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header>
    <div class="header-inner">
      <h1>ETF Analyzer</h1>
      <nav aria-label="Primary">
        <ul>
          <li><a href="#watchlist">Watchlist</a></li>
          <li><a href="#analytics">Analytics</a></li>
          <li><a href="#evidence">Evidence</a></li>
          <li><a href="#paper">Paper orders</a></li>
          <li><a href="#portfolio">Portfolio</a></li>
          <li><a href="#operations">Operations</a></li>
        </ul>
      </nav>
    </div>
  </header>
  <main id="main-content">
    <div class="workspace-status">
      <strong>Local workspace</strong>
      <p role="${readinessRole}" data-state="${escapeHtml(readinessState)}"><span>Status: </span>${escapeHtml(readinessState)}</p>
    </div>
    ${readinessDetails}
    <div class="workspace-grid">
      <section id="watchlist" aria-labelledby="watchlist-heading">
        <h2 id="watchlist-heading">Watchlist</h2>
        ${watchlist}
      </section>
      <section id="analytics" aria-labelledby="analytics-heading">
        <h2 id="analytics-heading">Analytics</h2>
        <p class="warning">${researchWarning}</p>
        ${analytics}
      </section>
      <section id="evidence" aria-labelledby="evidence-heading">
        <h2 id="evidence-heading">Evidence</h2>
        <p class="warning">${researchWarning}</p>
        ${evidence}
      </section>
      <section id="paper" aria-labelledby="paper-heading">
        <h2 id="paper-heading">Paper orders</h2>
        <p class="warning">${researchWarning}</p>
        ${paperOrder}
      </section>
      <section id="portfolio" aria-labelledby="portfolio-heading">
        <h2 id="portfolio-heading">Portfolio</h2>
        ${portfolio}
      </section>
      <section id="operations" aria-labelledby="operations-heading">
        <h2 id="operations-heading">Operations</h2>
        ${jobs}
      </section>
    </div>
  </main>
  <script type="module" src="/workbench.js"></script>
</body>
</html>`;
}
