// HRM-2.1 — Recruitment page. Refactored to use the DB-driven
// /api/v1/hrm/recruitment/* endpoints. Kanban + drag-drop UX preserved
// from the previous version; data layer swapped from useHRMStore to
// recruitmentApi. Also migrates can() -> usePermissions() (one of the
// 10 can() consumers tracked since HRM-1.2).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Mail, Phone, ChevronRight, X, GripVertical, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '../../ui/PageHeader';
import StatusChip from '../../ui/StatusChip';
import Drawer from '../../ui/Drawer';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../lib/rbac';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import CandidateHiredModal from './CandidateHiredModal';
import JobPostingList from './JobPostingList';
import {
  recruitmentApi,
  type CandidateRow,
  type CandidateStatus,
} from '../../../services/recruitmentApi';
import type { Candidate, CandidateStage, HirePayload } from '../../../types/hrm';

// ─── Stage config ─────────────────────────────────────────────────
type DisplayStage = Exclude<CandidateStage, never>; // identical to CandidateStage
const STAGES: { id: DisplayStage; label: string; accent: string; glow: string; headerColor: string }[] = [
    { id: 'sourced', label: 'Sourced', accent: 'border-t-slate-500', glow: 'ring-slate-500/40', headerColor: 'text-muted' },
    { id: 'screening', label: 'Screening', accent: 'border-t-blue-500', glow: 'ring-blue-500/40', headerColor: 'text-blue-400' },
    { id: 'interview', label: 'Interview', accent: 'border-t-purple-500', glow: 'ring-purple-500/40', headerColor: 'text-purple-400' },
    { id: 'offer', label: 'Offer', accent: 'border-t-amber-500', glow: 'ring-amber-500/40', headerColor: 'text-amber-400' },
    { id: 'hired', label: 'Hired', accent: 'border-t-emerald-500', glow: 'ring-emerald-500/40', headerColor: 'text-emerald-400' },
    { id: 'rejected', label: 'Rejected', accent: 'border-t-red-500', glow: 'ring-red-500/40', headerColor: 'text-red-400' },
];

// Adapt the server CandidateRow to the legacy Candidate shape so the
// existing kanban / drawer can keep using their current types untouched.
// Server has 7 statuses (incl. 'onboarding'); we collapse 'onboarding'
// into the 'hired' column for display.
function adapt(row: CandidateRow): Candidate {
  const stage: DisplayStage = row.statusCode === 'onboarding' ? 'hired' : (row.statusCode as DisplayStage);
  return {
    id: row.id,
    name: row.fullName,
    email: row.personalEmail,
    phone: row.phone ?? undefined,
    position: row.position,
    stage,
    appliedDate: row.createdAt,
    notes: [],
    onboardingPending: row.statusCode === 'hired',
    linkedEmployeeId: row.hiredUserId ?? undefined,
  };
}

// Map UI drag target back to the server stage (kanban only exposes 6
// stages; nothing to do for valid ones, just narrow the type).
const UI_STAGE_TO_SERVER: Record<DisplayStage, CandidateStatus> = {
  sourced: 'sourced',
  screening: 'screening',
  interview: 'interview',
  offer: 'offer',
  hired: 'hired',           // routed via /hire endpoint, never via /stage
  rejected: 'rejected',     // routed via /reject endpoint
};

// ─── Candidate Card ───────────────────────────────────────────────
interface CandidateCardProps {
    candidate: Candidate;
    onCardClick: (c: Candidate) => void;
    onDragStart: (candidateId: string) => void;
    onStartOnboarding?: (c: Candidate) => void;
    isDragging: boolean;
}

const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, onCardClick, onDragStart, onStartOnboarding, isDragging }) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('candidateId', candidate.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(candidate.id);
    };
    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onClick={() => !isDragging && onCardClick(candidate)}
            className={`bg-card rounded-lg border border-border p-3 hover:border-border/80 transition-all group select-none cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30 scale-95' : 'opacity-100'}`}
        >
            <div className="flex items-start gap-2">
                <GripVertical size={14} className="text-secondary mt-0.5 flex-none opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                            <h4 className="text-[13px] font-semibold text-primary truncate">{candidate.name}</h4>
                            <p className="text-[11px] text-muted truncate mt-0.5">{candidate.position}</p>
                        </div>
                        {candidate.onboardingPending && !candidate.linkedEmployeeId && (
                            <span className="flex-none flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-bold text-amber-400 uppercase tracking-wide whitespace-nowrap">
                                hire pending
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted mb-2">
                        <Mail size={10} className="flex-none" />
                        <span className="truncate">{candidate.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted">
                            {new Date(candidate.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                    {candidate.onboardingPending && !candidate.linkedEmployeeId && onStartOnboarding && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStartOnboarding(candidate); }}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-md text-[11px] font-semibold text-emerald-400 transition-colors"
                        >
                            <CheckCircle2 size={11} /> Start onboarding
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Kanban Column ────────────────────────────────────────────────
interface KanbanColumnProps {
    stage: typeof STAGES[number];
    candidates: Candidate[];
    isOver: boolean;
    onCardClick: (c: Candidate) => void;
    onDragStart: (id: string) => void;
    onDragOver: (s: DisplayStage) => void;
    onDragLeave: () => void;
    onDrop: (s: DisplayStage) => void;
    onStartOnboarding: (c: Candidate) => void;
    draggingId: string | null;
}
const KanbanColumn: React.FC<KanbanColumnProps> = ({ stage, candidates, isOver, onCardClick, onDragStart, onDragOver, onDragLeave, onDrop, onStartOnboarding, draggingId }) => {
    return (
        <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(stage.id); }}
            onDragLeave={onDragLeave}
            onDrop={(e) => { e.preventDefault(); onDrop(stage.id); }}
            className={`w-72 flex-none flex flex-col rounded-xl border-t-2 ${stage.accent} transition-all duration-150 ${isOver ? `ring-2 ${stage.glow} bg-surface border border-border` : 'bg-surface border border-border'}`}
        >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
                <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-semibold transition-colors ${isOver ? stage.headerColor : 'text-primary'}`}>{stage.label}</span>
                    <motion.span key={candidates.length} initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="text-[11px] text-muted bg-surface px-2 py-0.5 rounded-full tabular-nums">
                        {candidates.length}
                    </motion.span>
                </div>
                {isOver && <span className={`text-[10px] font-semibold ${stage.headerColor} animate-pulse`}>Drop here</span>}
            </div>
            <div className="flex-1 p-3 space-y-2 min-h-[120px] overflow-y-auto">
                <AnimatePresence mode="popLayout">
                    {candidates.map(c => (
                        <motion.div key={c.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.15 }}>
                            <CandidateCard candidate={c} onCardClick={onCardClick} onDragStart={onDragStart} onStartOnboarding={c.onboardingPending && !c.linkedEmployeeId ? onStartOnboarding : undefined} isDragging={draggingId === c.id} />
                        </motion.div>
                    ))}
                </AnimatePresence>
                {candidates.length === 0 && (
                    <div className={`flex items-center justify-center h-20 rounded-lg border border-dashed transition-colors ${isOver ? 'border-input bg-surface' : 'border-border/60'}`}>
                        <span className="text-[11px] text-secondary">Drop here</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Reject Modal ─────────────────────────────────────────────────
interface RejectModalProps { candidate: Candidate | null; isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void; }
const RejectModal: React.FC<RejectModalProps> = ({ candidate, isOpen, onClose, onConfirm }) => {
    const [reason, setReason] = useState('');
    if (!candidate) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Reject candidate" size="sm"
            footer={
                <>
                    <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface">Cancel</button>
                    <button onClick={() => { onConfirm(reason); setReason(''); }} className="px-4 py-2 text-[13px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2">
                        <X size={14} /> Reject
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-[13px] text-muted">Reject <strong className="text-primary">{candidate.name}</strong> for <strong className="text-primary">{candidate.position}</strong>?</p>
                <div>
                    <label className="block text-[12px] font-semibold text-muted mb-1.5">Reason (optional)</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Not enough experience..." rows={3}
                        className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-red-500/50 resize-none" />
                </div>
            </div>
        </Modal>
    );
};

// ─── Main Page ────────────────────────────────────────────────────
interface RecruitmentPageProps { onNavigate?: (view: string) => void; }

const RecruitmentPage: React.FC<RecruitmentPageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const { has, isReady } = usePermissions();
    const { departments } = useHRMStore();
    const toast = useToast();
    const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => toast?.addToast(msg, type === 'info' ? 'success' : type);

    const actorUserId = user?.id ?? '';
    const canWrite   = isReady && has('hrm.recruitment.write');
    const canExecute = isReady && has('hrm.recruitment.execute');
    const canManagePostings = isReady && has('hrm.recruitment.write');

    const [rows, setRows] = useState<CandidateRow[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);

    // Drag state
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [overStageId, setOverStageId] = useState<DisplayStage | null>(null);
    const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modal state
    const [hireFlowCandidate, setHireFlowCandidate] = useState<Candidate | null>(null);
    const [rejectModalCandidate, setRejectModalCandidate] = useState<Candidate | null>(null);

    // Drawer state
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Add modal
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPosition, setNewPosition] = useState('');
    const [newDepartmentId, setNewDepartmentId] = useState('');

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await recruitmentApi.listCandidates(selectedPostingId ? { jobPostingId: selectedPostingId } : {});
            setRows(r.candidates);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load candidates');
        } finally {
            setLoading(false);
        }
    }, [selectedPostingId]);
    useEffect(() => { void reload(); }, [reload]);

    const candidates = useMemo(() => (rows ?? []).map(adapt), [rows]);
    const stageGroups = useMemo(() => {
        const groups: Record<DisplayStage, Candidate[]> = { sourced: [], screening: [], interview: [], offer: [], hired: [], rejected: [] };
        candidates.forEach(c => groups[c.stage].push(c));
        return groups;
    }, [candidates]);

    const handleDragStart = useCallback((id: string) => setDraggingId(id), []);
    const handleDragOver = useCallback((stageId: DisplayStage) => {
        if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
        setOverStageId(stageId);
    }, []);
    const handleDragLeave = useCallback(() => {
        dragLeaveTimer.current = setTimeout(() => setOverStageId(null), 50);
    }, []);

    const handleDrop = useCallback(async (targetStage: DisplayStage) => {
        if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
        setOverStageId(null);
        if (!draggingId) return;
        const candidate = candidates.find(c => c.id === draggingId);
        setDraggingId(null);
        if (!candidate || candidate.stage === targetStage) return;

        if (targetStage === 'rejected') {
            setRejectModalCandidate(candidate);
            return;
        }
        if (targetStage === 'hired') {
            setHireFlowCandidate(candidate);
            return;
        }
        if (!canWrite) {
            notify('Permission denied: hrm.recruitment.write required', 'error');
            return;
        }
        try {
            await recruitmentApi.updateStage(candidate.id, { statusCode: UI_STAGE_TO_SERVER[targetStage] }, actorUserId);
            notify(`${candidate.name} → ${STAGES.find(s => s.id === targetStage)?.label}`, 'info');
            await reload();
        } catch (e) {
            notify(e instanceof Error ? e.message : 'Stage update failed', 'error');
        }
    }, [draggingId, candidates, canWrite, actorUserId, notify, reload]);

    const handleHireConfirm = useCallback(async (_payload: HirePayload) => {
        if (!hireFlowCandidate) return;
        const professionalEmail = hireFlowCandidate.email.replace(/@.*/, '@neox.local').toLowerCase();
        try {
            await recruitmentApi.hire(hireFlowCandidate.id, { professionalEmail }, actorUserId);
            notify(`${hireFlowCandidate.name} hired and provisioned.`, 'success');
            await reload();
            // Keep modal open so the user sees the success state (existing UX).
        } catch (e) {
            notify(e instanceof Error ? e.message : 'Hire failed', 'error');
        }
    }, [hireFlowCandidate, actorUserId, notify, reload]);

    const handleHireDoLater = useCallback(() => {
        if (!hireFlowCandidate) return;
        notify(`${hireFlowCandidate.name} kept in 'hired' bucket — start onboarding when ready.`, 'info');
        setHireFlowCandidate(null);
    }, [hireFlowCandidate, notify]);

    const handleRejectConfirm = useCallback(async (reason: string) => {
        if (!rejectModalCandidate) return;
        try {
            await recruitmentApi.reject(rejectModalCandidate.id, reason || undefined, actorUserId);
            notify(`${rejectModalCandidate.name} rejected.`, 'error');
            setRejectModalCandidate(null);
            await reload();
        } catch (e) {
            notify(e instanceof Error ? e.message : 'Reject failed', 'error');
        }
    }, [rejectModalCandidate, actorUserId, notify, reload]);

    const handleRejectCancel = useCallback(() => { setRejectModalCandidate(null); }, []);

    const handleAddCandidate = async () => {
        if (!newName.trim() || !newEmail.trim() || !newPosition.trim() || !newDepartmentId) return;
        try {
            await recruitmentApi.createCandidate({
                fullName: newName.trim(),
                personalEmail: newEmail.trim(),
                position: newPosition.trim(),
                recruitmentDepartmentId: newDepartmentId,
                jobPostingId: selectedPostingId ?? undefined,
            }, actorUserId);
            notify(`${newName} added to pipeline`, 'success');
            setAddModalOpen(false);
            setNewName(''); setNewEmail(''); setNewPosition(''); setNewDepartmentId('');
            await reload();
        } catch (e) {
            notify(e instanceof Error ? e.message : 'Add failed', 'error');
        }
    };

    const currentCandidate = selectedCandidate
        ? candidates.find(c => c.id === selectedCandidate.id) ?? selectedCandidate
        : null;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-app">
            <PageHeader
                title="Recruitment"
                subtitle={`${candidates.length} candidates · ${stageGroups.hired.length} hired`}
                actions={
                    <div className="flex items-center gap-2">
                        <button onClick={() => void reload()} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-secondary hover:bg-border" title="Refresh">
                            <RefreshCw size={14} /> Refresh
                        </button>
                        {canWrite && (
                            <button onClick={() => setAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
                                <Plus size={15} /> Add candidate
                            </button>
                        )}
                    </div>
                }
            />

            <div className="px-6 pt-4">
                <JobPostingList
                    actorUserId={actorUserId}
                    departments={departments}
                    canManage={canManagePostings}
                    selectedPostingId={selectedPostingId}
                    onSelectPosting={setSelectedPostingId}
                />
            </div>

            {error && (
                <div role="alert" className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
                    <span>{error}</span>
                    <button type="button" onClick={() => void reload()} className="rounded border border-red-500/30 px-2 py-0.5 text-[11px] hover:bg-red-500/10">Retry</button>
                </div>
            )}

            {/* Kanban */}
            <div className="flex-1 overflow-x-auto p-6">
                {loading && !rows ? (
                    <div className="flex gap-4 h-full">
                        {STAGES.map(s => <div key={s.id} className="w-72 h-full animate-pulse rounded-xl border border-border bg-surface/40" />)}
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="rounded-xl border border-dashed border-border bg-surface/30 p-10 text-center">
                            <p className="text-[13px] text-muted">{selectedPostingId ? 'No candidate on this posting yet.' : 'No candidate in the pipeline yet.'}</p>
                            {canWrite && (
                                <button onClick={() => setAddModalOpen(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
                                    <Plus size={14} /> Add the first candidate
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-4 h-full min-w-max">
                        {STAGES.map(stage => (
                            <KanbanColumn
                                key={stage.id}
                                stage={stage}
                                candidates={stageGroups[stage.id]}
                                isOver={overStageId === stage.id}
                                onCardClick={(c) => { setSelectedCandidate(c); setDrawerOpen(true); }}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onStartOnboarding={(c) => setHireFlowCandidate(c)}
                                draggingId={draggingId}
                            />
                        ))}
                    </div>
                )}
            </div>

            <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={currentCandidate?.name || 'Candidate'} width="max-w-md">
                {currentCandidate && (
                    <div className="p-6 space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[13px] text-muted"><Mail size={14} /> {currentCandidate.email}</div>
                            {currentCandidate.phone && <div className="flex items-center gap-2 text-[13px] text-muted"><Phone size={14} /> {currentCandidate.phone}</div>}
                            <div className="flex justify-between"><span className="text-[12px] text-muted">Position</span><span className="text-[13px] text-primary">{currentCandidate.position}</span></div>
                            <div className="flex justify-between"><span className="text-[12px] text-muted">Applied</span><span className="text-[13px] text-primary">{new Date(currentCandidate.appliedDate).toLocaleDateString()}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[12px] text-muted">Stage</span><StatusChip status={currentCandidate.stage} /></div>
                        </div>

                        {canWrite && (
                            <div>
                                <label className="text-[12px] font-semibold text-muted mb-2 block">Move to stage</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {STAGES.filter(s => s.id !== currentCandidate.stage).map(s => (
                                        <button key={s.id}
                                            onClick={async () => {
                                                if (s.id === 'rejected') { setRejectModalCandidate(currentCandidate); setDrawerOpen(false); return; }
                                                if (s.id === 'hired') { setHireFlowCandidate(currentCandidate); setDrawerOpen(false); return; }
                                                try {
                                                    await recruitmentApi.updateStage(currentCandidate.id, { statusCode: UI_STAGE_TO_SERVER[s.id] }, actorUserId);
                                                    notify(`${currentCandidate.name} → ${s.label}`, 'info');
                                                    await reload();
                                                } catch (e) { notify(e instanceof Error ? e.message : 'Stage update failed', 'error'); }
                                            }}
                                            className="px-3 py-1.5 text-[11px] font-medium bg-surface border border-border rounded-lg hover:bg-surface/80 text-muted transition-colors"
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {currentCandidate.stage === 'hired' && !currentCandidate.linkedEmployeeId && canExecute && (
                            <button onClick={() => { setHireFlowCandidate(currentCandidate); setDrawerOpen(false); }}
                                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors">
                                Start onboarding <ChevronRight size={14} />
                            </button>
                        )}
                        {currentCandidate.linkedEmployeeId && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <CheckCircle2 size={14} className="text-emerald-400" />
                                <span className="text-[12px] text-emerald-400 font-medium">Onboarding in progress</span>
                            </div>
                        )}
                    </div>
                )}
            </Drawer>

            <CandidateHiredModal
                candidate={hireFlowCandidate}
                isOpen={!!hireFlowCandidate}
                onClose={() => setHireFlowCandidate(null)}
                onConfirm={handleHireConfirm}
                onDoLater={handleHireDoLater}
                departments={departments}
                onNavigateToOnboarding={onNavigate ? () => onNavigate('hrm-onboarding') : undefined}
            />

            <RejectModal
                candidate={rejectModalCandidate}
                isOpen={!!rejectModalCandidate}
                onClose={handleRejectCancel}
                onConfirm={handleRejectConfirm}
            />

            <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add candidate"
                footer={
                    <>
                        <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface">Cancel</button>
                        <button onClick={handleAddCandidate} disabled={!newName || !newEmail || !newPosition || !newDepartmentId} className="px-4 py-2 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-[12px] font-semibold text-muted mb-1.5">Full name *</label>
                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jane Smith" className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-muted mb-1.5">Personal email *</label>
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jane@example.com" className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-muted mb-1.5">Position *</label>
                        <input value={newPosition} onChange={e => setNewPosition(e.target.value)} placeholder="e.g. Senior Engineer" className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-muted mb-1.5">Recruitment department *</label>
                        <select value={newDepartmentId} onChange={e => setNewDepartmentId(e.target.value)} className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary focus:outline-none focus:border-emerald-500/50">
                            <option value="">— select —</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    {selectedPostingId && (
                        <p className="text-[11px] text-muted">Posting filter active — candidate will be linked to that posting.</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default RecruitmentPage;
