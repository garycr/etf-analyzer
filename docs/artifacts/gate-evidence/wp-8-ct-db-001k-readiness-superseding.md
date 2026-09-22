# WP-8 CT-DB-001K Superseding Readiness Evidence

**Date:** 2026-09-21
**Decision:** DEC-070; DEC-071
**Reviews:** REV-165 Code PASS; REV-166 Security PASS; REV-167 Architecture PASS; REV-168 Capability PASS
**Scope:** CT-DB-001K only

## Proven Conditions

1. A clean database reaches migration sequence 7 with the exact current migration and schema-manifest state.
2. No `etf` function grants PUBLIC execution.
3. A real password-authenticated `audit_runtime` connection completes the rollback-only denial-audit capability probe through the dedicated boolean-only verifier.
4. A real password-authenticated `projection_runtime` connection verifies the protected ledger checkpoints in a read-only bounded transaction.
5. A deliberately mismatched portfolio commitment returns `LEDGER_INTEGRITY_FAILED`.
6. Denial audits, audit commitments, audit checkpoints, and portfolio checkpoints are byte-identical before and after the probes.
7. Fresh random integration credentials are not persisted or printed, and the temporary PostgreSQL container is removed.

## Isolated Validation

- Image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- PostgreSQL: `16.15|UTF8|UTC|on|C`.
- Build: PASS.
- Selected path: `CT-DB-001A an empty database reaches the exact candidate schema` in `tests/Integration/controlled-access-migration.test.mjs`.
- Selected path result: PASS; process exit 0.
- Embedded CT-DB-001K assertions: migration count 7; PUBLIC function EXECUTE count 0; denial-audit capability Ready; ledger-integrity capability Ready; deliberate mismatch fails with `LEDGER_INTEGRITY_FAILED`; protected state after equals protected state before.
- Cleanup: `CONTAINER_REMOVED=true`.

The selected test also proves the durable-handoff absence boundary in the same isolated transaction. This superseding checkpoint claims only the embedded CT-DB-001K readiness conditions listed above.

## Historical Custody

The earlier `wp-8-ct-db-001k-readiness.md` and REV-164 remain invalidated historical evidence. This artifact does not rewrite or rehabilitate either record. DEC-070 and REV-165..167 govern the remediated verifier architecture and implementation.

## Boundary

This evidence is the accepted superseding CT-DB-001K checkpoint under DEC-072 and REV-168. Integrated CT-DB-001A..J, PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, and production remain open or unauthorized.
