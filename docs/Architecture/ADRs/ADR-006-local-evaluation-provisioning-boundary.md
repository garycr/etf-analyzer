# ADR-006 - Local Evaluation Provisioning Boundary

**Status:** Accepted by DEC-103 after REV-221, REV-222, and REV-223 PASS
**Date:** 2026-09-28
**Decision owner:** Agent under Fully Agentic mode
**Accountable custodian:** Solo Orchestrator
**Related:** DEC-095; DEC-102; DEC-103; issue #97; ADR-002; ADR-003; ADR-004

## Context

The assigned rc.1 archive is deterministic but cannot be evaluated from a pristine operator environment without test-only database and artifact helpers. Ring 4 needs a supported preparation path without widening the accepted local, single-user, synthetic-only boundary.

The path requires temporary PostgreSQL administrator authority to create closed product roles, apply the eight canonical migrations, inject local anchor key material, verify readiness with real runtime identities, and write reviewed synthetic artifacts plus a closed launcher configuration. Administrator credentials and generated key material must not enter the release archive, generated configuration, logs, or command output.

## Decision

- Provide one precompiled operator command, `release:prepare-evaluation`, that accepts the administrator URL only through `ETF_POSTGRES_ADMIN_URL` and writes outside the immutable release package.
- Reject non-loopback PostgreSQL targets, databases not named `etf_analyzer`, malformed timestamps, and any database identity other than PostgreSQL 16.15, UTF8, UTC, standard conforming strings, and `C` collation before bootstrap mutation.
- Materialize and validate the reviewed fixture and analytics artifacts before database provisioning. Provisioning re-reads and verifies those artifacts before connecting.
- Apply the closed role bootstrap and canonical migrations in order. Grant deployment-only key injection after migration 3 so subsequent schema manifests bind that grant.
- Generate a fresh 256-bit random anchor key for each disposable evaluation database. The key remains database-confined and is never printed or written to operator files. This is evaluation-only integrity material, not a production key-management design and does not implement deferred ADR-002 restore controls.
- Authenticate readiness probes as the actual `audit_runtime` and `projection_runtime` login roles. PostgreSQL trust or peer authentication is permitted only when scoped to the local socket or loopback addresses; shared-network trust is prohibited.
- Compose the six readiness dependencies through the Application-owned `evaluateReadiness()` function. Persist `Ready` only after fixture/artifact verification and live PostgreSQL, migration, denial-audit, and ledger-integrity checks pass.
- Write `local-runtime.json` with mode `0600`, loopback origin and port, and no credentials. Launcher output containing the per-process token is sensitive for the process lifetime.
- Keep public ingress, remote databases, providers, brokerage, real orders, multi-user identity, durable handoff, staging, production, and destructive migration rollback out of scope.

## Consequences

A clean, correctly configured local environment can prepare the immutable candidate without importing test helpers. Preparation is intentionally one-shot against a pristine disposable database. Failure leaves evidence for diagnosis; operators must not rerun against partial state or reverse migrations.

The passwordless runtime-role probes require an explicit loopback-scoped PostgreSQL authentication policy. A standard password-only installation is rejected until the operator configures the reviewed local boundary. This trade-off avoids persisting generated role passwords while retaining actual login identity for denial-audit correlation.

There is no deployable fallback candidate while rc.1 lacks this preparation path. A failed rc.2 evaluation stops and remains stopped; it does not roll back in place.

## Alternatives

- Continue using test-only helpers: rejected because it is not an operator-supported deployment path.
- Assign static runtime passwords: rejected because it introduces credential generation, custody, and persistence beyond the current local prototype.
- Use session impersonation from the administrator connection: rejected because PostgreSQL backend identity would remain the administrator and the denial-audit probe correctly fails that condition.
- Reuse the public test fixture anchor key: rejected because shipped predictable key material could be mistaken for a tamper-resistance control.

## Invalidation

Revisit this decision if evaluation requires a remote or shared database, password-based runtime identities, durable key custody or rotation, multiple users, public ingress, providers, brokerage, staging, production, or rerunnable/in-place provisioning.

## Decision Boundary

This ADR governs only disposable local synthetic evaluation preparation. It does not authorize release, staging, production, public access, live data, brokerage, real orders, or durable handoff.
