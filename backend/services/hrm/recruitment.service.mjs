import { safeBroadcast } from '../realtime/sseBroadcaster.mjs';

// HRM-2.1 — Recruitment pipeline (job postings + candidate pipeline).
//
// Hire flow delegates to the HRM-1.0 ported service
// (recruitmentOnboarding.service.mjs) which already creates the User,
// HrmEmploymentProfile, UserRole, AccessProvisioning, audit logs and
// queues the welcome email — all in one prisma.$transaction. That keeps
// the data path single-sourced.
//
// All writes either run in a transaction owned by Prisma directly
// (single-table updates) or delegate to a service that opens one
// (hire flow).
//
// Lifecycle on RecruitmentCandidate.statusCode:
//   sourced -> screening -> interview -> offer -> hired -> onboarding
//          \-> rejected
// Adjacency isn't strictly enforced (manual UI overrides are real life)
// but transitions to 'hired' / 'onboarding' must go through hireCandidate.

import { transitionCandidateToOnboarding } from './recruitmentOnboarding.service.mjs';

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

function nonEmpty(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function toDecimalOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const STAGE_LIFECYCLE = ['sourced', 'screening', 'interview', 'offer', 'hired', 'onboarding', 'rejected'];

// ============================================================
// Job postings
// ============================================================

export async function listJobPostings(prisma, { statusCode, departmentId, includeDeleted = false } = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (statusCode) where.statusCode = statusCode;
  if (departmentId) where.departmentId = departmentId;
  return prisma.jobPosting.findMany({
    where,
    orderBy: [{ statusCode: 'asc' }, { createdAt: 'desc' }],
    include: {
      department: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { candidates: true } },
    },
  });
}

export async function getJobPosting(prisma, id) {
  const posting = await prisma.jobPosting.findFirst({
    where: { id, isDeleted: false },
    include: {
      department: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      candidates: {
        where: { isDeleted: false },
        select: { id: true, fullName: true, personalEmail: true, statusCode: true },
      },
    },
  });
  if (!posting) throw notFound('Job posting not found');
  return posting;
}

export async function createJobPosting(prisma, input, { actorUserId }) {
  if (!nonEmpty(input?.title)) throw badRequest('title is required', { field: 'title' });
  if (!nonEmpty(input?.departmentId)) throw badRequest('departmentId is required', { field: 'departmentId' });
  if (!nonEmpty(input?.description)) throw badRequest('description is required', { field: 'description' });
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });

  const status = nonEmpty(input?.statusCode) ? input.statusCode.trim().toLowerCase() : 'draft';
  if (!['draft', 'open', 'closed', 'filled'].includes(status)) {
    throw badRequest('statusCode must be draft|open|closed|filled', { field: 'statusCode' });
  }

  return prisma.jobPosting.create({
    data: {
      title: input.title.trim(),
      departmentId: input.departmentId,
      description: input.description.trim(),
      requirements: nonEmpty(input?.requirements) ? input.requirements.trim() : null,
      statusCode: status,
      closingDate: input?.closingDate ? new Date(input.closingDate) : null,
      createdByUserId: actorUserId,
    },
    include: {
      department: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateJobPosting(prisma, id, input) {
  const posting = await prisma.jobPosting.findFirst({ where: { id, isDeleted: false } });
  if (!posting) throw notFound('Job posting not found');

  const data = {};
  if (input?.title !== undefined) data.title = String(input.title).trim();
  if (input?.description !== undefined) data.description = String(input.description).trim();
  if (input?.requirements !== undefined) {
    data.requirements = input.requirements === null ? null : String(input.requirements).trim() || null;
  }
  if (input?.departmentId !== undefined) data.departmentId = String(input.departmentId);
  if (input?.statusCode !== undefined) {
    const s = String(input.statusCode).trim().toLowerCase();
    if (!['draft', 'open', 'closed', 'filled'].includes(s)) {
      throw badRequest('statusCode must be draft|open|closed|filled', { field: 'statusCode' });
    }
    data.statusCode = s;
  }
  if (input?.closingDate !== undefined) {
    data.closingDate = input.closingDate ? new Date(input.closingDate) : null;
  }

  return prisma.jobPosting.update({
    where: { id },
    data,
    include: {
      department: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function deleteJobPosting(prisma, id) {
  const posting = await prisma.jobPosting.findFirst({ where: { id, isDeleted: false } });
  if (!posting) throw notFound('Job posting not found');
  const activeCandidates = await prisma.recruitmentCandidate.count({
    where: { jobPostingId: id, isDeleted: false, statusCode: { notIn: ['hired', 'onboarding', 'rejected'] } },
  });
  if (activeCandidates > 0) {
    throw conflict('Posting has active candidates — close it instead', { activeCandidates });
  }
  await prisma.jobPosting.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date(), statusCode: 'closed' },
  });
  return { id, deleted: true };
}

// ============================================================
// Candidates
// ============================================================

function candidateInclude() {
  return {
    recruitmentDepartment: { select: { id: true, code: true, name: true } },
    jobPosting: { select: { id: true, title: true, statusCode: true } },
    hiredUser: { select: { id: true, name: true, email: true } },
  };
}

export async function listCandidates(prisma, { statusCode, jobPostingId, departmentId, includeDeleted = false } = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (statusCode) where.statusCode = statusCode;
  if (jobPostingId) where.jobPostingId = jobPostingId;
  if (departmentId) where.recruitmentDepartmentId = departmentId;
  return prisma.recruitmentCandidate.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: candidateInclude(),
  });
}

export async function getCandidate(prisma, id) {
  const candidate = await prisma.recruitmentCandidate.findFirst({
    where: { id, isDeleted: false },
    include: candidateInclude(),
  });
  if (!candidate) throw notFound('Candidate not found');
  return candidate;
}

export async function createCandidate(prisma, input) {
  if (!nonEmpty(input?.fullName)) throw badRequest('fullName is required', { field: 'fullName' });
  if (!nonEmpty(input?.personalEmail)) throw badRequest('personalEmail is required', { field: 'personalEmail' });
  if (!nonEmpty(input?.position)) throw badRequest('position is required', { field: 'position' });
  if (!nonEmpty(input?.recruitmentDepartmentId)) {
    throw badRequest('recruitmentDepartmentId is required', { field: 'recruitmentDepartmentId' });
  }

  const status = nonEmpty(input?.statusCode) ? input.statusCode.trim().toLowerCase() : 'sourced';
  if (!STAGE_LIFECYCLE.includes(status)) {
    throw badRequest(`statusCode must be one of ${STAGE_LIFECYCLE.join('|')}`, { field: 'statusCode' });
  }

  // Per-email uniqueness inside the same active pipeline (soft check —
  // duplicates are usually a typo; this surfaces them as a 409).
  const existing = await prisma.recruitmentCandidate.findFirst({
    where: {
      isDeleted: false,
      personalEmail: input.personalEmail.trim().toLowerCase(),
      statusCode: { notIn: ['hired', 'onboarding', 'rejected'] },
    },
    select: { id: true, statusCode: true },
  });
  if (existing) {
    throw conflict('A candidate with this email is already in the active pipeline', { conflicting: existing });
  }

  return prisma.recruitmentCandidate.create({
    data: {
      fullName: input.fullName.trim(),
      personalEmail: input.personalEmail.trim().toLowerCase(),
      phone: nonEmpty(input?.phone) ? input.phone.trim() : null,
      position: input.position.trim(),
      statusCode: status,
      recruitmentDepartmentId: input.recruitmentDepartmentId,
      jobPostingId: nonEmpty(input?.jobPostingId) ? input.jobPostingId : null,
    },
    include: candidateInclude(),
  });
}

export async function updateCandidateStage(prisma, id, input) {
  const candidate = await prisma.recruitmentCandidate.findFirst({
    where: { id, isDeleted: false },
  });
  if (!candidate) throw notFound('Candidate not found');

  const targetStage = nonEmpty(input?.statusCode) ? input.statusCode.trim().toLowerCase() : null;
  if (!targetStage) throw badRequest('statusCode is required', { field: 'statusCode' });
  if (!STAGE_LIFECYCLE.includes(targetStage)) {
    throw badRequest(`statusCode must be one of ${STAGE_LIFECYCLE.join('|')}`, { field: 'statusCode' });
  }
  if (targetStage === 'hired' || targetStage === 'onboarding') {
    throw conflict('Use hireCandidate to transition into hired/onboarding', { current: candidate.statusCode });
  }
  if (targetStage === 'rejected') {
    throw conflict('Use rejectCandidate to set rejected (carries rejectionReason)', { current: candidate.statusCode });
  }

  const data = { statusCode: targetStage };
  if (targetStage === 'interview' && !candidate.interviewDate) data.interviewDate = new Date();
  if (targetStage === 'offer' && !candidate.offerDate) data.offerDate = new Date();

  // Optional fields:
  if (input?.interviewDate !== undefined) {
    data.interviewDate = input.interviewDate ? new Date(input.interviewDate) : null;
  }
  if (input?.offerDate !== undefined) {
    data.offerDate = input.offerDate ? new Date(input.offerDate) : null;
  }
  if (input?.offerAmount !== undefined) data.offerAmount = toDecimalOrNull(input.offerAmount);
  if (input?.offerCurrency !== undefined) {
    data.offerCurrency = nonEmpty(input.offerCurrency) ? input.offerCurrency.trim().toUpperCase() : null;
  }

  return prisma.recruitmentCandidate.update({
    where: { id },
    data,
    include: candidateInclude(),
  });
}

export async function rejectCandidate(prisma, id, { reason }) {
  const candidate = await prisma.recruitmentCandidate.findFirst({
    where: { id, isDeleted: false },
  });
  if (!candidate) throw notFound('Candidate not found');
  if (candidate.statusCode === 'hired' || candidate.statusCode === 'onboarding') {
    throw conflict('Cannot reject a candidate already hired', { current: candidate.statusCode });
  }
  return prisma.recruitmentCandidate.update({
    where: { id },
    data: {
      statusCode: 'rejected',
      rejectionReason: nonEmpty(reason) ? reason.trim() : null,
    },
    include: candidateInclude(),
  });
}

// Hire = atomic provisioning. Delegates to the existing HRM-1.0 service,
// which opens its own prisma.$transaction and rolls back if anything
// (User create / HrmEmploymentProfile create / UserRole link / AccessProvisioning /
//  audit logs / DomainEvent) fails. Idempotency: the service refuses
// when candidate.statusCode is not in ['offer','hired','onboarding'],
// so calling hire twice on an already-hired candidate is rejected as
// a domain error rather than producing a duplicate provisioning.
export async function hireCandidate(prisma, candidateId, input, { actorUserId }) {
  if (!nonEmpty(actorUserId)) throw badRequest('actorUserId is required', { field: 'actorUserId' });

  const candidate = await prisma.recruitmentCandidate.findFirst({
    where: { id: candidateId, isDeleted: false },
    select: { id: true, statusCode: true, personalEmail: true, fullName: true, hiredUserId: true },
  });
  if (!candidate) throw notFound('Candidate not found');
  if (candidate.hiredUserId) {
    throw conflict('Candidate is already hired', { hiredUserId: candidate.hiredUserId });
  }

  const professionalEmail = nonEmpty(input?.professionalEmail)
    ? input.professionalEmail.trim().toLowerCase()
    : candidate.personalEmail.trim().toLowerCase();
  const companyName = nonEmpty(input?.companyName) ? input.companyName : process.env.NEOX_COMPANY_NAME || 'Neox';
  const appUrl = nonEmpty(input?.appUrl) ? input.appUrl : process.env.NEOX_APP_URL || 'http://localhost:5173';

  try {
    const result = await transitionCandidateToOnboarding(
      {
        candidateId,
        actorUserId,
        professionalEmail,
        companyName,
        appUrl,
        // HRM-2.2 hook — explicit template id from CandidateHiredModal
        // wins over the dept lookup inside transitionCandidateToOnboarding.
        onboardingTemplateId: input?.onboardingTemplateId ?? input?.templateId ?? null,
        startDate: input?.startDate,
      },
      'onboarding',
    );
    const out = await getCandidate(prisma, candidateId).then((c) => ({
      candidate: c,
      provisioning: {
        userId: result.userId,
        username: result.username,
        temporaryPassword: result.temporaryPassword,
      },
      onboardingChecklistId: result.onboardingChecklistId ?? null,
    }));
    // HRM-2.6 — emit after the hire tx commits.
    safeBroadcast('hrm.employee.hired', {
      candidateId,
      userId: result.userId,
      hiredByUserId: actorUserId,
      onboardingChecklistId: result.onboardingChecklistId ?? null,
    });
    return out;
  } catch (err) {
    // The underlying service throws plain Error; map well-known ones to HTTP.
    const msg = String(err?.message || '');
    if (msg.includes('Cannot provision access from status')) {
      throw conflict(msg, { current: candidate.statusCode });
    }
    if (msg.includes('No default onboarding role')) {
      throw new HttpError(500, 'ROLE_MISSING', msg);
    }
    if (msg.includes('Candidate not found')) {
      throw notFound(msg);
    }
    throw err;
  }
}
