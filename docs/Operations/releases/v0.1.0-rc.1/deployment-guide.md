# ETF Analyzer v0.1.0-rc.1 Local Evaluation Guide

**Purpose:** Deploy the assigned release candidate to a local DEV environment for evaluation and feedback.

**Boundary:** Single user, fixture-only, PostgreSQL 16.15, and loopback `127.0.0.1` access only. This procedure does not authorize staging, production, public ingress, live providers, brokerage, or real orders.

## Assigned Candidate

| Field | Value |
| --- | --- |
| Candidate | `v0.1.0-rc.1` |
| Source commit | `a0dcf3ba5fba94a7c4cc1a6658f0863b0c19ed98` |
| CI run | `36363283790` |
| GitHub artifact | `etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba94a7c4cc1a6658f0863b0c19ed98` |
| Archive | `etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba.tar.gz` |
| Archive SHA-256 | `68be9f33e788311c856961ce2a0bbe5726a39e4be0a87475b9d027ccd9b187a2` |

Do not rebuild or substitute another artifact during evaluation.

## 1. Confirm Prerequisites

Install or provide:

- Ubuntu 24.04 or the reviewed equivalent local environment.
- Node.js exactly `20.20.2` and npm.
- GitHub CLI authenticated to read `garycr/etf-analyzer` Actions artifacts.
- PostgreSQL exactly `16.15`, already provisioned with the reviewed role bootstrap, all eight canonical migrations, and a persisted readiness snapshot.
- A reviewed fixture package containing `manifest.json` and every file declared by that manifest.
- A reviewed analytics JSON artifact containing `configurationHash`, `inputEvidenceIds`, and `databasePayload`.
- Separate PostgreSQL connection URLs for a catalog-readable control identity and the least-privilege `app_runtime` identity.

Check the local tools:

```bash
test "$(node --version)" = "v20.20.2"
npm --version
gh auth status
```

Stop if the exact database or reviewed input artifacts are unavailable. The candidate intentionally does not create database roles, run migrations, or generate evaluation inputs. Test fixtures are not approved deployment data.

## 2. Download the Exact CI Artifact

Use a new evaluation directory:

```bash
export ETF_EVAL_ROOT="$HOME/etf-evaluation/v0.1.0-rc.1"
rm -rf "$ETF_EVAL_ROOT"
mkdir -p "$ETF_EVAL_ROOT/artifact"

gh run download 36363283790 \
  --repo garycr/etf-analyzer \
  --name etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba94a7c4cc1a6658f0863b0c19ed98 \
  --dir "$ETF_EVAL_ROOT/artifact"

cd "$ETF_EVAL_ROOT/artifact"
ls -l
```

The directory must contain only the archive and its `.sha256` sidecar.

## 3. Verify the Archive

Verify both the recorded digest and the downloaded sidecar:

```bash
printf '%s  %s\n' \
  '68be9f33e788311c856961ce2a0bbe5726a39e4be0a87475b9d027ccd9b187a2' \
  'etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba.tar.gz' | sha256sum -c -

sha256sum -c etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba.tar.gz.sha256
```

Both commands must report `OK`. Stop on any mismatch.

## 4. Extract and Verify Every Payload

```bash
mkdir -p "$ETF_EVAL_ROOT/extracted"
tar -xzf etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba.tar.gz \
  -C "$ETF_EVAL_ROOT/extracted"
cd "$ETF_EVAL_ROOT/extracted/etf-analyzer-v0.1.0-rc.1-a0dcf3ba5fba"
```

Run this before installing dependencies so the extracted file set can be compared exactly with `release-manifest.json`:

```bash
node --input-type=module <<'NODE'
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "release-manifest.json"), "utf8"));
if (manifest.candidate !== "v0.1.0-rc.1") throw new Error("candidate mismatch");
if (manifest.sourceCommit !== "a0dcf3ba5fba94a7c4cc1a6658f0863b0c19ed98") {
  throw new Error("source commit mismatch");
}

const actual = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"))
  .filter((path) => path !== "release-manifest.json")
  .sort();
const expected = manifest.files.map((entry) => entry.path).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("payload set mismatch");

for (const entry of manifest.files) {
  const content = readFileSync(join(root, entry.path));
  const digest = createHash("sha256").update(content).digest("hex");
  if (content.byteLength !== entry.bytes || digest !== entry.sha256) {
    throw new Error(`payload mismatch: ${entry.path}`);
  }
}
console.log(`Verified ${manifest.files.length} payload files for ${manifest.sourceCommit}`);
NODE
```

The expected result is `Verified 77 payload files` with the assigned source commit.

## 5. Install Production Dependencies

From the extracted package directory:

```bash
npm ci --omit=dev
```

Do not run `npm run build`; the candidate contains its reviewed precompiled `dist/` output.

## 6. Prepare Operator Configuration

Keep configuration and reviewed inputs outside the extracted package:

```bash
mkdir -p "$ETF_EVAL_ROOT/operator" "$ETF_EVAL_ROOT/reviewed-artifacts/fixture"
cp config/local-runtime.example.json "$ETF_EVAL_ROOT/operator/local-runtime.json"
chmod 700 "$ETF_EVAL_ROOT/operator" "$ETF_EVAL_ROOT/reviewed-artifacts"
chmod 600 "$ETF_EVAL_ROOT/operator/local-runtime.json"
```

Place the approved fixture package under:

```text
$ETF_EVAL_ROOT/reviewed-artifacts/fixture/
```

Place the approved analytics artifact at:

```text
$ETF_EVAL_ROOT/reviewed-artifacts/analytics.json
```

Edit `local-runtime.json` so `artifactRoot` is the absolute expanded path to `reviewed-artifacts`. Keep `fixturePackageDirectory` as `fixture`, `analyticsArtifactPath` as `analytics.json`, and `port` as `43123` unless that loopback port is already occupied. Keep `allowedOrigins` aligned with the exact loopback origin and chosen port.

Never put PostgreSQL credentials or a launch token in the JSON file.

## 7. Confirm the Database Boundary

Before launch, confirm that both connection URLs target the intended local PostgreSQL 16.15 database. The control identity must have only the reviewed catalog-read capability, and the request identity must be `app_runtime`.

Do not use an administrator or superuser URL as `ETF_POSTGRES_URL`. Do not run candidate evaluation against a database that contains unreviewed or valuable data. Database migration rollback and destructive cleanup are unsupported.

## 8. Launch the Candidate

From the extracted package directory, provide the two URLs through the process environment and launch the precompiled runtime:

```bash
ETF_POSTGRES_CONTROL_URL='postgresql://control-role@127.0.0.1:5432/etf_analyzer' \
ETF_POSTGRES_URL='postgresql://app_runtime@127.0.0.1:5432/etf_analyzer' \
npm run start:release -- "$ETF_EVAL_ROOT/operator/local-runtime.json"
```

Replace the example URLs with the operator-owned local credentials. Avoid storing credentials in shell history where practical.

Successful startup prints one `http://127.0.0.1:<port>/#...` URL containing a fresh per-launch token in the fragment. Open that exact URL in the local browser. Do not share, log, bookmark, or persist the token.

Stop immediately if startup reports an attestation, artifact, migration, readiness, authentication, or binding failure, or if the listener binds anywhere other than `127.0.0.1`.

## 9. Evaluate the Candidate

During the DEV evaluation, confirm:

1. The workbench loads only through the printed token-bearing loopback URL.
2. Readiness is `Ready` and liveness remains healthy.
3. The reviewed fixture dataset is visible with expected canonical values.
4. Watchlist and query views return their expected fixture-backed records.
5. Analytics results and evidence are available and retain their configuration/input identities.
6. A hypothetical paper order requires explicit confirmation and follows the expected state transitions.
7. Portfolio and ledger views reconcile after the hypothetical order flow.
8. Refresh, invalid input, and blocked operations produce clear, redacted recovery messages.
9. Keyboard navigation, focus visibility, and narrow viewport layout remain usable.
10. No live provider, brokerage, public network, or durable handoff behavior is present.

Record feedback with the candidate version, source commit, browser, PostgreSQL version, evaluation step, expected result, actual result, and any redacted diagnostic identifier. Never include credentials, launch tokens, or restricted fixture contents.

## 10. Stop and Record the DEV Result

Press `Ctrl+C` in the launcher terminal. Confirm the process exits and the loopback URL no longer responds. Do not preserve the launch token.

Record the actual DEV result in `docs/Operations/promotion-log.md`. A successful DEV evaluation does not imply SMOKE, TEST, staging, production, or deployment approval.

## Failure and Rollback

On any integrity, startup, readiness, security, or data failure:

1. Stop the process with `SIGINT` or `SIGTERM`.
2. Confirm the listener has closed.
3. Preserve redacted logs, archive identity, configuration identity, and readiness output.
4. Do not edit or reverse migrations and do not substitute another build.
5. Follow `rollback-plan.md`; because this is the first candidate, remain stopped and return the result to DEV.
