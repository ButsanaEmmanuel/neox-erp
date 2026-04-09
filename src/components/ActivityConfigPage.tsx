import React, { useState } from 'react';
import { Settings, Plus, Check, MoreHorizontal } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Mock Activity Types
const ACTIVITY_TYPES = [
    { id: 'note', label: 'Note', icon: 'Memo', color: 'bg-muted', enabled: true },
    { id: 'call', label: 'Call', icon: 'Phone', color: 'bg-sky-500', enabled: true },
    { id: 'email', label: 'Email', icon: 'Mail', color: 'bg-purple-500', enabled: true },
    { id: 'meeting', label: 'Meeting', icon: 'Calendar', color: 'bg-orange-500', enabled: true },
    { id: 'lunch', label: 'Lunch', icon: 'Utensils', color: 'bg-pink-500', enabled: false }, // Disabled example
];

const ActivityConfigPage: React.FC = () => {
    const [types, setTypes] = useState(ACTIVITY_TYPES);

    const toggleType = (id: string) => {
        setTypes(prev => prev.map(t =>
            t.id === id ? { ...t, enabled: !t.enabled } : t
        ));
    };

    return (
        <div className="flex flex-col h-full bg-app text-primary">
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center px-6 bg-app/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Settings size={18} className="text-secondary" />
                    <h2 className="font-semibold text-lg text-primary">Activity Types Configuration</h2>
                </div>
            </div>

            <div className="p-8 max-w-4xl mx-auto w-full">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="text-base font-medium text-primary">Activity Types</h3>
                        <p className="text-sm text-muted mt-1">Manage which activity types are available for your team.</p>
                    </div>

                    <div className="divide-y divide-border/60">
                        {types.map((type) => (
                            <div key={type.id} className="flex items-center justify-between p-4 hover:bg-surface transition-colors">
                                <div className="flex items-center gap-4">
                                    {/* Icon Preview */}
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center text-primary font-medium",
                                        type.enabled ? type.color : "bg-surface text-muted"
                                    )}>
                                        {type.label[0]}
                                    </div>
                                    <div>
                                        <div className="font-medium text-primary">{type.label}</div>
                                        <div className="text-xs text-muted">System ID: {type.id}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-sm text-secondary">{type.enabled ? 'Enabled' : 'Disabled'}</span>
                                        <div
                                            onClick={() => toggleType(type.id)}
                                            className={cn(
                                                "w-11 h-6 rounded-full relative transition-colors border border-transparent",
                                                type.enabled ? "bg-emerald-600" : "bg-border"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm",
                                                type.enabled ? "translate-x-5" : "translate-x-0"
                                            )} />
                                        </div>
                                    </label>

                                    <button className="p-2 text-muted hover:text-primary hover:bg-surface rounded-lg">
                                        <MoreHorizontal size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-surface flex justify-center">
                        <button className="flex items-center gap-2 text-sm font-medium text-secondary hover:text-emerald-500 transition-colors">
                            <Plus size={16} />
                            Add Custom Type
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivityConfigPage;

