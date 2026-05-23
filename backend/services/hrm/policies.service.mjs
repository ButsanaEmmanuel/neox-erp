// HRM-2.4 — HR policies catalogue + per-employee acknowledgements.
//
// Lifecycle rules:
//   - A policy moves draft → published → archived. Each transition
//     stamps the relevant timestamp (publishedAt / archivedAt).
//     Re-publishing an archived policy is forbidden (create a new
//     version instead) — refusing this keeps the audit trail honest.
//   - An employee can acknowledge a policy at most once. A repeat
//     POST returns 409 ALREADY_ACKNOWLEDGED with the existing
//     acknowledgementId + signedAt.
//   - listPolicies({ forUserId }) joins PolicyAcknowledgement so the
//     UI can render the "Lu / À signer" badge in one round trip
//     without a second N+1 fetch.

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

function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }

const POLICY_STATUS = ['draft', 'published', 'archived'];
const POLICY_CATEGORY = ['conduct', 'safety', 'leave', 'it', 'other'];

// ============================================================
// Policies
// ============================================================

// `forUserId` opts the response into ack-aware mode: each row gets
// `isAcknowledgedByMe` + `myAcknowledgementId`. Without it (admin
// view), we return raw rows with aggregate _count.
export async function listPolicies(prisma, { statusCode, category, forUserId, includeDeleted = false } = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (statusCode) where.statusCode = statusCode;
  if (category)   where.category   = category;

  const rows = await prisma.hrmPolicy.findMany({
    where,
    orderBy: [{ statusCode: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count:    { select: { acknowledgements: true } },
      ...(forUserId
        ? { acknowledgements: { where: { userId: forUserId }, select: { id: true, signedAt: true } } }
        : {}),
    },
  });

  if (!forUserId) return rows;

  return rows.map((p) => {
    const myAck = (p.acknowledgements ?? [])[0];
    const { acknowledgements: _drop, ...rest } = p;
    void _drop;
    return {
      ...rest,
      isAcknowledgedByMe: Boolean(myAck),
      myAcknowledgementId: myAck?.id ?? null,
      myAcknowledgedAt: myAck?.signedAt ?? null,
    };
  });
}

export async function getPolicy(prisma, id, { forUserId } = {}) {
  const policy = await prisma.hrmPolicy.findFirst({
    where: { id, isDeleted: false },
    include: {
      createdBy:    { select: { id: true, name: true, email: true } },
      _count:       { select: { acknowledgements: true } },
      ...(forUserId
        ? { acknowledgements: { where: { userId: forUserId }, select: { id: true, signedAt: true } } }
        : { acknowledgements: { orderBy: { signedAt: 'desc' }, take: 50, include: { user: { select: { id: true, name: true, email: true } } } } }),
    },
  });
  if (!policy) throw notFound('Policy not found');
  if (forUserId) {
    const myAck = (policy.acknowledgements ?? [])[0];
    const { acknowledgements: _drop, ...rest } = policy;
    void _drop;
    return {
      ...rest,
      isAcknowledgedByMe: Boolean(myAck),
      myAcknowledgementId: myAck?.id ?? null,
      myAcknowledgedAt: myAck?.signedAt ?? null,
    };
  }
  return policy;
}

export async function createPolicy(prisma, input, { actorUserId }) {
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });
  if (!nonEmpty(input?.title))   throw badRequest('title is required',   { field: 'title' });
  if (!nonEmpty(input?.content)) throw badRequest('content is required', { field: 'content' });
  const category = nonEmpty(input?.category) ? input.category.trim().toLowerCase() : 'other';
  if (!POLICY_CATEGORY.includes(category)) {
    throw badRequest(`category must be one of ${POLICY_CATEGORY.join('|')}`, { field: 'category' });
  }
  return prisma.hrmPolicy.create({
    data: {
      title:           input.title.trim(),
      category,
      content:         input.content,
      version:         nonEmpty(input?.version) ? input.version.trim() : '1.0',
      statusCode:      'draft',
      createdByUserId: actorUserId,
    },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function updatePolicy(prisma, id, input) {
  const policy = await prisma.hrmPolicy.findFirst({ where: { id, isDeleted: false } });
  if (!policy) throw notFound('Policy not found');
  if (policy.statusCode === 'archived') {
    throw conflict('Cannot edit an archived policy — create a new version instead', { code: 'POLICY_ARCHIVED' });
  }
  const data = {};
  if (input?.title   !== undefined) data.title   = String(input.title).trim();
  if (input?.content !== undefined) data.content = String(input.content);
  if (input?.version !== undefined) data.version = String(input.version).trim();
  if (input?.category !== undefined) {
    const cat = String(input.category).trim().toLowerCase();
    if (!POLICY_CATEGORY.includes(cat)) {
      throw badRequest(`category must be one of ${POLICY_CATEGORY.join('|')}`, { field: 'category' });
    }
    data.category = cat;
  }
  return prisma.hrmPolicy.update({
    where: { id },
    data,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function publishPolicy(prisma, id) {
  const policy = await prisma.hrmPolicy.findFirst({ where: { id, isDeleted: false } });
  if (!policy) throw notFound('Policy not found');
  if (policy.statusCode === 'published') {
    return policy;  // idempotent — re-publishing a published policy is a no-op
  }
  if (policy.statusCode === 'archived') {
    throw conflict('Cannot republish an archived policy — clone it as a new version', { code: 'POLICY_ARCHIVED' });
  }
  return prisma.hrmPolicy.update({
    where: { id },
    data: { statusCode: 'published', publishedAt: new Date() },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function archivePolicy(prisma, id) {
  const policy = await prisma.hrmPolicy.findFirst({ where: { id, isDeleted: false } });
  if (!policy) throw notFound('Policy not found');
  if (policy.statusCode === 'archived') return policy;
  return prisma.hrmPolicy.update({
    where: { id },
    data: { statusCode: 'archived', archivedAt: new Date() },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function deletePolicy(prisma, id) {
  const policy = await prisma.hrmPolicy.findFirst({ where: { id, isDeleted: false } });
  if (!policy) throw notFound('Policy not found');
  await prisma.hrmPolicy.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  return { id, deleted: true };
}

// ============================================================
// Acknowledgements
// ============================================================

export async function acknowledgePolicy(prisma, policyId, { actorUserId, note }) {
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });
  const policy = await prisma.hrmPolicy.findFirst({ where: { id: policyId, isDeleted: false } });
  if (!policy) throw notFound('Policy not found');
  if (policy.statusCode !== 'published') {
    throw conflict('Only published policies can be acknowledged', { code: 'POLICY_NOT_PUBLISHED', currentStatus: policy.statusCode });
  }

  const existing = await prisma.policyAcknowledgement.findUnique({
    where: { policyId_userId: { policyId, userId: actorUserId } },
  });
  if (existing) {
    throw conflict('Policy already acknowledged by this user', {
      code: 'ALREADY_ACKNOWLEDGED',
      acknowledgementId: existing.id,
      signedAt: existing.signedAt,
    });
  }

  return prisma.policyAcknowledgement.create({
    data: {
      policyId,
      userId: actorUserId,
      note: nonEmpty(note) ? note.trim() : null,
    },
  });
}

export async function listAcknowledgements(prisma, { policyId, userId } = {}) {
  const where = {};
  if (policyId) where.policyId = policyId;
  if (userId)   where.userId   = userId;
  return prisma.policyAcknowledgement.findMany({
    where,
    orderBy: [{ signedAt: 'desc' }],
    include: {
      user:   { select: { id: true, name: true, email: true } },
      policy: { select: { id: true, title: true, version: true, category: true } },
    },
  });
}

// Bookkeeping export for the tests + plan.
export const POLICY_STATUSES = POLICY_STATUS;
