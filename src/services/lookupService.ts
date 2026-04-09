import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/apiClient';

export type CrmLookupType =
  | 'industries'
  | 'stages'
  | 'sources'
  | 'statuses'
  | 'activity_types'
  | 'owners'
  | 'companies'
  | 'organizations'
  | 'tags';

export interface LookupOption {
  id: string;
  label: string;
  value: string;
  [key: string]: unknown;
}

type LookupResponse = Partial<Record<CrmLookupType | 'activityTypes', LookupOption[]>>;

const LOOKUP_TTL_MS = 5 * 60 * 1000;
const lookupCache = new Map<string, { ts: number; data: LookupResponse }>();

function normalizeTypes(types: CrmLookupType[]) {
  return [...new Set(types)].sort();
}

export async function fetchCrmLookups(types: CrmLookupType[], force = false, q = ''): Promise<LookupResponse> {
  const normalized = normalizeTypes(types);
  const normalizedQuery = String(q || '').trim().toLowerCase();
  const key = `${normalized.join(',')}::${normalizedQuery}`;

  const cached = lookupCache.get(key);
  if (!force && cached && Date.now() - cached.ts < LOOKUP_TTL_MS) {
    return cached.data;
  }

  const data = await apiRequest<LookupResponse>(
    `/api/v1/crm/lookups?types=${encodeURIComponent(normalized.join(','))}&q=${encodeURIComponent(normalizedQuery)}`,
  );
  lookupCache.set(key, { ts: Date.now(), data });
  return data;
}

export function useCrmLookup(type: CrmLookupType) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<LookupOption[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCrmLookups([type]);
        if (!mounted) return;
        const raw = type === 'activity_types'
          ? (data.activityTypes || data[type] || [])
          : (data[type] || []);
        setOptions(Array.isArray(raw) ? raw : []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load lookups');
        setOptions([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [type]);

  return {
    options,
    loading,
    error,
    isEmpty: !loading && options.length === 0,
  };
}

export function useCrmMultiLookup(types: CrmLookupType[]) {
  const normalizedTypes = useMemo(() => normalizeTypes(types), [types]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LookupResponse>({});

  useEffect(() => {
    let mounted = true;

    const load = async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchCrmLookups(normalizedTypes, force);
        if (!mounted) return;
        setData(payload);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load lookups');
        setData({});
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load(false);

    return () => {
      mounted = false;
    };
  }, [normalizedTypes]);

  const refetch = async (force = true) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchCrmLookups(normalizedTypes, force);
      setData(payload);
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lookups');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
}
