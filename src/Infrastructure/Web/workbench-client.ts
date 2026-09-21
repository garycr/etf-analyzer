interface WatchlistItem {
  readonly instrumentId: string;
  readonly displayName: string;
  readonly validationState: "Valid" | "Invalid";
  readonly position: string;
}

interface WatchlistState {
  readonly orderedItems: readonly WatchlistItem[];
  readonly version: string;
}

export interface WorkbenchClientDegradedEvent {
  readonly code: "WORKBENCH_CLIENT_DEGRADED";
  readonly stage: "Watchlist" | "PaperOrder";
  readonly reason: "TransportFailed" | "ReloadFailed";
}

export interface WatchlistMutationRequest {
  readonly method: "PUT" | "DELETE";
  readonly path: string;
  readonly body?: Readonly<Record<string, unknown>>;
}

export interface WatchlistMutationDisposition {
  readonly action: "Reload" | "Alert";
  readonly message: string;
}

export interface WatchlistMutationDependencies {
  readonly send: (
    request: WatchlistMutationRequest,
  ) => Promise<{
    readonly status: number;
    readonly result: Readonly<Record<string, unknown>>;
  }>;
  readonly reload: (message: string) => Promise<void>;
  readonly alert: (message: string) => void;
  readonly degraded?: (event: WorkbenchClientDegradedEvent) => void;
}

export interface PaperOrderTransitionRequest {
  readonly method: "POST";
  readonly path: string;
  readonly body: Readonly<{
    transitionCommandId: string;
    expectedVersion: string;
    transition: "OT-02";
    transitionPayload: Readonly<{
      confirmation: Readonly<{
        actorId: "local-user";
        confirmedAt: string;
        confirmationText: "Submit paper order";
      }>;
    }>;
  }>;
}

export interface PaperOrderTransitionDisposition {
  readonly action: "Reload" | "Alert";
  readonly message: string;
}

export interface PaperOrderTransitionDependencies {
  readonly send: (
    request: PaperOrderTransitionRequest,
  ) => Promise<{
    readonly status: number;
    readonly result: Readonly<Record<string, unknown>>;
  }>;
  readonly reload: (message: string) => Promise<void>;
  readonly alert: (message: string) => void;
  readonly degraded?: (event: WorkbenchClientDegradedEvent) => void;
}

export function buildPaperOrderSubmission(
  orderId: string,
  expectedVersion: string,
  transitionCommandId: string,
  confirmedAt: string,
): PaperOrderTransitionRequest {
  return {
    method: "POST",
    path: `/api/v1/paper-orders/${encodeURIComponent(orderId)}/transitions`,
    body: {
      transitionCommandId,
      expectedVersion,
      transition: "OT-02",
      transitionPayload: {
        confirmation: {
          actorId: "local-user",
          confirmedAt,
          confirmationText: "Submit paper order",
        },
      },
    },
  };
}

const authoritativePaperOrderErrors: Readonly<Record<string, string>> = Object.freeze({
  ORDER_INVALID_TRANSITION: "The paper order transition is not allowed.",
  ORDER_GUARD_FAILED: "The paper order transition guard failed.",
  ORDER_TERMINAL_STATE: "The paper order is already in a terminal state.",
  ORDER_VERSION_CONFLICT: "The paper order changed. Reload the current order before retrying.",
});

export function classifyPaperOrderTransition(
  status: number,
  result: Readonly<Record<string, unknown>>,
): PaperOrderTransitionDisposition {
  if (result.outcome === "Succeeded") {
    return { action: "Reload", message: "Paper order submitted. Reloaded the authoritative order." };
  }
  const error = result.error;
  const errorRecord = typeof error === "object" && error !== null && !Array.isArray(error)
    ? error as Readonly<Record<string, unknown>>
    : undefined;
  const code = typeof errorRecord?.code === "string" ? errorRecord.code : undefined;
  const canonicalMessage = code === undefined ? undefined : authoritativePaperOrderErrors[code];
  return canonicalMessage !== undefined
    ? { action: "Reload", message: `${canonicalMessage} Reloaded the authoritative order.` }
    : { action: "Alert", message: "The paper order could not be submitted." };
}

export async function executePaperOrderTransition(
  request: PaperOrderTransitionRequest,
  dependencies: PaperOrderTransitionDependencies,
): Promise<boolean> {
  let response: {
    readonly status: number;
    readonly result: Readonly<Record<string, unknown>>;
  };
  try {
    response = await dependencies.send(request);
  } catch {
    dependencies.degraded?.({
      code: "WORKBENCH_CLIENT_DEGRADED",
      stage: "PaperOrder",
      reason: "TransportFailed",
    });
    dependencies.alert(
      "The paper order could not be submitted. Retry the request or review local diagnostics.",
    );
    return false;
  }
  const disposition = classifyPaperOrderTransition(response.status, response.result);
  if (disposition.action === "Reload") {
    try {
      await dependencies.reload(disposition.message);
    } catch {
      dependencies.degraded?.({
        code: "WORKBENCH_CLIENT_DEGRADED",
        stage: "PaperOrder",
        reason: "ReloadFailed",
      });
      dependencies.alert(
        "The paper order could not be reloaded. Retry the request or review local diagnostics.",
      );
      return false;
    }
    return response.result.outcome === "Succeeded";
  }
  dependencies.alert(disposition.message);
  return false;
}

export function buildWatchlistPut(
  instrumentId: string,
  displayName: string,
  expectedVersion: string,
): WatchlistMutationRequest {
  return {
    method: "PUT",
    path: `/api/v1/watchlist/items/${encodeURIComponent(instrumentId)}`,
    body: { displayName, expectedVersion },
  };
}

export function buildWatchlistRemove(
  instrumentId: string,
  expectedVersion: string,
): WatchlistMutationRequest {
  return {
    method: "DELETE",
    path: `/api/v1/watchlist/items/${encodeURIComponent(instrumentId)}?expectedVersion=${encodeURIComponent(expectedVersion)}`,
  };
}

export function buildWatchlistReorder(
  orderedInstrumentIds: readonly string[],
  expectedVersion: string,
): WatchlistMutationRequest {
  return {
    method: "PUT",
    path: "/api/v1/watchlist/order",
    body: { orderedInstrumentIds: [...orderedInstrumentIds], expectedVersion },
  };
}

export function classifyWatchlistMutation(
  status: number,
  result: Readonly<Record<string, unknown>>,
): WatchlistMutationDisposition {
  if (result.outcome === "Succeeded") {
    return { action: "Reload", message: "Watchlist updated." };
  }
  const error = result.error;
  const errorRecord = typeof error === "object" && error !== null && !Array.isArray(error)
    ? error as Readonly<Record<string, unknown>>
    : undefined;
  const message = typeof errorRecord?.message === "string"
    ? errorRecord.message
    : "The watchlist could not be updated.";
  return status === 409 || errorRecord?.code === "APPLICATION_REQUEST_INVALID"
    ? { action: "Reload", message: `${message} Reloaded the current watchlist.` }
    : { action: "Alert", message };
}

export async function executeWatchlistMutation(
  request: WatchlistMutationRequest,
  dependencies: WatchlistMutationDependencies,
): Promise<boolean> {
  let response: {
    readonly status: number;
    readonly result: Readonly<Record<string, unknown>>;
  };
  try {
    response = await dependencies.send(request);
  } catch {
    dependencies.degraded?.({
      code: "WORKBENCH_CLIENT_DEGRADED",
      stage: "Watchlist",
      reason: "TransportFailed",
    });
    dependencies.alert(
      "The watchlist could not be updated. Retry the request or review local diagnostics.",
    );
    return false;
  }
  const { status, result } = response;
  const disposition = classifyWatchlistMutation(status, result);
  if (disposition.action === "Reload") {
    try {
      await dependencies.reload(disposition.message);
    } catch {
      dependencies.degraded?.({
        code: "WORKBENCH_CLIENT_DEGRADED",
        stage: "Watchlist",
        reason: "ReloadFailed",
      });
      dependencies.alert(
        "The watchlist could not be reloaded. Retry the request or review local diagnostics.",
      );
      return false;
    }
    return result.outcome === "Succeeded";
  }
  dependencies.alert(disposition.message);
  return false;
}

export function moveWatchlistItem(
  identities: readonly string[],
  instrumentId: string,
  direction: "up" | "down",
): string[] {
  const reordered = [...identities];
  const index = reordered.indexOf(instrumentId);
  const destination = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || destination < 0 || destination >= reordered.length) return reordered;
  [reordered[index], reordered[destination]] = [reordered[destination]!, reordered[index]!];
  return reordered;
}

export function targetAfterWatchlistRemoval(
  identities: readonly string[],
  instrumentId: string,
): string | null {
  const index = identities.indexOf(instrumentId);
  if (index < 0) return null;
  return identities[index + 1] ?? identities[index - 1] ?? null;
}

function requestHeaders(command: boolean): Record<string, string> {
  return {
    accept: "application/json",
    "x-request-id": crypto.randomUUID(),
    "x-correlation-id": crypto.randomUUID(),
    "x-requested-at": new Date().toISOString(),
    ...(command
      ? {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      }
      : {}),
  };
}

async function applicationRequest(
  method: string,
  path: string,
  body?: Readonly<Record<string, unknown>>,
): Promise<{ readonly response: Response; readonly result: Readonly<Record<string, unknown>> }> {
  const response = await fetch(path, {
    method,
    headers: requestHeaders(method !== "GET"),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json() as Readonly<Record<string, unknown>>;
  return { response, result };
}

export function admitWatchlistState(
  result: Readonly<Record<string, unknown>>,
): WatchlistState {
  const data = result.data;
  if (
    result.operation !== "WatchlistGet" ||
    result.outcome !== "Succeeded" ||
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data)
  ) throw new TypeError("WatchlistGet did not return an authoritative state");
  const record = data as Readonly<Record<string, unknown>>;
  if (
    !Array.isArray(record.orderedItems) ||
    !record.orderedItems.every((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
      const candidate = item as Readonly<Record<string, unknown>>;
      return typeof candidate.instrumentId === "string" &&
        typeof candidate.displayName === "string" &&
        (candidate.validationState === "Valid" || candidate.validationState === "Invalid") &&
        isUInt(candidate.position);
    }) ||
    !isUInt(record.version)
  ) {
    throw new TypeError("WatchlistGet data is invalid");
  }
  return {
    orderedItems: record.orderedItems as readonly WatchlistItem[],
    version: record.version,
  };
}

function isUInt(value: unknown): value is string {
  return typeof value === "string" &&
    /^(0|[1-9][0-9]*)$/.test(value) &&
    (value.length < 16 || (value.length === 16 && value <= "9007199254740991"));
}

function actionButton(
  action: "move-up" | "move-down" | "remove",
  label: string,
  disabled = false,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.dataset.boundaryDisabled = String(disabled);
  button.textContent = label;
  button.disabled = disabled;
  return button;
}

function renderWatchlist(state: WatchlistState): void {
  const controls = document.querySelector<HTMLElement>("#watchlist-controls");
  const list = document.querySelector<HTMLOListElement>("#watchlist-items");
  const version = document.querySelector<HTMLElement>("#watchlist-version");
  const empty = document.querySelector<HTMLElement>("#watchlist-empty");
  if (controls === null || list === null || version === null || empty === null) return;
  controls.dataset.version = state.version;
  version.textContent = `Watchlist version ${state.version}`;
  empty.hidden = state.orderedItems.length !== 0;
  list.replaceChildren();

  state.orderedItems.forEach((item, index) => {
    const entry = document.createElement("li");
    entry.dataset.instrumentId = item.instrumentId;
    entry.dataset.position = item.position;
    const name = document.createElement("strong");
    name.textContent = item.displayName;
    const identity = document.createElement("code");
    identity.textContent = item.instrumentId;
    const validation = document.createElement("span");
    validation.textContent = `Validation: ${item.validationState}`;
    const actions = document.createElement("div");
    actions.className = "watchlist-actions";
    actions.append(
      actionButton("move-up", `Move ${item.displayName} up`, index === 0),
      actionButton(
        "move-down",
        `Move ${item.displayName} down`,
        index === state.orderedItems.length - 1,
      ),
      actionButton("remove", `Remove ${item.displayName}`),
    );
    entry.append(name, identity, validation, actions);
    list.append(entry);
  });
}

function announce(message: string, error = false): void {
  const status = document.querySelector<HTMLElement>("#watchlist-status");
  if (status === null) return;
  status.setAttribute("role", error ? "alert" : "status");
  status.setAttribute("aria-live", error ? "assertive" : "polite");
  status.textContent = message;
}

function announcePaperOrder(message: string, error = false): void {
  const status = document.querySelector<HTMLElement>("#paper-order-status");
  if (status === null) return;
  status.setAttribute("role", error ? "alert" : "status");
  status.setAttribute("aria-live", error ? "assertive" : "polite");
  status.textContent = message;
}

const paperOrderStatusKey = "workbench:paper-order-status";
let paperOrderSubmissionInFlight = false;

async function reloadPaperOrder(message: string): Promise<void> {
  sessionStorage.setItem(paperOrderStatusKey, message);
  window.location.reload();
}

function restorePaperOrderOutcome(): void {
  const message = sessionStorage.getItem(paperOrderStatusKey);
  if (message === null) return;
  sessionStorage.removeItem(paperOrderStatusKey);
  announcePaperOrder(message);
  const restoreFocus = () => document.querySelector<HTMLElement>("#order-status")?.focus();
  if (document.readyState === "complete") {
    restoreFocus();
  } else {
    window.addEventListener("load", restoreFocus, { once: true });
  }
}

async function submitPaperOrder(button: HTMLButtonElement): Promise<void> {
  if (paperOrderSubmissionInFlight) return;
  paperOrderSubmissionInFlight = true;
  try {
    if (!window.confirm("Submit this hypothetical paper order?")) {
      announcePaperOrder("Paper order submission canceled.");
      button.focus();
      return;
    }
    const details = button.closest<HTMLElement>("#paper-order-details");
    const orderId = details?.dataset.orderId;
    const expectedVersion = details?.dataset.version;
    if (orderId === undefined || expectedVersion === undefined) {
      announcePaperOrder(
        "The paper order could not be submitted. Reload the page and try again.",
        true,
      );
      button.focus();
      return;
    }
    const request = buildPaperOrderSubmission(
      orderId,
      expectedVersion,
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    announcePaperOrder("Submitting paper order.");
    button.disabled = true;
    await executePaperOrderTransition(request, {
      send: async (command) => {
        const { response, result } = await applicationRequest(
          command.method,
          command.path,
          command.body,
        );
        return { status: response.status, result };
      },
      reload: reloadPaperOrder,
      alert: (message) => {
        announcePaperOrder(message, true);
        button.focus();
      },
      degraded: (event) => document.dispatchEvent(new CustomEvent(
        "workbench:degraded",
        { detail: event },
      )),
    });
  } finally {
    paperOrderSubmissionInFlight = false;
    button.disabled = false;
  }
}

async function loadWatchlist(message: string): Promise<void> {
  const { result } = await applicationRequest("GET", "/api/v1/watchlist");
  renderWatchlist(admitWatchlistState(result));
  announce(message);
}

function setWatchlistBusy(busy: boolean): void {
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
    "#watchlist-controls input, #watchlist-controls button",
  ).forEach((control) => {
    control.disabled = busy || control.dataset.boundaryDisabled === "true";
  });
}

function focusWatchlistAction(
  instrumentId: string | null,
  action: "move-up" | "move-down" | "remove",
): void {
  if (instrumentId === null) {
    document.querySelector<HTMLButtonElement>("#watchlist-form button[type='submit']")?.focus();
    return;
  }
  const item = [...document.querySelectorAll<HTMLElement>("#watchlist-items > li")]
    .find((candidate) => candidate.dataset.instrumentId === instrumentId);
  const requested = item?.querySelector<HTMLButtonElement>(`button[data-action='${action}']`);
  const target = requested !== undefined && requested !== null && !requested.disabled
    ? requested
    : item?.querySelector<HTMLButtonElement>("button:not(:disabled)");
  (target ?? document.querySelector<HTMLButtonElement>(
    "#watchlist-form button[type='submit']",
  ))?.focus();
}

function currentVersion(): string {
  const version = document.querySelector<HTMLElement>("#watchlist-controls")?.dataset.version;
  if (version === undefined || version === "") throw new TypeError("Watchlist version is unavailable");
  return version;
}

async function mutateWatchlist(
  request: WatchlistMutationRequest,
  focusTarget?: Readonly<{
    instrumentId: string | null;
    action: "move-up" | "move-down" | "remove";
  }>,
): Promise<boolean> {
  announce("Updating watchlist.");
  setWatchlistBusy(true);
  try {
    return await executeWatchlistMutation(request, {
      send: async (command) => {
        const { response, result } = await applicationRequest(
          command.method,
          command.path,
          command.body,
        );
        return { status: response.status, result };
      },
      reload: async (message) => {
        await loadWatchlist(message);
        if (focusTarget !== undefined) {
          focusWatchlistAction(focusTarget.instrumentId, focusTarget.action);
        }
      },
      alert: (message) => announce(message, true),
      degraded: (event) => document.dispatchEvent(new CustomEvent(
        "workbench:degraded",
        { detail: event },
      )),
    });
  } finally {
    setWatchlistBusy(false);
  }
}

function orderedInstrumentIds(): string[] {
  return [...document.querySelectorAll<HTMLElement>("#watchlist-items > li")]
    .map((item) => item.dataset.instrumentId)
    .filter((identity): identity is string => identity !== undefined);
}

function startWorkbenchClient(): void {
  restorePaperOrderOutcome();

  const form = document.querySelector<HTMLFormElement>("#watchlist-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const instrumentId = String(data.get("instrumentId") ?? "").trim();
    const displayName = String(data.get("displayName") ?? "").trim();
    void mutateWatchlist(buildWatchlistPut(
      instrumentId,
      displayName,
      currentVersion(),
    )).then((succeeded) => {
      if (succeeded) form.reset();
    });
  });

  document.querySelector("#watchlist-items")?.addEventListener("click", (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("button[data-action]")
      : null;
    const item = button?.closest<HTMLElement>("li[data-instrument-id]");
    const instrumentId = item?.dataset.instrumentId;
    if (button === null || item === null || instrumentId === undefined) return;
    const action = button.dataset.action;
    if (action === "remove") {
      const identities = orderedInstrumentIds();
      void mutateWatchlist(buildWatchlistRemove(
        instrumentId,
        currentVersion(),
      ), {
        instrumentId: targetAfterWatchlistRemoval(identities, instrumentId),
        action: "remove",
      });
      return;
    }
    if (action !== "move-up" && action !== "move-down") return;
    const identities = moveWatchlistItem(
      orderedInstrumentIds(),
      instrumentId,
      action === "move-up" ? "up" : "down",
    );
    void mutateWatchlist(buildWatchlistReorder(
      identities,
      currentVersion(),
    ), { instrumentId, action });
  });

  document.querySelector("#paper-order-details")?.addEventListener("click", (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>(
        "button[data-operation='PaperOrderTransition'][data-requires-confirmation='true']",
      )
      : null;
    if (button !== null) void submitPaperOrder(button);
  });
}

if (typeof document !== "undefined") startWorkbenchClient();
