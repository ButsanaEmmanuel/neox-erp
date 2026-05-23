// HRM-1.2 — /api/auth/me/* dispatcher.
// Mounted from backend/auth-server.mjs via handleAuthMeRoutes(ctx).
//
// Identity is read from the query string (?userId=...) to match the
// existing auth-server.mjs convention. The actual authentication of
// that userId is assumed to be done by an upstream layer — the route
// returns 403 with code PERMISSION_DENIED rather than 401 when no
// userId is provided, per HRM-1.2 contract.

import { getUserPermissions } from '../../services/auth/rbac.service.mjs';

/**
 * @param {{
 *   req: import('http').IncomingMessage,
 *   res: import('http').ServerResponse,
 *   url: URL,
 *   pathname: string,
 *   method: string,
 *   json: (res: any, status: number, payload: unknown) => void,
 * }} ctx
 * @returns {Promise<boolean>} true if the route was handled.
 */
export async function handleAuthMeRoutes(ctx) {
  const { method, pathname, url, res, json } = ctx;

  if (method !== 'GET' || pathname !== '/api/auth/me/permissions') {
    return false;
  }

  const userId = String(url.searchParams.get('userId') || '').trim();
  if (!userId) {
    json(res, 403, {
      error: 'Permission denied',
      code: 'PERMISSION_DENIED',
      required: 'auth.me.read',
    });
    return true;
  }

  try {
    const permissions = await getUserPermissions(userId);
    json(res, 200, { permissions: [...permissions].sort() });
    return true;
  } catch (err) {
    console.error('[handleAuthMeRoutes] GET /api/auth/me/permissions failed:', err);
    json(res, 500, { error: err?.message || 'Internal error' });
    return true;
  }
}
