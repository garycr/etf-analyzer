# REV-124 - WP-6 Dual-Chain Atomicity Security Review

**Date:** 2026-09-18
**Reviewer:** Security Reviewer agent using GPT-5 mini, independent review
**Scope:** CT-LED-014 least privilege, security-definer boundaries, HMAC key and anchor rollback, migrated schema authority, and migration identity integrity
**Disposition:** PASS

## Findings

No in-scope Critical, Major, or Minor security defect remains. Migration 0003 grants runtime roles only schema usage needed to resolve controlled entry points; it does not grant runtime table DML or ownership. Sensitive functions retain fixed `pg_catalog, etf` search paths, explicit session-user enforcement, narrow execute grants, non-login owners, and revoked public execution.

Missing active keys fail closed with `LEDGER_INTEGRITY_FAILED` inside the owning transaction. The ledger path rolls back business, audit, commitment, anchor, checkpoint, and version mutations together. The audit-only path rolls back its audit row and HMAC chain together, preserving predecessor continuity for a valid retry. Canonical migration identities make the ACL change visible through sequences 3 through 6.

## Evidence

- PostgreSQL 16.15 UTF8/C/UTC complete suite: 419 passed, 0 failed, 0 skipped.
- Dependency audit: 0 vulnerabilities.
- REV-123 final code-review recheck: PASS after migrated-authority remediation.

## Residual Risk

Operational provisioning must preserve NOINHERIT runtime identities and isolated key-injector custody. Future migrations must retain pinned security-definer search paths, public-execute revocation, and manifest review for any new schema or function grant. These are existing platform controls, not CT-LED-014 blockers.