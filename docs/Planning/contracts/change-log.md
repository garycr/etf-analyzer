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

No contract changes have been accepted. Candidate baseline `v1.0.0` is still being defined by its owning Ring 1 issues.
