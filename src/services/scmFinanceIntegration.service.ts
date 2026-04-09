import { apiRequest } from '../lib/apiClient';
import type { PurchaseOrder } from '../types/po';

interface ScmFinanceStatusResponse {
  poId: string;
  commitments: Array<{ id: string; lifecycleStatus: string; amount: number; updatedAt: string }>;
  payables: Array<{
    id: string;
    status: string;
    paymentStatus: string;
    outstandingAmount: number;
    financeEntry: {
      id: string;
      approvalStatus: string;
      evidenceStatus: string;
      sourceLinks?: Array<{ sourceEntity: string; sourceEntityId: string; sourceEvent: string }>;
    };
    bills: Array<{ id: string; billNumber: string; status: string; totalAmount: number }>;
    payments: Array<{ id: string; paymentReference: string; status: string; amount: number }>;
  }>;
  bills: Array<{ id: string; billNumber: string; status: string; totalAmount: number }>;
  payments: Array<{ id: string; paymentReference: string; status: string; amount: number }>;
}

export async function syncPoFinanceCommitment(po: PurchaseOrder, event: 'po_approved' | 'po_sent' | 'po_acknowledged') {
  return apiRequest<{ entry: unknown }>('/api/v1/finance/scm/po-commitment', {
    method: 'POST',
    body: {
      poId: po.id,
      poNumber: po.poNumber,
      poStatus: po.status,
      amount: po.grandTotal,
      currencyCode: po.currency,
      expectedAt: po.expectedDeliveryDate,
      event,
      memo: `SCM PO ${po.poNumber} transitioned to ${po.status}`,
      actorDisplayName: 'SCM User',
      actorUserId: 'current-user',
    },
  });
}

export async function createScmVendorBill(payload: {
  poId: string;
  poNumber: string;
  billNumber: string;
  totalAmount: number;
  dueDate?: string;
  issueDate?: string;
  grnNumber?: string;
  vendorName?: string;
  currencyCode?: string;
}) {
  return apiRequest('/api/v1/finance/scm/vendor-bills', {
    method: 'POST',
    body: {
      ...payload,
      actorDisplayName: 'SCM User',
      actorUserId: 'current-user',
    },
  });
}

export async function fetchPoFinanceStatus(poId: string) {
  return apiRequest<ScmFinanceStatusResponse>(`/api/v1/finance/scm/po/${poId}/status`);
}

export async function createScmRequisitionCommitment(payload: {
  requisitionId: string;
  requisitionCode?: string;
  amount: number;
  currencyCode?: string;
  neededBy?: string;
  memo?: string;
}) {
  return apiRequest('/api/v1/finance/scm/requisition-commitment', {
    method: 'POST',
    body: {
      ...payload,
      event: 'requisition_commitment_candidate',
      actorDisplayName: 'SCM User',
      actorUserId: 'current-user',
    },
  });
}

export async function recordScmPayment(payload: {
  payableId: string;
  amount: number;
  method?: string;
  proofReference: string;
  sourceContext?: { poId?: string; billNumber?: string; grnNumber?: string };
}) {
  return apiRequest('/api/v1/finance/payments', {
    method: 'POST',
    body: {
      ...payload,
      actorDisplayName: 'Finance User',
      actorUserId: 'current-user',
      status: 'completed',
    },
  });
}
