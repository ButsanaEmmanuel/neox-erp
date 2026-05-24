import type { WorkItem } from '../../types/pm';

export interface TelecomSummary {
  totalImportedRows: number;
  incompleteItems: number;
  financePending: number;
  financeSynced: number;
  errorRows: number;
  qaApprovedItems: number;
  acceptanceSignedItems: number;
  delayedItems: number;
  onTimeItems: number;
  earlyItems: number;
  averageDelayDays: number;
}

export function computeTelecomSummary(workItems: WorkItem[]): TelecomSummary {
  const delayedItems = workItems.filter((wi) => wi.schedule_status === 'delayed' || wi.is_delayed).length;
  const earlyItems = workItems.filter((wi) => wi.schedule_status === 'early').length;
  const onTimeItems = workItems.filter((wi) => wi.schedule_status === 'on_time').length;
  const varianceRows = workItems.filter((wi) => typeof wi.start_variance_days === 'number');
  const averageDelayDays = varianceRows.length > 0
    ? Math.round((varianceRows.reduce((sum, wi) => sum + Number(wi.start_variance_days || 0), 0) / varianceRows.length) * 10) / 10
    : 0;

  return {
    totalImportedRows: workItems.length,
    incompleteItems: workItems.filter((wi) => wi.status === 'needs_manual_completion' && wi.manual_completion_status !== 'complete').length,
    financePending: workItems.filter((wi) => wi.finance_sync_status === 'pending' || wi.finance_sync_status === 'blocked').length,
    financeSynced: workItems.filter((wi) => wi.finance_sync_status === 'synced').length,
    errorRows: workItems.filter((wi) => wi.status === 'validation_error' || wi.finance_sync_status === 'error' || wi.finance_sync_status === 'blocked').length,
    qaApprovedItems: workItems.filter((wi) => wi.qaStatus === 'approved').length,
    acceptanceSignedItems: workItems.filter((wi) => wi.acceptanceStatus === 'signed').length,
    delayedItems,
    onTimeItems,
    earlyItems,
    averageDelayDays,
  };
}
