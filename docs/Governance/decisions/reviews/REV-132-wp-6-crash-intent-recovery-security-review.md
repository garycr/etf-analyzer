# REV-132 - WP-6 Crash-Intent Recovery Security Review

**Date:** 2026-09-18
**Reviewer:** Security Reviewer agent using GPT-5 mini, independent review
**Scope:** CT-LED-018 security-definer recovery replay, concurrent identity collision, key confidentiality, and audit-chain integrity
**Disposition:** PASS

## Findings

No Critical or High security defect remains. Fixed search paths, `session_user` routing, narrow execution grants, complete subject matching, workload identity, and key identifier checks prevent cross-workload or cross-key recovery replay. The replay result exposes only the existing audit identity, evidence hash, and sequence; key bytes remain inside the anchor owner.

The initial review found that two different attempts could race on one globally unique audit identity and expose PostgreSQL `23505`. The function now acquires namespaced attempt and audit-identity transaction locks in that order. A real two-collector race proves one append succeeds, the loser receives stable `AUDIT_REQUEST_INVALID` / `22023`, and exactly one linked audit, commitment, and checkpoint survive.

## Evidence

- Focused CT-LED-018 PostgreSQL test: 1 passed, 0 failed, 0 skipped.
- Final migration identity and behavior checks: 17 passed, 0 failed, 0 skipped.
- PostgreSQL complete suite: 423 passed, 0 failed, 0 skipped.
- Dependency audit: 0 vulnerabilities.
- REV-131 code review: PASS.

## Residual Risk

Future functions must not acquire the attempt, audit-identity, or audit-commitment lock namespaces in reverse order. Hash collisions in the 64-bit advisory-lock key space remain a very low contention risk, not an integrity bypass.
