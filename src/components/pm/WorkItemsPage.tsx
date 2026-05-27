import React, { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { Search, Filter, Columns, Download, Plus, ChevronLeft, ChevronRight, Trash2, X, SlidersHorizontal, ChevronDown, ChevronRight as ChevronRightIcon, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import StatusChip from '../ui/StatusChip';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkItemStatus } from '../../types/pm';

import WorkItemDrawer from './WorkItemDrawer';
import WbsImportModal from './WbsImportModal';
import ColumnConfigPanel from './telecom/ColumnConfigPanel';
import { TELECOM_COLUMN_REGISTRY, TELECOM_DEFAULT_COLUMNS, columnByKey } from './telecom/telecomColumns';
import { fetchColumnPreference } from '../../services/pm/columnPreferences.service';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

const ITEMS_PER_PAGE = 10;

// D11 — retro-compat for pre-Sprint-4 bookmarks. View names switched from
// kebab-case to snake_case in Sprint 4.1; old bookmarks fell through the
// matchesView ternary and silently showed "all" items.
const LEGACY_VIEW_MAP: Record<string, string> = {
  'pending-qa': 'awaiting_qa_approval',
  'pending-acceptance': 'awaiting_signed_acceptance',
};
function normalizeView(raw: string | null): string {
  if (!raw) return 'all';
  return LEGACY_VIEW_MAP[raw] ?? raw;
}

const WorkItemsPage: React.FC = () => {
  const { workItems, activeProjectId, projects, retryFinanceSync, deleteWorkItem, updateWorkItem, loadProjectsForUser } = useProjectStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialView = normalizeView(searchParams.get('view'));
  const [view, setView] = useState<string>(initialView);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterQA, setFilterQA] = useState<string>('');
  const [filterAcceptance, setFilterAcceptance] = useState<string>('');
  const [filterSchedule, setFilterSchedule] = useState<string>('');
  const [filterFinance, setFilterFinance] = useState<string>('');
  const [showWbsImport, setShowWbsImport] = useState(false);
  // DH7 — user column preferences for the telecom table.
  const { user } = useAuth();
  const toast = useToast();
  const [telecomColumns, setTelecomColumns] = useState<string[]>(TELECOM_DEFAULT_COLUMNS);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  // F1.3 — per-item pending state for the Retry finance sync button.
  const [pendingRetryIds, setPendingRetryIds] = useState<Set<string>>(new Set());

  const handleRetryFinanceSync = async (itemId: string) => {
    if (pendingRetryIds.has(itemId)) return;
    setPendingRetryIds((prev) => new Set(prev).add(itemId));
    try {
      await retryFinanceSync(itemId, { actorUserId: user?.id, actorDisplayName: user?.name });
      toast?.addToast('Finance sync re-tentée', 'success');
    } catch (e) {
      toast?.addToast(e instanceof Error ? e.message : 'Retry failed', 'error');
    } finally {
      setPendingRetryIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchColumnPreference('telecom_workitems', user.id)
      .then((pref) => { if (!cancelled) setTelecomColumns(pref.columns); })
      .catch(() => { /* keep defaults if fetch fails */ });
    return () => { cancelled = true; };
  }, [user?.id]);

  // D13 — expanded parents in the nested view. Parents collapsed by default.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const activeFilterCount = [filterStatus, filterQA, filterAcceptance, filterSchedule, filterFinance].filter(Boolean).length;
  const clearAllFilters = () => { setFilterStatus(''); setFilterQA(''); setFilterAcceptance(''); setFilterSchedule(''); setFilterFinance(''); };

  const project = projects.find((p) => p.id === activeProjectId);
  const isTelecom = project?.isTelecomProject || project?.projectMode === 'telecom_multi_site';

  const handleSetView = (newView: string) => {
    setView(newView as any);
    setSearchParams({ view: newView });
  };

  const projectItems = useMemo(() => {
    const items = workItems.filter((item) => item.projectId === activeProjectId);
    // Sort by most-recent modification first. Uses the client-side stamp set
    // by the store on every mutation, with backend finance_sync_at as a
    // refresh-survival fallback. Items never touched keep their import order.
    const recency = (wi: typeof items[number]) => {
      const local = wi._clientUpdatedAt ?? 0;
      const sync = wi.finance_sync_at ? new Date(wi.finance_sync_at).getTime() : 0;
      return Math.max(local, Number.isFinite(sync) ? sync : 0);
    };
    return [...items].sort((a, b) => {
      const ra = recency(a);
      const rb = recency(b);
      if (ra === rb) return 0;
      if (ra === 0) return 1;
      if (rb === 0) return -1;
      return rb - ra;
    });
  }, [workItems, activeProjectId]);

  const filteredItems = useMemo(() => {
    return projectItems.filter((item) => {
      // 1. Search filter
      const searchHaystack = `${item.title} ${item.imported_fields?.site_identifier || ''} ${item.assignee || ''} ${item.imported_fields?.legacy_site_id || ''}`.toLowerCase();
      const matchesSearch = searchHaystack.includes(searchTerm.toLowerCase().trim());

      // 2. Normalization for dropdown matching
      const itemStatus = (item.status || '').toLowerCase();
      const itemQA = (item.qaStatus || 'pending').toLowerCase();
      const itemAcceptance = (item.acceptanceStatus || 'pending').toLowerCase();
      const itemFinance = (item.finance_sync_status || '').toLowerCase();
      
      // Determine effective schedule: items with no status usually mean pending, unless calculated
      const itemSchedule = (item.schedule_status || (item.is_delayed ? 'delayed' : 'pending')).toLowerCase();

      // 3. Advanced dropdown filters (Early exit if any active filter doesn't match)
      if (filterStatus && itemStatus !== filterStatus.toLowerCase()) return false;
      if (filterQA && itemQA !== filterQA.toLowerCase()) return false;
      if (filterAcceptance && itemAcceptance !== filterAcceptance.toLowerCase()) return false;
      if (filterSchedule && itemSchedule !== filterSchedule.toLowerCase()) return false;
      if (filterFinance && itemFinance !== filterFinance.toLowerCase()) return false;

      // 4. Quick-view tab filter
      const todayStr = new Date().toISOString().split('T')[0];
      const matchesView =
        view === 'all'
          ? true
          : view === 'my'
          ? item.assignee?.toLowerCase().includes('user') // Basic mock check
          : view === 'overdue'
          ? Boolean(item.plannedDate && item.plannedDate < todayStr && item.status !== 'done' && item.status !== 'complete')
          : view === 'completed'
          ? ['done', 'complete', 'finance_synced'].includes(item.status)
          : view === 'awaiting_qa_approval'
          ? item.status === 'awaiting_qa_approval' || item.qaStatus === 'pending'
          : view === 'needs_manual_completion'
          ? item.status === 'needs_manual_completion' || item.manual_completion_status !== 'complete'
          : view === 'finance_pending'
          ? item.finance_sync_status === 'pending' || item.finance_sync_status === 'blocked'
          : view === 'finance_synced'
          ? item.finance_sync_status === 'synced'
          : view === 'finance_sync_error'
          ? item.finance_sync_status === 'error'
          : view === 'delayed'
          ? item.is_delayed === true || item.schedule_status === 'delayed'
          : view === 'on_time'
          ? item.schedule_status === 'on_time'
          : view === 'early'
          ? item.schedule_status === 'early'
          : view === 'awaiting_qa_approval'
          ? item.qaStatus !== 'approved'
          : view === 'awaiting_signed_acceptance'
          ? item.acceptanceStatus !== 'signed'
          : true;

      return matchesSearch && matchesView;
    });
  }, [projectItems, searchTerm, view, filterStatus, filterQA, filterAcceptance, filterSchedule, filterFinance]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, view, activeProjectId, filterStatus, filterQA, filterAcceptance, filterSchedule, filterFinance]);

  useEffect(() => {
    setSelectedIds([]);
  }, [searchTerm, view, activeProjectId, page]);

  useEffect(() => {
    const workItemIdFromQuery = searchParams.get('workItemId');
    if (!workItemIdFromQuery) return;
    const existsInProject = projectItems.some((item) => item.id === workItemIdFromQuery);
    if (existsInProject) {
      setSelectedItemId(workItemIdFromQuery);
    }
  }, [searchParams, projectItems]);

  // D13 — index children by parentId from the flat list. Each row has parentId?.
  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const pid = item.parentId;
      if (!pid) continue;
      const arr = map.get(pid) || [];
      arr.push(item);
      map.set(pid, arr);
    }
    return map;
  }, [filteredItems]);

  // Root rows = no parent, OR parent isn't in the filtered set (orphan-by-filter
  // shown as a root rather than hidden — preserves "show what matches the filter").
  // Sort by recency: each root's "freshness" is max(updatedAt) across itself
  // and every visible descendant, so a parent surfaces whenever a child got
  // touched. _clientUpdatedAt wins if present (optimistic-update timestamp).
  const rootItems = useMemo(() => {
    const idsInFilter = new Set(filteredItems.map((i) => i.id));
    const roots = filteredItems.filter((i) => !i.parentId || !idsInFilter.has(i.parentId));

    const timestamp = (wi: typeof filteredItems[number]): number => {
      const candidates = [
        (wi as { _clientUpdatedAt?: number })._clientUpdatedAt,
        wi.updatedAt ? Date.parse(wi.updatedAt) : 0,
        wi.createdAt ? Date.parse(wi.createdAt) : 0,
      ].filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
      return candidates.length > 0 ? Math.max(...candidates) : 0;
    };
    const recursiveFreshness = (rootId: string): number => {
      const direct = childrenByParent.get(rootId) || [];
      let best = 0;
      for (const child of direct) {
        best = Math.max(best, timestamp(child), recursiveFreshness(child.id));
      }
      return best;
    };
    return [...roots].sort((a, b) => {
      const fa = Math.max(timestamp(a), recursiveFreshness(a.id));
      const fb = Math.max(timestamp(b), recursiveFreshness(b.id));
      return fb - fa;
    });
  }, [filteredItems, childrenByParent]);

  const pagedRoots = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return rootItems.slice(start, start + ITEMS_PER_PAGE);
  }, [rootItems, page]);

  // Flatten paged roots into the display list, walking children when expanded.
  // Caps recursion at depth 3 (UI guard; backend already enforces).
  type Displayed = { item: typeof filteredItems[number]; depth: number };
  const pagedItems = useMemo<Displayed[]>(() => {
    const out: Displayed[] = [];
    const visit = (node: typeof filteredItems[number], depth: number) => {
      out.push({ item: node, depth });
      if (depth >= 3) return;
      if (!expandedIds.has(node.id)) return;
      const kids = childrenByParent.get(node.id) || [];
      for (const k of kids) visit(k, depth + 1);
    };
    for (const root of pagedRoots) visit(root, 1);
    return out;
  }, [pagedRoots, expandedIds, childrenByParent]);
  const currentPageIds = useMemo(() => pagedItems.map((d) => d.item.id), [pagedItems]);
  const selectedInPageCount = useMemo(
    () => currentPageIds.filter((id) => selectedIds.includes(id)).length,
    [currentPageIds, selectedIds]
  );
  const allPageSelected = pagedItems.length > 0 && selectedInPageCount === pagedItems.length;

  // Pagination is by ROOT rows (children inflate row count when expanded).
  const totalPages = Math.max(1, Math.ceil(rootItems.length / ITEMS_PER_PAGE));
  const pageStart = rootItems.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(page * ITEMS_PER_PAGE, rootItems.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      if (allPageSelected) {
        return prev.filter((id) => !currentPageIds.includes(id));
      }
      const next = new Set([...prev, ...currentPageIds]);
      return Array.from(next);
    });
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) => deleteWorkItem(id));
    setSelectedIds([]);
  };

  const handleBulkStatusUpdate = (status: string) => {
    if (!status) return;
    selectedIds.forEach((id) => updateWorkItem(id, { status: status as WorkItemStatus }));
    setSelectedIds([]);
  };

  const handleBulkQAUpdate = (qaStatus: string) => {
    if (!qaStatus) return;
    selectedIds.forEach((id) => updateWorkItem(id, { qaStatus: qaStatus as 'pending' | 'approved' | 'rejected' }));
    setSelectedIds([]);
  };

  const handleBulkAcceptanceUpdate = (acceptanceStatus: string) => {
    if (!acceptanceStatus) return;
    selectedIds.forEach((id) => updateWorkItem(id, { acceptanceStatus: acceptanceStatus as 'pending' | 'signed' | 'rejected' }));
    setSelectedIds([]);
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <style>{`.workitems-scroll{scrollbar-width:none;-ms-overflow-style:none}.workitems-scroll::-webkit-scrollbar{display:none}`}</style>
      <div className="p-4 border-b border-border/60 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-card p-1 rounded-lg border border-border/60 overflow-x-auto workitems-scroll">
              {(
                isTelecom
                  ? (['all', 'needs_manual_completion', 'awaiting_qa_approval', 'awaiting_signed_acceptance', 'delayed', 'on_time', 'finance_pending', 'finance_synced', 'finance_sync_error'] as const)
                  : (['all', 'my', 'overdue', 'completed', 'awaiting_qa_approval'] as const)
              ).map((v) => (
                <button
                  key={v}
                  onClick={() => handleSetView(v)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                    view === v ? 'bg-border text-primary shadow-sm' : 'text-muted hover:text-primary hover:bg-surface'
                  )}
                >
                  {v.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div className="h-6 w-[1px] bg-border" />

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder={isTelecom ? 'Search by title/site/team...' : 'Filter work items...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-card border border-border/60 rounded-lg pl-9 pr-3 py-1.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors w-72"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={cn(
                'relative p-2 rounded-lg transition-colors',
                showFilters || activeFilterCount > 0 ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-surface text-muted hover:text-primary'
              )}
              title="Advanced Filters"
            >
              <SlidersHorizontal size={16} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-blue-600 text-white rounded-full">{activeFilterCount}</span>
              )}
            </button>
            {isTelecom && (
              <button
                type="button"
                onClick={() => setShowColumnsPanel(true)}
                className="inline-flex items-center gap-1 p-2 rounded-lg transition-colors hover:bg-surface text-muted hover:text-primary"
                title="Configure columns"
              >
                <Columns size={16} />
              </button>
            )}
            <button onClick={() => navigate(`/projects/${activeProjectId}/imports`)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-2">
              <Download size={16} /> Import Excel
            </button>
            <button
              onClick={() => setShowWbsImport(true)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              title="Bulk import parents + sub-tasks with weight %"
            >
              <Download size={16} /> Import WBS
            </button>
            <button onClick={() => setSelectedItemId('new')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={16} /> New Item
            </button>
          </div>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap px-1 py-2 rounded-xl bg-surface border border-border/60">
            <div className="flex items-center gap-1.5 pl-3">
              <Filter size={13} className="text-blue-400" />
              <span className="text-xs font-medium text-blue-400">Filters</span>
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[140px]">
              <option value="">All Statuses</option>
              {(isTelecom
                ? ['imported','needs_manual_completion','awaiting_qa_approval','awaiting_signed_acceptance','awaiting_financial_eligibility','ready_for_calculation','finance_pending','finance_synced','finance_sync_error','complete']
                : ['backlog','pending','in-progress','awaiting_qa_approval','awaiting_signed_acceptance','done']
              ).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            {isTelecom && (
              <>
                <select value={filterQA} onChange={(e) => setFilterQA(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[120px]">
                  <option value="">All QA</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={filterAcceptance} onChange={(e) => setFilterAcceptance(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[130px]">
                  <option value="">All Acceptance</option>
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={filterSchedule} onChange={(e) => setFilterSchedule(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[130px]">
                  <option value="">All Schedule</option>
                  <option value="pending">Pending</option>
                  <option value="on_time">On Time</option>
                  <option value="delayed">Delayed</option>
                  <option value="early">Early</option>
                </select>
                <select value={filterFinance} onChange={(e) => setFilterFinance(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[130px]">
                  <option value="">All Finance</option>
                  <option value="pending">Pending</option>
                  <option value="synced">Synced</option>
                  <option value="error">Error</option>
                  <option value="blocked">Blocked</option>
                </select>
              </>
            )}
            {activeFilterCount > 0 && (
              <button onClick={clearAllFilters} className="ml-auto mr-2 flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded border border-rose-500/30 hover:border-rose-500/50">
                <X size={12} /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="px-4 py-2.5 border-b border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">{selectedIds.length}</span>
            <p className="text-xs text-secondary font-medium">item{selectedIds.length !== 1 ? 's' : ''} selected</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              defaultValue=""
              onChange={(e) => { handleBulkStatusUpdate(e.target.value); e.currentTarget.value = ''; }}
              className="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-xs text-primary"
            >
              <option value="" disabled>Set Status →</option>
              {isTelecom ? (
                <>
                  <option value="needs_manual_completion">Needs Manual Completion</option>
                  <option value="awaiting_qa_approval">Awaiting QA Approval</option>
                  <option value="awaiting_signed_acceptance">Awaiting Signed Acceptance</option>
                  <option value="finance_pending">Finance Pending</option>
                  <option value="finance_synced">Finance Synced</option>
                  <option value="complete">Complete</option>
                </>
              ) : (
                <>
                  <option value="backlog">Backlog</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="awaiting_qa_approval">Pending QA</option>
                  <option value="done">Done</option>
                </>
              )}
            </select>
            {isTelecom && (
              <>
                <select
                  defaultValue=""
                  onChange={(e) => { handleBulkQAUpdate(e.target.value); e.currentTarget.value = ''; }}
                  className="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-xs text-primary"
                >
                  <option value="" disabled>Set QA →</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select
                  defaultValue=""
                  onChange={(e) => { handleBulkAcceptanceUpdate(e.target.value); e.currentTarget.value = ''; }}
                  className="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-xs text-primary"
                >
                  <option value="" disabled>Set Acceptance →</option>
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </>
            )}
            <div className="h-5 w-[1px] bg-border/60" />
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto workitems-scroll">
        <table className="w-full text-left text-sm border-collapse min-w-[1500px]">
          <thead className="bg-card sticky top-0 z-10 text-xs font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-6 py-3 border-b border-border/60 font-medium w-[40px]">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllPage}
                  className="rounded bg-surface border-input"
                />
              </th>
              <th
                className="px-6 py-3 border-b border-border/60 font-medium min-w-[240px] cursor-pointer hover:text-primary transition-colors"
                onClick={toggleSelectAllPage}
                title="Click to select all rows on this page"
              >
                {isTelecom ? 'Identifier' : 'Title'}
              </th>
              {/* DH7 — telecom columns rendered from user preference. */}
              {isTelecom && telecomColumns.map((key) => {
                const def = columnByKey.get(key);
                if (!def) return null;
                return (
                  <th
                    key={key}
                    className={cn(
                      'px-6 py-3 border-b border-border/60 font-medium whitespace-nowrap',
                      def.align === 'right' ? 'text-right' : '',
                    )}
                  >
                    {def.label}
                  </th>
                );
              })}
              <th className="px-6 py-3 border-b border-border/60 font-medium w-[120px]">Status</th>
              {!isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium w-[100px]">Type</th>}
              {!isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium w-[150px]">Assignee</th>}
              {!isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium w-[120px]">Planned Date</th>}
              <th className="px-6 py-3 border-b border-border/60 font-medium w-[120px]">Finance Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {pagedItems.map(({ item, depth }) => {
              const kids = childrenByParent.get(item.id) || [];
              const hasKids = kids.length > 0;
              const completedKids = kids.filter((k) => ['complete', 'done', 'finance_synced'].includes(k.status)).length;
              const blockedKid = kids.find((k) => ['validation_error', 'finance_sync_error'].includes(k.status));
              const isExpanded = expandedIds.has(item.id);
              return (
              <tr key={item.id} onClick={() => setSelectedItemId(item.id)} className="group hover:bg-surface transition-colors cursor-pointer">
                <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelectRow(item.id)}
                    className="rounded bg-surface border-input"
                  />
                </td>
                <td className="px-6 py-3 font-medium text-primary" style={{ paddingLeft: `${24 + (depth - 1) * 20}px` }}>
                  <div className="flex items-center gap-2">
                    {hasKids ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                        className="text-muted hover:text-primary"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                      </button>
                    ) : (
                      <span className="inline-block w-[14px]" />
                    )}
                    {blockedKid && (
                      <span title="Has blocked sub-task" className="inline-flex">
                        <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                      </span>
                    )}
                    <span>{isTelecom
                      ? (item.imported_fields?.legacy_site_id
                        || item.imported_fields?.site_identifier
                        || item.title
                        || ('#' + item.id.slice(-6)))
                      : item.title}</span>
                    {hasKids && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface border border-border/60 text-muted">
                        {completedKids}/{kids.length}
                      </span>
                    )}
                  </div>
                </td>
                {/* DH7 — telecom data cells rendered from user preference. */}
                {isTelecom && telecomColumns.map((key) => {
                  const def = columnByKey.get(key);
                  if (!def) return null;
                  const pageIndexBase = (page - 1) * ITEMS_PER_PAGE;
                  const indexInPage = pagedItems.findIndex((d) => d.item.id === item.id);
                  const ctx = { index: pageIndexBase + Math.max(0, indexInPage), projectName: project?.name };
                  const value = def.accessor(item, ctx);
                  return (
                    <td key={key} className={cn('px-6 py-3 whitespace-nowrap', def.align === 'right' ? 'text-right tabular-nums' : 'text-secondary')}>
                      {value || <span className="text-muted">-</span>}
                    </td>
                  );
                })}
                <td className="px-6 py-3">
                  {isTelecom && !item.ticket_number ? <span className="text-muted">-</span> : <StatusChip status={item.status as any} />}
                </td>
                {!isTelecom && (
                  <>
                    <td className="px-6 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-secondary border border-border/60 capitalize">{item.type}</span></td>
                    <td className="px-6 py-3 text-secondary">{item.assignee || 'Unassigned'}</td>
                    <td className="px-6 py-3 text-muted tabular-nums">{item.plannedDate ? format(new Date(item.plannedDate), 'MMM d') : '-'}</td>
                  </>
                )}
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    {item.finance_sync_status ? <StatusChip status={item.finance_sync_status as any} className="h-5 text-[10px]" /> : <span className="text-muted">-</span>}
                    {isTelecom && item.finance_sync_status !== 'synced' && item.ticket_number !== undefined && item.ticket_number > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRetryFinanceSync(item.id);
                        }}
                        disabled={pendingRetryIds.has(item.id)}
                        className="text-[10px] px-2 py-1 rounded border border-input text-secondary hover:text-primary hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pendingRetryIds.has(item.id) ? 'Retrying…' : 'Retry'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={isTelecom ? 12 : 8} className="text-center py-20 text-muted">
                  <p>No work items found.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between text-xs text-muted">
        <p>Showing {pageStart}-{pageEnd} of {filteredItems.length}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-input disabled:opacity-40"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <span className="text-secondary">Page {page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-input disabled:opacity-40"
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {isTelecom && (
        <ColumnConfigPanel
          open={showColumnsPanel}
          onClose={() => setShowColumnsPanel(false)}
          onApplied={(cols) => setTelecomColumns(cols)}
          initialColumns={telecomColumns}
        />
      )}

      {showWbsImport && activeProjectId && (
        <WbsImportModal
          projectId={activeProjectId}
          actorUserId={user?.id}
          actorDisplayName={user?.name}
          onClose={() => setShowWbsImport(false)}
          onCompleted={() => { if (user?.id) void loadProjectsForUser(user.id); }}
        />
      )}

      <WorkItemDrawer
        workItemId={selectedItemId}
        onSwitchItem={(id) => setSelectedItemId(id)}
        onClose={() => {
          setSelectedItemId(null);
          if (searchParams.get('workItemId')) {
            const next = new URLSearchParams(searchParams);
            next.delete('workItemId');
            setSearchParams(next, { replace: true });
          }
        }}
      />
    </div>
  );
};

export default WorkItemsPage;




