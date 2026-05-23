// HRM-2.2 — Offboarding templates + checklists. Mirror of
// backend/services/hrm/onboarding.service.mjs; kept as a separate file
// so each domain can evolve independently (different audit needs,
// access revocation steps, equipment return, etc.) without conditional
// branches in a shared helper.

import { safeBroadcast } from '../realtime/sseBroadcaster.mjs';

class HttpError extends Error {
  constructor(statusCode, code, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.assign(this, extra);
  }
}
const badRequest = (msg, extra) => new HttpError(400, 'BAD_REQUEST', msg, extra);
const notFound = (msg) => new HttpError(404, 'NOT_FOUND', msg);
const conflict = (msg, extra) => new HttpError(409, 'CONFLICT', msg, extra);

function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
const TASK_STATUS = ['pending', 'done', 'skipped'];

// ============================================================
// Templates
// ============================================================

export async function listTemplates(prisma, { departmentId, includeInactive = false } = {}) {
  const where = { isDeleted: false };
  if (!includeInactive) where.isActive = true;
  if (departmentId === null) where.departmentId = null;
  else if (departmentId) where.departmentId = departmentId;
  return prisma.offboardingTemplate.findMany({
    where,
    orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    include: {
      department: { select: { id: true, code: true, name: true } },
      _count: { select: { tasks: true, checklists: true } },
    },
  });
}

export async function getTemplate(prisma, id) {
  const tpl = await prisma.offboardingTemplate.findFirst({
    where: { id, isDeleted: false },
    include: {
      department: { select: { id: true, code: true, name: true } },
      tasks: { orderBy: [{ order: 'asc' }, { title: 'asc' }] },
    },
  });
  if (!tpl) throw notFound('Offboarding template not found');
  return tpl;
}

export async function createTemplate(prisma, input) {
  if (!nonEmpty(input?.name)) throw badRequest('name is required', { field: 'name' });
  const tasks = Array.isArray(input?.tasks) ? input.tasks : [];
  return prisma.$transaction(async (tx) => {
    const tpl = await tx.offboardingTemplate.create({
      data: {
        name: input.name.trim(),
        departmentId: nonEmpty(input?.departmentId) ? input.departmentId : null,
        isActive: input?.isActive !== false,
      },
    });
    if (tasks.length > 0) {
      await tx.offboardingTemplateTask.createMany({
        data: tasks.map((t, i) => ({
          templateId: tpl.id,
          title: String(t?.title || '').trim() || `Task ${i + 1}`,
          description: nonEmpty(t?.description) ? t.description.trim() : null,
          dueOffsetDays: Math.max(0, Math.floor(Number(t?.dueOffsetDays ?? 0))),
          assignedRole: nonEmpty(t?.assignedRole) ? t.assignedRole.trim().toLowerCase() : null,
          isRequired: t?.isRequired !== false,
          order: Number.isFinite(Number(t?.order)) ? Number(t.order) : i,
        })),
      });
    }
    return tx.offboardingTemplate.findUnique({
      where: { id: tpl.id },
      include: { department: { select: { id: true, code: true, name: true } }, tasks: { orderBy: [{ order: 'asc' }] } },
    });
  });
}

export async function updateTemplate(prisma, id, input) {
  const tpl = await prisma.offboardingTemplate.findFirst({ where: { id, isDeleted: false } });
  if (!tpl) throw notFound('Offboarding template not found');
  return prisma.$transaction(async (tx) => {
    const data = {};
    if (input?.name !== undefined) data.name = String(input.name).trim();
    if (input?.departmentId !== undefined) data.departmentId = nonEmpty(input.departmentId) ? input.departmentId : null;
    if (input?.isActive !== undefined) data.isActive = Boolean(input.isActive);
    if (Object.keys(data).length > 0) await tx.offboardingTemplate.update({ where: { id }, data });

    if (Array.isArray(input?.tasks)) {
      const existingTasks = await tx.offboardingTemplateTask.findMany({
        where: { templateId: id },
        select: { id: true },
      });
      const incomingIds = new Set(input.tasks.filter((t) => nonEmpty(t?.id)).map((t) => t.id));
      const toDelete = existingTasks.filter((t) => !incomingIds.has(t.id)).map((t) => t.id);
      if (toDelete.length > 0) {
        const referenced = await tx.offboardingChecklistTask.count({ where: { templateTaskId: { in: toDelete } } });
        if (referenced > 0) throw conflict('Some tasks are referenced by existing checklists — deactivate the template instead', { referencedCount: referenced });
        await tx.offboardingTemplateTask.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const [i, t] of input.tasks.entries()) {
        const payload = {
          templateId: id,
          title: String(t?.title || '').trim() || `Task ${i + 1}`,
          description: nonEmpty(t?.description) ? t.description.trim() : null,
          dueOffsetDays: Math.max(0, Math.floor(Number(t?.dueOffsetDays ?? 0))),
          assignedRole: nonEmpty(t?.assignedRole) ? t.assignedRole.trim().toLowerCase() : null,
          isRequired: t?.isRequired !== false,
          order: Number.isFinite(Number(t?.order)) ? Number(t.order) : i,
        };
        if (nonEmpty(t?.id) && existingTasks.some((e) => e.id === t.id)) {
          await tx.offboardingTemplateTask.update({ where: { id: t.id }, data: payload });
        } else {
          await tx.offboardingTemplateTask.create({ data: payload });
        }
      }
    }

    return tx.offboardingTemplate.findUnique({
      where: { id },
      include: { department: { select: { id: true, code: true, name: true } }, tasks: { orderBy: [{ order: 'asc' }] } },
    });
  });
}

export async function deleteTemplate(prisma, id) {
  const tpl = await prisma.offboardingTemplate.findFirst({ where: { id, isDeleted: false } });
  if (!tpl) throw notFound('Offboarding template not found');
  const active = await prisma.offboardingChecklist.count({ where: { templateId: id, statusCode: 'in_progress', isDeleted: false } });
  if (active > 0) throw conflict('Template still has active checklists — finish them before archiving', { active });
  await prisma.offboardingTemplate.update({ where: { id }, data: { isDeleted: true, isActive: false, deletedAt: new Date() } });
  return { id, deleted: true };
}

// ============================================================
// Checklists
// ============================================================

export async function listChecklists(prisma, { userId, statusCode, includeDeleted = false } = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (userId) where.userId = userId;
  if (statusCode) where.statusCode = statusCode;
  return prisma.offboardingChecklist.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      template: { select: { id: true, name: true, departmentId: true } },
      _count: { select: { tasks: true } },
      tasks: { select: { statusCode: true } },
    },
  });
}

export async function getChecklist(prisma, id) {
  const cl = await prisma.offboardingChecklist.findFirst({
    where: { id, isDeleted: false },
    include: {
      user: { select: { id: true, name: true, email: true, departmentId: true } },
      template: { select: { id: true, name: true } },
      tasks: {
        include: { templateTask: true, completedBy: { select: { id: true, name: true, email: true } } },
        orderBy: [{ templateTask: { order: 'asc' } }],
      },
    },
  });
  if (!cl) throw notFound('Offboarding checklist not found');
  return cl;
}

export async function createChecklistFromTemplate(prisma, { userId, templateId, startDate }) {
  if (!nonEmpty(userId)) throw badRequest('userId is required', { field: 'userId' });
  if (!nonEmpty(templateId)) throw badRequest('templateId is required', { field: 'templateId' });
  const template = await prisma.offboardingTemplate.findFirst({
    where: { id: templateId, isDeleted: false, isActive: true },
    include: { tasks: { orderBy: [{ order: 'asc' }] } },
  });
  if (!template) throw notFound('Active offboarding template not found');
  return prisma.$transaction(async (tx) => {
    const existing = await tx.offboardingChecklist.findFirst({
      where: { userId, templateId, isDeleted: false, statusCode: 'in_progress' },
    });
    if (existing) return existing;
    const checklist = await tx.offboardingChecklist.create({
      data: {
        userId,
        templateId,
        startDate: startDate ? new Date(startDate) : new Date(),
        statusCode: 'in_progress',
      },
    });
    if (template.tasks.length > 0) {
      await tx.offboardingChecklistTask.createMany({
        data: template.tasks.map((t) => ({
          checklistId: checklist.id,
          templateTaskId: t.id,
          statusCode: 'pending',
        })),
      });
    }
    return checklist;
  });
}

export async function resolveTemplateForDepartment(prisma, departmentId) {
  if (departmentId) {
    const t = await prisma.offboardingTemplate.findFirst({
      where: { departmentId, isDeleted: false, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (t) return t.id;
  }
  const global = await prisma.offboardingTemplate.findFirst({
    where: { departmentId: null, isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return global?.id ?? null;
}

export async function updateChecklistTask(prisma, { checklistId, taskId, statusCode, completedByUserId, note }) {
  if (!nonEmpty(taskId)) throw badRequest('taskId is required', { field: 'taskId' });
  if (!TASK_STATUS.includes(statusCode)) throw badRequest(`statusCode must be one of ${TASK_STATUS.join('|')}`, { field: 'statusCode' });
  return prisma.$transaction(async (tx) => {
    const task = await tx.offboardingChecklistTask.findUnique({ where: { id: taskId } });
    if (!task || task.checklistId !== checklistId) throw notFound('Checklist task not found');
    const updated = await tx.offboardingChecklistTask.update({
      where: { id: taskId },
      data: {
        statusCode,
        completedByUserId: statusCode === 'pending' ? null : (nonEmpty(completedByUserId) ? completedByUserId : task.completedByUserId),
        completedAt: statusCode === 'pending' ? null : new Date(),
        note: note !== undefined ? (nonEmpty(note) ? note.trim() : null) : task.note,
      },
    });
    const allTasks = await tx.offboardingChecklistTask.findMany({
      where: { checklistId },
      include: { templateTask: { select: { isRequired: true } } },
    });
    const requiredDone = allTasks.filter((t) => t.templateTask.isRequired).every((t) => t.statusCode === 'done');
    const everyDoneOrSkipped = allTasks.every((t) => t.statusCode === 'done' || t.statusCode === 'skipped');
    let autoCompleted = false;
    if (requiredDone && everyDoneOrSkipped) {
      await tx.offboardingChecklist.update({ where: { id: checklistId }, data: { statusCode: 'completed', completedAt: new Date() } });
      autoCompleted = true;
    } else {
      await tx.offboardingChecklist.update({ where: { id: checklistId }, data: { statusCode: 'in_progress', completedAt: null } });
    }
    return { updated, autoCompleted };
  }).then(({ updated, autoCompleted }) => {
    if (autoCompleted) {
      void (async () => {
        const cl = await prisma.offboardingChecklist.findUnique({
          where: { id: checklistId },
          select: { userId: true, templateId: true },
        });
        safeBroadcast('hrm.employee.offboarded', {
          checklistId,
          userId: cl?.userId,
          templateId: cl?.templateId,
        });
      })().catch(() => { /* never throws */ });
    }
    return updated;
  });
}

export async function completeChecklist(prisma, id) {
  return prisma.$transaction(async (tx) => {
    const cl = await tx.offboardingChecklist.findFirst({
      where: { id, isDeleted: false },
      include: { tasks: { include: { templateTask: { select: { isRequired: true } } } } },
    });
    if (!cl) throw notFound('Offboarding checklist not found');
    const requiredPending = cl.tasks.filter((t) => t.templateTask.isRequired && t.statusCode !== 'done');
    if (requiredPending.length > 0) throw conflict('Some required tasks are still pending', { pending: requiredPending.length });
    return tx.offboardingChecklist.update({ where: { id }, data: { statusCode: 'completed', completedAt: new Date() } });
  }).then((cl) => {
    safeBroadcast('hrm.employee.offboarded', {
      checklistId: cl.id,
      userId: cl.userId,
      templateId: cl.templateId,
    });
    return cl;
  });
}

export async function startOffboarding(prisma, { userId, templateId, startDate }) {
  // Convenience wrapper used by the HRM directory UI: pick the user's
  // department template if templateId is not provided.
  if (!nonEmpty(userId)) throw badRequest('userId is required', { field: 'userId' });
  let resolvedTemplateId = templateId;
  if (!resolvedTemplateId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    if (!user) throw notFound('User not found');
    resolvedTemplateId = await resolveTemplateForDepartment(prisma, user.departmentId ?? null);
  }
  if (!resolvedTemplateId) {
    throw badRequest('No active offboarding template available for this user', { field: 'templateId' });
  }
  return createChecklistFromTemplate(prisma, { userId, templateId: resolvedTemplateId, startDate });
}

export async function getCompletionStats(prisma, { userId } = {}) {
  const where = { isDeleted: false };
  if (userId) where.userId = userId;
  const checklists = await prisma.offboardingChecklist.findMany({
    where,
    select: { id: true, statusCode: true, userId: true, tasks: { select: { statusCode: true } } },
  });
  return checklists.map((cl) => {
    const total = cl.tasks.length;
    const done = cl.tasks.filter((t) => t.statusCode === 'done').length;
    return {
      id: cl.id,
      userId: cl.userId,
      statusCode: cl.statusCode,
      total,
      done,
      progressPct: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });
}
