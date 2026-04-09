import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Circle, User, Monitor, Shield, Briefcase, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import PageHeader from '../../ui/PageHeader';
import StatusChip from '../../ui/StatusChip';
import { useToast } from '../../ui/Toast';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { can } from '../../../lib/rbac';
import type { OffboardingPlan, OffboardingTask, TaskOwner } from '../../../types/hrm';

const OWNER_ICON: Record<TaskOwner, React.ReactNode> = {
    employee: <User size={13} />,
    manager: <Briefcase size={13} />,
    hr: <Shield size={13} />,
    it: <Monitor size={13} />,
};

const OWNER_COLOR: Record<TaskOwner, string> = {
    employee: 'text-blue-400',
    manager: 'text-amber-400',
    hr: 'text-purple-400',
    it: 'text-emerald-400',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    completed: <CheckCircle size={14} className="text-emerald-400" />,
    in_progress: <Clock size={14} className="text-blue-400" />,
    pending: <Circle size={14} className="text-muted" />,
};

const OffboardingPage: React.FC = () => {
    const { offboardingPlans, updateOffboardingTask, completeOffboardingPlans, currentRole, activeOffboardingPlanId, setActiveOffboardingPlanId } = useHRMStore();
    const { addToast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState<OffboardingPlan | null>(null);

    // Auto-open plan when newly created
    useEffect(() => {
        if (activeOffboardingPlanId) {
            const plan = offboardingPlans.find(p => p.id === activeOffboardingPlanId);
            if (plan) setSelectedPlan(plan);
            setActiveOffboardingPlanId(null);
        }
    }, [activeOffboardingPlanId, offboardingPlans, setActiveOffboardingPlanId]);

    // ── Plan Detail View ──
    if (selectedPlan) {
        const plan = offboardingPlans.find(p => p.id === selectedPlan.id) || selectedPlan;
        const grouped = groupByOwner(plan.tasks);
        const allRequiredDone = plan.tasks.length > 0 && plan.tasks.filter(t => t.required).every(t => t.status === 'completed');
        const canComplete = can(currentRole, 'edit', 'offboarding') && plan.status !== 'completed';

        const handleCompleteOffboarding = () => {
            completeOffboardingPlans(plan.id);
            addToast('👋 Offboarding complete — employee is now Inactive', 'success');
            setSelectedPlan(null);
        };

        return (
            <div className="h-full flex flex-col overflow-hidden bg-app">
                <PageHeader
                    title={`Offboarding: ${plan.employeeName}`}
                    subtitle={`${plan.department} · Exit Date: ${plan.exitDate} · Reason: ${plan.reason}`}
                    actions={
                        <div className="flex items-center gap-2">
                            {canComplete && (
                                <button
                                    onClick={handleCompleteOffboarding}
                                    disabled={!allRequiredDone}
                                    title={!allRequiredDone ? 'Complete all required tasks first' : 'Finalize offboarding'}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all
                                        ${allRequiredDone
                                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/30'
                                            : 'bg-surface text-muted border border-input cursor-not-allowed opacity-60'
                                        }`}
                                >
                                    <LogOut size={15} />
                                    {allRequiredDone ? 'Complete Offboarding' : `Complete (${plan.tasks.filter(t => t.status === 'completed').length}/${plan.tasks.length})`}
                                </button>
                            )}
                            {plan.status === 'completed' && (
                                <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[12px] font-semibold text-emerald-400">
                                    <CheckCircle2 size={13} /> Completed
                                </span>
                            )}
                            <button
                                onClick={() => setSelectedPlan(null)}
                                className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface"
                            >
                                ← Back
                            </button>
                        </div>
                    }
                />

                {/* Progress Bar */}
                <div className="px-8 py-4 border-b border-border/60">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-semibold text-muted">Progress</span>
                        <span className="text-[13px] font-bold text-emerald-400">{plan.progress}%</span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-emerald-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${plan.progress}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {/* Notes Warning */}
                    {plan.notes && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3 text-amber-200/80 mb-6">
                            <AlertTriangle size={16} className="text-amber-400 flex-none mt-0.5" />
                            <div className="text-[13px]">
                                <span className="font-semibold text-amber-400 block mb-1">Exit Notes</span>
                                {plan.notes}
                            </div>
                        </div>
                    )}

                    {/* Tasks grouped by owner */}
                    {Object.entries(grouped).map(([owner, tasks]) => (
                        <div key={owner} className="bg-card rounded-xl border border-border/60 overflow-hidden">
                            <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
                                <span className={OWNER_COLOR[owner as TaskOwner]}>{OWNER_ICON[owner as TaskOwner]}</span>
                                <span className="text-[13px] font-semibold text-primary capitalize">{owner} Tasks</span>
                                <span className="text-[11px] text-muted ml-auto">
                                    {tasks.filter(t => t.status === 'completed').length}/{tasks.length}
                                </span>
                            </div>
                            <div className="divide-y divide-white/[0.04]">
                                {tasks.map(task => (
                                    <div key={task.id} className="px-5 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
                                        <button
                                            onClick={() => {
                                                if (plan.status === 'completed') return;
                                                const next = task.status === 'completed' ? 'pending'
                                                    : task.status === 'pending' ? 'completed' : 'completed'; // Simple toggle for now
                                                updateOffboardingTask(plan.id, task.id, next);
                                            }}
                                            className="flex-none"
                                            disabled={plan.status === 'completed'}
                                        >
                                            {STATUS_ICON[task.status]}
                                        </button>
                                        <span className={`text-[13px] flex-1 ${task.status === 'completed' ? 'text-muted line-through' : 'text-primary'}`}>
                                            {task.title}
                                            {task.required && (
                                                <span className="ml-1.5 text-[9px] font-bold text-red-400/60 uppercase">req</span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── Plan List View ──
    return (
        <div className="h-full flex flex-col overflow-hidden bg-app">
            <PageHeader title="Offboarding" subtitle={`${offboardingPlans.length} active sessions`} />

            <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {offboardingPlans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-surface border border-input flex items-center justify-center mb-4">
                            <LogOut size={28} className="text-muted" />
                        </div>
                        <p className="text-[15px] font-semibold text-muted">No offboarding plans</p>
                        <p className="text-[13px] text-muted mt-1">Start offboarding from the Employee Directory.</p>
                    </div>
                ) : (
                    offboardingPlans.map(plan => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setSelectedPlan(plan)}
                            className="bg-card rounded-xl border border-border/60 p-5 cursor-pointer hover:border-border transition-all group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-[15px] font-semibold text-primary group-hover:text-red-400 transition-colors">
                                        {plan.employeeName}
                                    </h3>
                                    <p className="text-[12px] text-muted">{plan.department} · Last Day: {plan.lastWorkingDay}</p>
                                </div>
                                <StatusChip status={plan.status} />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${plan.progress}%` }} />
                                </div>
                                <span className="text-[12px] font-semibold text-muted w-10 text-right">{plan.progress}%</span>
                            </div>
                            <div className="mt-3 flex gap-4">
                                {(['completed', 'pending'] as const).map(s => {
                                    const count = plan.tasks.filter(t => t.status === s).length;
                                    return count > 0 ? (
                                        <span key={s} className="text-[11px] text-muted flex items-center gap-1">
                                            {STATUS_ICON[s]} {count}
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

function groupByOwner(tasks: OffboardingTask[]): Record<string, OffboardingTask[]> {
    return tasks.reduce((acc, task) => {
        if (!acc[task.owner]) acc[task.owner] = [];
        acc[task.owner].push(task);
        return acc;
    }, {} as Record<string, OffboardingTask[]>);
}

export default OffboardingPage;



