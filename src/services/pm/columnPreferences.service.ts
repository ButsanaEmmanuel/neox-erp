// DH7 — API client for /api/v1/preferences/columns.

import { apiRequest } from '../../lib/apiClient';

export interface ColumnPreference {
  context: string;
  columns: string[];
}

export async function fetchColumnPreference(
  context: string,
  userId: string,
): Promise<ColumnPreference> {
  const params = new URLSearchParams({ context, userId });
  return apiRequest<ColumnPreference>(`/api/v1/preferences/columns?${params.toString()}`);
}

export async function saveColumnPreference(
  context: string,
  columns: string[],
  userId: string,
): Promise<ColumnPreference> {
  return apiRequest<ColumnPreference>('/api/v1/preferences/columns', {
    method: 'PUT',
    body: { context, columns, actorUserId: userId },
  });
}
