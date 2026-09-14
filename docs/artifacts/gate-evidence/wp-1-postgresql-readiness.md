# WP-1 PostgreSQL Readiness Evidence

**Date:** 2026-09-11
**Scope:** PostgreSQL baseline-settings leaf of CT-DB-001K
**Result:** PASS

## Immutable Runtime

- Image: `postgres:16-alpine`
- Digest: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`
- Reported version: `16.15`
- Initialization: `--locale=C --encoding=UTF8`
- Timezone: `UTC`

## Observed Settings

The disposable container returned:

```text
16.15|UTF8|UTC|on|C
```

The fields are server version, server encoding, timezone, `standard_conforming_strings`, and database collation. The integration test connected through the pinned `pg@8.16.0` driver and returned `{ready:true}`. The complete run passed 20 tests with zero failures or skips, after which the disposable container was removed.

## Boundary

This evidence proves only the PostgreSQL baseline-settings leaf of CT-DB-001K. It does not prove migration identities/hashes, live catalog projection, role/grant closure, CT-DB-001A..J, or complete WP-1 exit. Architecture remains Proposed and no baseline, release, deployment, or production action is authorized.
