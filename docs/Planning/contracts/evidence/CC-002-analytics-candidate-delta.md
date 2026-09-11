# CC-002 - Analytics Candidate.2 Detached Delta Evidence

## Authority and Scope

This manifest records the candidate.1 to candidate.2 analytics evidence contract amendment and the separately approved #64 governance synchronization. It is reconstruction evidence only. Full REV-014 remains FAIL; prototype acceptance #65 remains pending.

## Source and Candidate Digests

| Artifact | Source authority | SHA-256 |
| --- | --- | --- |
| Candidate.1 contract | Commit `623a0cbdb602c425be13b2821db6046530ea7888` | `479908bb8a2a4d518ef11bc2defce4a9236286790e1a161d1f6bff2a81fac794` |
| Candidate.1 BDD | Commit `623a0cbdb602c425be13b2821db6046530ea7888` | `d8f780b22d2369e35531af12843076c3513472974e00c0ff43e0897f53850e72` |
| Candidate.2 contract before #64 status synchronization | Commit `543ac2f` | `dd26dc8be1e7e83e86d468ccf2e31899e39bcd31f089e02c3a35904fe6674638` |
| Candidate.2 synchronized contract | CC-002 working candidate | `1023a5b416d4fb42c76b47b6b3deab5bb1a74612711a00159b5a4b4ce2b9c831` |
| Candidate.2 BDD | Commit `543ac2f`; unchanged by #64 | `b7996bd41070f4802434b8d9921b7fc06c3de4a89a3dd8f71611b8302512d22f` |

The #64 contract change is status metadata only. The seven canonical JSON vectors remain byte-for-byte identical to commit `543ac2f`.

## Canonical Vector Evidence

| Vector | UTF-8 bytes | SHA-256 |
| --- | ---: | --- |
| Input | 623 | `cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa` |
| Configuration | 699 | `fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37` |
| Result | 345 | `4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18` |
| Lifecycle | 112 | `68d6a985505e451a7d6adda9fbf40dd3ba4085edfe7867876a72aacd324e9808` |
| Transformation | 355 | `238e3d87efe0349fbab3fb70ea4b800e0488db24b8d902874dd1a4608ceca998` |
| Bundle | 1,456 | `20f33dce407668ea1d60f9367af21e4cd1d968d46475f32dac709da7842fc3e6` |
| Manifest | 893 | `78469b3c9f981b9ffa5752120718bd7baa81e2156a007dbc5f8fbcf49139f4f8` |

## Reconstruction

1. Recover candidate.1 with `git show 623a0cbdb602c425be13b2821db6046530ea7888:docs/Planning/contracts/analytics-evidence-contract.md` and the equivalent BDD path.
2. Recover the candidate.2 semantic amendment with `git show 543ac2f:docs/Planning/contracts/analytics-evidence-contract.md` and the equivalent BDD path.
3. Extract each single-line `json` fenced block without its trailing newline. Hash its exact UTF-8 bytes with SHA-256 and compare the byte counts and digests above.
4. Hash the complete synchronized files with `sha256sum`. The contract and BDD values must match the source-and-candidate table.
5. Verify the frozen ledger contract remains `0e223c5d4e4af1a1cd42cd9dbd8e2275f90b1904efd6eaa68555e7ad7dd376e2`.

## Delta and Review Disposition

Candidate.2 adds and clarifies canonical hash domains, `inputSchemaVersion`, parameter numeric grammar, canonical date and identity encodings, point-in-time boundaries, #17 invalidation, and exact lifecycle/transformation/bundle/manifest vectors. Scoped Test Reviewer rechecks passed M1-M6/M12/M14 and R-1..R-5. Deferred M7-M11/M13 and associated Minor findings remain open through #57-#62. Full REV-014 therefore remains FAIL.

## Invalidation

Any byte change to either governed artifact invalidates its synchronized digest. Any change to #17 ingestion identity, availability meaning, revision ordering, fixture provider/policy identifiers, hash-domain fields, or canonicalization rules requires dependent-vector recomputation and the applicable custody and Test Reviewer recheck. This manifest grants no implementation, baseline-freeze, issue #15/#11 closure, Ring 2, or parallel-execution authority.
