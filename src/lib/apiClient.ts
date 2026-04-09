export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const API_TIMEOUT_MS = 12000;
const API_RETRY_ATTEMPTS = 2;
let pendingRequestCount = 0;

function emitNetworkActivity() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('neox:network-activity', {
      detail: {
        pending: pendingRequestCount,
        busy: pendingRequestCount > 0,
        timestamp: Date.now(),
      },
    }),
  );
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function apiRequest<T>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    token?: string;
  } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;
  const baseCandidates = [API_BASE_URL, '', 'http://localhost:4000', 'http://127.0.0.1:4000']
    .map((candidate) => candidate?.trim())
    .filter((candidate, index, arr): candidate is string => candidate !== undefined && candidate !== null && arr.indexOf(candidate) === index);

  let lastError: Error | null = null;

  for (const base of baseCandidates) {
    const targetUrl = `${base}${path}`;
    for (let attempt = 0; attempt <= API_RETRY_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      try {
        pendingRequestCount += 1;
        emitNetworkActivity();
        const response = await fetch(targetUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });

        const text = await response.text();
        let payload: unknown = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = { raw: text };
          }
        }

        if (!response.ok) {
          const message =
            (payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message: unknown }).message === 'string'
              ? String((payload as { message: unknown }).message)
              : `API request failed with status ${response.status} on ${targetUrl}`);
          throw new ApiError(message, response.status, payload);
        }

        clearTimeout(timeout);
        return payload as T;
      } catch (error) {
        clearTimeout(timeout);
        const err = error as Error;
        const isAbort = err.name === 'AbortError';
        const isNetwork = err.message?.toLowerCase().includes('failed to fetch') || isAbort;
        lastError = new Error(
          isAbort
            ? `Request timeout after ${API_TIMEOUT_MS}ms for ${targetUrl}`
            : `${err.message} (${targetUrl})`,
        );
        if (!isNetwork || attempt >= API_RETRY_ATTEMPTS) break;
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      } finally {
        pendingRequestCount = Math.max(0, pendingRequestCount - 1);
        emitNetworkActivity();
      }
    }
  }

  throw lastError || new Error(`Failed to call API for ${path}`);
}
