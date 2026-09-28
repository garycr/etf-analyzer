# Promotion Log

> Append-only audit trail for release-candidate promotion. A passing build is not production authorization.

## 2026-09-25 - Ring 4 Activation

- **Decision:** DEC-095
- **Tracking:** GitHub #97
- **Candidate:** Not yet assigned
- **Path:** Ring 4 planning; no environment promotion executed
- **Gate results:** Ring 3 entry evidence accepted; DEV/SMOKE/TEST pending
- **Rollback:** Not applicable until an immutable candidate exists
- **Boundary:** Local single-user loopback candidate only; no staging or production authority

## 2026-09-27 - Immutable Candidate Assignment

- **Decision:** DEC-102
- **Tracking:** GitHub #97
- **Candidate:** `v0.1.0-rc.1`
- **Source commit:** `a0dcf3ba5fba94a7c4cc1a6658f0863b0c19ed98`
- **CI run:** `36363283790`; all four jobs passed
- **Artifact:** `etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba94a7c4cc1a6658f0863b0c19ed98`
- **Archive:** `etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba.tar.gz`
- **SHA-256:** `68be9f33e788311c856961ce2a0bbe5726a39e4be0a87475b9d027ccd9b187a2`
- **Verification:** Downloaded CI artifact passed checksum sidecar, extraction, manifest identity, completeness, and every payload hash
- **Path:** Candidate assignment only; no DEV, SMOKE, TEST, staging, production, or deployment promotion executed
- **Rollback:** Preserve the immutable archive and stop before environment entry; use the candidate rollback plan after an actual local promotion
- **Boundary:** Local single-user loopback candidate only; no staging or production authority

## 2026-09-28 - Deployable Candidate Assignment

- **Decision:** DEC-103
- **Tracking:** GitHub #97
- **Candidate:** `v0.1.0-rc.2`
- **Source commit:** `1e7605f72722b6f59e63e5a168548b1aac69415e`
- **CI run:** `36442957057`; browser-accessibility, build-and-test, security-audit, and codeql passed
- **Artifact:** `etf-analyzer-v0.1.0-rc.2-1e7605f72722b6f59e63e5a168548b1aac69415e`
- **Archive:** `etf-analyzer-v0.1.0-rc.2-1e7605f72722.tar.gz`
- **Package directory:** `etf-analyzer-v0.1.0-rc.2-1e7605f72722`
- **SHA-256:** `a5895c5fa378b362c84104c914be738a4d053ccc44a9913bf93c3bea9061a846`
- **Verification:** Downloaded CI artifact passed sidecar checksum, archive path-safety, extraction, exact manifest candidate/source identity, required-payload completeness, and all 82 payload byte-length and SHA-256 checks
- **Path:** Candidate assignment only; DEV and SMOKE evaluation pending; no TEST, staging, production, or deployment promotion executed
- **Rollback:** Stop with no candidate running; rc.1 is not a deployable fallback for clean-environment evaluation
- **Boundary:** Disposable local single-user synthetic loopback evaluation only; no remote database, public ingress, live provider, brokerage, real order, or durable handoff authority

## 2026-09-28 - DEV and SMOKE Promotion

- **Decision:** DEC-103
- **Tracking:** GitHub #97
- **Candidate:** `v0.1.0-rc.2`
- **Source commit:** `1e7605f72722b6f59e63e5a168548b1aac69415e`
- **CI run:** `36442957057`; all four jobs passed
- **Archive SHA-256:** `a5895c5fa378b362c84104c914be738a4d053ccc44a9913bf93c3bea9061a846`
- **Environment:** Exact Node 20.20.2; host-approved npm 11.19.0 with HTTPS registry and strict SSL; PostgreSQL 16.15 at digest `sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`
- **DEV:** PASS; clean one-shot preparation produced eight canonical migrations, protected reviewed artifacts/configuration, actual runtime-role probes, and Ready/Live readiness with all six dependencies Ready
- **SMOKE:** PASS; auth denial, readiness, watchlist, fixture ingestion, analytics publication/readback, job/evidence reads, paper-order draft and confirmed OT-02 submission, malformed-input redaction, empty-portfolio recovery, loopback binding, and graceful shutdown behaved as expected
- **Postconditions:** One fixture package, one evidence bundle/publication, two completed jobs, one submitted paper order, two order transitions, zero unresolved intents; no portfolio/projection was created because OT-02 has no ledger effect
- **Cleanup:** Launcher exited with empty stderr; disposable container, volume, socket, listener, extracted archive, dependency tree, and temporary Node runtime were removed
- **Path:** DEV and SMOKE complete; TEST, staging, production, and deployment release remain unexecuted and unauthorized
- **Boundary:** Local single-user synthetic loopback evaluation only; no remote database, public ingress, live provider, brokerage, real order, or durable handoff authority

## 2026-09-28 - TEST Evidence Disposition

- **Decision:** DEC-103
- **Tracking:** GitHub #97
- **Candidate:** `v0.1.0-rc.2`
- **Source commit:** `1e7605f72722b6f59e63e5a168548b1aac69415e`
- **CI run:** `36442957057`; build-and-test, browser-accessibility, security-audit, and CodeQL passed
- **Evidence:** Exact Node 20.20.2 build, complete zero-skip tests, PostgreSQL parent suite, coverage gate, browser accessibility, security evidence, and CodeQL passed for the assigned candidate commit
- **Disposition:** TEST evidence PASS by authoritative CI; no separate TEST environment was created or promoted
- **Path:** Ring 4 TEST evidence complete; final Ring 4 exit review remains; no staging, production, or deployment release promotion executed
- **Boundary:** Local single-user synthetic loopback candidate only; no remote database, public ingress, live provider, brokerage, real order, or durable handoff authority
