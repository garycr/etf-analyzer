# ETF Analyzer v0.1.0-rc.1 Rollback Plan

**Boundary:** Local candidate only; no staging or production rollback authority

## Triggers

Stop the candidate on failed checksum or manifest verification, startup attestation failure, unexpected public binding, readiness failure, authentication/control regression, corrupted evidence, or any Sev 1/2 finding.

## Procedure

1. Stop the local launcher with `SIGINT` or `SIGTERM` and confirm the HTTP listener closes.
2. Preserve logs, the candidate archive, its sidecar, configuration identity, and PostgreSQL readiness output for diagnosis. Do not preserve launch tokens.
3. Do not reverse or edit PostgreSQL migrations. The migration chain is forward-only; a failed migration transaction must leave earlier committed migrations unchanged.
4. If a previously verified candidate exists, verify its SHA-256 sidecar, extract it into a separate directory, run `npm ci --omit=dev`, and launch it with `npm run start:release -- /path/to/local-runtime.json` using the same operator-owned reviewed artifacts and database identities.
5. For this first candidate, if no previous verified artifact exists, remain stopped and return the work to DEV. Do not fabricate a fallback release.
6. Record the failed gate and rollback result in `docs/Operations/promotion-log.md` before another promotion attempt.

## Data Recovery

Automatic destructive database cleanup is prohibited. For bootstrap or migration failure, follow `docs/Operations/postgresql-bootstrap-recovery.md`. Backup restore, production recovery, and schema downgrade are outside this candidate boundary.

## Completion Criteria

Rollback is complete when the failed process is stopped, no unapproved listener remains, retained evidence is redacted, and either the prior verified local candidate reports Ready or the environment remains intentionally stopped.
