# Immutable FIFO Ledger and Reconciliation Contract

**Contract version:** `1.0.0-candidate.2`
**Baseline target:** `v1.0.0`
**Status:** Candidate - Team Lead and specialist rechecks PASS; final architecture recheck pending
**Custodian:** Team Lead
**Source issues:** GitHub #20 and #9
**Precision authority:** DEC-014 Option A
**Architecture status:** Proposed; this coordination contract does not accept an ADR

## Scope

This contract defines the authoritative hypothetical portfolio ledger, immutable corrections, FIFO lot matching, canonical decimal arithmetic, rebuild behavior, and exact reconciliation. Rate/ratio values are governed here only as shared quantizer policy; producing return or ratio analytics is outside this ledger scope. It does not create brokerage, external account, tax, multi-currency, margin, shorting, or real-execution semantics.

## Canonical Numeric Classes

| Class | PostgreSQL type | Canonical string | Use |
| --- | --- | --- | --- |
| Quantity and unit value | `NUMERIC(28,10)` | `-?(0|[1-9][0-9]*)\.[0-9]{10}` | Fill quantity, open lot quantity, position quantity, unit price, unit cost, NAV |
| Money | `NUMERIC(28,8)` | `-?(0|[1-9][0-9]*)\.[0-9]{8}` | Cash, fees, basis, proceeds, realized P&L, valuation, cached monetary projections |
| Rate/ratio | `NUMERIC(28,12)` | `-?(0|[1-9][0-9]*)\.[0-9]{12}` | Returns, ratios, allocation weights |

Accepted external decimal text uses `-?(0|[1-9][0-9]*)(\.[0-9]+)?`, with no exponent, leading plus, or whitespace. Fewer fractional digits than the destination scale are valid and canonicalize by appending zeros. Negative zero is valid input and canonicalizes to positive zero. Excess scale, non-finite tokens, binary floating values, and values outside DEC-014 workload bounds fail before persistence. TypeScript `number`, Python `float`, and binary floating-point database types are prohibited for these values.

Higher-scale derived results use signed arbitrary-precision integer coefficients. They quantize once to the destination class with decimal round-half-even using the DEC-014 quotient/remainder algorithm. Canonical zero is positive and strings retain exactly the destination scale.

Validation precedence is deterministic and uses these numeric ranks: 10 invalid envelope/identity or decimal type/grammar (`LEDGER_INVALID_DECIMAL`); 20 excess scale (`LEDGER_EXCESS_SCALE`); 30 workload/column bound (`LEDGER_BOUND_EXCEEDED`); 40 idempotency lookup (return an equivalent prior result or fail different content with `LEDGER_IDEMPOTENCY_CONFLICT`); 50 optimistic order/portfolio concurrency (`ORDER_VERSION_CONFLICT` or `LEDGER_VERSION_CONFLICT`); 60 portfolio business and reversal invariants; 70 reconciliation/FIFO integrity. One request returns the first applicable failure. Batch failures sort by `(precedenceRank, portfolioId, transactionId, effectOrdinal)` rather than textual code.

## Ledger Records

### Transaction

Each immutable transaction records:

- `transactionId`, `portfolioId`, globally monotonic `ledgerSequence`, `effectiveAt` UTC, `recordedAt` UTC;
- type: `CashDeposit`, `CashWithdrawal`, `BuyFill`, `SellFill`, or `Reversal`;
- `orderId` and `fillId` when the source is a simulated fill;
- `correlationId`, `transitionCommandId` where applicable, `precisionPolicyVersion`, and `baselineVersion`;
- canonical effect lines and an immutable evidence hash; and
- `reversesTransactionId` only for a `Reversal`.

No transaction, effect, lot-allocation, original lot, reversal-link, audit, or integrity-anchor row may be updated or deleted. `transactionId` is unique within `portfolioId`; `ledgerSequence`, hashes, reversal references, and all composite identities are database-constrained as specified. A transaction and all its effect/lot-allocation rows persist atomically.

`(portfolioId, transactionId)` is the ledger idempotency identity. Idempotency lookup occurs after canonical syntax/scale/bound validation but before version and business validation. Equivalent request content is the canonical serialization of `type`, `effectiveAt`, `orderId`, `fillId`, `correlationId`, `transitionCommandId`, `precisionPolicyVersion`, `baselineVersion`, `reversesTransactionId`, and requested effect lines ordered by `effectOrdinal`. Generated `ledgerSequence`, `recordedAt`, hashes, `expectedPortfolioVersion`, and `expectedOrderVersion` are excluded. Equivalent content returns the original result without rechecking stale expected versions or mutating state; different content with that identity fails with `LEDGER_IDEMPOTENCY_CONFLICT`.

Each portfolio carries a monotonic `portfolioVersion`. Every ledger command supplies `expectedPortfolioVersion`; fill-producing OT-05, OT-06, and OT-09 commands also supply the lifecycle `expectedOrderVersion`. In one PostgreSQL transaction, the order and portfolio rows are locked or conditionally updated, both expected versions are compared, both `(orderId, transitionCommandId)` and `(portfolioId, transactionId)` are deduplicated, cash/position/reversal invariants are evaluated, and the order transition, fill, ledger transaction, effects, allocations, audit evidence, and incremented order/portfolio versions commit together. A stale portfolio version fails with `LEDGER_VERSION_CONFLICT`; a stale order version fails with `ORDER_VERSION_CONFLICT`. No transaction can commit only one side. Thus two orders cannot concurrently spend the same cash or consume the same lot.

### Canonical Effect and Hash Contract

Each effect line has `(transactionId, effectOrdinal)` identity, where ordinal is a unique zero-based integer contiguous within the transaction. Its fixed fields are `effectType`, `instrumentId` (nullable), `lotId` (nullable), `sourceEffectId` (nullable), `quantity` (nullable canonical quantity string), `money` (nullable canonical money string), and `rate` (nullable canonical rate string).

The evidence hash is SHA-256 over UTF-8 RFC 8785 canonical JSON with this exact top-level schema: `baselineVersion`, `correlationId`, `effectiveAt`, `effects`, `fillId`, `ledgerSequence`, `orderId`, `portfolioId`, `precisionPolicyVersion`, `recordedAt`, `reversesTransactionId`, `transactionId`, and `type`. `effects` is an array sorted by `effectOrdinal`; every object contains exactly `effectOrdinal`, `effectType`, `instrumentId`, `lotId`, `money`, `quantity`, `rate`, and `sourceEffectId`. Null fields are included. Decimal values remain fixed-point JSON strings, UTC timestamps use normalized ISO 8601 `YYYY-MM-DDTHH:mm:ss.SSSZ`, and no runtime object/map iteration order is used. The digest is lowercase 64-character hexadecimal. TypeScript, Python, and PostgreSQL verification must hash identical bytes; choosing a library remains subject to OSS review.

Golden canonical UTF-8 fixture (no trailing newline):

```json
{"baselineVersion":"v1.0.0","correlationId":"corr-1","effectiveAt":"2026-09-10T12:00:00.000Z","effects":[{"effectOrdinal":0,"effectType":"Cash","instrumentId":null,"lotId":null,"money":"100.00000000","quantity":null,"rate":null,"sourceEffectId":null}],"fillId":null,"ledgerSequence":1,"orderId":null,"portfolioId":"portfolio-1","precisionPolicyVersion":"DEC-014","recordedAt":"2026-09-10T12:00:00.000Z","reversesTransactionId":null,"transactionId":"tx-1","type":"CashDeposit"}
```

Expected SHA-256: `e36056ee2d240bd513b0eef2ed4d8d6e7815a08d0882dc82a7e11e664188eb18`.

### Database Authority and Append-Only Enforcement

PostgreSQL access is deny-by-default. `PUBLIC` has no privileges on the application schema, tables, sequences, or writer functions. Schema/table, `ledger_writer_owner`, `projection_owner`, migration, `audit_writer_owner`, and `anchor_owner` are distinct `NOLOGIN` roles. `app_runtime`, `projection_runtime`, `audit_runtime`, `migration_executor`, and deployment-only `key_injector` are distinct `NOINHERIT` login roles. Runtime cannot inherit an owner role and has no direct `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `COPY`, sequence, trigger, DDL, ownership, or role-administration privilege on transactions, effects, lots, allocations, reversal links, projections, deduplication, audit, keys, or integrity tables. The controlled ledger, projection, and audit parent procedures are `SECURITY DEFINER`, owned respectively by `ledger_writer_owner`, `projection_owner`, and `audit_writer_owner`, and satisfy the hardening rules below. `app_runtime` executes only the controlled ledger procedure; `projection_runtime` executes only the controlled projection procedure; `audit_runtime` executes the controlled audit procedure for attempt, rejection, permission, integrity, timeout, and recovery outcomes. The audit procedure grants `EXECUTE` to `projection_owner` only for nested `BlockedPublication` or `PublicationCompleted`, enforced from the current function-owner identity and rejected before persistence for every other outcome. The anchor procedure grants `EXECUTE` only to `ledger_writer_owner` and `audit_writer_owner`, so nested same-transaction calls execute as non-login function owners without granting runtime roles direct audit/anchor execution or key/table access.

Controlled writers are owned by a non-login role, revoke execution from `PUBLIC`, use a fixed trusted `search_path`, fully qualify application objects, validate every parameter before cast or DML, and contain no caller-derived dynamic SQL. Database constraints and append-only guards reject update/delete/truncate for every immutable record class, including allocations and audit evidence. Migration authority is unavailable to the runtime, enabled only through the deployment identity, and every migration/direct-load attempt is audited. Corrections use new reversal records only.

### Complete Integrity and Audit Contract

The public transaction evidence hash above remains the portable transaction/effect digest. Each committed transaction also has deterministic RFC 8785 digests for its ordered allocation set and success audit record. A portfolio commitment contains exactly `portfolioId`, `ledgerSequence`, `transactionEvidenceHash`, `allocationEvidenceHash`, `auditEvidenceHash`, and `previousPortfolioCommitment`; absent allocations use the SHA-256 digest of canonical `[]`, and the first previous commitment is `null`. The commitment is chained in ledger-sequence order and authenticated with HMAC-SHA-256 by a separate `anchor_owner` `SECURITY DEFINER` procedure. The controlled ledger procedure invokes the anchor procedure inside the same PostgreSQL transaction as order, fill, transaction, effect, allocation, success-audit, deduplication, and version writes. Anchor failure rolls back the complete unit, so no orphan commitment or unanchored business transaction can commit.

The deployment-only `key_injector` supplies versioned key material from the deployment secret provider to an anchor-owner-only key store, then removes the mounted secret. Key material is unavailable to runtime, ledger-writer, projection, audit, and migration roles. Key identifiers, rotation continuity, and latest accepted portfolio anchors are stored separately from writer-owned ledger data. A checkpoint is the separately owned, protected record of the latest accepted sequence and its portfolio and audit anchors used for anti-rollback comparison. Choosing the secret provider or cryptographic library remains subject to architecture and OSS review.

Rebuild and reconciliation verify transaction, allocation, audit, chain, and keyed-anchor integrity before publishing projections. Missing, inserted, deleted, reordered, or changed immutable records; a broken predecessor; an unknown key identifier; or an unverifiable anchor fails closed with `LEDGER_INTEGRITY_FAILED`. Neither ledger writer nor projection writer can replace an accepted anchor or recompute an accepted HMAC.

Each append-only audit record contains `auditId`, `attemptIntentId`, `portfolioId`, `transactionId`, `ledgerSequence`, `action`, `outcome`, stable `errorCode` when applicable, `replayClassification`, `correlationId`, `transitionCommandId`, old/new order and portfolio versions, reversal lineage, authenticated actor subject when present, authenticated workload identity, source authentication-context digest, database-generated `recordedAt` UTC, and the three evidence hashes. `outcome` is one of `IntentRecorded`, `Committed`, `Rejected`, `IntegrityFailed`, `PermissionDenied`, `BlockedPublication`, `PublicationCompleted`, `TimeoutRecovery`, or `RecoveryCompleted`. Actor/workload identity and authentication context come from server-validated authentication state, never request-body fields; workload identity and timestamp are database-authoritative.

Before business processing, `audit_runtime` commits `IntentRecorded` through its controlled procedure. Success audit commits with the ledger transaction. Rejection and integrity outcomes append after rollback; PostgreSQL audit-log collection appends pre-procedure permission denials. An unresolved intent is not deleted or rewritten: a bounded collector appends `TimeoutRecovery` and later `RecoveryCompleted` when applicable. Each audit-only transaction creates an RFC 8785 digest over its ordered audit records and appends `(auditSequence, auditSegmentHash, previousAuditCommitment, keyIdentifier)` to a separate HMAC-SHA-256 audit chain through the anchor procedure in that same audit transaction. Portfolio rebuild, recovery, and evidence export verify both chains and fail closed on missing, inserted, changed, reordered, or unverifiable attempt evidence.

Derived projection replacement is not part of the ledger commit. After commit, `projection_runtime` verifies the accepted portfolio and audit anchors, rebuilds bounded pages, and invokes the controlled projection procedure. That `SECURITY DEFINER` procedure atomically replaces the derived projection and invokes the controlled audit procedure to append and HMAC-anchor the exact `PublicationCompleted` outcome in the same PostgreSQL transaction. Failed verification invokes the projection procedure's fail-closed branch, which leaves projections unchanged and atomically appends `BlockedPublication`. Until verification succeeds, prior projections remain visible with a distinct programmatic status for transient pending, integrity-blocked publication, or recovery in progress. Each status has non-color text, an assistive-technology announcement, a plain explanation, and an available recovery step; the new sequence is not published as current.

### Canonical Effects

| Effect | Canonical behavior |
| --- | --- |
| Cash deposit/withdrawal | Add the signed canonical money amount to cash |
| Buy fill | Subtract `quantity × unitPrice + fee` from cash; create one acquisition lot whose canonical basis is that same gross-plus-fee money amount |
| Sell fill | Consume FIFO quantity; add `quantity × unitPrice - fee` to cash; realized P&L is canonical net proceeds minus canonical allocated basis |
| Reversal | Negate the original stored canonical effects and reference their identities; never recompute under current prices, scale, or policy |

Fees are non-negative money. Buy fees increase lot basis. Sell fees reduce proceeds. A fill quantity and unit price are positive. Cash withdrawals cannot exceed available hypothetical cash; sell quantity cannot exceed the long open position. Shorting is prohibited.

## FIFO Lot Contract

1. A buy creates one lot identified by `lotId` with acquisition order `(effectiveAt, ledgerSequence, lotId)`, original/open quantity, and original/open canonical basis.
2. A sell consumes the oldest open lot by that tuple. Database row order is never a tiebreaker.
3. Each consumption persists `sellTransactionId`, `lotId`, canonical consumed quantity, and canonical allocated basis.
4. Non-final proportional basis allocation computes `originalCanonicalBasis × consumedQuantity / originalQuantity`, then quantizes once to money with half-even.
5. Final consumption of a lot receives the exact remaining canonical basis. Allocations therefore sum exactly to original basis.
6. A partial sell preserves the remaining quantity and basis; it never rewrites original lot values or prior allocation rows.
7. Rebuild processes immutable transactions by `ledgerSequence` and reproduces each persisted FIFO allocation. Any mismatch is integrity failure, not an alternate valid allocation.

## Reversal Contract

1. A reversal is a new immutable transaction with a unique sequence and exactly one unreversed target transaction.
2. It negates the target's stored canonical cash, quantity, basis, proceeds, fee, P&L, and lot-allocation effects under the target's recorded precision policy.
3. A transaction cannot be reversed twice. A reversal can itself be corrected only by reversing that reversal, preserving the chain.
4. A `SellFill` reversal restores each consumed lot slice with its stored canonical quantity and basis and negates realized P&L/proceeds effects.
5. A `BuyFill` with consumed quantity cannot be reversed until every dependent sell is reversed in reverse `ledgerSequence` order. Violation fails atomically with `LEDGER_REVERSAL_DEPENDENCY`.
6. A reversal and its restored/removed lot effects persist atomically. Original transactions, lots, and allocations remain immutable evidence.
7. Reversal-chain parity is derived, never stored by mutating prior records: an even number of successive active reversals reapplies the original effects; an odd number negates them. Each transaction in the chain may be directly reversed at most once.
8. Before reversing any reversal, the engine evaluates the effects that would be removed or restored. If later active transactions consumed a restored lot slice or otherwise depend on those effects, they must first be reversed in reverse `ledgerSequence` order; otherwise `LEDGER_REVERSAL_DEPENDENCY` is returned.
9. Every reversal must leave cash non-negative, long position quantities non-negative, allocated basis equal to original basis, and every persisted/rebuilt projection exactly reconcilable. Failure is atomic.

## Authoritative Rebuild and Projections

The ledger rebuild is authoritative. For a portfolio and valuation snapshot it derives:

- cash from signed cash effects;
- open lots from buy/sell/reversal effects;
- position quantity as the exact sum of open lot quantities by instrument;
- position basis as the exact sum of open lot basis;
- realized P&L as the exact sum of sell/reversal realized effects;
- valuation as canonical `positionQuantity × selected snapshot unit value` quantized once to money; and
- unrealized P&L as canonical `valuation - positionBasis`; and
- cached projections for cash, lots, positions, basis, realized P&L, unrealized P&L, valuations, and total equity.

A reconciliation run requires the same `portfolioId`, `valuationSnapshotId`, `precisionPolicyVersion`, and `baselineVersion` on rebuilt and cached projections. It compares keyed sets, not only totals: there must be a bijection with equal cardinality between rebuilt and cached positions keyed by `instrumentId`, open lots keyed by `lotId`, and allocations keyed by `(sellTransactionId, lotId, effectOrdinal)`. Valuation, position basis, and unrealized P&L are fields of the `instrumentId`-keyed position projection, not separate repeated rows. Duplicate keys, missing/extra records, stale snapshots/policies/baselines, identity substitutions, and unequal canonical strings all fail. Success requires exact equality and a zero difference for every monetary and quantity field. There is no epsilon. A mismatch produces `LEDGER_RECONCILIATION_FAILED`, blocks dependent publication/readiness where configured, and emits redacted evidence without silently repairing the cache.

Rebuild results are independent of database fetch order and processing batch size. Within a fixed immutable ledger and valuation snapshot, repeated TypeScript and Python rebuilds must produce identical canonical strings and evidence hashes.

## Stable Error Families

| Code | Condition |
| --- | --- |
| `LEDGER_INVALID_DECIMAL` | Non-string decimal input; exponent, leading plus, whitespace, trailing decimal point, leading-zero integer, embedded sign, forbidden float, or non-finite token |
| `LEDGER_EXCESS_SCALE` | External value exceeds its destination field scale |
| `LEDGER_BOUND_EXCEEDED` | Input, result, or accumulator exceeds a DEC-014 workload bound |
| `LEDGER_INSUFFICIENT_CASH` | Withdrawal or buy would exceed available hypothetical cash |
| `LEDGER_INSUFFICIENT_POSITION` | Sell would exceed long open quantity |
| `LEDGER_REVERSAL_DEPENDENCY` | Reversal target has unreversed dependent effects |
| `LEDGER_ALREADY_REVERSED` | Target is already reversed |
| `LEDGER_IDEMPOTENCY_CONFLICT` | A ledger idempotency identity is reused with different canonical content |
| `LEDGER_VERSION_CONFLICT` | `expectedPortfolioVersion` differs from the authoritative version |
| `LEDGER_INTEGRITY_FAILED` | Immutable record digest, commitment chain, or separately protected anchor is missing or invalid |
| `LEDGER_FIFO_MISMATCH` | Rebuild allocation differs from persisted deterministic FIFO allocation |
| `LEDGER_RECONCILIATION_FAILED` | Any rebuilt and cached canonical value/identity differs |

All failures are atomic and preserve transaction, lot, allocation, cash, position, and cached-projection state. Error evidence uses an allowlisted DTO containing only event type, stable error code, portfolio/transaction/order/fill/correlation/command identifiers, effect ordinal, old/new versions, UTC timestamp, evidence hashes, bounded counts, and violated bound name. Values reject control characters and enforce field/record size limits; free-form payload fragments, secrets, provider data, brokerage/external-account identifiers, and unknown fields are prohibited. Evidence serialization fails closed when a field cannot be classified or bounded.

## Selected-Policy Test Vectors

All numbers below are exact canonical strings. Valuation unit values are snapshot inputs, not external execution prices.

### CT-LED-001 - Buy, Partial Sell, Valuation, and Exact Rebuild

| Step | Input | Expected canonical result |
| --- | --- | --- |
| Deposit | `10000.00000000` | Cash `10000.00000000` |
| Buy | Qty `10.0000000000`, price `100.0000000000`, fee `1.00000000` | Cash `8999.00000000`; lot qty `10.0000000000`; basis `1001.00000000` |
| Sell | Qty `4.0000000000`, price `120.0000000000`, fee `1.00000000` | Net proceeds `479.00000000`; allocated basis `400.40000000`; realized P&L `78.60000000`; cash `9478.00000000` |
| Remaining lot | Rebuild | Qty `6.0000000000`; basis `600.60000000` |
| Valuation | Snapshot unit value `110.0000000000` | Valuation `660.00000000`; total equity `10138.00000000`; unrealized P&L `59.40000000` |

Every cached value and lot/allocation identity must equal the rebuild exactly.

### CT-LED-002 - Full Buy Reversal

Deposit `100.00000000`; buy `2.0000000000` at `25.0000000000` with fee `1.00000000` produces cash `49.00000000`, quantity `2.0000000000`, and basis `51.00000000`. Reversing that unconsumed buy restores cash `100.00000000`, open quantity `0.0000000000`, basis `0.00000000`, and realized P&L `0.00000000`. The original and reversal both remain immutable.

### CT-LED-003 - Partial-Lot FIFO

Starting cash `100.00000000`, buy lot A with `3.0000000000` at `10.0000000000`, then sell `1.0000000000` at `15.0000000000`, all with zero fee. Expected: consume `1.0000000000` from lot A, allocate basis `10.00000000`, retain quantity `2.0000000000` and basis `20.00000000`, produce net proceeds `15.00000000`, realized P&L `5.00000000`, and cash `85.00000000`. No second lot is consulted.

### CT-LED-004 - Spanning-Lot FIFO and Realized P&L

Starting cash `20000.00000000`:

1. Buy lot A: `3.0000000000` at `10.0000000000`, fee `0.00000000`; basis `30.00000000`.
2. Buy lot B: `2.0000000000` at `12.0000000000`, fee `0.00000000`; basis `24.00000000`.
3. Sell `4.0000000000` at `15.0000000000`, fee `1.00000000`.

Expected: consume all lot A and `1.0000000000` of lot B; allocated basis `42.00000000`; net proceeds `59.00000000`; realized P&L `17.00000000`; cash `20005.00000000`; remaining lot B quantity `1.0000000000`, basis `12.00000000`. At snapshot unit value `14.0000000000`, valuation is `14.00000000` and total equity is `20019.00000000`.

### CT-LED-005 - Half-Even and Residual Allocation

- Money: `1.000000005` quantizes to `1.00000000`; `1.000000015` to `1.00000002`; negative ties mirror these results.
- Quantity: `1.00000000005` quantizes to `1.0000000000`.
- Rate: `0.0000000000005` quantizes to `0.000000000000`.
- A lot with canonical basis `10.00000000` and quantity `3.0000000000`, consumed one unit at a time, allocates `3.33333333`, `3.33333333`, and final residual `3.33333334`; sum is exactly `10.00000000`.

### CT-LED-006/007 - Cross-Language and Fail-Closed Boundaries

TypeScript, Python, and controlled PostgreSQL reads must return identical fixed-point strings for all vectors. External 11th quantity/price digit, 9th money digit, or 13th rate digit fails with `LEDGER_EXCESS_SCALE`. Exponent notation, binary float values, signed plus, whitespace, and non-finite tokens fail with `LEDGER_INVALID_DECIMAL`. A result exceeding the common aggregate bound `9000000000000000.00000000` fails with `LEDGER_BOUND_EXCEEDED` before persistence.

### CT-LED-008 - Corrupt Cache Detection

After CT-LED-001, each mutation below is applied independently to a test copy and must produce `LEDGER_RECONCILIATION_FAILED`:

| Reconciliation surface | Corrupt test value |
| --- | --- |
| Cash | `9478.00000001` |
| Open-lot quantity | `6.0000000001` |
| Open-lot basis | `600.60000001` |
| Position quantity | `6.0000000001` |
| Position basis | `600.60000001` |
| Realized P&L | `78.60000001` |
| Valuation | `660.00000001` |
| Total equity/cached monetary projection | `10138.00000001` |
| Open-lot identity | Replace the expected `lotId` with a different valid identifier |
| Sell allocation identity | Independently replace `sellTransactionId`, `lotId`, or `effectOrdinal` in the expected allocation key |

Additional cases delete one expected row, add one unexpected row, duplicate each key type, use a stale `valuationSnapshotId`, `precisionPolicyVersion`, or `baselineVersion`, and apply equal-and-opposite value corruptions whose total is unchanged. Every case fails independently; equal totals cannot mask record-level corruption.

The authoritative ledger remains unchanged and no automatic repair occurs. A failure in one surface cannot be masked by an offsetting corruption in another surface because every canonical value and identity is compared independently.

### CT-LED-009 - Equal-Timestamp Ordering

Two acquisition lots share the same `effectiveAt`. Lot B has lower `ledgerSequence` than lot A and must be consumed first even if rows are fetched A then B. If sequence also matched (prohibited by uniqueness), `lotId` is the final deterministic comparison field. Different fetch and batch orders produce the same persisted allocation identities.

### CT-LED-010 - Reversal After Consumption

Deposit `100.00000000`, buy `2.0000000000` at `10.0000000000` with zero fee, then sell all `2.0000000000` at `15.0000000000` with zero fee. Cash becomes `110.00000000`; transaction-chain cash effects are `-20.00000000` then `+30.00000000`; realized P&L is `10.00000000`; the lot is fully consumed.

- Attempting to reverse the buy first fails atomically with `LEDGER_REVERSAL_DEPENDENCY`.
- Reversing the sell restores lot quantity `2.0000000000` and basis `20.00000000`, negates cash by `30.00000000`, and negates realized P&L by `10.00000000`.
- Reversing the buy next removes the restored open lot effect and adds cash `20.00000000`.
- The net effects of the buy/sell/reversal chain on cash, quantity, basis, and realized P&L are all canonical zero; ending cash equals the opening deposit `100.00000000`, while all immutable transactions and lineage remain.

The same test family must also cover partial consumption using CT-LED-001 state. Before the sale, cash is `8999.00000000` and the lot has quantity `10.0000000000` with basis `1001.00000000`. The sale consumes `4.0000000000` with allocated basis `400.40000000`, leaves quantity `6.0000000000` and basis `600.60000000`, raises cash to `9478.00000000`, and records realized P&L `78.60000000`. Reversing that sale must:

- negate stored net proceeds `479.00000000` and realized P&L `78.60000000`;
- restore the consumed slice quantity `4.0000000000` and stored allocated basis `400.40000000` to the same lot identity;
- restore cash to `8999.00000000`, open lot quantity to `10.0000000000`, open lot basis to `1001.00000000`, and realized P&L to `0.00000000`; and
- retain the original buy, sell, allocation, and reversal as immutable lineage without recomputing proportional basis.

Reversing the sell reversal reapplies the original sell only when no later active transaction consumed the restored slice; expected cash returns to `9478.00000000`, open quantity to `6.0000000000`, basis to `600.60000000`, and realized P&L to `78.60000000`. If a later sell consumed any restored quantity, the attempt fails with `LEDGER_REVERSAL_DEPENDENCY` until that later sell is reversed.

### CT-LED-011 - Concurrency, Idempotency, and Atomic Rollback

- Two buys with the same `expectedPortfolioVersion` that would jointly overspend cash race. Exactly one commits; the other returns `LEDGER_VERSION_CONFLICT`, with no partial order, fill, transaction, effect, allocation, audit, or version mutation.
- Two sells with the same expected version targeting the same remaining lot behave identically: one commits and one conflicts; overselling cannot occur.
- Replaying equivalent content under `(portfolioId, transactionId)` returns the original result without incrementing versions. Different content returns `LEDGER_IDEMPOTENCY_CONFLICT` without mutation.
- A second direct reversal returns `LEDGER_ALREADY_REVERSED`; a reversal with active dependents returns `LEDGER_REVERSAL_DEPENDENCY`. All failures preserve hashes and immutable row counts.

### CT-LED-012 - Bounds, Controlled Writes, Errors, and Hashes

| Boundary | Valid case | Rejected case/code |
| --- | --- | --- |
| Quantity | `1000000000.0000000000` | `1000000000.0000000001` / `LEDGER_BOUND_EXCEEDED` |
| Unit price | `1000000.0000000000` | `1000000.0000000001` / `LEDGER_BOUND_EXCEEDED` |
| Gross fill | `1000000000000000.00000000` | `1000000000000000.00000001` / `LEDGER_BOUND_EXCEEDED` |
| Fee | `1000000000.00000000` | `1000000000.00000001` / `LEDGER_BOUND_EXCEEDED` |
| Aggregate/accumulator | `9000000000000000.00000000` | `9000000000000000.00000001` / `LEDGER_BOUND_EXCEEDED` |
| Open-lot count | `1000000` | `1000001` / `LEDGER_BOUND_EXCEEDED` |
| Effects per transaction | `64` | `65` / `LEDGER_BOUND_EXCEEDED` |
| Commands per batch | `100` | `101` / `LEDGER_BOUND_EXCEEDED` |
| Allocations per sell | `10000` | `10001` / `LEDGER_BOUND_EXCEEDED` |
| Reversal-chain depth | `1000` | `1001` / `LEDGER_BOUND_EXCEEDED` |
| Concurrent commands per portfolio | `32` | `33` / `LEDGER_BOUND_EXCEEDED` |
| Rebuild transactions per invocation | `1000000` | `1000001` / `LEDGER_BOUND_EXCEEDED` |
| Evidence record UTF-8 size | `65536` bytes | `65537` bytes / `LEDGER_BOUND_EXCEEDED` |

Each command also has a server-enforced 30-second execution deadline. Bounds are checked before persistence; rebuilds exceeding one invocation continue from a verified immutable anchor in bounded pages rather than increasing the limit. External excess-scale values exercise `LEDGER_EXCESS_SCALE`; invalid grammar/float/non-finite values exercise `LEDGER_INVALID_DECIMAL`; insufficient cash/position exercises their stable codes. A controlled migration/direct-load test proves PostgreSQL never receives an unchecked excess-scale cast and rejects bypass writes. Hash fixtures specify the exact canonical UTF-8 bytes and SHA-256 digest; TypeScript, Python, and PostgreSQL verification must match, and any transaction, effect, allocation, audit, chain, or anchor mutation must fail integrity verification. Every stable error family is exercised with atomic rollback and deterministic batch ordering.

Concrete precedence and write-path vectors:

| Input/operation | Expected result | Required unchanged state |
| --- | --- | --- |
| Money `NaN`, excess scale, stale versions, and insufficient cash together | Rank 10 `LEDGER_INVALID_DECIMAL` | Order/portfolio versions, rows, effects, allocations, audit, cache |
| Money `1.000000001` with stale versions | Rank 20 `LEDGER_EXCESS_SCALE` | Same |
| Money `9000000000000000.00000001` with stale versions | Rank 30 `LEDGER_BOUND_EXCEEDED` | Same |
| Existing `(portfolioId, transactionId)` with different valid content and stale versions | Rank 40 `LEDGER_IDEMPOTENCY_CONFLICT` | Same |
| Equivalent replay with stale expected versions | Original result; no failure and no version increment | Same row counts and hashes |
| New valid content with stale portfolio version | Rank 50 `LEDGER_VERSION_CONFLICT` | Same |
| Fill command with current portfolio but stale order version | Rank 50 `ORDER_VERSION_CONFLICT` | Same |
| Current versions but buy exceeds cash | Rank 60 `LEDGER_INSUFFICIENT_CASH` | Same |
| Current versions but sell exceeds open quantity | Rank 60 `LEDGER_INSUFFICIENT_POSITION` | Same |
| Second direct reversal | Rank 60 `LEDGER_ALREADY_REVERSED` | Same |
| Reversal with active dependent consumption | Rank 60 `LEDGER_REVERSAL_DEPENDENCY` | Same |
| Rebuild allocation identity differs | Rank 70 `LEDGER_FIFO_MISMATCH` | Authoritative ledger and cache unchanged |
| Rebuild/cached projection differs | Rank 70 `LEDGER_RECONCILIATION_FAILED` | Authoritative ledger and cache unchanged |

A migration input `1.000000001` destined for a money field remains text and returns `LEDGER_EXCESS_SCALE`; no cast or ledger row occurs. Runtime attempts using direct DML, `TRUNCATE`, `COPY`, sequence access, trigger changes, DDL, ownership, or role inheritance are denied by PostgreSQL permissions across every immutable table. The controlled writer accepts canonical `1.00000000`, reads back exactly `1.00000000`, and produces the golden hash above. Mutation of any allocation/audit field or commitment predecessor returns `LEDGER_INTEGRITY_FAILED`; a ledger-writer attempt to replace the protected anchor is denied. Unknown or free-form evidence fields fail closed with no emitted unsafe record. Batch errors containing ranks 60, 20, and 50 are emitted in rank order 20, 50, 60 and then by the remaining key fields.

### CT-LED-013 - Audit Outcome Lifecycle

Each attempt first commits one immutable `IntentRecorded` with its `attemptIntentId`, command identifier, old versions, and no terminal outcome. Successful business commit appends exactly one linked `Committed` with new versions in the ledger transaction. Business rejection and anchor/integrity failure append respectively `Rejected` and `IntegrityFailed` only after business rollback, with the stable `errorCode`, unchanged versions, and no business mutation. A correlated pre-procedure database denial appends `PermissionDenied`. Failed and successful projection verification append respectively `BlockedPublication` and `PublicationCompleted`. An unresolved intent appends `TimeoutRecovery` and later `RecoveryCompleted` in that order. Unknown outcomes, missing intent linkage, duplicate terminal outcomes, invalid old/new versions, or outcomes emitted in the wrong phase fail before persistence.

### CT-LED-014 - Dual-Chain Commit and Rollback Boundaries

- A successful ledger command commits business rows, `Committed`, portfolio commitment, and latest checkpoint together; forced failure before any one element commits rolls back all four and leaves no orphan commitment.
- A forced portfolio-anchor failure returns `LEDGER_INTEGRITY_FAILED` with unchanged business/audit rows, versions, commitments, and checkpoints.
- `Rejected` or `IntegrityFailed` is appended only in a separate post-rollback audit transaction, whose audit segment and HMAC anchor commit together or neither commits.
- Every audit-only append advances exactly one `auditSequence`, references the prior `previousAuditCommitment`, records the active `keyIdentifier`, and fails atomically on predecessor, key, digest, or anchor mismatch.

### CT-LED-015 - Controlled-Procedure Authorization Denial

`PUBLIC`, `app_runtime`, `projection_runtime`, and `audit_runtime` cannot execute the anchor procedure directly. `app_runtime` and `projection_runtime` cannot execute the audit procedure directly. `projection_owner` can nest audit only for `BlockedPublication` and `PublicationCompleted`; every other outcome, unknown caller, caller/outcome mismatch, direct table DML, and attempted owner-role inheritance is rejected before persistence. Each denial asserts unchanged ledger, projection, audit, key, anchor, sequence, checkpoint, and version state. The permitted parent calls prove `app_runtime` can execute only ledger, `projection_runtime` only projection, and `audit_runtime` only audit.

### CT-LED-016 - Atomic Projection Publication Success

Given verified portfolio and audit chains and a rebuilt bounded page set, the controlled projection procedure replaces the complete derived projection and appends linked `PublicationCompleted` plus its audit HMAC anchor in one transaction. A forced failure before projection, outcome, audit commitment, or checkpoint completion leaves all four unchanged; partial publication is impossible. The new portfolio sequence becomes current only after the complete commit.

### CT-LED-017 - Fail-Closed Projection Publication

Given any portfolio-chain, audit-chain, checkpoint, key, digest, or exact-rebuild verification failure, the controlled projection procedure leaves every prior projection row and current sequence unchanged, atomically appends `BlockedPublication` with its audit commitment, and exposes pending status without publishing the rejected sequence. Failure to append or anchor `BlockedPublication` rolls back that audit transaction and still leaves projections unchanged.

### CT-LED-018 - Crash-Intent Recovery

A crash after committed `IntentRecorded` but before a terminal outcome leaves the original intent immutable and discoverable. After the bounded deadline, the collector appends one linked `TimeoutRecovery`; after deterministic recovery completes, it appends one linked `RecoveryCompleted`. Duplicate collection is idempotent, ordering and correlation survive restart, and neither outcome rewrites or deletes the intent. A correlated PostgreSQL pre-procedure denial instead appends `PermissionDenied` without SQL values or key material.

### CT-LED-019 - Anti-Rollback Recovery

Restore verification covers: database sequence older than the protected checkpoint; checkpoint older than the restored verified backup; missing or altered chain segments; and rotation-in-progress with predecessor and successor key identifiers. Every stale, missing, or mismatched case returns `LEDGER_INTEGRITY_FAILED`, keeps readiness false, and blocks projection publication and writes. A valid dual-key rotation resume verifies retained commitments under both identifiers, restores the latest accepted sequence, and sets readiness true only after full portfolio-chain, audit-chain, checkpoint, and exact-rebuild verification.

## Behavioral Evidence Status

CT-LED-001..019 are pre-implementation vectors, not executed evidence. Ring 2 must provide a runner and bindings, database constraints/migrations, the deny-by-default role matrix and append-only guards, TypeScript/Python cross-language fixtures, RFC 8785/SHA-256 golden bytes, allocation/audit digests and separately keyed chain anchors, trusted audit provenance, fail-closed evidence redaction, concurrency/abuse/security tests, property tests within supported bounds, and per-file coverage gates. No public accounting API is complete without executable tests.

## Traceability

| Source | Coverage |
| --- | --- |
| GitHub #20 | Immutable/reversing transactions, deterministic FIFO, exact reconciliation, reversal/rebuild vectors |
| GitHub #9 and DEC-014 | Bounded field types, half-even mode, canonical arithmetic, ingress and overflow behavior |
| DEC-011 | Complete FIFO/reversal/reconciliation floor retained without epsilon |
| O-REQ-005 and O-CST-007 | Authoritative local ledger, PostgreSQL bounded numerics, immutable correction model |
| O-MET-004 | Zero unexplained accounting difference after canonical quantization |
| Domain lifecycle contract | Fill-producing OT-05, OT-06, and OT-09 create local ledger effects only |
| CC-001 / DEC-015 | CT-LED-013..019 cover exact audit outcomes, dual-chain atomicity, role denial, projection publication, crash recovery, and anti-rollback restore |

## Candidate Review Checklist

- [x] Team Lead remediation recheck PASS validates #20/#9 candidate completeness and DEC-011 conformance for specialist review.
- [x] Code Reviewer final recheck APPROVED arithmetic, FIFO, reversal-chain, concurrency, hash, reconciliation, and error semantics.
- [x] Test Reviewer design-time PASS (4.37/5) validates vector arithmetic, boundary coverage, determinism, and rebuild evidence design; executable evidence remains required in Ring 2.
- [x] Security Reviewer APPROVED deny-by-default append-only controls, complete integrity anchoring, trusted audit provenance, abuse bounds, and fail-closed redaction; executable proof remains required in Ring 2.
- [x] Team Lead final custody PASS accepts `1.0.0-candidate.1` for #20/#9 subject to architecture, baseline, and Ring 2 implementation gates.
- [x] Code Reviewer candidate.2 PASS validates exact outcome vocabulary, function-owner authority, atomic projection publication, and unchanged accounting semantics.
- [x] Test Reviewer candidate.2 PASS validates CT-LED-013..019 design coverage; executable proof remains required in Ring 2.
- [x] Security Reviewer candidate.2 APPROVED / PASS validates key isolation, dual HMAC chains, denial paths, and anti-rollback recovery; executable proof remains required in Ring 2.
- [x] Accessibility candidate.2 PASS validates distinct programmatic pending/blocked/recovery states, non-color and assistive-technology cues, plain remediation, and redaction; runtime proof remains required in Ring 3.
- [ ] Affected contract streams acknowledge the candidate before baseline freeze.

Until all reviews and the remaining baseline contracts complete, this candidate does not freeze or activate `v1.0.0` or release parallel work.

## Review Record

| Review | Result | Scope |
| --- | --- | --- |
| Team Lead initial custody review | FAIL | Missing partial-consumption reversal vector and incomplete reconciliation corruption matrix |
| Team Lead remediation recheck | PASS | Both defects closed; candidate accepted into the Building baseline for specialist review |
| Code Reviewer initial review | IMPROVEMENTS REQUIRED | Ingress, concurrency, reversal-chain, hash, cardinality, and vector determinism gaps |
| Code Reviewer final recheck | APPROVED | All findings closed after three focused repair cycles |
| Test Reviewer independent audit | PASS (design-time) | Exact arithmetic and controlling invariants verified; additive executable fixtures and harness conditions remain Ring 2 obligations |
| Security Reviewer remediation recheck | APPROVED / PASS | All three Major and two Minor specification findings closed; implementation control evidence remains a Ring 2 obligation |
| Team Lead final custody review | PASS | Candidate accepted for #20/#9; architecture integration, executable evidence, issue closure, and baseline freeze remain pending |
| Team Lead candidate.2 custody recheck | PASS | CC-001 additive-minor authority/audit amendment accepted for specialist rechecks; SHA-256 `4963ee62af6b4e0002f76545184c158675edf3a532936a70e8c48cbe79d54ae3` |
| Code Reviewer candidate.2 recheck | PASS | Exact outcome vocabulary, PostgreSQL function-owner authority, atomic projection publication, and unchanged accounting/FIFO/hash/error semantics verified |
| Test Reviewer candidate.2 recheck | PASS (design-time) | CT-LED-013..019 close audit lifecycle, dual-chain, authorization, publication, crash-recovery, and anti-rollback vector gaps; Ring 2 execution pending |
| Security Reviewer candidate.2 recheck | APPROVED / PASS | Key injection/isolation, parent and anchor grants, dual chains, denial paths, projection gating, and recovery verified; dispatched with `GPT-5.6 Sol (copilot)` |
| Accessibility candidate.2 recheck | PASS (design-time) | Programmatic pending/blocked/recovery states, plain remediation, non-color and assistive-technology cues, and sensitive-value redaction verified |

Team Lead PASS is pre-implementation specification custody only and does not close #20/#9, claim executable evidence, freeze the baseline, or authorize parallel work.
