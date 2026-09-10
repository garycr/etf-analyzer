# Project Overrides

Files in this directory provide **project-specific** governance that
applies only to this workspace. They take highest precedence in the
merge order — project overrides win over both template and customer.

## Directory Structure

| Path | Purpose |
|------|---------|
| `manifest.md` | Project manifest — app identity, specs, source docs |
| `rules/` | Project-specific rules injected into `copilot-instructions.md` |
| `skills/` | Project-specific skills (override template + customer) |
| `agents/` | Project-specific agents |
| `prompts/` | Project-specific prompts |
| `artifacts/` | Bespoke artifact templates for this project |

## Rules

Files in `rules/` are injected as a `## Project Rules` section in
`copilot-instructions.md` during governance sync, after customer rules.
