import React from 'react';
import { BarChart3, Settings, Construction } from 'lucide-react';

export const SCMReportsPage: React.FC = () => (
    <div className="h-full flex flex-col items-center justify-center p-12 bg-app text-muted">
        <div className="w-20 h-20 rounded-3xl bg-surface border border-border flex items-center justify-center mb-8">
            <BarChart3 size={40} className="opacity-20" />
        </div>
        <div className="text-center max-w-md">
            <h2 className="text-lg font-bold text-primary mb-3">SCM Analytics & Reporting</h2>
            <p className="text-sm leading-relaxed opacity-60 mb-8">
                Inventory valuation, spend analysis, and stock movement reports are currently being optimized for deep-link integration.
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-blue-500 uppercase tracking-[0.2em] bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
                <Construction size={14} /> Analytics Engine Under Construction
            </div>
        </div>
    </div>
);

export const SCMSettingsPage: React.FC = () => (
    <div className="h-full flex flex-col items-center justify-center p-12 bg-app text-muted">
        <div className="w-20 h-20 rounded-3xl bg-surface border border-border flex items-center justify-center mb-8">
            <Settings size={40} className="opacity-20" />
        </div>
        <div className="text-center max-w-md">
            <h2 className="text-lg font-bold text-primary mb-3">SCM Module Settings</h2>
            <p className="text-sm leading-relaxed opacity-60 mb-8">
                Configure units of measure, categories, and automated reorder triggers. Access to this section is restricted to administrators.
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-amber-500 uppercase tracking-[0.2em] bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20">
                <Settings size={14} /> Configuration Access Restricted
            </div>
        </div>
    </div>
);


