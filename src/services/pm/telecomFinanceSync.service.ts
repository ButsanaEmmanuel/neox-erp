// DEPRECATED — Sprint 2 Task 2.3
// Finance sync is now handled atomically by the backend in
// PATCH /api/v1/pm/projects/:projectId/work-items/:itemId/details
// (see backend/services/pm/projectItemDetails.service.mjs#saveProjectItemDetails).
// These exports remain only to keep useProjectStore compiling until Task 2.1
// removes the call sites entirely. Do not call them at runtime — they will throw.

const DEPRECATION_MESSAGE =
  '[telecomFinanceSync] Deprecated — finance sync is now backend-driven via PATCH work-items/details. ' +
  'Remove this call site as part of Task 2.1.';

export interface FinanceMirrorRecord {
  reference_id: string;
  project_id: string;
  work_item_id: string;
  amount: number;
  currency: string;
  synced_at: string;
  status: 'pending' | 'synced' | 'error' | 'blocked';
  error_message?: string;
}

export function syncContractorPayableToFinance(_input: {
  projectId: string;
  workItemId: string;
  amount: number;
  currency?: string;
}): FinanceMirrorRecord {
  throw new Error(DEPRECATION_MESSAGE);
}

export function suspendContractorPayableSync(_input: {
  projectId: string;
  workItemId: string;
  reason: string;
  currency?: string;
}): FinanceMirrorRecord {
  throw new Error(DEPRECATION_MESSAGE);
}
