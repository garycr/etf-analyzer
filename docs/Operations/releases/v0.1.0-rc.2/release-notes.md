# ETF Analyzer v0.1.0-rc.2 Release Notes

**Status:** Candidate packaging; not assigned or promoted
**Scope:** Local single-user, synthetic-fixture-only research runtime

## Change From rc.1

`rc.1` proved deterministic packaging but could not enter DEV from a clean operator environment because database provisioning and reviewed synthetic artifact materialization were available only through integration-test helpers.

`rc.2` adds `npm run release:prepare-evaluation -- /absolute/evaluation/path`. The command:

- rejects non-loopback PostgreSQL targets, databases not named `etf_analyzer`, malformed timestamps, and non-16.15 database identities before bootstrap mutation;
- applies the reviewed closed role bootstrap and canonical eight migrations to a pristine local database;
- generates a fresh database-confined 256-bit evaluation anchor key;
- verifies the PostgreSQL baseline, migration ledger, schema manifest, reviewed artifacts, live denial-audit capability, and live ledger integrity;
- composes and appends the six-dependency readiness snapshot through the Application readiness owner;
- writes the exact validated fixture package, analytics artifact, and closed runtime configuration outside the immutable package.

The administrator URL is accepted only through `ETF_POSTGRES_ADMIN_URL` and is never written to generated files or command output.

## Required Environment

- Node 20.20.2.
- A pristine loopback PostgreSQL 16.15 database named `etf_analyzer`, with `C` collation, UTF8 encoding, UTC timezone, standard conforming strings enabled, and local operator-controlled authentication. Runtime-role `trust` or `peer` authentication must be restricted to a local socket or exact loopback ranges; shared-network trust is prohibited.
- Loopback browser access on `127.0.0.1` only.

## Evaluation Sequence

1. Verify the archive sidecar and embedded release manifest.
2. Run `npm ci --omit=dev` without rebuilding.
3. Set `ETF_POSTGRES_ADMIN_URL` to the pristine local database and optionally set canonical `ETF_EVALUATION_APPLIED_AT`.
4. Run `npm run release:prepare-evaluation -- /absolute/evaluation/path` once.
5. Launch with `ETF_POSTGRES_CONTROL_URL`, least-privilege `ETF_POSTGRES_URL`, and the generated `local-runtime.json`.

Follow `deployment-guide.md` for exact commands, verification, sensitive-output handling, and stop conditions. Local packaging refuses a dirty worktree; only the exact pushed-commit CI artifact can be assigned or promoted.

## Excluded

No public ingress, remote database, multi-user identity, live provider, brokerage, real order, durable handoff, SQL Server migration, Kubernetes deployment, staging, production, schema downgrade, or destructive cleanup is included or authorized.
