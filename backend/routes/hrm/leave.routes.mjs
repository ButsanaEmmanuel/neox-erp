// HRM-1.5 — /api/v1/hrm/leave/* dispatcher.
//
// Mounted from backend/auth-server.mjs via handleHrmLeaveRoutes(ctx).
// Every route gates itself with assertPermission(...) — D6 contract.

import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  listBalances,
  initializeBalances,
  listRequests,
  getRequest,
  createRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
} from '../../services/hrm/leave.service.mjs';
import { assertPermission, hasPermission } from '../../services/auth/rbac.service.mjs';

const POLICIES_COLL    = /^\/api\/v1\/hrm\/leave\/policies$/;
const POLICY_ITEM      = /^\/api\/v1\/hrm\/leave\/policies\/([^/]+)$/;
const BALANCES_COLL    = /^\/api\/v1\/hrm\/leave\/balances$/;
const BALANCES_USER    = /^\/api\/v1\/hrm\/leave\/balances\/([^/]+)$/;
const BALANCES_INIT    = /^\/api\/v1\/hrm\/leave\/balances\/initialize$/;
const REQUESTS_COLL    = /^\/api\/v1\/hrm\/leave\/requests$/;
const REQUEST_ITEM     = /^\/api\/v1\/hrm\/leave\/requests\/([^/]+)$/;
const REQUEST_APPROVE  = /^\/api\/v1\/hrm\/leave\/requests\/([^/]+)\/approve$/;
const REQUEST_REJECT   = /^\/api\/v1\/hrm\/leave\/requests\/([^/]+)\/reject$/;

function hasMatch(pathname) {
  return (
    POLICIES_COLL.test(pathname)
    || POLICY_ITEM.test(pathname)
    || BALANCES_INIT.test(pathname)
    || BALANCES_USER.test(pathname)
    || BALANCES_COLL.test(pathname)
    || REQUEST_APPROVE.test(pathname)
    || REQUEST_REJECT.test(pathname)
    || REQUEST_ITEM.test(pathname)
    || REQUESTS_COLL.test(pathname)
  );
}

function actorFromCtx(ctx, body) {
  return (
    String(ctx.url.searchParams.get('actorUserId') || '').trim()
    || String(body?.actorUserId || body?.userId || '').trim()
    || null
  );
}

export async function handleHrmLeaveRoutes(ctx) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  if (!hasMatch(pathname)) return false;

  const userId = String(url.searchParams.get('userId') || url.searchParams.get('actorUserId') || '').trim() || null;

  try {
    // --- Policies ---
    if (POLICIES_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId, res }, 'hrm.leave.read'))) return true;
      const includeInactive = url.searchParams.get('includeInactive') === 'true';
      const policies = await listPolicies(prisma, { includeInactive });
      json(res, 200, { policies });
      return true;
    }
    if (POLICIES_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.leave.admin'))) return true;
      const policy = await createPolicy(prisma, body);
      json(res, 201, { policy });
      return true;
    }

    const policyItemMatch = pathname.match(POLICY_ITEM);
    if (policyItemMatch && method === 'PUT') {
      const [, policyId] = policyItemMatch;
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.leave.admin'))) return true;
      const policy = await updatePolicy(prisma, policyId, body);
      json(res, 200, { policy });
      return true;
    }
    if (policyItemMatch && method === 'DELETE') {
      const [, policyId] = policyItemMatch;
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.leave.admin'))) return true;
      const policy = await deletePolicy(prisma, policyId);
      json(res, 200, { policy });
      return true;
    }

    // --- Balances ---
    // initialize must come BEFORE the generic /:userId route or the regex
    // 'initialize' would be captured as a userId.
    if (BALANCES_INIT.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.leave.admin'))) return true;
      const result = await initializeBalances(prisma, {
        year: body?.year ?? new Date().getFullYear(),
        userId: body?.userId,
        policyId: body?.policyId,
      });
      json(res, 200, result);
      return true;
    }
    if (BALANCES_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId, res }, 'hrm.leave.read'))) return true;
      const year = url.searchParams.get('year');
      const scopeUserId = url.searchParams.get('forUserId') || null;
      const balances = await listBalances(prisma, {
        userId: scopeUserId ?? userId,
        year: year ? Number(year) : undefined,
      });
      json(res, 200, { balances });
      return true;
    }
    const balancesUserMatch = pathname.match(BALANCES_USER);
    if (balancesUserMatch && method === 'GET') {
      const [, targetUserId] = balancesUserMatch;
      if (!(await assertPermission({ userId, res }, 'hrm.leave.read'))) return true;
      const year = url.searchParams.get('year');
      const balances = await listBalances(prisma, {
        userId: targetUserId,
        year: year ? Number(year) : undefined,
      });
      json(res, 200, { balances });
      return true;
    }

    // --- Requests ---
    if (REQUESTS_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId, res }, 'hrm.leave.read'))) return true;
      const requests = await listRequests(prisma, {
        userId: url.searchParams.get('forUserId') || undefined,
        statusCode: url.searchParams.get('status') || undefined,
        policyId: url.searchParams.get('policyId') || undefined,
        from: url.searchParams.get('from') || undefined,
        to: url.searchParams.get('to') || undefined,
      });
      json(res, 200, { requests });
      return true;
    }
    if (REQUESTS_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.leave.write'))) return true;
      const request = await createRequest(prisma, body, { actorUserId: actor });
      json(res, 201, { request });
      return true;
    }

    // Approve / reject sub-routes match BEFORE the generic /:id route.
    const approveMatch = pathname.match(REQUEST_APPROVE);
    if (approveMatch && method === 'PUT') {
      const [, requestId] = approveMatch;
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.leave.execute'))) return true;
      const request = await approveRequest(prisma, requestId, {
        reviewerUserId: actor,
        reviewNote: body?.reviewNote,
      });
      json(res, 200, { request });
      return true;
    }
    const rejectMatch = pathname.match(REQUEST_REJECT);
    if (rejectMatch && method === 'PUT') {
      const [, requestId] = rejectMatch;
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.leave.execute'))) return true;
      const request = await rejectRequest(prisma, requestId, {
        reviewerUserId: actor,
        reviewNote: body?.reviewNote,
      });
      json(res, 200, { request });
      return true;
    }

    const requestItemMatch = pathname.match(REQUEST_ITEM);
    if (requestItemMatch && method === 'GET') {
      const [, requestId] = requestItemMatch;
      if (!(await assertPermission({ userId, res }, 'hrm.leave.read'))) return true;
      const request = await getRequest(prisma, requestId);
      json(res, 200, { request });
      return true;
    }
    if (requestItemMatch && method === 'DELETE') {
      const [, requestId] = requestItemMatch;
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      // Owner-or-manager check: try owner path first (no permission
      // required), fall back to hrm.leave.execute. We don't write a
      // 403 here — the service raises forbidden if neither qualifies,
      // and the catch block sends the structured payload.
      const hasExecute = actor ? await hasPermission(actor, 'hrm.leave.execute') : false;
      const request = await cancelRequest(prisma, requestId, {
        actorUserId: actor,
        hasExecutePermission: hasExecute,
      });
      json(res, 200, { request });
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
      // eslint-disable-next-line no-console
      console.error(`[handleHrmLeaveRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    if (err?.requested !== undefined) payload.requested = err.requested;
    if (err?.available !== undefined) payload.available = err.available;
    if (err?.balanceId) payload.balanceId = err.balanceId;
    if (err?.current) payload.current = err.current;
    if (err?.conflicting) payload.conflicting = err.conflicting;
    if (err?.noticeDays !== undefined) payload.noticeDays = err.noticeDays;
    if (err?.activeRequests !== undefined) payload.activeRequests = err.activeRequests;
    if (err?.startDate) payload.startDate = err.startDate;
    json(res, status, payload);
    return true;
  }
}
