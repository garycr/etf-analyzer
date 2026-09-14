# WP-1 PostgreSQL Role Bootstrap Evidence

**Date:** 2026-09-11
**Scope:** External role-bootstrap leaf of CT-DB-001A and CT-DB-001D
**Result:** PASS

## Executed Behavior

The external-provisioner SQL executed against the pinned PostgreSQL 16.15 image. Catalog inspection verified exactly fourteen product roles, nine memberships, and the contract attributes `NOINHERIT`, `NOSUPERUSER`, `NOCREATEROLE`, `NOCREATEDB`, `NOREPLICATION`, and `NOBYPASSRLS`. Every membership had `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`.

A forced failure after partial role-creation statements proved transaction rollback leaves no product role. Cleanup rolls back an aborted transaction before dropping roles, always closes the database client, and checks both membership directions across all fourteen product roles. The pinned-container run passed 25 tests with zero failures or skips, then removed the disposable container.

## Review

The alternate-model Code Reviewer identified cleanup, rollback-proof, and closed-membership inspection gaps. All were reproduced or confirmed, remediated, and rechecked. The final recheck returned PASS with no blocker.

## Boundary

This evidence proves only external role creation, role attributes, membership options, transactional rollback, and closed membership inspection. Product migrations, object ownership/grants, controlled functions, append-only triggers, schema-manifest hashes, complete CT-DB-001A/D, and WP-1 exit remain unclaimed. Architecture remains Proposed; WP-2, baseline activation, release, deployment, and production action remain unauthorized.

## DEC-024 Amendment

On 2026-09-14, live PostgreSQL 16 execution proved product roles could not create the initial schema without permanent database authority. The Workspace Owner selected external creation of exactly empty schema `etf` owned by `schema_owner`. Catalog execution then proved a NULL database ACL preserves implicit `PUBLIC CONNECT,TEMPORARY`; the Workspace Owner selected exact external database ACL provisioning. The provisioner now atomically revokes those PUBLIC privileges, grants CONNECT only to the six closed login roles, and creates the empty schema. Four pinned-container integration tests cover the exact role and database grant matrices, rollback both before and after the database ACL mutation, and verify the empty schema's owner, null ACL, zero relations/routines, and zero schema-scoped default privileges. The focused bootstrap/foundation integration run passed 8/8. REV-030 remains the review of the original role-only leaf; DEC-024 and the follow-up architecture review govern the schema and database-ACL amendments.
