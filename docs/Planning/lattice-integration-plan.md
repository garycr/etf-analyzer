# Lattice Integration Plan

> Plan and backlog for enabling governed send-to-Lattice and receive-from-Lattice workflows in this workspace.

**Last Updated:** 2026-09-10

## Objective

Enable this workspace to contribute governed content to Lattice and receive permission-trimmed, cited recall from Lattice while preserving the boundary that recalled content is not approval authority.

## Workstreams

| Workstream | Scope | Owner | Status | Evidence |
|------------|-------|-------|--------|----------|
| LATTICE-WS-01 Memory package export | Build and validate Option 3/4 memory packages from `docs/Planning/memory/` | Lattice Connector | Guarded command available | `agentWorkspace.lattice.exportMemoryPackage` |
| LATTICE-WS-02 Selected file to claims | Submit explicitly selected files for claim extraction | Lattice Connector | Not started | |
| LATTICE-WS-03 Watched folder | Register folder sources in one-shot or watch mode | Lattice Connector | Not started | |
| LATTICE-WS-04 Watched repository | Register repository sources for docs, issues, PRs, decisions, and lessons | Lattice Connector | Guarded command available | `agentWorkspace.lattice.registerWatchedRepository` |
| LATTICE-WS-05 Cloud Relay | Configure or verify app-folder / selected-folder relay status | Lattice Connector + Security Reviewer | Not started | |
| LATTICE-WS-06 Direct query and chat | Query eligible claims and preserve citations, confidence, and audit IDs | Lattice Connector | Connector available | `tools/lattice-client` `query` / `probe` |
| LATTICE-WS-07 Startup recall | Load lessons learned and memory summaries as recall-only context | Lattice Connector + Document Manager | Connector available | `lattice receive-lessons` → `docs/Operations/lattice/received-lessons.jsonl` |
| LATTICE-WS-08 Test and review hardening | Validate enabled contracts and remediate findings | Test Manager + Code Reviewer | Not started | |
| LATTICE-WS-09 Live proof validation | Validate endpoint, tenant, DLP policy, and source registry evidence | Test Manager + Lattice Connector | Guarded command available | `agentWorkspace.lattice.validateLiveProof` |

## Blocker Backlog

| Item | Trigger | Continue-Elsewhere Action | Owner | Status |
|------|---------|---------------------------|-------|--------|
| SB-BLK-001 | Endpoint, tenant, or auth mode unknown | Run `Agent Workspace: Lattice Configure Live Connection`; no secrets are written | Lattice Connector | Command available |
| SB-BLK-002 | Write-mode signature verification unavailable | Use dry-run validation only; do not import as authoritative memory | Lattice Connector | Open |
| SB-BLK-003 | Required DLP/content-safety gate unavailable | Keep path disabled and log provider gap | Security Reviewer | Open |
| SB-BLK-004 | Broad Graph scope requested | Reject by default and escalate for security review | Security Reviewer | Open |

## Acceptance Criteria

- [ ] Each enabled send modality has deterministic tests and audit evidence.
- [ ] Each enabled receive modality returns evaluable claim text, citations, relevance evidence, confidence, and audit identifiers where available.
- [ ] Recall-only content is verified against authoritative artifacts before gate, release, spend, or production decisions.
- [ ] Document Manager has synced plan, guide, audit, and contract artifacts into `docs/artifacts/`.
- [ ] Review hardening findings are resolved or tracked with explicit backlog items.
