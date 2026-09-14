# REV-033: DEC-024 Database ACL Amendment Review

**Date:** 2026-09-14
**Reviewer:** Architect Reviewer, Claude Sonnet 5 dispatch
**Scope:** Exact external database ACL provisioning, NULL-ACL manifest expansion, rollback, recovery, contract and CT-DB traceability
**Result:** PASS

## Disposition

The initial alternate-model review returned Conditional because the implementation correctly revoked database `CONNECT,TEMPORARY` from `PUBLIC`, granted `CONNECT` only to the six closed login roles, and expanded NULL database/function ACLs, but DEC-024, CT-DB-001A/B/D, recovery guidance, and gate evidence did not yet disclose that provisioner authority.

The Workspace Owner's explicit selection of exact external database ACL provisioning is now recorded as an amendment to DEC-024. The PostgreSQL contract enumerates the exact transaction and canonical evidence behavior. CT-DB-001A defines the provisioner operations, CT-DB-001B treats extra or missing database grants as drift, and CT-DB-001D denies every PUBLIC database privilege while allowing CONNECT only to the six login roles. Recovery remains operator-owned and fail-closed.

Pinned PostgreSQL 16 execution proves rollback both before and after the database ACL mutation, restores fixture defaults, exposes implicit PUBLIC function execution, rejects unsupported catalog objects, and preserves the 5,272-byte foundation manifest with SHA-256 `83b1c823ef98044704fa903c8c68e091a304be8adda103727231d7252972dd9e`. The complete live suite passed 56/56 with zero skips.

The final recheck found no Critical or Major condition. The amendment improves least privilege and evidence fidelity without changing the product-role trust boundary.

## Boundary

This PASS accepts only the DEC-024 database-ACL and canonical ACL-evidence amendment. Migrations `0002` through `0006`, complete CT-DB-001 executable evidence, WP-1 exit, WP-2 overlap, baseline activation, release, deployment, and production action remain open or unauthorized.
