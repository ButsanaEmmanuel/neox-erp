import { safeBroadcast } from '../realtime/sseBroadcaster.mjs';

// HRM-1.5 — Leave management business logic.
//
// Used by backend/routes/hrm/leave.routes.mjs. All write paths run in
// a single prisma.$transaction() so the LeaveBalance counters never
// drift from the LeaveRequest status.
//
// Day calculation: business days only — Saturday, Sunday AND active
// PublicHoliday rows excluded. `calculateLeaveDays` stays pure (takes
// a pre-built Set of YYYY-MM-DD strings so tests don't need a DB);
// `calculateLeaveDaysWithHolidays(prisma, ...)` is the async wrapper
// used by request creation.
//
// Status lifecycle:
//   pending  -> approved | rejected | cancelled
//   approved -> cancelled (only while startDate is in the future)
//   rejected / cancelled : terminal
//
// Balance accounting (always inside the same tx as the LeaveRequest write):
//   submit  : pending += days        (after available-balance check)
//   approve : pending -= days, used += days
//   reject  : pending -= days
//   cancel  : pending -= days (if pending) OR used -= days (if approved)
//
// Insufficient balance is surfaced as HTTP 422 with
// code='INSUFFICIENT_BALANCE' so the UI can render a meaningful error
// rather than a generic 500.

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
const unprocessable = (msg, extra) => new HttpError(422, 'INSUFFICIENT_BALANCE', msg, extra);
const forbidden = (msg, extra) => new HttpError(403, 'FORBIDDEN', msg, extra);

// ============================================================
// Day calculation
// ============================================================

const ONE_DAY_MS = 86_400_000;

export function calculateLeaveDays(startDate, endDate, publicHolidaysSet = null) {
  const start = startDate instanceof Date ? new Date(startDate) : new Date(String(startDate));
  const end = endDate instanceof Date ? new Date(endDate) : new Date(String(endDate));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw badRequest('startDate and endDate must be valid ISO dates', { field: 'startDate' });
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end.getTime() < start.getTime()) {
    throw badRequest('endDate must be on or after startDate', { field: 'endDate' });
  }
  let count = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += ONE_DAY_MS) {
    const d = new Date(t);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    if (publicHolidaysSet && publicHolidaysSet.has(d.toISOString().slice(0, 10))) continue;
    count += 1;
  }
  // Round to nearest 0.5 — half-day inputs are not modelled yet but
  // the round prepares the API surface for them.
  return Math.round(count * 2) / 2;
}

// Async wrapper: fetches active PublicHoliday rows in the [startDate,
// endDate] range for the given country (default 'CD' — RDC) and builds
// the lookup Set, then delegates to the pure calculateLeaveDays. This
// is the entry point used by createRequest below; tests can keep
// calling the pure form with no DB.
export async function calculateLeaveDaysWithHolidays(prisma, startDate, endDate, country = 'CD') {
  const start = startDate instanceof Date ? new Date(startDate) : new Date(String(startDate));
  const end = endDate instanceof Date ? new Date(endDate) : new Date(String(endDate));
  const holidays = await prisma.publicHoliday.findMany({
    where: {
      country,
      isActive: true,
      date: { gte: start, lte: end },
    },
    select: { date: true },
  });
  const set = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
  return calculateLeaveDays(startDate, endDate, set);
}

// ============================================================
// Numbers / dates helpers
// ============================================================

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const n = Number(typeof value === 'object' && typeof value.toString === 'function'
    ? value.toString()
    : value);
  return Number.isFinite(n) ? n : 0;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseDate(value, field) {
  if (!value) throw badRequest(`${field} is required`, { field });
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} must be a valid date`, { field });
  return d;
}

function yearOf(date) {
  return date.getFullYear();
}

// ============================================================
// Policy CRUD
// ============================================================

export async function listPolicies(prisma, { includeInactive = false, includeDeleted = false } = {}) {
  const where = { isDeleted: includeDeleted ? undefined : false };
  if (!includeInactive) where.isActive = true;
  return prisma.leavePolicy.findMany({
    where,
    orderBy: [{ leaveType: 'asc' }, { name: 'asc' }],
  });
}

export async function getPolicy(prisma, policyId) {
  const policy = await prisma.leavePolicy.findFirst({
    where: { id: policyId, isDeleted: false },
  });
  if (!policy) throw notFound('Policy not found');
  return policy;
}

export async function createPolicy(prisma, input) {
  if (!nonEmpty(input?.name)) throw badRequest('Policy name is required', { field: 'name' });
  if (!nonEmpty(input?.leaveType)) throw badRequest('leaveType is required', { field: 'leaveType' });
  const daysPerYear = toNumber(input?.daysPerYear);
  if (daysPerYear < 0) throw badRequest('daysPerYear must be >= 0', { field: 'daysPerYear' });

  return prisma.leavePolicy.create({
    data: {
      name: input.name.trim(),
      leaveType: String(input.leaveType).trim().toLowerCase(),
      daysPerYear,
      carryOverMax: toNumber(input?.carryOverMax),
      requiresApproval: input?.requiresApproval !== false,
      noticeDays: Math.max(0, Math.floor(toNumber(input?.noticeDays))),
      isActive: input?.isActive !== false,
    },
  });
}

export async function updatePolicy(prisma, policyId, input) {
  await getPolicy(prisma, policyId);
  const data = {};
  if (input?.name !== undefined) data.name = String(input.name).trim();
  if (input?.leaveType !== undefined) data.leaveType = String(input.leaveType).trim().toLowerCase();
  if (input?.daysPerYear !== undefined) data.daysPerYear = toNumber(input.daysPerYear);
  if (input?.carryOverMax !== undefined) data.carryOverMax = toNumber(input.carryOverMax);
  if (input?.requiresApproval !== undefined) data.requiresApproval = Boolean(input.requiresApproval);
  if (input?.noticeDays !== undefined) data.noticeDays = Math.max(0, Math.floor(toNumber(input.noticeDays)));
  if (input?.isActive !== undefined) data.isActive = Boolean(input.isActive);
  return prisma.leavePolicy.update({ where: { id: policyId }, data });
}

export async function deletePolicy(prisma, policyId) {
  const policy = await getPolicy(prisma, policyId);
  const activeRequests = await prisma.leaveRequest.count({
    where: { policyId, statusCode: 'pending', isDeleted: false },
  });
  if (activeRequests > 0) {
    throw conflict('Policy has pending requests — review them before archiving', { activeRequests });
  }
  return prisma.leavePolicy.update({
    where: { id: policyId },
    data: { isDeleted: true, isActive: false, deletedAt: new Date() },
  });
}

// ============================================================
// Balances
// ============================================================

function balanceShape(balance) {
  if (!balance) return null;
  return {
    id: balance.id,
    userId: balance.userId,
    policyId: balance.policyId,
    year: balance.year,
    allocated: toNumber(balance.allocated),
    used: toNumber(balance.used),
    pending: toNumber(balance.pending),
    carryOver: toNumber(balance.carryOver),
    available: toNumber(balance.allocated)
      + toNumber(balance.carryOver)
      - toNumber(balance.used)
      - toNumber(balance.pending),
  };
}

export async function listBalances(prisma, { userId, year } = {}) {
  const where = {};
  if (userId) where.userId = userId;
  if (year) where.year = Number(year);
  const balances = await prisma.leaveBalance.findMany({
    where,
    orderBy: [{ year: 'desc' }],
    include: { policy: { select: { id: true, name: true, leaveType: true } } },
  });
  return balances.map((b) => ({ ...balanceShape(b), policy: b.policy }));
}

// Lazily create a balance for (user, policy, year) with allocated =
// policy.daysPerYear when the request arrives. Keeps initializeBalances
// optional — admins can call it explicitly to materialize rows.
async function findOrCreateBalance(tx, { userId, policyId, year }) {
  let balance = await tx.leaveBalance.findUnique({
    where: { userId_policyId_year: { userId, policyId, year } },
  });
  if (balance) return balance;
  const policy = await tx.leavePolicy.findUnique({ where: { id: policyId } });
  if (!policy) throw notFound('Policy not found');
  return tx.leaveBalance.create({
    data: {
      userId,
      policyId,
      year,
      allocated: policy.daysPerYear,
      used: 0,
      pending: 0,
      carryOver: 0,
    },
  });
}

export async function initializeBalances(prisma, { year, userId, policyId }) {
  if (!year) throw badRequest('year is required', { field: 'year' });
  const numericYear = Number(year);
  const policies = policyId
    ? [await prisma.leavePolicy.findUnique({ where: { id: policyId } })].filter(Boolean)
    : await prisma.leavePolicy.findMany({ where: { isActive: true, isDeleted: false } });
  if (policies.length === 0) {
    return { created: 0, scope: { year: numericYear, userId, policyId } };
  }
  const users = userId
    ? [await prisma.user.findUnique({ where: { id: userId } })].filter(Boolean)
    : await prisma.user.findMany({
      where: { isDeleted: false, isActive: true, hasSystemAccess: true },
      select: { id: true },
    });

  let created = 0;
  await prisma.$transaction(async (tx) => {
    for (const u of users) {
      for (const p of policies) {
        const existing = await tx.leaveBalance.findUnique({
          where: { userId_policyId_year: { userId: u.id, policyId: p.id, year: numericYear } },
        });
        if (existing) continue;
        await tx.leaveBalance.create({
          data: {
            userId: u.id,
            policyId: p.id,
            year: numericYear,
            allocated: p.daysPerYear,
          },
        });
        created += 1;
      }
    }
  });

  return { created, scope: { year: numericYear, userId, policyId } };
}

// ============================================================
// Requests
// ============================================================

function requestShape(request) {
  if (!request) return null;
  return {
    ...request,
    days: toNumber(request.days),
  };
}

export async function listRequests(prisma, {
  userId,
  statusCode,
  policyId,
  from,
  to,
  includeDeleted = false,
} = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (userId) where.userId = userId;
  if (statusCode) where.statusCode = statusCode;
  if (policyId) where.policyId = policyId;
  if (from || to) {
    where.startDate = {};
    if (from) where.startDate.gte = parseDate(from, 'from');
    if (to) where.startDate.lte = parseDate(to, 'to');
  }
  const requests = await prisma.leaveRequest.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      policy: { select: { id: true, name: true, leaveType: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });
  return requests.map(requestShape);
}

export async function getRequest(prisma, requestId) {
  const r = await prisma.leaveRequest.findFirst({
    where: { id: requestId, isDeleted: false },
    include: {
      user: { select: { id: true, name: true, email: true } },
      policy: { select: { id: true, name: true, leaveType: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!r) throw notFound('Leave request not found');
  return requestShape(r);
}

export async function createRequest(prisma, input, { actorUserId } = {}) {
  const userId = nonEmpty(input?.userId) ? input.userId.trim() : actorUserId;
  if (!userId) throw badRequest('userId is required', { field: 'userId' });
  if (!nonEmpty(input?.policyId)) throw badRequest('policyId is required', { field: 'policyId' });
  const startDate = parseDate(input?.startDate, 'startDate');
  const endDate = parseDate(input?.endDate, 'endDate');
  const days = await calculateLeaveDaysWithHolidays(prisma, startDate, endDate);
  if (days <= 0) {
    throw badRequest('The selected range contains no working day', { field: 'startDate' });
  }
  const year = yearOf(startDate);

  // Notice-days check (best-effort — based on policy.noticeDays).
  const policy = await prisma.leavePolicy.findFirst({
    where: { id: input.policyId, isDeleted: false, isActive: true },
  });
  if (!policy) throw notFound('Active policy not found for this request');
  const noticeMs = (policy.noticeDays || 0) * ONE_DAY_MS;
  if (noticeMs > 0 && startDate.getTime() - Date.now() < noticeMs) {
    throw badRequest(
      `This policy requires ${policy.noticeDays} day(s) of advance notice`,
      { field: 'startDate', noticeDays: policy.noticeDays },
    );
  }

  // Prevent overlapping pending/approved requests on the same user.
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      isDeleted: false,
      statusCode: { in: ['pending', 'approved'] },
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
      ],
    },
    select: { id: true, startDate: true, endDate: true, statusCode: true },
  });
  if (overlap) {
    throw conflict('Another leave request already covers this period', {
      conflicting: overlap,
    });
  }

  return prisma.$transaction(async (tx) => {
    const balance = await findOrCreateBalance(tx, { userId, policyId: policy.id, year });
    const available = toNumber(balance.allocated)
      + toNumber(balance.carryOver)
      - toNumber(balance.used)
      - toNumber(balance.pending);
    if (days > available) {
      throw unprocessable(
        `Insufficient leave balance — requested ${days}, available ${available}`,
        { requested: days, available, balanceId: balance.id },
      );
    }
    const created = await tx.leaveRequest.create({
      data: {
        userId,
        policyId: policy.id,
        startDate,
        endDate,
        days,
        reason: nonEmpty(input?.reason) ? input.reason.trim() : null,
        statusCode: policy.requiresApproval ? 'pending' : 'approved',
        reviewedBy: policy.requiresApproval ? null : actorUserId ?? null,
        reviewedAt: policy.requiresApproval ? null : new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        policy: { select: { id: true, name: true, leaveType: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });

    if (policy.requiresApproval) {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { increment: days } },
      });
    } else {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { used: { increment: days } },
      });
    }

    return requestShape(created);
  }).then((shaped) => {
    // HRM-2.6 — emit AFTER the tx commits so a transient broadcaster
    // failure can never roll back the request.
    safeBroadcast('hrm.leave.requested', {
      requestId: shaped.id,
      userId: shaped.userId,
      policyId: shaped.policyId,
      startDate: shaped.startDate,
      endDate: shaped.endDate,
      days: shaped.days,
      statusCode: shaped.statusCode,
    });
    return shaped;
  });
}

export async function approveRequest(prisma, requestId, { reviewerUserId, reviewNote } = {}) {
  if (!reviewerUserId) throw badRequest('reviewerUserId is required', { field: 'reviewerUserId' });
  return prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({
      where: { id: requestId, isDeleted: false },
    });
    if (!r) throw notFound('Leave request not found');
    if (r.statusCode !== 'pending') {
      throw conflict(`Cannot approve a request in status "${r.statusCode}"`, { current: r.statusCode });
    }
    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: {
        statusCode: 'approved',
        reviewedBy: reviewerUserId,
        reviewedAt: new Date(),
        reviewNote: nonEmpty(reviewNote) ? reviewNote.trim() : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        policy: { select: { id: true, name: true, leaveType: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
    const year = yearOf(new Date(r.startDate));
    const balance = await findOrCreateBalance(tx, { userId: r.userId, policyId: r.policyId, year });
    await tx.leaveBalance.update({
      where: { id: balance.id },
      data: {
        pending: { decrement: toNumber(r.days) },
        used: { increment: toNumber(r.days) },
      },
    });
    return requestShape(updated);
  }).then((shaped) => {
    safeBroadcast('hrm.leave.approved', {
      requestId: shaped.id,
      userId: shaped.userId,
      reviewerUserId,
      startDate: shaped.startDate,
      endDate: shaped.endDate,
      days: shaped.days,
    });
    return shaped;
  });
}

export async function rejectRequest(prisma, requestId, { reviewerUserId, reviewNote } = {}) {
  if (!reviewerUserId) throw badRequest('reviewerUserId is required', { field: 'reviewerUserId' });
  return prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({
      where: { id: requestId, isDeleted: false },
    });
    if (!r) throw notFound('Leave request not found');
    if (r.statusCode !== 'pending') {
      throw conflict(`Cannot reject a request in status "${r.statusCode}"`, { current: r.statusCode });
    }
    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: {
        statusCode: 'rejected',
        reviewedBy: reviewerUserId,
        reviewedAt: new Date(),
        reviewNote: nonEmpty(reviewNote) ? reviewNote.trim() : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        policy: { select: { id: true, name: true, leaveType: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
    const year = yearOf(new Date(r.startDate));
    const balance = await findOrCreateBalance(tx, { userId: r.userId, policyId: r.policyId, year });
    await tx.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: { decrement: toNumber(r.days) } },
    });
    return requestShape(updated);
  }).then((shaped) => {
    safeBroadcast('hrm.leave.rejected', {
      requestId: shaped.id,
      userId: shaped.userId,
      reviewerUserId,
      reviewNote: nonEmpty(reviewNote) ? reviewNote.trim() : null,
    });
    return shaped;
  });
}

export async function cancelRequest(prisma, requestId, { actorUserId, hasExecutePermission = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({
      where: { id: requestId, isDeleted: false },
    });
    if (!r) throw notFound('Leave request not found');
    if (r.statusCode === 'cancelled' || r.statusCode === 'rejected') {
      throw conflict(`Request is already ${r.statusCode}`, { current: r.statusCode });
    }
    const isOwner = actorUserId && actorUserId === r.userId;
    if (!isOwner && !hasExecutePermission) {
      throw forbidden('Only the owner or a manager can cancel this request');
    }
    if (r.statusCode === 'approved') {
      const startInFuture = new Date(r.startDate).getTime() > Date.now();
      if (!startInFuture && !hasExecutePermission) {
        throw conflict('An approved request can only be cancelled before its start date', {
          current: r.statusCode,
          startDate: r.startDate,
        });
      }
    }

    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: {
        statusCode: 'cancelled',
        reviewedBy: actorUserId ?? null,
        reviewedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        policy: { select: { id: true, name: true, leaveType: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });

    const year = yearOf(new Date(r.startDate));
    const balance = await findOrCreateBalance(tx, { userId: r.userId, policyId: r.policyId, year });
    if (r.statusCode === 'pending') {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { decrement: toNumber(r.days) } },
      });
    } else if (r.statusCode === 'approved') {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { used: { decrement: toNumber(r.days) } },
      });
    }
    return requestShape(updated);
  });
}
