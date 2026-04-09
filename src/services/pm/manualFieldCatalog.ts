export type ManualFieldType = 'text' | 'number' | 'date' | 'boolean' | 'enum';

export interface ManualFieldDef {
  key: string;
  label: string;
  type: ManualFieldType;
  required?: boolean;
  options?: string[];
  computedReadonly?: boolean;
  derivedFrom?: string;
}

export const OPERATIONAL_MANUAL_FIELDS: ManualFieldDef[] = [
  { key: 'planning_audit_date', label: 'Planning Audit Date', type: 'date' },
  { key: 'planning_audit_week', label: 'Planning Audit Week', type: 'number', computedReadonly: true, derivedFrom: 'planning_audit_date' },
  { key: 'forecast_date', label: 'Forecast Date', type: 'date' },
  { key: 'forecast_week', label: 'Forecast Week', type: 'number', computedReadonly: true, derivedFrom: 'forecast_date' },
  { key: 'actual_audit_date', label: 'Actual Audit Date', type: 'date' },
  { key: 'actual_audit_week', label: 'Actual Audit Week', type: 'number', computedReadonly: true, derivedFrom: 'actual_audit_date' },
  { key: 'qa_visit_date', label: 'QA Visit Date', type: 'date', required: true },
  { key: 'qa_status', label: 'QA Status', type: 'enum', options: ['Pending', 'Approved', 'Rejected'], required: true },
  { key: 'report_posted_week', label: 'Report Posted Week', type: 'number' },
  { key: 'submission_report_date', label: 'Submission Report Date', type: 'date' },
  { key: 'site_readiness_note', label: 'Site Readiness Note', type: 'text' },
];

export const ACCEPTANCE_MANUAL_FIELDS: ManualFieldDef[] = [
  { key: 'acceptance_signed', label: 'Acceptance Signed', type: 'boolean', required: true },
  { key: 'acceptance_signed_date', label: 'Acceptance Signed Date', type: 'date', required: true },
  { key: 'acceptance_reference', label: 'Acceptance Reference', type: 'text' },
  { key: 'handover_status', label: 'Handover Status', type: 'enum', options: ['Pending', 'Completed', 'Blocked'] },
  { key: 'acceptance_comment', label: 'Acceptance Comment', type: 'text' },
];

export function formatManualFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
