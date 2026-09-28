# ETF Analyzer v0.1.0-rc.2 Rollback Plan

**Boundary:** Local synthetic evaluation candidate only; no staging or production rollback authority

## Triggers

Stop on failed checksum or manifest verification, rejected PostgreSQL identity, bootstrap or migration failure, schema-manifest mismatch, artifact validation failure, startup attestation failure, unexpected public binding, readiness failure, authentication regression, corrupted evidence, or any Sev 1/2 finding.

## Procedure

1. Stop the local launcher with `SIGINT` or `SIGTERM` and confirm the loopback listener closes.
2. Preserve redacted logs, archive and sidecar identity, generated configuration identity, and PostgreSQL readiness output. Never preserve launch tokens or database credentials.
3. Do not reverse or edit migrations. The canonical chain is forward-only.
4. Do not rerun the preparation command against a partially provisioned database. Preserve the failed disposable database for diagnosis or discard the entire operator-owned container after evidence capture.
5. `rc.1` is not a deployable fallback because it lacks the operator preparation path. The accepted rollback state is stopped with no candidate running; any later candidate requires a separately provisioned pristine database and a new audited promotion.
6. Record the failed gate and rollback result in `docs/Operations/promotion-log.md` before another promotion attempt.

## Completion Criteria

Rollback is complete when the failed process is stopped, no unapproved listener remains, retained evidence is redacted, and the evaluation environment is intentionally stopped with no fallback candidate implied. Automatic destructive database cleanup is prohibited.
