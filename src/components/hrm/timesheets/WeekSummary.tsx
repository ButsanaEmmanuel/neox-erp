import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { TimesheetWeek } from '../../../types/hrm';
import WeekEditor from './WeekEditor';

interface WeekSummaryProps {
    week: TimesheetWeek;
}

const WeekSummary: React.FC<WeekSummaryProps> = ({ week }) => {
    return (
        <div className="space-y-6">
            {/* Reviewer Comment / Status Context */}
            {week.status === 'rejected' && week.reviewerComment && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex gap-3 items-start">
                    <AlertCircle className="text-rose-500 mt-0.5" size={18} />
                    <div>
                        <h4 className="text-sm font-bold text-rose-400">Timesheet Rejected</h4>
                        <p className="text-sm text-rose-300/80 mt-1">{week.reviewerComment}</p>
                    </div>
                </div>
            )}

            {week.status === 'approved' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex gap-3 items-center">
                    <CheckCircle className="text-emerald-500" size={18} />
                    <div>
                        <h4 className="text-sm font-bold text-emerald-400">Timesheet Approved</h4>
                        {week.approvedAt && (
                            <p className="text-xs text-emerald-300/60 mt-0.5">
                                Approved on {new Date(week.approvedAt).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Read-only Grid */}
            <WeekEditor
                week={week}
                readOnly={true}
                onUpdateActivity={() => { }}
                onDeleteActivity={() => { }}
                onAddActivity={() => { }}
            />
        </div>
    );
};

export default WeekSummary;



