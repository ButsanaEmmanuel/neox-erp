// PM milestone CRUD — Sprint 5 Task 5.2.
// Mounted by backend/routes/pm/projects.routes.mjs.
//
// Conventions:
//   - All reads filter { isDeleted: false }.
//   - DELETE is soft: { isDeleted: true, deletedAt: new Date() }.
//   - Business errors throw Error with .statusCode + .code (aligned with
//     Sprint 1 vigorous-napier test pattern).
//   - completionPct validation lives here only (no DB CHECK — see D12).
//   - Dependency cycle detection: in-memory DFS, max depth 50 (see D12 sibling note).

const MILESTONE_STATUSES = ['planned', 'in_progress', 'done', 'blocked'];
const ALLOWED_FIELDS = new Set([
  'title', 'description', 'dueDate', 'status', 'ownerId', 'completionPct',
]);
const MAX_CYCLE_DEPTH = 50;

function bizErr(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}
const badRequest = (msg, code) => bizErr(msg, 400, code);
const notFound = (msg, code) => bizErr(msg, 404, code);
const conflict = (msg, code) => bizErr(msg, 409, code);

function pickAllowed(data, allowedSet) {
  const out = {};
  for (const key of Object.keys(data || {})) {
    if (allowedSet.has(key)) out[key] = data[key];
  }
  return out;
}

function validateMilestoneInput(body, { requireTitle = false, requireDueDate = false } = {}) {
  if (requireTitle) {
    const t = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!t) throw badRequest("Field 'title' is required.", 'TITLE_REQUIRED');
  } else if (body?.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      throw badRequest("Field 'title' must be a non-empty string.", 'TITLE_REQUIRED');
    }
  }

  if (requireDueDate && body?.dueDate === undefined) {
    throw badRequest("Field 'dueDate' is required.", 'DUE_DATE_REQUIRED');
  }
  if (body?.dueDate !== undefined && body.dueDate !== null) {
    if (typeof body.dueDate !== 'string' || Number.isNaN(Date.parse(body.dueDate))) {
      throw badRequest("Field 'dueDate' must be a valid ISO 8601 date string.", 'INVALID_DUE_DATE');
    }
  }

  if (body?.status !== undefined && !MILESTONE_STATUSES.includes(body.status)) {
    throw badRequest(
      `Invalid status. Allowed: ${MILESTONE_STATUSES.join(', ')}`,
      'INVALID_STATUS'
    );
  }

  if (body?.completionPct !== undefined) {
    const n = body.completionPct;
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      throw badRequest(
        "Field 'completionPct' must be an integer between 0 and 100.",
        'INVALID_COMPLETION_PCT'
      );
    }
  }

  if (body?.dependsOnIds !== undefined) {
    if (!Array.isArray(body.dependsOnIds)) {
      throw badRequest("Field 'dependsOnIds' must be an array.", 'INVALID_DEPS');
    }
    if (body.dependsOnIds.some((id) => typeof id !== 'string' || !id)) {
      throw badRequest(
        "Entries of 'dependsOnIds' must be non-empty strings.",
        'INVALID_DEP_ID'
      );
    }
    if (new Set(body.dependsOnIds).size !== body.dependsOnIds.length) {
      throw badRequest(
        "Field 'dependsOnIds' contains duplicates.",
        'DUPLICATE_DEP_IDS'
      );
    }
  }

  if (body?.ownerId !== undefined && body.ownerId !== null) {
    if (typeof body.ownerId !== 'string' || !body.ownerId) {
      throw badRequest("Field 'ownerId' must be a non-empty string or null.", 'INVALID_OWNER_ID');
    }
  }
}

async function validateDepsBelongToProject(prisma, projectId, dependsOnIds) {
  if (!dependsOnIds.length) return;
  const rows = await prisma.milestone.findMany({
    where: { id: { in: dependsOnIds }, projectId, isDeleted: false },
    select: { id: true },
  });
  if (rows.length !== dependsOnIds.length) {
    const found = new Set(rows.map((r) => r.id));
    const missing = dependsOnIds.filter((id) => !found.has(id));
    throw badRequest(
      `dependsOnIds not in project (or soft-deleted): ${missing.join(', ')}`,
      'DEPS_NOT_IN_PROJECT'
    );
  }
}

// Loads the full project dependency graph once. Returns
// Map<milestoneId, dependsOnIds[]>. Filters out soft-deleted milestones
// from both sides (defensive — orphan deps after a milestone soft-delete
// must not contribute to cycle detection).
async function buildAdjacency(prisma, projectId) {
  const allDeps = await prisma.milestoneDependency.findMany({
    where: {
      milestone: { projectId, isDeleted: false },
      dependsOn: { projectId, isDeleted: false },
    },
    select: { milestoneId: true, dependsOnId: true },
  });
  const map = new Map();
  for (const d of allDeps) {
    if (!map.has(d.milestoneId)) map.set(d.milestoneId, []);
    map.get(d.milestoneId).push(d.dependsOnId);
  }
  return map;
}

// DFS in-memory. Returns null if no cycle, or the path [fromId, ..., fromId]
// if adding edge fromId → toId would create a cycle.
// Throws DEPTH_EXCEEDED (400) if the chain exceeds maxDepth.
function detectCycleInMemory(adjacency, fromId, toId, maxDepth = MAX_CYCLE_DEPTH) {
  if (fromId === toId) return [fromId, toId];

  // DFS from toId. If we ever reach fromId, the new edge fromId → toId closes the loop.
  const stack = [{ id: toId, path: [fromId, toId], depth: 1 }];
  const visited = new Set();
  while (stack.length) {
    const { id, path, depth } = stack.pop();
    if (depth > maxDepth) {
      throw badRequest(
        `Dependency chain exceeds maximum depth (${maxDepth}).`,
        'DEPTH_EXCEEDED'
      );
    }
    if (id === fromId) return path;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of adjacency.get(id) || []) {
      stack.push({ id: next, path: [...path, next], depth: depth + 1 });
    }
  }
  return null;
}

/**
 * List all active milestones of a project, ordered by dueDate ASC.
 * Includes outgoing dependencies (this milestone depends on N others).
 * Soft-deleted dependency targets are filtered out defensively.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @returns {Promise<object[]>}
 * @throws 404 if project not found
 */
export async function listProjectMilestones(prisma, projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true },
  });
  if (!project) {
    throw notFound(`Project '${projectId}' not found.`, 'PROJECT_NOT_FOUND');
  }

  const milestones = await prisma.milestone.findMany({
    where: { projectId, isDeleted: false },
    orderBy: { dueDate: 'asc' },
    include: {
      dependencies: {
        include: {
          dependsOn: {
            select: { id: true, title: true, status: true, dueDate: true, isDeleted: true },
          },
        },
      },
    },
  });
  // Defensive: include can return deps whose target was soft-deleted after creation.
  return milestones.map((m) => ({
    ...m,
    dependencies: (m.dependencies || []).filter((d) => d.dependsOn && !d.dependsOn.isDeleted),
  }));
}

/**
 * Create a milestone. Optionally creates dependency edges atomically.
 * No cycle check needed on create (new milestone has no incoming deps).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {Record<string, unknown>} body
 * @returns {Promise<object>} created milestone with dependencies included
 * @throws 400 on validation, 404 if project not found
 */
export async function createMilestone(prisma, projectId, body) {
  validateMilestoneInput(body, { requireTitle: true, requireDueDate: true });

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true },
  });
  if (!project) {
    throw notFound(`Project '${projectId}' not found.`, 'PROJECT_NOT_FOUND');
  }

  const dependsOnIds = Array.isArray(body.dependsOnIds) ? body.dependsOnIds : [];
  await validateDepsBelongToProject(prisma, projectId, dependsOnIds);

  const fields = pickAllowed(body, ALLOWED_FIELDS);
  if (fields.dueDate) fields.dueDate = new Date(fields.dueDate);
  if (typeof fields.title === 'string') fields.title = fields.title.trim();

  return prisma.$transaction(async (tx) => {
    const milestone = await tx.milestone.create({
      data: { ...fields, projectId },
    });
    if (dependsOnIds.length) {
      await tx.milestoneDependency.createMany({
        data: dependsOnIds.map((id) => ({ milestoneId: milestone.id, dependsOnId: id })),
      });
    }
    return tx.milestone.findUnique({
      where: { id: milestone.id },
      include: {
        dependencies: {
          include: {
            dependsOn: { select: { id: true, title: true, status: true, dueDate: true } },
          },
        },
      },
    });
  });
}

/**
 * Partial update. If dependsOnIds is provided, replaces the dependency set
 * atomically and runs cycle detection for each new edge.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {string} milestoneId
 * @param {Record<string, unknown>} body
 * @returns {Promise<object>} updated milestone with dependencies included
 * @throws 400 on validation, 404 if not found, 409 on cycle
 */
export async function updateMilestone(prisma, projectId, milestoneId, body) {
  validateMilestoneInput(body);

  const existing = await prisma.milestone.findFirst({
    where: { id: milestoneId, projectId, isDeleted: false },
    select: { id: true },
  });
  if (!existing) {
    throw notFound(
      `Milestone '${milestoneId}' not found in project '${projectId}'.`,
      'MILESTONE_NOT_FOUND'
    );
  }

  const dependsOnIds = body.dependsOnIds;
  if (dependsOnIds !== undefined) {
    await validateDepsBelongToProject(prisma, projectId, dependsOnIds);
    // Build adjacency once, simulate adding each new edge, check for cycle.
    const adjacency = await buildAdjacency(prisma, projectId);
    // Clear the in-memory "current" deps of milestoneId — PATCH semantics is REPLACE.
    adjacency.set(milestoneId, []);
    for (const depId of dependsOnIds) {
      adjacency.get(milestoneId).push(depId);
      const cyclePath = detectCycleInMemory(adjacency, milestoneId, depId);
      if (cyclePath) {
        throw conflict(
          `Adding dependency would create cycle: ${cyclePath.join(' → ')}`,
          'DEPENDENCY_CYCLE'
        );
      }
    }
  }

  const fields = pickAllowed(body, ALLOWED_FIELDS);
  if (fields.dueDate) fields.dueDate = new Date(fields.dueDate);
  if (typeof fields.title === 'string') fields.title = fields.title.trim();

  return prisma.$transaction(async (tx) => {
    if (Object.keys(fields).length) {
      await tx.milestone.update({ where: { id: milestoneId }, data: fields });
    }
    if (dependsOnIds !== undefined) {
      await tx.milestoneDependency.deleteMany({ where: { milestoneId } });
      if (dependsOnIds.length) {
        await tx.milestoneDependency.createMany({
          data: dependsOnIds.map((id) => ({ milestoneId, dependsOnId: id })),
        });
      }
    }
    return tx.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        dependencies: {
          include: {
            dependsOn: { select: { id: true, title: true, status: true, dueDate: true } },
          },
        },
      },
    });
  });
}

/**
 * Soft-delete a milestone. Refuses with 409 if other ACTIVE milestones still
 * depend on it (FK ON DELETE RESTRICT only fires on hard delete, so we check
 * explicitly here — see D12 sibling note).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {string} milestoneId
 * @returns {Promise<{ ok: true }>}
 * @throws 404 if not found, 409 if still referenced
 */
export async function deleteMilestone(prisma, projectId, milestoneId) {
  const existing = await prisma.milestone.findFirst({
    where: { id: milestoneId, projectId, isDeleted: false },
    select: { id: true },
  });
  if (!existing) {
    throw notFound(
      `Milestone '${milestoneId}' not found in project '${projectId}'.`,
      'MILESTONE_NOT_FOUND'
    );
  }

  const blockers = await prisma.milestoneDependency.findMany({
    where: {
      dependsOnId: milestoneId,
      milestone: { isDeleted: false, projectId },
    },
    select: { milestoneId: true, milestone: { select: { title: true } } },
  });
  if (blockers.length) {
    const names = blockers
      .map((b) => `${b.milestone?.title || '?'} (${b.milestoneId})`)
      .join(', ');
    throw conflict(
      `Cannot delete: still blocks ${blockers.length} active milestone(s): ${names}`,
      'MILESTONE_BLOCKED'
    );
  }

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  return { ok: true };
}
