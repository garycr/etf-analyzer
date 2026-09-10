# Objective Summary

## Source scope

The specified/proposed scope is the Objective PDF pages 1-14. The opening pages define the local single-user browser workbench, explicit non-goals, and the provider-policy posture. Pages 3-6 add functional requirements for watchlists, market data, economic data, analytics, portfolios, UX, operations, AI constraints, and export controls. Pages 7-14 define the target architecture, PostgreSQL model, job and readiness rules, UX/non-functional gates, testing acceptance criteria, provider assessments, and the legacy mapping mandate.

## Requirements

| ID | Requirement | Source scope | Priority | Gherkin coverage |
| --- | --- | --- | --- | --- |
| O-REQ-001 | Local single-user browser workbench with no brokerage connector, credential transmission path, or real-order endpoint. | p1 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-002 | Explicit non-goals: no streaming/intraday, advice/guarantees, real money/brokerage, paid data, options/futures/leverage/margin/shorting/tax, multi-tenancy, HA-DR, mobile, Azure, or backward-compatibility layers. | p2 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-003 | Watchlist CRUD, reorder, deduplication, symbol validation, and resumable ingestion/backfill handling with provenance and DQ suppression. | p3 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-004 | Full raw and normalized provenance, idempotent ingest, DQ checks, failure suppression, economic series metadata/vintages, deterministic snapshot analytics, and neutral labels. | p3 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-005 | Portfolio, ledger, order-state, confirmation, immutable/reversing ledger, FIFO accounting, and reconciliation requirements. | p4-p5 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-006 | UX/accessibility requirements including keyboard navigation, visible focus, semantic structure, non-color status cues, and core workflows at 1280x720. | p10-p11 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-007 | Operational controls for jobs, readiness, redacted diagnostics, backup/restore, and least-privilege security. | p7-p8, p11-p12 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-008 | Provider policy controls for acknowledgment, quota/rights review, direct official adapters, fixtures-first fallback, and organizational-use disablement until rights are confirmed. | p4-p6, p14 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-009 | Clean bootstrap and deploy with local Kubernetes, PostgreSQL readiness, fixture data, migrations, and integration smoke checks. | p7-p8, p12-p13 | High | [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) |
| O-REQ-010 | Legacy-to-target migration trace with explicit validation of SQL Server assumptions and source ambiguity. | p13-p14 | Medium | [Legacy ingestion feature](../../../specs/features/Legacy-Code-market-data-ingestion.feature), [Legacy persistence feature](../../../specs/features/Legacy-Code-price-persistence.feature), [Legacy operations feature](../../../specs/features/Legacy-Code-operations.feature) |

## Constraints

| ID | Constraint | Source scope | Impact |
| --- | --- | --- | --- |
| O-CST-001 | No brokerage connector, real-order endpoint, or provider-side paper API may be used. | p1, p10, p14 | Keeps the prototype research-only. |
| O-CST-002 | Local first, single-user, browser workbench only; no Azure, multi-tenancy, HA-DR, mobile, or backward-compatibility layer. | p1-p2 | Prevents accidental production scale assumptions. |
| O-CST-003 | UTC and exchange calendar meaning are part of the operating model; missing or unvalidated data blocks analytics. | p2, p3 | Surfaces bad inputs rather than silently producing signals. |
| O-CST-004 | No failover within a dataset; fixtures are always available; provider settings acknowledgment is required. | p4-p6 | Limits legal and operational risk. |
| O-CST-005 | Direct official economic adapters are required; forward-fill and resampling are versioned transformations, not overwrites. | p6 | Preserves economic data provenance and vintage truth. |
| O-CST-006 | Organizational free ingestion is disabled until rights are confirmed; this is a product control, not legal advice. | p5-p6 | Protects legal and contractual boundaries. |
| O-CST-007 | PostgreSQL is the persistence target, with bounded numeric semantics, immutable/reversing ledger rules, and migration validation. | p7-p9 | Preserves reconciliation and auditability. |
| O-CST-008 | Legacy scraping, machine-specific SQL Server assumptions, and provider-specific heuristics are evidence-only; they are not accepted target requirements. | p13-p14 | Keeps migration analysis grounded in source validation. |

## Metrics and quality gates

| ID | Metric | Target | Source |
| --- | --- | --- | --- |
| O-MET-001 | Non-analytical API response | p95 under <1 second | p10 |
| O-MET-002 | Dashboard first meaningful content | under <2 seconds | p10 |
| O-MET-003 | UI usability | core workflows at 1280x720 | p10 |
| O-MET-004 | Reconciliation | zero accounting difference within configured decimal precision | p10, p12 |
| O-MET-005 | Diagnostic hygiene | no raw provider data, keys, or brokerage artifacts in exported diagnostics | p10-p12 |
| O-MET-006 | Job resilience | failed provider outage must fail the job rather than succeed with zero rows | p12 |
| O-MET-007 | Reproducibility | matching hashes for same inputs, code hash, parameters, seed, and environment | p9, p12 |
| O-MET-008 | Readiness | app readiness waits on migrations and required DB connectivity | p7-p8, p11 |

## Provider and compliance controls

| ID | Control | Requirement | Source |
| --- | --- | --- | --- |
| O-COMP-001 | yfinance | Conditional personal/local use only; revalidate before operational use. | p14 |
| O-COMP-002 | Alpha Vantage | 25 requests/day fallback adapter; must be revalidated before use. | p4-p6 |
| O-COMP-003 | Tiingo Starter | 500 symbols/month, 50/hour, 1,000/day, 30+ years, but rejected for durable free storage; still requires revalidation. | p4-p6 |
| O-COMP-004 | Alpaca IEX | Approximately 2.5% volume secondary only; use only when rights and terms are confirmed. | p4-p6 |
| O-COMP-005 | EODHD | 20/day and one-year personal-use fixture only; not a blanket legal authorization. | p4-p6 |
| O-COMP-006 | Stooq | Manual validation only; no unreviewed ingestion path. | p4-p6 |
| O-COMP-007 | Organizational use | Disable free ingestion until rights are confirmed; this is a product control, not legal advice. | p5-p6 |
| O-COMP-008 | Settings acknowledgment | Record provider, terms URL/date, persistence/display permissions, and user choice. | p5-p6 |
| O-COMP-009 | Export and diagnostics | User-owned exports remain subject to provider policy; diagnostics stay redacted. | p4, p10-p12 |

## Legacy mappings and ambiguity notes

| ID | Legacy evidence | Target interpretation | Source |
| --- | --- | --- | --- |
| O-LEG-001 | XML symbol list and Yahoo historical URL generation | Historical evidence of retrieval logic only; not a future-state requirement. | [Requestor.cs](../Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.HtmlParser/Requestor.cs) |
| O-LEG-002 | Regex-based HTML extraction | Historical parsing pattern; replaced by validated provider contracts and provenance rules. | [Extractor.cs](../Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.HtmlParser/Extractor.cs) |
| O-LEG-003 | SQL Server data binding and batch insert logic | Useful migration evidence only; target uses PostgreSQL with validation and bounded numeric semantics. | [ETFDb.cs](../Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETFDb.cs) |
| O-LEG-004 | `Id` primary key and `UpSert_ETFPrices` naming | The schema establishes a row identifier but does not prove a demonstrated `unique(Symbol, Date)` business key. The target design must validate and enforce the required uniqueness before claiming identity semantics. | [ETF.dbml](../Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETF.dbml), [ETF.designer.cs](../Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETF.designer.cs) |
| O-LEG-005 | WinForms tester accepts symbol input only | Manual operator workflow is historical evidence; not a proof of scheduled execution or date-range capabilities. | [Form1.cs](../Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.ClientTester/Form1.cs) |
| O-LEG-006 | Program console runner | Default three-day lookback and optional day-count/end-date arguments are not equivalent to a proven scheduling layer; external scheduling remains an unverified dependency/gap. | [Program.cs](../Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.YahooQuoteService/Program.cs) |

## Inclusion and accessibility

| ID | Requirement | Source |
| --- | --- | --- |
| O-ACC-001 | Keyboard navigation, visible focus, semantic headings, labels, contrast, and non-color-only signals are required. | p10-p11 |
| O-ACC-002 | The UI must distinguish trade date, source timestamp, retrieval timestamp, completion timestamp, and display timezone. | p10-p11 |
| O-ACC-003 | Core workflows must remain usable at 1280x720 and tablet sizes. | p10-p11 |
| O-ACC-004 | Research-only disclaimers must be persistent and visible on analytical pages. | p10 |
| O-ACC-005 | Destructive actions require confirmation and produce audit events. | p10 |
| O-ACC-006 | Blocking warnings must show stale, partial, quarantined, or incompatible data without relying on color alone. | p10 |

## Source anchors

- Objective PDF: [ETF Trade Recommendation Prototype Requirements PDF](ETF Trade Recommendation Prototype Requirements.pdf)
- Objective feature: [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature)
- Legacy ingestion feature: [Legacy ingestion feature](../../../specs/features/Legacy-Code-market-data-ingestion.feature)
- Legacy persistence feature: [Legacy persistence feature](../../../specs/features/Legacy-Code-price-persistence.feature)
- Legacy operations feature: [Legacy operations feature](../../../specs/features/Legacy-Code-operations.feature)
