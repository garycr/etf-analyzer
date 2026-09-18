# REV-112 - WP-6 Ledger Arithmetic Security Review

**Date:** 2026-09-18
**Reviewer:** Security Reviewer agent, independent final recheck
**Scope:** CT-LED-003..007 numeric admission, authority, and mutation boundaries
**Disposition:** PASS

## Findings and Remediation

The initial review found one Major issue: PostgreSQL accepts `NaN` as `numeric`, allowing direct paper-order calls to bypass comparison-based constraints. Exact JSON string and canonical decimal grammar checks now execute before casts, locks, replay lookup, or mutation for ledger deposits/fills and paper-order OT-01/OT-05/OT-06/OT-09 commands. Live tests reject `NaN`, `Infinity`, and `-Infinity` without persistent effects.

The final review found no Critical or Major issue. `SECURITY DEFINER` search paths, caller checks, canonical-byte comparison, fixed error responses, narrow execute grants, immutable audit surfaces, and PostgreSQL-only durable mutation authority remain intact.

## Residual Risk

A pre-existing Minor denial-of-service hardening opportunity remains: canonical decimal regexes do not cap integer digit-string length before PostgreSQL numeric parsing. GitHub issue #81 tracks bounded-length admission and tests; it does not block this checkpoint.

## Evidence

- Direct non-finite ledger and paper-order vectors pass with zero mutation.
- PostgreSQL 16.15 C/UTF8/UTC complete suite: 413 passed, 0 failed, 0 skipped.
- Dependency audit: 0 vulnerabilities.
- Security Reviewer final disposition: PASS.
