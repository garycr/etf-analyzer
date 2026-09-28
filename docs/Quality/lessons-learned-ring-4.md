# Ring 4 Lessons Learned

**Date:** 2026-09-28
**Decision:** DEC-103
**Status:** Active release-management record; TEST evidence complete; Ring 4 exit remains pending

## What Worked

- Commit-bound deterministic packaging and sidecar verification made the assigned artifact independently reproducible.
- A clean-environment preparation command closed the rc.1 operational gap without widening the loopback-only synthetic boundary.
- Artifact verification before database mutation, actual runtime-role probes, Application-owned readiness, and fresh per-launch key material provided clear fail-closed controls.
- Exact Node 20.20.2 and PostgreSQL 16.15 identities were verified without invoking npm inside Docker or weakening host security policy.
- The first smoke harness defect was corrected by matching the confirmation timestamp to the request timestamp required by the domain contract.

## What To Preserve

- Never rebuild or substitute the assigned archive between environments.
- Keep administrator credentials environment-only, generated key material database-confined, and launch tokens out of logs and durable evidence.
- Keep PostgreSQL trust authentication limited to local sockets or exact loopback ranges and publish no database port.
- Treat CI as authoritative for hosted browser/security evidence; local WSL browser limitations are not a reason to weaken controls.
- Keep issue #87 deferred unless evidence reliability or the agreed invalidation criteria change.

## Remaining Work

- Ring 4 remains active until a separately defined TEST disposition, synchronized checkpoint, and final release-management gate review are recorded.
- Staging and production remain outside this candidate boundary. DP-25 remains human-owned.
