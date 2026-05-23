// HRM-2.1 — /api/v1/hrm/recruitment/* dispatcher.
// Every route gates with assertPermission(...) — HRM-2 rule.

import {
  listJobPostings,
  getJobPosting,
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  listCandidates,
  getCandidate,
  createCandidate,
  updateCandidateStage,
  rejectCandidate,
  hireCandidate,
} from '../../services/hrm/recruitment.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const POSTINGS_COLL = /^\/api\/v1\/hrm\/recruitment\/postings$/;
const POSTING_ITEM  = /^\/api\/v1\/hrm\/recruitment\/postings\/([^/]+)$/;
const CANDIDATES_COLL = /^\/api\/v1\/hrm\/recruitment\/candidates$/;
const CANDIDATE_ITEM  = /^\/api\/v1\/hrm\/recruitment\/candidates\/([^/]+)$/;
const CANDIDATE_STAGE = /^\/api\/v1\/hrm\/recruitment\/candidates\/([^/]+)\/stage$/;
const CANDIDATE_HIRE  = /^\/api\/v1\/hrm\/recruitment\/candidates\/([^/]+)\/hire$/;
const CANDIDATE_REJECT = /^\/api\/v1\/hrm\/recruitment\/candidates\/([^/]+)\/reject$/;

function hasMatch(p) {
  return POSTINGS_COLL.test(p) || POSTING_ITEM.test(p)
    || CANDIDATE_HIRE.test(p) || CANDIDATE_REJECT.test(p) || CANDIDATE_STAGE.test(p)
    || CANDIDATE_ITEM.test(p) || CANDIDATES_COLL.test(p);
}

function actorFromCtx(ctx, body) {
  return (
    String(ctx.url.searchParams.get('actorUserId') || '').trim()
    || String(body?.actorUserId || body?.userId || '').trim()
    || null
  );
}

export async function handleHrmRecruitmentRoutes(ctx) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  if (!hasMatch(pathname)) return false;

  const queryUserId = String(url.searchParams.get('userId') || url.searchParams.get('actorUserId') || '').trim() || null;

  try {
    // --- Postings ---
    if (POSTINGS_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.recruitment.read'))) return true;
      const postings = await listJobPostings(prisma, {
        statusCode: url.searchParams.get('status') || undefined,
        departmentId: url.searchParams.get('departmentId') || undefined,
      });
      json(res, 200, { postings });
      return true;
    }
    if (POSTINGS_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.recruitment.write'))) return true;
      const posting = await createJobPosting(prisma, body, { actorUserId: actor });
      json(res, 201, { posting });
      return true;
    }
    const postingItemMatch = pathname.match(POSTING_ITEM);
    if (postingItemMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.recruitment.read'))) return true;
      const posting = await getJobPosting(prisma, postingItemMatch[1]);
      json(res, 200, { posting });
      return true;
    }
    if (postingItemMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.recruitment.write'))) return true;
      const posting = await updateJobPosting(prisma, postingItemMatch[1], body);
      json(res, 200, { posting });
      return true;
    }
    if (postingItemMatch && method === 'DELETE') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.recruitment.write'))) return true;
      const result = await deleteJobPosting(prisma, postingItemMatch[1]);
      json(res, 200, result);
      return true;
    }

    // --- Candidate sub-routes (hire / reject / stage) must match BEFORE the generic /:id ---
    const hireMatch = pathname.match(CANDIDATE_HIRE);
    if (hireMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.recruitment.execute'))) return true;
      const result = await hireCandidate(prisma, hireMatch[1], body, { actorUserId: actor });
      json(res, 200, result);
      return true;
    }
    const rejectMatch = pathname.match(CANDIDATE_REJECT);
    if (rejectMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.recruitment.execute'))) return true;
      const candidate = await rejectCandidate(prisma, rejectMatch[1], { reason: body?.reason });
      json(res, 200, { candidate });
      return true;
    }
    const stageMatch = pathname.match(CANDIDATE_STAGE);
    if (stageMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.recruitment.write'))) return true;
      const candidate = await updateCandidateStage(prisma, stageMatch[1], body);
      json(res, 200, { candidate });
      return true;
    }

    // --- Candidates collection + item ---
    if (CANDIDATES_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.recruitment.read'))) return true;
      const candidates = await listCandidates(prisma, {
        statusCode: url.searchParams.get('status') || undefined,
        jobPostingId: url.searchParams.get('jobPostingId') || undefined,
        departmentId: url.searchParams.get('departmentId') || undefined,
      });
      json(res, 200, { candidates });
      return true;
    }
    if (CANDIDATES_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.recruitment.write'))) return true;
      const candidate = await createCandidate(prisma, body);
      json(res, 201, { candidate });
      return true;
    }
    const candidateItemMatch = pathname.match(CANDIDATE_ITEM);
    if (candidateItemMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.recruitment.read'))) return true;
      const candidate = await getCandidate(prisma, candidateItemMatch[1]);
      json(res, 200, { candidate });
      return true;
    }

    json(res, 405, { error: `Method ${method} not allowed on ${pathname}`, code: 'METHOD_NOT_ALLOWED' });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[handleHrmRecruitmentRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    if (err?.current) payload.current = err.current;
    if (err?.conflicting) payload.conflicting = err.conflicting;
    if (err?.hiredUserId) payload.hiredUserId = err.hiredUserId;
    if (err?.activeCandidates !== undefined) payload.activeCandidates = err.activeCandidates;
    json(res, status, payload);
    return true;
  }
}
