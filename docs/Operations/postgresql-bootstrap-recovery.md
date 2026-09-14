# PostgreSQL Bootstrap Recovery

## Allowed Prerequisite

Before `0001-foundation`, the only allowed product state is the fourteen closed roles, nine closed memberships, database `CONNECT` granted only to the six login roles, no `PUBLIC` database privilege, and empty schema `etf` owned by `schema_owner`. The schema must have a null ACL, no relations or routines, and no schema-scoped default privileges. This state is `NotReady` and has no migration row or manifest hash.

## Recovery Ownership

The PostgreSQL cluster provisioner owns bootstrap recovery. A failed `0001` may be retried only when the prerequisite remains exact and empty. The deployment runner verifies this state and never drops, transfers, grants, or repairs the schema implicitly.

If a database grant is extra or missing, `PUBLIC` retains a database privilege, or the schema is missing, has the wrong owner, contains an object, exposes an ACL, or has a schema-scoped default privilege, stop migration processing with `APPLICATION_MIGRATIONS_INCOMPLETE`. An authorized operator must inspect the catalog evidence, determine origin and impact, and explicitly restore or recreate the prerequisite under the environment change process. Destructive cleanup is never automatic.

## Rollback Boundary

A failed `0001` transaction removes every table and temporary schema grant created by that migration and writes no `schema_migrations` row. The externally provisioned empty schema and closed role bootstrap remain. Later migration failures preserve every earlier committed migration unchanged.
