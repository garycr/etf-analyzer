# Lattice Runtime Connector

A tier-agnostic TypeScript library **and** thin CLI that lets an agent workspace
actually talk to a deployed **Lattice** over HTTP — sending governed content
(the *send* path) and retrieving governed claims (the *receive* path).

This bundle is copied into every scaffolded workspace at
`tools/lattice-client/`. It works the same in Tiers 1–8, inside a container
(managed identity) or on a developer machine (`az login`).

## Install & build

```bash
cd tools/lattice-client
npm ci
npm run build
```

## Configuration

Reads `docs/Operations/lattice/config.json` (created by the
**Lattice: Configure Live Connection** command):

```jsonc
{
  "endpoint": "https://brain.contoso.example",
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "authMode": "entra-bearer",
  "dlpPolicyId": "policy-standard-v1",
  "audience": "api://governance-brain"
}
```

Config is validated **fail-closed**: an HTTPS endpoint, a GUID `tenantId`, a
known `authMode`, and a non-placeholder `dlpPolicyId` are all required.

## Authentication

Pluggable `TokenProvider`, selected by `authMode`:

| authMode            | Provider                     | Token source                                   |
| ------------------- | ---------------------------- | ---------------------------------------------- |
| `entra-bearer`      | `AzureIdentityTokenProvider` | `DefaultAzureCredential` (MI in container, `az login` in dev) |
| `easy-auth`         | `EnvBearerTokenProvider`     | `BRAIN_BEARER` (host-supplied)                 |
| `mcp-auth`          | `EnvBearerTokenProvider`     | `BRAIN_BEARER`                                 |
| `customer-override` | `EnvBearerTokenProvider`     | `BRAIN_BEARER`                                 |

- The token scope is `scope` if set, else `${audience}/.default`.
- Interactive device-code sign-in is **opt-in** via `SB_AUTH_DEVICE_CODE=1`, so
  containers never block on a prompt.
- `@azure/identity` is imported lazily; pass-through modes don't need it installed.

Identity is always carried by the **token**. Request-body `tenantId` satisfies
the contract envelope and is validated server-side — the brain never trusts the
body as the source of identity.

## CLI

```bash
node dist/cli.js init
node dist/cli.js probe
node dist/cli.js query "What is the deployment runbook?" --limit 5
node dist/cli.js receive-lessons "Ship the RSVP reader MVP" --limit 10
node dist/cli.js claims --limit 20
node dist/cli.js sources
# send path (fail-closed DLP — requires an explicit allow):
node dist/cli.js ingest --file docs/Planning/memory/lessons-learned.jsonl \
  --content-type application/json --dlp-allow
```

### Memory-cycle helpers

Two commands compose the base endpoints to close the memory loop:

- `probe` — confirms **source-registry + receive** access by running `GET /api/sources`
  then `query`, reporting each leg independently without mutating server state.
  Exits non-zero if either leg fails (401/403/network),
  so init scripts can gate on connectivity. Library: `probeConnectivity(client)`.
- `receive-lessons "<objective>"` — asks the brain for learnings relevant to the
  workspace objective via `POST /api/lessons/objective` and appends
  permission-trimmed citations to **both**
  `docs/Operations/lattice/received-lessons.jsonl` (machine) and
  `docs/Operations/lattice/received-lessons.md` (human-readable), recall-only.
  Exits non-zero when the brain is unreachable. Library:
  `receiveObjectiveLessons(client, workspaceRoot, { objective })`.

## v1 endpoints

| Method | Route                              | Library method          |
| ------ | ---------------------------------- | ----------------------- |
| POST   | `/api/init`                        | `init`                  |
| GET    | `/api/sources`                     | `listSources`           |
| POST   | `/api/sources`                     | `createUploadSource`    |
| POST   | `/api/ingest/file`                 | `ingestFile`            |
| POST   | `/api/sources/{sourceId}/events`   | `registerSourceEvent`   |
| POST   | `/api/query`                       | `query`                 |
| POST   | `/api/lessons/objective`           | `receiveLessons`        |
| GET    | `/api/claims`                      | `listClaims`            |
| GET    | `/api/chat/sources`                | `getChatSources`        |

## Deferred to v2

`POST /api/chat` (Server-Sent Events) depends on the brain's Azure OpenAI
backend, which is currently unreachable through the central AI gateway. Chat
grounding is deferred until that dependency is unblocked. See
`docs/Planning/blocking-issues.md`.

## Audit

Every operation appends a **tamper-evident, hash-chained** row to
`docs/Operations/lattice/api-audit.md` (timestamp, operation, route, status,
caller oid/sub, tenant, correlation id, plus `Prev`/`This` SHA-256 chain columns).
The log is append-only and machine-written — do not edit it by hand; edits break the
chain and are detectable by `verifyAuditChain`.

## Test

```bash
npm test
```

Unit and integration tests mock `fetch` and inject a `TokenProvider`, so no
network or `@azure/identity` install is required to run them.
