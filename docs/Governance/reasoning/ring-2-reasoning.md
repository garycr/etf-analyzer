# Ring 2 Reasoning

> Reasoning entries for Ring 2. See `reasoning-ledger.md` for the master index.

## Entries

### RSN-002: Greenfield PostgreSQL-Only Delivery

| Field | Value |
| --- | --- |
| **ID** | RSN-002 |
| **Ring** | Ring-2 |
| **Date** | 2026-09-23 |
| **Trigger** | Scope decision |
| **Related** | DEC-057 |

**Question:** Should Ring 2 implement custom restore controls or SQL Server conversion work when the approved product is a greenfield PostgreSQL prototype?

**Constraints considered:**

- The Workspace Owner explicitly excluded SQL Server data and DDL migration.
- Ruthless simplicity prohibits speculative operational machinery.
- PostgreSQL integrity, replay, and migration evidence remain mandatory.

**Trade-offs evaluated:**

- Implement SQL Server conversion and custom restore controls: broader apparent coverage vs. unauthorized scope and untestable assumptions - rejected.
- Preserve PostgreSQL integrity controls and defer production restore design: exact approved scope vs. no production backup claim - selected.

**Reasoning:** The prototype has no source SQL Server estate and no production restore requirements. Adding either would create risk without satisfying an approved requirement.

**Assumptions:** PostgreSQL remains the sole persistence target; no legacy data cutover is introduced.

**Invalidation criteria:** A Workspace Owner-approved scope change introduces legacy data, SQL Server DDL, or production restore requirements.

**Outcome:** DEC-057; greenfield PostgreSQL-only delivery retained.

### RSN-003: Synchronous Local Workflow Composition

| Field | Value |
| --- | --- |
| **ID** | RSN-003 |
| **Ring** | Ring-2 |
| **Date** | 2026-09-23 |
| **Trigger** | Architecture trade-off |
| **Related** | DEC-069; RH-007 |

**Question:** Should WP-8 add workers, queues, provider adapters, or a supported product launcher to prove the local prototype workflow?

**Constraints considered:**

- WP-8 is fixture-only, loopback-only, and research-only.
- No durable process-crossing handoff is approved.
- Command owners require explicit reviewed fixture and analytics artifacts.
- Six read/query surfaces have no general PostgreSQL runtime dispatcher outside bounded test composition.

**Trade-offs evaluated:**

- Add workers, outbox, or providers: operational realism vs. unauthorized architecture expansion - rejected.
- Build a partial launcher: visible executable vs. misleading incomplete product composition - rejected.
- Retain the full executable integration composition and defer supported launch/productization: exact acceptance proof vs. no operator launch command - selected for DP-33 review.

**Reasoning:** The accepted candidate proves the complete synchronous workflow under controlled composition. A supported launcher would require new runtime read owners and artifact-loading policy, not a small wiring extraction.

**Assumptions:** Ring 3 validates work products rather than operating a released product; release and deployment remain unauthorized.

**Invalidation criteria:** Ring 3 requires operator-driven launch, or productization becomes approved scope.

**Outcome:** Retain the bounded integration candidate; RH-007 requires explicit DP-33 disposition.

### RSN-004: PostgreSQL Manifest Authority

| Field | Value |
| --- | --- |
| **ID** | RSN-004 |
| **Ring** | Ring-2 |
| **Date** | 2026-09-23 |
| **Trigger** | Evidence correction |
| **Related** | DEC-086 |

**Question:** Which manifest roots govern when accepted artifacts conflict with the reproducible live PostgreSQL catalog?

**Constraints considered:** Exact PostgreSQL 16.15, unchanged SQL bytes, candidate.3 identity, and preservation of historical evidence.

**Trade-offs evaluated:** Retain contradictory roots - rejected; alter SQL/projector to match stale records - rejected; replace only roots with reproduced values and mark earlier records superseded - selected.

**Reasoning:** Reproduction across Node 20/24 and trust/password bootstrap shapes yielded one stable catalog chain while all SQL hashes remained unchanged.

**Assumptions:** The current projector and pinned PostgreSQL image define bounded manifest authority.

**Invalidation criteria:** Any SQL hash drift, projector semantic change, or environment-dependent root.

**Outcome:** DEC-086.

### RSN-005: Security Analysis And Evidence Provenance

| Field | Value |
| --- | --- |
| **ID** | RSN-005 |
| **Ring** | Ring-2 |
| **Date** | 2026-09-23 |
| **Trigger** | Security trade-off |
| **Related** | DEC-087 |

**Question:** How should WP-8 close the gap between a bounded forbidden-call scanner and broad SAST while preserving raw commit-bound evidence?

**Constraints considered:** No new runtime dependency, immutable action pins, private-repository permissions, and evidence availability on failed gates.

**Trade-offs evaluated:** Custom scanner only - insufficient; add npm analyzer - avoidable dependency; pinned CodeQL plus raw artifact manifest - selected.

**Reasoning:** Native pinned CodeQL broadens semantic analysis, while the runner preserves all existing gate outputs with exact commit/run/job identity and stream hashes.

**Assumptions:** GitHub Actions and code scanning remain available; 90-day artifact retention covers Ring 2 review.

**Invalidation criteria:** Failed CodeQL, alerts, missing artifact, identity mismatch, or hash mismatch.

**Outcome:** DEC-087; CI run 35902418187 passed and its downloaded artifact verified.

### RSN-006: WP-8 Closure Boundary

| Field | Value |
| --- | --- |
| **ID** | RSN-006 |
| **Ring** | Ring-2 |
| **Date** | 2026-09-23 |
| **Trigger** | Gate disposition |
| **Related** | RH-007; RH-009; DP-33 |

**Question:** Can WP-8 complete as an executable integration candidate without claiming release, deployment, production, or a supported local launcher?

**Constraints considered:** All executable acceptance criteria pass; the Workspace Owner approved WP-8/Ring 2 completion; DP-33 requires Plan, Architecture, and Security review; every Major must be resolved before Ring 3.

**Trade-offs evaluated:** Close without review - rejected; expand into productization - rejected; accept the bounded candidate if all three DP-33 reviews agree the launcher omission is a deferred productization concern - selected.

**Reasoning:** Ring 2 proves implementation and integration, while Ring 3 performs independent validation. Product operation and release remain later-ring concerns.

**Assumptions:** Reviewers find no Critical/Major gap requiring Ring 2 remediation. REV-196/197/198 confirmed that assumption.

**Invalidation criteria:** Any DP-33 reviewer classifies the launcher/read-owner omission as an unresolved Major or finds another Critical/Major gap.

**Outcome:** Accepted under DP-33 and approved in DEC-089, but Ring 2 remains active because the mandatory final `plaid-cl_analyzeSessions` broker action is unavailable. Productization remains deferred; Ring 3, release, deployment, and production are not authorized.
