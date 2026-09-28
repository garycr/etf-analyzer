# ETF Analyzer v0.1.0-rc.2 Local Evaluation Guide

**Status:** Procedure prepared; candidate identity remains unassigned until exact-commit CI artifact verification

**Boundary:** Single user, synthetic fixture only, PostgreSQL 16.15, and loopback access only. This procedure does not authorize staging, production, public ingress, live providers, brokerage, real orders, or durable handoff.

## 1. Verify Assigned Identity

Do not use this guide until `docs/Operations/promotion-log.md` records the assigned rc.2 source commit, CI run, artifact name, archive name, and SHA-256 digest. Download that exact CI artifact and do not rebuild or substitute it.

Verify Node before proceeding:

```bash
test "$(node --version)" = "v20.20.2"
```

Use the organization-approved npm version. Do not disable TLS, change registries, bypass endpoint policy, or invoke npm through a blocked execution context.

## 2. Verify and Extract the Archive

From a new operator-owned evaluation directory, verify both the promotion-log digest and the downloaded sidecar:

```bash
printf '%s  %s\n' '<RECORDED_SHA256>' '<ASSIGNED_ARCHIVE>.tar.gz' | sha256sum -c -
sha256sum -c '<ASSIGNED_ARCHIVE>.tar.gz.sha256'
mkdir -p extracted
tar -xzf '<ASSIGNED_ARCHIVE>.tar.gz' -C extracted
cd 'extracted/<ASSIGNED_PACKAGE_DIRECTORY>'
```

Inspect `release-manifest.json`. Its `candidate` must be `v0.1.0-rc.2`, its `sourceCommit` must match the promotion log, and every listed byte length and SHA-256 must match the extracted payload. Stop on any mismatch.

## 3. Install Production Dependencies

From the extracted package directory:

```bash
npm ci --omit=dev
```

Do not run a build. The archive already contains the exact reviewed `dist/` output. Preserve strict SSL and the approved registry configuration.

## 4. Create a Disposable Local Database

Use a pristine PostgreSQL 16.15 database named `etf_analyzer` with UTF8 encoding, UTC timezone, standard conforming strings, and `C` collation. Bind PostgreSQL only to a local socket or loopback addresses.

The generated runtime roles have no stored passwords. Their readiness probes must authenticate as real login roles, so `pg_hba.conf` may use `trust` or `peer` only for local sockets or exact loopback ranges (`127.0.0.1/32` and `::1/128`). Never permit trust authentication from a shared bridge, LAN, VPN, or public range.

A disposable loopback-only container is acceptable when the exact assigned PostgreSQL digest is recorded by the release evidence. Never publish its port on `0.0.0.0`.

Confirm the target is empty and contains no valuable data. Preparation is one-shot and forward-only.

## 5. Prepare the Evaluation

Choose an operator directory outside the extracted package:

```bash
export ETF_EVAL_ROOT="$HOME/etf-evaluation/v0.1.0-rc.2"
mkdir -p "$ETF_EVAL_ROOT/operator"
chmod 700 "$ETF_EVAL_ROOT/operator"
```

Provide the administrator URL only through the process environment. Avoid persisting it in shell history:

```bash
ETF_POSTGRES_ADMIN_URL='postgresql://postgres@127.0.0.1:5432/etf_analyzer' \
ETF_EVALUATION_APPLIED_AT='2026-09-28T00:00:00.000Z' \
npm run release:prepare-evaluation -- "$ETF_EVAL_ROOT/operator"
```

Omit `ETF_EVALUATION_APPLIED_AT` to use the current canonical timestamp. Successful preparation prints JSON containing generated paths and non-secret artifact identities. It does not print or persist the administrator URL or generated 256-bit anchor key.

Stop if preparation reports configuration, database identity, migration, schema-manifest, artifact, denial-audit, ledger-integrity, or readiness failure. Do not rerun against the partial database.

## 6. Launch the Candidate

Use separate catalog-control and least-privilege request identities. The request identity must be `app_runtime`:

```bash
ETF_POSTGRES_CONTROL_URL='postgresql://control-role@127.0.0.1:5432/etf_analyzer' \
ETF_POSTGRES_URL='postgresql://app_runtime@127.0.0.1:5432/etf_analyzer' \
npm run start:release -- "$ETF_EVAL_ROOT/operator/local-runtime.json"
```

Successful startup prints one token-bearing `http://127.0.0.1:43123/#...` URL. That console output is sensitive for the process lifetime: do not log, ticket, bookmark, screen-share, or persist it. Open the exact URL locally.

Stop if the listener binds anywhere other than `127.0.0.1`, readiness is not `Ready`, or any provider/broker/public-network behavior appears.

## 7. DEV and SMOKE Checks

Confirm:

1. Tokenless and incorrect-token requests fail closed.
2. Readiness reports all six dependencies `Ready`.
3. Reviewed synthetic fixture, watchlist, analytics, evidence, paper-order, portfolio, and ledger views behave as expected.
4. Invalid input and blocked operations return redacted recovery guidance.
5. Keyboard navigation, visible focus, and narrow-view layout remain usable.
6. Refresh and shutdown preserve the intended local behavior.
7. No live provider, brokerage, public ingress, real order, or durable handoff exists.

Record candidate, source commit, browser, PostgreSQL version, step, expected/actual result, and redacted diagnostic identity. Never record credentials, anchor keys, launch tokens, or restricted fixture contents.

## 8. Stop and Roll Back

Press `Ctrl+C`, confirm the process exits, and verify the loopback listener closes. Follow `rollback-plan.md` on any failure. Do not reverse migrations or reuse the partial database. Because rc.1 cannot provision a clean evaluation environment, the safe rollback state is stopped with no candidate running.
