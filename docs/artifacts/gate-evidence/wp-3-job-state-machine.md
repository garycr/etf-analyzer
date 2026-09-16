# WP-3 Closed Job State Machine Evidence

**Date:** 2026-09-16
**Scope:** PT-APP-001P exact Job enums and immutable transition policy
**Result:** PASS

## Executed Behavior

The application exports exactly two Job types (`FixtureIngestion`, `Analytics`), four statuses (`Pending`, `Running`, `Succeeded`, `Failed`), and two restartability policies (`Restartable`, `NotRestartable`). An exact state projection contains only `jobType`, `status`, `restartability`, and positive safe-integer `attempt`.

Owner transitions admit only `Pending -> Running`, `Pending -> Failed`, `Running -> Succeeded`, and `Running -> Failed`, preserving attempt. `JobRestart` alone admits `Failed -> Pending` for `Restartable`, incrementing attempt by exactly one. Every other transition fails without mutating the source. `Succeeded` is terminal.

Admission snapshots exact own enumerable data descriptors from an ordinary object without invoking getters. Inherited, accessor, proxy-failing, extra, capability-shaped, malformed-enum, unsafe-attempt, and overflowing values fail closed under a stable typed application error. Successful output is newly allocated, frozen, and limited to four validated primitives.

## Test-First Evidence

- Red: focused module load failed because the PT-P exports were absent.
- Initial green enumerated both Job types and all source/target statuses.
- Code Review red exposed an unsound generic intersection return type; emitted declaration validation proved the corrected post-transition type.
- Expanded matrix covers $2 \times 2 \times 4 \times 4 \times 2 = 128$ job-type, policy, source, target, and trigger vectors with identifying failure messages.
- Security Review red exposed inherited/accessor/proxy ambiguity and generic nested/extra field propagation; exact descriptor capture and primitive result construction close both findings.
- Adversarial vectors cover `Canceled`, unknown job type/restartability/target/trigger, zero, negative, fractional, `NaN`, infinite, unsafe, and overflowing attempts, extra checkpoint/capability fields, accessors with zero reads, inherited state, and throwing reflection.
- Focused build/test: 1/1 passed.
- Complete default suite: 317 discovered, 287 passed, 30 PostgreSQL environment skips, zero failed.
- TypeScript lint, changed-file diagnostics, dependency audit, and `git diff --check`: PASS.

## Review

Alternate-model Code Review returned final PASS with no Critical/Major/Minor finding and test quality 4.63/5. Alternate-model Security Review returned final PASS with no open finding after closing its initial High and Medium.

This closes PT-APP-001P only. Full Job persistence, checkpoint continuity, committed-effect deduplication, and restart transactions remain with owning PostgreSQL paths. No cancellation, API, broker, provider, event, outbox, queue, scheduler, worker, delayed consumer, WP-4, release, deployment, or production authority is introduced. Aggregate WP-3 closure still requires package-level evidence and review.
