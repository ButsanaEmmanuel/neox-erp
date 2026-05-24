// DH7 — User column preferences (visibility + order) per table context.
// First consumer: the telecom WorkItems table. Adding a new context just
// means adding an entry to CONTEXT_REGISTRY below — no schema change.

// --- registry ---------------------------------------------------------

// 35 columns sourced from Equipment_Audit_Project_ERP.xlsx. The key is
// the stable identifier persisted in DB; the frontend maps the same key
// to a label + value accessor.
const TELECOM_WORKITEMS_COLUMNS = [
  'row_number',
  'legacy_site_id',
  'site_id',
  'site_name',
  'project_name',
  'type_of_work',
  'contractor',
  'team',
  'planning_audit_date',
  'planning_audit_week',
  'forecast_date',
  'forecast_week',
  'actual_audit_date',
  'actual_audit_week',
  'qa_visit',
  'tower_status',
  'foundation_status',
  'qa_status',
  'report_posted_date',
  'report_posted_week',
  'qa_completed_date',
  'qa_completed_week',
  'submission_report_date',
  'submission_report_week',
  'purchase_order',
  'acceptance_sent',
  'acceptance_submitted_date',
  'acceptance_month',
  'acceptance_signed',
  'acceptance_signature_date',
  'po_unit_price',
  'ticket_number',
  'po_unit_price_completed',
  'labor_unit_price',
  'comment',
];

const TELECOM_WORKITEMS_DEFAULTS = [
  'row_number',
  'site_id',
  'site_name',
  'team',
  'actual_audit_date',
  'qa_status',
  'acceptance_sent',
  'acceptance_signed',
  'comment',
];

export const CONTEXT_REGISTRY = {
  telecom_workitems: {
    allowed: TELECOM_WORKITEMS_COLUMNS,
    defaults: TELECOM_WORKITEMS_DEFAULTS,
  },
};

// --- errors -----------------------------------------------------------

function err(statusCode, code, message, extra = {}) {
  const e = new Error(message);
  e.statusCode = statusCode;
  e.code = code;
  Object.assign(e, extra);
  return e;
}

const badRequest = (code, msg, extra) => err(400, code, msg, extra);

// --- public API -------------------------------------------------------

export function listKnownContexts() {
  return Object.keys(CONTEXT_REGISTRY);
}

export async function getColumnPreference(prisma, userId, context) {
  const registry = CONTEXT_REGISTRY[context];
  if (!registry) {
    throw badRequest('UNKNOWN_CONTEXT', `Unknown column-preference context: ${context}`, { field: 'context' });
  }
  if (!userId) {
    return { context, columns: registry.defaults };
  }
  const row = await prisma.userColumnPreference.findUnique({
    where: { userId_context: { userId, context } },
  });
  if (!row) return { context, columns: registry.defaults };
  // Defensive: drop any persisted key that's no longer in `allowed`
  // (e.g. column removed from registry). Keeps DB tolerant to drift.
  const allowedSet = new Set(registry.allowed);
  const filtered = (Array.isArray(row.columns) ? row.columns : registry.defaults).filter((k) => typeof k === 'string' && allowedSet.has(k));
  return { context, columns: filtered.length > 0 ? filtered : registry.defaults };
}

export async function setColumnPreference(prisma, userId, { context, columns }) {
  if (!userId) {
    throw badRequest('USER_ID_REQUIRED', 'userId is required to save column preferences.');
  }
  const registry = CONTEXT_REGISTRY[context];
  if (!registry) {
    throw badRequest('UNKNOWN_CONTEXT', `Unknown column-preference context: ${context}`, { field: 'context' });
  }
  if (!Array.isArray(columns)) {
    throw badRequest('INVALID_COLUMNS', "Field 'columns' must be an array of strings.", { field: 'columns' });
  }
  const allowedSet = new Set(registry.allowed);
  const seen = new Set();
  const cleaned = [];
  for (const col of columns) {
    if (typeof col !== 'string') {
      throw badRequest('INVALID_COLUMN_KEY', 'columns[] must contain strings only.', { field: 'columns' });
    }
    if (!allowedSet.has(col)) {
      throw badRequest('UNKNOWN_COLUMN_KEY', `Unknown column key: ${col}`, { field: 'columns', key: col });
    }
    if (seen.has(col)) continue; // dedupe silently
    seen.add(col);
    cleaned.push(col);
  }
  if (cleaned.length === 0) {
    throw badRequest('EMPTY_COLUMNS', 'columns[] must contain at least one column.', { field: 'columns' });
  }
  await prisma.userColumnPreference.upsert({
    where: { userId_context: { userId, context } },
    create: { userId, context, columns: cleaned },
    update: { columns: cleaned },
  });
  return { context, columns: cleaned };
}
