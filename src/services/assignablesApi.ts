// HRM-1.4 — Typed client for GET /api/v1/hrm/employees?assignable=true.
// Module-level cache so the dropdown does not refetch on every keystroke.

import { apiRequest } from '../lib/apiClient';

export interface AssignableEmployee {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  employmentType: string;
  departmentId: string | null;
}

interface CachedFetch {
  key: string;
  promise: Promise<AssignableEmployee[]>;
  ts: number;
}

const CACHE_TTL_MS = 30_000;
let cached: CachedFetch | null = null;

function cacheKey(projectId?: string, employmentType?: string) {
  return `p=${projectId ?? ''}|t=${employmentType ?? ''}`;
}

export async function fetchAssignableEmployees(opts: {
  projectId?: string;
  employmentType?: string;
} = {}): Promise<AssignableEmployee[]> {
  const key = cacheKey(opts.projectId, opts.employmentType);
  const now = Date.now();
  if (cached && cached.key === key && now - cached.ts < CACHE_TTL_MS) {
    return cached.promise;
  }
  const qs = new URLSearchParams({ assignable: 'true' });
  if (opts.projectId) qs.set('projectId', opts.projectId);
  if (opts.employmentType) qs.set('employmentType', opts.employmentType);

  const promise = apiRequest<{ employees: AssignableEmployee[] }>(
    `/api/v1/hrm/employees?${qs.toString()}`,
  )
    .then((r) => r.employees ?? [])
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[fetchAssignableEmployees] failed:', err);
      return [];
    });
  cached = { key, promise, ts: now };
  return promise;
}

export function invalidateAssignablesCache() {
  cached = null;
}
