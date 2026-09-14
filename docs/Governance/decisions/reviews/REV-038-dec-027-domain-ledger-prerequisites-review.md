# REV-038: DEC-027 Domain-Ledger Prerequisites Review

**Date:** 2026-09-14
**Reviewer:** Architect Reviewer, Claude Sonnet 5 dispatch
**Scope:** Cryptographic authority, extension placement, nested owner calls, order instrument identity, and canonical rebaseline
**Result:** APPROVED

DEC-027 closes the prerequisites for all six 0003 controlled functions. PostgreSQL 16.15 externally provisions `pgcrypto` 1.3 in its default `public` schema because installation in `pg_catalog` conflicts with the core `gen_random_uuid()` signature. Controlled functions retain `search_path=pg_catalog,etf` and call `public.digest` and `public.hmac` only by qualified name. Product roles cannot create or replace objects in `public`.

The exact owner graph uses a four-column order read for ledger validation, nested function EXECUTE grants, and a read-only anchor `Verify` variant for projection publication. Required `instrumentId` is immutable from draft creation through storage and reads. Exact sequence-1 and sequence-2 manifests were regenerated on PostgreSQL `16.15|UTF8|UTC|on|C`: `0c378abe080211c705c41ffd15f9cf8bf7dbc61396917df25444144ed3992c1b` at 5,324 bytes and `a2e237842fd026651e33ef66bcbe0aea56a9c03160ce4b583d902424ac80a3a5` at 7,532 bytes. Migration SQL hashes are unchanged, and focused live tests pass 5/5.

No Critical or Major finding remains. All six 0003 functions may be implemented. This approval does not open 0004, WP-2, release, deployment, or production.
