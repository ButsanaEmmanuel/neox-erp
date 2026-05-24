// DH7 — Column registry for the telecom WorkItems table.
// Keys MUST stay in lock-step with backend/services/preferences/
// columnPreferences.service.mjs:CONTEXT_REGISTRY.telecom_workitems.

import type { WorkItem } from '../../../types/pm';

export interface TelecomColumnDef {
  key: string;
  label: string;
  /** Optional accessor — returns the cell value as string. Numbers/dates
   * are formatted by the accessor itself. Returns empty string for "no
   * data" (the table renders '-' for empty cells). */
  accessor: (item: WorkItem, ctx: { index: number; projectName?: string }) => string;
  /** Optional right-alignment for numeric columns. */
  align?: 'right';
}

const get = (obj: unknown, key: string): unknown => {
  if (!obj || typeof obj !== 'object') return undefined;
  return (obj as Record<string, unknown>)[key];
};
const asString = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));
const asNumber = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : '';
};
const asDate = (v: unknown): string => {
  const raw = asString(v);
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
};

export const TELECOM_COLUMN_REGISTRY: TelecomColumnDef[] = [
  { key: 'row_number',                label: 'N°',                         accessor: (_, c) => String(c.index + 1), align: 'right' },
  { key: 'legacy_site_id',            label: 'Legacy Site ID',             accessor: (i) => asString(get(i.imported_fields, 'legacy_site_id')) },
  { key: 'site_id',                   label: 'Site ID',                    accessor: (i) => asString(get(i.imported_fields, 'site_identifier') ?? get(i.imported_fields, 'site_id')) },
  { key: 'site_name',                 label: 'Site Name',                  accessor: (i) => asString(get(i.imported_fields, 'site_name')) },
  { key: 'project_name',              label: 'Project Name',               accessor: (_, c) => asString(c.projectName) },
  { key: 'type_of_work',              label: 'Type of Work',               accessor: (i) => asString(get(i.imported_fields, 'type_of_work')) },
  { key: 'contractor',                label: 'Contractor',                 accessor: (i) => asString(get(i.imported_fields, 'contractor')) },
  { key: 'team',                      label: 'Team',                       accessor: (i) => asString(get(i.imported_fields, 'team') ?? i.assignee) },
  { key: 'planning_audit_date',       label: 'Planning Audit Date',        accessor: (i) => asDate(i.planning_audit_date ?? get(i.imported_fields, 'planning_audit_date')) },
  { key: 'planning_audit_week',       label: 'Planning Audit Week',        accessor: (i) => asString(i.planning_audit_week), align: 'right' },
  { key: 'forecast_date',             label: 'Forecast Date',              accessor: (i) => asDate(i.forecast_date) },
  { key: 'forecast_week',             label: 'Forecast Week',              accessor: (i) => asString(i.forecast_week), align: 'right' },
  { key: 'actual_audit_date',         label: 'Actual Audit Date',          accessor: (i) => asDate(i.actual_audit_date) },
  { key: 'actual_audit_week',         label: 'Actual Audit Week',          accessor: (i) => asString(i.actual_audit_week), align: 'right' },
  { key: 'qa_visit',                  label: 'QA Visit',                   accessor: (i) => asString(get(i.operational_manual_fields, 'qa_visit')) },
  { key: 'tower_status',              label: 'Tower Status',               accessor: (i) => asString(get(i.imported_fields, 'tower_status')) },
  { key: 'foundation_status',         label: 'Foundation Status',          accessor: (i) => asString(get(i.imported_fields, 'foundation_status')) },
  { key: 'qa_status',                 label: 'QA Status',                  accessor: (i) => asString(i.qaStatus) },
  { key: 'report_posted_date',        label: 'Report Posted Date',         accessor: (i) => asDate(get(i.operational_manual_fields, 'report_posted_date')) },
  { key: 'report_posted_week',        label: 'Report Posted Week',         accessor: (i) => asString(get(i.operational_manual_fields, 'report_posted_week')), align: 'right' },
  { key: 'qa_completed_date',         label: 'QA Completed Date',          accessor: (i) => asDate(get(i.operational_manual_fields, 'qa_completed_date')) },
  { key: 'qa_completed_week',         label: 'QA Completed Week',          accessor: (i) => asString(get(i.operational_manual_fields, 'qa_completed_week')), align: 'right' },
  { key: 'submission_report_date',    label: 'Submission Report Date',     accessor: (i) => asDate(get(i.acceptance_manual_fields, 'submission_report_date')) },
  { key: 'submission_report_week',    label: 'Submission Report Week',     accessor: (i) => asString(get(i.acceptance_manual_fields, 'submission_report_week')), align: 'right' },
  { key: 'purchase_order',            label: 'Purchase Order',             accessor: (i) => asString(get(i.imported_fields, 'purchase_order')) },
  { key: 'acceptance_sent',           label: 'Acceptance Sent',            accessor: (i) => asString(get(i.acceptance_manual_fields, 'acceptance_sent')) },
  { key: 'acceptance_submitted_date', label: 'Acceptance Submitted Date',  accessor: (i) => asDate(get(i.acceptance_manual_fields, 'acceptance_submitted_date')) },
  { key: 'acceptance_month',          label: 'Acceptance Month',           accessor: (i) => asString(get(i.acceptance_manual_fields, 'acceptance_month')) },
  { key: 'acceptance_signed',         label: 'Acceptance Signed',          accessor: (i) => asString(i.acceptanceStatus) },
  { key: 'acceptance_signature_date', label: 'Acceptance Signature Date',  accessor: (i) => asDate(get(i.acceptance_manual_fields, 'acceptance_signature_date')) },
  { key: 'po_unit_price',             label: 'PO Unit Price',              accessor: (i) => asNumber(i.po_unit_price), align: 'right' },
  { key: 'ticket_number',             label: 'Ticket Number',              accessor: (i) => asNumber(i.ticket_number), align: 'right' },
  { key: 'po_unit_price_completed',   label: 'PO Unit Price Completed',    accessor: (i) => asNumber(i.po_unit_price_completed), align: 'right' },
  { key: 'labor_unit_price',          label: 'Labor Unit Price',           accessor: (i) => asNumber(get(i.operational_manual_fields, 'labor_unit_price')), align: 'right' },
  { key: 'comment',                   label: 'Comment',                    accessor: (i) => asString(i.description ?? get(i.operational_manual_fields, 'comment')) },
];

export const TELECOM_DEFAULT_COLUMNS = [
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

export const columnByKey = new Map(TELECOM_COLUMN_REGISTRY.map((c) => [c.key, c]));
