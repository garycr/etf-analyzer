# ETF Analyzer

An **agent-enabled workspace** with built-in governance, ring lifecycle, and multi-tier team structures.

> **⚠️ Governance scaffold — not a compliance guarantee (RAI-O1).** This template provisions governance *structure* — agents, ring gates, decision logs, and review prompts — to help you run a disciplined process. It does **not**, on its own, guarantee that AI-assisted output is correct, safe, secure, or compliant. Scaffolded artifacts are only as reliable as the human review behind them: you remain accountable for validating every decision, gate approval, and release. Treat generated governance files as prompts for judgment, not evidence of it.

## Quick Start

1. Open in VS Code
2. Use the Agent Workspace sidebar
3. Follow the Ring development lifecycle (Ring-0 through Ring-5)

## Structure

```
.github/agents/      — Agent personas
.github/prompts/     — Prompt templates
.github/skills/      — Skill definitions
docs/Architecture/   — ADRs, system diagrams
docs/artifacts/      — Structured output artifacts (all tiers)
docs/Planning/       — Program status, ring tracking
docs/Operations/     — Runbooks, CI-CD, release management
docs/Sessions/       — Session logs, transcripts
docs/Roadmap/        — Backlog, deliverable tracking
src/                 — Source code
specs/               — BDD feature files
tests/               — Unit and integration tests
```
