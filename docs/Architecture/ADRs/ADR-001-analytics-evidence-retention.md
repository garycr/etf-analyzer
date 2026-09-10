# ADR-001 - Analytics Evidence Retention

**Status:** Accepted
**Date:** 2026-09-10
**Decision owner:** Workspace Owner
**Accountable custodian:** Team Lead
**Decision point:** DP-12 approved in DEC-018
**Related:** DEC-017; REV-012; GitHub #15 and #11

## Context

The ETF research prototype must preserve immutable, hash-verified evidence long enough to reproduce and challenge analytics and backtest results. The Objective specifies reproducibility but no statutory retention period. REV-012 approved three bounded policies after remediation of snapshot/vintage retention, policy binding, deletion, restore, privacy, capacity, and verification gaps. The Workspace Owner selected balanced policy `RET-A-1.0`.

## Decision

Adopt `RET-A-1.0` for workspace-managed analytics evidence:

- Bind immutable `retentionPolicyVersion` and database-generated UTC `retentionEpoch` when the bundle commits.
- Compute each deadline as `retentionEpoch + N * 24 hours`; later access, verification, archive, or restore never resets it.
- Keep each full evidence bundle hot through day 90 and in compressed read-only archive through day 730 from its epoch.
- Retain each reproducibility input set - normalized point-in-time snapshot, selected vintages, transformation lineage, and portfolio context - at least through the latest deadline of every bundle that references it.
- Keep the online verification manifest and deletion certificates through day 1,825.
- Keep each operational metadata event through day 365 from its own UTC event epoch.
- Permit workspace-managed backup copies for no more than 30 days after logical expiry, recording `PendingBackupExpiry` until the bound passes; reapply deletion certificates as `PostRestoreReDeletion` before post-restore readiness.
- Permit a separate manual `DeletionFrozen` interval for no more than 30 days unless the Workspace Owner explicitly reaffirms it; evidence whose deadline elapses becomes blocked `ExpiredFrozen` until governed deletion resumes.
- Cap hot-plus-archive evidence at 25 GiB excluding bounded backups; alert the Team Lead at 80% and block new evidence-backed runs at 100% without early eviction.
- Use RFC 8785 canonical bytes and SHA-256 for analytics evidence integrity, independent of DEC-016 ledger HMAC keys; analytics retention creates no cryptographic key-retirement obligation.
- Classify evidence `Complete` only while all required inputs are retained and verifiable. Rights-restricted evidence is `Degraded`, carries immutable `reproducibilityReason` naming the rights-policy identifier without payload details, cannot publish an evidence-backed signal, and cannot satisfy CT-ANA-001.
- Apply the governed deletion certificate, corruption quarantine, manual-freeze, accelerated-deletion, export-boundary, and terminal-lifecycle rules defined by the reviewed policy artifact.

## Alternatives

- `RET-B-1.0`: 30 days hot, one-year full evidence, two-year manifest, 10 GiB cap. Rejected because its shorter reproduction window provides less support for delayed research review.
- `RET-C-1.0`: one year hot, seven-year full evidence, ten-year manifest, 75 GiB cap. Rejected because no stated long-horizon obligation justifies its larger local storage and privacy burden.
- Custom policy or deferral. Rejected because REV-012 cleared the remediated options for selection with no unresolved findings and the Workspace Owner selected Option A in DEC-017; no new evidence justifies reopening that bounded choice.

## Consequences

Recent evidence remains immediately available and Complete evidence remains reproducible for two years. Compact verification history remains for five years. A later policy extension cannot recover evidence already deleted under this policy. User-owned exports remain outside workspace-managed deletion and require a plain warning that the user owns retention and deletion of the copy. Provider/raw-data rights remain governed separately under #17.

Policy reductions apply prospectively unless the Workspace Owner approves accelerated deletion after impact review. Extensions require storage, privacy, and backup review. Operational access metadata can expire at day 365 while a full bundle remains live through day 730; this is an accepted single-user prototype tradeoff.

`Degraded`, capacity-blocked, deletion-failed, and `ExpiredFrozen` states require programmatic non-color status, a plain redacted reason, and a keyboard-operable recovery or escalation step. This ADR incorporates the detailed reviewed lifecycle in `docs/Planning/analytics-evidence-retention-options.md`; it is not a standalone implementation specification.

Ring 2 must implement and execute CT-RET-001..012 and CT-ANA-001. Capacity assumptions are planning values and must be replaced with measured bundle/input sizes and arrival rates. Reaching a policy or capacity boundary fails closed rather than deleting evidence early or publishing unverifiable results.

## Invalidation

Revisit this ADR if measured evidence volume exceeds 25 GiB for 30 consecutive days, provider rights prevent a Complete P0 reproducibility sample, a legal or contractual retention obligation appears, DEC-017 recovery-target invalidation is triggered against the prototype RPO 24 hours / RTO 4 hours defined in the deployment and observability views, or scope adds production, multi-user, cloud, regulated, or brokerage behavior.

## Decision Boundary

ADR acceptance fixes the retention policy for the analytics evidence contract. It does not authorize implementation, provider ingestion, dependency installation, production deployment, freezing the analytics evidence contract baseline or any aggregate baseline, Ring 2 advancement, or parallel execution.
