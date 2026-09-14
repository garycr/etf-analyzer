# REV-037: DEC-026 Watchlist State Architecture Review

**Date:** 2026-09-14
**Reviewer:** Architect Reviewer, Claude Sonnet 5 dispatch
**Scope:** Explicit watchlist aggregate-version state, row locking, authority, catalog closure, and canonical evidence
**Result:** APPROVED

## Disposition

DEC-026 adds exactly one `watchlist_state(singleton boolean,version bigint)` row, seeded as `(true,0)`, under `application_writer_owner`. Every watchlist compare-and-write locks the row with `FOR UPDATE`, validates the expected version, and advances it in the same function transaction. The boolean primary key plus true-only check prevents another valid singleton identity.

The design preserves least authority: no runtime receives direct table access, PUBLIC function execution remains revoked, and DEC-025 leaves the function owner with schema USAGE but no CREATE. It introduces no queue, worker, event surface, role, membership, or hidden replay authority.

Pinned PostgreSQL execution proves version progression through final-item removal and reinsert, and proves two concurrent same-version writers yield exactly one commit. The contract, migration, projector, SQL hash `9865cd75bd6249b4a567daf840f95ad3d7b52bbf534060e87a34516fd0867fdb`, manifest hash `d61a6a94778bcfb9d57b449690b8c7888b65a044f809467be28a13d0c2640d34`, 7,480-byte length, and 61/61 suite evidence are consistent.

No Critical or Major finding remains. A dedicated ADR was suggested but is not required for this Tier 1 decision.

## Boundary

This approval covers only DEC-026 and the 0002 application migration. Migrations `0003` through `0006`, complete CT-DB-001, WP-1 exit, WP-2, release, deployment, and production remain open or unauthorized.
