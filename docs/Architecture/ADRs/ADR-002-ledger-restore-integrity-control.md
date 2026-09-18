# ADR-002 - Ledger Restore Integrity Control

**Status:** Accepted
**Date:** 2026-09-18
**Decision owner:** Agent under Fully Agentic mode
**Accountable custodian:** Solo Orchestrator
**Decision:** DEC-056
**Review:** REV-133 Architect PASS
**Related:** DEC-016; REV-011; CT-LED-019; GitHub #79 and #82

## Context

DEC-016 accepts protected ledger checkpoints, retained key versions, fail-closed recovery, and readiness gating. The current PostgreSQL implementation can compare one supplied portfolio commitment with one current checkpoint, but it cannot authenticate a restored backup boundary, detect rollback across the complete portfolio and audit chains, retain a failed verification gate across transaction rollback, or resume an interrupted key rotation.

CT-LED-019 requires executable recovery evidence without adding a scheduler, worker, public endpoint, brokerage path, or production authority. PostgreSQL functions cannot commit independently, so durable fail-closed state requires separate caller-committed phases.

## Decision

Adopt one database-wide restore integrity control owned by `anchor_owner`. A whole PostgreSQL restore is the unit of recovery, so one global gate intentionally blocks every portfolio until all retained evidence verifies.

### Signed Backup Manifest

`ledger_backup_manifest_create(backupId UUID, createdAt UTCInstant, signerKeyIdentifier String) returns jsonb` is executable only by `key_injector` and runs as `anchor_owner` with a fixed `search_path`. Under the global integrity advisory lock and a shared lock on the Ready control row, it derives rather than accepts:

- the latest audit sequence and commitment;
- every portfolio identifier, portfolio version, latest ledger sequence, commitment, audit sequence, and audit commitment, ordered by portfolio identifier;
- the ordered retained key identifiers needed by those commitments;
- the latest append-only rotation event and its predecessor/successor identifiers when rotation is in progress; and
- `backupId`, database identity, schema migration sequence, migration content hash, and millisecond UTC `createdAt`.

The function RFC-8785-canonicalizes the closed manifest, computes its SHA-256 hash, and HMAC-SHA-256 signs the hash and manifest identity with the named retained signer key. It returns the manifest, hash, signer key identifier, and signature, never key bytes. The deployment backup workflow retains this artifact outside PostgreSQL with the coherent backup set. Restore order remains retained keys, signed manifest, PostgreSQL data, then verification.

The manifest is the protected checkpoint for that backup. Its portfolio and audit values must equal the database checkpoints captured in the same coherent set; no caller-authored sequence or commitment becomes trusted merely because `key_injector` supplied it.

### Durable Restore Phases

`ledger_restore_begin(payload jsonb) returns uuid` and `ledger_restore_verify(restoreId uuid) returns jsonb` are executable only by `key_injector`, run as `anchor_owner`, and expose no key bytes or unrestricted DML.

The deployment caller must execute each function in its own PostgreSQL transaction and commit `ledger_restore_begin` before invoking verification on a new transaction. PostgreSQL 16 is the implementation target. Runtime paths use `pg_catalog.pg_advisory_xact_lock_shared`; restore transitions use `pg_catalog.pg_advisory_xact_lock`. Both operate on `pg_catalog.hashtextextended('etf:ledger-integrity',0)`. Begin acquires locks in this order:

1. transaction advisory lock `etf:ledger-integrity`;
2. `ledger_integrity_control` singleton `FOR UPDATE`.

Begin requires a closed payload containing one signed backup artifact and a new `restoreId`. It appends a `Started` restore event and sets the singleton to `NotReady` with that restore identity and artifact. Begin intentionally does not trust the artifact signature. Replays with the same restore identity and exact artifact return the original identity; changed or competing restore input fails closed.

Verify acquires the same locks in the same order, requires the committed `NotReady` row and matching restore identity, and verifies the signature before trusting any manifest field. It performs no recovery DML and grants no bypass to ledger or projection writers. On any exception, the transaction rolls back while the previously committed `NotReady` row and `Started` event remain durable. The caller records a failed attempt by invoking `ledger_restore_failure_record(restoreId, failureClass)` in a separate transaction; the closed redacted class cannot contain SQL text, hashes, or key material.

On complete success, verify atomically appends a `Verified` event and changes the singleton to `Ready`, clears the active restore identity, and records the verified backup identity and time. A successful exact replay returns the prior verified result. There is no function that directly forces Ready.

### Full Verification

Verification checks all retained rows, not only the latest checkpoint:

- contiguous audit sequences beginning at one, exact predecessor links, audit-row evidence hashes, commitment hashes, HMACs under each recorded retained key, and equality with every audit checkpoint;
- for each portfolio, contiguous ledger sequences beginning at one, transaction/allocation/audit evidence hashes, exact predecessor links, commitment hashes, anchor HMACs under each recorded key, and equality with the latest portfolio checkpoint;
- exact manifest equality for database identity, migration identity, portfolio set, versions, latest ledger/audit sequences, commitments, and required key identifiers;
- no database sequence older than the signed manifest and no database checkpoint older than its corresponding retained commitment; coherent restore uses exact equality, so an older or unexpectedly newer database also fails;
- the authoritative portfolio state can be rebuilt exactly from retained ledger effects, lots, allocations, and reversals with all internal quantities, bases, cash, and realized P&L consistent; when a latest projection exists it must equal that rebuild and reference the verified latest commitment, while absence of a derived projection does not create a readiness/publication cycle; and
- append-only rotation continuity and availability of every historical key needed by retained commitments.

Missing, inserted, deleted, reordered, altered, unknown-key, invalid-HMAC, stale, or incoherent state raises `LEDGER_INTEGRITY_FAILED`. Verification returns only `{restoreId, backupId, status:"Ready", verifiedAt}` on success.

### Global Integrity Gate

`ledger_integrity_control` is a one-row anchor-owned table containing `singleton`, `status` (`Ready|NotReady`), active restore identity, signed artifact, latest verified backup identity, and transition timestamps. Migration initializes it `Ready` only because sequence 3 is empty-database-only and rejects a nonempty target before DDL.

`ledger_append`, `projection_publish`, and every portfolio/audit anchor append call `pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('etf:ledger-integrity',0))` before their existing attempt, portfolio, audit-identity, or commitment locks, then require `status='Ready'`. Restore begin/verify call the exclusive `pg_catalog.pg_advisory_xact_lock` variant on the same key. PostgreSQL transaction advisory shared/exclusive locks prevent a gate transition from racing an in-flight append. Normal runtime callers have no restore bypass; NotReady returns `LEDGER_INTEGRITY_FAILED` before mutation.

The application readiness collector reads only a redacted owner function returning `Ready|NotReady`, verified backup identity, and timestamps. It records `LedgerIntegrity=NotReady` with `LEDGER_INTEGRITY_FAILED`; it cannot set the gate.

### Append-Only Rotation Evidence

`anchor_key_rotation_events` is anchor-owned and immutable. Each row contains `rotationId`, positive event sequence, event type (`Started|Completed`), predecessor and successor key identifiers, event time, previous event hash, event hash, signer key identifier, and HMAC. The primary key is `(rotationId,eventSequence)`; one unique `Started` event is sequence one, `Completed` is sequence two, identifiers cannot be equal, both keys are foreign-keyed to retained `anchor_keys`, and no second incomplete rotation may begin.

Injecting a second or later key does not delete or rewrite a prior key. A separate deployment-only `anchor_key_rotation_start` call appends `Started` signed by the predecessor after the successor exists. During `Started`, new commitments must use the successor while retained predecessor commitments remain verifiable. Restore verification requires both keys, verifies the rotation event chain and commitments under both identifiers, and preserves `Started` if no valid completion evidence exists. `anchor_key_rotation_complete` appends `Completed` signed by the successor only after at least one successor-key portfolio or audit commitment and a signed backup manifest covering both identifiers exist.

`anchor_keys.key_ciphertext` is the legacy physical column name for usable HMAC key bytes. It is not application-wrapped ciphertext and is passed directly to `pgcrypto.hmac`; confidentiality comes from database/storage encryption at rest plus anchor-owner-only column access. Backup copies use encrypted storage and deployment-secret controls. A remote KMS or wrapped-key design would require a new ADR and an explicit unwrap operation rather than silently treating ciphertext as an HMAC key.

Retirement marks a key unavailable for new signing but never deletes bytes needed by retained commitments. Retirement is rejected while any retained commitment, signed backup manifest, or incomplete rotation requires that key. Key destruction is outside this ADR and would require a new retention decision because it destroys verifiability.

### Coherent Backup Transaction

The backup caller starts a `REPEATABLE READ, READ ONLY` transaction, acquires the shared global integrity lock through `ledger_backup_manifest_create`, and exports that transaction snapshot with `pg_catalog.pg_export_snapshot()`. The backup reader imports the exported snapshot before its first query while the exporting transaction remains open. The signed manifest and database backup therefore observe one snapshot. After the backup reader completes, the exporter commits and releases the shared gate. Restore requires the manifest and data snapshot from the same backup identity; mixing artifacts fails exact manifest equality.

## Alternatives

- Trust a caller-supplied checkpoint. Rejected because deployment identity alone does not authenticate sequence or commitment values.
- Set NotReady and verify in one function call. Rejected because a verification exception rolls back the gate in the same PostgreSQL transaction.
- Use application `readiness_append` as the ledger gate. Rejected because it accepts application-owned snapshots and does not control ledger or projection mutations.
- Gate each portfolio independently. Rejected for the local prototype because restore and audit-chain continuity are database-wide; partial readiness would make one global audit chain ambiguous.
- Update one rotation row in place. Rejected because interrupted rotation must remain reconstructible from immutable evidence.

## Consequences

Restore and backup verification are explicit deployment operations. A failed or interrupted restore remains visibly NotReady until the same signed artifact verifies or a new governed restore begins. Full retained-history verification is expected to be offline and may be expensive, but the local prototype favors integrity over availability. Runtime roles gain no new table privilege, signing key access, or recovery override.

Architecture acceptance and issue completion are separate stages. A PASS re-review of this Proposed ADR authorizes test-first implementation under #82 but does not close #82. Issue #82 closes only after the functions, tables, grants, contracts, tests, code/security reviews, and complete-suite evidence in its acceptance criteria pass.

Implementation changes migration 0003 and therefore requires canonical sequence 3 content/manifest remeasurement plus cumulative manifest remeasurement for later migrations. Test evidence must include stale database, stale or forged manifest, missing and altered chain rows, invalid HMAC, missing historical key, blocked append/publication, failed verification retaining NotReady, concurrent append versus restore begin, and successful interrupted dual-key rotation resume.

## Invalidation

Revisit this ADR if restore scope becomes per-tenant, a remote KMS replaces PostgreSQL HMAC execution, retained history becomes too large for bounded offline verification, key destruction is introduced, or the system adds multi-user, production, cloud, regulated, or brokerage behavior.

## Decision Boundary

This accepted ADR authorizes test-first CT-LED-019 implementation under #82. It does not close #82 or #79, advance a ring, activate a baseline, release, deploy, or authorize production use.
