# Analytics Evidence Retention Options

**Status:** Workspace Owner selected `RET-A-1.0`; ADR-001 accepted at DP-12 in DEC-018
**Date:** 2026-09-10
**Ring:** 1
**Scope:** GitHub #15 and #11; remediation #34-#42; analytics snapshot/evidence contract
**Human gate:** Workspace Owner policy selection, followed by DP-12 if an ADR is proposed for acceptance
**Decision authority:** Workspace Owner
**Accountable custodian:** Team Lead
**Decision review:** REV-012; Architect Reviewer initial REVISE; approved remediation #34-#42; architecture and security rechecks PASS

## Decision Required

Select exact retention and archival periods for deterministic analytics and backtest evidence. The Objective requires immutable, hash-verified, reproducible evidence but does not impose a statutory retention period. This decision applies to the local research prototype only and does not approve provider rights, raw-provider retention, telemetry retention, production use, or brokerage behavior.

## Fixed Floors

Every option preserves these requirements:

- Evidence and its policy binding are immutable and versioned while retained.
- `retentionEpoch` is the database-generated UTC instant at which the evidence bundle commits. Every deadline is exactly `retentionEpoch + N * 24 hours`; later access, verification, archive, or restore does not reset it.
- `retentionPolicyVersion` is bound in the canonical bundle and manifest at creation. The option identifiers are `RET-A-1.0`, `RET-B-1.0`, and `RET-C-1.0`.
- A full evidence bundle contains the canonical configuration and result plus immutable identifiers for rule, parameters, code, seed, benchmark, provider, environment, assumptions, warnings, configuration hash, and result hash.
- A reproducibility input set contains the normalized point-in-time market/economic snapshot, selected economic vintages, transformation lineage, and portfolio context required by referencing bundles. It is retained through the latest deadline of every full bundle that references it.
- `reproducibilityStatus` is `Complete` only when all required inputs are retained and hash-verifiable. If provider rights under #17 prohibit required retention, status is `Degraded`, `reproducibilityReason` names the rights-policy identifier without payload details, and the run cannot publish an evidence-backed signal or satisfy CT-ANA-001.
- Canonical RFC 8785 bytes and SHA-256 provide evidence integrity. Analytics evidence is not HMAC-anchored and does not use DEC-016 ledger keys; therefore analytics retention creates no cryptographic key-retirement obligation. PostgreSQL deny-by-default and append-only controls protect stored records, while SHA-256 detects byte changes.
- Hash verification occurs before use, export, archival, or restore. Verification failure quarantines the evidence and invokes the governed corrupt-evidence path below rather than retaining it indefinitely.
- Archive movement and restore never rewrite logical evidence identity, policy binding, epoch, or canonical hash inputs.
- Access is least-privilege and diagnostics expose only allowlisted metadata and hashes. Sensitive evidence means instrument identifiers, portfolio context, parameters, environment details, and research results; credentials and prohibited provider payloads are never evidence fields.
- Raw provider payloads remain governed by provider/right-specific policy under #17 and are referenced rather than duplicated when redistribution or retention is restricted.
- User-owned exports are outside workspace-managed deletion. Export requires a plain warning that the user owns retention and deletion of the exported copy.
- Automated legal hold is unsupported. The Workspace Owner may invoke a recorded manual deletion freeze while a new policy is reviewed. `DeletionFrozen` records the authority reference and expiry; if a retention deadline elapses, the evidence becomes blocked `ExpiredFrozen` and cannot be used or exported. A freeze expires after 30 days unless the Workspace Owner explicitly reaffirms it for another bounded interval.
- `Degraded`, capacity-blocked, deletion-failed, and expired-frozen states expose programmatic non-color status, a plain reason, and an available keyboard-operable recovery or escalation step without sensitive values.

## Evidence Classes

| Class | Contents | Storage state |
| --- | --- | --- |
| Full evidence bundle | Canonical configuration/result, rule/code/environment identifiers, assumptions, warnings, policy binding, epoch, and verification hashes | Hot, then compressed read-only archive, then governed deletion |
| Reproducibility input set | Normalized point-in-time snapshot, exact selected vintages and transformations, and portfolio context needed by one or more bundles | Co-retained at least through every referencing full-bundle deadline |
| Verification manifest | Evidence identity, schema/policy versions, epoch, reproducibility status, configuration/result/input hashes, lifecycle status, and deletion-certificate links | Small append-only online record retained longer than the full bundle |
| Operational metadata | Redacted access, verification, archive, restore, capacity, manual-freeze, and terminal-deletion events, each with its own UTC event epoch | Separate restricted audit class; access history may expire before a live bundle under all three options and this tradeoff is accepted for the single-user prototype |

## Governed Deletion and Restore

The canonical deletion certificate contains `deletionCertificateId`, `evidenceId`, `manifestId`, `targetClass`, `targetCanonicalHash`, `observedHash` when verification fails, `retentionPolicyVersion`, `retentionEpoch`, `scheduledExpiryAt`, `attemptedAt`, `completedAt` when applicable, `authorityType`, `authorityReference`, attempted/deleted/failed managed locations, `outcome`, `previousCertificateHash`, and `certificateHash`. `certificateHash` is SHA-256 over canonical RFC 8785 certificate bytes excluding `certificateHash`; the first predecessor is `null`.

`authorityType` is one of `PolicyExpiry`, `WorkspaceOwnerAccelerated`, `CorruptEvidenceDestruction`, or `PostRestoreReDeletion`. `outcome` is one of `Deleted`, `PartiallyDeleted`, `DeletionFailed`, or `VerificationFailedDestroyed`. Partial/failure outcomes keep the manifest blocked, retry only failed managed locations, and never report deletion complete.

If pre-deletion verification fails, the system quarantines the target and blocks use, export, archive, and restore publication. Destruction requires explicit Workspace Owner authority recorded in `authorityReference`; the certificate uses `VerificationFailedDestroyed`, the last trusted canonical hash, and the observed hash. Corruption cannot extend retention silently.

The full bundle and reproducibility input set have logical expiry at their selected deadline. Workspace-managed backup copies may persist for at most 30 additional days. Deletion status remains `PendingBackupExpiry` until that bound passes. After restore and before readiness, manifests and certificates are reapplied; expired or previously deleted evidence is quarantined and re-deleted with `PostRestoreReDeletion` authority. A restored expired artifact cannot become active.

The manifest/certificate class is the final evidence record. At its own deadline, it is deleted once and one redacted terminal event is written to operational metadata; that event does not create another deletion certificate. Operational metadata later expires under its own class rule, so deletion does not recurse indefinitely.

## Options

### Option A - `RET-A-1.0` Balanced Local Research (Recommended)

| Class | Hot from epoch | Archive / retained from epoch | Logical expiry |
| --- | ---: | ---: | --- |
| Full bundle and reproducibility inputs | Through day 90 | Day 91 through day 730 | End of day 730 |
| Online verification manifest and deletion certificates | Online throughout | Through day 1,825 | End of day 1,825 |
| Operational metadata | Online throughout | Through day 365 from each event epoch | End of day 365 |

**Rationale:** Keeps recent evidence immediately available for active analysis, supports two years of reproducibility review, and preserves compact proof of identity and governed deletion for five years without retaining full local payloads indefinitely.

**Capacity envelope:** 25 GiB for hot plus archive evidence, excluding bounded backup copies. Team Lead owns the alert and disposition at 80%; reaching 100% blocks new evidence-backed runs and never evicts evidence early.

**Invalidation:** Invalid if measured volume exceeds the envelope for 30 consecutive days, provider rights prevent Complete status for the P0 sample, or a new obligation requires a longer full-bundle window.

### Option B - `RET-B-1.0` Minimum Footprint

| Class | Hot from epoch | Archive / retained from epoch | Logical expiry |
| --- | ---: | ---: | --- |
| Full bundle and reproducibility inputs | Through day 30 | Day 31 through day 365 | End of day 365 |
| Online verification manifest and deletion certificates | Online throughout | Through day 730 | End of day 730 |
| Operational metadata | Online throughout | Through day 180 from each event epoch | End of day 180 |

**Rationale:** Minimizes workstation storage and sensitive-data exposure, but limits the period for reproducing older research and investigating delayed discrepancies.

**Capacity envelope:** 10 GiB for hot plus archive evidence, excluding bounded backup copies, with the same 80% Team Lead alert and 100% fail-closed behavior.

**Invalidation:** Invalid if the one-year reproduction window is shorter than an accepted research-review cycle or measured volume exceeds the envelope for 30 consecutive days.

### Option C - `RET-C-1.0` Extended Research History

| Class | Hot from epoch | Archive / retained from epoch | Logical expiry |
| --- | ---: | ---: | --- |
| Full bundle and reproducibility inputs | Through day 365 | Day 366 through day 2,555 | End of day 2,555 |
| Online verification manifest and deletion certificates | Online throughout | Through day 3,650 | End of day 3,650 |
| Operational metadata | Online throughout | Through day 730 from each event epoch | End of day 730 |

**Rationale:** Maximizes longitudinal reproducibility and investigation windows, with the greatest local storage, backup, and privacy burden. The Objective states no seven-year requirement, so selection should identify the research or governance need for that window.

**Capacity envelope:** 75 GiB for hot plus archive evidence, excluding bounded backup copies, with the same 80% Team Lead alert and 100% fail-closed behavior.

**Invalidation:** Invalid if local backup/restore cannot meet RPO 24 hours and RTO 4 hours at measured volume, or privacy/storage review rejects the seven-year full-bundle window.

## Comparison

| Criterion | Option A | Option B | Option C |
| --- | --- | --- | --- |
| Reproduce recent and prior research | Strong | Limited | Strongest |
| Local storage and backup burden | Moderate | Lowest | Highest |
| Sensitive-data exposure duration | Moderate | Lowest | Highest |
| Operational complexity | Moderate | Lowest | Highest |
| Full-bundle window | 2 years | 1 year | 7 years |
| Irreversibility | Deleted after 2 years cannot be recovered by a later extension | Deleted after 1 year cannot be recovered by a later extension | Deleted after 7 years cannot be recovered by a later extension |
| Fit for stated local objective | Strong | Acceptable if short review window is sufficient | Requires an identified long-horizon research need |

Storage is workload-dependent. Let $H$ be average hot uncompressed bundle-plus-input size in GiB, $A$ average compressed archive size in GiB, $N$ annual bundle count, $D_h$ hot days, and $D_f$ full retention days. Approximate steady-state managed capacity before backups is:

$$
C = N \left(\frac{D_h}{365}H + \frac{D_f-D_h}{365}A\right)
$$

For planning only, $N=1{,}000$, $H=0.010$ GiB, and $A=0.004$ GiB produces approximately 9.5 GiB for A, 4.5 GiB for B, and 34 GiB for C. The envelopes provide headroom for manifests and variance. Ring 2 must measure actual sizes and rates; the Team Lead owns the 80% alert, capacity response, and any new policy proposal.

## Recommendation

Select **Option A**. It preserves a two-year Complete reproduction window and five-year compact verification history while avoiding indefinite full-bundle retention. Selection is a one-way retention decision for expired data: a later extension cannot recover evidence already deleted under A. Option B is appropriate if storage minimization dominates historical analysis. Option C is appropriate when the Workspace Owner identifies a long-horizon research need that justifies its larger local footprint.

## Workspace Owner Selection

On 2026-09-10, the Workspace Owner selected **Option A, `RET-A-1.0`** after REV-012 architecture and security PASS. DEC-017 records the selection, and DEC-018 records ADR-001 acceptance at DP-12. No implementation or baseline authority follows from policy acceptance alone.

## Planned Retention Test Vectors

| ID | Trigger | Expected state / gate behavior |
| --- | --- | --- |
| CT-RET-001 | Create evidence under one policy, then change the active policy | Existing bundle retains its original policy version, UTC epoch, and deadlines; no retroactive mutation |
| CT-RET-002 | Required snapshot/vintage inputs are retained or prohibited by #17 | `Complete` only with all verified inputs; otherwise immutable `Degraded` reason and no evidence-backed publication or CT-ANA-001 PASS |
| CT-RET-003 | Move a verified bundle and inputs from hot to archive | Identity and all canonical hashes remain equal; partial movement rolls back or remains blocked |
| CT-RET-004 | Normal full-bundle expiry | Managed active/archive locations delete, canonical certificate records `Deleted`, and backup status remains pending for at most 30 days |
| CT-RET-005 | Hash verification fails before expiry/deletion | Evidence quarantines; use/export/archive blocks; authorized destruction records `VerificationFailedDestroyed` with trusted and observed hashes |
| CT-RET-006 | Restore contains expired or previously deleted evidence | Readiness remains false; certificate reconciliation re-deletes the artifact with `PostRestoreReDeletion` before activation |
| CT-RET-007 | User exports verified evidence | Warning records workspace boundary; managed deletion does not claim deletion of the user-owned copy |
| CT-RET-008 | Manifest reaches its terminal deadline | Manifest/certificates delete once; one redacted operational terminal event is written; no recursive certificate |
| CT-RET-009 | Capacity reaches 80% then 100% | Team Lead alert at 80%; new evidence-backed runs block at 100%; retained evidence is not evicted early |
| CT-RET-010 | Recompute canonical evidence after key rotation | SHA-256 verification remains stable and independent of DEC-016 HMAC key lifecycle |
| CT-RET-011 | A retention deadline elapses during a manual deletion freeze | State becomes blocked `ExpiredFrozen`; use/export is denied; freeze expires after 30 days unless explicitly reaffirmed; release resumes governed deletion |
| CT-RET-012 | Workspace Owner approves accelerated deletion | Existing policy binding remains immutable; certificate records `WorkspaceOwnerAccelerated`, authority reference, impact-reviewed target locations, and both-or-fail deletion outcome |

These are pre-implementation vectors. CT-RET-001..012 and CT-ANA-001 require executable Ring 2 evidence before the analytics public surface is complete.

## Decision Boundaries

Selection authorizes retention values for the analytics evidence contract only. It does not authorize implementation, provider ingestion, dependency installation, production deployment, baseline freeze, Ring 2 advancement, or parallel execution. Any future reduction applies prospectively because every bundle is bound to its creation-time policy, unless the Workspace Owner explicitly approves accelerated deletion after impact review. Any extension requires storage, privacy, and backup review and cannot recover already deleted evidence. A new legal or contractual retention obligation invalidates this local-prototype decision and requires a separately reviewed policy with hold semantics.
