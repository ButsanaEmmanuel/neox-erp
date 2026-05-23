// HRM-2.4 — /api/v1/hrm/policies/* dispatcher.
// Every route gates with assertPermission(...).
//
// Permission scheme:
//   - hrm.policies.read    GET   policies + acknowledgements
//   - hrm.policies.write   POST/PUT/DELETE  draft management
//   - hrm.policies.execute PUT   /publish, /archive (lifecycle)
//   - hrm.policies.read    POST  /acknowledge (self-service signature)

import {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  publishPolicy,
  archivePolicy,
  deletePolicy,
  acknowledgePolicy,
  listAcknowledgements,
} from '../../services/hrm/policies.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const POLICIES_COLL  = /^\/api\/v1\/hrm\/policies$/;
const POLICY_ITEM    = /^\/api\/v1\/hrm\/policies\/([^/]+)$/;
const POLICY_PUBLISH = /^\/api\/v1\/hrm\/policies\/([^/]+)\/publish$/;
const POLICY_ARCHIVE = /^\/api\/v1\/hrm\/policies\/([^/]+)\/archive$/;
const POLICY_ACK     = /^\/api\/v1\/hrm\/policies\/([^/]+)\/acknowledge$/;
const ACK_COLL       = /^\/api\/v1\/hrm\/policies\/([^/]+)\/acknowledgements$/;

function hasMatch(p) {
  return POLICIES_COLL.test(p) || POLICY_PUBLISH.test(p) || POLICY_ARCHIVE.test(p)
    || POLICY_ACK.test(p) || ACK_COLL.test(p) || POLICY_ITEM.test(p);
}

// Strict actor (does NOT fall back to body.userId — that's the
// target-user pattern, not the actor pattern).
function actorFromCtx(ctx, body) {
  return (
    String(ctx.url.searchParams.get('actorUserId') || '').trim()
    || String(body?.actorUserId || '').trim()
    || null
  );
}

export async function handleHrmPoliciesRoutes(ctx) {
  const { method, pathname, url, prisma, parseBody, json, res } = ctx;
  if (!hasMatch(pathname)) return false;

  const queryUserId = String(url.searchParams.get('userId') || url.searchParams.get('actorUserId') || '').trim() || null;

  try {
    // Lifecycle: publish / archive (specific routes BEFORE the generic /:id).
    const pubMatch = pathname.match(POLICY_PUBLISH);
    if (pubMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.policies.execute'))) return true;
      const policy = await publishPolicy(prisma, pubMatch[1]);
      json(res, 200, { policy });
      return true;
    }
    const archMatch = pathname.match(POLICY_ARCHIVE);
    if (archMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.policies.execute'))) return true;
      const policy = await archivePolicy(prisma, archMatch[1]);
      json(res, 200, { policy });
      return true;
    }

    // Acknowledgement (self-service: needs read, not execute).
    const ackMatch = pathname.match(POLICY_ACK);
    if (ackMatch && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.policies.read'))) return true;
      const acknowledgement = await acknowledgePolicy(prisma, ackMatch[1], {
        actorUserId: actor,
        note: body?.note,
      });
      json(res, 201, { acknowledgement });
      return true;
    }
    const ackCollMatch = pathname.match(ACK_COLL);
    if (ackCollMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.policies.read'))) return true;
      const acknowledgements = await listAcknowledgements(prisma, { policyId: ackCollMatch[1] });
      json(res, 200, { acknowledgements });
      return true;
    }

    // Collection
    if (POLICIES_COLL.test(pathname) && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.policies.read'))) return true;
      const policies = await listPolicies(prisma, {
        statusCode: url.searchParams.get('status')   || undefined,
        category:   url.searchParams.get('category') || undefined,
        forUserId:  url.searchParams.get('forUserId') || queryUserId || undefined,
      });
      json(res, 200, { policies });
      return true;
    }
    if (POLICIES_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.policies.write'))) return true;
      const policy = await createPolicy(prisma, body, { actorUserId: actor });
      json(res, 201, { policy });
      return true;
    }

    // Item
    const itemMatch = pathname.match(POLICY_ITEM);
    if (itemMatch && method === 'GET') {
      if (!(await assertPermission({ userId: queryUserId, res }, 'hrm.policies.read'))) return true;
      const policy = await getPolicy(prisma, itemMatch[1], { forUserId: queryUserId || undefined });
      json(res, 200, { policy });
      return true;
    }
    if (itemMatch && method === 'PUT') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.policies.write'))) return true;
      const policy = await updatePolicy(prisma, itemMatch[1], body);
      json(res, 200, { policy });
      return true;
    }
    if (itemMatch && method === 'DELETE') {
      const body = await parseBody(ctx.req);
      const actor = actorFromCtx(ctx, body);
      if (!(await assertPermission({ userId: actor, res }, 'hrm.policies.write'))) return true;
      const result = await deletePolicy(prisma, itemMatch[1]);
      json(res, 200, result);
      return true;
    }

    json(res, 405, { error: `Method ${method} not allowed on ${pathname}`, code: 'METHOD_NOT_ALLOWED' });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[handleHrmPoliciesRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    if (err?.acknowledgementId) payload.acknowledgementId = err.acknowledgementId;
    if (err?.signedAt) payload.signedAt = err.signedAt;
    if (err?.currentStatus) payload.currentStatus = err.currentStatus;
    json(res, status, payload);
    return true;
  }
}
