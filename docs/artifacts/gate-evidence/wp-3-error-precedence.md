# WP-3 Error Precedence Evidence

**Date:** 2026-09-16
**Scope:** PT-APP-001O numeric error precedence, deterministic ties, and live admission collision behavior
**Result:** PASS

## Executed Behavior

`selectControllingApplicationError` accepts a closed detected-candidate set. Application phases own ranks 10 through 80; owner candidates additionally require a positive safe published rank. Each phase admits only its closed code family, preventing callers from changing precedence by relabeling a code. The lowest phase rank controls, owner internal rank resolves owner collisions, and remaining ties sort by normalized `(operation, requestId, code)` using Unicode code-point order. Invalid or absent operation/request identity sorts as the empty string; public selected request identity is a verified UUID or null.

The live command-envelope path independently detects operation membership, common request closure/grammar, and local-user authorization. It invokes the selector once and throws a typed operation, request, or authorization error carrying the selected request identity. Selection occurs before application replay, readiness, payload admission, or owner dispatch, so rejected requests invoke no lower-priority callback or effect.

## Test-First Evidence

- Red: focused load failed because the selector export did not exist.
- All eleven feature vectors are supplied in reverse detection order and select the specified code and request identity.
- Adversarial red proved a code could initially counterfeit rank by using the wrong phase; closed phase/code sets now reject it.
- Invalid owner ranks, owner ranks on non-owner phases, unknown phases, unstable codes, and empty sets fail closed.
- Review red showed the selector was not integrated. The live-path test now proves unknown operation plus missing actor selects rank 10, malformed envelope plus unauthorized actor selects rank 20, and structurally valid unauthorized actor selects rank 30, with zero readiness/owner calls.
- PT-N malformed actor coverage was narrowed from valid unauthorized text to null so N retains grammar ownership and O owns authorization classification.
- Focused N/O build/test: 6/6 passed; focused O: 3/3 passed.
- Complete default suite: 316 discovered, 286 passed, 30 PostgreSQL environment skips, zero failed.
- TypeScript lint, changed-file diagnostics, dependency audit, and `git diff --check`: PASS.

## Review

Alternate-model Code Review returned final PASS with no findings and test quality 5/5 after the live admission bridge closed its Major and Minor. Alternate-model Security Review returned PASS with no blocking finding. The inherited local replay-map retention Low remains outside this selector change and is bounded from production claims.

This closes PT-APP-001O only. PT-APP-001P closed Job transitions, aggregate WP-3 closure, distributed replay persistence, WP-4, live providers, release, deployment, and production authority remain open.
