// HRM-2.2 — Onboarding templates + checklists business logic.
//
// Used by:
//   backend/routes/hrm/onboarding.routes.mjs        (user-facing)
//   backend/services/hrm/recruitmentOnboarding.service.mjs
//     (hire hook — creates a checklist for the freshly hired user
//      based on a resolved template, best-effort outside the hire
//      transaction)
//
// Conventions: soft delete on Template + Checklist; statusCode is the
// single lifecycle column. completeChecklistTask + completeChecklist
// run their writes in a prisma.$transaction so the rolled-up
// statusCode never drifts from the individual tasks.

// ============================================================
// Errors
// ============================================================

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
  return prisma.onboardingTemplate.findMany({
    where,
    orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    include: {
      department: { select: { id: true, code: true, name: true } },
      _count: { select: { tasks: true, checklists: true } },
    },
  });
}

export async function getTemplate(prisma, id) {
  const tpl = await prisma.onboardingTemplate.findFirst({
    where: { id, isDeleted: false },
    include: {
      department: { select: { id: true, code: true, name: true } },
      tasks: { orderBy: [{ order: 'asc' }, { title: 'asc' }] },
    },
  });
  if (!tpl) throw notFound('Onboarding template not found');
  return tpl;
}

export async function createTemplate(prisma, input) {
  if (!nonEmpty(input?.name)) throw badRequest('name is required', { field: 'name' });
  const tasks = Array.isArray(input?.tasks) ? input.tasks : [];
  return prisma.$transaction(async (tx) => {
    const tpl = await tx.onboardingTemplate.create({
      data: {
        name: input.name.trim(),
        departmentId: nonEmpty(input?.departmentId) ? input.departmentId : null,
        isActive: input?.isActive !== false,
      },
    });
    if (tasks.length > 0) {
      await tx.onboardingTemplateTask.createMany({
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
    return tx.onboardingTemplate.findUnique({
      where: { id: tpl.id },
      include: {
        department: { select: { id: true, code: true, name: true } },
        tasks: { orderBy: [{ order: 'asc' }] },
      },
    });
  });
}

export async function updateTemplate(prisma, id, input) {
  const tpl = await prisma.onboardingTemplate.findFirst({ where: { id, isDeleted: false } });
  if (!tpl) throw notFound('Onboarding template not found');

  return prisma.$transaction(async (tx) => {
    const data = {};
    if (input?.name !== undefined) data.name = String(input.name).trim();
    if (input?.departmentId !== undefined) {
      data.departmentId = nonEmpty(input.departmentId) ? input.departmentId : null;
    }
    if (input?.isActive !== undefined) data.isActive = Boolean(input.isActive);
    if (Object.keys(data).length > 0) {
      await tx.onboardingTemplate.update({ where: { id }, data });
    }

    if (Array.isArray(input?.tasks)) {
      // Replace strategy — simpler than diffing; safe because checklist
      // tasks reference templateTasks by FK Restrict (we refuse delete
      // if any checklist task points to a template task we'd remove).
      const existingTasks = await tx.onboardingTemplateTask.findMany({
        where: { templateId: id },
        select: { id: true },
      });
      const incomingIds = new Set(input.tasks.filter((t) => nonEmpty(t?.id)).map((t) => t.id));
      const toDelete = existingTasks.filter((t) => !incomingIds.has(t.id)).map((t) => t.id);
      if (toDelete.length > 0) {
        const referenced = await tx.onboardingChecklistTask.count({
          where: { templateTaskId: { in: toDelete } },
        });
        if (referenced > 0) {
          throw conflict('Some tasks are referenced by existing checklists — deactivate the template instead', {
            referencedCount: referenced,
          });
        }
        await tx.onboardingTemplateTask.deleteMany({ where: { id: { in: toDelete } } });
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
          await tx.onboardingTemplateTask.update({ where: { id: t.id }, data: payload });
        } else {
          await tx.onboardingTemplateTask.create({ data: payload });
        }
      }
    }

    return tx.onboardingTemplate.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, code: true, name: true } },
        tasks: { orderBy: [{ order: 'asc' }] },
      },
    });
  });
}

export async function deleteTemplate(prisma, id) {
  const tpl = await prisma.onboardingTemplate.findFirst({ where: { id, isDeleted: false } });
  if (!tpl) throw notFound('Onboarding template not found');
  const active = await prisma.onboardingChecklist.count({
    where: { templateId: id, statusCode: 'in_progress', isDeleted: false },
  });
  if (active > 0) {
    throw conflict('Template still has active checklists — finish them before archiving', { active });
  }
  await prisma.onboardingTemplate.update({
    where: { id },
    data: { isDeleted: true, isActive: false, deletedAt: new Date() },
  });
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
  return prisma.onboardingChecklist.findMany({
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
  const cl = await prisma.onboardingChecklist.findFirst({
    where: { id, isDeleted: false },
    include: {
      user: { select: { id: true, name: true, email: true, departmentId: true } },
      template: { select: { id: true, name: true } },
      tasks: {
        include: {
          templateTask: true,
          completedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ templateTask: { order: 'asc' } }],
      },
    },
  });
  if (!cl) throw notFound('Onboarding checklist not found');
  return cl;
}

// Lazily create a checklist for (userId, templateId). Returns the
// checklist with its tasks pre-populated from the template's tasks.
//
// Idempotent at the per-user level: if an in_progress checklist for
// this template+user already exists, returns the existing one.
export async function createChecklistFromTemplate(prisma, { userId, templateId, startDate }) {
  if (!nonEmpty(userId)) throw badRequest('userId is required', { field: 'userId' });
  if (!nonEmpty(templateId)) throw badRequest('templateId is required', { field: 'templateId' });

  const template = await prisma.onboardingTemplate.findFirst({
    where: { id: templateId, isDeleted: false, isActive: true },
    include: { tasks: { orderBy: [{ order: 'asc' }] } },
  });
  if (!template) throw notFound('Active onboarding template not found');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.onboardingChecklist.findFirst({
      where: { userId, templateId, isDeleted: false, statusCode: 'in_progress' },
    });
    if (existing) return existing;

    const checklist = await tx.onboardingChecklist.create({
      data: {
        userId,
        templateId,
        startDate: startDate ? new Date(startDate) : new Date(),
        statusCode: 'in_progress',
      },
    });
    if (template.tasks.length > 0) {
      await tx.onboardingChecklistTask.createMany({
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

// Pick the best template for a department: prefer a department-scoped
// active template; fall back to a global (departmentId IS NULL) active
// template. Returns null if neither exists.
export async function resolveTemplateForDepartment(prisma, departmentId) {
  if (departmentId) {
    const t = await prisma.onboardingTemplate.findFirst({
      where: { departmentId, isDeleted: false, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (t) return t.id;
  }
  const global = await prisma.onboardingTemplate.findFirst({
    where: { departmentId: null, isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return global?.id ?? null;
}

export async function updateChecklistTask(prisma, { checklistId, taskId, statusCode, completedByUserId, note }) {
  if (!nonEmpty(taskId)) throw badRequest('taskId is required', { field: 'taskId' });
  if (!TASK_STATUS.includes(statusCode)) {
    throw badRequest(`statusCode must be one of ${TASK_STATUS.join('|')}`, { field: 'statusCode' });
  }
  return prisma.$transaction(async (tx) => {
    const task = await tx.onboardingChecklistTask.findUnique({ where: { id: taskId } });
    if (!task || task.checklistId !== checklistId) throw notFound('Checklist task not found');
    const updated = await tx.onboardingChecklistTask.update({
      where: { id: taskId },
      data: {
        statusCode,
        completedByUserId: statusCode === 'pending' ? null : (nonEmpty(completedByUserId) ? completedByUserId : task.completedByUserId),
        completedAt: statusCode === 'pending' ? null : new Date(),
        note: note !== undefined ? (nonEmpty(note) ? note.trim() : null) : task.note,
      },
    });

    // Auto-flip the rolled-up checklist statusCode if every required
    // task is done. Non-required tasks left pending do NOT block
    // completion (mirrors the existing OnboardingPage UX).
    const allTasks = await tx.onboardingChecklistTask.findMany({
      where: { checklistId },
      include: { templateTask: { select: { isRequired: true } } },
    });
    const requiredDone = allTasks.filter((t) => t.templateTask.isRequired).every((t) => t.statusCode === 'done');
    const everyDoneOrSkipped = allTasks.every((t) => t.statusCode === 'done' || t.statusCode === 'skipped');
    if (requiredDone && everyDoneOrSkipped) {
      await tx.onboardingChecklist.update({
        where: { id: checklistId },
        data: { statusCode: 'completed', completedAt: new Date() },
      });
    } else {
      await tx.onboardingChecklist.update({
        where: { id: checklistId },
        data: { statusCode: 'in_progress', completedAt: null },
      });
    }
    return updated;
  });
}

export async function completeChecklist(prisma, id, { completedByUserId } = {}) {
  return prisma.$transaction(async (tx) => {
    const cl = await tx.onboardingChecklist.findFirst({
      where: { id, isDeleted: false },
      include: {
        tasks: { include: { templateTask: { select: { isRequired: true } } } },
      },
    });
    if (!cl) throw notFound('Onboarding checklist not found');
    const requiredPending = cl.tasks.filter((t) => t.templateTask.isRequired && t.statusCode !== 'done');
    if (requiredPending.length > 0) {
      throw conflict('Some required tasks are still pending', { pending: requiredPending.length });
    }
    return tx.onboardingChecklist.update({
      where: { id },
      data: { statusCode: 'completed', completedAt: new Date() },
    });
  });
}

// Roll-up of completion stats for HR dashboards.
export async function getCompletionStats(prisma, { userId } = {}) {
  const where = { isDeleted: false };
  if (userId) where.userId = userId;
  const checklists = await prisma.onboardingChecklist.findMany({
    where,
    select: {
      id: true,
      statusCode: true,
      userId: true,
      tasks: { select: { statusCode: true } },
    },
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
