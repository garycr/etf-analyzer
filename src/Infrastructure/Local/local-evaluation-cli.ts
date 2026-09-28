import { pathToFileURL } from "node:url";

import { prepareLocalEvaluation } from "./local-evaluation-provisioner.js";

interface LocalEvaluationCliDependencies {
  readonly now: () => Date;
  readonly prepare: typeof prepareLocalEvaluation;
  readonly write: (value: string) => void;
}

export async function runLocalEvaluationCli(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  dependencies: LocalEvaluationCliDependencies = {
    now: () => new Date(),
    prepare: prepareLocalEvaluation,
    write: (value) => process.stdout.write(value),
  },
): Promise<void> {
  if (argv.length !== 3 || argv[2] === undefined) {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  const result = await dependencies.prepare(
    argv[2],
    environment.ETF_POSTGRES_ADMIN_URL,
    environment.ETF_EVALUATION_APPLIED_AT ?? dependencies.now().toISOString(),
  );
  dependencies.write(`${JSON.stringify(result)}\n`);
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  runLocalEvaluationCli(process.argv, process.env).catch((error: unknown) => {
    const code = error instanceof Error ? error.message : "APPLICATION_CONFIGURATION_INVALID";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
