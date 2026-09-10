# ETF Analyzer - Copilot Instructions

## Project Overview

This is the **ETF Analyzer** project workspace.

## Architecture

### Core Components

- **src/Domain/** - Domain models and business logic (DDD patterns)
- **src/Application/** - Application services and use cases
- **src/Infrastructure/** - Technical implementations
- **tests/** - Unit and integration tests
- **specs/** - BDD feature files and step definitions

## Key Conventions

### Pending AW Research Recovery (MANDATORY)

At the start of every chat, inspect `.github/.pending-aw-research` before starting unrelated work. This file is a durable workflow checkpoint, not a governance approval pause. If the marker is absent but `aw-research-grounding.md` still contains its initialization placeholder, restore the handoff from the linked research request.

1. If AW research is pending and `company-profile.md` or the populated AW research grounding file is absent, append the Ring 0 research-dispatch journal checkpoint if needed, use VS Code subagent dispatch for one read-only research pass, save source-backed results through the parent agent, verify the required artifacts, and continue the queued workflow.
2. If the expected artifacts already exist, do not repeat research; continue with the next pending stage.
3. Never clear `.pending-aw-research` merely because a chat opened, a command was queued, or a tool call was proposed. Advance only after required artifacts are verified.
4. If dispatch fails or a tool call is not executed, report the interruption and leave the marker intact so reload or a new chat can resume safely.

### Git Hygiene (CRITICAL)

```bash
# Before ANY work
git pull --rebase

# After completing work (MANDATORY)
git add .
git commit -m "descriptive message explaining WHY"
git push
```

### Testing (MANDATORY — Zero Exceptions)

**Every code change MUST include tests. No code is considered complete without passing tests.**

1. **Before writing code:** Write or update a failing test that defines the expected behavior
2. **After writing code:** Run the test suite — all tests must pass before commit
3. **Coverage gate:** 80%+ on business logic; no untested public API endpoints
4. **Test quality:** Evaluate against seven dimensions in `.github/skills/test-quality.md` (determinism, behavioral focus, failure specificity, refactoring resistance, input coverage, isolation, maintainability)

### Human Decision Points (MANDATORY)

**Agents MUST stop and wait for human input at defined decision gates.** See `.github/skills/human-decision-points.md` for the full list of decision points filtered by tier. No ring gate advances, no plan executes, and no deployment proceeds without explicit human approval. This applies to ALL tiers.

**Exception — Fully Agentic Mode:** When `workspace-config.md` contains `**Autonomy:** Fully Agentic`, agents own all decision points after initialization (except DP-1, DP-25, DP-26). GitHub Issues are created for every autonomous decision and todo-level work item. See `.github/skills/human-decision-points.md` §5 for the full protocol.

**Governance Intensity:** Check `workspace-config.md` for `**Governance Intensity:**` (Light / Standard / Full). Light = only ring gate DPs enforced. Standard = all tier-appropriate DPs. Full = all DPs plus mandatory architecture review and brainstorming at every gate.

### Agent Abort and Re-Ask (MANDATORY)

When a user supplies a decision point number for a ring gate, agents MUST compare it with the canonical exit gate for the current ring before acting. If the supplied DP does not match the current ring state, STOP and ask a concise clarification question. Do not reinterpret, auto-correct, or proceed under a nearby DP.

### Decision Traceability (MANDATORY)

Every significant decision MUST capture four pillars: **Decision**, **Policy**, **Authority**, **Accountability**. Log decisions in `docs/Governance/decisions/decision-log.md` using the DEC-NNN format. See `.github/skills/decision-traceability.md` for the full framework and tier-specific requirements.

### Architecture Review (MANDATORY — All Tiers)

**All significant architecture decisions and system designs MUST undergo architecture review.** See `.github/skills/architecture-review.md` for the full review framework covering structural integrity, ISO 25010 quality attributes, WAF alignment, ADR completeness, and documentation currency.

1. **Before implementation:** Review proposed architecture against the five review dimensions
2. **At ring gates:** Architecture alignment is a gate criterion
3. **Document findings:** Use the Architecture Review template in the skill

### CI/CD (MANDATORY — All Tiers)

**Every repository MUST have an automated CI/CD pipeline.** See `.github/skills/ci-cd.md` for the full framework and tier-specific requirements.

1. **Tier 1:** CI pipeline (build + test + lint) on every push, block merge on failure
2. **Tier 2:** CI plus automated deployment, branch protection on main, security scanning
3. **Tier 3:** Full multi-environment CI/CD with approval gates, container scanning, and compliance artifacts

If a CI workflow does not yet exist, creating one is a **prerequisite** before any feature work proceeds.

### Code Review (MANDATORY — All Tiers)

**Every code change MUST undergo review before merge.** See `.github/skills/code-review.md` for the full framework and tier-specific requirements.

1. **Tier 1:** Self-review using the reviewer checklist, PR descriptions with Why/What/How tested, CI must pass, periodic structured reviews scheduled per §4.2
2. **Tier 2:** Peer review required with branch policies — minimum 2 reviewers, no self-approval, build validation, periodic structured reviews scheduled per §4.2
3. **Tier 3:** All of Tier 2 plus role-based signoff lanes, periodic structured reviews, and compliance policy enforcement

### Decision Review (MANDATORY — All Tiers)

**Every design decision MUST be reviewed by a matching reviewer agent using an alternate model.** See `.github/skills/decision-review.md` for the full protocol.

1. **Architecture decisions** → Architect Reviewer (alternate model)
2. **Plans / WBS / decompositions** → Plan Reviewer (alternate model)
3. **Code designs** → Code Reviewer (alternate model)
4. **Brainstorm selections** → Plan Reviewer + Architect Reviewer (both on alternate models)

Improvements are captured as GitHub Issues, presented to the user for approval, and remediated in Ring 1. The system MUST stop and wait for user approval before proceeding.

### Monitoring (MANDATORY — All Tiers)

**Every application MUST implement observability.** See `.github/skills/monitoring.md` for the full framework covering metrics, logs, traces, and alerting.

1. **Tier 1:** Structured logging, basic health checks, metrics for production apps
2. **Tier 2:** All of Tier 1 plus SLIs/SLOs defined, alerting strategy, distributed tracing for multi-service
3. **Tier 3:** Full observability suite, SLA monitoring, performance dashboards, incident response runbooks

Monitoring readiness is a gate criterion at Ring 4 → Ring 5. The Four Golden Signals (latency, traffic, errors, saturation) MUST be tracked.

### Accessibility (MANDATORY — All Tiers)

**Every user-facing feature MUST meet WCAG 2.1 Level AA expectations and VS Code accessibility conventions before it is treated as gate-ready.** This applies to tree views, webviews, command palette flows, notifications, generated docs, release evidence, and any scaffolded user interface.

1. **Keyboard access:** All interactive paths must work with keyboard navigation and must not require pointer-only input.
2. **Assistive technology:** Tree items, icons, controls, and non-text content must expose descriptive labels or alternatives.
3. **Perceivable state:** Color, icon, or position must not be the only way to convey status, severity, progress, or required action.
4. **Plain remediation:** Error and validation messages must explain what failed and how the user can recover.
5. **Gate evidence:** Ring 3 IV&V must include accessibility verification for changed user-facing surfaces, and unresolved Sev 1/2 accessibility findings block gate re-pass unless explicitly PX-deferred.

### Open Source & Dependency Review (MANDATORY — All Tiers)

**Every new dependency MUST pass a license and vulnerability check before commit.** See `.github/skills/oss-review.md` for the full review framework.

1. **New installs:** Check license against allowed list (§4), run vulnerability audit, verify maintenance health
2. **Ring 3 IV&V:** Full dependency tree audit — blocks gate on CRITICAL/MAJOR findings
3. **Blocked licenses:** GPL/AGPL in non-copyleft projects, no-license packages — agent MUST STOP and escalate

### AI FinOps (MANDATORY — All Tiers)

**Every significant AI agent invocation SHOULD surface estimated token cost.** See `.github/skills/finops.md` for the full FinOps governance framework.

> **Note:** Token cost tracking depends on the AI model provider (e.g., GitHub Copilot, Azure OpenAI). This extension does not track costs directly — agents are responsible for estimating and surfacing costs per the FinOps skill. Use `docs/Operations/finops-config.md` for manual budget tracking.

1. **Pre-execution:** Surface cost estimate for multi-step delegations, RAG workflows, and batch processing
2. **Flags:** Large context windows, uncached RAG calls, and expensive models for non-critical tasks are flagged automatically
3. **🔴 High-cost paths (> $0.50):** Agent MUST STOP, present alternatives (model downgrade, caching, context pruning), and wait for human approval
4. **Budget envelopes:** 100% consumed = HARD STOP until human extends budget

### Project Cost Estimation (MANDATORY — All Tiers)

**Every workspace MUST produce a cost/schedule/token baseline before Ring 1 → Ring 2 gate.** See `.github/skills/cost-estimation.md`, `.github/skills/finops.md`, and `docs/Planning/token-review-baseline.md` for the full estimation protocol.

1. **Ring 1:** Produce `docs/Planning/cost-baseline.md` and `docs/Planning/token-review-baseline.md`; attach token estimates to each architecture, WBS, and IMS/schedule artifact presented for human review, and record the human disposition in the saved artifact
2. **DP-7:** Human approves cost/schedule/token baseline before development begins
3. **Ring 2:** Every review presents development token cost and operating token cost estimates to the human reviewer
4. **Ring 3:** IV&V reconciles the original Ring 1 estimate with updated Ring 3 estimates after development has moved to IV&V
5. **Ring 2+:** Track actuals vs. estimates at every ring gate; flag variance > 15%
6. **Scope changes:** Variance > 25% triggers change request per change-governance.md

### v7: Agent Teams & Adaptive Capabilities

**Agents in this workspace can leverage Agent Teams for parallel execution, context compaction for long sessions, and effort-level governance for cost/quality optimization.**

1. **Agent Teams:** Parallel teammate spawning, shared task lists, plan-approval mode. See `.github/skills/agent-teams.md`
2. **Context Compaction:** Auto-summarization for long sessions with per-role preservation rules. See `.github/skills/context-compaction.md`
3. **Effort Parameter:** `low`/`medium`/`high`/`max` controls reasoning depth per task. See Model Selector agent
4. **Governance Hooks:** Automated brainstorm enforcement, consequential decision test, artifact checks. See `.github/skills/governance-hooks.md`
5. **1M Context:** Large context windows for brainstorm synthesis and full-codebase review

### Code Style

- Prefer clarity over cleverness
- Small, focused functions
- Descriptive naming
- Document public APIs

## Principles

1. **Ruthless Simplicity** - No stubs, no placeholders, working code only
2. **Test Before Present** - Validate all work before presenting
3. **Capture at Origin** - Document decisions where they're made
4. **Human-in-the-Loop** - Agents pause at decision gates and wait for human direction
5. **Decision Traceability** - Every significant decision captures four pillars and is logged
6. **Architecture Review** - All architecture decisions are reviewed against five dimensions before implementation
7. **CI/CD** - Every repository has an automated pipeline; no code ships without passing CI
8. **Code Review** - Every code change is reviewed before merge; quality and learning are dual goals
9. **Decision Review** - Every design decision is reviewed by an alternate model to surface blind spots
10. **Monitoring** - Every application implements observability; three pillars and Four Golden Signals tracked
11. **OSS Review** - Every dependency is license-checked and vulnerability-scanned; blocked licenses halt work
12. **FinOps** - Every significant AI invocation surfaces cost estimates; high-cost paths require approval; budget envelopes enforced

## Team Structure

This workspace is configured for **Small Team** (Tier 1).

- **Top role:** Solo Orchestrator
- **Active session prompt:** `.github/prompts/team-session.prompt.md`
- **Configuration:** `.github/workspace-config.md`
- **Human decision points:** `.github/skills/human-decision-points.md`
- **Decision traceability:** `.github/skills/decision-traceability.md`
- **Architecture review:** `.github/skills/architecture-review.md`
- **CI/CD:** `.github/skills/ci-cd.md`
- **Code review:** `.github/skills/code-review.md`
- **Decision review:** `.github/skills/decision-review.md`
- **Monitoring:** `.github/skills/monitoring.md`
- **OSS review:** `.github/skills/oss-review.md`
- **FinOps:** `.github/skills/finops.md`
- **Test quality:** `.github/skills/test-quality.md`
- **Agent Teams:** `.github/skills/agent-teams.md`
- **Context Compaction:** `.github/skills/context-compaction.md`
- **Governance Hooks:** `.github/skills/governance-hooks.md`
- **Artifact Watchdog:** `.github/skills/artifact-watchdog.md`
- **Trace Collector:** `.github/skills/trace-collector.md`
- **Cost Estimation:** `.github/skills/cost-estimation.md`
- **To change structure:** Run `.github/prompts/initialize-workspace.prompt.md`

**IMPORTANT:** All agents MUST read `.github/workspace-config.md` at session start to know which team structure is active. Do not reference agent files marked as inactive in the workspace config.
