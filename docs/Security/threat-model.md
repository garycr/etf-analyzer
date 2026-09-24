# WP-8 Implemented-Boundary Threat Model

**Last Updated:** 2026-09-23
**Review State:** Ring 2 security hardening complete; DEC-088 re-review and DP-33 Security Review PASS; final Plaid action blocked; Ring 3 not authorized
**Scope:** Single-user browser workbench, loopback HTTP adapter, synchronous Application owners, and greenfield PostgreSQL 16.15

This model covers only the implemented WP-8 candidate. Public ingress, provider egress, Kubernetes, workers, brokers, outbox/queue handoff, deployment, release, and production are absent and are not authorized by this document.

## Trust Boundaries

> Identify where trust levels change in the system. Every data flow that crosses a trust boundary is a potential attack surface.

| ID | Boundary | From Zone | To Zone | Data Flows | Controls |
|----|----------|-----------|---------|------------|----------|
| TB-001 | Browser to loopback API | Same-host process | Local API process | Reviewed HTTP requests and JSON responses | Literal `127.0.0.1` bind/Host checks, closed Origin list, 16-route allowlist, body/deadline bounds, fixed errors |
| TB-002 | HTTP adapter to Application | Transport data | Typed operation envelope | Identities, operation, path/query/body payload | Exact envelope reconstruction, command idempotency, closed operation parser, malformed-input rejection |
| TB-003 | Application to PostgreSQL | Application runtime | Separately owned database objects | Controlled function calls and replay records | `NOINHERIT` login roles, `NOLOGIN` owners, revoked PUBLIC grants, fixed `SECURITY DEFINER` search paths |
| TB-004 | Migration provisioner to candidate schema | External database owner | Empty `etf` schema | Seven greenfield migrations | Exact migration ledger and manifests, advisory lock, transactional rollback, readiness fail-closed |
| TB-005 | Repository/CI to evidence | Mutable source and runner | Gate records | Tests, policies, scanner results | Digest-pinned service images/actions, full-history secret scan, pinned CodeQL, and commit/run/job-bound raw evidence with verified byte counts and SHA-256 hashes |

## Threat Actors

| Actor | Motivation | Capability | Target |
|-------|-----------|------------|--------|
| Same-user local process | Forge local requests, exhaust service, read local responses | Can connect to loopback and forge Host/Origin | Loopback HTTP adapter |
| Malformed fixture/request author | Corrupt state or disclose diagnostics | Controls bounded request or fixture bytes | Parsers, owners, PostgreSQL functions |
| Compromised dependency or CI step | Tamper with build or evidence | Executes in developer/CI context | Source, lockfile, test output, evidence |
| Over-privileged database session | Read or mutate protected state | Holds one configured PostgreSQL login | Owner functions, audit, anchors, evidence |
| Repository contributor | Suppress or falsify gate evidence | Can alter source and documentation | Tests, policies, evidence records |

## STRIDE Analysis

### Spoofing

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| Loopback API | Same-user process forges admitted Host/Origin | M | M | Loopback-only bind and closed routes reduce exposure; per-launch authorization token required before boundary widening | Accepted for local prototype; owner: Solo Orchestrator; review: DP-33 |
| PostgreSQL runtime | Session claims another owner capability | L | H | Exact login-role checks, `NOINHERIT`, controlled functions, denial audit | Mitigated |

### Tampering

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| Migration/evidence ledger | Source or database state diverges from accepted hashes | M | H | Seven-row hashes/manifests, readiness projection, replay/drift tests | Mitigated; DEC-088 accepted under REV-194/195 |
| Gate evidence | Contributor edits summarized results without raw provenance | M | H | Run 35902418187 artifact binds raw streams to commit/run/job identity with verified byte counts and SHA-256 hashes | Mitigated; DP-33 reviewer confirmation pending |

### Repudiation

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| Application commands | Caller denies a submitted command | L | M | Request/correlation/command identities and immutable replay/audit records | Mitigated |
| CI/gate execution | Result cannot be tied to exact commit/tool run | M | H | Run 35902418187 and its downloaded artifact match commit `8c362813f1ae3e7857971cba66c6c739d9daa20a`, repository, workflow, job, ref, run, attempt, and raw stream hashes | Mitigated; DP-33 reviewer confirmation pending |

### Information Disclosure

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| HTTP/readiness diagnostics | Exceptions disclose URL, SQL, credentials, or payloads | M | H | Fixed public errors, structured redaction, adversarial redaction tests | Mitigated |
| PostgreSQL protected state | Runtime role reads tables, keys, anchors, or unrelated evidence | L | H | No direct DML/read grants, separate owners, controlled readers, denial tests | Mitigated |

### Denial of Service

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| Loopback API | Oversized, slow, or concurrent same-user requests exhaust process | M | M | Body limit and bounded request/header/socket deadline | Partially mitigated; concurrency/rate limit deferred until boundary widening |
| PostgreSQL | Long statements or lock contention consume capacity | L | M | Transaction-local statement/lock timeouts, advisory migration lock, bounded tests | Mitigated for prototype |

### Elevation of Privilege

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| Controlled functions | `SECURITY DEFINER` body or `search_path` reaches attacker object | L | H | Fixed qualified bodies, pinned `pg_catalog` search paths, no dynamic SQL, catalog tests | Mitigated |
| Database login | Runtime inherits owner/admin authority | L | H | `NOINHERIT` login roles, `NOLOGIN` owners, exact memberships and grants | Mitigated |
| Build scripts | Dynamic code or child process bypass executes unreviewed tools | M | H | TypeScript AST banned-function guardrail plus commit-pinned CodeQL JavaScript/TypeScript analysis | Mitigated for the implemented boundary; CodeQL passed with no alerts in run 35902418187 |

## Risk Summary

| STRIDE Category | Threats Identified | Mitigated | Open | Accepted |
|----------------|-------------------|-----------|------|----------|
| Spoofing | 2 | 1 | 0 | 1 |
| Tampering | 2 | 2 | 0 | 0 |
| Repudiation | 2 | 2 | 0 | 0 |
| Information Disclosure | 2 | 2 | 0 | 0 |
| Denial of Service | 2 | 1 | 0 | 1 |
| Elevation of Privilege | 3 | 3 | 0 | 0 |

No open technical threat-model risk remains for the implemented boundary. Accepted local-only risks become open immediately if ingress, identity, deployment, provider, or multi-user boundaries widen. DEC-088 re-review passed under REV-194/195; DP-33 confirmation remains a governance requirement rather than a mitigation inferred by this document.
