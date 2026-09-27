# ADR-005 - CI Runtime Identities

**Status:** Accepted by DEC-098; REV-210, REV-211, and REV-212 PASS
**Date:** 2026-09-26
**Decision owner:** Agent under Fully Agentic mode
**Accountable custodian:** Solo Orchestrator
**Related:** DEC-095; issue #90; RH-015

## Context

The CI workflow selected `ubuntu-latest` and Node major version `20`. Both selectors can change without a repository commit, so successful candidate evidence did not establish a repeatable release-grade runtime identity.

GitHub-hosted runner virtual machines are managed images rather than digest-addressable artifacts. The repository can govern the runner generation, verify the observed operating-system release, and pin application tool runtimes and container images independently.

## Decision

- Select the explicit `ubuntu-24.04` hosted-runner generation for every CI job and reject `ubuntu-latest` in a repository contract test.
- Verify `/etc/os-release` reports `VERSION_ID=24.04` before each job performs governed work.
- Pin Node to `20.20.2` in `.node-version` and every npm-executing CI job, including the digest-pinned Playwright container.
- Verify `node --version` reports `v20.20.2` before dependency installation or project commands.
- Retain SHA-pinned GitHub Actions and digest-pinned PostgreSQL and Playwright images as separate supply-chain controls.
- Keep CodeQL on its SHA-pinned action runtime; it does not install dependencies or execute project Node commands.

## Consequences

Runner generation changes and Node patch changes now require reviewed repository edits. A mismatch between a declared and observed operating system or Node version fails before project work begins. The Playwright image's bundled Node version is not trusted as the project runtime; `actions/setup-node` replaces it with the governed version.

GitHub can still update packages and the runner image revision within the `ubuntu-24.04` generation. This residual is accepted for the current hosted CI boundary because the operating-system generation and project runtime are asserted, actions and service containers remain immutable by SHA or digest, and exact-commit CI remains the publication authority.

## Invalidation

Revisit this decision if exact virtual-machine image revisions become required, GitHub changes label semantics, a runtime assertion fails, a job begins executing project Node commands without the governed setup, or release policy requires a fully digest-addressed build environment.

## Decision Boundary

This ADR governs candidate CI reproducibility only. It does not authorize release, promotion, deployment, production use, provider access, brokerage, public ingress, or durable handoff.
