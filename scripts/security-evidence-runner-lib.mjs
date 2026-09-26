import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildSecurityEvidenceManifest } from "./security-evidence-lib.mjs";

export const securityEvidenceCheckTimeoutMs = 300_000;

const defaultExecute = (script) => spawnSync("npm", ["run", script], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  timeout: securityEvidenceCheckTimeoutMs,
});

export const runSecurityEvidence = ({ identity, outputDirectory, checks, execute = defaultExecute }) => {
  const results = checks.map(({ name, script }) => {
    const result = execute(script);
    const operationalError = result.error?.message ?? (result.signal ? `Terminated by ${result.signal}` : "");
    return {
      name,
      command: `npm run ${script}`,
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: [result.stderr ?? "", operationalError].filter((value) => value !== "").join("\n"),
    };
  });

  const manifest = buildSecurityEvidenceManifest(identity, results);
  mkdirSync(outputDirectory, { recursive: true });
  for (const result of results) {
    writeFileSync(join(outputDirectory, `${result.name}.stdout.txt`), result.stdout);
    writeFileSync(join(outputDirectory, `${result.name}.stderr.txt`), result.stderr);
  }
  writeFileSync(join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
};
