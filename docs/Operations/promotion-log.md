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
- **Archive:** `etf-analyzer-v0.1.0-rc.1.tar.gz`
- **SHA-256:** `df546f0206a4e70281b9a459bd5c1c9338ede2c193987a4851709116823cc254`
- **Verification:** Downloaded CI artifact passed checksum sidecar, extraction, manifest identity, completeness, and every payload hash
- **Path:** Candidate assignment only; no DEV, SMOKE, TEST, staging, production, or deployment promotion executed
- **Rollback:** Preserve the immutable archive and stop before environment entry; use the candidate rollback plan after an actual local promotion
- **Boundary:** Local single-user loopback candidate only; no staging or production authority
