import React from 'react';
import { ChevronLeft, ChevronRight, Calculator, Check, X, Send } from 'lucide-react';
import { format, parseISO, addWeeks, subWeeks } from 'date-fns';
import StatusChip from '../../ui/StatusChip';
import { TimesheetStatus } from '../../../types/hrm';
import { can } from '../../../lib/rbac';
import { useHRMStore } from '../../../store/hrm/useHRMStore';

interface WeekHeaderProps {
    weekStart: string;
    onWeekChange: (newWeekStart: string) => void;
    status?: TimesheetStatus;
    totalHours?: number;
    employeeName?: string;
    isMyTimesheet: boolean;
    onSubmit?: () => void;
    onApprove?: () => void;
    onReject?: () => void;
}

const WeekHeader: React.FC<WeekHeaderProps> = ({
    weekStart,
    onWeekChange,
    status,
    totalHours = 0,
    employeeName,
    isMyTimesheet,
    onSubmit,
    onApprove,
    onReject
}) => {
    const { currentRole } = useHRMStore();
    const startDate = parseISO(weekStart);
    const endDate = addWeeks(startDate, 1); // approximate end of week for display
    // correct end date is actually start + 6 days
    const endDateDisplay = new Date(startDate);
    endDateDisplay.setDate(endDateDisplay.getDate() + 6);

    const handlePrevWeek = () => onWeekChange(format(subWeeks(startDate, 1), 'yyyy-MM-dd'));
    const handleNextWeek = () => onWeekChange(format(addWeeks(startDate, 1), 'yyyy-MM-dd'));

    const canSubmit = isMyTimesheet && status === 'draft' && totalHours > 0;
    const canApprove = !isMyTimesheet && status === 'submitted' && can(currentRole, 'approve', 'timesheets');
    const canReject = !isMyTimesheet && status === 'submitted' && can(currentRole, 'approve', 'timesheets');

    return (
        <div className="flex-none px-8 py-6 border-b border-border/60 flex items-center justify-between bg-app">
            <div className="flex items-center gap-6">
                <div>
                    <h1 className="text-[20px] font-bold text-primary tracking-tight flex items-center gap-3">
                        {employeeName ? `${employeeName}'s Timesheet` : 'My Timesheet'}
                        {status && <StatusChip status={status} />}
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center bg-card/[0.04] rounded-lg p-0.5 border border-border/60">
                            <button onClick={handlePrevWeek} className="p-1 hover:bg-card/[0.08] rounded text-muted hover:text-primary transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 text-[13px] font-medium text-secondary tabular-nums">
                                {format(startDate, 'MMM d')} – {format(endDateDisplay, 'MMM d, yyyy')}
                            </span>
                            <button onClick={handleNextWeek} className="p-1 hover:bg-card/[0.08] rounded text-muted hover:text-primary transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-4 py-2 bg-surface rounded-lg border border-border/60">
                    <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-500">
                        <Calculator size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase text-muted tracking-wider">Total Hours</p>
                        <p className="text-[16px] font-bold text-primary tabular-nums">{totalHours.toFixed(1)}h</p>
                    </div>
                </div>

                {canSubmit && (
                    <button
                        onClick={onSubmit}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                    >
                        <Send size={14} />
                        Submit for Approval
                    </button>
                )}

                {(canApprove || canReject) && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onReject}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[13px] font-bold rounded-lg transition-all"
                        >
                            <X size={14} />
                            Reject
                        </button>
                        <button
                            onClick={onApprove}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                        >
                            <Check size={14} />
                            Approve
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WeekHeader;



