import type { AddressInfo } from "node:net";

import pg from "pg";

import { executeApplicationRequestAsync } from "../../Application/application-boundary.js";
import { startLoopbackApiServer, type ApiAdapterConfig } from "../Http/api-adapter.js";
import { createPostgresApplicationReplayStore } from "../PostgreSQL/application-replay-store.js";
import { dispatchPostgresPaperOrder } from "../PostgreSQL/paper-order-owner.js";
import {
  checkPostgresBaseline,
  checkPostgresMigrationState,
  checkPostgresSchemaManifest,
} from "../PostgreSQL/readiness.js";
import {
  dispatchPostgresWorkflowOperation,
  type WorkflowArtifactResolver,
  type WorkflowQueryClient,
} from "../PostgreSQL/workflow-owner.js";
import {
  loadLocalArtifactResolver,
  type LocalArtifactConfig,
} from "./artifact-loader.js";

export interface LocalRuntimeConfig extends LocalArtifactConfig {
  readonly controlConnectionString: string;
  readonly connectionString: string;
  readonly port: number;
  readonly allowedOrigins: readonly string[];
  readonly bodyLimitBytes: number;
  readonly requestTimeoutMs?: number;
}

interface LocalRuntimeClient extends WorkflowQueryClient {
  connect(): Promise<void>;
  end(): Promise<void>;
}

interface LocalRuntimeServer {
  address(): AddressInfo | string | null;
  close(callback: (error?: Error) => void): unknown;
}

export interface LocalRuntimeDependencies {
  readonly createClient: (connectionString: string) => LocalRuntimeClient;
  readonly loadArtifactResolver: (config: LocalRuntimeConfig) => Promise<WorkflowArtifactResolver>;
  readonly startServer: (
    config: ApiAdapterConfig,
    execute: (requestJson: string) => Promise<Readonly<Record<string, unknown>>>,
  ) => Promise<LocalRuntimeServer>;
  readonly now: () => string;
  readonly dispatchPaperOrder?: typeof dispatchPostgresPaperOrder;
  readonly dispatchWorkflow?: typeof dispatchPostgresWorkflowOperation;
  readonly verifyStartup?: (
    config: LocalRuntimeConfig,
    runtimeClient: WorkflowQueryClient,
  ) => Promise<void>;
}

export interface LocalRuntime {
  readonly address: Readonly<{ host: "127.0.0.1"; port: number }>;
  close(): Promise<void>;
}

async function verifyStartup(
  config: LocalRuntimeConfig,
  runtimeClient: WorkflowQueryClient,
): Promise<void> {
  const controlClient = new pg.Client({ connectionString: config.controlConnectionString });
  await controlClient.connect();
  try {
    for (const result of [
      await checkPostgresBaseline(controlClient),
      await checkPostgresMigrationState(controlClient),
      await checkPostgresSchemaManifest(controlClient),
    ]) {
      if (!result.ready) throw new Error(result.errorCode);
    }
  } finally {
    await controlClient.end();
  }
  const readiness = await runtimeClient.query("SELECT etf.readiness_get() AS result", []);
  const result = readiness.rows[0]?.result;
  if (
    readiness.rows.length !== 1 ||
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    !Object.hasOwn(result, "readiness") ||
    (result as Readonly<Record<string, unknown>>).readiness === null ||
    typeof (result as Readonly<Record<string, unknown>>).readiness !== "object" ||
    ((result as Readonly<Record<string, unknown>>).readiness as Readonly<Record<string, unknown>>).state !== "Ready"
  ) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
}

const defaultDependencies: LocalRuntimeDependencies = {
  createClient: (connectionString) => new pg.Client({ connectionString }),
  loadArtifactResolver: loadLocalArtifactResolver,
  startServer: startLoopbackApiServer,
  now: () => new Date().toISOString(),
  verifyStartup,
};

function closeServer(server: LocalRuntimeServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

export async function startLocalRuntime(
  config: LocalRuntimeConfig,
  dependencies: LocalRuntimeDependencies = defaultDependencies,
): Promise<LocalRuntime> {
  const dispatchPaperOrder = dependencies.dispatchPaperOrder ?? dispatchPostgresPaperOrder;
  const dispatchWorkflow = dependencies.dispatchWorkflow ?? dispatchPostgresWorkflowOperation;
  const resolver = await dependencies.loadArtifactResolver(config);
  const client = dependencies.createClient(config.connectionString);
  await client.connect();
  let server: LocalRuntimeServer;
  try {
    await (dependencies.verifyStartup ?? verifyStartup)(config, client);
    const execute = (requestJson: string) => executeApplicationRequestAsync(requestJson, {
      replayStore: createPostgresApplicationReplayStore(client),
      completedAt: dependencies.now,
      checkReadiness: () => undefined,
      ownerDispatch: (definition, payload, context) => {
        if (definition.operation === "PaperOrderDraftCreate" || definition.operation === "PaperOrderTransition") {
          return dispatchPaperOrder(client, definition, payload, context);
        }
        return dispatchWorkflow(
          client,
          resolver,
          dependencies.now,
          definition,
          payload,
          context,
        );
      },
    });
    server = await dependencies.startServer({
      allowedOrigins: config.allowedOrigins,
      bodyLimitBytes: config.bodyLimitBytes,
      port: config.port,
      ...(config.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: config.requestTimeoutMs }),
    }, execute);
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
  const address = server.address();
  if (address === null || typeof address === "string") {
    await closeServer(server).catch(() => undefined);
    await client.end().catch(() => undefined);
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  let closing: Promise<void> | undefined;
  return Object.freeze({
    address: Object.freeze({ host: "127.0.0.1" as const, port: address.port }),
    close() {
      closing ??= closeServer(server).then(() => client.end());
      return closing;
    },
  });
}
