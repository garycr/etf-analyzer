# ETF Analyzer v0.1.0-rc.2 DEV and SMOKE Evidence

**Date:** 2026-09-28
**Decision:** DEC-103
**Disposition:** PASS for bounded local DEV and SMOKE; TEST pending

## Immutable Identity

- Source commit: `1e7605f72722b6f59e63e5a168548b1aac69415e`
- CI run: `36442957057`
- Artifact: `etf-analyzer-v0.1.0-rc.2-1e7605f72722b6f59e63e5a168548b1aac69415e`
- Archive: `etf-analyzer-v0.1.0-rc.2-1e7605f72722.tar.gz`
- SHA-256: `a5895c5fa378b362c84104c914be738a4d053ccc44a9913bf93c3bea9061a846`
- Manifest: candidate and source identity matched; all 82 listed payload byte lengths and SHA-256 hashes passed; no unlisted regular payload file

## Environment

- Node: exact `v20.20.2`, extracted from image digest `sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5`
- npm: host-approved `11.19.0`; registry `https://registry.npmjs.org/`; strict SSL enabled; npm was never invoked inside Docker
- PostgreSQL: `16.15|UTF8|UTC|on|C` at image digest `sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`
- Network: PostgreSQL `listen_addresses=''`, no published container port, application bound only to `127.0.0.1:43123`
- Authentication: local Unix-socket trust only; host TCP configured for SCRAM and not listening; administrator secret file and launch token were never logged

## Results

| Check | Result |
| --- | --- |
| Exact-commit CI: browser-accessibility, build-and-test, security-audit, CodeQL | PASS |
| Downloaded archive sidecar, path safety, extraction, completeness, and manifest hashes | PASS |
| Clean one-shot preparation and mode-0600 runtime configuration | PASS |
| Eight canonical migrations and actual runtime-role login probes | PASS |
| Ready/Live readiness; PostgreSQL, Migrations, FixturePolicy, LocalDependency, DenialAudit, LedgerIntegrity all Ready | PASS |
| Tokenless and incorrect-token requests | PASS: `401` |
| Readiness and watchlist | PASS: `200` |
| Fixture ingestion and two completed jobs | PASS: `201`; readback `200` |
| Analytics publication, result, and evidence readback | PASS: `201`; readback `200` |
| Paper-order draft and same-user confirmed OT-02 submission | PASS: `201`, `200`; submitted readback `200` |
| Malformed JSON | PASS: redacted `400`; no token, credential, connection string, or key material |
| Empty portfolio query | PASS: bounded `APPLICATION_DEPENDENCY_UNAVAILABLE` recovery; no fabricated portfolio or ledger state |
| Graceful stop and disposable resource cleanup | PASS |

Final aggregate postconditions were one fixture package, one analytics evidence bundle, one analytics publication, two jobs, one paper order, two order transitions, one readiness row, and zero unresolved intents. No portfolio or projection was created because OT-02 submits the paper order without a ledger effect.

An initial smoke attempt used a confirmation timestamp that did not match the request timestamp and was correctly rejected. The clean rerun used the reviewed contract, passed, and did not require a candidate change or security-policy exception.

## Boundary

This evidence authorizes only the completed disposable local DEV and SMOKE stages. It does not authorize TEST, staging, production, remote databases, public ingress, live providers, brokerage, real orders, durable handoff, or reuse of the destroyed evaluation environment.
