// HRM-1.4 — /api/v1/hrm/employees dispatcher (assignable picker + later
// contractor upsert in commit 2).
//
// Mounted from backend/auth-server.mjs via handleHrmDirectoryRoutes(ctx).

import { listAssignableEmployees } from '../../services/hrm/assignables.service.mjs';
import { upsertContractor } from '../../services/hrm/contractorUpsert.service.mjs';

const EMPLOYEES_COLL = /^\/api\/v1\/hrm\/employees$/;
const CONTRACTOR_UPSERT = /^\/api\/v1\/hrm\/employees\/contractor$/;

function hasMatch(pathname) {
  return EMPLOYEES_COLL.test(pathname) || CONTRACTOR_UPSERT.test(pathname);
}

/**
 * @param {{
 *   req: import('http').IncomingMessage,
 *   res: import('http').ServerResponse,
 *   url: URL,
 *   pathname: string,
 *   method: string,
 *   prisma: import('@prisma/client').PrismaClient,
 *   json: (res: any, status: number, payload: unknown) => void,
 * }} ctx
 * @returns {Promise<boolean>}
 */
export async function handleHrmDirectoryRoutes(ctx) {
  const { method, pathname, url, prisma, json, res } = ctx;
  if (!hasMatch(pathname)) return false;

  try {
    if (EMPLOYEES_COLL.test(pathname) && method === 'GET') {
      const assignable = url.searchParams.get('assignable');
      if (assignable !== 'true') {
        json(res, 400, {
          error: 'Only ?assignable=true is supported on this endpoint today',
          code: 'BAD_REQUEST',
          field: 'assignable',
        });
        return true;
      }
      const projectId = url.searchParams.get('projectId') || undefined;
      const employmentType = url.searchParams.get('employmentType') || undefined;
      const employees = await listAssignableEmployees(prisma, { projectId, employmentType });
      json(res, 200, { employees });
      return true;
    }

    if (CONTRACTOR_UPSERT.test(pathname) && method === 'POST') {
      const body = await ctx.parseBody(ctx.req);
      const result = await upsertContractor(prisma, {
        firstName: body?.firstName,
        lastName: body?.lastName,
        email: body?.email,
        source: body?.source,
        externalRef: body?.externalRef,
      });
      json(res, result.created ? 201 : 200, result);
      return true;
    }

    json(res, 405, {
      error: `Method ${method} not allowed on ${pathname}`,
      code: 'METHOD_NOT_ALLOWED',
    });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      console.error(`[handleHrmDirectoryRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    json(res, status, payload);
    return true;
  }
}
