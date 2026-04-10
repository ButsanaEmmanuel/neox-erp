/**
 * SSE Client — thin EventSource wrapper with auto-reconnect.
 *
 * Connects to `/api/v1/events/stream?userId=xxx` and dispatches
 * parsed JSON events to registered callbacks.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

function getBaseCandidates() {
  const candidates = [API_BASE_URL, ''];
  if (import.meta.env.DEV) {
    candidates.push('http://localhost:4000', 'http://127.0.0.1:4000');
  }

  return candidates
    .map((candidate) => normalizeBaseUrl(candidate))
    .filter((candidate, index, arr): candidate is string => candidate !== undefined && candidate !== null && arr.indexOf(candidate) === index);
}

const BASE_CANDIDATES = getBaseCandidates();

type SseCallback = (payload: Record<string, unknown>) => void;

export interface SseConnection {
  close: () => void;
}

/**
 * Open a persistent SSE connection for the given user.
 *
 * @param userId   Authenticated user id
 * @param handlers Map of event-type → callback
 * @returns        Object with a `close()` method for cleanup
 */
export function connectSse(
  userId: string,
  handlers: Record<string, SseCallback>,
): SseConnection {
  let es: EventSource | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let baseIndex = 0;

  const MAX_FAST_RETRIES = 5;
  const FAST_RETRY_MS = 1_000;
  const SLOW_RETRY_MS = 30_000;

  function open() {
    if (closed) return;

    // Rotate base URL candidates to survive stale/invalid env host configs.
    const base = BASE_CANDIDATES[baseIndex % BASE_CANDIDATES.length] || '';
    const url = `${base}/api/v1/events/stream?userId=${encodeURIComponent(userId)}`;

    es = new EventSource(url);

    es.onopen = () => {
      retryCount = 0; // reset on successful connection
    };

    // Register handlers for each event type
    for (const [eventType, handler] of Object.entries(handlers)) {
      es.addEventListener(eventType, ((event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handler(data);
        } catch {
          // malformed payload — ignore
        }
      }) as EventListener);
    }

    es.onerror = () => {
      // EventSource auto-reconnects, but if the connection fails repeatedly
      // we should back off.
      es?.close();
      es = null;

      if (closed) return;
      retryCount += 1;
      baseIndex = (baseIndex + 1) % BASE_CANDIDATES.length;
      const delay = retryCount <= MAX_FAST_RETRIES ? FAST_RETRY_MS : SLOW_RETRY_MS;
      retryTimer = setTimeout(open, delay);
    };
  }

  open();

  return {
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      es = null;
    },
  };
}
