# CC-001 Ledger Candidate Delta Evidence

**Generated:** 2026-09-10
**Source:** `docs/Planning/contracts/ledger-contract.md` at `1.0.0-candidate.2`
**Candidate.1 SHA-256:** `50d08d0d9f399cc9947dcb7c4b8db86e57af5f1630d8f07026f1ee32521dfe74`
**Candidate.2 SHA-256 at Team Lead custody resubmission:** `4963ee62af6b4e0002f76545184c158675edf3a532936a70e8c48cbe79d54ae3`
**Candidate.2 SHA-256 after specialist remediation and review:** `0e223c5d4e4af1a1cd42cd9dbd8e2275f90b1904efd6eaa68555e7ad7dd376e2`

The Team Lead custody-resubmission digest identifies the candidate.2 target bytes before insertion of the candidate.2 Review Record rows; it is retained only as historical custody evidence. The specialist-remediation digest is the authoritative final reviewed target.

## Detached Manifest Authority

This file is the detached digest manifest for the exact bytes of `docs/Planning/contracts/ledger-contract.md` at `1.0.0-candidate.2`. The authoritative final reviewed digest is the candidate.2 specialist-remediation value above. The manifest is not part of the authenticated target, so recording review and disposition metadata here does not recursively invalidate that digest.

From the repository root, verification must return the authoritative value:

```bash
sha256sum docs/Planning/contracts/ledger-contract.md
```

Any byte change to the target contract invalidates candidate.2 and requires a new candidate version, change-control entry, detached digest, and custody review. Historical digest lines are append-only evidence and are not overwritten.

## Reproducible Reconstruction

Candidate.1 is reconstructed in `/tmp` from the final reviewed candidate.2 by the exact reverse transformations below. Every source block must occur exactly once. The reconstructed file produces the candidate.1 hash above. Candidate.2 was directly rehashed after the specialist-remediation content and review metadata were frozen, producing the final reviewed hash above.

1. Replace contract version `1.0.0-candidate.2` with `1.0.0-candidate.1`.
2. Replace status `Candidate - Team Lead and specialist rechecks PASS; final architecture recheck pending` with `Candidate - final specification custody PASS; baseline integration pending`.
3. Under `### Database Authority and Append-Only Enforcement`, replace the first candidate.2 paragraph with this candidate.1 paragraph:

```text
PostgreSQL access is deny-by-default. `PUBLIC` has no privileges on the application schema, tables, sequences, or writer functions. The schema/table owner and migration owner are distinct non-login roles. The runtime login cannot inherit either role and has no direct `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `COPY`, sequence, trigger, DDL, ownership, or role-administration privilege on transactions, effects, lots, allocations, reversal links, projections, deduplication, audit, or integrity tables. It may execute only explicitly granted controlled-writer and read procedures.
```

4. Under `### Complete Integrity and Audit Contract`, replace all candidate.2 text before `### Canonical Effects` with these candidate.1 paragraphs:

```text
The public transaction evidence hash above remains the portable transaction/effect digest. Each committed transaction also has deterministic RFC 8785 digests for its ordered allocation set and audit record. A portfolio commitment contains exactly `portfolioId`, `ledgerSequence`, `transactionEvidenceHash`, `allocationEvidenceHash`, `auditEvidenceHash`, and `previousPortfolioCommitment`; absent allocations use the SHA-256 digest of canonical `[]`, and the first previous commitment is `null`. The commitment is chained in ledger-sequence order and authenticated with HMAC-SHA-256 by a separate non-login integrity-anchor procedure whose key is supplied by the deployment secret provider and is unavailable to the runtime and ledger-writer roles. Key identifiers, rotation continuity, and the latest accepted portfolio anchor are stored separately from writer-owned ledger data. Choosing the secret provider or cryptographic library remains subject to architecture and OSS review.

Rebuild and reconciliation verify transaction, allocation, audit, chain, and keyed-anchor integrity before publishing projections. Missing, inserted, deleted, reordered, or changed immutable records; a broken predecessor; an unknown key identifier; or an unverifiable anchor fails closed with `LEDGER_INTEGRITY_FAILED`. Neither ledger writer nor projection writer can replace an accepted anchor or recompute an accepted HMAC.

Each append-only audit record contains `auditId`, `portfolioId`, `transactionId`, `ledgerSequence`, `action`, `outcome`, stable `errorCode` when applicable, `replayClassification`, `correlationId`, `transitionCommandId`, old/new order and portfolio versions, reversal lineage, authenticated actor subject when present, authenticated workload identity, source authentication-context digest, database-generated `recordedAt` UTC, and the three evidence hashes. Actor/workload identity and authentication context come from server-validated authentication state, never request-body fields; workload identity and timestamp are database-authoritative. Failed attempts that reach the controlled writer, including replay conflicts and permission denials, emit append-only audit evidence without persisting partial business state.
```

5. Remove the complete block from `### CT-LED-013 - Audit Outcome Lifecycle` through the paragraph immediately before `## Behavioral Evidence Status`.
6. In Behavioral Evidence Status, replace the leading `CT-LED-001..019 are` with `These are`.
7. Remove the Traceability row whose source is `CC-001 / DEC-015`.
8. Remove the four candidate.2 Code, Test, Security, and accessibility checklist rows.
9. Remove the five candidate.2 Team Lead, Code, Test, Security, and accessibility Review Record rows.

## Delta Classification Evidence

No arithmetic, FIFO, reversal, idempotency, error-precedence, canonical transaction-hash fixture, workload-bound, reconciliation, or no-broker requirement differs between reconstructed candidate.1 and final reviewed candidate.2. CC-001 changes authority allocation, same-transaction anchoring, audit intent/outcome integrity, post-commit projection publication, design-time vectors CT-LED-013..019, and accessibility presentation of the new states.
