# ETF Analyzer

An **agent-enabled workspace** with built-in governance, ring lifecycle, and multi-tier team structures.

> **⚠️ Governance scaffold — not a compliance guarantee (RAI-O1).** This template provisions governance *structure* — agents, ring gates, decision logs, and review prompts — to help you run a disciplined process. It does **not**, on its own, guarantee that AI-assisted output is correct, safe, secure, or compliant. Scaffolded artifacts are only as reliable as the human review behind them: you remain accountable for validating every decision, gate approval, and release. Treat generated governance files as prompts for judgment, not evidence of it.

## Quick Start

1. Open in VS Code
2. Use the Agent Workspace sidebar
3. Follow the Ring development lifecycle (Ring-0 through Ring-5)

## Local Runtime

The supported runtime is local, fixture-only, and bound to `127.0.0.1`. PostgreSQL 16 must already contain the canonical eight migrations and a persisted readiness snapshot. Use a control connection with catalog-read access for startup attestation and a separate least-privilege `app_runtime` connection for requests.

1. Copy [config/local-runtime.example.json](config/local-runtime.example.json) to an operator-owned location and set `artifactRoot` to an absolute reviewed-artifact directory.
2. Place the approved fixture package under `fixturePackageDirectory`. It must contain `manifest.json` and every file declared by that manifest.
3. Place the analytics artifact at `analyticsArtifactPath`. Its closed JSON shape is `configurationHash`, `inputEvidenceIds`, and `databasePayload`.
4. Launch with the PostgreSQL connection string in the environment:

```bash
ETF_POSTGRES_CONTROL_URL='postgresql://control-role@...' \
ETF_POSTGRES_URL='postgresql://app_runtime@...' \
npm run start:local -- /path/to/local-runtime.json
```

The launcher prints the loopback URL after PostgreSQL, artifacts, and HTTP startup succeed. `SIGINT` or `SIGTERM` closes the HTTP server and then the database connection. Artifact paths must be relative to the canonical `artifactRoot`; traversal and symlink escapes are rejected.

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
