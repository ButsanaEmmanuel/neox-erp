// HRM-2.3 — Training catalogue + per-employee enrollments.
//
// Lifecycle rules:
//   - A user cannot be enrolled twice in the same active course.
//     Re-enrollment is allowed only if the previous enrollment was
//     cancelled (we update it back to "enrolled" instead of creating
//     a duplicate row, so the @@unique([userId, courseId]) holds).
//   - Completing an enrollment writes completedAt + score + certificate.
//     A user is "certified" for a course iff there is a non-deleted
//     enrollment with statusCode = "completed".
//
// All conflict cases throw HttpError(409, CONFLICT, ...) with a
// structured payload so the UI can show a meaningful message.

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

const ENROLLMENT_STATUS = ['enrolled', 'in_progress', 'completed', 'cancelled'];

// ============================================================
// Courses
// ============================================================

export async function listCourses(prisma, { includeInactive = false, includeDeleted = false } = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (!includeInactive) where.isActive = true;
  return prisma.trainingCourse.findMany({
    where,
    orderBy: [{ isMandatory: 'desc' }, { title: 'asc' }],
    include: { _count: { select: { enrollments: { where: { isDeleted: false } } } } },
  });
}

export async function getCourse(prisma, id) {
  const course = await prisma.trainingCourse.findFirst({
    where: { id, isDeleted: false },
    include: { _count: { select: { enrollments: { where: { isDeleted: false } } } } },
  });
  if (!course) throw notFound('Training course not found');
  return course;
}

export async function createCourse(prisma, input) {
  if (!nonEmpty(input?.title)) throw badRequest('title is required', { field: 'title' });
  const durationHours = input?.durationHours == null ? null
    : Math.max(0, Math.floor(Number(input.durationHours)));
  if (durationHours !== null && !Number.isFinite(durationHours)) {
    throw badRequest('durationHours must be a number', { field: 'durationHours' });
  }
  return prisma.trainingCourse.create({
    data: {
      title:        input.title.trim(),
      description:  nonEmpty(input?.description) ? input.description.trim() : null,
      provider:     nonEmpty(input?.provider)    ? input.provider.trim()    : null,
      category:     nonEmpty(input?.category)    ? input.category.trim()    : null,
      durationHours,
      isInternal:   input?.isInternal !== false,
      isMandatory:  Boolean(input?.isMandatory),
      isActive:     input?.isActive !== false,
    },
  });
}

export async function updateCourse(prisma, id, input) {
  const course = await prisma.trainingCourse.findFirst({ where: { id, isDeleted: false } });
  if (!course) throw notFound('Training course not found');
  const data = {};
  if (input?.title !== undefined) {
    if (!nonEmpty(input.title)) throw badRequest('title cannot be empty', { field: 'title' });
    data.title = input.title.trim();
  }
  if (input?.description !== undefined) data.description = nonEmpty(input.description) ? input.description.trim() : null;
  if (input?.provider !== undefined)    data.provider    = nonEmpty(input.provider)    ? input.provider.trim()    : null;
  if (input?.category !== undefined)    data.category    = nonEmpty(input.category)    ? input.category.trim()    : null;
  if (input?.durationHours !== undefined) {
    data.durationHours = input.durationHours == null ? null : Math.max(0, Math.floor(Number(input.durationHours)));
  }
  if (input?.isInternal  !== undefined) data.isInternal  = Boolean(input.isInternal);
  if (input?.isMandatory !== undefined) data.isMandatory = Boolean(input.isMandatory);
  if (input?.isActive    !== undefined) data.isActive    = Boolean(input.isActive);
  return prisma.trainingCourse.update({ where: { id }, data });
}

// Soft delete. Refuses to delete a course that still has live
// (non-cancelled, non-completed) enrollments — finish or cancel
// those first.
export async function deleteCourse(prisma, id) {
  const course = await prisma.trainingCourse.findFirst({ where: { id, isDeleted: false } });
  if (!course) throw notFound('Training course not found');
  const liveEnrollments = await prisma.trainingEnrollment.count({
    where: {
      courseId: id,
      isDeleted: false,
      statusCode: { in: ['enrolled', 'in_progress'] },
    },
  });
  if (liveEnrollments > 0) {
    throw conflict('Course still has active enrollments — cancel or complete them first', {
      activeEnrollments: liveEnrollments,
    });
  }
  await prisma.trainingCourse.update({
    where: { id },
    data: { isDeleted: true, isActive: false, deletedAt: new Date() },
  });
  return { id, deleted: true };
}

// ============================================================
// Enrollments
// ============================================================

export async function listEnrollments(prisma, { userId, courseId, statusCode, includeDeleted = false } = {}) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (userId)     where.userId = userId;
  if (courseId)   where.courseId = courseId;
  if (statusCode) where.statusCode = statusCode;
  return prisma.trainingEnrollment.findMany({
    where,
    orderBy: [{ enrolledAt: 'desc' }],
    include: {
      user:   { select: { id: true, name: true, email: true, departmentId: true } },
      course: { select: { id: true, title: true, category: true, isMandatory: true } },
    },
  });
}

export async function getEnrollment(prisma, id) {
  const enr = await prisma.trainingEnrollment.findFirst({
    where: { id, isDeleted: false },
    include: {
      user:   { select: { id: true, name: true, email: true } },
      course: true,
    },
  });
  if (!enr) throw notFound('Training enrollment not found');
  return enr;
}

// Enroll a user in a course.
// Conflict rules (the @@unique([userId, courseId]) backs all of them):
//   - existing enrollment in {enrolled, in_progress, completed}
//     → 409 ALREADY_ENROLLED with current statusCode.
//   - existing CANCELLED enrollment
//     → revive it: status → "enrolled", clear cancelledAt, refresh
//       enrolledAt + dueDate. We do NOT clear completedAt / certificate
//       because the row should never have had them in a cancelled state.
export async function enrollUser(prisma, { userId, courseId, dueDate, notes }) {
  if (!nonEmpty(userId))   throw badRequest('userId is required',   { field: 'userId' });
  if (!nonEmpty(courseId)) throw badRequest('courseId is required', { field: 'courseId' });

  const course = await prisma.trainingCourse.findFirst({ where: { id: courseId, isDeleted: false } });
  if (!course) throw notFound('Training course not found');
  if (!course.isActive) throw conflict('Course is inactive', { code: 'COURSE_INACTIVE' });

  const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false } });
  if (!user) throw notFound('User not found');

  const existing = await prisma.trainingEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  if (existing && !existing.isDeleted) {
    if (existing.statusCode === 'cancelled') {
      return prisma.trainingEnrollment.update({
        where: { id: existing.id },
        data: {
          statusCode:  'enrolled',
          enrolledAt:  new Date(),
          cancelledAt: null,
          dueDate:     dueDate ? new Date(dueDate) : null,
          notes:       nonEmpty(notes) ? notes.trim() : existing.notes,
        },
      });
    }
    throw conflict('User is already enrolled in this course', {
      code:        'ALREADY_ENROLLED',
      enrollmentId: existing.id,
      currentStatus: existing.statusCode,
    });
  }

  if (existing && existing.isDeleted) {
    // Resurrect a soft-deleted row rather than failing on the unique.
    return prisma.trainingEnrollment.update({
      where: { id: existing.id },
      data: {
        statusCode:  'enrolled',
        enrolledAt:  new Date(),
        cancelledAt: null,
        completedAt: null,
        score:       null,
        certificate: null,
        dueDate:     dueDate ? new Date(dueDate) : null,
        notes:       nonEmpty(notes) ? notes.trim() : null,
        isDeleted:   false,
        deletedAt:   null,
      },
    });
  }

  return prisma.trainingEnrollment.create({
    data: {
      userId,
      courseId,
      statusCode: 'enrolled',
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: nonEmpty(notes) ? notes.trim() : null,
    },
  });
}

export async function updateEnrollmentStatus(prisma, id, { statusCode, completedByUserId }) {
  if (!ENROLLMENT_STATUS.includes(statusCode)) {
    throw badRequest(`statusCode must be one of ${ENROLLMENT_STATUS.join('|')}`, { field: 'statusCode' });
  }
  void completedByUserId;
  const enr = await prisma.trainingEnrollment.findFirst({ where: { id, isDeleted: false } });
  if (!enr) throw notFound('Training enrollment not found');
  const data = { statusCode };
  if (statusCode === 'completed' && !enr.completedAt) data.completedAt = new Date();
  if (statusCode !== 'completed') data.completedAt = null;
  if (statusCode === 'cancelled' && !enr.cancelledAt) data.cancelledAt = new Date();
  if (statusCode !== 'cancelled') data.cancelledAt = null;
  return prisma.trainingEnrollment.update({ where: { id }, data });
}

// Complete an enrollment with a score + certificate URL/ID. The
// certificate is whatever string the caller passes (URL, blob ref,
// hash, ...) — the model doesn't care, the UI does.
export async function completeEnrollment(prisma, id, { score, certificate, notes } = {}) {
  const enr = await prisma.trainingEnrollment.findFirst({ where: { id, isDeleted: false } });
  if (!enr) throw notFound('Training enrollment not found');
  if (enr.statusCode === 'cancelled') {
    throw conflict('Cannot complete a cancelled enrollment — re-enroll first', { code: 'ENROLLMENT_CANCELLED' });
  }
  let scoreValue = null;
  if (score !== undefined && score !== null && score !== '') {
    const n = Number(score);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw badRequest('score must be between 0 and 100', { field: 'score' });
    }
    scoreValue = n;
  }
  return prisma.trainingEnrollment.update({
    where: { id },
    data: {
      statusCode:  'completed',
      completedAt: new Date(),
      score:       scoreValue,
      certificate: nonEmpty(certificate) ? certificate.trim() : enr.certificate,
      notes:       nonEmpty(notes) ? notes.trim() : enr.notes,
    },
  });
}

export async function cancelEnrollment(prisma, id, { notes } = {}) {
  const enr = await prisma.trainingEnrollment.findFirst({ where: { id, isDeleted: false } });
  if (!enr) throw notFound('Training enrollment not found');
  if (enr.statusCode === 'completed') {
    throw conflict('Cannot cancel a completed enrollment', { code: 'ALREADY_COMPLETED' });
  }
  return prisma.trainingEnrollment.update({
    where: { id },
    data: {
      statusCode:  'cancelled',
      cancelledAt: new Date(),
      notes:       nonEmpty(notes) ? notes.trim() : enr.notes,
    },
  });
}

// Used by the employee profile to show the "Certifié" badge.
export async function getUserCertifications(prisma, userId) {
  return prisma.trainingEnrollment.findMany({
    where: { userId, isDeleted: false, statusCode: 'completed' },
    orderBy: [{ completedAt: 'desc' }],
    include: { course: { select: { id: true, title: true, category: true, isMandatory: true } } },
  });
}
