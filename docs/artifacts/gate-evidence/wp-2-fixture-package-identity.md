# WP-2 Fixture Package Identity Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001A deterministic local package identity
**Result:** PASS for the reviewed increment

## Executed Behavior

The application package boundary accepts raw manifest and governed file bytes. It requires fatal UTF-8 decoding, valid JSON, canonical manifest encoding, an exact descriptor/file path set, exact byte lengths, and SHA-256 digests computed from the supplied bytes. It removes only `datasetHash`, adds domain `etf.fixture.dataset.v1`, canonicalizes the result, and recomputes the dataset digest.

The candidate.2 golden package reproduces dataset hash `5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68`. A governed-byte mutation with stale metadata returns `FIXTURE_FILE_INTEGRITY_FAILED`. A self-consistent mutation that updates the file descriptor and dataset digest while retaining `etf-prototype-core` version `2026.01.0` returns `FIXTURE_IDEMPOTENCY_CONFLICT`.

Fresh PostgreSQL 16.15 repository validation passed 102/102. Build, lint, `npm audit --audit-level=low`, editor diagnostics, and `git diff --check` passed. REV-045 records Code Reviewer PASS with no remaining finding.

## Boundary

No file is read from disk by path, no network or provider connection exists, and no database mutation occurs in this increment. PT-FIX-001B..O, complete JSONL/manifest validation, selection, data-quality suppression, restart coordination, provider-egress evidence, and WP-2 closure remain open. No legacy migration, WP-3 overlap, release, deployment, or production action is authorized.
