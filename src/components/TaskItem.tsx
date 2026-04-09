import React from 'react';
import { Task } from '../types/task';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { CheckCircle2, Circle, Calendar, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface TaskItemProps {
    task: Task;
    onComplete: (id: string) => void;
    onClick: (task: Task) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onComplete, onClick }) => {
    const isOverdue = isPast(new Date(task.dueAt)) && !isToday(new Date(task.dueAt)) && task.status !== 'done';
    const isDone = task.status === 'done';

    return (
        <div
            onClick={() => onClick(task)}
            className={cn(
                "group flex items-center gap-3 p-3 border-b border-border hover:bg-surface cursor-pointer transition-colors",
                isDone && "opacity-50"
            )}
        >
            {/* Checkbox */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onComplete(task.id);
                }}
                className={cn(
                    "flex-none w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                    isDone
                        ? "bg-emerald-500 border-emerald-500 text-black"
                        : "border-input hover:border-emerald-500 text-transparent hover:text-emerald-500/20"
                )}
            >
                <CheckCircle2 size={14} className={cn(isDone ? "opacity-100" : "opacity-0")} />
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className={cn(
                        "text-sm font-medium truncate transition-all",
                        isDone ? "text-muted line-through" : "text-primary"
                    )}>
                        {task.title}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                        {/* Due Date Badge */}
                        <div className={cn(
                            "flex items-center gap-1 text-[11px] font-medium",
                            isOverdue ? "text-rose-400" : "text-muted"
                        )}>
                            <Calendar size={10} />
                            <span>
                                {isToday(new Date(task.dueAt)) ? 'Today' :
                                    isTomorrow(new Date(task.dueAt)) ? 'Tomorrow' :
                                        format(new Date(task.dueAt), 'MMM d')}
                            </span>
                        </div>

                        {/* Priority Badge (if High) */}
                        {task.priority === 'high' && !isDone && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-500 bg-amber-500/10 px-1.5 rounded">
                                <AlertCircle size={10} />
                                <span>High</span>
                            </div>
                        )}

                        {/* Tags */}
                        {task.tags.map(tag => (
                            <span key={tag} className="text-[10px] text-muted bg-surface px-1.5 rounded truncate max-w-[80px]">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Owner Avatar (Mock) */}
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] text-indigo-300 font-bold ml-4">
                    JD
                </div>
            </div>
        </div>
    );
};

export default TaskItem;

