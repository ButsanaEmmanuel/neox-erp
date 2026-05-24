// HRM-2.4 — /api/v1/hrm/cases/* dispatcher.
// Every route gates with assertPermission(...).
//
// Permission scheme:
//   - hrm.cases.read    GET   cases (scoped to mine if no execute)
//   - hrm.cases.write   POST  cases (anyone with the perm can open
//                              a case on behalf of themselves)
//   - hrm.cases.execute PUT   /escalate, /close (and any other
//                              status change unless the caller is
//                              the current assignee — service
//                              enforces the assignee path too)
//   - hrm.cases.write   PUT   /:id, /:id/assign, /:id/note
//
// Listing is scoped: without hrm.cases.read.global (currently
// piggybacked on hrm.cases.execute since we don't have a separate
// "global read" perm in the seed), the caller only sees cases they
// reported OR are assigned to.

import {
  listCases,
  getCase,
  createCase,
  updateCase,
  changeStatus,
  addNote,
  assignCase,
} from '../../services/hrm/cases.service.mjs';
import { assertPermission, getUserPermissions } from '../../services/auth/rbac.service.mjs';

const CASES_COLL    = /^\/api\/v1\/hrm\/cases$/;
const CASE_ITEM     = /^\/api\/v1\/hrm\/cases\/([^/]+)$/;
const CASE_ESCALATE = /^\/api\/v1\/hrm\/cases\/([^/]+)\/escalate$/;
const CASE_CLOSE    = /^\/api\/v1\/hrm\/cases\/([^/]+)\/close$/;
const CASE_STATUS   = /^\/api\/v1\/hrm\/cases\/([^/]+)\/status$/;
const CASE_NOTE     = /^\/api\/v1\/hrm\/cases\/([^/]+)\/notes$/;
const CASE_ASSIGN   = /^\/api\/v1\/hrm\/cases\/([^/]+)\/assign$/;

function hasMatch(p) {
  return CASES_COLL.test(p)
    || CASE_ESCALATE.test(p) || CASE_CLOSE.test(p) || CASE_STATUS.test(p)
    || CASE_NOTE.test(p) || CASE_ASSIGN.test(p)
    || CASE_ITEM.test(p);
}

function actorFromCtx(ctx, body) {
  return (
    String(ctx.url.searchParams.get('actorUserId') || '').trim()
    || String(body?.actorUserId || '').trim()
    || null
  );
}

export async function handleHrmCasesRoutes(ctx) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  if (!hasMatch(pathname)) return false;

  const queryUserId = String(url.searchParams.get('userId') || url.searchParams.get('actorUserId') || '').trim() || null;

  try {
    // --- Sub-routes BEFORE /:id ---
    const escMatch = pathname.match(CASE_ESCALATE);
    if (escMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.cases.execute'))) return true;
      const updated = await changeStatus(prisma, escMatch[1], {
        toStatus: 'escalated',
        note: body?.note,
        actorUserId: actor,
        canExecute: true,
        actorIsAssignee: true,
      });
      json(res, 200, { case: updated });
      return true;
    }
    const closeMatch = pathname.match(CASE_CLOSE);
    if (closeMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.cases.execute'))) return true;
      const updated = await changeStatus(prisma, closeMatch[1], {
        toStatus: 'closed',
        note: body?.note,
        actorUserId: actor,
        canExecute: true,
        actorIsAssignee: true,
      });
      json(res, 200, { case: updated });
      return true;
    }
    const statusMatch = pathname.match(CASE_STATUS);
    if (statusMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      // Allow the route through with .write — the service then checks
      // whether the caller is the assignee or has execute. This lets
      // an assignee without execute move open → investigating.
      if (!(await assertPermission({ userId: actor, res }, 'hrm.cases.write'))) return true;
      const perms = actor ? await getUserPermissions(actor) : new Set();
      const updated = await changeStatus(prisma, statusMatch[1], {
        toStatus: String(body?.statusCode || '').trim(),
        note: body?.note,
        actorUserId: actor,
        canExecute: perms.has('hrm.cases.execute'),
        actorIsAssignee: false,
      });
      json(res, 200, { case: updated });
      return true;
    }
    const noteMatch = pathname.match(CASE_NOTE);
    if (noteMatch && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.cases.write'))) return true;
      const event = await addNote(prisma, noteMatch[1], { note: body?.note, actorUserId: actor });
      json(res, 201, { event });
      return true;
    }
    const assignMatch = pathname.match(CASE_ASSIGN);
    if (assignMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.cases.execute'))) return true;
      const updated = await assignCase(prisma, assignMatch[1], {
        assignedToUserId: body?.assignedToUserId,
        note: body?.note,
        actorUserId: actor,
      });
      json(res, 200, { case: updated });
      return true;
    }

    // --- Collection ---
    if (CASES_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.cases.read'))) return true;
      // Scope: only callers with hrm.cases.execute can see global; others
      // see cases they reported or are assigned to.
      const perms = queryUserId ? await getUserPermissions(queryUserId) : new Set();
      const isGlobal = perms.has('hrm.cases.execute');
      const cases = await listCases(prisma, {
        forUserId:  isGlobal ? undefined : (queryUserId || undefined),
        statusCode: url.searchParams.get('status')   || undefined,
        caseType:   url.searchParams.get('caseType') || undefined,
        priority:   url.searchParams.get('priority') || undefined,
      });
      json(res, 200, { cases });
      return true;
    }
    if (CASES_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.cases.write'))) return true;
      const created = await createCase(prisma, body, { actorUserId: actor });
      json(res, 201, { case: created });
      return true;
    }

    // --- Item ---
    const itemMatch = pathname.match(CASE_ITEM);
    if (itemMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.cases.read'))) return true;
      const c = await getCase(prisma, itemMatch[1]);
      // Scope check at the item level too: if not global, the caller
      // must be the reporter or assignee.
      const perms = queryUserId ? await getUserPermissions(queryUserId) : new Set();
      const isGlobal = perms.has('hrm.cases.execute');
      if (!isGlobal && queryUserId
          && c.reportedByUserId !== queryUserId
          && c.assignedToUserId !== queryUserId) {
        json(res, 403, { error: 'Not authorised to view this case', code: 'CASE_NOT_VISIBLE' });
        return true;
      }
      json(res, 200, { case: c });
      return true;
    }
    if (itemMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.cases.write'))) return true;
      const updated = await updateCase(prisma, itemMatch[1], body);
      json(res, 200, { case: updated });
      return true;
    }

    json(res, 405, { error: `Method ${method} not allowed on ${pathname}`, code: 'METHOD_NOT_ALLOWED' });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[handleHrmCasesRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    if (err?.from) payload.from = err.from;
    if (err?.to)   payload.to   = err.to;
    json(res, status, payload);
    return true;
  }
}
