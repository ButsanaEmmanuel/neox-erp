-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."AccessProvisioning" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'provisioned',
    "temporaryPasswordSentAt" TIMESTAMP(3),
    "forcedPasswordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "module" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "oldValueJson" JSONB,
    "newValueJson" JSONB,
    "metaJson" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "industry" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "billingAddress" TEXT,
    "country" TEXT,
    "taxRegistrationNumber" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "tagsJson" JSONB,
    "profileStatus" TEXT NOT NULL DEFAULT 'needs_completion',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "industryRefId" TEXT,
    "ownerUserId" TEXT,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CrmDeal" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'Discovery',
    "status" TEXT NOT NULL DEFAULT 'open',
    "valueAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "ownerName" TEXT,
    "closeDate" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "sourceRefId" TEXT,
    "stageRefId" TEXT,
    "statusRefId" TEXT,

    CONSTRAINT "CrmDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerInvoice" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotalAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientAccountId" TEXT,

    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiscrepancyCase" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "lineId" TEXT,
    "caseType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "expectedAmount" DECIMAL(14,2),
    "actualAmount" DECIMAL(14,2),
    "sourceModule" TEXT,
    "sourceEntity" TEXT,
    "sourceEntityId" TEXT,
    "financeEntryId" TEXT,
    "resolutionNotes" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscrepancyCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DomainEvent" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmployeeAdvance" (
    "id" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "employeeUserId" TEXT,
    "employeeName" TEXT NOT NULL,
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "payableId" TEXT,
    "paymentId" TEXT,
    "proofDocumentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmployeeSalaryProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyBaseSalary" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "overtimeMultiplier" DECIMAL(6,2) NOT NULL DEFAULT 1.50,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalaryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExpenseClaim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "employeeUserId" TEXT,
    "employeeName" TEXT NOT NULL,
    "categoryCode" TEXT,
    "description" TEXT,
    "expenseDate" TIMESTAMP(3),
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "payableId" TEXT,
    "paymentId" TEXT,
    "proofDocumentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceActivity" (
    "id" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorDisplayName" TEXT,
    "actionType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValueJson" JSONB,
    "newValueJson" JSONB,
    "message" TEXT NOT NULL,
    "eventSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceApproval" (
    "id" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorDisplayName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceApprovalThreshold" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "minAmount" DECIMAL(14,2) NOT NULL,
    "maxAmount" DECIMAL(14,2),
    "requiredRole" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceApprovalThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceCategorySetting" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategorySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceEntry" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "memo" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(14,2) NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEntity" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "sourceEvent" TEXT NOT NULL,
    "sourceEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "workItemId" TEXT,
    "companyName" TEXT,
    "accountCode" TEXT,
    "categoryCode" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'draft',
    "evidenceStatus" TEXT NOT NULL DEFAULT 'required_missing',
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "settlementStatus" TEXT NOT NULL DEFAULT 'open',
    "expectedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "settledAt" TIMESTAMP(3),
    "validationMessage" TEXT,
    "metadataJson" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "clientAccountId" TEXT,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceEntrySourceLink" (
    "id" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEntity" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "sourceEvent" TEXT NOT NULL,
    "sourceField" TEXT,
    "sourceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEntrySourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceEvidenceDocument" (
    "id" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedByName" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'supporting_document',
    "validationStatus" TEXT NOT NULL DEFAULT 'submitted',
    "checksum" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FinanceEvidenceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceEvidenceRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "requiredDocsJson" JSONB NOT NULL,
    "minCount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEvidenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceLedgerMapping" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEntity" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLedgerMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceNumberingScheme" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "yearIncluded" BOOLEAN NOT NULL DEFAULT true,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceNumberingScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinancePaymentMethodSetting" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "requiresProof" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePaymentMethodSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceReconciliation" (
    "id" TEXT NOT NULL,
    "reconciliationCode" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'completed',
    "runByUserId" TEXT,
    "runByName" TEXT,
    "summaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FinanceReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HrmCase" (
    "id" TEXT NOT NULL,
    "caseType" TEXT NOT NULL DEFAULT 'inquiry',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "statusCode" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HrmCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HrmCaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "authorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrmCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HrmCredentialProvisioning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employmentProfileId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "temporaryPassword" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'generated',
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrmCredentialProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HrmEmploymentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL DEFAULT 'employee',
    "statusCode" TEXT NOT NULL DEFAULT 'active',
    "roleTitle" TEXT NOT NULL,
    "managerUserId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "workLocation" TEXT,
    "authorityLevel" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
    "creationSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "requiresAdminReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewNotesJson" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "compensationAmount" DECIMAL(18,2),
    "compensationCurrency" TEXT DEFAULT 'USD',
    "compensationEffectiveDate" TIMESTAMP(3),
    "compensationFrequency" TEXT DEFAULT 'monthly',
    "compensationNotes" TEXT,
    "compensationType" TEXT DEFAULT 'base_salary',
    "confirmationDate" TIMESTAMP(3),
    "contractStatus" TEXT NOT NULL DEFAULT 'active',
    "contractType" TEXT NOT NULL DEFAULT 'CDI',
    "probationEndDate" TIMESTAMP(3),
    "systemAccessStatus" TEXT NOT NULL DEFAULT 'pending_activation',
    "terminationReason" TEXT,

    CONSTRAINT "HrmEmploymentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HrmPolicy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "statusCode" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HrmPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobPosting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "statusCode" TEXT NOT NULL DEFAULT 'draft',
    "closingDate" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated" DECIMAL(6,2) NOT NULL,
    "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "pending" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carryOver" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeavePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "daysPerYear" DECIMAL(5,2) NOT NULL,
    "carryOverMax" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "noticeDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "statusCode" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "ownerId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MilestoneDependency" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OffboardingChecklist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'in_progress',
    "completedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OffboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OffboardingChecklistTask" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'pending',
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "OffboardingChecklistTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OffboardingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OffboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OffboardingTemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
    "assignedRole" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OffboardingTemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OnboardingChecklist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'in_progress',
    "completedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OnboardingChecklistTask" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'pending',
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "OnboardingChecklistTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OnboardingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OnboardingTemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
    "assignedRole" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OnboardingTemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payable" (
    "id" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "vendorName" TEXT,
    "projectId" TEXT,
    "workItemId" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "outstandingAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending_payment',
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT true,
    "lastPaidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentDisbursement" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "status" TEXT NOT NULL DEFAULT 'processing',
    "proofDocumentId" TEXT,
    "notes" TEXT,
    "executedByUserId" TEXT,
    "executedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollRunEmployeeId" TEXT NOT NULL,
    "originalAmount" DECIMAL(14,2) NOT NULL,
    "adjustedAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "adjustedByUserId" TEXT,
    "adjustedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollBatch" (
    "id" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payoutDate" TIMESTAMP(3),
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "registerDocumentId" TEXT,
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollCalculationDetail" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollRunEmployeeId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleDescription" TEXT,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollCalculationDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollDisbursementLine" (
    "id" TEXT NOT NULL,
    "payrollBatchId" TEXT NOT NULL,
    "employeeUserId" TEXT,
    "employeeCode" TEXT,
    "employeeName" TEXT NOT NULL,
    "bankAccountRef" TEXT,
    "netAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "allowanceAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payableId" TEXT,
    "paymentId" TEXT,
    "proofDocumentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDisbursementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollNotification" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "recipientRole" TEXT,
    "recipientUserId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollPeriod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollRun" (
    "id" TEXT NOT NULL,
    "runCode" TEXT NOT NULL,
    "payrollScheduleId" TEXT,
    "payrollPeriodId" TEXT NOT NULL,
    "payrollBatchId" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "postingCompletedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "validationMode" TEXT NOT NULL DEFAULT 'review_before_posting',
    "postingStatus" TEXT NOT NULL DEFAULT 'pending_validation',
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "includedEmployees" INTEGER NOT NULL DEFAULT 0,
    "excludedEmployees" INTEGER NOT NULL DEFAULT 0,
    "blockedEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalRegularPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalOvertimePay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalGrossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "startedByUserId" TEXT,
    "startedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollRunEmployee" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "salaryProfileId" TEXT,
    "inclusionStatus" TEXT NOT NULL DEFAULT 'included',
    "exclusionReason" TEXT,
    "regularWorkedDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "weekendWorkedDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "standardWorkingDays" INTEGER NOT NULL DEFAULT 0,
    "dailyRate" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "overtimeMultiplier" DECIMAL(6,2) NOT NULL DEFAULT 1.50,
    "regularPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overtimePay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustedGrossPay" DECIMAL(14,2),
    "payrollLineId" TEXT,
    "payableId" TEXT,
    "warningJson" JSONB,
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRunEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollRunLog" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorDisplayName" TEXT,
    "actionType" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollRunTimesheetLink" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollRunEmployeeId" TEXT NOT NULL,
    "timesheetEntryId" TEXT NOT NULL,
    "workedDate" TIMESTAMP(3) NOT NULL,
    "weekdayType" TEXT NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRunTimesheetLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollSchedule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "executionRule" TEXT NOT NULL,
    "dayOfMonth" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "validationMode" TEXT NOT NULL DEFAULT 'review_before_posting',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollScheduleHistory" (
    "id" TEXT NOT NULL,
    "payrollScheduleId" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "changedByName" TEXT,
    "changeType" TEXT NOT NULL,
    "oldValueJson" JSONB,
    "newValueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollScheduleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PolicyAcknowledgement" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "PolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "managerId" TEXT NOT NULL,
    "ownerDepartmentId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "bulkImportRequired" BOOLEAN NOT NULL DEFAULT false,
    "isTelecomProject" BOOLEAN NOT NULL DEFAULT false,
    "projectCategory" TEXT,
    "projectMode" TEXT NOT NULL DEFAULT 'standard',
    "purchaseOrder" TEXT,
    "clientAccountId" TEXT,
    "costHT" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costTTC" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(7,4) NOT NULL DEFAULT 16,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectImportBatch" (
    "id" TEXT NOT NULL,
    "parentProjectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorSummary" TEXT,

    CONSTRAINT "ProjectImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectItemActivity" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'project_item',
    "entityId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorDisplayName" TEXT,
    "actionType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValueJson" JSONB,
    "newValueJson" JSONB,
    "message" TEXT NOT NULL,
    "eventSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectItemActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectItemFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedByName" TEXT,
    "category" TEXT DEFAULT 'other',
    "visibility" TEXT DEFAULT 'private',
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectItemFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectItemState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "poUnitPrice" DECIMAL(14,2),
    "ticketNumber" DECIMAL(14,2),
    "qaStatus" TEXT DEFAULT 'pending',
    "acceptanceStatus" TEXT DEFAULT 'pending',
    "operationalManualFieldsJson" JSONB,
    "acceptanceManualFieldsJson" JSONB,
    "importedFieldsJson" JSONB,
    "planningAuditDate" TIMESTAMP(3),
    "planningAuditWeek" INTEGER,
    "forecastDate" TIMESTAMP(3),
    "forecastWeek" INTEGER,
    "actualAuditDate" TIMESTAMP(3),
    "actualAuditWeek" INTEGER,
    "startVarianceDays" INTEGER,
    "scheduleStatus" TEXT,
    "isDelayed" BOOLEAN NOT NULL DEFAULT false,
    "poUnitPriceCompleted" DECIMAL(14,2),
    "contractorPayableAmount" DECIMAL(14,2),
    "isFinanciallyEligible" BOOLEAN NOT NULL DEFAULT false,
    "financialEligibilityReason" TEXT,
    "financeSyncStatus" TEXT DEFAULT 'blocked',
    "financeSyncAt" TIMESTAMP(3),
    "financeReferenceId" TEXT,
    "financeErrorMessage" TEXT,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectItemState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectScope" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objectives" JSONB NOT NULL DEFAULT '[]',
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "outOfScope" JSONB NOT NULL DEFAULT '[]',
    "assumptions" JSONB NOT NULL DEFAULT '[]',
    "constraints" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "ProjectScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterDepartmentId" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'draft',
    "justification" TEXT,
    "totalAmount" DECIMAL(14,2),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReceiptCollection" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "receiptReference" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "status" TEXT NOT NULL DEFAULT 'processing',
    "proofDocumentId" TEXT,
    "notes" TEXT,
    "receivedByUserId" TEXT,
    "receivedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Receivable" (
    "id" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "clientName" TEXT,
    "projectId" TEXT,
    "workItemId" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "outstandingAmount" DECIMAL(14,2) NOT NULL,
    "collectedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "collectionStatus" TEXT NOT NULL DEFAULT 'pending_collection',
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "lastCollectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientAccountId" TEXT,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReconciliationLine" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "referenceCode" TEXT,
    "sourceModule" TEXT,
    "sourceEntity" TEXT,
    "sourceEntityId" TEXT,
    "financeEntryId" TEXT,
    "expectedAmount" DECIMAL(14,2),
    "actualAmount" DECIMAL(14,2),
    "proofPresent" BOOLEAN NOT NULL DEFAULT false,
    "matchStatus" TEXT NOT NULL DEFAULT 'auto_matched',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecruitmentCandidate" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "personalEmail" TEXT NOT NULL,
    "phone" TEXT,
    "position" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'sourced',
    "recruitmentDepartmentId" TEXT NOT NULL,
    "hiredUserId" TEXT,
    "hiredAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "jobPostingId" TEXT,
    "interviewDate" TIMESTAMP(3),
    "offerDate" TIMESTAMP(3),
    "offerAmount" DECIMAL(14,2),
    "offerCurrency" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "RecruitmentCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResourceStakeholder" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stakeholderRole" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceStakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "scopeType" TEXT,
    "scopeValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TimesheetEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "statusCode" TEXT NOT NULL DEFAULT 'submitted',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "projectId" TEXT,
    "weekStartDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "reviewerComment" TEXT,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingCourse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT,
    "category" TEXT,
    "durationHours" INTEGER,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'enrolled',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "certificate" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3),
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "departmentId" TEXT,
    "hasSystemAccess" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "jobTitle" TEXT,
    "notifyCrm" BOOLEAN NOT NULL DEFAULT true,
    "notifyFinance" BOOLEAN NOT NULL DEFAULT true,
    "notifyProjects" BOOLEAN NOT NULL DEFAULT true,
    "phoneNumber" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'fr',
    "quickStatus" TEXT NOT NULL DEFAULT 'online',
    "supervisorId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPermissionSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "effect" TEXT NOT NULL DEFAULT 'allow',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "permissionId" TEXT,
    "assignedBy" TEXT,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserPermissionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VendorBill" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotalAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'received',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'task',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignee" TEXT,
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "qaStatus" TEXT DEFAULT 'pending',
    "qaDate" TIMESTAMP(3),
    "acceptanceStatus" TEXT DEFAULT 'pending',
    "acceptanceDate" TIMESTAMP(3),
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "acceptanceManualFieldsJson" JSONB,
    "contractorPayableAmount" DECIMAL(14,2),
    "financeErrorMessage" TEXT,
    "financeReferenceId" TEXT,
    "financeSyncAt" TIMESTAMP(3),
    "financeSyncStatus" TEXT DEFAULT 'pending',
    "financialEligibilityReason" TEXT,
    "importBatchId" TEXT,
    "importedFieldsJson" JSONB,
    "isFinanciallyEligible" BOOLEAN NOT NULL DEFAULT false,
    "manualCompletionStatus" TEXT DEFAULT 'pending',
    "operationalManualFieldsJson" JSONB,
    "poUnitPrice" DECIMAL(14,2),
    "poUnitPriceCompleted" DECIMAL(14,2),
    "ticketNumber" DECIMAL(14,2),

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkflowStatus" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkflowTransition" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "fromStatusId" TEXT NOT NULL,
    "toStatusId" TEXT NOT NULL,
    "requiredPermissionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crm_ref_activity_types" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_ref_activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crm_ref_industries" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_ref_industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crm_ref_pipeline_stages" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_ref_pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crm_ref_sources" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_ref_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crm_ref_statuses" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_ref_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessProvisioning_candidateId_userId_key" ON "public"."AccessProvisioning"("candidateId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "AccessProvisioning_statusCode_idx" ON "public"."AccessProvisioning"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_module_entity_entityId_idx" ON "public"."AuditLog"("module" ASC, "entity" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "public"."AuditLog"("occurredAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_txId_idx" ON "public"."AuditLog"("txId" ASC);

-- CreateIndex
CREATE INDEX "ClientAccount_email_idx" ON "public"."ClientAccount"("email" ASC);

-- CreateIndex
CREATE INDEX "ClientAccount_industryRefId_idx" ON "public"."ClientAccount"("industryRefId" ASC);

-- CreateIndex
CREATE INDEX "ClientAccount_isDeleted_idx" ON "public"."ClientAccount"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "ClientAccount_name_idx" ON "public"."ClientAccount"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccount_normalizedName_key" ON "public"."ClientAccount"("normalizedName" ASC);

-- CreateIndex
CREATE INDEX "ClientAccount_ownerUserId_idx" ON "public"."ClientAccount"("ownerUserId" ASC);

-- CreateIndex
CREATE INDEX "ClientAccount_taxRegistrationNumber_idx" ON "public"."ClientAccount"("taxRegistrationNumber" ASC);

-- CreateIndex
CREATE INDEX "CrmDeal_clientAccountId_idx" ON "public"."CrmDeal"("clientAccountId" ASC);

-- CreateIndex
CREATE INDEX "CrmDeal_isDeleted_idx" ON "public"."CrmDeal"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "CrmDeal_ownerUserId_idx" ON "public"."CrmDeal"("ownerUserId" ASC);

-- CreateIndex
CREATE INDEX "CrmDeal_sourceRefId_idx" ON "public"."CrmDeal"("sourceRefId" ASC);

-- CreateIndex
CREATE INDEX "CrmDeal_stageRefId_idx" ON "public"."CrmDeal"("stageRefId" ASC);

-- CreateIndex
CREATE INDEX "CrmDeal_statusRefId_idx" ON "public"."CrmDeal"("statusRefId" ASC);

-- CreateIndex
CREATE INDEX "CrmDeal_status_idx" ON "public"."CrmDeal"("status" ASC);

-- CreateIndex
CREATE INDEX "CustomerInvoice_clientAccountId_idx" ON "public"."CustomerInvoice"("clientAccountId" ASC);

-- CreateIndex
CREATE INDEX "CustomerInvoice_dueDate_idx" ON "public"."CustomerInvoice"("dueDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_invoiceNumber_key" ON "public"."CustomerInvoice"("invoiceNumber" ASC);

-- CreateIndex
CREATE INDEX "CustomerInvoice_receivableId_status_idx" ON "public"."CustomerInvoice"("receivableId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "public"."Department"("code" ASC);

-- CreateIndex
CREATE INDEX "Department_isDeleted_idx" ON "public"."Department"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "DiscrepancyCase_caseType_idx" ON "public"."DiscrepancyCase"("caseType" ASC);

-- CreateIndex
CREATE INDEX "DiscrepancyCase_reconciliationId_status_idx" ON "public"."DiscrepancyCase"("reconciliationId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "DomainEvent_eventType_idx" ON "public"."DomainEvent"("eventType" ASC);

-- CreateIndex
CREATE INDEX "DomainEvent_publishedAt_idx" ON "public"."DomainEvent"("publishedAt" ASC);

-- CreateIndex
CREATE INDEX "DomainEvent_txId_idx" ON "public"."DomainEvent"("txId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAdvance_advanceNumber_key" ON "public"."EmployeeAdvance"("advanceNumber" ASC);

-- CreateIndex
CREATE INDEX "EmployeeAdvance_approvalStatus_idx" ON "public"."EmployeeAdvance"("approvalStatus" ASC);

-- CreateIndex
CREATE INDEX "EmployeeAdvance_employeeUserId_idx" ON "public"."EmployeeAdvance"("employeeUserId" ASC);

-- CreateIndex
CREATE INDEX "EmployeeAdvance_payableId_idx" ON "public"."EmployeeAdvance"("payableId" ASC);

-- CreateIndex
CREATE INDEX "EmployeeAdvance_status_idx" ON "public"."EmployeeAdvance"("status" ASC);

-- CreateIndex
CREATE INDEX "EmployeeSalaryProfile_effectiveFrom_effectiveTo_idx" ON "public"."EmployeeSalaryProfile"("effectiveFrom" ASC, "effectiveTo" ASC);

-- CreateIndex
CREATE INDEX "EmployeeSalaryProfile_userId_isActive_idx" ON "public"."EmployeeSalaryProfile"("userId" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "ExpenseClaim_approvalStatus_idx" ON "public"."ExpenseClaim"("approvalStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_claimNumber_key" ON "public"."ExpenseClaim"("claimNumber" ASC);

-- CreateIndex
CREATE INDEX "ExpenseClaim_employeeUserId_idx" ON "public"."ExpenseClaim"("employeeUserId" ASC);

-- CreateIndex
CREATE INDEX "ExpenseClaim_payableId_idx" ON "public"."ExpenseClaim"("payableId" ASC);

-- CreateIndex
CREATE INDEX "ExpenseClaim_status_idx" ON "public"."ExpenseClaim"("status" ASC);

-- CreateIndex
CREATE INDEX "FinanceActivity_eventSource_idx" ON "public"."FinanceActivity"("eventSource" ASC);

-- CreateIndex
CREATE INDEX "FinanceActivity_financeEntryId_createdAt_idx" ON "public"."FinanceActivity"("financeEntryId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "FinanceApproval_financeEntryId_createdAt_idx" ON "public"."FinanceApproval"("financeEntryId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "FinanceApproval_status_idx" ON "public"."FinanceApproval"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceApprovalThreshold_code_key" ON "public"."FinanceApprovalThreshold"("code" ASC);

-- CreateIndex
CREATE INDEX "FinanceApprovalThreshold_isActive_idx" ON "public"."FinanceApprovalThreshold"("isActive" ASC);

-- CreateIndex
CREATE INDEX "FinanceApprovalThreshold_requiredRole_idx" ON "public"."FinanceApprovalThreshold"("requiredRole" ASC);

-- CreateIndex
CREATE INDEX "FinanceApprovalThreshold_transactionType_idx" ON "public"."FinanceApprovalThreshold"("transactionType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategorySetting_code_key" ON "public"."FinanceCategorySetting"("code" ASC);

-- CreateIndex
CREATE INDEX "FinanceCategorySetting_direction_idx" ON "public"."FinanceCategorySetting"("direction" ASC);

-- CreateIndex
CREATE INDEX "FinanceCategorySetting_isActive_idx" ON "public"."FinanceCategorySetting"("isActive" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntry_approvalStatus_idx" ON "public"."FinanceEntry"("approvalStatus" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntry_clientAccountId_idx" ON "public"."FinanceEntry"("clientAccountId" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntry_evidenceStatus_idx" ON "public"."FinanceEntry"("evidenceStatus" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntry_isDeleted_idx" ON "public"."FinanceEntry"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntry_lifecycleStatus_idx" ON "public"."FinanceEntry"("lifecycleStatus" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntry_projectId_workItemId_idx" ON "public"."FinanceEntry"("projectId" ASC, "workItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_referenceCode_key" ON "public"."FinanceEntry"("referenceCode" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntry_settlementStatus_idx" ON "public"."FinanceEntry"("settlementStatus" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntry_sourceModule_sourceEntity_sourceEntityId_idx" ON "public"."FinanceEntry"("sourceModule" ASC, "sourceEntity" ASC, "sourceEntityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntrySourceLink_financeEntryId_sourceModule_sourceEn_key" ON "public"."FinanceEntrySourceLink"("financeEntryId" ASC, "sourceModule" ASC, "sourceEntity" ASC, "sourceEntityId" ASC, "sourceEvent" ASC);

-- CreateIndex
CREATE INDEX "FinanceEntrySourceLink_sourceModule_sourceEntity_sourceEnti_idx" ON "public"."FinanceEntrySourceLink"("sourceModule" ASC, "sourceEntity" ASC, "sourceEntityId" ASC);

-- CreateIndex
CREATE INDEX "FinanceEvidenceDocument_deletedAt_idx" ON "public"."FinanceEvidenceDocument"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "FinanceEvidenceDocument_financeEntryId_createdAt_idx" ON "public"."FinanceEvidenceDocument"("financeEntryId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "FinanceEvidenceDocument_validationStatus_idx" ON "public"."FinanceEvidenceDocument"("validationStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEvidenceRule_code_key" ON "public"."FinanceEvidenceRule"("code" ASC);

-- CreateIndex
CREATE INDEX "FinanceEvidenceRule_isActive_idx" ON "public"."FinanceEvidenceRule"("isActive" ASC);

-- CreateIndex
CREATE INDEX "FinanceEvidenceRule_transactionType_idx" ON "public"."FinanceEvidenceRule"("transactionType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLedgerMapping_code_key" ON "public"."FinanceLedgerMapping"("code" ASC);

-- CreateIndex
CREATE INDEX "FinanceLedgerMapping_direction_idx" ON "public"."FinanceLedgerMapping"("direction" ASC);

-- CreateIndex
CREATE INDEX "FinanceLedgerMapping_isActive_idx" ON "public"."FinanceLedgerMapping"("isActive" ASC);

-- CreateIndex
CREATE INDEX "FinanceLedgerMapping_sourceModule_sourceEntity_idx" ON "public"."FinanceLedgerMapping"("sourceModule" ASC, "sourceEntity" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceNumberingScheme_code_key" ON "public"."FinanceNumberingScheme"("code" ASC);

-- CreateIndex
CREATE INDEX "FinanceNumberingScheme_isActive_idx" ON "public"."FinanceNumberingScheme"("isActive" ASC);

-- CreateIndex
CREATE INDEX "FinanceNumberingScheme_targetType_idx" ON "public"."FinanceNumberingScheme"("targetType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinancePaymentMethodSetting_code_key" ON "public"."FinancePaymentMethodSetting"("code" ASC);

-- CreateIndex
CREATE INDEX "FinancePaymentMethodSetting_direction_idx" ON "public"."FinancePaymentMethodSetting"("direction" ASC);

-- CreateIndex
CREATE INDEX "FinancePaymentMethodSetting_isActive_idx" ON "public"."FinancePaymentMethodSetting"("isActive" ASC);

-- CreateIndex
CREATE INDEX "FinanceReconciliation_createdAt_idx" ON "public"."FinanceReconciliation"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReconciliation_reconciliationCode_key" ON "public"."FinanceReconciliation"("reconciliationCode" ASC);

-- CreateIndex
CREATE INDEX "FinanceReconciliation_status_idx" ON "public"."FinanceReconciliation"("status" ASC);

-- CreateIndex
CREATE INDEX "HrmCase_assignedToUserId_idx" ON "public"."HrmCase"("assignedToUserId" ASC);

-- CreateIndex
CREATE INDEX "HrmCase_caseType_idx" ON "public"."HrmCase"("caseType" ASC);

-- CreateIndex
CREATE INDEX "HrmCase_isDeleted_idx" ON "public"."HrmCase"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "HrmCase_priority_idx" ON "public"."HrmCase"("priority" ASC);

-- CreateIndex
CREATE INDEX "HrmCase_reportedByUserId_idx" ON "public"."HrmCase"("reportedByUserId" ASC);

-- CreateIndex
CREATE INDEX "HrmCase_statusCode_idx" ON "public"."HrmCase"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "HrmCaseEvent_authorUserId_idx" ON "public"."HrmCaseEvent"("authorUserId" ASC);

-- CreateIndex
CREATE INDEX "HrmCaseEvent_caseId_idx" ON "public"."HrmCaseEvent"("caseId" ASC);

-- CreateIndex
CREATE INDEX "HrmCaseEvent_createdAt_idx" ON "public"."HrmCaseEvent"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "HrmCredentialProvisioning_employmentProfileId_idx" ON "public"."HrmCredentialProvisioning"("employmentProfileId" ASC);

-- CreateIndex
CREATE INDEX "HrmCredentialProvisioning_statusCode_idx" ON "public"."HrmCredentialProvisioning"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "HrmCredentialProvisioning_userId_idx" ON "public"."HrmCredentialProvisioning"("userId" ASC);

-- CreateIndex
CREATE INDEX "HrmEmploymentProfile_contractType_idx" ON "public"."HrmEmploymentProfile"("contractType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HrmEmploymentProfile_employeeCode_key" ON "public"."HrmEmploymentProfile"("employeeCode" ASC);

-- CreateIndex
CREATE INDEX "HrmEmploymentProfile_employmentType_idx" ON "public"."HrmEmploymentProfile"("employmentType" ASC);

-- CreateIndex
CREATE INDEX "HrmEmploymentProfile_isDeleted_idx" ON "public"."HrmEmploymentProfile"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "HrmEmploymentProfile_managerUserId_idx" ON "public"."HrmEmploymentProfile"("managerUserId" ASC);

-- CreateIndex
CREATE INDEX "HrmEmploymentProfile_statusCode_idx" ON "public"."HrmEmploymentProfile"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "HrmEmploymentProfile_systemAccessStatus_idx" ON "public"."HrmEmploymentProfile"("systemAccessStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HrmEmploymentProfile_userId_key" ON "public"."HrmEmploymentProfile"("userId" ASC);

-- CreateIndex
CREATE INDEX "HrmPolicy_category_idx" ON "public"."HrmPolicy"("category" ASC);

-- CreateIndex
CREATE INDEX "HrmPolicy_createdByUserId_idx" ON "public"."HrmPolicy"("createdByUserId" ASC);

-- CreateIndex
CREATE INDEX "HrmPolicy_isDeleted_idx" ON "public"."HrmPolicy"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "HrmPolicy_statusCode_idx" ON "public"."HrmPolicy"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "JobPosting_departmentId_idx" ON "public"."JobPosting"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "JobPosting_isDeleted_idx" ON "public"."JobPosting"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "JobPosting_statusCode_idx" ON "public"."JobPosting"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "LeaveBalance_userId_idx" ON "public"."LeaveBalance"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_userId_policyId_year_key" ON "public"."LeaveBalance"("userId" ASC, "policyId" ASC, "year" ASC);

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "public"."LeaveBalance"("year" ASC);

-- CreateIndex
CREATE INDEX "LeavePolicy_isActive_idx" ON "public"."LeavePolicy"("isActive" ASC);

-- CreateIndex
CREATE INDEX "LeavePolicy_isDeleted_idx" ON "public"."LeavePolicy"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "LeavePolicy_leaveType_idx" ON "public"."LeavePolicy"("leaveType" ASC);

-- CreateIndex
CREATE INDEX "LeaveRequest_isDeleted_idx" ON "public"."LeaveRequest"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "LeaveRequest_policyId_idx" ON "public"."LeaveRequest"("policyId" ASC);

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_endDate_idx" ON "public"."LeaveRequest"("startDate" ASC, "endDate" ASC);

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_statusCode_idx" ON "public"."LeaveRequest"("userId" ASC, "statusCode" ASC);

-- CreateIndex
CREATE INDEX "Milestone_isDeleted_idx" ON "public"."Milestone"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "Milestone_ownerId_idx" ON "public"."Milestone"("ownerId" ASC);

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "public"."Milestone"("projectId" ASC);

-- CreateIndex
CREATE INDEX "MilestoneDependency_dependsOnId_idx" ON "public"."MilestoneDependency"("dependsOnId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneDependency_milestoneId_dependsOnId_key" ON "public"."MilestoneDependency"("milestoneId" ASC, "dependsOnId" ASC);

-- CreateIndex
CREATE INDEX "MilestoneDependency_milestoneId_idx" ON "public"."MilestoneDependency"("milestoneId" ASC);

-- CreateIndex
CREATE INDEX "OffboardingChecklist_isDeleted_idx" ON "public"."OffboardingChecklist"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "OffboardingChecklist_statusCode_idx" ON "public"."OffboardingChecklist"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "OffboardingChecklist_userId_idx" ON "public"."OffboardingChecklist"("userId" ASC);

-- CreateIndex
CREATE INDEX "OffboardingChecklistTask_checklistId_idx" ON "public"."OffboardingChecklistTask"("checklistId" ASC);

-- CreateIndex
CREATE INDEX "OffboardingChecklistTask_statusCode_idx" ON "public"."OffboardingChecklistTask"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "OffboardingTemplate_departmentId_idx" ON "public"."OffboardingTemplate"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "OffboardingTemplate_isActive_idx" ON "public"."OffboardingTemplate"("isActive" ASC);

-- CreateIndex
CREATE INDEX "OffboardingTemplate_isDeleted_idx" ON "public"."OffboardingTemplate"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "OffboardingTemplateTask_templateId_idx" ON "public"."OffboardingTemplateTask"("templateId" ASC);

-- CreateIndex
CREATE INDEX "OnboardingChecklist_isDeleted_idx" ON "public"."OnboardingChecklist"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "OnboardingChecklist_statusCode_idx" ON "public"."OnboardingChecklist"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "OnboardingChecklist_userId_idx" ON "public"."OnboardingChecklist"("userId" ASC);

-- CreateIndex
CREATE INDEX "OnboardingChecklistTask_checklistId_idx" ON "public"."OnboardingChecklistTask"("checklistId" ASC);

-- CreateIndex
CREATE INDEX "OnboardingChecklistTask_statusCode_idx" ON "public"."OnboardingChecklistTask"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "OnboardingTemplate_departmentId_idx" ON "public"."OnboardingTemplate"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "OnboardingTemplate_isActive_idx" ON "public"."OnboardingTemplate"("isActive" ASC);

-- CreateIndex
CREATE INDEX "OnboardingTemplate_isDeleted_idx" ON "public"."OnboardingTemplate"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_templateId_idx" ON "public"."OnboardingTemplateTask"("templateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Payable_financeEntryId_key" ON "public"."Payable"("financeEntryId" ASC);

-- CreateIndex
CREATE INDEX "Payable_paymentStatus_idx" ON "public"."Payable"("paymentStatus" ASC);

-- CreateIndex
CREATE INDEX "Payable_projectId_workItemId_idx" ON "public"."Payable"("projectId" ASC, "workItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Payable_referenceCode_key" ON "public"."Payable"("referenceCode" ASC);

-- CreateIndex
CREATE INDEX "Payable_status_idx" ON "public"."Payable"("status" ASC);

-- CreateIndex
CREATE INDEX "PaymentDisbursement_payableId_paymentDate_idx" ON "public"."PaymentDisbursement"("payableId" ASC, "paymentDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDisbursement_paymentReference_key" ON "public"."PaymentDisbursement"("paymentReference" ASC);

-- CreateIndex
CREATE INDEX "PaymentDisbursement_status_idx" ON "public"."PaymentDisbursement"("status" ASC);

-- CreateIndex
CREATE INDEX "PayrollAdjustment_payrollRunId_payrollRunEmployeeId_created_idx" ON "public"."PayrollAdjustment"("payrollRunId" ASC, "payrollRunEmployeeId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PayrollBatch_approvalStatus_idx" ON "public"."PayrollBatch"("approvalStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollBatch_batchCode_key" ON "public"."PayrollBatch"("batchCode" ASC);

-- CreateIndex
CREATE INDEX "PayrollBatch_periodStart_periodEnd_idx" ON "public"."PayrollBatch"("periodStart" ASC, "periodEnd" ASC);

-- CreateIndex
CREATE INDEX "PayrollBatch_status_idx" ON "public"."PayrollBatch"("status" ASC);

-- CreateIndex
CREATE INDEX "PayrollCalculationDetail_payrollRunId_payrollRunEmployeeId_idx" ON "public"."PayrollCalculationDetail"("payrollRunId" ASC, "payrollRunEmployeeId" ASC);

-- CreateIndex
CREATE INDEX "PayrollDisbursementLine_employeeUserId_idx" ON "public"."PayrollDisbursementLine"("employeeUserId" ASC);

-- CreateIndex
CREATE INDEX "PayrollDisbursementLine_payableId_idx" ON "public"."PayrollDisbursementLine"("payableId" ASC);

-- CreateIndex
CREATE INDEX "PayrollDisbursementLine_payrollBatchId_idx" ON "public"."PayrollDisbursementLine"("payrollBatchId" ASC);

-- CreateIndex
CREATE INDEX "PayrollDisbursementLine_status_idx" ON "public"."PayrollDisbursementLine"("status" ASC);

-- CreateIndex
CREATE INDEX "PayrollNotification_payrollRunId_severity_createdAt_idx" ON "public"."PayrollNotification"("payrollRunId" ASC, "severity" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_code_key" ON "public"."PayrollPeriod"("code" ASC);

-- CreateIndex
CREATE INDEX "PayrollPeriod_year_month_idx" ON "public"."PayrollPeriod"("year" ASC, "month" ASC);

-- CreateIndex
CREATE INDEX "PayrollRun_payrollPeriodId_idx" ON "public"."PayrollRun"("payrollPeriodId" ASC);

-- CreateIndex
CREATE INDEX "PayrollRun_payrollScheduleId_startedAt_idx" ON "public"."PayrollRun"("payrollScheduleId" ASC, "startedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_runCode_key" ON "public"."PayrollRun"("runCode" ASC);

-- CreateIndex
CREATE INDEX "PayrollRun_status_postingStatus_idx" ON "public"."PayrollRun"("status" ASC, "postingStatus" ASC);

-- CreateIndex
CREATE INDEX "PayrollRunEmployee_payableId_idx" ON "public"."PayrollRunEmployee"("payableId" ASC);

-- CreateIndex
CREATE INDEX "PayrollRunEmployee_payrollRunId_inclusionStatus_idx" ON "public"."PayrollRunEmployee"("payrollRunId" ASC, "inclusionStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRunEmployee_payrollRunId_userId_key" ON "public"."PayrollRunEmployee"("payrollRunId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "PayrollRunLog_payrollRunId_createdAt_idx" ON "public"."PayrollRunLog"("payrollRunId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PayrollRunTimesheetLink_payrollRunId_payrollRunEmployeeId_idx" ON "public"."PayrollRunTimesheetLink"("payrollRunId" ASC, "payrollRunEmployeeId" ASC);

-- CreateIndex
CREATE INDEX "PayrollRunTimesheetLink_timesheetEntryId_idx" ON "public"."PayrollRunTimesheetLink"("timesheetEntryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSchedule_code_key" ON "public"."PayrollSchedule"("code" ASC);

-- CreateIndex
CREATE INDEX "PayrollSchedule_isActive_nextRunAt_idx" ON "public"."PayrollSchedule"("isActive" ASC, "nextRunAt" ASC);

-- CreateIndex
CREATE INDEX "PayrollScheduleHistory_payrollScheduleId_createdAt_idx" ON "public"."PayrollScheduleHistory"("payrollScheduleId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "public"."Permission"("key" ASC);

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "public"."Permission"("module" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_module_resource_action_key" ON "public"."Permission"("module" ASC, "resource" ASC, "action" ASC);

-- CreateIndex
CREATE INDEX "PolicyAcknowledgement_policyId_idx" ON "public"."PolicyAcknowledgement"("policyId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcknowledgement_policyId_userId_key" ON "public"."PolicyAcknowledgement"("policyId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "PolicyAcknowledgement_userId_idx" ON "public"."PolicyAcknowledgement"("userId" ASC);

-- CreateIndex
CREATE INDEX "Project_clientAccountId_idx" ON "public"."Project"("clientAccountId" ASC);

-- CreateIndex
CREATE INDEX "Project_isDeleted_idx" ON "public"."Project"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "Project_managerId_idx" ON "public"."Project"("managerId" ASC);

-- CreateIndex
CREATE INDEX "Project_ownerDepartmentId_idx" ON "public"."Project"("ownerDepartmentId" ASC);

-- CreateIndex
CREATE INDEX "ProjectImportBatch_parentProjectId_uploadedAt_idx" ON "public"."ProjectImportBatch"("parentProjectId" ASC, "uploadedAt" ASC);

-- CreateIndex
CREATE INDEX "ProjectImportBatch_status_idx" ON "public"."ProjectImportBatch"("status" ASC);

-- CreateIndex
CREATE INDEX "ProjectItemActivity_entityType_entityId_idx" ON "public"."ProjectItemActivity"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "ProjectItemActivity_projectId_workItemId_createdAt_idx" ON "public"."ProjectItemActivity"("projectId" ASC, "workItemId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ProjectItemFile_deletedAt_idx" ON "public"."ProjectItemFile"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "ProjectItemFile_projectId_workItemId_createdAt_idx" ON "public"."ProjectItemFile"("projectId" ASC, "workItemId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ProjectItemState_projectId_workItemId_idx" ON "public"."ProjectItemState"("projectId" ASC, "workItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectItemState_projectId_workItemId_key" ON "public"."ProjectItemState"("projectId" ASC, "workItemId" ASC);

-- CreateIndex
CREATE INDEX "ProjectMember_departmentId_idx" ON "public"."ProjectMember"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "public"."ProjectMember"("projectId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_roleCode_key" ON "public"."ProjectMember"("projectId" ASC, "userId" ASC, "roleCode" ASC);

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "public"."ProjectMember"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectScope_projectId_key" ON "public"."ProjectScope"("projectId" ASC);

-- CreateIndex
CREATE INDEX "PurchaseRequest_isDeleted_idx" ON "public"."PurchaseRequest"("isDeleted" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_requestNumber_key" ON "public"."PurchaseRequest"("requestNumber" ASC);

-- CreateIndex
CREATE INDEX "PurchaseRequest_requesterDepartmentId_idx" ON "public"."PurchaseRequest"("requesterDepartmentId" ASC);

-- CreateIndex
CREATE INDEX "PurchaseRequest_requesterUserId_idx" ON "public"."PurchaseRequest"("requesterUserId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptCollection_receiptReference_key" ON "public"."ReceiptCollection"("receiptReference" ASC);

-- CreateIndex
CREATE INDEX "ReceiptCollection_receivableId_receiptDate_idx" ON "public"."ReceiptCollection"("receivableId" ASC, "receiptDate" ASC);

-- CreateIndex
CREATE INDEX "ReceiptCollection_status_idx" ON "public"."ReceiptCollection"("status" ASC);

-- CreateIndex
CREATE INDEX "Receivable_clientAccountId_idx" ON "public"."Receivable"("clientAccountId" ASC);

-- CreateIndex
CREATE INDEX "Receivable_collectionStatus_idx" ON "public"."Receivable"("collectionStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Receivable_financeEntryId_key" ON "public"."Receivable"("financeEntryId" ASC);

-- CreateIndex
CREATE INDEX "Receivable_isOverdue_idx" ON "public"."Receivable"("isOverdue" ASC);

-- CreateIndex
CREATE INDEX "Receivable_projectId_workItemId_idx" ON "public"."Receivable"("projectId" ASC, "workItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Receivable_referenceCode_key" ON "public"."Receivable"("referenceCode" ASC);

-- CreateIndex
CREATE INDEX "Receivable_status_idx" ON "public"."Receivable"("status" ASC);

-- CreateIndex
CREATE INDEX "ReconciliationLine_matchStatus_idx" ON "public"."ReconciliationLine"("matchStatus" ASC);

-- CreateIndex
CREATE INDEX "ReconciliationLine_reconciliationId_movementType_idx" ON "public"."ReconciliationLine"("reconciliationId" ASC, "movementType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentCandidate_hiredUserId_key" ON "public"."RecruitmentCandidate"("hiredUserId" ASC);

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_isDeleted_idx" ON "public"."RecruitmentCandidate"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_jobPostingId_idx" ON "public"."RecruitmentCandidate"("jobPostingId" ASC);

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_recruitmentDepartmentId_idx" ON "public"."RecruitmentCandidate"("recruitmentDepartmentId" ASC);

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_statusCode_idx" ON "public"."RecruitmentCandidate"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "ResourceStakeholder_module_resourceType_resourceId_isActive_idx" ON "public"."ResourceStakeholder"("module" ASC, "resourceType" ASC, "resourceId" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceStakeholder_module_resourceType_resourceId_userId_key" ON "public"."ResourceStakeholder"("module" ASC, "resourceType" ASC, "resourceId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResourceStakeholder_userId_module_isActive_idx" ON "public"."ResourceStakeholder"("userId" ASC, "module" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "public"."Role"("code" ASC);

-- CreateIndex
CREATE INDEX "Role_isDeleted_idx" ON "public"."Role"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "Role_isSystem_idx" ON "public"."Role"("isSystem" ASC);

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "public"."RolePermission"("permissionId" ASC);

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "public"."RolePermission"("roleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_scopeType_scopeValue_key" ON "public"."RolePermission"("roleId" ASC, "permissionId" ASC, "scopeType" ASC, "scopeValue" ASC);

-- CreateIndex
CREATE INDEX "TimesheetEntry_approvedByUserId_idx" ON "public"."TimesheetEntry"("approvedByUserId" ASC);

-- CreateIndex
CREATE INDEX "TimesheetEntry_departmentId_idx" ON "public"."TimesheetEntry"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "TimesheetEntry_isDeleted_idx" ON "public"."TimesheetEntry"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "TimesheetEntry_projectId_idx" ON "public"."TimesheetEntry"("projectId" ASC);

-- CreateIndex
CREATE INDEX "TimesheetEntry_statusCode_idx" ON "public"."TimesheetEntry"("statusCode" ASC);

-- CreateIndex
CREATE INDEX "TimesheetEntry_userId_workDate_idx" ON "public"."TimesheetEntry"("userId" ASC, "workDate" ASC);

-- CreateIndex
CREATE INDEX "TimesheetEntry_weekStartDate_idx" ON "public"."TimesheetEntry"("weekStartDate" ASC);

-- CreateIndex
CREATE INDEX "TrainingCourse_isActive_idx" ON "public"."TrainingCourse"("isActive" ASC);

-- CreateIndex
CREATE INDEX "TrainingCourse_isDeleted_idx" ON "public"."TrainingCourse"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "TrainingCourse_isMandatory_idx" ON "public"."TrainingCourse"("isMandatory" ASC);

-- CreateIndex
CREATE INDEX "TrainingEnrollment_courseId_idx" ON "public"."TrainingEnrollment"("courseId" ASC);

-- CreateIndex
CREATE INDEX "TrainingEnrollment_isDeleted_idx" ON "public"."TrainingEnrollment"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "TrainingEnrollment_statusCode_idx" ON "public"."TrainingEnrollment"("statusCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEnrollment_userId_courseId_key" ON "public"."TrainingEnrollment"("userId" ASC, "courseId" ASC);

-- CreateIndex
CREATE INDEX "TrainingEnrollment_userId_idx" ON "public"."TrainingEnrollment"("userId" ASC);

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "public"."User"("departmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "User_isDeleted_idx" ON "public"."User"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "User_supervisorId_idx" ON "public"."User"("supervisorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username" ASC);

-- CreateIndex
CREATE INDEX "UserPermissionSet_expiresAt_idx" ON "public"."UserPermissionSet"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "UserPermissionSet_permissionId_idx" ON "public"."UserPermissionSet"("permissionId" ASC);

-- CreateIndex
CREATE INDEX "UserPermissionSet_userId_module_isActive_idx" ON "public"."UserPermissionSet"("userId" ASC, "module" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionSet_userId_module_resource_action_key" ON "public"."UserPermissionSet"("userId" ASC, "module" ASC, "resource" ASC, "action" ASC);

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "public"."UserRole"("roleId" ASC);

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "public"."UserRole"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_validFrom_key" ON "public"."UserRole"("userId" ASC, "roleId" ASC, "validFrom" ASC);

-- CreateIndex
CREATE INDEX "UserRole_userId_validTo_idx" ON "public"."UserRole"("userId" ASC, "validTo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VendorBill_billNumber_key" ON "public"."VendorBill"("billNumber" ASC);

-- CreateIndex
CREATE INDEX "VendorBill_dueDate_idx" ON "public"."VendorBill"("dueDate" ASC);

-- CreateIndex
CREATE INDEX "VendorBill_payableId_status_idx" ON "public"."VendorBill"("payableId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "WorkItem_financeSyncStatus_idx" ON "public"."WorkItem"("financeSyncStatus" ASC);

-- CreateIndex
CREATE INDEX "WorkItem_importBatchId_idx" ON "public"."WorkItem"("importBatchId" ASC);

-- CreateIndex
CREATE INDEX "WorkItem_isDeleted_idx" ON "public"."WorkItem"("isDeleted" ASC);

-- CreateIndex
CREATE INDEX "WorkItem_projectId_idx" ON "public"."WorkItem"("projectId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStatus_module_entity_code_key" ON "public"."WorkflowStatus"("module" ASC, "entity" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "WorkflowStatus_module_entity_idx" ON "public"."WorkflowStatus"("module" ASC, "entity" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTransition_module_entity_fromStatusId_toStatusId_key" ON "public"."WorkflowTransition"("module" ASC, "entity" ASC, "fromStatusId" ASC, "toStatusId" ASC);

-- CreateIndex
CREATE INDEX "WorkflowTransition_module_entity_idx" ON "public"."WorkflowTransition"("module" ASC, "entity" ASC);

-- CreateIndex
CREATE INDEX "crm_ref_activity_types_isActive_sortOrder_idx" ON "public"."crm_ref_activity_types"("isActive" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "crm_ref_activity_types_value_key" ON "public"."crm_ref_activity_types"("value" ASC);

-- CreateIndex
CREATE INDEX "crm_ref_industries_isActive_sortOrder_idx" ON "public"."crm_ref_industries"("isActive" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "crm_ref_industries_value_key" ON "public"."crm_ref_industries"("value" ASC);

-- CreateIndex
CREATE INDEX "crm_ref_pipeline_stages_isActive_sortOrder_idx" ON "public"."crm_ref_pipeline_stages"("isActive" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "crm_ref_pipeline_stages_value_key" ON "public"."crm_ref_pipeline_stages"("value" ASC);

-- CreateIndex
CREATE INDEX "crm_ref_sources_isActive_sortOrder_idx" ON "public"."crm_ref_sources"("isActive" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "crm_ref_sources_value_key" ON "public"."crm_ref_sources"("value" ASC);

-- CreateIndex
CREATE INDEX "crm_ref_statuses_isActive_sortOrder_idx" ON "public"."crm_ref_statuses"("isActive" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "crm_ref_statuses_value_key" ON "public"."crm_ref_statuses"("value" ASC);

-- AddForeignKey
ALTER TABLE "public"."AccessProvisioning" ADD CONSTRAINT "AccessProvisioning_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."RecruitmentCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccessProvisioning" ADD CONSTRAINT "AccessProvisioning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAccount" ADD CONSTRAINT "ClientAccount_industryRefId_fkey" FOREIGN KEY ("industryRefId") REFERENCES "public"."crm_ref_industries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAccount" ADD CONSTRAINT "ClientAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CrmDeal" ADD CONSTRAINT "CrmDeal_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "public"."ClientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CrmDeal" ADD CONSTRAINT "CrmDeal_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CrmDeal" ADD CONSTRAINT "CrmDeal_sourceRefId_fkey" FOREIGN KEY ("sourceRefId") REFERENCES "public"."crm_ref_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CrmDeal" ADD CONSTRAINT "CrmDeal_stageRefId_fkey" FOREIGN KEY ("stageRefId") REFERENCES "public"."crm_ref_pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CrmDeal" ADD CONSTRAINT "CrmDeal_statusRefId_fkey" FOREIGN KEY ("statusRefId") REFERENCES "public"."crm_ref_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "public"."ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "public"."Receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscrepancyCase" ADD CONSTRAINT "DiscrepancyCase_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "public"."ReconciliationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscrepancyCase" ADD CONSTRAINT "DiscrepancyCase_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "public"."FinanceReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeSalaryProfile" ADD CONSTRAINT "EmployeeSalaryProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceActivity" ADD CONSTRAINT "FinanceActivity_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceApproval" ADD CONSTRAINT "FinanceApproval_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEntry" ADD CONSTRAINT "FinanceEntry_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "public"."ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEntrySourceLink" ADD CONSTRAINT "FinanceEntrySourceLink_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEvidenceDocument" ADD CONSTRAINT "FinanceEvidenceDocument_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmCase" ADD CONSTRAINT "HrmCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmCase" ADD CONSTRAINT "HrmCase_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmCaseEvent" ADD CONSTRAINT "HrmCaseEvent_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmCaseEvent" ADD CONSTRAINT "HrmCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."HrmCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmCredentialProvisioning" ADD CONSTRAINT "HrmCredentialProvisioning_employmentProfileId_fkey" FOREIGN KEY ("employmentProfileId") REFERENCES "public"."HrmEmploymentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmCredentialProvisioning" ADD CONSTRAINT "HrmCredentialProvisioning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmEmploymentProfile" ADD CONSTRAINT "HrmEmploymentProfile_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmEmploymentProfile" ADD CONSTRAINT "HrmEmploymentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrmPolicy" ADD CONSTRAINT "HrmPolicy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobPosting" ADD CONSTRAINT "JobPosting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobPosting" ADD CONSTRAINT "JobPosting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveBalance" ADD CONSTRAINT "LeaveBalance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Milestone" ADD CONSTRAINT "Milestone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "public"."Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "public"."Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffboardingChecklist" ADD CONSTRAINT "OffboardingChecklist_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."OffboardingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffboardingChecklist" ADD CONSTRAINT "OffboardingChecklist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffboardingChecklistTask" ADD CONSTRAINT "OffboardingChecklistTask_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "public"."OffboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffboardingChecklistTask" ADD CONSTRAINT "OffboardingChecklistTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffboardingChecklistTask" ADD CONSTRAINT "OffboardingChecklistTask_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "public"."OffboardingTemplateTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffboardingTemplate" ADD CONSTRAINT "OffboardingTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffboardingTemplateTask" ADD CONSTRAINT "OffboardingTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."OffboardingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."OnboardingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingChecklistTask" ADD CONSTRAINT "OnboardingChecklistTask_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "public"."OnboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingChecklistTask" ADD CONSTRAINT "OnboardingChecklistTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingChecklistTask" ADD CONSTRAINT "OnboardingChecklistTask_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "public"."OnboardingTemplateTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingTemplate" ADD CONSTRAINT "OnboardingTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."OnboardingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payable" ADD CONSTRAINT "Payable_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentDisbursement" ADD CONSTRAINT "PaymentDisbursement_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "public"."Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollDisbursementLine" ADD CONSTRAINT "PayrollDisbursementLine_payrollBatchId_fkey" FOREIGN KEY ("payrollBatchId") REFERENCES "public"."PayrollBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollNotification" ADD CONSTRAINT "PayrollNotification_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "public"."PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollRun" ADD CONSTRAINT "PayrollRun_payrollBatchId_fkey" FOREIGN KEY ("payrollBatchId") REFERENCES "public"."PayrollBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollRun" ADD CONSTRAINT "PayrollRun_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "public"."PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollRun" ADD CONSTRAINT "PayrollRun_payrollScheduleId_fkey" FOREIGN KEY ("payrollScheduleId") REFERENCES "public"."PayrollSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "public"."PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollRunLog" ADD CONSTRAINT "PayrollRunLog_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "public"."PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollScheduleHistory" ADD CONSTRAINT "PayrollScheduleHistory_payrollScheduleId_fkey" FOREIGN KEY ("payrollScheduleId") REFERENCES "public"."PayrollSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."HrmPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "public"."ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_ownerDepartmentId_fkey" FOREIGN KEY ("ownerDepartmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectImportBatch" ADD CONSTRAINT "ProjectImportBatch_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectMember" ADD CONSTRAINT "ProjectMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectScope" ADD CONSTRAINT "ProjectScope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requesterDepartmentId_fkey" FOREIGN KEY ("requesterDepartmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReceiptCollection" ADD CONSTRAINT "ReceiptCollection_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "public"."Receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receivable" ADD CONSTRAINT "Receivable_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "public"."ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receivable" ADD CONSTRAINT "Receivable_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReconciliationLine" ADD CONSTRAINT "ReconciliationLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "public"."FinanceReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_hiredUserId_fkey" FOREIGN KEY ("hiredUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "public"."JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_recruitmentDepartmentId_fkey" FOREIGN KEY ("recruitmentDepartmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResourceStakeholder" ADD CONSTRAINT "ResourceStakeholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPermissionSet" ADD CONSTRAINT "UserPermissionSet_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPermissionSet" ADD CONSTRAINT "UserPermissionSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VendorBill" ADD CONSTRAINT "VendorBill_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "public"."Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkItem" ADD CONSTRAINT "WorkItem_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "public"."ProjectImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "public"."WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_requiredPermissionId_fkey" FOREIGN KEY ("requiredPermissionId") REFERENCES "public"."Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "public"."WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

