# REV-183 - WP-8 CT-DB-001J Security Review

**Date:** 2026-09-22
**Reviewer:** Security Reviewer agent using an alternate model
**Disposition:** PASS

No Critical, Major, or blocking Minor security finding remains. The review verified narrow `app_runtime` execute authority on the existing `SECURITY DEFINER` `etf.job_restart(jsonb)` function, fixed `pg_catalog, etf` search path, no runtime base-table authority, authoritative row locking, one attempt increment, checkpoint continuity, and same-transaction replay persistence.

The PostgreSQL replay store performs replay lookup, owner dispatch, owner-result validation, replay persistence, and commit in one transaction. Failed owner results roll back to the owner savepoint before the bounded failure envelope is cached. A forced replay-persistence failure rolls back the successful restart, while a committed retry returns the original result without owner dispatch or duplicate mutation.

Exact SQLSTATE plus exact custom PostgreSQL message matching remains intentional. `P0001` and `P0002` are shared classes, so permissive substring or SQLSTATE-only matching would weaken semantic separation. Unit tests cover exact Job refusal/not-found/permission mappings and unknown/malformed fail-closed behavior; live pinned PostgreSQL proves the exact restart refusal path. Separate cross-function `job_start`/`job_get` UInt normalization and explicit token-drift hardening are tracked by GitHub issue #85 under WP-8 #84 and are outside CT-DB-001J.

The canonical CT-DB-001A-J run passes 31 selected tests with zero failures on pinned PostgreSQL 16.15 and Node 20. The only remaining condition at review time was creation of the final REV and decision/evidence records; no technical remediation remained.

This PASS supports CT-DB-001J only. It does not accept PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, or production.
