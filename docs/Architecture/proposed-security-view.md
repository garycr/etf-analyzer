# Proposed Security View

## Status

Status: Ledger-security design accepted at DP-33; remaining content Proposed; research-only/no-broker; not an accepted ADR

## Purpose

This view consolidates security boundaries and controls for the local prototype. It supplements, rather than repeats, the detailed [deployment](proposed-deployment-view.md), [component](proposed-component-view.md), and [ingestion](proposed-ingestion-sequence.md) views.

## Trust-boundary diagram

```mermaid
flowchart LR
    User[Local research operator]

    subgraph HostBoundary[Trusted local workstation]
        Browser[Browser\nno provider credentials]
        subgraph ClusterBoundary[WSL Ubuntu - kind Kubernetes]
            Ingress[Localhost-only ingress]
            App[API and local services]
            Adapter[Scoped provider adapter workload]
            Rights[Provider rights control\nApproved only]
            subgraph RestrictedBoundary[Restricted secrets and data boundary]
                Secrets[Kubernetes Secrets\nprovider keys scoped to adapters\ndeployment-only HMAC key injection]
                KeyInject[Deployment key-injection job\none-time key procedure]
                Store[(Application PostgreSQL schemas\nraw, normalized, ledger, evidence, audit)]
                AnchorSigner[Integrity anchor procedure\nanchor-owner SECURITY DEFINER]
                AnchorStore[(Protected anchor schema\ncommitment chain + latest accepted anchor)]
            end
            Redactor[Redaction boundary\nallowlisted diagnostics only]
            Egress[Default-deny egress policy\nfail closed]
        end
    end

    subgraph ExternalBoundary[External provider network]
        Provider[Approved provider endpoint]
    end
    Export[User-owned export or diagnostic bundle]

    User --> Browser
    Browser -->|localhost REST/OpenAPI| Ingress
    Ingress --> App
    App --> Store
    App -->|controlled ledger procedure; no key access| Store
    Store -->|same transaction; canonical commitment| AnchorSigner
    Secrets -->|versioned key mounted only here| KeyInject
    KeyInject -->|one-time protected injection| AnchorStore
    AnchorSigner --> AnchorStore
    Rights -->|current approval and allowlist| Adapter
    Secrets -->|mounted only here| Adapter
    Adapter --> Egress
    Egress -->|allowlisted HTTPS| Provider
    Store --> Redactor
    App --> Redactor
    Redactor -->|redacted metadata, hashes, correlation IDs| Export
```

## Accessible prose alternative

Trust decreases across four boundaries rendered in the diagram: the trusted local workstation and browser; the WSL/kind cluster; the nested restricted secrets/data boundary; and the external provider network. The browser reaches only localhost ingress. Provider credentials never enter browser requests, OpenAPI payloads, evidence bundles, exports, or support diagnostics. Adapter pods receive only the secrets and egress destinations needed for an Approved provider. Brokerage, unapproved-provider, and public-client destinations have no permitted relationship and are denied by default.

## Security controls

| Control area | Proposed requirement | Failure behavior |
| --- | --- | --- |
| Ingress | Bind to localhost only; no public load balancer, externally routable service, or remote-user path. | Non-local ingress is denied and is not readiness-eligible. |
| Provider rights gate | Record intended use, provider, terms URL/date, permissions, quota, status, revalidation, and user choice. Organizational free ingestion remains disabled until rights are confirmed. | Missing, expired, Pending, or Rejected evidence disables the adapter. Assessment is not approval and this control is not legal advice. |
| Egress | Default-deny pod egress; allow only current Approved provider endpoints, required DNS, PostgreSQL, local telemetry, and required local services. | Missing rights or allowlist configuration fails closed. Broker and unapproved endpoints are always denied. |
| Secret lifecycle | Credentials exist only as local, scoped Kubernetes Secrets; mount/inject only into the matching adapter workload. Define local creation, rotation, revocation, and deletion evidence in Ring 1. | Secrets are excluded from Git, images, ConfigMaps, logs, traces, diagnostics, exports, and client bundles; leak tests block readiness/release. |
| Credential transmission | No brokerage credentials exist. Provider credentials are consumed server-side by the scoped adapter and are never transmitted by the user/browser or persisted in job/evidence payloads. | Any credential-bearing API, event, log, or export is a blocking defect. |
| Data boundaries | Raw provider payloads and local financial research records remain in restricted PostgreSQL schemas/storage; normalized data, immutable evidence, audit, and diagnostics have separate least-privilege access paths. | Cross-boundary reads are denied unless explicitly required and audited. |
| Redaction | Structured allowlists permit correlation IDs, status, counts, timestamps, provider identifier, rule/config hashes, and sanitized error classes. | API keys, passwords, prohibited raw provider data, free-form payload fragments, and brokerage artifacts are removed; export fails if redaction cannot be proven. |
| Fixture semantics | Fixtures require an explicit bootstrap, test, or offline mode and retain dataset/version/hash provenance. | A live outage never selects a fixture. Retry exhaustion fails the job visibly and dependent research stays blocked. |
| Integrity | Unique/check constraints protect ingestion identity; immutable evidence is hash-verified; ledger corrections are reversing transactions; reconciliation uses exact canonical equality after DEC-014 quantization with no epsilon. | Integrity or reconciliation failure blocks publication and produces redacted evidence. |
| Ledger database authority | Separate `NOLOGIN` `schema_owner`, `ledger_writer_owner`, `projection_owner`, `migration_owner`, `audit_writer_owner`, and `anchor_owner`; runtime logins use `NOINHERIT`; `PUBLIC` is revoked. Runtime receives approved reads and controlled-procedure execution only. | Direct DML, sequence access, `COPY`, `TRUNCATE`, trigger/DDL/ownership changes, role administration, or migration elevation is denied and audited. |
| Controlled procedures | Ledger, projection, and audit `SECURITY DEFINER` procedures have distinct non-login owners, fixed trusted `search_path`, fully qualified objects, validation before cast/DML, and no caller-derived dynamic SQL. The projection procedure invokes audit only for its two outcomes; the anchor procedure grants `EXECUTE` only to ledger/audit function owners. | Direct runtime audit/anchor invocation, caller/outcome mismatch, unknown caller, invalid context, unclassified input, or privilege mismatch fails before persistence. |
| Ledger integrity anchor | The deployment identity injects versioned key material into an anchor-owner-only PostgreSQL store. The controlled ledger procedure invokes the anchor-owner procedure inside the same transaction but cannot read keys or protected anchors. Accepted commitments/checkpoints are append-only and independently owned. | Unknown/retired key, bad HMAC, chain break, missing anchor, replacement attempt, or rollback mismatch returns `LEDGER_INTEGRITY_FAILED` and rolls back or blocks publication. |

## Threats and mitigations

| Threat | Mitigation and validation |
| --- | --- |
| Accidental public exposure | Localhost bind and Kubernetes service/ingress tests; no public load-balancer manifest. |
| Unauthorized or out-of-terms provider use | Code-path rights check plus network allowlist; status defaults to Pending; revalidate before operational use. |
| Secret or raw-data leakage | Scoped Secrets, least privilege, structured-field allowlists, negative export/log/trace tests, and restricted raw schemas. |
| Silent dataset substitution | Explicit fixture mode and dataset identity; outage-to-failed-job integration test. |
| False research output from corrupt data | DQ quarantine and fail-closed analytics publication gate. |
| Ledger tampering or hidden correction | Append-only transactions, reversing entries, audit correlation, FIFO rebuild, and exact reconciliation vectors. |
| Coherent ledger/cache replacement or backup rollback | Transaction/effect, allocation, and audit digests feed a sequence-ordered HMAC commitment chain; the latest accepted checkpoint is separately owned and compared before publication and after restore. |
| Supply-chain or image leakage | Ring 1 dependency/license/vulnerability review, image/config scan, and secret-pattern checks before local release. |

## Provider and data boundary rules

The assessed market set is yfinance/Yahoo, Alpha Vantage, Tiingo, Alpaca IEX, EODHD, and Stooq; the assessed official economic families are FRED/ALFRED, BLS, BEA, and Treasury Fiscal Data. This view grants none of them Approved status. Ring 1 must record Approved, Pending, or Rejected for every source and enable only Approved integrations. Point-in-time market/economic data, immutable evidence, user-owned exports, and diagnostics remain distinct data classes with explicit retention/access rules; exact retention is unresolved.

## Ledger key and authority lifecycle

- Key generation occurs outside application workloads through the local deployment secret workflow. A deployment-only job injects the versioned key into an anchor-owner-only PostgreSQL store and removes the mounted Kubernetes Secret after successful injection. The key is never readable by API, portfolio, ledger-writer, projection-writer, audit, diagnostics, or backup logs.
- The anchor procedure resolves an explicit key identifier and uses key bytes only inside PostgreSQL procedure execution. Rotation introduces a new active key while retaining prior verification keys for existing commitments. Retirement is allowed only after backup and restore verification proves every retained commitment remains verifiable.
- Unknown, disabled, or retired key identifiers fail closed. Rotation-in-progress records both predecessor and successor key identifiers in append-only rotation evidence so recovery can resume deterministically.
- The anchor owner can append but not update/delete accepted anchors. Anchor replacement authority is unavailable to ledger and projection writers; emergency recovery requires the deployment identity plus explicit local operator action and produces immutable audit evidence.
- Before business processing, the audit collector commits `IntentRecorded` under `audit_runtime`. The controlled ledger transaction appends `Committed`. After rollback, the collector appends `Rejected` or `IntegrityFailed` referencing the intent. A crash leaves an unresolved intent that a bounded collector closes with `TimeoutRecovery` and later `RecoveryCompleted`; PostgreSQL denials before procedure entry append `PermissionDenied` from database audit logs correlated to the intent without SQL values or key material.
- Every attempt-intent and post-rollback outcome is included in an append-only audit segment with its own sequence, predecessor digest, and HMAC produced by the same protected anchor procedure in the audit transaction. `audit_runtime` invokes only the audit procedure; its non-login `audit_writer_owner` may execute the anchor procedure but cannot read key/anchor tables. This audit-only chain is verified with the portfolio chain during rebuild and recovery, preventing coherent removal or replacement of failed-attempt evidence.

## Residual security decisions

Ring 1 must define and test provider status evidence, endpoint allowlists, provider-secret rotation/revocation, raw/evidence retention, redaction schema, retry limits, and connectivity policy. DEC-014 fixes ledger precision and rounding. DEC-016 accepts the reviewed signer/key/anchor/role/recovery architecture; it does not accept an implementation or ADR.

---
