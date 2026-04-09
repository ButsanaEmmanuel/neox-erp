import React, { useState, useMemo } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import TaskItem from './TaskItem';
import { Plus, Search, Filter, CalendarDays, ListTodo, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isToday, isPast } from 'date-fns';
import CreateTaskDrawer from './CreateTaskDrawer';
import { Task } from '../types/task';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type FilterType = 'all' | 'today' | 'overdue' | 'completed';

const TasksPage: React.FC = () => {
    const { tasks, completeTask } = useTaskStore();
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Drawer State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const handleCreateClick = () => {
        setEditingTask(null);
        setIsDrawerOpen(true);
    };

    const handleEditClick = (task: Task) => {
        setEditingTask(task);
        setIsDrawerOpen(true);
    };

    const filteredTasks = useMemo(() => {
        let result = tasks;

        // 1. Filter by Status/Date
        if (filter === 'completed') {
            result = result.filter(t => t.status === 'done');
        } else {
            // Hide completed by default unless 'completed' filter
            result = result.filter(t => t.status !== 'done');

            if (filter === 'today') {
                result = result.filter(t => isToday(new Date(t.dueAt)));
            } else if (filter === 'overdue') {
                result = result.filter(t => isPast(new Date(t.dueAt)) && !isToday(new Date(t.dueAt)));
            }
        }

        // 2. Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t => t.title.toLowerCase().includes(q));
        }

        // 3. Sort (Overdue first, then by date)
        return result.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    }, [tasks, filter, searchQuery]);

    const counts = useMemo(() => {
        const active = tasks.filter(t => t.status !== 'done');
        return {
            all: active.length,
            today: active.filter(t => isToday(new Date(t.dueAt))).length,
            overdue: active.filter(t => isPast(new Date(t.dueAt)) && !isToday(new Date(t.dueAt))).length,
            completed: tasks.filter(t => t.status === 'done').length
        };
    }, [tasks]);

    return (
        <div className="flex h-full bg-app text-primary">
            {/* Sidebar Filters */}
            <div className="w-60 border-r border-border flex flex-col p-4 gap-1">
                <button
                    onClick={handleCreateClick}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-md font-medium text-sm mb-4 transition-colors shadow-sm shadow-emerald-900/20"
                >
                    <Plus size={16} />
                    <span>Create Task</span>
                </button>

                <div className="space-y-0.5">
                    <NavButton
                        active={filter === 'all'}
                        onClick={() => setFilter('all')}
                        icon={ListTodo}
                        label="My Tasks"
                        count={counts.all}
                    />
                    <NavButton
                        active={filter === 'today'}
                        onClick={() => setFilter('today')}
                        icon={CalendarDays}
                        label="Due Today"
                        count={counts.today}
                    />
                    <NavButton
                        active={filter === 'overdue'}
                        onClick={() => setFilter('overdue')}
                        icon={Filter}
                        label="Overdue"
                        count={counts.overdue}
                        alert={counts.overdue > 0}
                    />
                    <NavButton
                        active={filter === 'completed'}
                        onClick={() => setFilter('completed')}
                        icon={CheckCircle2}
                        label="Completed"
                        count={counts.completed}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-app">
                {/* Header */}
                <div className="h-14 border-b border-border flex items-center justify-between px-6">
                    <h2 className="font-semibold text-lg text-primary">
                        {filter === 'all' ? 'My Tasks' :
                            filter === 'today' ? 'Due Today' :
                                filter === 'overdue' ? 'Overdue' : 'Completed'}
                    </h2>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Filter tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-surface border border-border rounded-full h-8 pl-9 pr-4 text-sm text-primary focus:outline-none focus:border-emerald-500/50 transition-colors w-64 placeholder:text-muted"
                        />
                    </div>
                </div>

                {/* Task List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredTasks.length > 0 ? (
                        <div className="flex flex-col">
                            {filteredTasks.map(task => (
                                <TaskItem
                                    key={task.id}
                                    task={task}
                                    onComplete={completeTask}
                                    onClick={handleEditClick}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted">
                            <ListTodo size={48} className="opacity-20 mb-4" />
                            <p>No tasks found</p>
                            <button
                                onClick={() => setFilter('all')}
                                className="text-sm text-emerald-500 mt-2 hover:underline"
                            >
                                Clear filters
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Drawer */}
            <CreateTaskDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                editTask={editingTask}
            />
        </div>
    );
};

// Helper Component for Sidebar Buttons
const NavButton = ({ active, onClick, icon: Icon, label, count, alert }: any) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center justify-between p-2 rounded-md text-sm font-medium transition-all",
            active
                ? "bg-emerald-500/10 text-emerald-500"
                : "text-secondary hover:bg-surface hover:text-primary"
        )}
    >
        <div className="flex items-center gap-3">
            <Icon size={16} className={cn(active ? "text-emerald-500" : "text-muted")} />
            <span>{label}</span>
        </div>
        {count > 0 && (
            <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full",
                active ? "bg-emerald-500/20 text-emerald-500" : "bg-surface text-muted",
                alert && !active && "text-rose-400 bg-rose-500/10"
            )}>
                {count}
            </span>
        )}
    </button>
);

export default TasksPage;

