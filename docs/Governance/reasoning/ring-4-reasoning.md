# Ring 4 Reasoning

## RSN-010: Productize Before Promotion

**Ring:** Ring 4
**Date:** 2026-09-25
**Trigger:** Release-management activation
**Related:** DEC-095, issues #88 and #97

**Question:** Can the Ring 3 integration candidate enter DEV/SMOKE promotion without a supported product composition root?

**Constraints:** The accepted workflow exists only in integration-owned composition. A release must have documented launch/configuration/shutdown behavior, authoritative read owners, bounded fixture loading, reproducible runtime identity, and a smokeable health path. Public ingress, providers, brokerage, durable handoff, and production remain excluded.

**Reasoning:** Promoting the integration fixture would mislabel test assembly as a product artifact. Ring 4 may activate because its entry evidence passes, but #88 must produce the truthful local release unit before DEV or SMOKE promotion is recorded.

**Outcome:** DEC-095 opens Ring 4 planning and implementation. #88 is first in sequence; no release candidate or promotion exists yet.

**Invalidation:** A request to widen ingress, enable providers or brokerage, introduce durable handoff, change database platform, or deploy to production requires separate architecture/security review and authorization.
