# Contract Change Log

**Current active baseline:** None
**Candidate baseline:** `v1.0.0` - Building

## Required Entry Schema

Each future entry must contain:

| Field | Requirement |
| --- | --- |
| Change ID | Stable `CC-NNN` identifier |
| Date | ISO date/time |
| Originator | Person or distinct agent proposing the change |
| Target baseline | Version consumed or proposed |
| Affected contracts/streams | Fixed paths and MAI-ST consumers |
| Classification | Patch, additive minor, or breaking major |
| Classification evidence | Rubric example and compatibility impact |
| DEC-011 floor assertion | Pass, possible impact, or fail with rationale |
| Specialist reviews | Required Code/Test/Security/accessibility evidence |
| Compatibility checks | Named CT test IDs and results |
| Custodian disposition | Approve, reject, or escalate |
| Co-signature | Solo Orchestrator when originator/conflict rule applies |
| Human approval | Required for breaking, scope, floor-impact, or ADR changes |
| Invalidation notice | Affected baseline/streams and acknowledgement status |

## Classification Defaults

Disputed or unclassifiable changes are breaking. The originator cannot approve their own change. Technical compatibility never replaces the DEC-011 canonical-floor assertion.

## Emergency Rule

Emergency changes are revert-only to the last active baseline. Forward-breaking changes require Workspace Owner approval.

## Entries

### CC-001 - Ledger Architecture Alignment Amendment

| Field | Value |
| --- | --- |
| Change ID | CC-001 |
| Date | 2026-09-10 |
| Originator | Solo Orchestrator implementing approved DEC-015 remediation |
| Target baseline | `v1.0.0-candidate.2` |
| Affected contracts/streams | `ledger-contract.md`; PostgreSQL, audit, projection, security, and operations consumers |
| Classification | Additive minor candidate amendment; confirmed by Team Lead custody review |
| Classification evidence | Clarifies authority, transactionality, audit lifecycle, and publication timing without changing accounting outputs or existing command identities |
| DEC-011 floor assertion | Pass expected: immutable FIFO, reversing correction, exact reconciliation, no-broker, and deterministic evidence floors are preserved |
| Specialist reviews | Code, Test, Security, accessibility, final Team Lead custody, and Architect Reviewer rechecks PASS; DP-33 architecture acceptance recorded in DEC-016 |
| Compatibility checks | CT-LED-001..012 unchanged; CT-LED-013..019 define attempt/audit-chain, role, transaction rollback, projection-publication, crash-recovery, and anti-rollback checks for Ring 2 execution |
| Custodian disposition | PASS; candidate.2 accepted for specialist rechecks |
| Detached final digest | `0e223c5d4e4af1a1cd42cd9dbd8e2275f90b1904efd6eaa68555e7ad7dd376e2` in `docs/Planning/contracts/evidence/CC-001-ledger-candidate-delta.md` |
| Co-signature | Solo Orchestrator originated amendment; independent Team Lead disposition required |
| Human approval | DEC-016 accepts the reviewed ledger-security architecture at DP-33; implementation, baseline freeze, and contract activation remain unauthorized |
| Invalidation notice | `1.0.0-candidate.1` custody evidence remains historical; candidate.2 cannot freeze until reviews and affected-stream acknowledgements complete |
