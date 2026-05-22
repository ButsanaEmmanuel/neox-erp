import { WorkItem } from '../../types/pm';

const clampProgress = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const normalizeParentId = (item: WorkItem): string | null => {
  const raw = item.parent_id ?? item.parentId ?? item.parentItemId ?? item.parentWorkItemId ?? null;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  return cleaned || null;
};

const readWeight = (item: WorkItem): number | null => {
  const flexible = item as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    flexible.weight,
    flexible.progress_weight,
    flexible.contribution,
    flexible.estimated_effort,
    flexible.budget_weight,
    item.imported_fields ? (item.imported_fields as Record<string, unknown>).weight : undefined,
    item.imported_fields ? (item.imported_fields as Record<string, unknown>).progress_weight : undefined,
    item.imported_fields ? (item.imported_fields as Record<string, unknown>).contribution : undefined,
    item.imported_fields ? (item.imported_fields as Record<string, unknown>).estimated_effort : undefined,
    item.imported_fields ? (item.imported_fields as Record<string, unknown>).budget_weight : undefined,
  ];
  for (const value of candidates) {
    if (value === null || value === undefined || value === '') continue;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
};

const deriveLeafProgress = (item: WorkItem): number => {
  if (typeof item.progress === 'number' && Number.isFinite(item.progress)) return clampProgress(item.progress);
  const status = String(item.status || '').toLowerCase();
  if (['done', 'complete', 'finance_synced', 'completed'].includes(status)) return 100;
  if (status === 'in-progress') return 50;
  return 0;
};

export function buildHierarchyProgressMap(items: WorkItem[]): Map<string, number> {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const childrenByParent = new Map<string, WorkItem[]>();
  for (const item of items) {
    const parentId = normalizeParentId(item);
    if (!parentId) continue;
    const list = childrenByParent.get(parentId) || [];
    list.push(item);
    childrenByParent.set(parentId, list);
  }

  const cache = new Map<string, number>();
  const safeGet = (id: string, seen: Set<string>): number => {
    if (cache.has(id)) return cache.get(id) as number;
    if (seen.has(id)) return 0;
    const item = itemsById.get(id);
    if (!item) return 0;

    seen.add(id);
    const children = childrenByParent.get(id) || [];
    if (children.length === 0) {
      const leaf = deriveLeafProgress(item);
      cache.set(id, leaf);
      return leaf;
    }

    const weightedChildren = children.map((child) => {
      const progress = safeGet(child.id, new Set(seen));
      const weight = readWeight(child) ?? 1;
      return { progress, weight };
    });
    const totalWeight = weightedChildren.reduce((sum, row) => sum + row.weight, 0);
    if (totalWeight <= 0) {
      const fallback = clampProgress(
        weightedChildren.reduce((sum, row) => sum + row.progress, 0) / Math.max(1, weightedChildren.length),
      );
      cache.set(id, fallback);
      return fallback;
    }
    const weighted = clampProgress(
      weightedChildren.reduce((sum, row) => sum + row.progress * row.weight, 0) / totalWeight,
    );
    cache.set(id, weighted);
    return weighted;
  };

  for (const item of items) safeGet(item.id, new Set());
  return cache;
}

export function hasChildrenInHierarchy(items: WorkItem[], itemId: string): boolean {
  return items.some((item) => normalizeParentId(item) === itemId);
}
