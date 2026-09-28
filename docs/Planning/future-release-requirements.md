# Future Release Requirements

**Recorded:** 2026-09-28
**Scope:** Post-rc.2 local POC iteration
**Status:** Deferred; does not modify or extend immutable `v0.1.0-rc.2`

## Local POC Deployment

- Keep the deployment local on Linux/WSL.
- Use the immutable release archive only; do not rebuild at deployment time.
- Govern the runtime with exact Node `20.20.2` and PostgreSQL `16.15`.
- Permit manual process management; auto-start, restart policy, durable logs, formal uptime, backup/restore, and rollback automation are out of scope for the POC.
- Retain local database data, with explicit acceptance that no backup/restore capability is provided.
- Bind to loopback only. Do not add public ingress, brokerage, real orders, or multi-user access.
- Keep a minimal startup/readiness check even though formal smoke, recovery, and uptime gates are not required.

## Manual Price Import

- Use CSV as the manual daily-price upload format.
- Replace only `market-observations.jsonl`; retain reviewed economic vintages.
- Validate UTF-8 CSV, exact headers, canonical dates/timestamps, ten-decimal prices, supported adjustment policy, revisions, duplicates, and required identities.
- Preserve existing raw sources and add the uploaded CSV as a new hashed raw-source record.
- Recompute market-file, manifest, coverage, and dataset hashes, then run complete fixture validation before database mutation.
- Provider automation and provider credentials are deferred; public market data may be considered later only after rights, reliability, and schema decisions.

## Future Raw-Data Correction Workflow

- Never overwrite the original raw source.
- Version corrected source material with correction reason, operator identity, timestamp, and source lineage.
- Recompute affected fixture and manifest identities.
- Revalidate before mutation and link corrected data to the original raw-source identity.
- Define replay, retraction, and derived-analytics invalidation behavior before production-like use.
