import React from 'react';
import { Activity } from '../types/activity';
import { formatDistanceToNow } from 'date-fns';
import {
    Phone,
    Mail,
    MessageSquare,
    Calendar,
    CheckSquare,
    Clock,
    ArrowRightCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ActivityCardProps {
    activity: Activity;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {

    const getIcon = () => {
        switch (activity.type) {
            case 'call': return <Phone size={14} className="text-sky-400" />;
            case 'email': return <Mail size={14} className="text-purple-400" />;
            case 'meeting': return <Calendar size={14} className="text-orange-400" />;
            case 'task_created': return <CheckSquare size={14} className="text-emerald-400" />;
            case 'status_change': return <ArrowRightCircle size={14} className="text-secondary" />;
            default: return <MessageSquare size={14} className="text-secondary" />;
        }
    };

    const getBgColor = () => {
        switch (activity.type) {
            case 'call': return "bg-sky-500/10 border-sky-500/20";
            case 'email': return "bg-purple-500/10 border-purple-500/20";
            case 'meeting': return "bg-orange-500/10 border-orange-500/20";
            case 'task_created': return "bg-emerald-500/10 border-emerald-500/20";
            default: return "bg-surface border-border/70";
        }
    };

    return (
        <div className="flex gap-4 p-4 border-b border-border/60 group hover:bg-surface transition-colors">
            {/* Timeline Icon */}
            <div className="flex flex-col items-center">
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border",
                    getBgColor()
                )}>
                    {getIcon()}
                </div>
                {/* Connector Line */}
                <div className="w-px h-full bg-surface mt-2 group-last:hidden" />
            </div>

            {/* Content using flex-1 for width */}
            <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary">User 1</span>
                        <span className="text-xs text-muted">-</span>
                        <span className="text-xs text-secondary capitalize">{activity.type.replace('_', ' ')}</span>
                    </div>
                    <span className="text-xs text-muted flex items-center gap-1">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </span>
                </div>

                {/* Body */}
                <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                    {activity.body}
                </div>

                {/* Metadata Chips */}
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {activity.metadata.duration && (
                            <div className="px-2 py-1 rounded bg-surface border border-border/70 text-[10px] text-secondary flex items-center gap-1">
                                <Clock size={10} />
                                {Math.round(activity.metadata.duration / 60)} mins
                            </div>
                        )}
                        {activity.metadata.outcome && (
                            <div className="px-2 py-1 rounded bg-surface border border-border/70 text-[10px] text-secondary">
                                Outcome: <span className="text-secondary font-medium">{activity.metadata.outcome}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityCard;


