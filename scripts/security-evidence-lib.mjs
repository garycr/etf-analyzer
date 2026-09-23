import { createHash } from "node:crypto";

const identityFields = ["commitSha", "repository", "runId", "runAttempt", "workflow", "job", "ref"];

const assertNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Security evidence ${field} must be a non-empty string`);
  }
};

const describeStream = (name, stream, field) => {
  if (typeof stream !== "string") throw new Error(`Security evidence ${name}.${field} must be text`);
  return {
    path: `${name}.${field}.txt`,
    bytes: Buffer.byteLength(stream),
    sha256: createHash("sha256").update(stream).digest("hex"),
  };
};

export const buildSecurityEvidenceManifest = (identity, results) => {
  for (const field of identityFields) assertNonEmptyString(identity?.[field], `identity.${field}`);
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Security evidence results must be a non-empty array");
  }

  return {
    schemaVersion: 1,
    identity: Object.fromEntries(identityFields.map((field) => [field, identity[field]])),
    results: results.map(({ name, command, exitCode, stdout, stderr }) => {
      assertNonEmptyString(name, "result.name");
      assertNonEmptyString(command, `${name}.command`);
      if (!Number.isInteger(exitCode)) throw new Error(`Security evidence ${name}.exitCode must be an integer`);
      return {
        name,
        command,
        exitCode,
        stdout: describeStream(name, stdout, "stdout"),
        stderr: describeStream(name, stderr, "stderr"),
      };
    }),
  };
};
