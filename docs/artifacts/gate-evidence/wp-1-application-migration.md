# WP-1 Application Migration Evidence

**Date:** 2026-09-14
**Scope:** `0002-application`, DEC-025 owner authority, DEC-026 watchlist version state, and sequence-2 canonical projection
**Result:** PASS for the reviewed increment

## Canonical Artifacts

- Migration identity: `0002-application`, sequence 2
- Exact SQL-byte SHA-256: `9865cd75bd6249b4a567daf840f95ad3d7b52bbf534060e87a34516fd0867fdb`
- Resulting manifest SHA-256: `d61a6a94778bcfb9d57b449690b8c7888b65a044f809467be28a13d0c2640d34`
- Canonical manifest length: 7,480 UTF-8 bytes
- Cumulative catalog: 10 tables, 5 functions, 14 roles, and 9 memberships

## Executed Behavior

Pinned PostgreSQL `16.15|UTF8|UTC|on|C` created six application tables and five controlled functions under `application_writer_owner`. The owner retained schema USAGE and lost CREATE before projection; PUBLIC had no function execution. The real catalog projector validated exact cumulative objects, fixed function configuration, normalized function-body hashes, migration sequence, role memberships, and grants.

Live behavior proved application replay return/conflict, stable malformed-input errors, watchlist expected-version checks, remove-last/reinsert monotonic versioning, one-winner concurrent writes, job start/restart, exact ordered readiness dependencies, and top-level readiness nullability. The full suite passed 61/61 with zero skips, TypeScript compiled cleanly, and `npm audit --audit-level=high` found zero vulnerabilities.

## Review

REV-035 accepted DEC-025 after sequence-2 canonical evidence closed its conditional finding. REV-036 accepted the repaired 0002 implementation with no Critical or Major blocker. REV-037 approved DEC-026 with no Critical or Major finding.

## Boundary

This evidence covers only 0002. Migrations `0003` through `0006`, their hashes, complete CT-DB-001 evidence, WP-1 exit, WP-2, baseline activation, release, deployment, and production action remain open or unauthorized.
