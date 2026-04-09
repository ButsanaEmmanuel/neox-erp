import React, { useMemo } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { useActivityStore } from '../store/useActivityStore';
import { addDays, format, isSameDay, startOfDay, isToday, isTomorrow } from 'date-fns';
import { Calendar as CalendarIcon, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const CalendarPage: React.FC = () => {
    const { tasks } = useTaskStore();
    const { activities } = useActivityStore();

    // Generate next 7 days
    const days = useMemo(() => {
        const today = startOfDay(new Date());
        return Array.from({ length: 7 }, (_, i) => addDays(today, i));
    }, []);

    // Helper to get items for a specific day
    const getItemsForDay = (date: Date) => {
        const dayTasks = tasks.filter(t => isSameDay(new Date(t.dueAt), date) && t.status !== 'done');
        const dayMeetings = activities.filter(a => a.type === 'meeting' && isSameDay(new Date(a.timestamp), date));

        return { tasks: dayTasks, meetings: dayMeetings };
    };

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-slate-200">
            {/* Header */}
            <div className="h-14 border-b border-white/[0.06] flex items-center justify-between px-6 bg-[#0d1117]/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={18} className="text-emerald-500" />
                    <h2 className="font-semibold text-lg text-white">Agenda</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.05] text-slate-400">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-medium text-slate-300">
                        {format(days[0], 'MMM d')} - {format(days[days.length - 1], 'MMM d, yyyy')}
                    </span>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.05] text-slate-400">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Agenda List */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-8">
                    {days.map((day) => {
                        const { tasks, meetings } = getItemsForDay(day);
                        const isDayToday = isToday(day);
                        const isEmpty = tasks.length === 0 && meetings.length === 0;

                        if (isEmpty) return null; // Skip empty days for MVP compactness

                        return (
                            <div key={day.toISOString()} className="flex gap-6">
                                {/* Date Column */}
                                <div className="w-16 flex-none flex flex-col items-center pt-1">
                                    <span className={cn(
                                        "text-xs font-bold uppercase",
                                        isDayToday ? "text-emerald-500" : "text-slate-500"
                                    )}>
                                        {isDayToday ? 'Today' : isTomorrow(day) ? 'Tom' : format(day, 'EEE')}
                                    </span>
                                    <span className={cn(
                                        "text-2xl font-bold mt-0.5",
                                        isDayToday ? "text-white" : "text-slate-400"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                </div>

                                {/* Items Column */}
                                <div className="flex-1 space-y-3">
                                    {/* Meetings */}
                                    {meetings.map(meeting => (
                                        <div key={meeting.id} className="relative pl-4 border-l-2 border-orange-500/50 hover:border-orange-500 transition-colors py-1 group">
                                            <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                                                Meeting
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                                <Clock size={12} />
                                                <span>{format(new Date(meeting.timestamp), 'h:mm a')}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-600" />
                                                <span>{meeting.metadata?.duration ? `${Math.round(meeting.metadata.duration / 60)}m` : '30m'}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                                {meeting.body}
                                            </p>
                                        </div>
                                    ))}

                                    {/* Tasks */}
                                    {tasks.map(task => (
                                        <div key={task.id} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 flex items-center gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer group">
                                            <div className={`w-4 h-4 rounded-full border border-slate-600 group-hover:border-emerald-500 flex items-center justify-center`}>
                                                <CheckCircle2 size={10} className="text-transparent group-hover:text-emerald-500/50" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-slate-300 group-hover:text-white truncate">
                                                        {task.title}
                                                    </span>
                                                    {task.priority === 'high' && (
                                                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 rounded">High</span>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Empty State if all days hidden */}
                    <div className="text-center py-12 text-slate-500">
                        <p className="text-sm">No upcoming tasks or meetings from database for the next 7 days.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarPage;
