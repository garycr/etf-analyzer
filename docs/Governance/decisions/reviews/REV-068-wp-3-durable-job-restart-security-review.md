# REV-068: WP-3 Durable Job Restart Security Review

**Date:** 2026-09-16
**Reviewer:** Security Reviewer, alternate model
**Scope:** PT-APP-001D `SECURITY DEFINER` restart and durable job-read changes
**Result:** PASS

## Findings

- **Critical:** None.
- **Major:** None.
- **Minor:** None blocking.
- **Defense in depth:** PT-APP-001M should validate application UUID admission and reassess an explicit `session_user` guard if `job_restart` is later granted directly to `app_runtime`.

## Disposition

The review confirmed that checkpoint selection is constrained by exact `job_id` and authoritative attempt, preventing cross-job disclosure and future-attempt selection. `SELECT ... FOR UPDATE` serializes competing restarts and prevents double increment. Refusal precedes mutation, SQL uses no dynamic execution, casts follow grammar validation, both functions pin `search_path`, and PUBLIC execution remains revoked.

The observations do not block this owner-mediated slice. Runtime request admission and future runtime-role wiring remain explicitly assigned to PT-APP-001M.
