# Artifacts

> Structured output folder for all deliverables produced throughout the ring lifecycle.
> Available in all tiers. Populated progressively as work flows through Ring 0–5.

## Folder Structure

| Folder | Ring | Contents |
|--------|------|----------|
| `01-Requirements/` | 0 | Gherkin features, objective docs, narrative, RTM |
| `02-Architecture/` | 0–1 | Architecture diagrams (Mermaid), ADRs, ZT roadmap, NFRs |
| `03-Security/` | 0–3 | STRIDE threat model, Sentinel detection rules |
| `04-Infrastructure/` | 1–2 | Bicep templates, CA/Azure policies, migration manifests |
| `05-Source/` | 2 | Domain models, application services, infrastructure code |
| `06-Tests/` | 2–3 | Unit tests, integration tests |
| `07-Planning/` | 0–1 | Brainstorm proposals, decompositions, IMS, WBS, task checklists |
| `08-Governance/` | 0–5 | Decision log, reasoning transcript, audits, RAI reports |
| `09-Operations/` | 4–5 | FinOps config, enabler protocols, runbooks |
| `10-Quality/` | 3 | Code review reports |
| `11-CICD/` | 2–4 | GitHub Actions pipeline |
| `12-Retrospective/` | 5 | Full retrospective, severity bar assessment |

## Usage

Agents and team leads produce artifacts into the appropriate subfolder as they
complete work packages. The folder numbering maps to the approximate ring where
each category is first populated, but artifacts may be updated across multiple rings.

## Relationship to Other Docs Folders

- `docs/Architecture/` — canonical ADRs and architecture models (also mirrored to `02-Architecture/`)
- `docs/Planning/` — program status, ring tracking, work logs (also mirrored to `07-Planning/`)
- `docs/Governance/` — decision log, reasoning ledger (also mirrored to `08-Governance/`)

The `artifacts/` folder provides a **deliverable-oriented view** organized by category,
complementing the existing **process-oriented** folders.
