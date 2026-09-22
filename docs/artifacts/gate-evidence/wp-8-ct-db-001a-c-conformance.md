# WP-8 CT-DB-001A-C Integrated Conformance Evidence

**Date:** 2026-09-21
**Decision:** DEC-069; DEC-070; DEC-072; DEC-073
**Status:** Accepted under REV-169
**Scope:** Integrated CT-DB-001A, CT-DB-001B, and CT-DB-001C only

Sequence 7 was subsequently hardened for CT-DB-001D denial replay and least privilege. Its current SQL hash is `0d07358c3056885e15ba190681402a381ed71485beb35e3b9088cc8d107b1340` and current cumulative manifest hash is `915d698edc5d95ef648d38d754ed5754dc46fffa8a9d6272304eaf58cf274c2e`; the A-C checks were rerun against this successor identity.

## CT-DB-001A

The exact scenario `CT-DB-001A an empty database reaches the exact candidate schema` in `tests/Integration/controlled-access-migration.test.mjs` starts from the external empty provisioner boundary, validates the closed 15-role and 11-membership graph, applies all seven migrations, and compares every migration identity, SQL hash, and schema-manifest hash with the normative contract. It also checks the canonical catalog, grants, object counts, and system extensions.

The sequence-1 through sequence-3 exact commit tests pin the current cumulative manifest hashes and canonical byte lengths (`5866`, `8089`, and `16193`) and require replay-time live catalog projection. All three pass.

## CT-DB-001B

The exact scenario `CT-DB-001B migration replay is deterministic and drift fails closed` in `tests/Integration/controlled-access-migration.test.mjs` snapshots all seven migration rows, replays migration 0007 as a no-op, and proves the ledger remains byte-for-byte equal. Eight isolated live subtests mutate a check constraint, add an unknown table, replace a function body, add a runtime membership, grant PUBLIC function EXECUTE, grant PUBLIC database CONNECT, grant PUBLIC database TEMPORARY, and revoke `app_runtime` database CONNECT. Every mutation produces `APPLICATION_MIGRATIONS_INCOMPLETE`, remains present after the readiness check, and leaves the migration ledger unchanged.

The unit decision table `CT-DB-001B migration ledger drift fails closed without repair` covers missing migration 0004, duplicate sequence 4, reordered 0004/0005, unknown `0007-outbox`, and changed content hash. Its five subtests plus parent pass 6/6.

## CT-DB-001C

The canonical scenario `CT-DB-001C a failed migration leaves no partial candidate state` forces a post-projection failure at each of the seven migration boundaries. Sequence 1 compares the exact empty-bootstrap namespace owner, schema ACL, relation and routine counts, and schema-scoped default ACL rows before and after rollback. Sequences 2 through 7 compare the complete prior canonical catalog manifest and migration ledger before and after rollback. Every row also verifies the target runtime entry object remains absent and proves a second connection can acquire the transaction-scoped migration advisory lock after rollback.

The seven owning migration suites retain their deeper migration-specific rollback checks:

1. `0001 uses final owners, revokes temporary grants, and rolls back to the empty prerequisite`.
2. `0002 rolls back its complete catalog on manifest failure`.
3. `0003 rolls back its complete catalog on manifest failure`.
4. `0004 rolls back its complete catalog on manifest failure`.
5. `0005 rolls back its complete catalog on manifest failure`.
6. `0006 rolls back its complete surface when manifest projection fails`.
7. `0007 rolls back helper and audit replacement when manifest projection fails`.

The 0002 test closes the previously missing boundary by proving no application table, function, schema CREATE grant, runtime function execution, or sequence-2 migration row survives and that the committed foundation ledger remains byte-for-byte unchanged.

The canonical C parent and seven migration subtests pass 8/8. Independent review is PASS with no findings under REV-169.

## Aggregate Validation

- Image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- PostgreSQL: `16.15|UTF8|UTC|on|C`.
- Live A-C plus sequence-1 through sequence-3 exact-manifest aggregate: 21/21 PASS, zero failed, zero skipped.
- B impossible-ledger decision table: 6/6 PASS, zero failed, zero skipped.
- Lint, build, and `git diff --check`: PASS.
- Temporary container: removed.
- Live command (credentials remain in shell variables and are not printed):

	```bash
	container="etf-ac-$RANDOM-$$"
	user="etf_$(openssl rand -hex 8)"
	password="$(openssl rand -hex 24)"
	database="etf_$(openssl rand -hex 8)"
	trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT INT TERM
	docker run -d --name "$container" -P \
		-e POSTGRES_USER="$user" -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB="$database" \
		-e POSTGRES_INITDB_ARGS='--encoding=UTF8 --locale=C --data-checksums' \
		--health-cmd='pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' --health-interval=1s --health-timeout=5s --health-retries=30 \
		postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685 >/dev/null
	until [ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = healthy ]; do :; done
	port="$(docker port "$container" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
	ETF_TEST_POSTGRES_URL="postgresql://$user:$password@127.0.0.1:$port/$database" \
		node --input-type=module -e "import pg from 'pg'; const client = new pg.Client({ connectionString: process.env.ETF_TEST_POSTGRES_URL }); await client.connect(); const result = await client.query(\"SELECT current_setting('server_version') || '|' || pg_encoding_to_char(encoding) || '|' || current_setting('TimeZone') || '|' || current_setting('data_checksums') || '|' || datcollate AS environment FROM pg_database WHERE datname = current_database()\"); console.log(result.rows[0].environment); await client.end();"
	ETF_TEST_POSTGRES_URL="postgresql://$user:$password@127.0.0.1:$port/$database" \
		node --test --test-reporter=tap \
		--test-name-pattern='^(CT-DB-001A an empty database reaches the exact candidate schema|CT-DB-001B migration replay is deterministic and drift fails closed|CT-DB-001C a failed migration leaves no partial candidate state|0001 commits its canonical catalog manifest and replays as a no-op|0002 commits exact application objects and controlled behavior|0003 commits its exact manifest and atomic anchored cash behavior)$' \
		tests/Integration/controlled-access-migration.test.mjs tests/Integration/foundation-migration.test.mjs \
		tests/Integration/application-migration.test.mjs tests/Integration/domain-ledger-migration.test.mjs
	```
- Unit command: `node --test --test-name-pattern='^CT-DB-001B migration ledger drift fails closed without repair$' tests/Unit/postgres-readiness.test.mjs`.

## Boundary

This candidate evidence does not accept CT-DB-001D..J, PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, or production. CT-DB-001K remains separately accepted under DEC-072/REV-168, and CT-DB-001L remains separately accepted under REV-161.
