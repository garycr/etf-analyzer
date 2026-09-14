# REV-035: DEC-025 Controlled-Function Owner Usage Review

**Date:** 2026-09-14
**Reviewer:** Architect Reviewer, Claude Sonnet 5 dispatch
**Scope:** Schema USAGE without CREATE for controlled-function owners and sequence-2 canonical evidence
**Result:** PASS

## Disposition

Live PostgreSQL 16 proved that qualified SECURITY DEFINER bodies execute as their function owner and require schema USAGE independently of object ownership. DEC-025 retains only schema USAGE for the six controlled-function owner roles and always revokes CREATE before migration commit. This preserves exact ownership and separation of duties without granting DDL authority or PUBLIC access.

The initial review was Conditional until the canonical projector could represent sequence 2. The projector now enforces exact cumulative table and function sets, validates fixed function configuration, hashes normalized `pg_get_functiondef` text, and includes the retained schema-USAGE grant. The real 0002 integration path uses this projector and preserves the 0001 golden unchanged.

The final recheck found no Critical or Major finding.

## Boundary

This PASS accepts the DEC-025 authority pattern and its `application_writer_owner` implementation in 0002. Applying it to the remaining five owners occurs only when their controlled functions are introduced. Migrations 0003 through 0006, complete CT-DB-001, WP-1 exit, WP-2, release, deployment, and production remain open or unauthorized.
