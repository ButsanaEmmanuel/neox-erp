import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Circle, User, Monitor, Shield, Briefcase, CheckCircle2, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import PageHeader from '../../ui/PageHeader';
import StatusChip from '../../ui/StatusChip';
import { useToast } from '../../ui/Toast';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { can } from '../../../lib/rbac';
import type { OnboardingPlan, OnboardingTask, TaskOwner } from '../../../types/hrm';

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

const OnboardingPage: React.FC = () => {
    const { onboardingPlans, updateOnboardingTask, completeOnboarding, currentRole, activeOnboardingPlanId, setActiveOnboardingPlanId } = useHRMStore();
    const { addToast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState<OnboardingPlan | null>(null);

    // Auto-open plan when navigating from hire flow
    useEffect(() => {
        if (activeOnboardingPlanId) {
            const plan = onboardingPlans.find(p => p.id === activeOnboardingPlanId);
            if (plan) setSelectedPlan(plan);
            setActiveOnboardingPlanId(null);
        }
    }, [activeOnboardingPlanId, onboardingPlans, setActiveOnboardingPlanId]);

    // ── Plan Detail View ──
    if (selectedPlan) {
        const plan = onboardingPlans.find(p => p.id === selectedPlan.id) || selectedPlan;
        const grouped = groupByOwner(plan.tasks);
        const allRequiredDone = plan.tasks.length > 0 && plan.tasks.filter(t => t.required).every(t => t.status === 'completed') && plan.tasks.filter(t => t.required).length > 0;
        const canComplete = can(currentRole, 'edit', 'onboarding') && plan.status !== 'completed';

        const handleCompleteOnboarding = () => {
            completeOnboarding(plan.id, currentRole === 'hr' ? 'HR' : currentRole === 'manager' ? 'Manager' : 'Staff');
            addToast('🎉 Onboarding complete — employee is now Active!', 'success');
            setSelectedPlan(null);
        };

        return (
            <div className="h-full flex flex-col overflow-hidden">
                <PageHeader
                    title={`Onboarding: ${plan.employeeName}`}
                    subtitle={`${plan.department} · Target: ${plan.targetDate}`}
                    actions={
                        <div className="flex items-center gap-2">
                            {canComplete && (
                                <button
                                    onClick={handleCompleteOnboarding}
                                    disabled={!allRequiredDone}
                                    title={!allRequiredDone ? 'Complete all required tasks first' : 'Mark onboarding as complete'}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all
                                        ${allRequiredDone
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30'
                                            : 'bg-surface text-muted border border-input cursor-not-allowed opacity-60'
                                        }`}
                                >
                                    <CheckCircle2 size={15} />
                                    {allRequiredDone ? 'Complete Onboarding' : `Complete Onboarding (${plan.tasks.filter(t => t.status === 'completed').length}/${plan.tasks.length})`}
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
                    {/* Tasks grouped by owner */}
                    {Object.entries(grouped).map(([owner, tasks]) => (
                        <div key={owner} className="bg-card rounded-xl border border-border/60 overflow-hidden">
                            <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
                                <span className={OWNER_COLOR[owner as TaskOwner]}>{OWNER_ICON[owner as TaskOwner]}</span>
                                <span className="text-[13px] font-semibold text-primary capitalize">{owner}</span>
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
                                                if (!can(currentRole, 'edit', 'onboarding') && currentRole !== 'staff') return;
                                                const next = task.status === 'completed' ? 'pending'
                                                    : task.status === 'pending' ? 'in_progress' : 'completed';
                                                updateOnboardingTask(plan.id, task.id, next);
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
                                        <span className="text-[11px] text-muted">{task.dueDate}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Activity Log */}
                    {plan.activityLog && plan.activityLog.length > 0 && (
                        <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
                            <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
                                <Activity size={13} className="text-muted" />
                                <span className="text-[13px] font-semibold text-primary">Activity Log</span>
                            </div>
                            <div className="divide-y divide-white/[0.04]">
                                {[...plan.activityLog].reverse().map(entry => (
                                    <div key={entry.id} className="px-5 py-3 flex items-start gap-3">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500/50 mt-1.5 flex-none" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] text-secondary">{entry.action}</p>
                                            <p className="text-[10px] text-muted mt-0.5">
                                                {entry.who} · {new Date(entry.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Plan List View ──
    return (
        <div className="h-full flex flex-col overflow-hidden">
            <PageHeader title="Onboarding" subtitle={`${onboardingPlans.length} onboarding plans`} />

            <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {onboardingPlans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-surface border border-input flex items-center justify-center mb-4">
                            <CheckCircle2 size={28} className="text-muted" />
                        </div>
                        <p className="text-[15px] font-semibold text-muted">No onboarding plans</p>
                        <p className="text-[13px] text-muted mt-1">Hire a candidate from the Recruitment board to create one automatically.</p>
                    </div>
                ) : (
                    onboardingPlans.map(plan => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setSelectedPlan(plan)}
                            className="bg-card rounded-xl border border-border/60 p-5 cursor-pointer hover:border-border transition-all group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-[15px] font-semibold text-primary group-hover:text-emerald-400 transition-colors">
                                        {plan.employeeName}
                                    </h3>
                                    <p className="text-[12px] text-muted">{plan.department} · Starting {plan.startDate}</p>
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
                                {(['completed', 'in_progress', 'pending'] as const).map(s => {
                                    const count = plan.tasks.filter(t => t.status === s).length;
                                    return count > 0 ? (
                                        <span key={s} className="text-[11px] text-muted flex items-center gap-1">
                                            {STATUS_ICON[s]} {count}
                                        </span>
                                    ) : null;
                                })}
                                {plan.activityLog?.length > 0 && (
                                    <span className="ml-auto text-[10px] text-muted flex items-center gap-1">
                                        <Activity size={10} /> {plan.activityLog.length} event{plan.activityLog.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

function groupByOwner(tasks: OnboardingTask[]): Record<string, OnboardingTask[]> {
    return tasks.reduce((acc, task) => {
        if (!acc[task.owner]) acc[task.owner] = [];
        acc[task.owner].push(task);
        return acc;
    }, {} as Record<string, OnboardingTask[]>);
}

export default OnboardingPage;



