export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'at-risk';
export type WorkItemStatus =
  | 'backlog'
  | 'pending'
  | 'todo'
  | 'in-progress'
  | 'done'
  | 'imported'
  | 'needs_manual_completion'
  | 'ready_for_calculation'
  | 'finance_pending'
  | 'finance_synced'
  | 'complete'
  | 'validation_error'
  | 'finance_sync_error'
  | 'awaiting_qa_approval'
  | 'awaiting_signed_acceptance'
  | 'awaiting_financial_eligibility'
  | 'at_risk';
export type WorkItemType = 'task' | 'milestone' | 'deliverable' | 'issue' | 'site';
export type ImportStatus = 'processing' | 'completed' | 'failed' | 'completed-with-errors';
export type ProjectMode = 'standard' | 'telecom_multi_site';
export type FinanceSyncStatus = 'pending' | 'synced' | 'error' | 'blocked';

export interface ProjectKPIs {
  totalWorkItems: number;
  completed: number;
  pendingQA: number;
  pendingAcceptance: number;
  overdue: number;
  progress: number;
}

export interface TelecomProjectSummary {
  totalImportedRows: number;
  incompleteItems: number;
  financePending: number;
  financeSynced: number;
  errorRows: number;
  qaApprovedItems?: number;
  acceptanceSignedItems?: number;
  delayedItems?: number;
  onTimeItems?: number;
  earlyItems?: number;
  averageDelayDays?: number;
}

export interface Project {
  id: string;
  name: string;
  client: string; // Deprecated, use clientId/Name

  // Identity
  clientId: string;
  clientName: string; // fallback

  managerId: string;
  managerName: string; // fallback

  status: ProjectStatus;
  manager: string; // Deprecated, use managerId/Name
  startDate: string; // ISO Date
  endDate: string; // ISO Date

  // Financials
  poNumber: string;
  currency: string;
  costHT: number;
  vatRate: number; // 0.16
  vatAmount: number;
  costTTC: number;

  // Telecom extension
  projectMode?: ProjectMode;
  isTelecomProject?: boolean;
  bulkImportRequired?: boolean;
  purchase_order?: string;
  projectCategory?: string;
  telecomSummary?: TelecomProjectSummary;

  description?: string;
  scope?: ProjectScope;
  kpis: ProjectKPIs;
}

export interface ProjectMember {
  id: string;
  userId: string;
  roleCode: 'LEAD' | 'CONTRIBUTOR' | 'VIEWER' | string;
  userName: string;
  departmentId: string;
}

// Scope Types
export interface ScopeBaseItem {
  id: string;
  text: string; // Description or Title
  ownerId?: string;
  createdAt: string;
}

export interface Objective extends ScopeBaseItem {
  metric?: string;
  targetDate?: string;
}

export interface Deliverable extends ScopeBaseItem {
  type: 'document' | 'software' | 'service' | 'other';
  status: 'draft' | 'pending' | 'approved';
  evidenceRequired: boolean;
}

export interface OutOfScopeItem extends ScopeBaseItem {
  reason?: string;
}

export interface Assumption extends ScopeBaseItem {
  riskLevel: 'low' | 'medium' | 'high';
  impact?: string;
}

export interface ProjectScope {
  objectives: Objective[];
  deliverables: Deliverable[];
  outOfScope: OutOfScopeItem[];
  assumptions: Assumption[];
  constraints: ScopeBaseItem[];
}

export interface TelecomImportedFields {
  legacy_site_id?: string;
  site_identifier?: string;
  site_name?: string;
  region?: string;
  market?: string;
  zone?: string;
  city?: string;
  district?: string;
  technology?: string;
  scope_label?: string;
  subcontractor?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  planning_audit_date?: string;
  planning_audit_week?: number;
  forecast_date?: string;
  forecast_week?: number;
  actual_audit_date?: string;
  project_name?: string;
  type_of_work?: string;
  team?: string;
}

export interface TelecomManualFields {
  operational_manual_fields?: Record<string, string | number | boolean | null>;
  acceptance_manual_fields?: Record<string, string | number | boolean | null>;
}

export interface WorkItem {
  id: string;
  projectId: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: 'low' | 'medium' | 'high';
  assignee?: string; // Employee ID or Name

  // Dates
  plannedDate?: string;
  forecastDate?: string;
  actualDate?: string;
  schedule_status?: 'pending' | 'on_time' | 'delayed' | 'early';
  start_variance_days?: number;
  is_delayed?: boolean;
  delay_days?: number;    // forecast_date - planning_audit_date (positive = late)
  delay_weeks?: number;   // Math.ceil(delay_days / 7)

  // Approvals
  qaStatus?: 'pending' | 'approved' | 'rejected';
  qaDate?: string;
  acceptanceStatus?: 'pending' | 'signed' | 'rejected';
  acceptanceDate?: string;

  // Meta
  siteId?: string;
  legacySiteId?: string;
  description?: string;
  tags?: string[];

  // D13 — Sub-task hierarchy (parentId carries the relation; root ⇔ parentId === null/undefined).
  // `children` is populated when the row comes from getProjectById's nested include.
  parentId?: string | null;
  children?: WorkItem[];

  // Telecom imported/manual/calculated fields
  import_batch_id?: string;
  manual_completion_status?: 'pending' | 'complete';
  planning_audit_date?: string;
  planning_audit_week?: number;
  forecast_date?: string;
  forecast_week?: number;
  actual_audit_date?: string;
  actual_audit_week?: number;
  po_unit_price?: number;
  ticket_number?: number;
  po_unit_price_completed?: number;
  contractor_payable_amount?: number;
  finance_sync_status?: FinanceSyncStatus;
  finance_sync_at?: string;
  finance_reference_id?: string;
  finance_error_message?: string;
  is_financially_eligible?: boolean;
  financial_eligibility_reason?: string;
  imported_fields?: TelecomImportedFields;
  operational_manual_fields?: Record<string, string | number | boolean | null>;
  acceptance_manual_fields?: Record<string, string | number | boolean | null>;

  // Client-side recency stamp set on every store mutation. Used by the list
  // page to surface most-recently-edited items first; not persisted.
  _clientUpdatedAt?: number;
}

export interface Document {
  id: string;
  projectId: string;
  workItemId?: string; // If attached to a specific item
  name: string;
  category: 'contract' | 'sow' | 'report' | 'evidence' | 'acceptance' | 'photo' | 'other';
  uploader: string;
  uploadDate: string;
  size: string;
  url: string; // Mock URL
}

export interface ImportRecord {
  id: string;
  projectId: string;
  filename: string;
  uploader: string;
  date: string;
  status: ImportStatus;
  summary: {
    total: number;
    created: number;
    updated: number;
    failed: number;
  };
  logs?: { row: number; error: string }[];
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string; // e.g., 'created task', 'uploaded status', 'uploaded document'
  targetId: string;
  targetName: string;
  timestamp: string;
  type: 'work-item' | 'document' | 'project' | 'scope' | 'import' | 'finance-sync';
}

export interface TelecomImportValidationError {
  row: number;
  site_identifier?: string;
  message: string;
}

export interface TelecomImportRow {
  rowNumber: number;
  site_identifier: string;
  title: string;
  imported_fields: TelecomImportedFields;
  po_unit_price: number;
}

export interface TelecomImportValidationResult {
  totalRows: number;
  validRows: TelecomImportRow[];
  invalidRows: TelecomImportValidationError[];
  warnings: string[];
}

export interface TelecomImportBatch {
  id: string;
  parent_project_id: string;
  file_name: string;
  uploaded_by: string;
  uploaded_at: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  status: 'processing' | 'completed' | 'failed';
  error_summary?: string;
}

// ── Milestones (Sprint 5) ─────────────────────────────────────────────────
// Backend source : prisma model Milestone + MilestoneDependency.
// Routes : GET/POST /api/v1/projects/:id/milestones,
//          PATCH/DELETE /api/v1/projects/:id/milestones/:mId
// Voir backend/services/pm/milestones.service.mjs.

export type MilestoneStatus = 'planned' | 'in_progress' | 'done' | 'blocked';

export interface MilestoneDependencyEdge {
  milestoneId: string;
  dependsOnId: string;
  dependsOn: {
    id: string;
    title: string;
    status: MilestoneStatus;
    dueDate: string;
  };
}

export interface Milestone {
  id: string;
  projectId: string;
  parentId?: string | null;
  title: string;
  description?: string | null;
  dueDate: string;
  status: MilestoneStatus;
  ownerId?: string | null;
  completionPct: number;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  dependencies: MilestoneDependencyEdge[];
  children?: Milestone[];
}


