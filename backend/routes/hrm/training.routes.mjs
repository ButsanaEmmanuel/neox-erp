// HRM-2.3 — /api/v1/hrm/training/* dispatcher.
// Every route gates with assertPermission(...) — HRM-2 rule.
//
// Permission scheme:
//   - hrm.training.read    GET   courses, enrollments, certifications
//   - hrm.training.write   POST/PUT/DELETE courses
//   - hrm.training.execute POST  enrollments + lifecycle transitions
//                          (enroll, complete, cancel)
//
// The "execute" split mirrors recruitment/onboarding: any HR can read
// the catalogue, only operators can move employees through the
// pipeline.

import {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  listEnrollments,
  getEnrollment,
  enrollUser,
  completeEnrollment,
  cancelEnrollment,
  getUserCertifications,
} from '../../services/hrm/training.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const COURSES_COLL       = /^\/api\/v1\/hrm\/training\/courses$/;
const COURSE_ITEM        = /^\/api\/v1\/hrm\/training\/courses\/([^/]+)$/;
const ENROLLMENTS_COLL   = /^\/api\/v1\/hrm\/training\/enrollments$/;
const ENROLLMENT_ITEM    = /^\/api\/v1\/hrm\/training\/enrollments\/([^/]+)$/;
const ENROLLMENT_DONE    = /^\/api\/v1\/hrm\/training\/enrollments\/([^/]+)\/complete$/;
const ENROLLMENT_CANCEL  = /^\/api\/v1\/hrm\/training\/enrollments\/([^/]+)\/cancel$/;
const CERTIFICATIONS     = /^\/api\/v1\/hrm\/training\/certifications\/([^/]+)$/;

function hasMatch(p) {
  return COURSES_COLL.test(p) || COURSE_ITEM.test(p)
    || ENROLLMENT_DONE.test(p) || ENROLLMENT_CANCEL.test(p)
    || ENROLLMENT_ITEM.test(p) || ENROLLMENTS_COLL.test(p)
    || CERTIFICATIONS.test(p);
}

// Strict actor lookup — does NOT fall back to body.userId because on
// enrollment POSTs body.userId is the *target* employee, not the
// caller. Use actorUserId in the query string or body to identify
// the caller.
function actorFromCtx(ctx, body) {
  return (
    String(ctx.url.searchParams.get('actorUserId') || '').trim()
    || String(body?.actorUserId || '').trim()
    || null
  );
}

export async function handleHrmTrainingRoutes(ctx) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  if (!hasMatch(pathname)) return false;

  const queryUserId = String(url.searchParams.get('userId') || url.searchParams.get('actorUserId') || '').trim() || null;

  try {
    // --- Certifications (user profile badge) ---
    const certMatch = pathname.match(CERTIFICATIONS);
    if (certMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.training.read'))) return true;
      const certifications = await getUserCertifications(prisma, certMatch[1]);
      json(res, 200, { certifications });
      return true;
    }

    // --- Courses ---
    if (COURSES_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.training.read'))) return true;
      const courses = await listCourses(prisma, {
        includeInactive: url.searchParams.get('includeInactive') === 'true',
      });
      json(res, 200, { courses });
      return true;
    }
    if (COURSES_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.training.write'))) return true;
      const course = await createCourse(prisma, body);
      json(res, 201, { course });
      return true;
    }

    const courseItemMatch = pathname.match(COURSE_ITEM);
    if (courseItemMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.training.read'))) return true;
      const course = await getCourse(prisma, courseItemMatch[1]);
      json(res, 200, { course });
      return true;
    }
    if (courseItemMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.training.write'))) return true;
      const course = await updateCourse(prisma, courseItemMatch[1], body);
      json(res, 200, { course });
      return true;
    }
    if (courseItemMatch && method === 'DELETE') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.training.write'))) return true;
      const result = await deleteCourse(prisma, courseItemMatch[1]);
      json(res, 200, result);
      return true;
    }

    // --- Enrollment sub-routes (complete / cancel) BEFORE the generic /:id ---
    const doneMatch = pathname.match(ENROLLMENT_DONE);
    if (doneMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.training.execute'))) return true;
      const enrollment = await completeEnrollment(prisma, doneMatch[1], {
        score:       body?.score,
        certificate: body?.certificate,
        notes:       body?.notes,
      });
      json(res, 200, { enrollment });
      return true;
    }
    const cancelMatch = pathname.match(ENROLLMENT_CANCEL);
    if (cancelMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.training.execute'))) return true;
      const enrollment = await cancelEnrollment(prisma, cancelMatch[1], { notes: body?.notes });
      json(res, 200, { enrollment });
      return true;
    }

    // --- Enrollments collection + item ---
    if (ENROLLMENTS_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.training.read'))) return true;
      const enrollments = await listEnrollments(prisma, {
        userId:     url.searchParams.get('forUserId') || undefined,
        courseId:   url.searchParams.get('courseId')  || undefined,
        statusCode: url.searchParams.get('status')    || undefined,
      });
      json(res, 200, { enrollments });
      return true;
    }
    if (ENROLLMENTS_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.training.execute'))) return true;
      const enrollment = await enrollUser(prisma, {
        userId:   body?.targetUserId || body?.userId,
        courseId: body?.courseId,
        dueDate:  body?.dueDate,
        notes:    body?.notes,
      });
      json(res, 201, { enrollment });
      return true;
    }

    const enrollmentItemMatch = pathname.match(ENROLLMENT_ITEM);
    if (enrollmentItemMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.training.read'))) return true;
      const enrollment = await getEnrollment(prisma, enrollmentItemMatch[1]);
      json(res, 200, { enrollment });
      return true;
    }

    json(res, 405, { error: `Method ${method} not allowed on ${pathname}`, code: 'METHOD_NOT_ALLOWED' });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[handleHrmTrainingRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    if (err?.enrollmentId) payload.enrollmentId = err.enrollmentId;
    if (err?.currentStatus) payload.currentStatus = err.currentStatus;
    if (err?.activeEnrollments !== undefined) payload.activeEnrollments = err.activeEnrollments;
    json(res, status, payload);
    return true;
  }
}
