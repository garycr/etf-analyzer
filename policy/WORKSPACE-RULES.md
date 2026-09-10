# Workspace Rules

This repository uses a hybrid workspace + agent architecture.

## Security
- Never commit secrets. Use environment variables or Key Vault.
- Commit only `*.example` variants of config files.

## Decision Traceability
- Every significant decision must capture four pillars: **Decision**, **Policy**, **Authority**, **Accountability**.
- The **Architect** is the primary custodian of the decision log.
- Canonical decision record: `docs/Governance/decisions/decision-log.md`.
- Framework: `.github/skills/decision-traceability.md`.
- Scope changes, risk acceptances, and policy exceptions MUST be logged.

## Risk Management
- All risks scored quantitatively: Probability (1–5) × Impact (1–5). See `.github/skills/risk-management.md`.
- Risk register: `docs/Planning/risk-register.md` (Tier 2+).
- Escalation: 🟢 Low → Team Lead; 🟡 Medium → PM; 🟠 High → PM + Architect; 🔴 Critical → PX immediately.
- Risk acceptances are traceable decisions (DEC-NNN in decision log).

## Architecture Review
- All significant architecture decisions MUST undergo review per `.github/skills/architecture-review.md`.
- Review dimensions: scalability, maintainability, security, performance, reliability, cost.
- Architecture alignment is a gate criterion at every ring transition.

## CI/CD
- Every repository MUST have a CI/CD pipeline. See `.github/skills/ci-cd.md` for tier requirements.
- No code merges without a passing CI pipeline.
- Pipeline must include: build, test, lint, and security scan.

## Code Review
- Every code change MUST be reviewed before merge. See `.github/skills/code-review.md` for tier requirements.
- Tier 1: self-review with checklist. Tier 2+: peer review with branch policies.
- Review must cover: correctness, security, performance, testing, and maintainability.
- Use severity labels (CRITICAL / MAJOR / MINOR / NIT) on all review comments.

## Decision Review
- Every design decision MUST be reviewed by a matching reviewer agent on an alternate model. See `.github/skills/decision-review.md`.
- Architecture decisions → Architect Reviewer. Plans → Plan Reviewer. Code designs → Code Reviewer.
- Improvements create GitHub Issues, require user approval, and are remediated in Ring 1.

## Monitoring
- Every application MUST implement observability per `.github/skills/monitoring.md`.
- Three pillars required: **metrics**, **logs**, **traces**.
- The Four Golden Signals (latency, traffic, errors, saturation) MUST be tracked for production services.
- Tier 1: structured logging and basic health checks.
- Tier 2+: SLIs/SLOs defined, alerting strategy documented, distributed tracing for multi-service.
- Tier 3: full observability suite, SLA monitoring, performance dashboards, incident response runbooks.
- Monitoring readiness is a gate criterion at Ring 4 → Ring 5.

## Accessibility (MANDATORY — All Tiers)
- Every user-facing feature MUST be WCAG 2.1 Level AA compliant.
- All interactive elements MUST be keyboard accessible (Tab + Enter navigation).
- All non-text content MUST have descriptive alternatives (alt text, ARIA labels).
- Color MUST NOT be the sole means of conveying information.
- Error messages MUST explain how to fix the problem.
- Accessibility compliance is a gate criterion at Ring 3 IV&V.

## Open Source & Dependency Review
- Every new dependency MUST pass a license and vulnerability check before commit. See `.github/skills/oss-review.md`.
- Ring 3 IV&V gate requires a full OSS review — CRITICAL/MAJOR findings block the gate.
- Blocked licenses: GPL/AGPL (in non-copyleft projects), no-license packages — agent MUST STOP and escalate.
- Allowed: MIT, Apache-2.0, BSD, ISC, Unlicense. Weak copyleft (LGPL, MPL) requires human review.

## AI FinOps
- Every significant AI agent invocation MUST surface an estimated token cost before execution. See `.github/skills/finops.md`.
- 🔴 High-cost paths (> $0.50 per invocation) require human approval before execution.
- Expensive patterns (large context windows, uncached RAG calls, over-powered models) MUST be flagged.
- Budget envelopes are hard limits — 100% consumed = HARD STOP until human extends budget.
- Model Selector MUST include cost tier in model assignments; Premium models require justification.

## AI / Agents
- Project-scoped rules: `.github/copilot-instructions.md`
- Task prompts: `.github/prompts/`
- Propose plans before sweeping changes.
