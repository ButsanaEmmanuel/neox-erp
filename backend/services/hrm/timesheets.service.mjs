// HRM-2.5 — Timesheet entries + week-level submit/approve/reject.
//
// Model: one TimesheetEntry row per (userId, workDate, projectId).
// The "week" is a derived view — we group entries by weekStartDate
// (Monday) and roll up totals + status in the service. The status of
// the week is the most-restrictive status across its entries:
//
//   any entry  rejected  → week is rejected
//   any entry  approved  → week is approved (mixed is rare and meant
//                          for partial weekly approvals)
//   any entry  submitted → week is submitted
//   else                 → week is draft
//
// Lifecycle (per entry):
//   draft → submitted → approved
//                    ↘ rejected (back to draft via re-edit)
//
// Rules:
//   - Only the owner (userId) can write/delete a draft or rejected
//     entry.
//   - submit: refuse if the entry is already approved.
//   - approve: refuse if the entry is still draft (must be submitted
//     first).
//   - approver is recorded; payrollEngine already filters on
//     statusCode = "approved", so no engine change is needed.

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
const forbidden  = (msg, extra) => new HttpError(403, 'FORBIDDEN', msg, extra);
const conflict   = (msg, extra) => new HttpError(409, 'CONFLICT', msg, extra);

function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }

const STATUSES = ['draft', 'submitted', 'approved', 'rejected'];

// ISO week — Monday is day 1. Returns a UTC midnight of that Monday.
function weekStartOf(date) {
  const d = new Date(date);
  const dow = d.getUTCDay();                   // 0 = Sunday, 1 = Monday, ...
  const diff = (dow === 0 ? -6 : 1 - dow);     // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseDate(v, field) {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} must be a valid date`, { field });
  return d;
}

// ============================================================
// Reads
// ============================================================

export async function listEntries(prisma, { userId, weekStart, statusCode, includeDeleted = false } = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (userId)     where.userId = userId;
  if (statusCode) where.statusCode = statusCode;
  if (weekStart) {
    const start = weekStartOf(parseDate(weekStart, 'weekStart'));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    where.workDate = { gte: start, lt: end };
  }
  return prisma.timesheetEntry.findMany({
    where,
    orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    include: {
      user:       { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

// Roll-up: returns { weekStartDate, statusCode, totalHours, entries[] }.
export async function getWeek(prisma, { userId, weekStart }) {
  if (!nonEmpty(userId))    throw badRequest('userId is required',    { field: 'userId' });
  if (!weekStart)           throw badRequest('weekStart is required', { field: 'weekStart' });
  const start = weekStartOf(parseDate(weekStart, 'weekStart'));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  const entries = await prisma.timesheetEntry.findMany({
    where: { userId, isDeleted: false, workDate: { gte: start, lt: end } },
    orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    include: { approvedBy: { select: { id: true, name: true, email: true } } },
  });

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  let weekStatus = 'draft';
  if (entries.some((e) => e.statusCode === 'rejected'))  weekStatus = 'rejected';
  else if (entries.length > 0 && entries.every((e) => e.statusCode === 'approved')) weekStatus = 'approved';
  else if (entries.some((e) => e.statusCode === 'submitted')) weekStatus = 'submitted';
  else if (entries.some((e) => e.statusCode === 'approved'))  weekStatus = 'approved';  // partial

  return {
    userId,
    weekStartDate: start,
    statusCode: weekStatus,
    totalHours,
    entryCount: entries.length,
    entries,
  };
}

// Manager view: weeks awaiting approval.
export async function listPendingWeeks(prisma, { departmentId } = {}) {
  const where = { isDeleted: false, statusCode: 'submitted' };
  if (departmentId) where.departmentId = departmentId;
  const rows = await prisma.timesheetEntry.findMany({
    where,
    orderBy: [{ submittedAt: 'asc' }],
    include: {
      user: { select: { id: true, name: true, email: true, departmentId: true } },
    },
  });
  // Bucket by (userId, weekStartDate).
  const byKey = new Map();
  for (const e of rows) {
    const ws = e.weekStartDate || weekStartOf(e.workDate);
    const key = `${e.userId}|${ws.toISOString().slice(0, 10)}`;
    const bucket = byKey.get(key) || {
      userId: e.userId,
      user: e.user,
      weekStartDate: ws,
      totalHours: 0,
      entryCount: 0,
      submittedAt: e.submittedAt,
    };
    bucket.totalHours += Number(e.hours);
    bucket.entryCount += 1;
    if (e.submittedAt && (!bucket.submittedAt || e.submittedAt < bucket.submittedAt)) {
      bucket.submittedAt = e.submittedAt;
    }
    byKey.set(key, bucket);
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const aTs = a.submittedAt?.getTime() ?? 0;
    const bTs = b.submittedAt?.getTime() ?? 0;
    return aTs - bTs;
  });
}

// ============================================================
// Writes — single entry
// ============================================================

export async function upsertEntry(prisma, input, { actorUserId }) {
  if (!nonEmpty(actorUserId))   throw badRequest('actorUserId is required', { field: 'actorUserId' });
  if (!nonEmpty(input?.userId)) throw badRequest('userId is required',      { field: 'userId' });
  if (!input?.workDate)         throw badRequest('workDate is required',    { field: 'workDate' });
  if (input?.hours == null)     throw badRequest('hours is required',       { field: 'hours' });
  const hours = Number(input.hours);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    throw badRequest('hours must be between 0 and 24', { field: 'hours' });
  }
  if (input.userId !== actorUserId) {
    throw forbidden('Only the owner may write a timesheet entry', { code: 'NOT_OWNER' });
  }

  const workDate = parseDate(input.workDate, 'workDate');
  const weekStartDate = weekStartOf(workDate);

  // Update path — id provided.
  if (nonEmpty(input?.id)) {
    const existing = await prisma.timesheetEntry.findFirst({ where: { id: input.id, isDeleted: false } });
    if (!existing) throw notFound('Timesheet entry not found');
    if (existing.userId !== actorUserId) throw forbidden('Only the owner may edit this entry', { code: 'NOT_OWNER' });
    if (existing.statusCode === 'approved') {
      throw conflict('Cannot edit an approved entry', { code: 'ENTRY_APPROVED' });
    }
    if (existing.statusCode === 'submitted') {
      throw conflict('Cannot edit a submitted entry — reject it first', { code: 'ENTRY_SUBMITTED' });
    }
    return prisma.timesheetEntry.update({
      where: { id: input.id },
      data: {
        hours,
        description:  input.description ?? existing.description,
        projectId:    input.projectId   ?? existing.projectId,
        workDate,
        weekStartDate,
        statusCode:   'draft',
        // Clear any prior rejection bookkeeping on re-edit.
        rejectedAt:      existing.statusCode === 'rejected' ? null : existing.rejectedAt,
        reviewerComment: existing.statusCode === 'rejected' ? null : existing.reviewerComment,
      },
    });
  }

  // Create path. departmentId is required by the schema — pull it
  // from the user if the caller didn't provide one.
  let departmentId = nonEmpty(input?.departmentId) ? input.departmentId : null;
  if (!departmentId) {
    const u = await prisma.user.findUnique({ where: { id: input.userId }, select: { departmentId: true } });
    departmentId = u?.departmentId ?? null;
  }
  if (!departmentId) {
    throw badRequest('departmentId is required (user has no department on file)', { field: 'departmentId' });
  }

  return prisma.timesheetEntry.create({
    data: {
      userId:        input.userId,
      departmentId,
      projectId:     nonEmpty(input?.projectId) ? input.projectId : null,
      workDate,
      weekStartDate,
      hours,
      description:   nonEmpty(input?.description) ? input.description.trim() : null,
      statusCode:    'draft',
    },
  });
}

export async function deleteEntry(prisma, id, { actorUserId }) {
  const e = await prisma.timesheetEntry.findFirst({ where: { id, isDeleted: false } });
  if (!e) throw notFound('Timesheet entry not found');
  if (e.userId !== actorUserId) throw forbidden('Only the owner may delete this entry', { code: 'NOT_OWNER' });
  if (e.statusCode === 'approved') {
    throw conflict('Cannot delete an approved entry', { code: 'ENTRY_APPROVED' });
  }
  await prisma.timesheetEntry.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  return { id, deleted: true };
}

// ============================================================
// Lifecycle — single entry
// ============================================================

export async function submitEntry(prisma, id, { actorUserId }) {
  const e = await prisma.timesheetEntry.findFirst({ where: { id, isDeleted: false } });
  if (!e) throw notFound('Timesheet entry not found');
  if (e.userId !== actorUserId) throw forbidden('Only the owner may submit this entry', { code: 'NOT_OWNER' });
  if (e.statusCode === 'approved') {
    throw conflict('Entry is already approved', { code: 'ENTRY_APPROVED', currentStatus: 'approved' });
  }
  if (e.statusCode === 'submitted') {
    return e;  // idempotent
  }
  // draft + rejected → submitted
  return prisma.timesheetEntry.update({
    where: { id },
    data: {
      statusCode: 'submitted',
      submittedAt: new Date(),
      rejectedAt: null,
      reviewerComment: null,
    },
  });
}

export async function approveEntry(prisma, id, { actorUserId }) {
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });
  const e = await prisma.timesheetEntry.findFirst({ where: { id, isDeleted: false } });
  if (!e) throw notFound('Timesheet entry not found');
  if (e.statusCode === 'approved') return e;
  if (e.statusCode !== 'submitted') {
    throw conflict('Only submitted entries can be approved', {
      code: 'ENTRY_NOT_SUBMITTED',
      currentStatus: e.statusCode,
    });
  }
  return prisma.timesheetEntry.update({
    where: { id },
    data: {
      statusCode: 'approved',
      approvedAt: new Date(),
      approvedByUserId: actorUserId,
    },
  });
}

export async function rejectEntry(prisma, id, { actorUserId, comment }) {
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });
  const e = await prisma.timesheetEntry.findFirst({ where: { id, isDeleted: false } });
  if (!e) throw notFound('Timesheet entry not found');
  if (e.statusCode === 'approved') {
    throw conflict('Cannot reject an approved entry', { code: 'ENTRY_APPROVED' });
  }
  if (e.statusCode !== 'submitted') {
    throw conflict('Only submitted entries can be rejected', {
      code: 'ENTRY_NOT_SUBMITTED',
      currentStatus: e.statusCode,
    });
  }
  return prisma.timesheetEntry.update({
    where: { id },
    data: {
      statusCode: 'rejected',
      rejectedAt: new Date(),
      reviewerComment: nonEmpty(comment) ? comment.trim() : null,
      // Keep submittedAt + approvedByUserId/approvedAt cleared so the
      // owner sees a clean rejection state.
      approvedAt: null,
      approvedByUserId: null,
    },
  });
}

// ============================================================
// Lifecycle — bulk week operations (one shot for the UI)
// ============================================================

async function _bulkWeek(prisma, { userId, weekStart, op, actorUserId, comment }) {
  const start = weekStartOf(parseDate(weekStart, 'weekStart'));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  const entries = await prisma.timesheetEntry.findMany({
    where: { userId, isDeleted: false, workDate: { gte: start, lt: end } },
  });
  const results = [];
  for (const e of entries) {
    try {
      if (op === 'submit')  results.push(await submitEntry(prisma,  e.id, { actorUserId }));
      if (op === 'approve') results.push(await approveEntry(prisma, e.id, { actorUserId }));
      if (op === 'reject')  results.push(await rejectEntry(prisma,  e.id, { actorUserId, comment }));
    } catch (err) {
      // Surface the first hard conflict (the 409 paths are
      // intentional contract violations; tests assert on them).
      if (err?.statusCode === 409 || err?.statusCode === 403) throw err;
      throw err;
    }
  }
  return { affected: results.length };
}

export const submitWeek  = (prisma, args) => _bulkWeek(prisma, { ...args, op: 'submit' });
export const approveWeek = (prisma, args) => _bulkWeek(prisma, { ...args, op: 'approve' });
export const rejectWeek  = (prisma, args) => _bulkWeek(prisma, { ...args, op: 'reject' });

export const STATUSES_LIST = STATUSES;
