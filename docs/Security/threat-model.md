# Threat Model

> Defines trust boundaries, threat actors, and attack surfaces for this project.
> Required for Ring-3 gate review — security assessment must include STRIDE analysis and trust boundaries.
> See `.github/skills/continuous-trust.md` for the continuous trust framework.

**Last Updated:** 2026-09-10
**Reviewed By:** [Security Reviewer]

## Trust Boundaries

> Identify where trust levels change in the system. Every data flow that crosses a trust boundary is a potential attack surface.

| ID | Boundary | From Zone | To Zone | Data Flows | Controls |
|----|----------|-----------|---------|------------|----------|
| TB-001 | [Boundary name] | [Untrusted/Semi-trusted/Trusted] | [Zone] | [What crosses] | [Auth/Encryption/Validation] |

## Threat Actors

| Actor | Motivation | Capability | Target |
|-------|-----------|------------|--------|
| External attacker | Data theft, disruption | Moderate | Public APIs, auth |
| Insider threat | Data exfiltration | High | Internal services, data stores |
| Automated bot | Resource abuse, credential stuffing | Low–Moderate | Auth endpoints |

## STRIDE Analysis

### Spoofing

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| [Component] | [Spoofing threat] | [H/M/L] | [H/M/L] | [Mitigation] | [Open/Mitigated] |

### Tampering

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| [Component] | [Tampering threat] | [H/M/L] | [H/M/L] | [Mitigation] | [Open/Mitigated] |

### Repudiation

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| [Component] | [Repudiation threat] | [H/M/L] | [H/M/L] | [Mitigation] | [Open/Mitigated] |

### Information Disclosure

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| [Component] | [Information disclosure threat] | [H/M/L] | [H/M/L] | [Mitigation] | [Open/Mitigated] |

### Denial of Service

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| [Component] | [DoS threat] | [H/M/L] | [H/M/L] | [Mitigation] | [Open/Mitigated] |

### Elevation of Privilege

| Asset | Threat | Likelihood | Impact | Mitigation | Status |
|-------|--------|-----------|--------|------------|--------|
| [Component] | [EoP threat] | [H/M/L] | [H/M/L] | [Mitigation] | [Open/Mitigated] |

## Risk Summary

| STRIDE Category | Threats Identified | Mitigated | Open | Accepted |
|----------------|-------------------|-----------|------|----------|
| Spoofing | 0 | 0 | 0 | 0 |
| Tampering | 0 | 0 | 0 | 0 |
| Repudiation | 0 | 0 | 0 | 0 |
| Information Disclosure | 0 | 0 | 0 | 0 |
| Denial of Service | 0 | 0 | 0 | 0 |
| Elevation of Privilege | 0 | 0 | 0 | 0 |
