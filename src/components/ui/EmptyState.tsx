import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon = Inbox, title, description, action }) => (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-surface flex items-center justify-center mb-4 border border-border/60">
            <Icon size={24} className="text-muted" />
        </div>
        <h3 className="text-[15px] font-semibold text-primary mb-1">{title}</h3>
        {description && <p className="text-[13px] text-muted max-w-sm">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

export default EmptyState;
