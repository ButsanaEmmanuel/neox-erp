// WBS bulk import: parent tasks + their sub-tasks in one go, with a
// weight % per row. Layout shared with the frontend xlsx template:
//
//   Title | ParentRef | WeightPercent | PlannedDate | ForecastDate
//   | ActualStartDate | Type | Priority | Assignee | Description
//
// ParentRef === '' (or null) marks a parent (depth 1).
// ParentRef === some other row's Title links a sub-task to that parent.
// Weights must sum to 100 across the parents AND 100 across the children
// of every parent. We validate before any insert so a bad sheet rolls back
// cleanly.

function badRequest(message, extra = {}) {
  const err = new Error(message);
  err.statusCode = 400;
  Object.assign(err, extra);
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toWeight(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

function nearly100(values) {
  const sum = values.reduce((acc, v) => acc + (v || 0), 0);
  // Tolerate float rounding to 0.01 — Excel users love 33.33 + 33.33 + 33.34.
  return Math.abs(sum - 100) < 0.05;
}

export function validateWbsRows(rows) {
  const errors = [];
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push({ row: 0, message: 'No rows provided.' });
    return { ok: false, errors, parents: [], childrenByParent: new Map() };
  }

  // Pass 1: bucket rows by parent reference.
  const parents = [];
  const childrenByParent = new Map(); // parentTitle -> [{row, ...}]
  const seenTitles = new Set();

  rows.forEach((raw, idx) => {
    const row = idx + 2; // human row number assuming header at row 1
    const title = String(raw?.title || '').trim();
    if (!title) {
      errors.push({ row, message: 'Missing Title.' });
      return;
    }
    if (seenTitles.has(title)) {
      errors.push({ row, message: `Duplicate Title '${title}'. Titles must be unique within an import.` });
      return;
    }
    seenTitles.add(title);

    const weight = toWeight(raw?.weightPercent);
    if (weight === null) {
      errors.push({ row, message: `Invalid WeightPercent '${raw?.weightPercent}'. Must be 0–100.` });
      return;
    }

    const parentRef = String(raw?.parentRef || '').trim();
    const entry = {
      row,
      title,
      parentRef: parentRef || null,
      weightPercent: weight,
      plannedDate: toDate(raw?.plannedDate),
      forecastDate: toDate(raw?.forecastDate),
      actualStartDate: toDate(raw?.actualStartDate),
      type: String(raw?.type || 'task').trim() || 'task',
      priority: String(raw?.priority || 'medium').trim() || 'medium',
      assignee: raw?.assignee ? String(raw.assignee).trim() : null,
      description: raw?.description ? String(raw.description) : null,
    };

    if (!parentRef) {
      parents.push(entry);
    } else {
      if (!childrenByParent.has(parentRef)) childrenByParent.set(parentRef, []);
      childrenByParent.get(parentRef).push(entry);
    }
  });

  // Pass 2: every ParentRef must resolve to a parent title in the same sheet.
  const parentTitles = new Set(parents.map((p) => p.title));
  for (const [parentRef, kids] of childrenByParent.entries()) {
    if (!parentTitles.has(parentRef)) {
      for (const child of kids) {
        errors.push({ row: child.row, message: `ParentRef '${parentRef}' does not match any parent title in this sheet.` });
      }
    }
  }

  // Pass 3: parents' weights sum to 100.
  if (parents.length > 0 && !nearly100(parents.map((p) => p.weightPercent))) {
    const sum = parents.reduce((acc, p) => acc + p.weightPercent, 0);
    errors.push({ row: 0, message: `Parent weights must sum to 100 (got ${sum.toFixed(2)}).` });
  }

  // Pass 4: each parent's children weights sum to 100 (if any children exist).
  for (const parent of parents) {
    const kids = childrenByParent.get(parent.title) || [];
    if (kids.length === 0) continue;
    if (!nearly100(kids.map((k) => k.weightPercent))) {
      const sum = kids.reduce((acc, k) => acc + k.weightPercent, 0);
      errors.push({ row: parent.row, message: `Sub-task weights under '${parent.title}' must sum to 100 (got ${sum.toFixed(2)}).` });
    }
  }

  return { ok: errors.length === 0, errors, parents, childrenByParent };
}

function deriveSchedule(plannedDate, actualStartDate) {
  if (!plannedDate || !actualStartDate) return { scheduleStatus: null, startVarianceDays: null };
  const diff = Math.round((actualStartDate.getTime() - plannedDate.getTime()) / 86400000);
  if (!Number.isFinite(diff)) return { scheduleStatus: null, startVarianceDays: null };
  let scheduleStatus = 'on_time';
  if (diff > 0) scheduleStatus = 'delayed';
  else if (diff < 0) scheduleStatus = 'early';
  return { scheduleStatus, startVarianceDays: diff };
}

export async function bulkImportWbsWorkItems(prisma, payload) {
  const projectId = String(payload?.projectId || '').trim();
  if (!projectId) throw badRequest('projectId is required.');

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!project) throw notFound(`Project '${projectId}' not found.`);

  const validation = validateWbsRows(payload.rows || []);
  if (!validation.ok) {
    throw badRequest('WBS import validation failed.', { rejected: validation.errors });
  }

  const created = await prisma.$transaction(async (tx) => {
    const totalRowCount = validation.parents.length
      + Array.from(validation.childrenByParent.values()).reduce((acc, k) => acc + k.length, 0);
    const batch = await tx.projectImportBatch.create({
      data: {
        parentProjectId: projectId,
        fileName: payload.fileName || 'wbs-import.xlsx',
        uploadedBy: payload.actorDisplayName || payload.actorUserId || 'User',
        totalRows: totalRowCount,
        successfulRows: 0,
        failedRows: 0,
        status: 'processing',
      },
    });

    const createdParents = [];
    for (const parent of validation.parents) {
      const sched = deriveSchedule(parent.plannedDate, parent.actualStartDate);
      const parentRow = await tx.workItem.create({
        data: {
          projectId,
          importBatchId: batch.id,
          title: parent.title,
          type: parent.type,
          priority: parent.priority,
          assignee: parent.assignee,
          plannedDate: parent.plannedDate,
          forecastDate: parent.forecastDate,
          actualStartDate: parent.actualStartDate,
          description: parent.description,
          weightPercent: parent.weightPercent,
          scheduleStatus: sched.scheduleStatus,
          startVarianceDays: sched.startVarianceDays,
        },
      });
      createdParents.push({ title: parent.title, id: parentRow.id });

      const kids = validation.childrenByParent.get(parent.title) || [];
      for (const child of kids) {
        const childSched = deriveSchedule(child.plannedDate, child.actualStartDate);
        await tx.workItem.create({
          data: {
            projectId,
            importBatchId: batch.id,
            title: child.title,
            type: child.type,
            priority: child.priority,
            assignee: child.assignee,
            plannedDate: child.plannedDate,
            forecastDate: child.forecastDate,
            actualStartDate: child.actualStartDate,
            description: child.description,
            weightPercent: child.weightPercent,
            scheduleStatus: childSched.scheduleStatus,
            startVarianceDays: childSched.startVarianceDays,
            parentId: parentRow.id,
          },
        });
      }
    }

    const totalChildren = Array.from(validation.childrenByParent.values()).reduce((acc, k) => acc + k.length, 0);
    await tx.projectImportBatch.update({
      where: { id: batch.id },
      data: {
        successfulRows: createdParents.length + totalChildren,
        status: 'completed',
      },
    });

    return { batchId: batch.id, parentsCreated: createdParents.length, childrenCreated: totalChildren };
  });

  return created;
}
