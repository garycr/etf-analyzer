# Lattice Claim Data Model & Metadata Taxonomy (Read-Only Reference)

> **Status:** Read-only reference. This document describes the **full-fidelity claim
> record** the Lattice constructs and governs on the server side. Generated
> workspaces do **not** own, mutate, or store this schema — they **produce** the memory
> artifacts (summaries, facts, lessons, interaction records) that the Brain enriches into
> claims, and they **consume** a permission-trimmed projection of claims through the
> query/recall contract in [agent-contract.openapi.yaml](./agent-contract.openapi.yaml).
>
> The authoritative schema lives in the Lattice service
> (`src/Domain/MemoryImport/importedMemory.ts` and `src/Domain/Models/index.ts`).
> This copy exists so workspace agents author memory with enough metadata that the Brain
> can build every field below **without loss of fidelity**.

## 1. Why this reference ships to every workspace

Claims are the atomic unit of governed knowledge in the Lattice. A workspace never
writes a claim directly. Instead it:

1. **Produces** memory artifacts under `docs/Planning/memory/` (PASO interaction records,
   summaries, facts, lessons).
2. **Sends** a signed, recall-only memory package to the Brain (see the Lattice
   Connector agent and governance skills).
3. The Brain **validates, policy-evaluates, enriches, and versions** each contribution
   into a full-fidelity claim.
4. The workspace later **recalls** eligible claims as citations
   (`{ sourceId, claimId, confidence? }`) via the query contract.

For the Brain to populate every field below, the workspace-side artifacts must carry the
provenance and retrieval metadata called out in **§4 Workspace responsibilities**.

## 2. Full-fidelity claim record

The canonical claim (`ImportedMemoryClaim`) is composed of six governed blocks.

| Block | Fields | Owner |
| --- | --- | --- |
| **Identity & content** | `id`, `claimText`, `entityType`, `confidence`, `authority` | Brain (id, authority); Workspace (claimText, entityType, confidence) |
| **Provenance** | `provenance.{ packageId, sourceWorkspace, sourceCommit, sourceFile, sourceRecordId, sourceRecordType, packageAttestationStatus, importedAt, importRunId }` | Workspace supplies source facts; Brain seals attestation & import fields |
| **Policy decision** | `policyDecision.{ decisionId, evaluatedAt, evaluator, outcome, policyLabels, allowedWorkspaces, allowedRoles, suppressionReason?, retentionClass, retrievalEligible, reviewerStatus }` | Brain |
| **Retrieval metadata** | `retrieval.{ topics, entities, customers, industries, organizations, peopleHashes, projectNames, decisionAreas, riskAreas, graphNodeIds, embeddingId? }` | Workspace supplies topics/entities; Brain enriches & embeds |
| **Lifecycle** | `lifecycle.{ state, version, supersededBy?, deprecatedAt?, deprecationReason?, lastReferenced?, freshnessScore? }` | Brain |
| **Audit** | `auditEventIds[]` | Brain |

### 2.1 Identity & content

- `id` — server-assigned stable claim identifier (the `claimId` used in citations).
- `claimText` — a single factual assertion (e.g., "Budget is $50K"), not a document.
- `entityType` — `decision | task | risk | architecture | insight | lesson | context |
  preference | constraint`.
- `confidence` — `0.0`–`1.0`.
- `authority` — always `recall-only` for imported memory. Recalled claims are grounding
  evidence, **never approval authority**.

### 2.2 Provenance (`ImportedClaimProvenance`)

Every claim must trace back to the exact workspace artifact that produced it:

- `packageId`, `sourceWorkspace`, `sourceCommit` — which package, workspace, and commit.
- `sourceFile`, `sourceRecordId`, `sourceRecordType` — the originating file and record.
  `sourceRecordType ∈ { summary | fact | lesson | interaction-record }`.
- `packageAttestationStatus` — `unsigned | signed | verified | rejected`. Only `verified`
  provenance is retrievable.
- `importedAt`, `importRunId` — when and in which run the Brain imported it.

### 2.3 Policy decision (`ImportedMemoryPolicyDecision`)

- `outcome` — `allow | suppress | reject | manual-review`.
- `policyLabels`, `allowedWorkspaces`, `allowedRoles` — access scoping.
- `retentionClass` — `standard | regulated | audit-only | pending-owner-approval`.
- `retrievalEligible`, `reviewerStatus` (`not-required | pending | approved | rejected`),
  `suppressionReason?`.

### 2.4 Retrieval metadata (`ImportedClaimRetrievalMetadata`)

Faceted index that drives recall: `topics`, `entities`, `customers`, `industries`,
`organizations`, `peopleHashes` (salted SHA-256 — never plaintext names), `projectNames`,
`decisionAreas`, `riskAreas`, `graphNodeIds`, and optional `embeddingId`.

### 2.5 Lifecycle (`ImportedClaimLifecycle`)

- `state` — `candidate | blocked | active | reinforced | superseded | stale | deprecated |
  disputed`. Only `active | reinforced | stale` are retrievable.
- `version`, `supersededBy?`, `deprecatedAt?`, `deprecationReason?`, `lastReferenced?`,
  `freshnessScore?`.

### 2.6 Audit (`auditEventIds`)

Every state transition emits an immutable server-side audit event
(`memory-claim-created`, `memory-claim-revised`, `memory-claim-lifecycle-transitioned`,
`memory-claim-superseded`, `memory-claim-deprecated`, `memory-retrieval-served`, …). The
workspace-local audit log is only an evidence index into these events.

## 3. What the workspace actually receives (consumer projection)

Recall never returns the full record. The query/recall contract returns an
`EvidenceEnvelope` of permission-trimmed citations:

```jsonc
{
  "citations": [
    { "sourceId": "…", "claimId": "…", "confidence": 0.0 }
  ],
  "auditId": "…",
  "correlationId": "…"
}
```

A claim is only served when it is `recall-only`, has complete `verified` provenance,
`policyDecision.outcome === 'allow'`, `retrievalEligible === true`, the caller's workspace
and role are allowed, the reviewer is cleared, and the lifecycle state is
`active | reinforced | stale`.

## 4. Workspace responsibilities (to preserve full fidelity)

So the Brain can construct every field in §2 **without loss**, workspace-authored memory
artifacts under `docs/Planning/memory/` should carry, per record:

- **Content**: a single assertion + `entityType` + `confidence`.
- **Provenance facts**: originating file path, record id, and record type
  (`summary | fact | lesson | interaction-record`). Commit, workspace, package, and
  attestation are added by the connector at send time.
- **Retrieval facets**: `topics` and `entities` at minimum; add `customers`, `industries`,
  `organizations`, `projectNames`, `decisionAreas`, `riskAreas` where known. Never emit
  plaintext personal names — the Brain hashes people into `peopleHashes`.

Fields owned by the Brain (`id`, policy decision, lifecycle, embeddings, audit) must **not**
be fabricated in workspace artifacts; supplying them is ignored and may fail validation.

## 5. Related references

- Query / recall / ingest contract: [agent-contract.openapi.yaml](./agent-contract.openapi.yaml)
- Declarative agent surface: [declarative-agent.json](./declarative-agent.json)
- Runtime client and recall/query contract types: `tools/lattice-client/src`
- Memory production spec: `docs/Planning/memory/agent-memory-collection-spec.md`
- Governed send/receive/recall workflows: `.github/skills/lattice-governance.md`
