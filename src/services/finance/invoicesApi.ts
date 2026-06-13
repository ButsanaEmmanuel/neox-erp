// Customer-invoice API client — covers the two project-billing routes added
// to auth-server.mjs. Like reconciliationApi, every call appends the actor
// (?userId=&userName=) so parseActorFromUrl resolves it for assertPermission;
// the write also embeds the actor in the body for createdBy attribution.

import { apiRequest } from '../../lib/apiClient';
import { CustomerInvoiceRecord, ReceivableRecord } from '../../types/finance';

function getSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem('neox-auth-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return String(parsed?.id || parsed?.user?.id || '').trim() || null;
  } catch {
    return null;
  }
}

function getSessionUserName(): string | null {
  try {
    const raw = localStorage.getItem('neox-auth-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const name = parsed?.name || parsed?.user?.name || parsed?.email || parsed?.user?.email;
    return name ? String(name).trim() : null;
  } catch {
    return null;
  }
}

function withActor(path: string): string {
  const uid = getSessionUserId();
  const uname = getSessionUserName();
  if (!uid && !uname) return path;
  const sep = path.includes('?') ? '&' : '?';
  const parts: string[] = [];
  if (uid) parts.push(`userId=${encodeURIComponent(uid)}`);
  if (uname) parts.push(`userName=${encodeURIComponent(uname)}`);
  return `${path}${sep}${parts.join('&')}`;
}

// Actor fields for the write body → parseActor() resolves createdBy.
function actorBody<T extends Record<string, unknown>>(extra: T) {
  const uid = getSessionUserId();
  const uname = getSessionUserName();
  return {
    ...extra,
    ...(uid ? { userId: uid } : {}),
    ...(uname ? { actorDisplayName: uname } : {}),
  };
}

const BASE = '/api/v1/finance';

export interface CreateInvoiceFromProjectInput {
  projectId: string;
  currencyCode?: string;
  dueDate?: string;
  notes?: string;
}

export interface CreateInvoiceFromProjectResult {
  invoice: CustomerInvoiceRecord | null;
  lineCount: number;
  message?: string;
}

// The line receivable as embedded in an invoice line — a slim projection of
// ReceivableRecord (no financeEntry), enough to render the line + its balance.
export interface InvoiceLineReceivable {
  id: string;
  referenceCode: string;
  clientName?: string;
  totalAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  status: string;
}

export interface InvoiceLine {
  id: string;
  receivableId: string;
  description?: string;
  amount: number;
  receivable?: InvoiceLineReceivable;
}

export interface InvoiceReceipt {
  id: string;
  amount: number;
  receiptDate: string;
  method?: string;
  status?: string;
  receiptReference?: string;
}

// Full invoice as returned by GET /invoices/:id — extends the list record with
// the totals, line breakdown, and allocated receipts.
export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  projectId?: string;
  status: string;
  currencyCode: string;
  issueDate: string;
  dueDate: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  notes?: string;
  receivableId?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  lines: InvoiceLine[];
  receipts: InvoiceReceipt[];
}

export interface RecordInvoicePaymentInput {
  amount: number;
  method?: string;
  proofReference: string;
  notes?: string;
}

export interface RecordInvoicePaymentResult {
  invoice: InvoiceDetail | null;
  receipts: InvoiceReceipt[];
  applied: number;
}

// Un-invoiced, non-cancelled receivables of a project — the lines that would
// roll into a generated invoice.
export async function listProjectBillableReceivables(projectId: string): Promise<ReceivableRecord[]> {
  const data = await apiRequest<{ receivables: ReceivableRecord[] }>(
    withActor(`${BASE}/projects/${encodeURIComponent(projectId)}/billable-receivables`),
  );
  return data.receivables || [];
}

// Generates a single customer invoice from the project's billable receivables.
// lineCount === 0 means nothing was billable; invoice is then null.
export async function createInvoiceFromProject(
  payload: CreateInvoiceFromProjectInput,
): Promise<CreateInvoiceFromProjectResult> {
  const data = await apiRequest<CreateInvoiceFromProjectResult>(
    withActor(`${BASE}/invoices/from-project`),
    { method: 'POST', body: actorBody({ ...payload }) },
  );
  return {
    invoice: data.invoice ?? null,
    lineCount: Number(data.lineCount || 0),
    message: data.message,
  };
}

// Full invoice with lines + receipts — drives the detail drawer.
export async function getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail> {
  const data = await apiRequest<{ invoice: InvoiceDetail }>(
    withActor(`${BASE}/invoices/${encodeURIComponent(invoiceId)}`),
  );
  return data.invoice;
}

// Records an invoice-level payment. The amount is allocated across the
// invoice's receivable lines; overpayment is capped to outstanding server-side.
export async function recordInvoicePayment(
  invoiceId: string,
  payload: RecordInvoicePaymentInput,
): Promise<RecordInvoicePaymentResult> {
  const data = await apiRequest<RecordInvoicePaymentResult>(
    withActor(`${BASE}/invoices/${encodeURIComponent(invoiceId)}/payment`),
    { method: 'POST', body: actorBody({ ...payload }) },
  );
  return {
    invoice: data.invoice ?? null,
    receipts: data.receipts || [],
    applied: Number(data.applied || 0),
  };
}
