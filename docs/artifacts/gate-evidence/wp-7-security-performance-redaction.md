# WP-7 Security Performance And Redaction Evidence

**Date:** 2026-09-22
**Scope:** PT-UI-010
**Result:** PASS; WP-7 remains active

## Executable Evidence

| Check | Result |
| --- | --- |
| PT-UI-010 focused build/test | 1/1 PASS, zero skipped |
| Adapter/Application/workbench regression | 17/17 PASS, zero skipped |
| Dashboard performance | Representative full composition p95 below 2,000 ms |
| Non-analytical API performance | Successful readiness p95 below 1,000 ms |
| Loopback mediation | Host and Origin rejection PASS for HTML, script, and API |
| Browser policy | Exact CSP, framing, permissions, referrer, MIME, and no-store assertions PASS |
| Redaction | API and document exceptions plus Application owner canonicalization PASS |
| Changed-file diagnostics | Zero errors |
| Dependency audit | Zero vulnerabilities |
| Code review | REV-153 PASS; no open findings |
| Security review | REV-154 PASS; no open findings |

## Security Boundary

The workbench remains bound to exact IPv4 loopback and the closed 16-operation Application API. HTML and module responses reject hostile Hosts and Origins, disable caching and unused sensitive browser capabilities, prevent framing, suppress referrers, prevent MIME sniffing, and retain same-origin script/connect policy. JSON success and Problem responses are also non-cacheable and non-sniffable.

## Performance Boundary

The dashboard measurement includes successful readiness, watchlist, running job, analytics, evidence, draft paper order, and reconciled portfolio presentation after warm-up. The API measurement uses successful readiness responses. Both checks are deterministic local acceptance gates rather than production load claims.

## Residual Boundary

PT-UI-001..010 and PT-ANA-A11Y-001 now pass. WP-7 does not close on this evidence: the PostgreSQL 16 suite must run with zero skips, aggregate host/browser evidence must be refreshed, and the closure review must pass before WP-8 becomes eligible.
