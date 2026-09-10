# Customer Governance Overrides

Files in this directory provide **customer-wide** governance that applies
across all workspaces for this customer. They are imported once (during
workspace init or via "Import Customer Package") and are never overwritten
by template governance sync.

## Directory Structure

| Path | Purpose |
|------|---------|
| `constitution.md` | Authoritative customer governance document |
| `content.md` | Framework reference index (SCF, CSMC, MEC, CPF, etc.) |
| `rules/` | Rule files injected into `copilot-instructions.md` |
| `skills/` | Customer-specific skills (override template skills) |
| `agents/` | Customer-specific agents (override template agents) |
| `prompts/` | Customer-specific prompts (override template prompts) |

## Rules

Files in `rules/` are automatically read during governance sync and
injected as a `## Customer Rules` section in `copilot-instructions.md`.

Recommended rule files:

| File | Content |
|------|---------|
| `security-controls.md` | SCF/MEC controls, encryption mandates, SIEM requirements |
| `deployment-rules.md` | CI/CD standards, branch protection, pipeline rules |
| `operational-guidance.md` | Run obligations, incident management, BCDR testing |
| `service-management.md` | CMDB integration, access reviews, cost reporting |
| `software-dev-standards.md` | Commit conventions, versioning, artifact signing |
| `development-rules.md` | R-Type treatment rules, CPF module selection process |

## Merge Order

```
Template defaults (.github/skills/)  ← VSIX bundle
  ↓ overwritten by
Customer overrides (.github/customer/skills/)
  ↓ overwritten by
Project overrides (.github/project/skills/)
```
