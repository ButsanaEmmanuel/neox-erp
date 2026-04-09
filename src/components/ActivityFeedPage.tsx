import React, { useState, useMemo } from 'react';
import { useActivityStore } from '../store/useActivityStore';
import ActivityCard from './ActivityCard';
import {
    Search,
    Filter,
    Plus,
    MessageSquare,
    Phone,
    Mail,
    Calendar
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type ActivityFilterType = 'all' | 'calls' | 'emails' | 'meetings' | 'notes';

import LogActivityDrawer from './LogActivityDrawer';

const ActivityFeedPage: React.FC = () => {
    const { activities } = useActivityStore();
    const [filter, setFilter] = useState<ActivityFilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const filteredActivities = useMemo(() => {
        let result = activities;

        // 1. Filter by Type
        if (filter === 'calls') result = result.filter(a => a.type === 'call');
        if (filter === 'emails') result = result.filter(a => a.type === 'email');
        if (filter === 'meetings') result = result.filter(a => a.type === 'meeting');
        if (filter === 'notes') result = result.filter(a => a.type === 'note');

        // 2. Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a => a.body.toLowerCase().includes(q));
        }

        // 3. Sort by Date (Newest first)
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [activities, filter, searchQuery]);

    const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 p-2 rounded-md text-sm font-medium transition-all",
                active
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "text-secondary hover:bg-surface hover:text-primary"
            )}
        >
            <Icon size={16} className={cn(active ? "text-emerald-500" : "text-muted")} />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="flex h-full bg-app text-primary">
            {/* Sidebar / Filters */}
            <div className="w-60 border-r border-border flex flex-col p-4 gap-1">
                <button
                    onClick={() => setIsDrawerOpen(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-md font-medium text-sm mb-4 transition-colors shadow-sm shadow-emerald-900/20"
                >
                    <Plus size={16} />
                    <span>Log Activity</span>
                </button>

                <div className="space-y-0.5">
                    <NavButton
                        active={filter === 'all'}
                        onClick={() => setFilter('all')}
                        icon={Filter}
                        label="All Activity"
                    />
                    <NavButton
                        active={filter === 'calls'}
                        onClick={() => setFilter('calls')}
                        icon={Phone}
                        label="Calls"
                    />
                    <NavButton
                        active={filter === 'emails'}
                        onClick={() => setFilter('emails')}
                        icon={Mail}
                        label="Emails"
                    />
                    <NavButton
                        active={filter === 'meetings'}
                        onClick={() => setFilter('meetings')}
                        icon={Calendar}
                        label="Meetings"
                    />
                    <NavButton
                        active={filter === 'notes'}
                        onClick={() => setFilter('notes')}
                        icon={MessageSquare}
                        label="Notes"
                    />
                </div>
            </div>

            {/* Main Feed */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="h-14 border-b border-border flex items-center justify-between px-6">
                    <h2 className="font-semibold text-lg text-primary">Activity Feed</h2>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Search activity..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-surface border border-border rounded-full h-8 pl-9 pr-4 text-sm text-primary focus:outline-none focus:border-emerald-500/50 transition-colors w-64 placeholder:text-muted"
                        />
                    </div>
                </div>

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto p-0">
                    {filteredActivities.length > 0 ? (
                        <div className="flex flex-col max-w-3xl mx-auto w-full">
                            {filteredActivities.map(activity => (
                                <ActivityCard key={activity.id} activity={activity} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted">
                            <MessageSquare size={48} className="opacity-20 mb-4" />
                            <p>No activities found</p>
                        </div>
                    )}
                </div>
            </div>

            <LogActivityDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
            />
        </div>
    );
};

export default ActivityFeedPage;

