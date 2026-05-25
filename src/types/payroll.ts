// Payroll types — canonical UI-facing shapes aligned with Prisma models.
//
// Sources (prisma/schema.prisma):
//   PayrollBatch, PayrollSchedule, PayrollRun, PayrollRunEmployee,
//   EmployeeSalaryProfile, PayrollDisbursementLine.
//
// Decimal fields are received as numbers (serialised by JSON). Nullable
// fields use `?` with explicit `| null` where backend returns null.

export interface PayrollLine {
  id: string;
  employeeName: string;
  employeeCode?: string | null;
  totalAmount: number;
  status: string;
  payableId?: string | null;
  paidAt?: string | null;
  payable?: {
    id: string;
    paymentStatus: string;
    payments?: Array<{
      id: string;
      paymentReference: string;
      paymentDate: string;
      proofDocumentId?: string | null;
    }>;
    financeEntry?: {
      id: string;
      referenceCode: string;
      evidenceDocuments?: Array<{
        id: string;
        documentType: string;
        originalFileName: string;
        createdAt: string;
      }>;
    };
  } | null;
}

export interface PayrollBatch {
  id: string;
  batchCode: string;
  periodStart: string;
  periodEnd: string;
  payoutDate?: string | null;
  status: string;
  approvalStatus: string;
  totalAmount: number;
  lines: PayrollLine[];
}

export interface PayrollSchedule {
  id: string;
  code: string;
  name: string;
  executionRule: string;
  dayOfMonth?: number | null;
  validationMode: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  isActive?: boolean;
}

export interface PayrollRunEmployee {
  id: string;
  userId: string;
  inclusionStatus: string;
  exclusionReason?: string | null;
  regularWorkedDays: number;
  weekendWorkedDays: number;
  dailyRate: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  adjustedGrossPay?: number | null;
  payrollLineId?: string | null;
}

export interface PayrollRunNotification {
  id: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
}

// F2.4 — collections stitched on by getPayrollRunDetail (Promise.all, no
// Prisma backRefs). All hold payrollRunId; PayrollAdjustment + the calc
// detail also carry payrollRunEmployeeId for per-employee filtering.

export interface PayrollAdjustment {
  id: string;
  payrollRunId: string;
  payrollRunEmployeeId: string;
  originalAmount: number;
  adjustedAmount: number;
  reason: string;
  comment?: string | null;
  adjustedByUserId?: string | null;
  adjustedByName?: string | null;
  createdAt: string;
}

export interface PayrollCalculationDetail {
  id: string;
  payrollRunId: string;
  payrollRunEmployeeId: string;
  ruleCode: string;
  ruleDescription?: string | null;
  inputJson?: Record<string, unknown> | null;
  outputJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PayrollRunTimesheetLink {
  id: string;
  payrollRunId: string;
  payrollRunEmployeeId: string;
  timesheetEntryId: string;
  workedDate: string;
  weekdayType: string;
  hours: number;
  createdAt: string;
}

export interface PayrollRunLog {
  id: string;
  payrollRunId: string;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  actionType: string;
  level: string;
  message: string;
  detailJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  runCode: string;
  status: string;
  postingStatus: string;
  validationMode: string;
  startedAt: string;
  completedAt?: string | null;
  totalEmployees: number;
  includedEmployees: number;
  excludedEmployees: number;
  blockedEmployees: number;
  warningCount: number;
  errorCount: number;
  totalRegularPay: number;
  totalOvertimePay: number;
  totalGrossPay: number;
  payrollBatchId?: string | null;
  payrollBatch?: PayrollBatch | null;
  notifications?: PayrollRunNotification[];
  employees?: PayrollRunEmployee[];
  // F2.4 — stitched-on collections (only present in getPayrollRunDetail).
  logs?: PayrollRunLog[];
  adjustments?: PayrollAdjustment[];
  calculations?: PayrollCalculationDetail[];
  timesheetLinks?: PayrollRunTimesheetLink[];
}

export interface SalaryProfile {
  id: string;
  userId: string;
  monthlyBaseSalary: number;
  overtimeMultiplier: number;
  currencyCode: string;
  effectiveFrom: string;
  isActive: boolean;
  user?: { id: string; name?: string | null; email?: string | null } | null;
}

// ── Payload shapes for write endpoints ────────────────────────────────

export interface UpsertScheduleInput {
  id?: string;
  code?: string;
  name?: string;
  executionRule?: 'day_of_month' | 'last_working_day';
  dayOfMonth?: number | null;
  validationMode?: 'review_before_posting' | 'automatic_posting';
  isActive?: boolean;
  actorUserId?: string;
  actorDisplayName?: string;
}

export interface ExecuteRunInput {
  scheduleId?: string;
  validationMode?: 'review_before_posting' | 'automatic_posting';
  triggerType?: 'manual' | 'scheduled';
  periodStart?: string;
  periodEnd?: string;
  payoutDate?: string | null;
  currencyCode?: string;
  actorUserId?: string;
  actorDisplayName?: string;
}

export interface PostRunInput {
  registerProofReference?: string;
  notes?: string;
  actorUserId?: string;
  actorDisplayName?: string;
}

export interface AdjustEmployeeInput {
  adjustedAmount: number;
  reason: string;
  comment?: string;
  actorUserId?: string;
  actorDisplayName?: string;
}

export interface UpsertSalaryProfileInput {
  id?: string;
  userId: string;
  monthlyBaseSalary: number;
  overtimeMultiplier?: number;
  currencyCode?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  actorUserId?: string;
  actorDisplayName?: string;
}

export interface ApproveBatchInput {
  registerProofReference?: string;
  actorUserId?: string;
  actorDisplayName?: string;
  notes?: string;
}

export interface ReconcileBatchInput {
  notes?: string;
  actorUserId?: string;
  actorDisplayName?: string;
}

export interface DisburseLineInput {
  proofReference?: string;
  paymentDate?: string;
  actorUserId?: string;
  actorDisplayName?: string;
}
