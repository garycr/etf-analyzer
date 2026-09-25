# Ring 3 Performance Test Report

**Date:** 2026-09-25  
**Evidence:** PT-OPS-001 and CI run 36168279046  
**Status:** PASS for the local prototype

## Results

| Signal | Executed control | Result |
| --- | --- | --- |
| API latency | 25 live loopback readiness requests; nearest-rank p95 below 1,000 ms | PASS |
| Dashboard latency | 25 live document requests; nearest-rank p95 below 2,000 ms | PASS |
| Traffic | Exact replay/publication/package/job/transition/order counts `4/1/1/2/2/1` | PASS |
| Errors | Observed API/dashboard responses at status 500 or above | 0; PASS |
| Evidence capacity | Managed bytes below 80% of configured capacity | PASS |
| Database saturation | Live ETF connections below PostgreSQL maximum | PASS |
| CPU and memory | Process CPU interval and RSS recorded | Informational; no invented threshold |

The evaluator also proves zero evidence hash mismatches, zero reconciliation differences, zero unresolved intents, and zero queue/outbox objects. Readiness transitioned from NotReady to Ready in the same running service with bounded recovery guidance and credential redaction.

No load, soak, horizontal-scale, or internet-latency claim is made. The implemented candidate is a local single-user prototype. Broader performance qualification requires a new boundary, workload model, and gate decision.
