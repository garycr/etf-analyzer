# WP-3 Durable Job Restart Evidence

**Date:** 2026-09-16
**Scope:** PT-APP-001D durable fixture-ingestion restart and checkpoint continuity
**Result:** PASS

## Executed Behavior

`restartDurableJob` dispatches one frozen `{jobId}` request and preserves the PostgreSQL owner's result or error without retry or translation. `etf.job_restart(jsonb)` locks the authoritative job row, accepts only `Failed` plus `Restartable`, increments attempt exactly once, transitions to `Pending`, and retains job identity, operation, original command identity, input identity, accepted/rejected progress, and the latest committed checkpoint.

Both restart and durable `job_get` select only checkpoints for the same job whose attempt is not newer than the authoritative job attempt, ordered by attempt and sequence descending. A restarted attempt therefore resumes from prior committed work until it commits a newer checkpoint. Restart does not insert, update, or delete checkpoint/effect rows.

## Test-First Evidence

- Red owner result: attempt 2 omitted its attempt-1 committed checkpoint.
- Red durable read: `job_get` returned a null checkpoint when the job was at attempt 2 and its latest committed checkpoint was at attempt 1.
- Green successful restart: same job, operation, command identity, input identity, counts, and checkpoint; status `Pending`; attempt exactly 2.
- Green refusal: Running and NotRestartable states returned `APPLICATION_JOB_NOT_RESTARTABLE`; before/after job, checkpoint, and effect snapshots were identical.
- Green concurrency: two clients raced the same restart; exactly one committed, one received `APPLICATION_JOB_NOT_RESTARTABLE`, attempt incremented once, and checkpoint/effect totals remained unchanged.
- Application adapter focused build/test: 2/2 passed.
- Sequence-2 focused PostgreSQL test: 1/1 passed.
- Sequence-6 focused PostgreSQL tests: 2/2 passed.
- Complete exact-CI PostgreSQL suite: 299/299 passed with zero skips or failures.
- TypeScript lint and changed-file diagnostics: PASS.
- Dependency audit: zero vulnerabilities.
- `git diff --check`: PASS.

## Migration Identity

Sequence 2 SQL is `ad458453834e72413f644e81e38829ae491a26a44f1ca03deeaf71349552c198`; sequence 6 SQL is `aa5d6d22b3da20eed8792a3db15f6c0b15b6cbfa30ade07678a543f1f6e16879`. Resulting sequence-2-through-6 manifest hashes are recorded in the current PostgreSQL contract. Sequence 3 through 5 SQL bytes are unchanged; only their cumulative manifest roots changed.

## Review

Alternate-model Code review and final concurrency recheck returned PASS with no open findings. Alternate-model Security review returned PASS with no blockers and confirmed complete mediation, same-job checkpoint isolation, future-attempt exclusion, row-lock serialization, search-path safety, and stable refusal behavior. Its defense-in-depth observations assign an application UUID admission check and any future explicit runtime caller guard to PT-APP-001M.

This evidence closes only PT-APP-001D. Failed-job presentation remains PT-APP-001E, broader runtime admission remains PT-APP-001M, command replay remains PT-APP-001N, and PT-APP-001E..P remain open.
