import React, { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { X, Calendar, ChevronDown, Calculator, Upload, Trash2, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkItem, WorkItemType, WorkItemStatus } from '../../types/pm';
import { evaluateFinancialEligibility } from '../../services/pm/telecomCalculation.service';
import { ACCEPTANCE_MANUAL_FIELDS, formatManualFieldValue, ManualFieldDef, OPERATIONAL_MANUAL_FIELDS } from '../../services/pm/manualFieldCatalog';
import { deleteProjectItemFileFromBackend, fetchProjectItemActivities, fetchProjectItemFiles, getProjectItemFileDownloadUrl, saveProjectItemDetailsToBackend, uploadProjectItemFileToBackend, BackendActivity, BackendFile } from '../../services/pm/projectItemBackend.service';
import { notifyTeam as notifyProjectTeam } from '../../services/pm/projectCollaborationBackend.service';
import { useAuth } from '../../contexts/AuthContext';

interface WorkItemDrawerProps {
  workItemId: string | null;
  onClose: () => void;
}

type ManualGroup = 'operational' | 'acceptance';

function fieldDefByKey(group: ManualGroup, key: string): ManualFieldDef | undefined {
  const source = group === 'operational' ? OPERATIONAL_MANUAL_FIELDS : ACCEPTANCE_MANUAL_FIELDS;
  return source.find((entry) => entry.key === key);
}

function parseDecimalInput(raw: string): number | undefined {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDecimalInput(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return String(value);
}


function parseNumberLike(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const raw = typeof value === 'object' ? String(value) : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const WorkItemDrawer: React.FC<WorkItemDrawerProps> = ({ workItemId, onClose }) => {
  const { user } = useAuth();
  const { workItems, addWorkItem, updateWorkItem, activeProjectId, projects } = useProjectStore();
  const existingItem = workItems.find((i) => i.id === workItemId);
  const isNew = workItemId === 'new';
  const project = projects.find((p) => p.id === activeProjectId);
  const isTelecom = Boolean(project?.isTelecomProject || project?.projectMode === 'telecom_multi_site' || existingItem?.type === 'site');

  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'files'>('details');
  const [manualGroup, setManualGroup] = useState<ManualGroup>('operational');
  const [selectedFieldKey, setSelectedFieldKey] = useState('');
  const [selectedFieldValue, setSelectedFieldValue] = useState('');
  const [ticketInput, setTicketInput] = useState('');
  const [manualFieldsError, setManualFieldsError] = useState<string | null>(null);
  const [activityRows, setActivityRows] = useState<BackendActivity[]>([]);
  const [filesRows, setFilesRows] = useState<BackendFile[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<WorkItem>>({
    title: '',
    description: '',
    type: 'task',
    status: 'backlog',
    priority: 'medium',
    assignee: '',
    plannedDate: format(new Date(), 'yyyy-MM-dd'),
    ticket_number: undefined,
    operational_manual_fields: {},
    acceptance_manual_fields: {},
  });

  useEffect(() => {
    if (isNew) {
      setFormData({
        title: '',
        description: '',
        type: isTelecom ? 'site' : 'task',
        status: isTelecom ? 'needs_manual_completion' : 'backlog',
        priority: 'medium',
        assignee: '',
        plannedDate: format(new Date(), 'yyyy-MM-dd'),
        ticket_number: undefined,
        operational_manual_fields: {},
        acceptance_manual_fields: {},
      });
      setActivityRows([]);
      setFilesRows([]);
      setTicketInput('');
    } else if (existingItem) {
      setFormData({
        ...existingItem,
        operational_manual_fields: existingItem.operational_manual_fields || {},
        acceptance_manual_fields: existingItem.acceptance_manual_fields || {},
      });
      setTicketInput(formatDecimalInput(existingItem.ticket_number));
    }
    setSelectedFieldKey('');
    setSelectedFieldValue('');
    setManualFieldsError(null);
  }, [workItemId, existingItem, isNew, isTelecom]);

  const projectId = existingItem?.projectId || activeProjectId || '';

  useEffect(() => {
    if (!workItemId || isNew || !projectId || activeTab !== 'activity') return;
    let mounted = true;
    setTabLoading(true);
    fetchProjectItemActivities(projectId, workItemId)
      .then((response) => {
        if (mounted) setActivityRows(response.activities || []);
      })
      .catch(() => {
        if (mounted) setActivityRows([]);
      })
      .finally(() => {
        if (mounted) setTabLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, workItemId, isNew, projectId]);

  useEffect(() => {
    if (!workItemId || isNew || !projectId || activeTab !== 'files') return;
    let mounted = true;
    setTabLoading(true);
    fetchProjectItemFiles(projectId, workItemId)
      .then((response) => {
        if (mounted) setFilesRows(response.files || []);
      })
      .catch(() => {
        if (mounted) setFilesRows([]);
      })
      .finally(() => {
        if (mounted) setTabLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, workItemId, isNew, projectId]);

  const poCompletedPreview = useMemo(() => {
    const unit = Number(formData.po_unit_price ?? 0);
    const hasSignedAcceptance = (formData.acceptanceStatus || '').toLowerCase() === 'signed';
    if (!Number.isFinite(unit) || unit <= 0 || !hasSignedAcceptance) return undefined;
    return unit;
  }, [formData.po_unit_price, formData.acceptanceStatus]);

  const eligibility = useMemo(
    () =>
      evaluateFinancialEligibility({
        po_unit_price: formData.po_unit_price,
        ticket_number: formData.ticket_number,
        qaStatus: formData.qaStatus,
        acceptanceStatus: formData.acceptanceStatus,
      }),
    [formData.po_unit_price, formData.ticket_number, formData.qaStatus, formData.acceptanceStatus]
  );

  const currentOperationalFields = (formData.operational_manual_fields || {}) as Record<string, string | number | boolean | null>;
  const currentAcceptanceFields = (formData.acceptance_manual_fields || {}) as Record<string, string | number | boolean | null>;

  const availableFieldDefs = useMemo(() => {
    const source = manualGroup === 'operational' ? OPERATIONAL_MANUAL_FIELDS : ACCEPTANCE_MANUAL_FIELDS;
    const used = manualGroup === 'operational' ? currentOperationalFields : currentAcceptanceFields;
    return source.filter(
      (field) =>
        !field.computedReadonly && (
          field.key === selectedFieldKey ||
          used[field.key] === undefined ||
          used[field.key] === null ||
          used[field.key] === ''
        )
    );
  }, [manualGroup, currentOperationalFields, currentAcceptanceFields, selectedFieldKey]);

  if (!workItemId || (!existingItem && !isNew)) return null;

  const persistTelecomDetails = async (nextPatch: Partial<WorkItem>) => {
    if (!projectId || !workItemId || isNew) return;
    const merged = { ...formData, ...nextPatch };
    const response = await saveProjectItemDetailsToBackend({
      projectId,
      workItemId,
      actorUserId: user?.id,
      actorDisplayName: user?.name,
      poUnitPrice: merged.po_unit_price,
      ticketNumber: merged.ticket_number,
      contractorPayableAmount: merged.contractor_payable_amount,
      qaStatus: merged.qaStatus,
      acceptanceStatus: merged.acceptanceStatus,
      importedFields: merged.imported_fields as Record<string, unknown>,
      operationalManualFields: merged.operational_manual_fields as Record<string, unknown>,
      acceptanceManualFields: merged.acceptance_manual_fields as Record<string, unknown>,
    });

    const state = response.state;
    const operationalFromState = (state.operationalManualFieldsJson || merged.operational_manual_fields || {}) as Record<string, unknown>;
    const normalizeDate = (value: unknown): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      const asNumber = Number(value);
      if (Number.isFinite(asNumber) && asNumber > 0 && asNumber < 100000) {
        const epoch = Date.UTC(1899, 11, 30);
        const excelDate = new Date(epoch + Math.round(asNumber) * 86400000);
        const year = excelDate.getUTCFullYear();
        if (year >= 2000 && year <= 2100) return excelDate.toISOString().slice(0, 10);
      }
      const raw = String(value).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
      const date = new Date(`${raw}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) return undefined;
      const year = date.getUTCFullYear();
      if (year < 2000 || year > 2100) return undefined;
      return raw;
    };

    const weekOf = (value: unknown): number | undefined => {
      const normalized = normalizeDate(value);
      if (!normalized) return undefined;
      const date = new Date(`${normalized}T00:00:00.000Z`);
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };
    const planningAuditWeek = weekOf(operationalFromState.planning_audit_date);
    const forecastWeek = weekOf(operationalFromState.forecast_date);
    const actualAuditWeek = weekOf(operationalFromState.actual_audit_date);
    const plannedStart = normalizeDate(merged.imported_fields?.planned_start_date) || normalizeDate(merged.imported_fields?.planning_audit_date) || normalizeDate(operationalFromState.planning_audit_date);
    const actualAuditDate = normalizeDate(operationalFromState.actual_audit_date);
    let scheduleStatus: WorkItem['schedule_status'] = 'pending';
    let startVarianceDays: number | undefined;
    if (plannedStart && actualAuditDate) {
      const planned = new Date(plannedStart + 'T00:00:00.000Z');
      const actual = new Date(actualAuditDate + 'T00:00:00.000Z');
      if (!Number.isNaN(planned.getTime()) && !Number.isNaN(actual.getTime())) {
        const variance = Math.round((actual.getTime() - planned.getTime()) / 86400000);
        if (Number.isFinite(variance) && Math.abs(variance) <= 3650) {
          startVarianceDays = variance;
          scheduleStatus = startVarianceDays > 0 ? 'delayed' : startVarianceDays < 0 ? 'early' : 'on_time';
        }
      }
    }

    updateWorkItem(workItemId, {
      ...merged,
      po_unit_price: parseNumberLike(state.poUnitPrice) ?? merged.po_unit_price,
      ticket_number: parseNumberLike(state.ticketNumber),
      qaStatus: (state.qaStatus as WorkItem['qaStatus']) || merged.qaStatus,
      acceptanceStatus: (state.acceptanceStatus as WorkItem['acceptanceStatus']) || merged.acceptanceStatus,
      operational_manual_fields: (state.operationalManualFieldsJson || merged.operational_manual_fields) as Record<string, string | number | boolean | null>,
      acceptance_manual_fields: (state.acceptanceManualFieldsJson || merged.acceptance_manual_fields) as Record<string, string | number | boolean | null>,
      planning_audit_date: normalizeDate(operationalFromState.planning_audit_date),
      planning_audit_week: planningAuditWeek,
      forecast_date: normalizeDate(operationalFromState.forecast_date),
      forecast_week: forecastWeek,
      actual_audit_date: actualAuditDate,
      actual_audit_week: actualAuditWeek,
      start_variance_days: startVarianceDays,
      schedule_status: scheduleStatus,
      is_delayed: scheduleStatus === 'delayed',
      po_unit_price_completed: parseNumberLike(state.poUnitPriceCompleted),
      contractor_payable_amount: parseNumberLike(state.contractorPayableAmount),
      is_financially_eligible: state.isFinanciallyEligible,
      financial_eligibility_reason: state.financialEligibilityReason || undefined,
      finance_sync_status: (state.financeSyncStatus as WorkItem['finance_sync_status']) || undefined,
      finance_sync_at: state.financeSyncAt || undefined,
      finance_reference_id: state.financeReferenceId || undefined,
      finance_error_message: state.financeErrorMessage || undefined,
    });

    if (activeTab === 'activity') {
      const refreshed = await fetchProjectItemActivities(projectId, workItemId);
      setActivityRows(refreshed.activities || []);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !activeProjectId) return;
    const normalizedTicket = parseDecimalInput(ticketInput);
    const nextFormData = { ...formData, ticket_number: normalizedTicket };
    if (isNew) {
      addWorkItem({
        ...(nextFormData as Omit<WorkItem, 'id'>),
        projectId: activeProjectId,
        status: nextFormData.status || 'backlog',
        type: (nextFormData.type as WorkItemType) || 'task',
        priority: nextFormData.priority || 'medium',
      });
      if (activeProjectId) {
        void notifyProjectTeam(activeProjectId, {
          actionType: 'task_created',
          message: `${user?.name || 'User'} created task ${nextFormData.title || ''}`.trim(),
          actorUserId: user?.id,
          actorDisplayName: user?.name,
          meta: { title: nextFormData.title || null },
        }).catch(() => {});
      }
      onClose();
      return;
    }

    try {
      setFormData(nextFormData);
      if (isTelecom) {
        await persistTelecomDetails({
          ticket_number: normalizedTicket,
          contractor_payable_amount: parseNumberLike(nextFormData.contractor_payable_amount),
        });
      }
      else if (workItemId) updateWorkItem(workItemId, nextFormData);
      onClose();
    } catch (error) {
      setManualFieldsError(error instanceof Error ? error.message : 'Unable to save item details.');
    }
  };

  const toFieldValueByType = (field: ManualFieldDef, raw: string): string | number | boolean | null => {
    if (!raw) return null;
    if (field.type === 'number') {
      const parsed = parseDecimalInput(raw);
      return parsed === undefined ? null : parsed;
    }
    if (field.type === 'boolean') return raw === 'true';
    return raw;
  };

  const addManualFieldValue = async () => {
    if (!selectedFieldKey) {
      setManualFieldsError('Please choose a field.');
      return;
    }
    const def = fieldDefByKey(manualGroup, selectedFieldKey);
    if (!def) return;

    const normalized = toFieldValueByType(def, selectedFieldValue);
    const source = manualGroup === 'operational' ? currentOperationalFields : currentAcceptanceFields;
    const next = { ...source, [selectedFieldKey]: normalized };
    const patch: Partial<WorkItem> = manualGroup === 'operational' ? { operational_manual_fields: next } : { acceptance_manual_fields: next };

    setFormData((prev) => ({ ...prev, ...patch }));
    setSelectedFieldKey('');
    setSelectedFieldValue('');
    setManualFieldsError(null);

    try {
      await persistTelecomDetails(patch);
    } catch (error) {
      setManualFieldsError(error instanceof Error ? error.message : 'Unable to persist manual field.');
    }
  };

  const removeManualFieldValue = async (group: ManualGroup, key: string) => {
    const source = group === 'operational' ? currentOperationalFields : currentAcceptanceFields;
    const next = { ...source };
    delete next[key];
    const patch: Partial<WorkItem> = group === 'operational' ? { operational_manual_fields: next } : { acceptance_manual_fields: next };
    setFormData((prev) => ({ ...prev, ...patch }));

    try {
      await persistTelecomDetails(patch);
    } catch (error) {
      setManualFieldsError(error instanceof Error ? error.message : 'Unable to remove manual field.');
    }
  };

  const renderDynamicValueInput = () => {
    const def = fieldDefByKey(manualGroup, selectedFieldKey);
    if (!def) return <input disabled value="" className="w-full mt-1 bg-surface border border-border/70 rounded-lg px-3 py-2 text-xs text-muted" placeholder="Select a field first" />;

    if (def.type === 'date') return <input type="date" value={selectedFieldValue} onChange={(e) => setSelectedFieldValue(e.target.value)} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary " />;
    if (def.type === 'boolean') return <select value={selectedFieldValue} onChange={(e) => setSelectedFieldValue(e.target.value)} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"><option value="">Select value</option><option value="true">Yes</option><option value="false">No</option></select>;
    if (def.type === 'enum') return <select value={selectedFieldValue} onChange={(e) => setSelectedFieldValue(e.target.value)} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"><option value="">Select value</option>{(def.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>;
    if (def.type === 'number') return <input type="number" value={selectedFieldValue} onChange={(e) => setSelectedFieldValue(e.target.value)} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary" placeholder="Enter numeric value" />;
    return <input type="text" value={selectedFieldValue} onChange={(e) => setSelectedFieldValue(e.target.value)} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary" placeholder="Enter value" />;
  };

  const handleUploadFile = async (file: File) => {
    if (!projectId || !workItemId || isNew) return;
    setTabLoading(true);
    try {
      await uploadProjectItemFileToBackend({ projectId, workItemId, file, actorUserId: user?.id, actorDisplayName: user?.name });
      const [filesResponse, activityResponse] = await Promise.all([
        fetchProjectItemFiles(projectId, workItemId),
        fetchProjectItemActivities(projectId, workItemId),
      ]);
      setFilesRows(filesResponse.files || []);
      setActivityRows(activityResponse.activities || []);
    } catch (error) {
      setManualFieldsError(error instanceof Error ? error.message : 'File upload failed.');
    } finally {
      setTabLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!projectId || !workItemId || isNew) return;
    try {
      await deleteProjectItemFileFromBackend({ fileId, actorUserId: user?.id, actorDisplayName: user?.name });
      const [filesResponse, activityResponse] = await Promise.all([
        fetchProjectItemFiles(projectId, workItemId),
        fetchProjectItemActivities(projectId, workItemId),
      ]);
      setFilesRows(filesResponse.files || []);
      setActivityRows(activityResponse.activities || []);
    } catch (error) {
      setManualFieldsError(error instanceof Error ? error.message : 'File delete failed.');
    }
  };

  const activeFields = manualGroup === 'operational' ? currentOperationalFields : currentAcceptanceFields;
  const groupDefs = manualGroup === 'operational' ? OPERATIONAL_MANUAL_FIELDS : ACCEPTANCE_MANUAL_FIELDS;

  return (
    <AnimatePresence>
      {workItemId && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="absolute right-0 top-0 bottom-0 w-[760px] bg-app border-l border-border/60 z-50 flex flex-col shadow-2xl">
            <div className="p-6 border-b border-border/60 flex items-start justify-between bg-card">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-muted">{isNew ? 'NEW' : existingItem?.id}</span>
                  <div className="relative group">
                    <select value={formData.status} onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as WorkItemStatus }))} className="appearance-none bg-transparent border-none p-0 pr-4 text-xs focus:ring-0 cursor-pointer text-blue-400 font-bold uppercase">
                      {(isTelecom ? ['imported','needs_manual_completion','awaiting_qa_approval','awaiting_signed_acceptance','awaiting_financial_eligibility','ready_for_calculation','finance_pending','finance_synced','finance_sync_error','complete'] : ['backlog','pending','in-progress','pending-qa','pending-acceptance','done']).map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
                  </div>
                </div>
                <input type="text" value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))} placeholder="Enter item title..." className="w-full bg-transparent border-none p-0 text-3xl font-bold text-primary leading-tight focus:ring-0 placeholder:text-muted" />
              </div>
              <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors"><X size={20} /></button>
            </div>

            <div className="px-6 border-b border-border/60 flex gap-6">{(['details', 'activity', 'files'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'text-blue-400 border-blue-400' : 'text-muted border-transparent hover:text-primary'}`}>{tab}</button>)}</div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-muted">Assignee</label><input type="text" value={formData.assignee || ''} onChange={(e) => setFormData((prev) => ({ ...prev, assignee: e.target.value }))} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary" /></div>
                    <div><label className="text-xs text-muted">Type</label><select value={formData.type} onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as WorkItemType }))} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"><option value="task">Task</option><option value="milestone">Milestone</option><option value="deliverable">Deliverable</option><option value="issue">Issue</option><option value="site">Site</option></select></div>
                    <div><label className="text-xs text-muted">Planned Date</label><div className="relative"><Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" /><input type="date" value={formData.plannedDate} onChange={(e) => setFormData((prev) => ({ ...prev, plannedDate: e.target.value }))} className="w-full mt-1 bg-surface border border-input rounded-lg pl-9 pr-3 py-2 text-xs text-primary " /></div></div>
                    <div><label className="text-xs text-muted">Priority</label><select value={formData.priority} onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value as any }))} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                  </div>

                  {isTelecom && (
                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2 text-cyan-300"><Calculator size={16} /> Telecom Completion Fields</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs text-muted">PO Unit Price (Imported, read-only)</label><input value={String(formData.po_unit_price ?? '')} readOnly className="w-full mt-1 bg-surface border border-border/70 rounded-lg px-3 py-2 text-xs text-secondary" /></div>
                        <div><label className="text-xs text-muted">Ticket Number (Manual)</label><input type="text" inputMode="decimal" value={ticketInput} onChange={(e) => { const raw = e.target.value; if (!/^\d*([.,]\d*)?$/.test(raw)) return; setTicketInput(raw); const parsed = parseDecimalInput(raw); if (raw === '' || /[.,]$/.test(raw)) return; setFormData((prev) => ({ ...prev, ticket_number: parsed })); }} onBlur={() => { const parsed = parseDecimalInput(ticketInput); setFormData((prev) => ({ ...prev, ticket_number: parsed })); setTicketInput(parsed === undefined ? '' : String(parsed)); }} placeholder="Ex: 0.7" className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary" /></div>
                        <div><label className="text-xs text-muted">QA Status (Gate)</label><select value={formData.qaStatus || 'pending'} onChange={(e) => setFormData((prev) => ({ ...prev, qaStatus: e.target.value as WorkItem['qaStatus'] }))} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
                        <div><label className="text-xs text-muted">Acceptance Status (Gate)</label><select value={formData.acceptanceStatus || 'pending'} onChange={(e) => setFormData((prev) => ({ ...prev, acceptanceStatus: e.target.value as WorkItem['acceptanceStatus'] }))} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"><option value="pending">Pending</option><option value="signed">Signed</option><option value="rejected">Rejected</option></select></div>
                        <div><label className="text-xs text-muted">PO Unit Price Completed (Auto: Acceptance Signed)</label><input value={poCompletedPreview !== undefined ? String(poCompletedPreview) : '-'} readOnly className="w-full mt-1 bg-surface border border-border/70 rounded-lg px-3 py-2 text-xs text-emerald-300" /></div>
                        <div>
                          <label className="text-xs text-muted">Contractor Payable Amount (Manual - Negotiated)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.contractor_payable_amount !== undefined && formData.contractor_payable_amount !== null ? String(formData.contractor_payable_amount) : ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (!/^\d*([.,]\d*)?$/.test(raw)) return;
                              if (raw === '') {
                                setFormData((prev) => ({ ...prev, contractor_payable_amount: undefined }));
                                return;
                              }
                              const parsed = parseDecimalInput(raw);
                              setFormData((prev) => ({ ...prev, contractor_payable_amount: parsed }));
                            }}
                            placeholder="Ex: 382.5"
                            className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"
                          />
                        </div>
                        <div><label className="text-xs text-muted">Schedule Status</label><input value={formData.schedule_status ? String(formData.schedule_status).replace('_', ' ') : '-'} readOnly className="w-full mt-1 bg-surface border border-border/70 rounded-lg px-3 py-2 text-xs text-secondary" /></div>
                        <div><label className="text-xs text-muted">Start Variance (Days)</label><input value={typeof formData.start_variance_days === 'number' ? String(formData.start_variance_days) : '-'} readOnly className="w-full mt-1 bg-surface border border-border/70 rounded-lg px-3 py-2 text-xs text-secondary" /></div>
                      </div>

                      {/* Audit Dates & Delay Panel */}
                      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
                        <p className="text-xs font-semibold text-indigo-300 flex items-center gap-2"><Calendar size={14} /> Audit Dates & Delay Tracking</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted">Planning Audit Date (Imported — Baseline)</label>
                            <input
                              type="date"
                              value={formData.planning_audit_date || formData.imported_fields?.planning_audit_date || ''}
                              readOnly
                              className="w-full mt-1 bg-surface border border-border/70 rounded-lg px-3 py-2 text-xs text-secondary cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted">Forecast Date (Editable)</label>
                            <input
                              type="date"
                              value={formData.forecast_date || ''}
                              onChange={(e) => {
                                const newForecast = e.target.value;
                                const planDate = formData.planning_audit_date || formData.imported_fields?.planning_audit_date;
                                let delayDays: number | undefined;
                                let delayWeeks: number | undefined;
                                let schedStatus: WorkItem['schedule_status'] = 'pending';
                                if (planDate && newForecast) {
                                  const pMs = new Date(planDate + 'T00:00:00Z').getTime();
                                  const fMs = new Date(newForecast + 'T00:00:00Z').getTime();
                                  if (Number.isFinite(pMs) && Number.isFinite(fMs)) {
                                    delayDays = Math.round((fMs - pMs) / 86400000);
                                    delayWeeks = delayDays === 0 ? 0 : delayDays > 0 ? Math.ceil(delayDays / 7) : -Math.ceil(Math.abs(delayDays) / 7);
                                    schedStatus = delayDays > 0 ? 'delayed' : delayDays < 0 ? 'early' : 'on_time';
                                  }
                                }
                                setFormData((prev) => ({
                                  ...prev,
                                  forecast_date: newForecast,
                                  delay_days: delayDays,
                                  delay_weeks: delayWeeks,
                                  schedule_status: schedStatus,
                                  start_variance_days: delayDays,
                                  is_delayed: (delayDays ?? 0) > 0,
                                }));
                              }}
                              className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted">Actual Audit Date</label>
                            <input
                              type="date"
                              value={formData.actual_audit_date || ''}
                              readOnly={Boolean(formData.imported_fields?.actual_audit_date)}
                              onChange={(e) => setFormData((prev) => ({ ...prev, actual_audit_date: e.target.value }))}
                              className={`w-full mt-1 bg-surface border rounded-lg px-3 py-2 text-xs ${formData.imported_fields?.actual_audit_date ? 'border-border/70 text-secondary cursor-not-allowed' : 'border-input text-primary'}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted">Delay</label>
                            <div className={`w-full mt-1 rounded-lg px-3 py-2 text-xs font-semibold border ${
                              typeof formData.delay_days === 'number'
                                ? formData.delay_days > 0
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                  : formData.delay_days < 0
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-surface border-border/70 text-muted'
                            }`}>
                              {typeof formData.delay_days === 'number'
                                ? `${formData.delay_days > 0 ? '+' : ''}${formData.delay_days} day${Math.abs(formData.delay_days) !== 1 ? 's' : ''} (${formData.delay_days > 0 ? '+' : ''}${formData.delay_weeks ?? 0} week${Math.abs(formData.delay_weeks ?? 0) !== 1 ? 's' : ''})`
                                : 'No delay data'}
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted">Planning date is the imported baseline. Editing the forecast date recalculates the delay automatically.</p>
                      </div>

                      <div className="rounded-xl border border-border/70 p-4 bg-surface space-y-4">
                        <div className="flex gap-2"><button onClick={() => setManualGroup('operational')} className={`px-3 py-1.5 rounded-lg text-xs ${manualGroup === 'operational' ? 'bg-blue-600 text-white' : 'bg-surface text-secondary'}`}>Operational Fields (N:X)</button><button onClick={() => setManualGroup('acceptance')} className={`px-3 py-1.5 rounded-lg text-xs ${manualGroup === 'acceptance' ? 'bg-blue-600 text-white' : 'bg-surface text-secondary'}`}>Acceptance Fields (Z:AD)</button></div>
                        <div className="grid grid-cols-3 gap-3 items-end">
                          <div><label className="text-xs text-muted">Field</label><select value={selectedFieldKey} onChange={(e) => { setSelectedFieldKey(e.target.value); setSelectedFieldValue(''); }} className="w-full mt-1 bg-surface border border-input rounded-lg px-3 py-2 text-xs text-primary"><option value="">Select field</option>{availableFieldDefs.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></div>
                          <div><label className="text-xs text-muted">Value</label>{renderDynamicValueInput()}</div>
                          <div><button onClick={addManualFieldValue} type="button" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg px-3 py-2">Add / Update</button></div>
                        </div>
                        <div className="space-y-2">{groupDefs.filter((field) => activeFields[field.key] !== undefined && activeFields[field.key] !== null && activeFields[field.key] !== '').map((field) => <div key={field.key} className="flex items-center justify-between rounded-lg border border-border/70 bg-surface px-3 py-2"><div><p className="text-xs text-secondary">{field.label}</p><p className="text-[11px] text-muted">{formatManualFieldValue(activeFields[field.key])}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => { setSelectedFieldKey(field.key); setSelectedFieldValue(String(activeFields[field.key] ?? '')); }} className="text-[11px] px-2 py-1 rounded border border-input text-secondary hover:text-primary">Edit</button><button type="button" onClick={() => void removeManualFieldValue(manualGroup, field.key)} className="text-rose-400 hover:text-rose-300"><Trash2 size={14} /></button></div></div>)}{Object.keys(activeFields).length === 0 && <p className="text-xs text-muted">No manual fields completed yet.</p>}</div>
                      </div>

                      <p className="text-[11px] text-muted">Imported fields (B:M, AE) are read-only. Manual fields are structured and auditable.</p>
                      <p className="text-[11px] text-amber-300">{eligibility.is_financially_eligible ? 'Eligible for calculation and finance sync.' : eligibility.financial_eligibility_reason}</p>
                      {manualFieldsError && <p className="text-[11px] text-rose-400">{manualFieldsError}</p>}
                    </div>
                  )}

                  <div><label className="text-xs text-muted">Description</label><textarea value={formData.description || ''} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} className="w-full mt-1 bg-card border border-border/60 rounded-lg p-3 min-h-[100px] text-sm text-secondary" /></div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-3">{tabLoading && <p className="text-xs text-muted">Loading activity...</p>}{!tabLoading && activityRows.length === 0 && <div className="text-center py-10 text-muted"><MessageSquare size={32} className="mx-auto mb-3 opacity-20" /><p>No activity recorded yet.</p></div>}{activityRows.map((row) => <div key={row.id} className="rounded-lg border border-border/70 bg-surface px-3 py-2"><div className="flex items-center justify-between text-[11px] text-muted"><span>{row.actorDisplayName || 'System'} - {row.eventSource}</span><span>{new Date(row.createdAt).toLocaleString()}</span></div><p className="text-xs text-primary mt-1">{row.message}</p></div>)}</div>
              )}

              {activeTab === 'files' && (
                <div className="space-y-4">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs cursor-pointer"><Upload size={14} /> Upload File<input type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleUploadFile(file); }} /></label>
                  {tabLoading && <p className="text-xs text-muted">Loading files...</p>}
                  {!tabLoading && filesRows.length === 0 && <p className="text-muted">No files attached.</p>}
                  {filesRows.map((file) => <div key={file.id} className="rounded-lg border border-border/70 bg-surface px-3 py-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-primary truncate flex items-center gap-2"><FileText size={14} /> {file.originalFileName}</p><p className="text-[11px] text-muted">{Math.round(file.sizeBytes / 1024)} KB - {file.uploadedByName || 'User'} - {new Date(file.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-2 shrink-0"><a href={getProjectItemFileDownloadUrl(file.id)} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border border-input text-secondary hover:text-primary">Open</a><button type="button" onClick={() => void handleDeleteFile(file.id)} className="text-rose-400 hover:text-rose-300"><Trash2 size={14} /></button></div></div>)}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border/60 bg-card flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-primary hover:bg-surface transition-colors">Cancel</button>{activeTab === 'details' && <button onClick={() => void handleSave()} disabled={!formData.title} className="px-6 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isNew ? 'Create Item' : 'Save Changes'}</button>}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WorkItemDrawer;









