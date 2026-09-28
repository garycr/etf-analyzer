# ETF Analyzer v0.1.0-rc.1 Release Notes

**Status:** Candidate packaging; not released or promoted
**Scope:** Local single-user, fixture-only research runtime

## Included

- Supported Node 20.20.2 composition root with separate PostgreSQL control and least-privilege runtime identities.
- Reviewed fixture and analytics artifact loading with fail-closed startup attestation.
- Accessible loopback browser workbench and 16 closed API routes.
- Per-launch fragment token, pre-body authentication, bounded request bodies and deadlines, zero-queue concurrency, and fixed-window rate controls.
- Exact dependency pins, Ubuntu 24.04 CI generation, digest-pinned PostgreSQL 16.15 and Playwright images, and SHA-pinned GitHub Actions.
- Eight PostgreSQL migrations, canonical readiness checks, deterministic replay, analytics evidence, hypothetical paper orders, and immutable ledger behavior.
- Generic zero-skip test enforcement, 80% per-business-file line coverage, and 80% aggregate branch coverage.

## Required Environment

- Node 20.20.2.
- PostgreSQL 16.15 with the canonical eight-migration ledger and reviewed role bootstrap.
- Operator-provided reviewed fixture and analytics artifacts.
- Loopback browser access on `127.0.0.1` only.

## Excluded

No public ingress, multi-user identity, live providers, brokerage, real orders, durable handoff, SQL Server migration, Kubernetes deployment, staging, production, or production operations are included or authorized.

## Verification

Verify the archive with its `.sha256` sidecar before extraction. Compare every extracted payload entry with `release-manifest.json`, run `npm ci --omit=dev` to install production dependencies from the exact lockfile, and launch the precompiled runtime with `npm run start:release -- /path/to/local-runtime.json` as described in `README.md`.

The repository-side `deployment-guide.md` records the exact assigned CI artifact identity and the complete local DEV evaluation procedure. It is operator guidance published after candidate assignment and is not part of the immutable candidate archive.
