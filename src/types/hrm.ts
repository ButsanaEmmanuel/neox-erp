// ─── HRM Module Types ─────────────────────────────────────────────

// ─── Audit / Activity Log ─────────────────────────────────────────
export interface ActivityEntry {
    id: string;
    who: string;       // role label or name
    action: string;    // human-readable description
    timestamp: string; // ISO
    entityId?: string; // related entity id
}

export type HRMRole = 'staff' | 'manager' | 'hr';
export type AuthorityLevel = 'OBSERVER' | 'CONTRIBUTOR' | 'MANAGER' | 'ADMIN';

// ─── Employment ───────────────────────────────────────────────────
export type EmploymentType = 'employee' | 'contractor';
export type EmploymentStatus = 'active' | 'onboarding' | 'offboarding' | 'inactive';
export type EmploymentCreationSource = 'IMPORT' | 'RECRUITMENT' | 'MANUAL';
export type ContractType = 'CDD' | 'CDI';
export type ContractStatus = 'active' | 'probation' | 'confirmed' | 'ended' | 'terminated';
export type AccessStatus = 'invited' | 'active' | 'disabled' | 'pending_activation';
export type CompensationFrequency = 'monthly' | 'annual' | 'hourly';
export type CompensationType = 'base_salary' | 'allowance' | 'contract_fee';

export interface EmploymentProfile {
    id: string;
    personId: string;
    employeeCode: string;
    employmentType: EmploymentType;
    status: EmploymentStatus;
    departmentId?: string;
    roleTitle: string;
    managerPersonId?: string;
    startDate: string;
    endDate?: string;
    contractType?: ContractType;
    contractStatus?: ContractStatus;
    probationEndDate?: string;
    confirmationDate?: string;
    terminationReason?: string;
    workLocation?: string;
    locationId?: string; // Link to SCM Location
    costCenter?: string;
    compensation?: {
        currency: string;
        amount: number;
        frequency: 'annual' | 'monthly' | 'hourly';
    };
    createdAt: string;
    updatedAt: string;
    // Embedded person fields (self-contained, no PeopleContext dependency)
    name?: string;
    email?: string;
    phone?: string;
    avatarColor?: string;
    // System Access
    hasSystemAccess?: boolean;
    accessStatus?: AccessStatus;
    systemRole?: string;
    authorityLevel: AuthorityLevel;
    creationSource?: EmploymentCreationSource;
    requiresAdminReview?: boolean;
    reviewNotes?: string[];
    compensationType?: CompensationType;
    compensationEffectiveDate?: string;
    compensationNotes?: string;
    baseSalary?: number;
    salaryCurrency?: string;
    paymentFrequency?: CompensationFrequency;
    salaryHistory?: Array<{
        changedAt: string;
        changedBy?: string;
        oldAmount?: number | null;
        newAmount?: number | null;
        oldCurrency?: string | null;
        newCurrency?: string | null;
        oldFrequency?: CompensationFrequency | null;
        newFrequency?: CompensationFrequency | null;
        note?: string;
    }>;
    modulePermissions?: Record<string, {
        enabled: boolean;
        role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
        actions: string[];
    }>;
    latestCredential?: {
        id: string;
        username: string;
        temporaryPassword: string;
        status: string;
        generatedAt: string;
        sentAt?: string;
    };
}


export interface Department {
    id: string;
    name: string;
    managerPersonId?: string;
    parentId?: string;
    description?: string;
    defaultOnboardingTemplateId?: string;
    defaultOffboardingTemplateId?: string;
}

export interface CreateEmploymentPayload {
    personId: string;
    employeeCode: string;
    employmentType: EmploymentType;
    roleTitle: string;
    departmentId?: string;
    managerPersonId?: string;
    startDate: string;
    endDate?: string;
    contractType?: ContractType;
    contractStatus?: ContractStatus;
    probationEndDate?: string;
    confirmationDate?: string;
    terminationReason?: string;
    workLocation?: string;
    locationId?: string;
    status?: EmploymentStatus;
    compensation?: {
        currency: string;
        amount: number;
        frequency: CompensationFrequency;
    };
    compensationType?: CompensationType;
    compensationEffectiveDate?: string;
    compensationNotes?: string;
    accessStatus?: AccessStatus;
    // Embedded person fields
    name?: string;
    email?: string;
    phone?: string;
    avatarColor?: string;
    hasSystemAccess?: boolean;
    systemRole?: string;
    authorityLevel?: AuthorityLevel;
    creationSource?: EmploymentCreationSource;
    requiresAdminReview?: boolean;
    reviewNotes?: string[];
    modulePermissions?: Record<string, {
        enabled: boolean;
        role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
        actions: string[];
    }>;
}

export interface UpdateEmploymentPayload extends Partial<Omit<CreateEmploymentPayload, 'personId'>> {
    id: string;
}

// ─── Onboarding ───────────────────────────────────────────────────
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';
export type TaskOwner = 'employee' | 'manager' | 'hr' | 'it';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface OnboardingTask {
    id: string;
    title: string;
    owner: TaskOwner;
    status: TaskStatus;
    dueDate: string;
    notes?: string;
    required: boolean;
    assigneeId?: string;
}

export interface OnboardingPlan {
    id: string;
    employeeId: string;
    employeeName: string;
    templateId?: string;
    status: OnboardingStatus;
    tasks: OnboardingTask[];
    progress: number; // 0–100
    startDate: string;
    targetDate: string;
    dueDate?: string;
    department: string;
    activityLog: ActivityEntry[];
}

// ─── Onboarding Templates ────────────────────────────────────────
export interface OnboardingTaskBlueprint {
    title: string;
    ownerRole: TaskOwner;
    required: boolean;
    defaultDueDays?: number; // days after start date
}

export interface OnboardingTemplate {
    id: string;
    name: string;
    departmentId?: string; // optional default department match
    tasksBlueprint: OnboardingTaskBlueprint[];
}

// ─── Offboarding ──────────────────────────────────────────────────
export type OffboardingStatus = 'pending' | 'in_progress' | 'completed';

export type ExitReason = 'resignation' | 'termination' | 'contract_end' | 'retirement' | 'other';

export interface OffboardingTask {
    id: string;
    title: string;
    owner: TaskOwner;
    status: TaskStatus;
    required: boolean;
    notes?: string;
}

export interface OffboardingPlan {
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    exitDate: string;
    lastWorkingDay: string;
    reason: ExitReason;
    templateId?: string;
    status: OffboardingStatus;
    tasks: OffboardingTask[];
    progress: number;
    notes?: string;
}

// ─── Offboarding Templates ───────────────────────────────────────
export interface OffboardingTaskBlueprint {
    title: string;
    ownerRole: TaskOwner;
    required: boolean;
}

export interface OffboardingTemplate {
    id: string;
    name: string;
    departmentId?: string;
    tasksBlueprint: OffboardingTaskBlueprint[];
}

// ─── Recruitment / ATS ────────────────────────────────────────────
export type CandidateStage = 'sourced' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

export interface CandidateNote {
    id: string;
    author: string;
    date: string;
    text: string;
}

export interface Candidate {
    id: string;
    name: string;
    email: string;
    phone?: string;
    position: string;
    stage: CandidateStage;
    appliedDate: string;
    notes: CandidateNote[];
    avatar?: string;
    source?: string;
    daysInStage?: number;
    onboardingPending?: boolean; // hired but onboarding not yet started
    rejectionReason?: string;
    linkedEmployeeId?: string;   // set after hireCandidate()
}

// ─── Hire Offer Snapshot ──────────────────────────────────────────
export type CompensationPeriod = 'monthly' | 'annual' | 'daily' | 'hourly';
export type CompensationCurrency = 'USD' | 'CDF' | 'EUR';

export interface OfferCompensation {
    currency: CompensationCurrency;
    amount: number | null;
    period: CompensationPeriod;
}

export interface HirePayload {
    candidateId: string;
    startDate: string;           // ISO date
    departmentId?: string;
    hiringManagerId?: string;
    templateId?: string;         // OnboardingTemplate id
    offerComp?: OfferCompensation; // optional offer snapshot (not payroll)
    payrollSetupLater: boolean;    // default true
}

// ─── Timesheets ───────────────────────────────────────────────────
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TimesheetActivity {
    id: string;
    projectId: string; // e.g., 'proj-1'
    taskId?: string;   // optional
    description?: string;
    hours: { mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number };
}

export interface TimesheetWeek {
    id: string;
    employeeId: string;
    employeeName: string;
    weekStart: string; // ISO Date of Monday
    status: TimesheetStatus;
    activities: TimesheetActivity[];
    total: number;
    comment?: string;
    reviewerComment?: string;
    submittedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
}

// ─── Leave ────────────────────────────────────────────────────────
export type LeaveType = 'annual' | 'sick' | 'personal' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
    id: string;
    employeeId: string;
    employeeName: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    status: LeaveStatus;
    reviewerComment?: string;
}

// ─── Training ─────────────────────────────────────────────────────
export type TrainingStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue';

export interface TrainingRecord {
    id: string;
    title: string;
    employeeId: string;
    employeeName: string;
    category: string;
    status: TrainingStatus;
    dueDate: string;
    completedDate?: string;
    certificateUrl?: string;
}

// ─── Policies ─────────────────────────────────────────────────────
export interface Policy {
    id: string;
    title: string;
    version: string;
    category: string;
    publishedDate: string;
    content: string; // markdown or plain text
    acknowledged: boolean;
    acknowledgedDate?: string;
}

// ─── Cases (Employee Relations) ───────────────────────────────────
export type CaseStatus = 'open' | 'investigating' | 'resolved';
export type CasePriority = 'low' | 'medium' | 'high';

export interface CaseNote {
    id: string;
    author: string;
    date: string;
    text: string;
}

export interface HRCase {
    id: string;
    subject: string;
    description: string;
    status: CaseStatus;
    priority: CasePriority;
    parties: string[];
    assignee: string;
    createdDate: string;
    resolvedDate?: string;
    notes: CaseNote[];
}

// ─── Bulk Import ──────────────────────────────────────────────────
export interface EmployeeImportRow {
    rowNumber: number;
    email: string;
    payload: Omit<CreateEmploymentPayload, 'personId' | 'employeeCode'> & { name: string; email: string };
    managerEmail?: string;
    managerName?: string;
    departmentName?: string;
    contractEndDate?: string;
}

export interface DepartmentImportRow {
    rowNumber: number;
    name: string;
    description?: string;
    parentName?: string;
    managerEmail?: string;
}

export interface HRMImportValidationResult<T> {
    totalRows: number;
    validRows: T[];
    invalidRows: { row: number; identifier?: string; message: string }[];
    warnings: string[];
}

