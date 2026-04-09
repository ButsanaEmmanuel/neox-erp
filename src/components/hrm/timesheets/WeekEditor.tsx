import React, { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { TimesheetActivity, TimesheetWeek } from '../../../types/hrm';
import { cn } from '../../../lib/utils'; // Assuming cn utility exists

interface WeekEditorProps {
    week: TimesheetWeek;
    readOnly?: boolean;
    onUpdateActivity: (activity: TimesheetActivity) => void;
    onDeleteActivity: (activityId: string) => void;
    onAddActivity: () => void;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// Mock Projects for selection
const PROJECTS = [
    { id: 'proj-alpha', name: 'Alpha Project' },
    { id: 'proj-beta', name: 'Beta Project' },
    { id: 'proj-gamma', name: 'Gamma Project' },
    { id: 'proj-delta', name: 'Delta Project' },
    { id: 'proj-internal', name: 'Internal / Admin' },
];

const WeekEditor: React.FC<WeekEditorProps> = ({
    week,
    readOnly = false,
    onUpdateActivity,
    onDeleteActivity,
    onAddActivity
}) => {
    return (
        <div className="bg-app border border-border/60 rounded-xl overflow-hidden shadow-sm">
            {/* Header Row */}
            <div className="grid grid-cols-[2fr_1fr_repeat(7,1fr)_auto] gap-px bg-surface border-b border-border/60 text-[12px] font-medium text-muted">
                <div className="px-4 py-3">Project / Task</div>
                <div className="px-4 py-3">Description</div>
                {DAYS.map(day => (
                    <div key={day} className="px-2 py-3 text-center uppercase tracking-wider">{day}</div>
                ))}
                <div className="px-4 py-3 text-center w-12">Total</div>
                {!readOnly && <div className="w-10"></div>}
            </div>

            {/* Empty State */}
            {week.activities.length === 0 && (
                <div className="p-12 text-center text-muted">
                    <p className="mb-4">No activities logged for this week.</p>
                    {!readOnly && (
                        <button
                            onClick={onAddActivity}
                            className="px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-lg text-sm font-medium transition-colors border border-emerald-600/20"
                        >
                            + Add Activity
                        </button>
                    )}
                </div>
            )}

            {/* Activity Rows */}
            {week.activities.map((activity) => {
                const rowTotal = Object.values(activity.hours).reduce((a, b) => a + (b || 0), 0);

                return (
                    <div key={activity.id} className="group grid grid-cols-[2fr_1fr_repeat(7,1fr)_auto] gap-px border-b border-border/60 hover:bg-card/[0.01] transition-colors items-center text-sm">
                        {/* Project Select */}
                        <div className="px-2 py-2">
                            {readOnly ? (
                                <div className="px-2 py-1.5 text-primary">
                                    {PROJECTS.find(p => p.id === activity.projectId)?.name || 'Unknown Project'}
                                </div>
                            ) : (
                                <select
                                    value={activity.projectId}
                                    onChange={(e) => onUpdateActivity({ ...activity, projectId: e.target.value })}
                                    className="w-full bg-transparent text-primary border border-transparent hover:border-border focus:border-emerald-500 rounded p-1.5 outline-none transition-all"
                                >
                                    <option value="" disabled>Select Project</option>
                                    {PROJECTS.map(p => (
                                        <option key={p.id} value={p.id} className="bg-card">{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Description Input */}
                        <div className="px-2 py-2">
                            {readOnly ? (
                                <div className="px-2 py-1.5 text-muted truncate" title={activity.description}>
                                    {activity.description || '-'}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={activity.description || ''}
                                    onChange={(e) => onUpdateActivity({ ...activity, description: e.target.value })}
                                    placeholder="Description..."
                                    className="w-full bg-transparent text-secondary placeholder:text-muted border border-transparent hover:border-border focus:border-emerald-500 rounded p-1.5 outline-none transition-all"
                                />
                            )}
                        </div>

                        {/* Daily Hours Inputs */}
                        {DAYS.map(day => (
                            <div key={day} className="px-1 py-2 text-center">
                                {readOnly ? (
                                    <div className={cn("py-1.5 text-secondary", !activity.hours[day] && "text-muted")}>
                                        {activity.hours[day] > 0 ? activity.hours[day] : '-'}
                                    </div>
                                ) : (
                                    <input
                                        type="number"
                                        min="0"
                                        max="24"
                                        step="0.5"
                                        value={activity.hours[day] === 0 ? '' : activity.hours[day]}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                            onUpdateActivity({
                                                ...activity,
                                                hours: { ...activity.hours, [day]: val }
                                            });
                                        }}
                                        className={cn(
                                            "w-full text-center bg-transparent border border-transparent hover:border-border focus:border-emerald-500 rounded p-1.5 outline-none transition-all appearance-none",
                                            activity.hours[day] > 0 ? "text-emerald-400 font-medium bg-emerald-500/[0.03]" : "text-muted"
                                        )}
                                    />
                                )}
                            </div>
                        ))}

                        {/* Row Total */}
                        <div className="px-4 py-2 text-center font-bold text-primary tabular-nums w-12">
                            {rowTotal > 0 ? rowTotal : <span className="text-muted">-</span>}
                        </div>

                        {/* Actions */}
                        {!readOnly && (
                            <div className="w-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onDeleteActivity(activity.id)}
                                    className="p-1.5 text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Footer / Add Row */}
            {!readOnly && (
                <div className="p-2 border-t border-border/60 bg-card/[0.01]">
                    <button
                        onClick={onAddActivity}
                        className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-muted hover:text-primary hover:bg-surface rounded-lg transition-colors w-full"
                    >
                        <Plus size={14} />
                        Add Activity Row
                    </button>
                </div>
            )}
        </div>
    );
};

export default WeekEditor;




