import React from 'react';
import { GitBranch, ArrowRight } from 'lucide-react';

const AutomationRules: React.FC = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 bg-surface rounded-2xl flex items-center justify-center mb-4 border border-input">
                <GitBranch size={32} className="text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2">Automation Rules</h3>
            <p className="text-sm text-muted max-w-md mx-auto mb-8">
                Rules are currently handled automatically based on Department defaults.
                Future versions will support custom trigger-action workflows.
            </p>

            <div className="text-left bg-card border border-border rounded-xl p-6 max-w-2xl w-full">
                <h4 className="text-[13px] font-semibold text-secondary uppercase tracking-wider mb-4">Active System Rules</h4>

                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-border/40">
                        <div className="bg-emerald-500/10 text-emerald-500 text-[11px] font-mono px-2 py-0.5 rounded">TRIGGER</div>
                        <span className="text-[13px] text-primary">Candidate Hired</span>
                        <ArrowRight size={14} className="text-muted" />
                        <div className="bg-blue-500/10 text-blue-400 text-[11px] font-mono px-2 py-0.5 rounded">ACTION</div>
                        <span className="text-[13px] text-primary">Start Onboarding (Dept Default)</span>
                    </div>

                    <div className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-border/40">
                        <div className="bg-emerald-500/10 text-emerald-500 text-[11px] font-mono px-2 py-0.5 rounded">TRIGGER</div>
                        <span className="text-[13px] text-primary">Employee Offboarding Started</span>
                        <ArrowRight size={14} className="text-muted" />
                        <div className="bg-blue-500/10 text-blue-400 text-[11px] font-mono px-2 py-0.5 rounded">ACTION</div>
                        <span className="text-[13px] text-primary">Create Offboarding Plan (Dept Default)</span>
                    </div>

                    <div className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-border/40">
                        <div className="bg-emerald-500/10 text-emerald-500 text-[11px] font-mono px-2 py-0.5 rounded">TRIGGER</div>
                        <span className="text-[13px] text-primary">All Required Tasks Completed</span>
                        <ArrowRight size={14} className="text-muted" />
                        <div className="bg-blue-500/10 text-blue-400 text-[11px] font-mono px-2 py-0.5 rounded">ACTION</div>
                        <span className="text-[13px] text-primary">Update Employee Status (Active/Inactive)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutomationRules;



