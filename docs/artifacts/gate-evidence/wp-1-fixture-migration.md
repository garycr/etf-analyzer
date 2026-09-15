# WP-1 Fixture Migration Evidence

**Date:** 2026-09-14
**Scope:** `0004-fixtures` and sequence-4 canonical projection on an empty database
**Result:** PASS for the reviewed increment

## Canonical Artifacts

- Migration identity: `0004-fixtures`, sequence 4
- Exact SQL-byte SHA-256: `8f73d86024e38c043328c3ac3102dffb627df579757009f150f789bba1bb5b60`
- Resulting manifest SHA-256: `897c67ad05bb35c602c74d412172c8cc0aff398b5448711af25a43974017fda6`
- PostgreSQL baseline: `16.15|UTF8|UTC|on|C`
- Autonomous work-item trace: GitHub issue #67

The 2026-09-15 WP-1 closure recomputed this cumulative manifest with the final sequence-6 projector and corrected sequence-3 authority. This hash supersedes the earlier incremental projection; no sequence-4 SQL bytes changed.

## Executed Behavior

Pinned PostgreSQL 16.15 applied migrations 0001 through 0004 to a clean database. Migration 0004 created six fixture tables, one hardened `SECURITY DEFINER` function, seven immediate restrictive foreign keys, three uniqueness constraints, and two selection indexes. Every declared constraint and index identifier fits PostgreSQL's 63-byte limit, and live catalog queries proved the exact deterministic names, owners, function configuration, and denial of PUBLIC execution.

Synthetic conformance records proved atomic package, descriptor, raw-source, market, economic, and replay persistence. Explicit ordering returned two market revisions and two economic releases without relying on storage order. Readback preserved raw bytes, timestamps, numeric text, quality-code order, package identity, and reviewed payload content. Replay was idempotent for identical governed content and rejected changed content under the same identity. Malformed temporal, decimal, quality, and observation values were rejected without partial package state.

Forced manifest projection failure rolled back all six fixture tables, `fixture_ingest(jsonb)`, its staged grant, and the sequence-4 migration ledger row while preserving the preceding migration rows and authority. The complete repository suite passed 86/86; TypeScript lint passed; `git diff --check` passed; and the dependency audit found zero vulnerabilities.

## Review

REV-040 accepted the bounded 0004 implementation with no remaining in-scope finding after the physical-preservation, replay-custody, exact-catalog, ordered-readback, rollback, and identifier-limit findings were closed.

## Empty-Database Boundary

This first pass is additive. The target contains no legacy data, so no row copy, transformation, backfill, historical reconciliation, or cutover logic is required or evidenced. Synthetic rows exist only for executable conformance.

JSONL reconstruction, complete fixture package/manifest/coverage validation, package digest computation, PT-FIX-001A..O, and provider-egress evidence remain assigned to WP-2. This evidence covers only 0004. Migrations `0005` and `0006`, complete WP-1 exit, WP-2, baseline activation, release, deployment, and production action remain open or unauthorized.
