// HRM-2.4 — HR cases (incidents, grievances, disciplinary, inquiry).
//
// Lifecycle:
//   open ──► investigating ──► resolved ──► closed
//        ╲                                        ╱
//         └────────► escalated ────────────────►─┘
//
//   - open and investigating can transition to escalated, resolved,
//     or back/forward along the main spine.
//   - resolved can move to closed (final) or back to investigating
//     if new info shows up.
//   - escalated can land on resolved or closed once handled.
//   - closed is terminal — refused if attempted from anywhere.
//
// Authorisation rules baked into the service (the route adds the
// permission gate on top — service-level checks are belt-and-braces
// for the test suite and any future internal caller):
//   - Only the assignee or a caller with hrm.cases.execute may change
//     status. The route enforces hrm.cases.execute; the service
//     additionally accepts the assignee path so a route handler can
//     pass `actorIsAssignee: true` without granting the global perm.
//   - listCases({ forUserId }) scopes to reported-by-me OR
//     assigned-to-me when the caller is not hrm.cases.read-global.
//     The route does that scoping based on the permission set.
//
// Every status change appends a HrmCaseEvent row so the detail page
// can render the audit trail.

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
const notFound   = (msg)        => new HttpError(404, 'NOT_FOUND', msg);
const conflict   = (msg, extra) => new HttpError(409, 'CONFLICT', msg, extra);
const forbidden  = (msg, extra) => new HttpError(403, 'FORBIDDEN', msg, extra);

function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }

const CASE_TYPES    = ['grievance', 'incident', 'disciplinary', 'inquiry'];
const CASE_STATUSES = ['open', 'investigating', 'resolved', 'escalated', 'closed'];
const CASE_PRIORITY = ['low', 'medium', 'high'];

// Allowed transitions. closed is terminal: nothing leaves it.
const TRANSITIONS = {
  open:          new Set(['investigating', 'escalated', 'resolved']),
  investigating: new Set(['resolved', 'escalated', 'open']),
  resolved:      new Set(['closed', 'investigating']),
  escalated:     new Set(['investigating', 'resolved', 'closed']),
  closed:        new Set(),
};

function assertTransition(from, to) {
  if (from === to) return;
  if (!CASE_STATUSES.includes(to)) {
    throw badRequest(`statusCode must be one of ${CASE_STATUSES.join('|')}`, { field: 'statusCode' });
  }
  if (!TRANSITIONS[from]?.has(to)) {
    throw conflict(`Illegal transition ${from} → ${to}`, { code: 'ILLEGAL_TRANSITION', from, to });
  }
}

// ============================================================
// Cases
// ============================================================

export async function listCases(prisma, { forUserId, statusCode, caseType, priority, includeDeleted = false } = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (statusCode) where.statusCode = statusCode;
  if (caseType)   where.caseType   = caseType;
  if (priority)   where.priority   = priority;
  if (forUserId) {
    where.OR = [
      { reportedByUserId: forUserId },
      { assignedToUserId: forUserId },
    ];
  }
  return prisma.hrmCase.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      _count:   { select: { events: true } },
    },
  });
}

export async function getCase(prisma, id) {
  const c = await prisma.hrmCase.findFirst({
    where: { id, isDeleted: false },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      events:   {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!c) throw notFound('Case not found');
  return c;
}

export async function createCase(prisma, input, { actorUserId }) {
  if (!nonEmpty(actorUserId))     throw badRequest('actorUserId is required',     { field: 'actorUserId' });
  if (!nonEmpty(input?.title))       throw badRequest('title is required',       { field: 'title' });
  if (!nonEmpty(input?.description)) throw badRequest('description is required', { field: 'description' });

  const caseType = nonEmpty(input?.caseType) ? input.caseType.trim().toLowerCase() : 'inquiry';
  if (!CASE_TYPES.includes(caseType)) {
    throw badRequest(`caseType must be one of ${CASE_TYPES.join('|')}`, { field: 'caseType' });
  }
  const priority = nonEmpty(input?.priority) ? input.priority.trim().toLowerCase() : 'medium';
  if (!CASE_PRIORITY.includes(priority)) {
    throw badRequest(`priority must be one of ${CASE_PRIORITY.join('|')}`, { field: 'priority' });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.hrmCase.create({
      data: {
        caseType,
        title:            input.title.trim(),
        description:      input.description,
        reportedByUserId: actorUserId,
        assignedToUserId: nonEmpty(input?.assignedToUserId) ? input.assignedToUserId : null,
        priority,
        statusCode:       'open',
      },
    });
    await tx.hrmCaseEvent.create({
      data: {
        caseId: created.id,
        eventType: 'status_change',
        fromStatus: null,
        toStatus: 'open',
        note: 'Case opened',
        authorUserId: actorUserId,
      },
    });
    return tx.hrmCase.findUnique({
      where: { id: created.id },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  });
}

export async function updateCase(prisma, id, input) {
  const c = await prisma.hrmCase.findFirst({ where: { id, isDeleted: false } });
  if (!c) throw notFound('Case not found');
  if (c.statusCode === 'closed') {
    throw conflict('Cannot edit a closed case', { code: 'CASE_CLOSED' });
  }
  const data = {};
  if (input?.title       !== undefined) data.title       = String(input.title).trim();
  if (input?.description !== undefined) data.description = String(input.description);
  if (input?.priority    !== undefined) {
    const p = String(input.priority).trim().toLowerCase();
    if (!CASE_PRIORITY.includes(p)) throw badRequest(`priority must be one of ${CASE_PRIORITY.join('|')}`, { field: 'priority' });
    data.priority = p;
  }
  if (input?.assignedToUserId !== undefined) {
    data.assignedToUserId = nonEmpty(input.assignedToUserId) ? input.assignedToUserId : null;
  }
  return prisma.hrmCase.update({
    where: { id },
    data,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
}

// Status transition + event emission in a transaction.
// `canExecute`  = true if the caller has hrm.cases.execute globally.
// `actorIsAssignee` = true if the caller is the current assignee.
// At least one must be true, else 403 FORBIDDEN.
export async function changeStatus(prisma, id, { toStatus, note, actorUserId, canExecute, actorIsAssignee }) {
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });
  return prisma.$transaction(async (tx) => {
    const c = await tx.hrmCase.findFirst({ where: { id, isDeleted: false } });
    if (!c) throw notFound('Case not found');

    const isAssigneeNow = nonEmpty(c.assignedToUserId) && c.assignedToUserId === actorUserId;
    const allowed = canExecute || actorIsAssignee || isAssigneeNow;
    if (!allowed) {
      throw forbidden('Only the case assignee or a user with hrm.cases.execute may change status', {
        code: 'NOT_AUTHORIZED_FOR_STATUS_CHANGE',
      });
    }

    assertTransition(c.statusCode, toStatus);

    const stampUpdate = {};
    if (toStatus === 'escalated' && !c.escalatedAt) stampUpdate.escalatedAt = new Date();
    if (toStatus === 'resolved'  && !c.resolvedAt)  stampUpdate.resolvedAt  = new Date();
    if (toStatus === 'closed'    && !c.closedAt)    stampUpdate.closedAt    = new Date();

    const updated = await tx.hrmCase.update({
      where: { id },
      data: {
        statusCode: toStatus,
        ...stampUpdate,
        ...(toStatus === 'closed' && nonEmpty(note) ? { resolution: note.trim() } : {}),
      },
    });

    await tx.hrmCaseEvent.create({
      data: {
        caseId: id,
        eventType: 'status_change',
        fromStatus: c.statusCode,
        toStatus,
        note: nonEmpty(note) ? note.trim() : null,
        authorUserId: actorUserId,
      },
    });

    return { updated, fromStatus: c.statusCode };
  }).then(({ updated, fromStatus }) => {
    // HRM-2.6 — escalation is the only transition the plan calls out.
    // Emit it as a discrete event so HR admin dashboards can show a
    // dot without subscribing to every status change.
    if (updated.statusCode === 'escalated' && fromStatus !== 'escalated') {
      safeBroadcast('hrm.case.escalated', {
        caseId: updated.id,
        fromStatus,
        reportedByUserId: updated.reportedByUserId,
        assignedToUserId: updated.assignedToUserId,
        priority: updated.priority,
        escalatedByUserId: actorUserId,
      });
    }
    return updated;
  });
}

export async function addNote(prisma, id, { note, actorUserId }) {
  if (!nonEmpty(note)) throw badRequest('note is required', { field: 'note' });
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });
  const c = await prisma.hrmCase.findFirst({ where: { id, isDeleted: false } });
  if (!c) throw notFound('Case not found');
  return prisma.hrmCaseEvent.create({
    data: {
      caseId: id,
      eventType: 'note',
      note: note.trim(),
      authorUserId: actorUserId,
    },
  });
}

// Re-assign a case. Emits an "assignment" event so the audit trail
// captures the change even when the status didn't move.
export async function assignCase(prisma, id, { assignedToUserId, note, actorUserId }) {
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });
  return prisma.$transaction(async (tx) => {
    const c = await tx.hrmCase.findFirst({ where: { id, isDeleted: false } });
    if (!c) throw notFound('Case not found');
    const target = nonEmpty(assignedToUserId) ? assignedToUserId : null;
    if (c.assignedToUserId === target) return c;
    const updated = await tx.hrmCase.update({ where: { id }, data: { assignedToUserId: target } });
    await tx.hrmCaseEvent.create({
      data: {
        caseId: id,
        eventType: 'assignment',
        note: nonEmpty(note) ? note.trim() : `Assigned to ${target ?? 'no one'}`,
        authorUserId: actorUserId,
      },
    });
    return updated;
  });
}

export const CASE_TYPES_LIST    = CASE_TYPES;
export const CASE_STATUSES_LIST = CASE_STATUSES;
