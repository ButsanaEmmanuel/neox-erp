export type AccountType = 'bank' | 'cash' | 'mobile_money' | 'credit_card';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'completed' | 'processing' | 'failed' | 'refunded';

export interface Account {
    id: string;
    name: string;
    type: AccountType;
    currency: string;
    balance: number;
    accountNumber?: string;
    institution?: string;
    status: 'active' | 'archived';
    createdAt: string;
    updatedAt: string;
}

export interface Transaction {
    id: string;
    date: string;
    type: TransactionType;
    amount: number;
    currency: string;
    accountId: string;
    categoryId: string;

    // Attio-style relations
    companyId?: string;
    personId?: string;
    dealId?: string;

    memo?: string;
    status: TransactionStatus;
    attachments?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface InvoiceLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate?: number;
}

export interface Invoice {
    id: string;
    number: string;
    companyId: string;
    contactPersonId?: string;
    dealId?: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    status: InvoiceStatus;
    lineItems: InvoiceLineItem[];
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Payment {
    id: string;
    invoiceId?: string;
    transactionId?: string;
    date: string;
    amount: number;
    currency: string;
    method: string;
    status: PaymentStatus;
    reference?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    colorToken: string; // matches existing neon palette mapping
}

export interface Budget {
    id: string;
    period: string; // e.g. "2026-02"
    categoryId: string;
    limit: number;
    spent: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
}

export interface FinanceSummary {
    totalBalance: number;
    monthlyBurnRate: number;
    unpaidAccountsReceivable: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    currency: string;
}

export interface FinanceEvidence {
    id: string;
    originalFileName: string;
    documentType: string;
    validationStatus: string;
    createdAt: string;
}

export interface FinanceApprovalRecord {
    id: string;
    action: string;
    status: string;
    actorUserId?: string;
    actorDisplayName?: string;
    notes?: string;
    createdAt: string;
}

export interface FinanceActivityRecord {
    id: string;
    actorUserId?: string;
    actorDisplayName?: string;
    actionType: string;
    fieldName?: string;
    message: string;
    eventSource: string;
    createdAt: string;
}

export interface FinanceSourceLink {
    id: string;
    sourceModule: string;
    sourceEntity: string;
    sourceEntityId: string;
    sourceEvent: string;
    sourceField?: string;
}

export interface FinanceEntryRecord {
    id: string;
    referenceCode: string;
    entryType: string;
    direction: string;
    title: string;
    memo?: string;
    currencyCode: string;
    amount: number;
    sourceModule: string;
    sourceEntity: string;
    sourceEntityId: string;
    sourceEvent: string;
    projectId?: string;
    workItemId?: string;
    companyName?: string;
    clientAccountId?: string;
    accountCode?: string;
    categoryCode?: string;
    lifecycleStatus: string;
    evidenceStatus: string;
    approvalStatus: string;
    settlementStatus: string;
    expectedAt?: string;
    approvedAt?: string;
    approvedByUserId?: string;
    settledAt?: string;
    validationMessage?: string;
    createdAt: string;
    updatedAt: string;
    evidenceDocuments?: FinanceEvidence[];
    approvals?: FinanceApprovalRecord[];
    activities?: FinanceActivityRecord[];
    sourceLinks?: FinanceSourceLink[];
}

export interface ReceivableRecord {
    id: string;
    financeEntryId: string;
    referenceCode: string;
    clientName?: string;
    clientAccountId?: string;
    projectId?: string;
    workItemId?: string;
    totalAmount: number;
    outstandingAmount: number;
    collectedAmount: number;
    dueDate?: string;
    status: string;
    collectionStatus: string;
    isOverdue: boolean;
    lastCollectedAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    financeEntry: FinanceEntryRecord;
}

export interface PayableRecord {
    id: string;
    financeEntryId: string;
    referenceCode: string;
    vendorName?: string;
    projectId?: string;
    workItemId?: string;
    totalAmount: number;
    outstandingAmount: number;
    paidAmount: number;
    dueDate?: string;
    status: string;
    paymentStatus: string;
    requiresEvidence: boolean;
    lastPaidAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    financeEntry: FinanceEntryRecord;
}

export interface CustomerInvoiceRecord {
    id: string;
    receivableId: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    currencyCode: string;
    status: string;
    clientAccountId?: string;
    notes?: string;
    createdByUserId?: string;
    createdByName?: string;
    createdAt: string;
    updatedAt: string;
    receivable: ReceivableRecord;
}

export interface VendorBillRecord {
    id: string;
    payableId: string;
    billNumber: string;
    issueDate: string;
    dueDate: string;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    currencyCode: string;
    status: string;
    notes?: string;
    createdByUserId?: string;
    createdByName?: string;
    createdAt: string;
    updatedAt: string;
    payable: PayableRecord;
}

export interface PaymentDisbursementRecord {
    id: string;
    payableId: string;
    paymentReference: string;
    amount: number;
    currencyCode: string;
    paymentDate: string;
    method: string;
    status: string;
    proofDocumentId?: string;
    notes?: string;
    executedByUserId?: string;
    executedByName?: string;
    createdAt: string;
    updatedAt: string;
    payable: PayableRecord;
}

export interface ReceiptCollectionRecord {
    id: string;
    receivableId: string;
    receiptReference: string;
    amount: number;
    currencyCode: string;
    receiptDate: string;
    method: string;
    status: string;
    proofDocumentId?: string;
    notes?: string;
    receivedByUserId?: string;
    receivedByName?: string;
    createdAt: string;
    updatedAt: string;
    receivable: ReceivableRecord;
}



