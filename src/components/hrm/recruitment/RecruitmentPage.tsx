import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Plus, Mail, Phone, Clock, CheckCircle2, ChevronRight, X, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '../../ui/PageHeader';
import StatusChip from '../../ui/StatusChip';
import Drawer from '../../ui/Drawer';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { can } from '../../../lib/rbac';
import CandidateHiredModal from './CandidateHiredModal';
import type { Candidate, CandidateStage, HirePayload } from '../../../types/hrm';
import { provisionRecruitmentAccess } from '../../../services/hrmOnboardingApi';

// ─── Stage config ─────────────────────────────────────────────────
const STAGES: { id: CandidateStage; label: string; accent: string; glow: string; headerColor: string }[] = [
    { id: 'sourced', label: 'Sourced', accent: 'border-t-slate-500', glow: 'ring-slate-500/40', headerColor: 'text-muted' },
    { id: 'screening', label: 'Screening', accent: 'border-t-blue-500', glow: 'ring-blue-500/40', headerColor: 'text-blue-400' },
    { id: 'interview', label: 'Interview', accent: 'border-t-purple-500', glow: 'ring-purple-500/40', headerColor: 'text-purple-400' },
    { id: 'offer', label: 'Offer', accent: 'border-t-amber-500', glow: 'ring-amber-500/40', headerColor: 'text-amber-400' },
    { id: 'hired', label: 'Hired', accent: 'border-t-emerald-500', glow: 'ring-emerald-500/40', headerColor: 'text-emerald-400' },
    { id: 'rejected', label: 'Rejected', accent: 'border-t-red-500', glow: 'ring-red-500/40', headerColor: 'text-red-400' },
];

// ─── Candidate Card ───────────────────────────────────────────────
interface CandidateCardProps {
    candidate: Candidate;
    onCardClick: (c: Candidate) => void;
    onDragStart: (candidateId: string) => void;
    onStartOnboarding?: (c: Candidate) => void;
    isDragging: boolean;
}

const CandidateCard: React.FC<CandidateCardProps> = ({
    candidate, onCardClick, onDragStart, onStartOnboarding, isDragging,
}) => {
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
            className={`bg-card rounded-lg border border-border p-3
                hover:border-border/80 transition-all group select-none cursor-grab active:cursor-grabbing
                ${isDragging ? 'opacity-30 scale-95' : 'opacity-100'}`}
            style={{ transition: 'opacity 0.15s, transform 0.15s' }}
        >
            {/* Grip icon */}
            <div className="flex items-start gap-2">
                <GripVertical
                    size={14}
                    className="text-secondary mt-0.5 flex-none opacity-0 group-hover:opacity-100 transition-opacity"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                            <h4 className="text-[13px] font-semibold text-primary truncate">{candidate.name}</h4>
                            <p className="text-[11px] text-muted truncate mt-0.5">{candidate.position}</p>
                        </div>
                        {candidate.onboardingPending && (
                            <span className="flex-none flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-bold text-amber-400 uppercase tracking-wide whitespace-nowrap">
                                <Clock size={8} /> Pending
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
                        {candidate.notes.length > 0 && (
                            <span className="text-[10px] text-muted">{candidate.notes.length} note{candidate.notes.length > 1 ? 's' : ''}</span>
                        )}
                    </div>
                    {candidate.onboardingPending && onStartOnboarding && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStartOnboarding(candidate); }}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-md text-[11px] font-semibold text-emerald-400 transition-colors"
                        >
                            <CheckCircle2 size={11} /> Start Onboarding
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
    onDragOver: (stageId: CandidateStage) => void;
    onDragLeave: () => void;
    onDrop: (stageId: CandidateStage) => void;
    onStartOnboarding: (c: Candidate) => void;
    draggingId: string | null;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
    stage, candidates, isOver, onCardClick, onDragStart,
    onDragOver, onDragLeave, onDrop, onStartOnboarding, draggingId,
}) => {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(stage.id);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        onDrop(stage.id);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={onDragLeave}
            onDrop={handleDrop}
            className={`w-72 flex-none flex flex-col rounded-xl border-t-2 ${stage.accent} transition-all duration-150
                ${isOver
                    ? `ring-2 ${stage.glow} bg-surface border border-border`
                    : 'bg-surface border border-border'
                }`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
                <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-semibold transition-colors ${isOver ? stage.headerColor : 'text-primary'}`}>
                        {stage.label}
                    </span>
                    <motion.span
                        key={candidates.length}
                        initial={{ scale: 1.4 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="text-[11px] text-muted bg-surface px-2 py-0.5 rounded-full tabular-nums"
                    >
                        {candidates.length}
                    </motion.span>
                </div>
                {isOver && (
                    <span className={`text-[10px] font-semibold ${stage.headerColor} animate-pulse`}>Drop here</span>
                )}
            </div>

            {/* Cards */}
            <div className="flex-1 p-3 space-y-2 min-h-[120px] overflow-y-auto">
                <AnimatePresence mode="popLayout">
                    {candidates.map(candidate => (
                        <motion.div
                            key={candidate.id}
                            layout
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94 }}
                            transition={{ duration: 0.15 }}
                        >
                            <CandidateCard
                                candidate={candidate}
                                onCardClick={onCardClick}
                                onDragStart={onDragStart}
                                onStartOnboarding={candidate.onboardingPending ? onStartOnboarding : undefined}
                                isDragging={draggingId === candidate.id}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {candidates.length === 0 && (
                    <div className={`flex items-center justify-center h-20 rounded-lg border border-dashed transition-colors
                        ${isOver ? 'border-input bg-surface' : 'border-border/60'}`}
                    >
                        <span className="text-[11px] text-secondary">Drop here</span>
                    </div>
                )}
            </div>
        </div>
    );
};



// ─── Reject Modal ─────────────────────────────────────────────────
interface RejectModalProps {
    candidate: Candidate | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

const RejectModal: React.FC<RejectModalProps> = ({ candidate, isOpen, onClose, onConfirm }) => {
    const [reason, setReason] = useState('');
    if (!candidate) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Reject Candidate" size="sm"
            footer={
                <>
                    <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface">Cancel</button>
                    <button onClick={() => { onConfirm(reason); setReason(''); }}
                        className="px-4 py-2 text-[13px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2">
                        <X size={14} /> Reject
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-[13px] text-muted">
                    Reject <strong className="text-primary">{candidate.name}</strong> for <strong className="text-primary">{candidate.position}</strong>?
                </p>
                <div>
                    <label className="block text-[12px] font-semibold text-muted mb-1.5">Reason (optional)</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)}
                        placeholder="e.g. Not enough experience..." rows={3}
                        className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-red-500/50 resize-none" />
                </div>
            </div>
        </Modal>
    );
};

// ─── Main Page ────────────────────────────────────────────────────
interface RecruitmentPageProps {
    onNavigate?: (view: string) => void;
}

const RecruitmentPage: React.FC<RecruitmentPageProps> = ({ onNavigate }) => {
    const {
        candidates, departments, moveCandidateStage, addCandidate, addCandidateNote,
        hireCandidate, markOnboardingPending, rejectCandidate, currentRole,
    } = useHRMStore();
    const { addToast } = useToast();

    // Drag state
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [overStageId, setOverStageId] = useState<CandidateStage | null>(null);
    const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modal state
    const [hireFlowCandidate, setHireFlowCandidate] = useState<Candidate | null>(null);
    const [rejectModalCandidate, setRejectModalCandidate] = useState<Candidate | null>(null);

    // Drawer state
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [newNote, setNewNote] = useState('');

    // Add modal
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPosition, setNewPosition] = useState('');

    const stageGroups = useMemo(() => {
        const groups: Record<CandidateStage, Candidate[]> = {
            sourced: [], screening: [], interview: [], offer: [], hired: [], rejected: [],
        };
        candidates.forEach(c => groups[c.stage].push(c));
        return groups;
    }, [candidates]);

    // ── Drag handlers ──
    const handleDragStart = useCallback((id: string) => {
        setDraggingId(id);
    }, []);

    const handleDragOver = useCallback((stageId: CandidateStage) => {
        if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
        setOverStageId(stageId);
    }, []);

    const handleDragLeave = useCallback(() => {
        // Small delay to prevent flicker when moving between child elements
        dragLeaveTimer.current = setTimeout(() => setOverStageId(null), 50);
    }, []);

    const handleDrop = useCallback((targetStage: CandidateStage) => {
        if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
        setOverStageId(null);

        if (!draggingId) return;
        const candidate = candidates.find(c => c.id === draggingId);
        setDraggingId(null);

        if (!candidate || candidate.stage === targetStage) return;

        if (targetStage === 'rejected') {
            moveCandidateStage(draggingId, 'rejected');
            setRejectModalCandidate(candidate);
        } else if (targetStage === 'hired') {
            moveCandidateStage(draggingId, 'hired');
            setHireFlowCandidate(candidate);
        } else {
            moveCandidateStage(draggingId, targetStage);
            const label = STAGES.find(s => s.id === targetStage)?.label ?? targetStage;
            addToast(`${candidate.name} → ${label}`, 'info');
        }
    }, [draggingId, candidates, moveCandidateStage, addToast]);

    // ── Hire flow ──
    const handleHireConfirm = useCallback(async (payload: HirePayload) => {
        if (!hireFlowCandidate) return;
        try {
            await provisionRecruitmentAccess({
                candidateId: hireFlowCandidate.id,
                professionalEmail: hireFlowCandidate.email.replace(/@.*/, '@neox.erp').toLowerCase(),
            });
        } catch {
            addToast(`Provisioning des acces echoue pour ${hireFlowCandidate.name}.`, 'error');
            return;
        }

        hireCandidate(
            hireFlowCandidate.id,
            payload.startDate,
            payload.departmentId,
            payload.hiringManagerId,
            payload.templateId,
            payload.offerComp ? { amount: payload.offerComp.amount ?? 0, currency: payload.offerComp.currency, period: payload.offerComp.period } : undefined,
        );
        addToast(`${hireFlowCandidate.name} recrute et acces provisionnes.`, 'success');
        // Don't close the modal — let the success state show with View Onboarding CTA
    }, [hireFlowCandidate, hireCandidate, addToast]);

    const handleHireDoLater = useCallback(() => {
        if (!hireFlowCandidate) return;
        markOnboardingPending(hireFlowCandidate.id);
        addToast(`${hireFlowCandidate.name} marked as hired. Start onboarding when ready.`, 'info');
        setHireFlowCandidate(null);
    }, [hireFlowCandidate, markOnboardingPending, addToast]);

    // ── Reject flow ──
    const handleRejectConfirm = useCallback((reason: string) => {
        if (!rejectModalCandidate) return;
        if (reason) {
            addCandidateNote(rejectModalCandidate.id, {
                author: 'System',
                date: new Date().toISOString(),
                text: `Rejected: ${reason}`,
            });
        }
        addToast(`${rejectModalCandidate.name} rejected.`, 'error');
        setRejectModalCandidate(null);
    }, [rejectModalCandidate, addCandidateNote, addToast]);

    const handleRejectCancel = useCallback(() => {
        // Undo the optimistic move
        if (rejectModalCandidate) {
            moveCandidateStage(rejectModalCandidate.id, rejectModalCandidate.stage);
        }
        setRejectModalCandidate(null);
    }, [rejectModalCandidate, moveCandidateStage]);

    // ── Drawer ──
    const currentCandidate = selectedCandidate
        ? candidates.find(c => c.id === selectedCandidate.id) ?? selectedCandidate
        : null;

    const handleAddNote = () => {
        if (!selectedCandidate || !newNote.trim()) return;
        addCandidateNote(selectedCandidate.id, {
            author: currentRole === 'hr' ? 'HR' : 'Hiring Manager',
            date: new Date().toISOString(),
            text: newNote,
        });
        setNewNote('');
        addToast('Note added', 'success');
    };

    const handleAddCandidate = () => {
        if (!newName || !newEmail || !newPosition) return;
        addCandidate({ name: newName, email: newEmail, position: newPosition, stage: 'sourced', appliedDate: new Date().toISOString().split('T')[0] });
        addToast(`${newName} added to pipeline`, 'success');
        setAddModalOpen(false);
        setNewName(''); setNewEmail(''); setNewPosition('');
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <PageHeader
                title="Recruitment"
                subtitle={`${candidates.length} candidates · ${stageGroups.hired.length} hired`}
                actions={
                    can(currentRole, 'create', 'candidates') ? (
                        <button onClick={() => setAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
                            <Plus size={15} /> Add Candidate
                        </button>
                    ) : undefined
                }
            />

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto p-6">
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
            </div>

            {/* ── Candidate Drawer ── */}
            <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={currentCandidate?.name || 'Candidate'} width="max-w-md">
                {currentCandidate && (
                    <div className="p-6 space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[13px] text-muted"><Mail size={14} /> {currentCandidate.email}</div>
                            {currentCandidate.phone && <div className="flex items-center gap-2 text-[13px] text-muted"><Phone size={14} /> {currentCandidate.phone}</div>}
                            <div className="flex justify-between"><span className="text-[12px] text-muted">Position</span><span className="text-[13px] text-primary">{currentCandidate.position}</span></div>
                            <div className="flex justify-between"><span className="text-[12px] text-muted">Applied</span><span className="text-[13px] text-primary">{currentCandidate.appliedDate}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[12px] text-muted">Stage</span><StatusChip status={currentCandidate.stage} /></div>
                        </div>

                        {can(currentRole, 'edit', 'candidates') && (
                            <div>
                                <label className="text-[12px] font-semibold text-muted mb-2 block">Move to Stage</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {STAGES.filter(s => s.id !== currentCandidate.stage).map(s => (
                                        <button key={s.id}
                                            onClick={() => {
                                                if (s.id === 'rejected') {
                                                    moveCandidateStage(currentCandidate.id, 'rejected');
                                                    setRejectModalCandidate(currentCandidate);
                                                    setDrawerOpen(false);
                                                } else if (s.id === 'hired') {
                                                    moveCandidateStage(currentCandidate.id, 'hired');
                                                    setHireFlowCandidate(currentCandidate);
                                                    setDrawerOpen(false);
                                                } else {
                                                    moveCandidateStage(currentCandidate.id, s.id);
                                                    addToast(`${currentCandidate.name} → ${s.label}`, 'info');
                                                }
                                            }}
                                            className="px-3 py-1.5 text-[11px] font-medium bg-surface border border-border rounded-lg hover:bg-surface/80 text-muted transition-colors"
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {currentCandidate.stage === 'hired' && !currentCandidate.linkedEmployeeId && (
                            <button onClick={() => { setHireFlowCandidate(currentCandidate); setDrawerOpen(false); }}
                                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors">
                                Start Onboarding <ChevronRight size={14} />
                            </button>
                        )}
                        {currentCandidate.linkedEmployeeId && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <CheckCircle2 size={14} className="text-emerald-400" />
                                <span className="text-[12px] text-emerald-400 font-medium">Onboarding in progress</span>
                            </div>
                        )}

                        <div>
                            <h4 className="text-[13px] font-semibold text-primary mb-3">Notes</h4>
                            {currentCandidate.notes.length === 0 && <p className="text-[12px] text-muted">No notes yet.</p>}
                            <div className="space-y-3 mb-4">
                                {currentCandidate.notes.map(note => (
                                    <div key={note.id} className="bg-app rounded-lg p-3 border border-border">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[11px] font-semibold text-muted">{note.author}</span>
                                            <span className="text-[10px] text-muted">{new Date(note.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-[12px] text-primary">{note.text}</p>
                                    </div>
                                ))}
                            </div>
                            {can(currentRole, 'edit', 'candidates') && (
                                <div className="flex gap-2">
                                    <input value={newNote} onChange={e => setNewNote(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                                        placeholder="Add a note..."
                                        className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-[12px] text-primary placeholder:text-muted focus:outline-none focus:border-brand/50" />
                                    <button onClick={handleAddNote} className="px-3 py-2 bg-surface border border-border rounded-lg text-[12px] text-muted hover:bg-surface/80 font-medium">Add</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>

            {/* ── Hire Flow Modal ── */}
            <CandidateHiredModal
                candidate={hireFlowCandidate}
                isOpen={!!hireFlowCandidate}
                onClose={() => setHireFlowCandidate(null)}
                onConfirm={handleHireConfirm}
                onDoLater={handleHireDoLater}
                departments={departments}
                onNavigateToOnboarding={onNavigate ? () => onNavigate('hrm-onboarding') : undefined}
            />

            {/* ── Reject Modal ── */}
            <RejectModal
                candidate={rejectModalCandidate}
                isOpen={!!rejectModalCandidate}
                onClose={handleRejectCancel}
                onConfirm={handleRejectConfirm}
            />

            {/* ── Add Candidate Modal ── */}
            <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Candidate"
                footer={
                    <>
                        <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface">Cancel</button>
                        <button onClick={handleAddCandidate} className="px-4 py-2 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Add</button>
                    </>
                }
            >
                <div className="space-y-4">
                    {[
                        { label: 'Full Name *', value: newName, set: setNewName, placeholder: 'Jane Smith' },
                        { label: 'Email *', value: newEmail, set: setNewEmail, placeholder: 'jane@example.com' },
                        { label: 'Position *', value: newPosition, set: setNewPosition, placeholder: 'e.g. Senior Engineer' },
                    ].map(f => (
                        <div key={f.label}>
                            <label className="block text-[12px] font-semibold text-muted mb-1.5">{f.label}</label>
                            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                                className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50" />
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

export default RecruitmentPage;



