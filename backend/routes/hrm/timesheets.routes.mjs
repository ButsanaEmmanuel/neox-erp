// HRM-2.5 — /api/v1/hrm/timesheets/* dispatcher.
// Every route gates with assertPermission(...).
//
// Permission scheme:
//   - hrm.timesheets.read    GET   entries + week + pending list
//   - hrm.timesheets.write   POST  upsert + DELETE + PUT /submit
//   - hrm.timesheets.execute PUT   /approve, /reject (manager-side
//                                  lifecycle moves)
//
// Self-service: a caller with hrm.timesheets.read but without
// hrm.timesheets.execute only sees their own entries. The /pending
// route returns 403 unless the caller has execute.

import {
  listEntries,
  getWeek,
  listPendingWeeks,
  upsertEntry,
  deleteEntry,
  submitEntry,
  approveEntry,
  rejectEntry,
  submitWeek,
  approveWeek,
  rejectWeek,
} from '../../services/hrm/timesheets.service.mjs';
import { assertPermission, getUserPermissions } from '../../services/auth/rbac.service.mjs';

const ENTRIES_COLL = /^\/api\/v1\/hrm\/timesheets$/;
const ENTRY_ITEM   = /^\/api\/v1\/hrm\/timesheets\/([^/]+)$/;
const ENTRY_SUBMIT = /^\/api\/v1\/hrm\/timesheets\/([^/]+)\/submit$/;
const ENTRY_APPROVE = /^\/api\/v1\/hrm\/timesheets\/([^/]+)\/approve$/;
const ENTRY_REJECT  = /^\/api\/v1\/hrm\/timesheets\/([^/]+)\/reject$/;
const WEEK_GET     = /^\/api\/v1\/hrm\/timesheets\/users\/([^/]+)\/week\/([^/]+)$/;
const WEEK_SUBMIT  = /^\/api\/v1\/hrm\/timesheets\/users\/([^/]+)\/week\/([^/]+)\/submit$/;
const WEEK_APPROVE = /^\/api\/v1\/hrm\/timesheets\/users\/([^/]+)\/week\/([^/]+)\/approve$/;
const WEEK_REJECT  = /^\/api\/v1\/hrm\/timesheets\/users\/([^/]+)\/week\/([^/]+)\/reject$/;
const PENDING      = /^\/api\/v1\/hrm\/timesheets\/pending$/;

function hasMatch(p) {
  return ENTRIES_COLL.test(p)
    || ENTRY_SUBMIT.test(p) || ENTRY_APPROVE.test(p) || ENTRY_REJECT.test(p)
    || WEEK_SUBMIT.test(p)  || WEEK_APPROVE.test(p)  || WEEK_REJECT.test(p)  || WEEK_GET.test(p)
    || PENDING.test(p)
    || ENTRY_ITEM.test(p);
}

function actorFromCtx(ctx, body) {
  return (
    String(ctx.url.searchParams.get('actorUserId') || '').trim()
    || String(body?.actorUserId || '').trim()
    || null
  );
}

export async function handleHrmTimesheetsRoutes(ctx) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  if (!hasMatch(pathname)) return false;

  const queryUserId = String(url.searchParams.get('userId') || url.searchParams.get('actorUserId') || '').trim() || null;

  try {
    // --- Week-level lifecycle (BEFORE generic /:id) ---
    const wsubMatch = pathname.match(WEEK_SUBMIT);
    if (wsubMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.timesheets.write'))) return true;
      if (actor !== wsubMatch[1]) {
        json(res, 403, { error: 'Only the owner may submit their week', code: 'NOT_OWNER' });
        return true;
      }
      const out = await submitWeek(prisma, { userId: wsubMatch[1], weekStart: wsubMatch[2], actorUserId: actor });
      json(res, 200, out);
      return true;
    }
    const wappMatch = pathname.match(WEEK_APPROVE);
    if (wappMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.timesheets.execute'))) return true;
      const out = await approveWeek(prisma, { userId: wappMatch[1], weekStart: wappMatch[2], actorUserId: actor });
      json(res, 200, out);
      return true;
    }
    const wrejMatch = pathname.match(WEEK_REJECT);
    if (wrejMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.timesheets.execute'))) return true;
      const out = await rejectWeek(prisma, {
        userId: wrejMatch[1], weekStart: wrejMatch[2], actorUserId: actor, comment: body?.comment,
      });
      json(res, 200, out);
      return true;
    }
    const wgetMatch = pathname.match(WEEK_GET);
    if (wgetMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.timesheets.read'))) return true;
      const perms = queryUserId ? await getUserPermissions(queryUserId) : new Set();
      const isGlobal = perms.has('hrm.timesheets.execute');
      if (!isGlobal && queryUserId !== wgetMatch[1]) {
        json(res, 403, { error: 'Can only read your own week', code: 'NOT_OWNER' });
        return true;
      }
      const week = await getWeek(prisma, { userId: wgetMatch[1], weekStart: wgetMatch[2] });
      json(res, 200, { week });
      return true;
    }

    // --- Pending list (manager view) ---
    if (PENDING.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.timesheets.execute'))) return true;
      const pending = await listPendingWeeks(prisma, {
        departmentId: url.searchParams.get('departmentId') || undefined,
      });
      json(res, 200, { pending });
      return true;
    }

    // --- Per-entry lifecycle ---
    const esubMatch = pathname.match(ENTRY_SUBMIT);
    if (esubMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.timesheets.write'))) return true;
      const entry = await submitEntry(prisma, esubMatch[1], { actorUserId: actor });
      json(res, 200, { entry });
      return true;
    }
    const eappMatch = pathname.match(ENTRY_APPROVE);
    if (eappMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.timesheets.execute'))) return true;
      const entry = await approveEntry(prisma, eappMatch[1], { actorUserId: actor });
      json(res, 200, { entry });
      return true;
    }
    const erejMatch = pathname.match(ENTRY_REJECT);
    if (erejMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.timesheets.execute'))) return true;
      const entry = await rejectEntry(prisma, erejMatch[1], { actorUserId: actor, comment: body?.comment });
      json(res, 200, { entry });
      return true;
    }

    // --- Collection ---
    if (ENTRIES_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.timesheets.read'))) return true;
      const perms = queryUserId ? await getUserPermissions(queryUserId) : new Set();
      const isGlobal = perms.has('hrm.timesheets.execute');
      const forUserId = url.searchParams.get('forUserId') || undefined;
      // Without global, scope to self.
      const scopedUserId = isGlobal ? forUserId : (queryUserId || undefined);
      const entries = await listEntries(prisma, {
        userId:     scopedUserId,
        weekStart:  url.searchParams.get('weekStart') || undefined,
        statusCode: url.searchParams.get('status')    || undefined,
      });
      json(res, 200, { entries });
      return true;
    }
    if (ENTRIES_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.timesheets.write'))) return true;
      const entry = await upsertEntry(prisma, {
        ...body,
        userId: body?.userId || actor,  // default to self
      }, { actorUserId: actor });
      json(res, body?.id ? 200 : 201, { entry });
      return true;
    }

    // --- Item ---
    const itemMatch = pathname.match(ENTRY_ITEM);
    if (itemMatch && method === 'DELETE') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.timesheets.write'))) return true;
      const result = await deleteEntry(prisma, itemMatch[1], { actorUserId: actor });
      json(res, 200, result);
      return true;
    }

    json(res, 405, { error: `Method ${method} not allowed on ${pathname}`, code: 'METHOD_NOT_ALLOWED' });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[handleHrmTimesheetsRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    if (err?.currentStatus) payload.currentStatus = err.currentStatus;
    json(res, status, payload);
    return true;
  }
}
