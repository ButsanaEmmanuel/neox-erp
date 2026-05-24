// HRM-2.2 — /api/v1/hrm/onboarding/* and /api/v1/hrm/offboarding/*
// dispatcher. Every route gates with assertPermission.

import * as onboarding from '../../services/hrm/onboarding.service.mjs';
import * as offboarding from '../../services/hrm/offboarding.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const ON_TEMPLATES_COLL  = /^\/api\/v1\/hrm\/onboarding\/templates$/;
const ON_TEMPLATE_ITEM   = /^\/api\/v1\/hrm\/onboarding\/templates\/([^/]+)$/;
const ON_CHECKLISTS_COLL = /^\/api\/v1\/hrm\/onboarding\/checklists$/;
const ON_CHECKLIST_ITEM  = /^\/api\/v1\/hrm\/onboarding\/checklists\/([^/]+)$/;
const ON_CHECKLIST_TASK  = /^\/api\/v1\/hrm\/onboarding\/checklists\/([^/]+)\/tasks\/([^/]+)$/;
const ON_CHECKLIST_DONE  = /^\/api\/v1\/hrm\/onboarding\/checklists\/([^/]+)\/complete$/;
const ON_STATS           = /^\/api\/v1\/hrm\/onboarding\/stats$/;

const OFF_TEMPLATES_COLL  = /^\/api\/v1\/hrm\/offboarding\/templates$/;
const OFF_TEMPLATE_ITEM   = /^\/api\/v1\/hrm\/offboarding\/templates\/([^/]+)$/;
const OFF_CHECKLISTS_COLL = /^\/api\/v1\/hrm\/offboarding\/checklists$/;
const OFF_CHECKLIST_ITEM  = /^\/api\/v1\/hrm\/offboarding\/checklists\/([^/]+)$/;
const OFF_CHECKLIST_TASK  = /^\/api\/v1\/hrm\/offboarding\/checklists\/([^/]+)\/tasks\/([^/]+)$/;
const OFF_CHECKLIST_DONE  = /^\/api\/v1\/hrm\/offboarding\/checklists\/([^/]+)\/complete$/;
const OFF_START           = /^\/api\/v1\/hrm\/offboarding\/start$/;
const OFF_STATS           = /^\/api\/v1\/hrm\/offboarding\/stats$/;

function hasMatch(p) {
  return ON_TEMPLATES_COLL.test(p) || ON_TEMPLATE_ITEM.test(p)
    || ON_CHECKLIST_TASK.test(p) || ON_CHECKLIST_DONE.test(p)
    || ON_CHECKLIST_ITEM.test(p) || ON_CHECKLISTS_COLL.test(p) || ON_STATS.test(p)
    || OFF_TEMPLATES_COLL.test(p) || OFF_TEMPLATE_ITEM.test(p)
    || OFF_CHECKLIST_TASK.test(p) || OFF_CHECKLIST_DONE.test(p)
    || OFF_CHECKLIST_ITEM.test(p) || OFF_CHECKLISTS_COLL.test(p)
    || OFF_START.test(p) || OFF_STATS.test(p);
}

function actorFromCtx(ctx, body) {
  return (
    String(ctx.url.searchParams.get('actorUserId') || '').trim()
    || String(body?.actorUserId || body?.userId || '').trim()
    || null
  );
}

async function handleTemplateRoutes(ctx, prefix, svc, permRead, permWrite, COLL, ITEM) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  const queryUserId = String(url.searchParams.get('userId') || url.searchParams.get('actorUserId') || '').trim() || null;
  void prefix;

  if (COLL.test(pathname) && method === 'GET') {
    if (!(await assertPermission({ userId: queryUserId, res }, permRead))) return true;
    const templates = await svc.listTemplates(prisma, {
      departmentId: url.searchParams.get('departmentId') || undefined,
      includeInactive: url.searchParams.get('includeInactive') === 'true',
    });
    json(res, 200, { templates });
    return true;
  }
  if (COLL.test(pathname) && method === 'POST') {
    const body = await parseBody(ctx.req);
    const actor = actorFromCtx(ctx, body);
    if (!(await assertPermission({ userId: actor, res }, permWrite))) return true;
    const template = await svc.createTemplate(prisma, body);
    json(res, 201, { template });
    return true;
  }

  const itemMatch = pathname.match(ITEM);
  if (itemMatch && method === 'GET') {
    if (!(await assertPermission({ userId: queryUserId, res }, permRead))) return true;
    const template = await svc.getTemplate(prisma, itemMatch[1]);
    json(res, 200, { template });
    return true;
  }
  if (itemMatch && method === 'PUT') {
    const body = await parseBody(ctx.req);
    const actor = actorFromCtx(ctx, body);
    if (!(await assertPermission({ userId: actor, res }, permWrite))) return true;
    const template = await svc.updateTemplate(prisma, itemMatch[1], body);
    json(res, 200, { template });
    return true;
  }
  if (itemMatch && method === 'DELETE') {
    const body = await parseBody(ctx.req);
    const actor = actorFromCtx(ctx, body);
    if (!(await assertPermission({ userId: actor, res }, permWrite))) return true;
    const result = await svc.deleteTemplate(prisma, itemMatch[1]);
    json(res, 200, result);
    return true;
  }
  return false;
}

async function handleChecklistRoutes(ctx, svc, permRead, permExecute, COLL, ITEM, TASK, DONE, STATS) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  const queryUserId = String(url.searchParams.get('userId') || url.searchParams.get('actorUserId') || '').trim() || null;

  // Sub-routes BEFORE the generic /:id.
  const taskMatch = pathname.match(TASK);
  if (taskMatch && method === 'PUT') {
    const body = await parseBody(ctx.req);
    const actor = actorFromCtx(ctx, body);
    if (!(await assertPermission({ userId: actor, res }, permExecute))) return true;
    const task = await svc.updateChecklistTask(prisma, {
      checklistId: taskMatch[1],
      taskId: taskMatch[2],
      statusCode: body?.statusCode,
      completedByUserId: actor,
      note: body?.note,
    });
    json(res, 200, { task });
    return true;
  }
  const doneMatch = pathname.match(DONE);
  if (doneMatch && method === 'PUT') {
    const body = await parseBody(ctx.req);
    const actor = actorFromCtx(ctx, body);
    if (!(await assertPermission({ userId: actor, res }, permExecute))) return true;
    const checklist = await svc.completeChecklist(prisma, doneMatch[1], { completedByUserId: actor });
    json(res, 200, { checklist });
    return true;
  }

  if (STATS && STATS.test(pathname) && method === 'GET') {
    if (!(await assertPermission({ userId: queryUserId, res }, permRead))) return true;
    const stats = await svc.getCompletionStats(prisma, {
      userId: url.searchParams.get('forUserId') || undefined,
    });
    json(res, 200, { stats });
    return true;
  }

  if (COLL.test(pathname) && method === 'GET') {
    if (!(await assertPermission({ userId: queryUserId, res }, permRead))) return true;
    const checklists = await svc.listChecklists(prisma, {
      userId: url.searchParams.get('forUserId') || undefined,
      statusCode: url.searchParams.get('status') || undefined,
    });
    json(res, 200, { checklists });
    return true;
  }

  const itemMatch = pathname.match(ITEM);
  if (itemMatch && method === 'GET') {
    if (!(await assertPermission({ userId: queryUserId, res }, permRead))) return true;
    const checklist = await svc.getChecklist(prisma, itemMatch[1]);
    json(res, 200, { checklist });
    return true;
  }
  return false;
}

export async function handleHrmOnboardingRoutes(ctx) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  if (!hasMatch(pathname)) return false;
  try {
    // Onboarding
    if (
      ON_TEMPLATES_COLL.test(pathname) || ON_TEMPLATE_ITEM.test(pathname)
    ) {
      const handled = await handleTemplateRoutes(ctx, 'onboarding', onboarding, 'hrm.onboarding.read', 'hrm.onboarding.write', ON_TEMPLATES_COLL, ON_TEMPLATE_ITEM);
      if (handled) return true;
    }
    if (
      ON_CHECKLISTS_COLL.test(pathname) || ON_CHECKLIST_ITEM.test(pathname)
      || ON_CHECKLIST_TASK.test(pathname) || ON_CHECKLIST_DONE.test(pathname) || ON_STATS.test(pathname)
    ) {
      const handled = await handleChecklistRoutes(ctx, onboarding, 'hrm.onboarding.read', 'hrm.onboarding.execute', ON_CHECKLISTS_COLL, ON_CHECKLIST_ITEM, ON_CHECKLIST_TASK, ON_CHECKLIST_DONE, ON_STATS);
      if (handled) return true;
    }

    // Offboarding — start
    if (OFF_START.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.offboarding.execute'))) return true;
      const checklist = await offboarding.startOffboarding(prisma, {
        userId: body?.userId,
        templateId: body?.templateId,
        startDate: body?.startDate,
      });
      json(res, 201, { checklist });
      return true;
    }

    // Offboarding templates
    if (OFF_TEMPLATES_COLL.test(pathname) || OFF_TEMPLATE_ITEM.test(pathname)) {
      const handled = await handleTemplateRoutes(ctx, 'offboarding', offboarding, 'hrm.offboarding.read', 'hrm.offboarding.write', OFF_TEMPLATES_COLL, OFF_TEMPLATE_ITEM);
      if (handled) return true;
    }
    if (
      OFF_CHECKLISTS_COLL.test(pathname) || OFF_CHECKLIST_ITEM.test(pathname)
      || OFF_CHECKLIST_TASK.test(pathname) || OFF_CHECKLIST_DONE.test(pathname) || OFF_STATS.test(pathname)
    ) {
      const handled = await handleChecklistRoutes(ctx, offboarding, 'hrm.offboarding.read', 'hrm.offboarding.execute', OFF_CHECKLISTS_COLL, OFF_CHECKLIST_ITEM, OFF_CHECKLIST_TASK, OFF_CHECKLIST_DONE, OFF_STATS);
      if (handled) return true;
    }

    json(res, 405, { error: `Method ${method} not allowed on ${pathname}`, code: 'METHOD_NOT_ALLOWED' });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[handleHrmOnboardingRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    if (err?.pending !== undefined) payload.pending = err.pending;
    if (err?.active !== undefined) payload.active = err.active;
    if (err?.referencedCount !== undefined) payload.referencedCount = err.referencedCount;
    json(res, status, payload);
    return true;
  }
}
