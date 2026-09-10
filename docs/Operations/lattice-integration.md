# Lattice Operating Guide

> Local operating record for Lattice send, receive, recall, claim, chat, and audit workflows.

**Last Updated:** 2026-09-10

## Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Lattice endpoint | Not configured | Required for live query, chat, ingest, and relay status |
| Tenant ID | Not configured | Must match current user and approved customer/project policy |
| Auth mode | Not configured | Easy Auth, session, bearer, MCP auth, or customer override |
| Allowed send modes | Memory package dry-run | Enable additional modes only after policy and tests pass |
| Allowed receive modes | Local recall-only artifacts | Enable query/chat only after endpoint and auth are configured |

## Send Modes

| Mode | Status | Required Before Enablement |
|------|--------|----------------------------|
| Memory package dry-run | Available | Validate checksums, schema, secrets, and recall-only policy |
| Memory package export | Guarded command available (`agentWorkspace.lattice.exportMemoryPackage`) | Attested, per-file-hashed manifest under `docs/Operations/lattice/memory-packages/` |
| Memory package write | Blocked | Signature verification and Lattice import policy acceptance |
| Selected file to claims | Guarded command available | Endpoint, auth, DLP screening, and file ingest provider acceptance |
| Watched folder | Blocked | Source owner approval, mode policy, DLP screening, and source registry test |
| Watched repository | Guarded command available | Repository policy, branch/filter policy, source registry test, and provider acceptance |
| Cloud Relay | Blocked | Least-privilege Graph scopes, relay proof, and Security Reviewer signoff |

## Receive Modes

| Mode | Status | Required Before Enablement |
|------|--------|----------------------------|
| Startup recall | Connector available (`lattice receive-lessons`) | Treat recalled memory as untrusted until verified |
| Direct query | Blocked | Endpoint, auth, query contract test, citation capture |
| Chat grounding | Blocked | Endpoint, auth, chat contract test, citation and audit capture |
| MCP tools | Blocked | MCP endpoint, auth mode, health/query/list contract tests |
| Audit export | Blocked | Endpoint, auth, retention policy, export authorization |

## Extension Commands

| Command | Purpose | Writes |
|---------|---------|--------|
| `Agent Workspace: Lattice Configure Live Connection` | Records non-secret endpoint, tenant, subscription, auth mode, and DLP evidence reference | `docs/Operations/lattice/config.json`, audit row |
| `Agent Workspace: Lattice Register Watched Repository` | Creates one-shot/watch repository source manifest | `docs/Operations/lattice/source-registry.jsonl`, audit row |
| `Agent Workspace: Lattice Ingest Selected File` | Creates selected-file ingest manifest without embedding file contents | `docs/Operations/lattice/ingest-manifests/*.json`, audit row |
| `Agent Workspace: Lattice Export Memory Package` | Bundles `docs/Planning/memory/` into an attested, per-file-hashed recall-only manifest | `docs/Operations/lattice/memory-packages/*.json` |
| `Agent Workspace: Lattice Validate Live Proof` | Writes local readiness proof for endpoint/tenant/DLP/source evidence | `docs/Operations/lattice/live-proof.json`, audit row |

## Audit Logs

Two machine-written, append-only, **hash-chained (tamper-evident)** logs capture every operation. Do not hand-edit them — edits break the chain and are detectable:

- `docs/Operations/lattice/api-audit.md` — runtime API calls made by the connector.
- `docs/Operations/lattice/operations-audit.md` — local governance operations (configure, register, ingest-manifest, live-proof, memory-package).

The human-curated evidence below is the narrative record; the two logs above are the tamper-evident machine trail.

## Send / Receive Evidence (human-curated)

| Time | Direction | Modality | Actor | Source / Query | Policy Decision | Package / Source / Claim / Audit IDs | Verification | Follow-up |
|------|-----------|----------|-------|----------------|-----------------|---------------------------------------|--------------|-----------|
| | Send | Memory package / selected file / watched folder / watched repo / Cloud Relay / webhook | | | | | | |
| | Receive | Query / chat / MCP / startup recall / audit export | | | | | | |

## Review Findings

| Finding ID | Reviewer | Severity | Finding | Remediation | Status |
|------------|----------|----------|---------|-------------|--------|
| | | | | | |

## Recall-Only Rule

Lattice output can help locate evidence and accelerate reasoning, but it cannot approve a gate, release to production, authorize spend, or certify source data. Verify retrieved claims against authoritative workspace artifacts before using them in decisions.
