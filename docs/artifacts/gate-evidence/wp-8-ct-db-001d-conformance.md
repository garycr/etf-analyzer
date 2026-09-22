# WP-8 CT-DB-001D Conformance Evidence

**Date:** 2026-09-22
**Decision:** DEC-069; DEC-070; DEC-074
**Status:** Accepted under REV-170 and REV-171
**Scope:** CT-DB-001D only

## Least Privilege

The canonical `CT-DB-001D roles and controlled operations enforce least privilege` scenario verifies the exact 15-role and 11-membership graph, closed database and schema ACLs, no PUBLIC controlled-function execution, and unchanged protected state after six denied attacks. Each attack returns SQLSTATE `42501`.

The sequence-7 verifier remains `SECURITY DEFINER` with `search_path=pg_catalog`, exposes only a boolean, grants execution only to `audit_writer_owner`, and leaves `audit_activity_verifier_owner` with neither schema `USAGE` nor `CREATE`. `audit_writer_owner` cannot inherit or set `pg_read_all_stats`.

## Denial Binding And Replay

The live binding matrix rejects a vanished backend, reused PID with a different start, mismatched start, missing nonce, mismatched application nonce, and forced denial insert failure with `55000 ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED` and no protected-state mutation. A live matching backend commits exactly one denial, commitment, and checkpoint.

Denial replay uses the exact eight-field deduplication key. A typed JSON lock tuple uses epoch milliseconds for timezone-invariant `backendStart` identity. Equivalent replay returns the original stored audit identity, evidence hash, and sequence without mutation. Two concurrent equivalent requests from sessions using different timezones serialize to one row. Conflicting content under the same key fails with `55000` and no mutation.

## Controlled Readers

The reader evidence is intentionally distributed across the owning suites:

| Reader | Evidence |
|---|---|
| `evidence_read` | `WP-5 composes canonical analytics through authorized PostgreSQL commit and read` commits and reads canonical evidence through the application service and runtime role. |
| `job_get` | `0006 closes immutable, read, and runtime authority surfaces` reads the exact checkpoint and rejects direct base-table access and unauthorized roles. |
| `paper_order_get` | The same sequence-6 scenario reads the exact transition history under `app_runtime`. |
| `portfolio_get` | The same sequence-6 scenario selects the correct as-of projection and exact financial strings under `app_runtime`. |

## Validation

- Image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Environment: `16.15|UTF8|UTC|on|C`.
- Final live A+D aggregate: 20/20 PASS, zero failed, zero skipped.
- Sequence-7 unit contract: 3/3 PASS, zero failed, zero skipped.
- Lint and `git diff --check`: PASS.
- Temporary containers: removed and absence verified.
- Sequence 7 SQL hash: `0d07358c3056885e15ba190681402a381ed71485beb35e3b9088cc8d107b1340`.
- Sequence 7 cumulative manifest hash: `915d698edc5d95ef648d38d754ed5754dc46fffa8a9d6272304eaf58cf274c2e`.
- Sequences 1 through 6: unchanged.
- Independent Code Review: REV-170 PASS after all findings were remediated.
- Independent Security Review: REV-171 PASS with no blocking findings.

## Boundary

This evidence accepts CT-DB-001D only. CT-DB-001E-J, PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, and production remain open or unauthorized. CT-DB-001K remains separately accepted under DEC-072/REV-168. REV-164 and the original CT-DB-001K evidence remain invalidated history.
