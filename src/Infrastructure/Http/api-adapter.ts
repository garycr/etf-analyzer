import {
  createServer,
  type IncomingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";

import {
  applicationCommandOperations,
  parseApplicationPayload,
  type ApplicationOperation,
} from "../../Application/application-boundary.js";
import { renderWorkbenchDocument } from "../Web/workbench.js";

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRoute {
  readonly method: ApiMethod;
  readonly pathPattern: RegExp;
  readonly pathParameters: readonly string[];
  readonly operation: ApplicationOperation;
}

const route = (
  method: ApiMethod,
  pathPattern: RegExp,
  pathParameters: readonly string[],
  operation: ApplicationOperation,
): ApiRoute => Object.freeze({
  method,
  pathPattern,
  pathParameters: Object.freeze(pathParameters),
  operation,
});

export const apiRoutes: readonly ApiRoute[] = Object.freeze([
  route("PUT", /^\/api\/v1\/watchlist\/items\/([^/]+)$/, ["instrumentId"], "WatchlistPut"),
  route("DELETE", /^\/api\/v1\/watchlist\/items\/([^/]+)$/, ["instrumentId"], "WatchlistRemove"),
  route("PUT", /^\/api\/v1\/watchlist\/order$/, [], "WatchlistReorder"),
  route("POST", /^\/api\/v1\/fixture-ingestions$/, [], "FixtureIngestionStart"),
  route("POST", /^\/api\/v1\/jobs\/([^/]+)\/restart$/, ["jobId"], "JobRestart"),
  route("POST", /^\/api\/v1\/analytics\/runs$/, [], "AnalyticsRun"),
  route("POST", /^\/api\/v1\/paper-orders$/, [], "PaperOrderDraftCreate"),
  route("POST", /^\/api\/v1\/paper-orders\/([^/]+)\/transitions$/, ["orderId"], "PaperOrderTransition"),
  route("POST", /^\/api\/v1\/diagnostic-exports$/, [], "DiagnosticsExportCreate"),
  route("GET", /^\/api\/v1\/watchlist$/, [], "WatchlistGet"),
  route("GET", /^\/api\/v1\/jobs\/([^/]+)$/, ["jobId"], "JobGet"),
  route("GET", /^\/api\/v1\/readiness$/, [], "ReadinessGet"),
  route("GET", /^\/api\/v1\/analytics\/results\/([^/]+)$/, ["publicationTargetId"], "AnalyticsResultGet"),
  route("GET", /^\/api\/v1\/evidence$/, [], "EvidenceGet"),
  route("GET", /^\/api\/v1\/paper-orders\/([^/]+)$/, ["orderId"], "PaperOrderGet"),
  route("GET", /^\/api\/v1\/portfolios\/([^/]+)$/, ["portfolioId"], "PortfolioGet"),
]);

export interface ApiAdapterConfig {
  readonly allowedOrigins: readonly string[];
  readonly bodyLimitBytes: number;
  readonly port: number;
}

export interface ApiRequest {
  readonly method: string;
  readonly target: string;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body: Uint8Array;
}

export interface ApiResponse {
  readonly status: number;
  readonly statusText: string;
  readonly detail: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export type ApiApplicationExecutor = (
  requestJson: string,
) => Readonly<Record<string, unknown>>;

const corsMethods = Object.freeze(["GET", "POST", "PUT", "DELETE"] as const);
const corsHeaders = Object.freeze([
  "Content-Type",
  "Accept",
  "X-Request-ID",
  "X-Correlation-ID",
  "X-Requested-At",
  "Idempotency-Key",
] as const);

const commands = new Set<ApplicationOperation>(applicationCommandOperations);
const bodyOperations = new Set<ApplicationOperation>([
  "WatchlistPut",
  "WatchlistReorder",
  "FixtureIngestionStart",
  "AnalyticsRun",
  "PaperOrderDraftCreate",
  "PaperOrderTransition",
  "DiagnosticsExportCreate",
]);
const createdOperations = new Set<ApplicationOperation>([
  "FixtureIngestionStart",
  "AnalyticsRun",
  "PaperOrderDraftCreate",
  "DiagnosticsExportCreate",
]);

const codesByStatus = Object.freeze({
  400: "APPLICATION_OPERATION_UNKNOWN,APPLICATION_REQUEST_INVALID,FIXTURE_MANIFEST_INVALID,FIXTURE_FILE_INTEGRITY_FAILED,FIXTURE_DATASET_HASH_MISMATCH,FIXTURE_TEMPORAL_INVALID,FIXTURE_DECIMAL_INVALID,FIXTURE_PROVENANCE_INVALID,FIXTURE_UNDECLARED_INPUT,FIXTURE_REQUIRED_MISSING,ANALYTICS_NUMERIC_CLASS_INVALID,ORDER_UNKNOWN_STATE,LEDGER_INVALID_DECIMAL,LEDGER_EXCESS_SCALE",
  403: "APPLICATION_UNAUTHORIZED,ANALYTICS_EVIDENCE_ACCESS_DENIED,ANALYTICS_RIGHTS_RESTRICTED",
  404: "APPLICATION_JOB_NOT_FOUND",
  409: "APPLICATION_IDEMPOTENCY_CONFLICT,ANALYTICS_IDEMPOTENCY_CONFLICT,ANALYTICS_PUBLICATION_VERSION_CONFLICT,ORDER_IDEMPOTENCY_CONFLICT,ORDER_VERSION_CONFLICT,FIXTURE_IDEMPOTENCY_CONFLICT,LEDGER_IDEMPOTENCY_CONFLICT,LEDGER_VERSION_CONFLICT",
  422: "APPLICATION_JOB_NOT_RESTARTABLE,ANALYTICS_INPUT_INCOMPLETE,ANALYTICS_INPUT_STALE,ANALYTICS_INPUT_QUARANTINED,ANALYTICS_AMBIGUOUS_VINTAGE,ANALYTICS_AMBIGUOUS_MARKET_REVISION,ANALYTICS_INTEGRITY_FAILED,ORDER_INVALID_TRANSITION,ORDER_GUARD_FAILED,ORDER_TERMINAL_STATE,FIXTURE_REQUIRED_PARTIAL,FIXTURE_REQUIRED_STALE,FIXTURE_REQUIRED_QUARANTINED,LEDGER_INSUFFICIENT_CASH,LEDGER_INSUFFICIENT_POSITION,LEDGER_REVERSAL_DEPENDENCY,LEDGER_ALREADY_REVERSED,LEDGER_BOUND_EXCEEDED",
  500: "APPLICATION_PERSISTENCE_FAILED,APPLICATION_REDACTION_FAILED,ANALYTICS_EVIDENCE_COMMIT_FAILED,ANALYTICS_DETERMINISM_FAILED,LEDGER_INTEGRITY_FAILED,LEDGER_FIFO_MISMATCH,LEDGER_RECONCILIATION_FAILED",
  503: "APPLICATION_DATABASE_UNAVAILABLE,APPLICATION_MIGRATIONS_INCOMPLETE,APPLICATION_CONFIGURATION_INVALID,APPLICATION_DEPENDENCY_UNAVAILABLE,ANALYTICS_CAPACITY_BLOCKED,ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
} as const);

export const applicationHttpStatusByCode: Readonly<Record<string, number>> =
  Object.freeze(Object.fromEntries(
    Object.entries(codesByStatus).flatMap(([status, codes]) =>
      codes.split(",").map((code) => [code, Number(status)] as const),
    ),
  ));

export function httpStatusForApplicationResult(
  operation: ApplicationOperation,
  result: Readonly<Record<string, unknown>>,
): number {
  return applicationStatusForResult(operation, result) ?? 500;
}

function applicationStatusForResult(
  operation: ApplicationOperation,
  result: Readonly<Record<string, unknown>>,
): number | undefined {
  if (result.operation !== operation) return undefined;
  if (result.outcome === "Succeeded") {
    return createdOperations.has(operation) ? 201 : 200;
  }
  if (result.outcome !== "Failed") return undefined;
  const error = result.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) return undefined;
  const code = (error as Readonly<Record<string, unknown>>).code;
  return typeof code === "string"
    ? applicationHttpStatusByCode[code]
    : undefined;
}

function header(
  headers: ApiRequest["headers"],
  name: string,
): string | undefined {
  const entry = Object.entries(headers).find(
    ([candidate]) => candidate.toLowerCase() === name,
  )?.[1];
  return typeof entry === "string" ? entry : undefined;
}

function problem(
  status: number,
  type: string,
  statusText: string,
  detail: string,
  allowedOrigin?: string,
): ApiResponse {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (allowedOrigin !== undefined) {
    headers["access-control-allow-origin"] = allowedOrigin;
    headers.vary = "Origin";
  }
  return Object.freeze({
    status,
    statusText,
    detail,
    headers: Object.freeze(headers),
    body: JSON.stringify({ type, title: statusText, status, detail }),
  });
}

function internalServerError(allowedOrigin?: string): ApiResponse {
  return problem(
    500,
    "internal-server-error",
    "Internal Server Error",
    "The request could not be completed.",
    allowedOrigin,
  );
}

function isAllowedOriginConfiguration(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" &&
      parsed.hostname === "127.0.0.1" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "";
  } catch {
    return false;
  }
}

function validateConfig(config: ApiAdapterConfig): void {
  if (!Number.isSafeInteger(config.port) || config.port < 0 || config.port > 65_535) {
    throw new TypeError("API port must be an integer from 0 through 65535");
  }
  if (!Number.isSafeInteger(config.bodyLimitBytes) || config.bodyLimitBytes <= 0) {
    throw new TypeError("API body limit must be a positive safe integer");
  }
  if (
    config.allowedOrigins.length === 0 ||
    new Set(config.allowedOrigins).size !== config.allowedOrigins.length ||
    config.allowedOrigins.some((origin) => !isAllowedOriginConfiguration(origin))
  ) {
    throw new TypeError("API origins must be unique 127.0.0.1 HTTP origins");
  }
}

function allowedOriginForHeaders(
  headers: IncomingHttpHeaders,
  config: ApiAdapterConfig,
): string | undefined {
  if (header(headers, "host") !== `127.0.0.1:${config.port}`) return undefined;
  const origin = header(headers, "origin");
  return origin !== undefined && config.allowedOrigins.includes(origin)
    ? origin
    : undefined;
}

function writeApiResponse(response: ServerResponse, apiResponse: ApiResponse): void {
  response.statusCode = apiResponse.status;
  for (const [name, value] of Object.entries(apiResponse.headers)) {
    response.setHeader(name, value);
  }
  response.end(apiResponse.body);
}

function acceptsMediaType(
  accept: string | undefined,
  expectedType: string,
): boolean {
  if (accept === undefined) return true;
  const [expectedGroup] = expectedType.split("/");
  return accept.split(",").some((entry) => {
    const [mediaType, ...parameters] = entry.trim().toLowerCase().split(";");
    const quality = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith("q="));
    if (quality === "q=0" || quality === "q=0.0" || quality === "q=0.00" || quality === "q=0.000") {
      return false;
    }
    return mediaType === expectedType || mediaType === `${expectedGroup}/*` || mediaType === "*/*";
  });
}

function workbenchResponse(
  headers: IncomingHttpHeaders,
  config: ApiAdapterConfig,
): ApiResponse {
  if (header(headers, "host") !== `127.0.0.1:${config.port}`) {
    return problem(400, "invalid-host", "Invalid Host", "The request Host is not the configured loopback API.");
  }
  const accept = header(headers, "accept");
  if (!acceptsMediaType(accept, "text/html")) {
    return problem(406, "unacceptable-response-type", "Not Acceptable", "The workbench returns only text/html.");
  }
  return Object.freeze({
    status: 200,
    statusText: "OK",
    detail: "",
    headers: Object.freeze({
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    }),
    body: renderWorkbenchDocument({ readiness: "Ready" }),
  });
}

function preflightResponse(
  headers: IncomingHttpHeaders,
  config: ApiAdapterConfig,
): ApiResponse {
  const host = header(headers, "host");
  if (host !== `127.0.0.1:${config.port}`) {
    return problem(400, "invalid-host", "Invalid Host", "The request Host is not the configured loopback API.");
  }
  const origin = header(headers, "origin");
  if (origin === undefined || !config.allowedOrigins.includes(origin)) {
    return problem(403, "disallowed-origin", "Disallowed Origin", "The request Origin is not an allowed local workbench origin.");
  }
  const requestedMethod = header(headers, "access-control-request-method");
  const requestedHeaders = (header(headers, "access-control-request-headers") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  const allowedHeaders = new Set(corsHeaders.map((value) => value.toLowerCase()));
  if (
    requestedMethod === undefined ||
    !corsMethods.includes(requestedMethod as (typeof corsMethods)[number]) ||
    requestedHeaders.some((value) => !allowedHeaders.has(value))
  ) {
    return problem(400, "malformed-json", "Invalid Preflight", "The CORS preflight method or headers are not allowed.", origin);
  }
  return Object.freeze({
    status: 204,
    statusText: "No Content",
    detail: "",
    headers: Object.freeze({
      "access-control-allow-origin": origin,
      "access-control-allow-methods": corsMethods.join(", "),
      "access-control-allow-headers": corsHeaders.join(", "),
      vary: "Origin",
    }),
    body: "",
  });
}

export function startLoopbackApiServer(
  config: ApiAdapterConfig,
  execute: ApiApplicationExecutor,
): Promise<Server> {
  validateConfig(config);
  const server = createServer((request, response) => {
    const localAddress = request.socket.address();
    const localPort = typeof localAddress === "object" && "port" in localAddress
      ? localAddress.port
      : config.port;
    const requestConfig = Object.freeze({ ...config, port: localPort });
    if (
      request.method === "GET" &&
      parseTarget(request.url ?? "")?.pathname === "/"
    ) {
      request.resume();
      try {
        writeApiResponse(response, workbenchResponse(request.headers, requestConfig));
      } catch {
        writeApiResponse(response, internalServerError());
      }
      return;
    }
    if (request.method === "OPTIONS") {
      request.resume();
      try {
        writeApiResponse(response, preflightResponse(request.headers, requestConfig));
      } catch {
        writeApiResponse(response, internalServerError(
          allowedOriginForHeaders(request.headers, requestConfig),
        ));
      }
      return;
    }

    const chunks: Uint8Array[] = [];
    let length = 0;
    let tooLarge = false;
    request.on("error", () => {
      if (!response.headersSent) writeApiResponse(response, internalServerError(
        allowedOriginForHeaders(request.headers, requestConfig),
      ));
    });
    request.on("data", (chunk: Buffer) => {
      length += chunk.length;
      if (length > config.bodyLimitBytes) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        writeApiResponse(response, problem(
          413,
          "request-too-large",
          "Request Too Large",
          "The request exceeds the configured body limit.",
          allowedOriginForHeaders(request.headers, requestConfig),
        ));
        return;
      }
      const body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
      try {
        writeApiResponse(response, adaptApiRequest({
          method: request.method ?? "",
          target: request.url ?? "",
          headers: request.headers,
          body,
        }, requestConfig, execute));
      } catch {
        writeApiResponse(response, internalServerError(
          allowedOriginForHeaders(request.headers, requestConfig),
        ));
      }
    });
  });

  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(config.port, "127.0.0.1");
  });
}

function parseTarget(target: string): URL | undefined {
  try {
    return new URL(target, "http://127.0.0.1");
  } catch {
    return undefined;
  }
}

function mergeField(
  payload: Record<string, unknown>,
  name: string,
  value: string,
): boolean {
  if (name in payload && payload[name] !== value) return false;
  payload[name] = value;
  return true;
}

function buildPayload(
  routeDefinition: ApiRoute,
  target: URL,
  body: Uint8Array,
): Record<string, unknown> | undefined {
  let payload: Record<string, unknown> = {};
  if (bodyOperations.has(routeDefinition.operation)) {
    try {
      const bodyText = new TextDecoder("utf-8", { fatal: true }).decode(body);
      payload = { ...parseApplicationPayload(bodyText) };
    } catch {
      return undefined;
    }
  } else if (body.length !== 0) {
    return undefined;
  }

  const pathMatch = routeDefinition.pathPattern.exec(target.pathname);
  if (pathMatch === null) return undefined;
  for (const [index, name] of routeDefinition.pathParameters.entries()) {
    const encodedValue = pathMatch[index + 1];
    if (encodedValue === undefined) return undefined;
    let value: string;
    try {
      value = decodeURIComponent(encodedValue);
    } catch {
      return undefined;
    }
    if (!mergeField(payload, name, value)) return undefined;
  }

  const queryParameters = routeDefinition.operation === "WatchlistRemove"
    ? ["expectedVersion"]
    : routeDefinition.operation === "EvidenceGet"
      ? ["evidenceId"]
      : routeDefinition.operation === "PortfolioGet"
        ? ["asOf"]
        : [];
  if (target.searchParams.size !== queryParameters.length) return undefined;
  for (const name of queryParameters) {
    const values = target.searchParams.getAll(name);
    if (values.length !== 1 || !mergeField(payload, name, values[0]!)) return undefined;
  }
  return payload;
}

export function adaptApiRequest(
  request: ApiRequest,
  config: ApiAdapterConfig,
  execute: ApiApplicationExecutor,
): ApiResponse {
  if (header(request.headers, "host") !== `127.0.0.1:${config.port}`) {
    return problem(400, "invalid-host", "Invalid Host", "The request Host is not the configured loopback API.");
  }
  const origin = header(request.headers, "origin");
  if (origin !== undefined && !config.allowedOrigins.includes(origin)) {
    return problem(403, "disallowed-origin", "Disallowed Origin", "The request Origin is not an allowed local workbench origin.");
  }
  const allowedOrigin = origin !== undefined ? origin : undefined;
  const accept = header(request.headers, "accept");
  if (accept !== undefined && accept !== "application/json" && accept !== "*/*") {
    return problem(406, "unacceptable-response-type", "Not Acceptable", "The API returns only application/json.", allowedOrigin);
  }
  if (request.body.length > config.bodyLimitBytes) {
    return problem(413, "request-too-large", "Request Too Large", "The request exceeds the configured body limit.", allowedOrigin);
  }

  const routeDefinition = resolveApiRoute(request.method, request.target);
  if (routeDefinition === undefined) {
    return problem(400, "malformed-json", "Invalid Request", "The method and path do not identify a reviewed API operation.", allowedOrigin);
  }
  if (
    bodyOperations.has(routeDefinition.operation) &&
    header(request.headers, "content-type") !== "application/json"
  ) {
    return problem(415, "unsupported-media-type", "Unsupported Media Type", "The request body must be UTF-8 application/json.", allowedOrigin);
  }

  const target = parseTarget(request.target);
  const payload = target === undefined
    ? undefined
    : buildPayload(routeDefinition, target, request.body);
  if (payload === undefined) {
    return problem(400, "malformed-json", "Malformed JSON", "The request payload is malformed or does not match its transport fields.", allowedOrigin);
  }

  const requestId = header(request.headers, "x-request-id");
  const correlationId = header(request.headers, "x-correlation-id");
  const requestedAt = header(request.headers, "x-requested-at");
  const commandId = header(request.headers, "idempotency-key");
  if (
    requestId === undefined ||
    correlationId === undefined ||
    requestedAt === undefined ||
    (commands.has(routeDefinition.operation) ? commandId === undefined : commandId !== undefined)
  ) {
    return problem(400, "malformed-json", "Invalid Request", "Required request identities are missing, duplicated, or not allowed.", allowedOrigin);
  }

  const envelope: Record<string, unknown> = {
    operation: routeDefinition.operation,
    requestId,
    correlationId,
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt,
    ...(commands.has(routeDefinition.operation) ? { commandId } : {}),
    payload,
  };
  const result = execute(JSON.stringify(envelope));
  const status = applicationStatusForResult(routeDefinition.operation, result);
  if (status === undefined) return internalServerError(allowedOrigin);
  const responseHeaders: Record<string, string> = { "content-type": "application/json" };
  if (origin !== undefined) {
    responseHeaders["access-control-allow-origin"] = origin;
    responseHeaders.vary = "Origin";
  }
  return Object.freeze({
    status,
    statusText: status === 201 ? "Created" : status === 200 ? "OK" : "Application Failure",
    detail: "",
    headers: Object.freeze(responseHeaders),
    body: JSON.stringify(result),
  });
}

export function resolveApiRoute(
  method: string,
  requestTarget: string,
): ApiRoute | undefined {
  const target = parseTarget(requestTarget);
  if (target === undefined) return undefined;

  return apiRoutes.find(
    (candidate) => candidate.method === method && candidate.pathPattern.test(target.pathname),
  );
}
