import React, { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import {
  Search,
  Filter,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  SlidersHorizontal,
  ChevronsDown,
  ChevronsRight,
  ChevronDown,
  FolderTree,
  GripHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import StatusChip from '../ui/StatusChip';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkItem, WorkItemStatus } from '../../types/pm';
import WorkItemDrawer from './WorkItemDrawer';
import { useAuth } from '../../contexts/AuthContext';
import { deleteProjectWorkItemInBackend } from '../../services/pm/projectCollaborationBackend.service';
import { buildHierarchyProgressMap } from '../../services/pm/workItemProgress.service';

const ITEMS_PER_PAGE = 10;
const INDENT_PX = 32;

type TreeRow = {
  item: WorkItem;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  parentName?: string;
};

type ComputedScheduleStatus = 'Upcoming' | 'Active' | 'Overdue' | 'Completed' | 'Unplanned';

const normalizeWorkItemParentId = (item: WorkItem): string | null => {
  const raw = item.parent_id ?? item.parentId ?? item.parentItemId ?? item.parentWorkItemId ?? null;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  return cleaned || null;
};

const computeScheduleStatus = (item: WorkItem): ComputedScheduleStatus => {
  const execution = String(item.status || '').toLowerCase();
  if (['done', 'complete', 'finance_synced', 'completed'].includes(execution)) return 'Completed';

  const start = item.planned_start_date || null;
  const end = item.planned_end_date || null;
  const legacy = item.plannedDate || null;
  const effectiveStart = start || legacy;
  const effectiveEnd = end || legacy;
  if (!effectiveStart && !effectiveEnd) return 'Unplanned';

  const today = new Date().toISOString().slice(0, 10);
  if (effectiveStart && today < effectiveStart) return 'Upcoming';
  if (effectiveStart && effectiveEnd && today >= effectiveStart && today <= effectiveEnd) return 'Active';
  if (effectiveEnd && today > effectiveEnd) return 'Overdue';
  return 'Active';
};

const renderPlannedWindow = (item: WorkItem): string => {
  const start = item.planned_start_date;
  const end = item.planned_end_date;
  const legacy = item.plannedDate;
  if (start && end) return `${format(new Date(start), 'dd/MM/yyyy')} - ${format(new Date(end), 'dd/MM/yyyy')}`;
  if (start) return `From ${format(new Date(start), 'dd/MM/yyyy')}`;
  if (end) return `Due ${format(new Date(end), 'dd/MM/yyyy')}`;
  if (legacy) return format(new Date(legacy), 'dd/MM/yyyy');
  return '-';
};

const WorkItemsPage: React.FC = () => {
  const { workItems, activeProjectId, projects, retryFinanceSync, deleteWorkItem, updateWorkItem, loadProjectsForUser } = useProjectStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialView = (searchParams.get('view') as string) || 'all';
  const [view, setView] = useState<string>(initialView);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newItemSeed, setNewItemSeed] = useState<Partial<WorkItem> | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterQA, setFilterQA] = useState<string>('');
  const [filterAcceptance, setFilterAcceptance] = useState<string>('');
  const [filterSchedule, setFilterSchedule] = useState<string>('');
  const [filterFinance, setFilterFinance] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const activeFilterCount = [filterStatus, filterQA, filterAcceptance, filterSchedule, filterFinance].filter(Boolean).length;
  const clearAllFilters = () => {
    setFilterStatus('');
    setFilterQA('');
    setFilterAcceptance('');
    setFilterSchedule('');
    setFilterFinance('');
  };

  const project = projects.find((p) => p.id === activeProjectId);
  const isTelecom = project?.isTelecomProject || project?.projectMode === 'telecom_multi_site';

  const handleSetView = (newView: string) => {
    setView(newView);
    setSearchParams({ view: newView });
  };

  const projectItems = useMemo(() => workItems.filter((item) => item.projectId === activeProjectId), [workItems, activeProjectId]);
  const itemsById = useMemo(() => new Map(projectItems.map((item) => [item.id, item])), [projectItems]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const item of projectItems) {
      const parentId = normalizeWorkItemParentId(item);
      if (!parentId) continue;
      const list = map.get(parentId) || [];
      list.push(item);
      map.set(parentId, list);
    }
    return map;
  }, [projectItems]);

  const parentIdsWithChildren = useMemo(() => new Set(Array.from(childrenByParent.keys())), [childrenByParent]);

  useEffect(() => {
    setExpandedIds(parentIdsWithChildren);
  }, [activeProjectId, parentIdsWithChildren]);

  const matchesFilters = (item: WorkItem): boolean => {
    const searchHaystack = `${item.title} ${item.imported_fields?.site_identifier || ''} ${item.assignee || ''} ${item.imported_fields?.legacy_site_id || ''}`
      .toLowerCase();
    const matchesSearch = searchHaystack.includes(searchTerm.toLowerCase().trim());

    const itemStatus = (item.status || '').toLowerCase();
    const itemQA = (item.qaStatus || 'pending').toLowerCase();
    const itemAcceptance = (item.acceptanceStatus || 'pending').toLowerCase();
    const itemFinance = (item.finance_sync_status || '').toLowerCase();
    const itemSchedule = computeScheduleStatus(item).toLowerCase();

    if (filterStatus && itemStatus !== filterStatus.toLowerCase()) return false;
    if (filterQA && itemQA !== filterQA.toLowerCase()) return false;
    if (filterAcceptance && itemAcceptance !== filterAcceptance.toLowerCase()) return false;
    if (filterSchedule && itemSchedule !== filterSchedule.toLowerCase()) return false;
    if (filterFinance && itemFinance !== filterFinance.toLowerCase()) return false;

    const todayStr = new Date().toISOString().split('T')[0];
    const plannedStart = item.planned_start_date || item.plannedDate;
    const plannedEnd = item.planned_end_date || item.planned_start_date || item.plannedDate;
    const matchesView =
      view === 'all'
        ? true
        : view === 'my'
          ? Boolean(
              item.assignee &&
              (item.assignee.toLowerCase() === String(user?.name || '').toLowerCase() ||
                item.assignee.toLowerCase() === String(user?.email || '').toLowerCase() ||
                item.assignee.toLowerCase() === String(user?.id || '').toLowerCase())
            )
          : view === 'overdue'
            ? Boolean(plannedEnd && plannedEnd < todayStr && item.status !== 'done' && item.status !== 'complete')
            : view === 'completed'
              ? ['done', 'complete', 'finance_synced'].includes(item.status)
              : view === 'pending-qa'
                ? item.status === 'pending-qa' || item.qaStatus === 'pending'
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
  };

  const scopedItems = useMemo(() => {
    const matchedIds = new Set(projectItems.filter(matchesFilters).map((item) => item.id));
    const scopedIds = new Set<string>(matchedIds);
    for (const id of matchedIds) {
      let cursor = itemsById.get(id);
      while (cursor) {
        const parentId = normalizeWorkItemParentId(cursor);
        if (!parentId) break;
        if (scopedIds.has(parentId)) {
          cursor = itemsById.get(parentId);
          continue;
        }
        scopedIds.add(parentId);
        cursor = itemsById.get(parentId);
      }
    }
    return projectItems.filter((item) => scopedIds.has(item.id));
  }, [projectItems, itemsById, searchTerm, view, filterStatus, filterQA, filterAcceptance, filterSchedule, filterFinance]);

  const treeRows = useMemo(() => {
    const scopedMap = new Map(scopedItems.map((item) => [item.id, item]));
    const scopedChildrenMap = new Map<string, WorkItem[]>();
    for (const item of scopedItems) {
      const parentId = normalizeWorkItemParentId(item);
      if (!parentId || !scopedMap.has(parentId)) continue;
      const list = scopedChildrenMap.get(parentId) || [];
      list.push(item);
      scopedChildrenMap.set(parentId, list);
    }

    const roots = scopedItems.filter((item) => {
      const parentId = normalizeWorkItemParentId(item);
      if (!parentId) return true;
      return !scopedMap.has(parentId);
    });

    const orderedRows: TreeRow[] = [];
    const visited = new Set<string>();

    const visit = (item: WorkItem, depth: number) => {
      if (visited.has(item.id)) return;
      visited.add(item.id);
      const children = scopedChildrenMap.get(item.id) || [];
      const hasChildren = children.length > 0;
      const parentId = normalizeWorkItemParentId(item);
      orderedRows.push({
        item,
        depth,
        hasChildren,
        isExpanded: hasChildren ? expandedIds.has(item.id) : false,
        parentName: parentId ? itemsById.get(parentId)?.title : undefined,
      });
      if (!hasChildren || !expandedIds.has(item.id)) return;
      for (const child of children) visit(child, depth + 1);
    };

    for (const root of roots) visit(root, 0);
    for (const item of scopedItems) if (!visited.has(item.id)) visit(item, 0);

    return orderedRows;
  }, [scopedItems, expandedIds, itemsById]);

  const progressById = useMemo(() => buildHierarchyProgressMap(projectItems), [projectItems]);

  const totalPages = Math.max(1, Math.ceil(treeRows.length / ITEMS_PER_PAGE));

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
    if (existsInProject) setSelectedItemId(workItemIdFromQuery);
  }, [searchParams, projectItems]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return treeRows.slice(start, start + ITEMS_PER_PAGE);
  }, [treeRows, page]);

  const currentPageIds = useMemo(() => pagedRows.map((row) => row.item.id), [pagedRows]);
  const selectedInPageCount = useMemo(() => currentPageIds.filter((id) => selectedIds.includes(id)).length, [currentPageIds, selectedIds]);
  const allPageSelected = pagedRows.length > 0 && selectedInPageCount === pagedRows.length;

  const pageStart = treeRows.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(page * ITEMS_PER_PAGE, treeRows.length);

  const rootCount = useMemo(() => projectItems.filter((item) => !normalizeWorkItemParentId(item)).length, [projectItems]);

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      if (allPageSelected) return prev.filter((id) => !currentPageIds.includes(id));
      return Array.from(new Set([...prev, ...currentPageIds]));
    });
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(parentIdsWithChildren);
  const collapseAll = () => setExpandedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!activeProjectId) return;
    for (const id of selectedIds) {
      try {
        await deleteProjectWorkItemInBackend({
          projectId: activeProjectId,
          workItemId: id,
          actorUserId: user?.id,
          actorDisplayName: user?.name,
        });
      } catch (error) {
        console.error('Failed to delete work item in backend', { id, error });
      }
      deleteWorkItem(id);
    }
    if (user?.id) {
      await loadProjectsForUser(user.id);
    }
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

  const openCreateItem = (seed?: Partial<WorkItem>) => {
    setNewItemSeed(seed || null);
    setSelectedItemId('new');
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <style>{`.workitems-scroll{scrollbar-width:none;-ms-overflow-style:none}.workitems-scroll::-webkit-scrollbar{display:none}`}</style>
      <div className="p-4 border-b border-border/60 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-card p-1 rounded-lg border border-border/60 overflow-x-auto workitems-scroll">
              {(isTelecom
                ? (['all', 'needs_manual_completion', 'awaiting_qa_approval', 'awaiting_signed_acceptance', 'delayed', 'on_time', 'finance_pending', 'finance_synced', 'finance_sync_error'] as const)
                : (['all', 'my', 'overdue', 'completed', 'pending-qa'] as const)
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
            <button onClick={expandAll} className="px-2.5 py-1.5 rounded-lg text-xs border border-border/60 text-secondary hover:text-primary hover:bg-surface inline-flex items-center gap-1.5">
              <ChevronsDown size={13} /> Expand all
            </button>
            <button onClick={collapseAll} className="px-2.5 py-1.5 rounded-lg text-xs border border-border/60 text-secondary hover:text-primary hover:bg-surface inline-flex items-center gap-1.5">
              <ChevronsRight size={13} /> Collapse all
            </button>
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={cn('relative p-2 rounded-lg transition-colors', showFilters || activeFilterCount > 0 ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-surface text-muted hover:text-primary')}
              title="Advanced Filters"
            >
              <SlidersHorizontal size={16} />
              {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-blue-600 text-white rounded-full">{activeFilterCount}</span>}
            </button>
            <button onClick={() => navigate(`/projects/${activeProjectId}/imports`)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-2">
              <Download size={16} /> Import Excel
            </button>
            <button onClick={() => openCreateItem()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={16} /> New Item
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap px-1 py-2 rounded-xl bg-surface border border-border/60">
            <div className="flex items-center gap-1.5 pl-3"><Filter size={13} className="text-blue-400" /><span className="text-xs font-medium text-blue-400">Filters</span></div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[140px]">
              <option value="">All Statuses</option>
              {(isTelecom ? ['imported', 'needs_manual_completion', 'awaiting_qa_approval', 'awaiting_signed_acceptance', 'awaiting_financial_eligibility', 'ready_for_calculation', 'finance_pending', 'finance_synced', 'finance_sync_error', 'complete'] : ['backlog', 'pending', 'in-progress', 'pending-qa', 'pending-acceptance', 'done']).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            {isTelecom && (
              <>
                <select value={filterQA} onChange={(e) => setFilterQA(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[120px]"><option value="">All QA</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
                <select value={filterAcceptance} onChange={(e) => setFilterAcceptance(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[130px]"><option value="">All Acceptance</option><option value="pending">Pending</option><option value="signed">Signed</option><option value="rejected">Rejected</option></select>
                <select value={filterSchedule} onChange={(e) => setFilterSchedule(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[130px]"><option value="">All Schedule</option><option value="pending">Pending</option><option value="on_time">On Time</option><option value="delayed">Delayed</option><option value="early">Early</option></select>
                <select value={filterFinance} onChange={(e) => setFilterFinance(e.target.value)} className="bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-primary min-w-[130px]"><option value="">All Finance</option><option value="pending">Pending</option><option value="synced">Synced</option><option value="error">Error</option><option value="blocked">Blocked</option></select>
              </>
            )}
            {activeFilterCount > 0 && <button onClick={clearAllFilters} className="ml-auto mr-2 flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded border border-rose-500/30 hover:border-rose-500/50"><X size={12} /> Clear all</button>}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="px-4 py-2.5 border-b border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">{selectedIds.length}</span><p className="text-xs text-secondary font-medium">item{selectedIds.length !== 1 ? 's' : ''} selected</p></div>
          <div className="flex items-center gap-2 flex-wrap">
            <select defaultValue="" onChange={(e) => { handleBulkStatusUpdate(e.target.value); e.currentTarget.value = ''; }} className="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-xs text-primary">
              <option value="" disabled>Set Status</option>
              {isTelecom ? (
                <>
                  <option value="needs_manual_completion">Needs Manual Completion</option><option value="awaiting_qa_approval">Awaiting QA Approval</option><option value="awaiting_signed_acceptance">Awaiting Signed Acceptance</option><option value="finance_pending">Finance Pending</option><option value="finance_synced">Finance Synced</option><option value="complete">Complete</option>
                </>
              ) : (
                <>
                  <option value="backlog">Backlog</option><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="pending-qa">Pending QA</option><option value="done">Done</option>
                </>
              )}
            </select>
            {isTelecom && (
              <>
                <select defaultValue="" onChange={(e) => { handleBulkQAUpdate(e.target.value); e.currentTarget.value = ''; }} className="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-xs text-primary"><option value="" disabled>Set QA</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
                <select defaultValue="" onChange={(e) => { handleBulkAcceptanceUpdate(e.target.value); e.currentTarget.value = ''; }} className="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-xs text-primary"><option value="" disabled>Set Acceptance</option><option value="pending">Pending</option><option value="signed">Signed</option><option value="rejected">Rejected</option></select>
              </>
            )}
            <div className="h-5 w-[1px] bg-border/60" />
            <button type="button" onClick={handleBulkDelete} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs"><Trash2 size={12} /> Delete</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto workitems-scroll">
        <table className="w-full text-left text-sm border-collapse min-w-[1500px]">
          <thead className="bg-card sticky top-0 z-10 text-xs font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-6 py-3 border-b border-border/60 font-medium w-[40px]"><input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllPage} className="rounded bg-surface border-input" /></th>
              <th className="px-6 py-3 border-b border-border/60 font-medium min-w-[320px]">{isTelecom ? 'Legacy Site ID' : 'Title'}</th>
              {isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium">Site ID</th>}
              {isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium">Site Name</th>}
              {isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium text-right">PO Unit Price</th>}
              {isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium text-right">Ticket Number</th>}
              {isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium">QA</th>}
              {isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium">Acceptance</th>}
              {isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium text-right">PO Unit Price Completed</th>}
              {isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium text-right">Contractor Payable Amount</th>}
              <th className="px-6 py-3 border-b border-border/60 font-medium w-[120px]">Execution</th>
              {!isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium w-[100px]">Type</th>}
              {!isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium w-[150px]">Assignee</th>}
              {!isTelecom && <th className="px-6 py-3 border-b border-border/60 font-medium w-[120px]">Planned Window</th>}
              <th className="px-6 py-3 border-b border-border/60 font-medium w-[120px]">Finance Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {pagedRows.map((row) => {
              const item = row.item;
              const progress = progressById.get(item.id);
              const hasParent = row.depth > 0;
              const depthPadding = row.depth * INDENT_PX;
              return (
                <tr key={item.id} onClick={() => setSelectedItemId(item.id)} className={cn('group hover:bg-surface/70 transition-colors cursor-pointer', row.depth === 0 ? 'bg-white/[0.015]' : 'bg-transparent')}>
                  <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelectRow(item.id)} className="rounded bg-surface border-input" />
                  </td>
                  <td className="px-6 py-2">
                    <div className="relative flex items-center gap-2.5" style={{ paddingLeft: `${depthPadding}px` }}>
                      {hasParent && <span className="absolute top-1/2 -translate-y-1/2 border-t border-border/60" style={{ left: `${Math.max(0, depthPadding - 12)}px`, width: '12px' }} />}
                      {hasParent && <span className="absolute border-l border-border/50" style={{ left: `${Math.max(0, depthPadding - 12)}px`, top: '-14px', height: '28px' }} />}
                      {row.hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(item.id);
                          }}
                          className="w-5 h-5 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-surface"
                          aria-label={row.isExpanded ? 'Collapse branch' : 'Expand branch'}
                        >
                          {row.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <span className="w-5 h-5 inline-flex items-center justify-center opacity-0"><ChevronRight size={14} /></span>
                      )}
                      <FolderTree size={14} className={cn(row.depth === 0 ? 'text-blue-300' : 'text-muted')} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('truncate', row.depth === 0 ? 'font-semibold text-primary' : 'font-medium text-secondary')}>
                            {isTelecom ? item.imported_fields?.legacy_site_id || item.title || '-' : item.title}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-400">{Math.round(progress ?? 0)}%</span>
                          {!isTelecom && row.hasChildren && <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/70 text-muted">{childrenByParent.get(item.id)?.length || 0} child</span>}
                        </div>
                        {!isTelecom && (
                          <p className="text-[11px] text-muted">
                            {hasParent ? (row.parentName ? `Child of ${row.parentName}` : 'Child item') : 'Root item'}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateItem({ parent_id: item.id, parentId: item.id, parentWorkItemId: item.id, type: isTelecom ? 'site' : 'task' });
                        }}
                        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border/70 text-secondary hover:text-primary hover:border-emerald-500/50"
                      >
                        <GripHorizontal size={12} /> + child
                      </button>
                    </div>
                  </td>
                  {isTelecom && <td className="px-6 py-3 text-secondary">{item.imported_fields?.site_identifier || '-'}</td>}
                  {isTelecom && <td className="px-6 py-3 text-secondary">{item.imported_fields?.site_name || '-'}</td>}
                  {isTelecom && <td className="px-6 py-3 text-right text-secondary tabular-nums">{item.po_unit_price?.toLocaleString() || '-'}</td>}
                  {isTelecom && <td className="px-6 py-3 text-right text-secondary tabular-nums">{item.ticket_number !== undefined && item.ticket_number > 0 ? item.ticket_number : '-'}</td>}
                  {isTelecom && <td className="px-6 py-3"><StatusChip status={item.qaStatus || 'pending'} className="h-5 text-[10px]" /></td>}
                  {isTelecom && <td className="px-6 py-3"><StatusChip status={item.acceptanceStatus || 'pending'} className="h-5 text-[10px]" /></td>}
                  {isTelecom && <td className="px-6 py-3 text-right tabular-nums">{item.po_unit_price_completed !== undefined && item.po_unit_price_completed > 0 ? <span className="text-secondary">{item.po_unit_price_completed.toLocaleString()}</span> : <span className="text-muted">-</span>}</td>}
                  {isTelecom && <td className="px-6 py-3 text-right tabular-nums">{item.is_financially_eligible && item.contractor_payable_amount !== undefined ? <span className="text-emerald-300">{item.contractor_payable_amount.toLocaleString()}</span> : <span className="text-muted">-</span>}</td>}
                  <td className="px-6 py-3">{isTelecom && !item.ticket_number ? <span className="text-muted">-</span> : <StatusChip status={item.status as any} />}</td>
                  {!isTelecom && (
                    <>
                      <td className="px-6 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-secondary border border-border/60 capitalize">{item.type}</span></td>
                      <td className="px-6 py-3 text-secondary">{item.assignee || 'Unassigned'}</td>
                      <td className="px-6 py-3 text-muted tabular-nums">
                        <div className="flex flex-col">
                          <span>{renderPlannedWindow(item)}</span>
                          <span className="text-[10px] text-muted/80">{computeScheduleStatus(item)}</span>
                        </div>
                      </td>
                    </>
                  )}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {item.finance_sync_status ? <StatusChip status={item.finance_sync_status as any} className="h-5 text-[10px]" /> : <span className="text-muted">-</span>}
                      {isTelecom && item.finance_sync_status !== 'synced' && item.ticket_number !== undefined && item.ticket_number > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            retryFinanceSync(item.id);
                          }}
                          className="text-[10px] px-2 py-1 rounded border border-input text-secondary hover:text-primary hover:border-emerald-500/50"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {treeRows.length === 0 && (
              <tr>
                <td colSpan={isTelecom ? 12 : 7} className="text-center py-20 text-muted"><p>No work items found.</p></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between text-xs text-muted">
        <p>
          Showing {pageStart}-{pageEnd} of {treeRows.length} visible rows • {rootCount} root items • {projectItems.length} total work items
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-input disabled:opacity-40"><ChevronLeft size={13} /> Prev</button>
          <span className="text-secondary">Page {page} / {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-input disabled:opacity-40">Next <ChevronRight size={13} /></button>
        </div>
      </div>

      <WorkItemDrawer
        workItemId={selectedItemId}
        initialValues={selectedItemId === 'new' ? newItemSeed : null}
        onClose={() => {
          setSelectedItemId(null);
          setNewItemSeed(null);
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
