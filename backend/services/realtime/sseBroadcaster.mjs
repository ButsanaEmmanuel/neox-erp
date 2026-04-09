/**
 * SSE Broadcaster — in-memory pub/sub hub for Server-Sent Events.
 *
 * Each connected client is a raw `http.ServerResponse` kept alive with
 * SSE framing.  When a mutation happens anywhere in the backend, call
 * `broadcast()` to push a lightweight JSON event to every connected tab.
 */

/** @type {Map<string, Set<import('node:http').ServerResponse>>} userId → live responses */
const clientsByUser = new Map();

/** @type {Set<import('node:http').ServerResponse>} all connected responses */
const allClients = new Set();

/** @type {Map<import('node:http').ServerResponse, { userId: string, heartbeat: ReturnType<typeof setInterval> }>} */
const clientMeta = new Map();

const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Register a new SSE client.  Sets the required headers, starts the
 * heartbeat timer, and removes the client when the connection closes.
 *
 * @param {string} userId
 * @param {import('node:http').ServerResponse} res
 * @param {string} allowedOrigin
 */
export function registerClient(userId, res, allowedOrigin = '*') {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Accel-Buffering': 'no', // nginx
  });

  // Initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  // Heartbeat to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      // connection already dead — cleanup will fire via 'close'
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Track
  allClients.add(res);
  if (!clientsByUser.has(userId)) clientsByUser.set(userId, new Set());
  clientsByUser.get(userId).add(res);
  clientMeta.set(res, { userId, heartbeat });

  // Cleanup on disconnect
  res.on('close', () => {
    clearInterval(heartbeat);
    allClients.delete(res);
    const userSet = clientsByUser.get(userId);
    if (userSet) {
      userSet.delete(res);
      if (userSet.size === 0) clientsByUser.delete(userId);
    }
    clientMeta.delete(res);
  });
}

/**
 * Broadcast an event to ALL connected SSE clients.
 *
 * @param {string} eventType  e.g. 'work_item_updated'
 * @param {object} payload    JSON-serialisable data
 */
export function broadcast(eventType, payload = {}) {
  const frame = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of allClients) {
    try {
      client.write(frame);
    } catch {
      // dead connection — 'close' handler will clean up
    }
  }
}

/**
 * Broadcast an event only to users subscribed to a specific project.
 * Falls back to broadcasting to everyone (lightweight notification).
 *
 * @param {string} _projectId
 * @param {string} eventType
 * @param {object} payload
 */
export function broadcastToProject(_projectId, eventType, payload = {}) {
  // For now broadcast to all clients — the frontend filters by projectId.
  // A future improvement could maintain a projectId→userId mapping.
  broadcast(eventType, { ...payload, projectId: _projectId });
}

/** Current number of connected SSE clients (useful for /health). */
export function connectedClientCount() {
  return allClients.size;
}
