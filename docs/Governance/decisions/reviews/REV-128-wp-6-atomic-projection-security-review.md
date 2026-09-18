# REV-128 - WP-6 Atomic Projection Security Review

**Date:** 2026-09-18
**Reviewer:** Security Reviewer agent using GPT-5 mini, independent review
**Scope:** CT-LED-016 security-definer nesting, HMAC key failure, privilege fault injection, rollback, and key confidentiality
**Disposition:** PASS

## Findings

No Critical or High security defect remains. Projection, audit, commitment, and checkpoint writes share one PostgreSQL transaction with no autonomous side effect. Fixed security-definer search paths and `session_user` checks preserve runtime identity through nested owner calls. Missing keys fail closed without returning or logging key bytes.

The staged permission and key failures prove that provisional projection and audit rows do not survive nested failure. Snapshot equality covers projection rows, audit rows, audit commitments, and protected checkpoints; current publication identity is unchanged.

## Evidence

- PostgreSQL 16.15 UTF8/C/UTC complete suite: 421 passed, 0 failed, 0 skipped.
- Dependency audit: 0 vulnerabilities.
- REV-127 code review: PASS.

## Residual Risk

Future security-definer changes must not introduce autonomous database or external side effects, broaden runtime inheritance, or expose key bytes through diagnostics. Existing migration and review controls govern those risks.
