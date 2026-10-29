// API client for /api/v1. Every response is {data, serverTime} or
// {error: {code, message, reference}, serverTime}.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public reference?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

let csrfToken = "";
export function setCsrfToken(t: string) {
  csrfToken = t;
}

// Difference between server and device clocks, so countdowns use server time.
let clockSkewMs = 0;
export function serverNow(): Date {
  return new Date(Date.now() + clockSkewMs);
}

function newKey(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface RequestOptions {
  body?: unknown;
  /** Reuse the same key when retrying the same action after a timeout. */
  idempotencyKey?: string;
}

export async function api<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const mutating = method !== "GET" && method !== "HEAD";
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (mutating) {
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    headers["Idempotency-Key"] = opts.idempotencyKey ?? newKey();
  }
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response (for example the dev server is down).
  }
  if (json?.serverTime) clockSkewMs = new Date(json.serverTime).getTime() - Date.now();
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? "NETWORK", e?.message ?? `Request failed (${res.status})`, e?.reference, e?.retryAfterSeconds);
  }
  return json?.data as T;
}
