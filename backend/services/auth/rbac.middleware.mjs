// HRM-1.2 — Express middleware factory for permission gating.
//
// Usage (when the project mounts an Express router):
//   router.delete(
//     '/projects/:id',
//     requirePermission('pm.projects.delete'),
//     handler,
//   );
//
// Today's auth-server.mjs is a raw Node http server, so this middleware
// is not yet wired into the live request pipeline. It is shipped here
// so that:
//   - it can be unit-tested independently,
//   - it is ready when individual routes migrate to Express,
//   - the API surface promised by the plan (requirePermission) exists.
//
// Auth contract: upstream layers MUST populate req.user.id (or req.userId)
// for authenticated requests. This middleware does NOT authenticate; if
// no userId is present it answers 403 — never 401 — because the HRM-1.2
// plan explicitly states auth is handled in front of it.

import { hasPermission } from './rbac.service.mjs';

export function requirePermission(key) {
  return async function requirePermissionMiddleware(req, res, next) {
    const userId = req.user?.id ?? req.userId ?? null;

    const deny = () =>
      res.status(403).json({
        error: 'Permission denied',
        code: 'PERMISSION_DENIED',
        required: key,
      });

    if (!userId) return deny();

    try {
      const allowed = await hasPermission(userId, key);
      if (!allowed) return deny();
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
