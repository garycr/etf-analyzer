# Lattice Resource Bundle

This directory is copied into generated workspaces at `docs/Operations/lattice/contracts/`.

It provides local contract references for:

- Querying eligible claims.
- Chat grounding with citations.
- Listing claim buckets.
- Checking Cloud Relay status.
- Submitting selected files for claim extraction.

It also ships a read-only description of the **full-fidelity claim record** the Shared
Brain constructs and governs server-side — see
[claim-data-model.reference.md](./claim-data-model.reference.md). Workspaces do not own or
store that schema; the reference exists so agents author memory artifacts with enough
metadata (provenance + retrieval facets) that the Brain can build every claim field without
loss of fidelity.

These contracts are reference material for workspace governance and tests. Tenant-specific endpoint, auth, and deployment values belong in customer or project overrides, not in this bundle.

Live deployments must replace the placeholder server URL, keep bearer authentication enabled, and emit immutable server-side audit events. The local Markdown audit log is only an index for workspace evidence.
