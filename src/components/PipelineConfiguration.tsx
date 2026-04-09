import React, { useState } from 'react';
import {
    ArrowLeft,
    GripVertical,
    Plus,
    Trash2,
    MoreHorizontal,
    AlertTriangle,
    Check,
    X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { STAGE_COLORS } from '../constants/crm';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface PipelineConfigurationProps {
    isDark: boolean;
    onBack: () => void;
}

interface StageConfig {
    id: string;
    name: string;
    color: string;
    probability: number;
    status: 'Neutral' | 'Won' | 'Lost';
    active: boolean;
}

const INITIAL_STAGES: StageConfig[] = [
    { id: '1', name: 'Discovery', color: STAGE_COLORS.Discovery, probability: 20, status: 'Neutral', active: true },
    { id: '2', name: 'Qualified', color: STAGE_COLORS.Qualified, probability: 40, status: 'Neutral', active: true },
    { id: '3', name: 'Proposal', color: STAGE_COLORS.Proposal, probability: 60, status: 'Neutral', active: true },
    { id: '4', name: 'Negotiation', color: STAGE_COLORS.Negotiation, probability: 75, status: 'Neutral', active: true },
    { id: '5', name: 'Closing', color: STAGE_COLORS.Closing, probability: 90, status: 'Won', active: true },
];

const PipelineConfiguration: React.FC<PipelineConfigurationProps> = ({ isDark, onBack }) => {
    const [stages, setStages] = useState<StageConfig[]>(INITIAL_STAGES);
    const [hasChanges, setHasChanges] = useState(false);

    // Settings State
    const [autoAdvance, setAutoAdvance] = useState(false);
    const [dealRotation, setDealRotation] = useState(true);
    const [staleAlerts, setStaleAlerts] = useState(true);
    const [staleDays, setStaleDays] = useState(14);
    const [requiredFields, setRequiredFields] = useState(false);
    const [requiredFieldsList, setRequiredFieldsList] = useState(['Close Date', 'Deal Value', 'Next Action']);

    const handleStageChange = (id: string, field: keyof StageConfig, value: any) => {
        setStages(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
        setHasChanges(true);
    };

    const handleStatusToggle = (id: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'Neutral' ? 'Won' : currentStatus === 'Won' ? 'Lost' : 'Neutral';
        handleStageChange(id, 'status', nextStatus);
    };

    const handleAddStage = () => {
        const newStage: StageConfig = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'New Stage',
            color: '#14b8a6', // Teal default
            probability: 10,
            status: 'Neutral',
            active: true
        };
        setStages([...stages, newStage]);
        setHasChanges(true);
    };

    const handleDeleteStage = (id: string) => {
        setStages(prev => prev.filter(s => s.id !== id));
        setHasChanges(true);
    }

    const handleSettingsChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
        setter(value);
        setHasChanges(true);
    }

    return (
        <div className="h-full flex flex-col relative bg-app">

            {/* Scrollable Content Area */}
            <div
                className="flex-1 overflow-y-auto"
                style={{
                    padding: '32px 40px',
                    height: 'calc(100vh - 64px)',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#64748b transparent'
                }}
            >
                {/* Page Header */}
                <div className="flex flex-col mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <button onClick={onBack} className={cn("hover:text-emerald-500 transition-colors", isDark ? "text-secondary" : "text-muted")}>
                            <ArrowLeft size={14} />
                        </button>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-muted">CRM · Pipeline · Configuration</span>
                    </div>
                    <h1 className="text-[22px] font-semibold text-primary">Pipeline Configuration</h1>
                    <p className="text-[13px] text-muted mt-1">Manage stages, probabilities, and pipeline behavior</p>
                </div>

                <div className="h-[1px] w-full mb-8 bg-border" />

                {/* SECTION 1: Pipeline Stages */}
                <div className="grid gap-8 mb-10" style={{ gridTemplateColumns: '240px 1fr' }}>
                    <div>
                        <h3 className="text-[14px] font-semibold text-primary">Pipeline Stages</h3>
                        <p className="text-[12px] text-muted mt-1">Define the stages deals move through. Drag to reorder.</p>
                    </div>

                    <div className="rounded-[10px] border overflow-hidden bg-card border-border">
                        {/* Stage List */}
                        <div className="flex flex-col">
                            {stages.map((stage, index) => (
                                <div
                                    key={stage.id}
                                    className={cn(
                                        "grid items-center gap-3 px-4 py-3 border-b transition-colors",
                                        "border-border/60 hover:bg-surface",
                                        index === stages.length - 1 && "border-b-0"
                                    )}
                                    style={{ gridTemplateColumns: '24px 28px 1fr 120px 80px 80px 40px' }}
                                >
                                    {/* Drag Handle */}
                                    <div className="cursor-grab text-muted hover:text-secondary">
                                        <GripVertical size={14} />
                                    </div>

                                    {/* Color Dot */}
                                    <button className="w-3 h-3 rounded-full hover:scale-125 transition-transform" style={{ backgroundColor: stage.color }} />

                                    {/* Name Input */}
                                    <input
                                        type="text"
                                        value={stage.name}
                                        onChange={(e) => handleStageChange(stage.id, 'name', e.target.value)}
                                        className={cn(
                                            "bg-transparent border-0 outline-none text-[13px] font-medium focus:border-b focus:border-emerald-500 px-0 py-1 transition-all",
                                            "text-primary placeholder:text-muted"
                                        )}
                                    />

                                    {/* Probability Input */}
                                    <div className="flex items-center relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={stage.probability}
                                            onChange={(e) => handleStageChange(stage.id, 'probability', parseInt(e.target.value))}
                                            className={cn(
                                                "w-full text-right pr-6 py-1.5 rounded-md text-[12px] border outline-none focus:border-emerald-500 transition-all",
                                                "bg-surface border-input text-primary"
                                            )}
                                        />
                                        <span className="absolute right-2 text-[12px] text-muted pointer-events-none">%</span>
                                    </div>

                                    {/* Won/Lost Toggle */}
                                    <button
                                        onClick={() => handleStatusToggle(stage.id, stage.status)}
                                        className={cn(
                                            "h-6 rounded-full text-[10px] font-bold uppercase transition-all flex items-center justify-center border",
                                            stage.status === 'Neutral'
                                                ? "bg-surface text-muted border-border/60"
                                                : stage.status === 'Won'
                                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                        )}
                                    >
                                        {stage.status === 'Neutral' ? '-' : stage.status}
                                    </button>

                                    {/* Active Toggle */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => handleStageChange(stage.id, 'active', !stage.active)}
                                            className={cn(
                                                "w-8 h-4 rounded-full relative transition-colors duration-200",
                                                stage.active ? "bg-emerald-500" : "bg-border"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200",
                                                stage.active ? "translate-x-4" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>

                                    {/* Delete Button */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleDeleteStage(stage.id)}
                                            className="p-1.5 rounded hover:bg-rose-500/10 hover:text-rose-500 text-muted transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add Stage Button */}
                            <button
                                onClick={handleAddStage}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 py-2.5 text-[12px] transition-colors",
                                    "border-t border-border text-muted hover:bg-surface hover:text-secondary"
                                )}
                            >
                                <Plus size={14} />
                                Add Stage
                            </button>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: Pipeline Settings */}
                <div className="grid gap-8 mb-10" style={{ gridTemplateColumns: '240px 1fr' }}>
                    <div>
                        <h3 className="text-[14px] font-semibold text-primary">Pipeline Settings</h3>
                        <p className="text-[12px] text-muted mt-1">Configure global behavior for this pipeline.</p>
                    </div>

                    <div className="rounded-[10px] border overflow-hidden bg-card border-border">
                        {/* Setting Row: Auto-advance */}
                        <div className="flex justify-between items-center p-5 border-b border-border/60">
                            <div>
                                <p className="text-[13px] font-medium text-primary">Auto-advance deals</p>
                                <p className="text-[12px] text-muted mt-0.5">Automatically move deals to next stage when probability threshold is met</p>
                            </div>
                            <button
                                onClick={() => handleSettingsChange(setAutoAdvance, !autoAdvance)}
                                className={cn("w-9 h-5 rounded-full relative transition-colors duration-200", autoAdvance ? "bg-emerald-500" : "bg-border")}
                            >
                                <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200", autoAdvance ? "translate-x-4" : "translate-x-0")} />
                            </button>
                        </div>

                        {/* Setting Row: Deal Rotation */}
                        <div className="flex justify-between items-center p-5 border-b border-border/60">
                            <div>
                                <p className="text-[13px] font-medium text-primary">Deal rotation</p>
                                <p className="text-[12px] text-muted mt-0.5">Assign new deals to team members in round-robin order</p>
                            </div>
                            <button
                                onClick={() => handleSettingsChange(setDealRotation, !dealRotation)}
                                className={cn("w-9 h-5 rounded-full relative transition-colors duration-200", dealRotation ? "bg-emerald-500" : "bg-border")}
                            >
                                <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200", dealRotation ? "translate-x-4" : "translate-x-0")} />
                            </button>
                        </div>

                        {/* Setting Row: Stale Alert */}
                        <div className="flex justify-between items-center p-5 border-b border-border/60">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-[13px] font-medium text-primary">Stale deal alerts</p>
                                    {staleAlerts && (
                                        <div className="flex items-center gap-1.5 ml-2">
                                            {/* Inline Input for Days */}
                                            <span className="text-[12px] text-muted">Flag after</span>
                                            <input
                                                type="number"
                                                value={staleDays}
                                                onChange={(e) => handleSettingsChange(setStaleDays, parseInt(e.target.value))}
                                                className={cn(
                                                    "w-12 text-center py-0.5 rounded text-[12px] border outline-none focus:border-emerald-500",
                                                    "bg-surface border-input text-primary"
                                                )}
                                            />
                                            <span className="text-[12px] text-muted">days</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[12px] text-muted mt-0.5">Flag deals with no activity after X days</p>
                            </div>
                            <button
                                onClick={() => handleSettingsChange(setStaleAlerts, !staleAlerts)}
                                className={cn("w-9 h-5 rounded-full relative transition-colors duration-200", staleAlerts ? "bg-emerald-500" : "bg-border")}
                            >
                                <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200", staleAlerts ? "translate-x-4" : "translate-x-0")} />
                            </button>
                        </div>

                        {/* Setting Row: Required Fields */}
                        <div className="flex justify-between items-center p-5 border-border/60">
                            <div className="flex-1 mr-8">
                                <p className="text-[13px] font-medium text-primary">Required fields on stage move</p>
                                <p className="text-[12px] text-muted mt-0.5 mb-2">Enforce mandatory fields when advancing a deal</p>

                                {requiredFields && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {requiredFieldsList.map(field => (
                                            <div key={field} className={cn(
                                                "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border",
                                                "bg-surface border-border text-secondary"
                                            )}>
                                                {field}
                                                <button onClick={() => setRequiredFieldsList(prev => prev.filter(f => f !== field))} className="hover:text-rose-500"><X size={10} /></button>
                                            </div>
                                        ))}
                                        <button className="text-[11px] text-emerald-500 hover:text-emerald-400 font-medium px-2 py-0.5">+ Add field</button>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => handleSettingsChange(setRequiredFields, !requiredFields)}
                                className={cn("w-9 h-5 rounded-full relative transition-colors duration-200", requiredFields ? "bg-emerald-500" : "bg-border")}
                            >
                                <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200", requiredFields ? "translate-x-4" : "translate-x-0")} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* SECTION 3: Danger Zone */}
                <div className="grid gap-8 mb-20" style={{ gridTemplateColumns: '240px 1fr' }}>
                    <div>
                        <h3 className="text-[14px] font-semibold text-rose-500">Danger Zone</h3>
                        <p className="text-[12px] text-muted mt-1">Irreversible actions. Proceed with caution.</p>
                    </div>

                    <div className={cn(
                        "rounded-[10px] border p-5",
                        isDark ? "bg-card border-rose-500/20" : "bg-white border-rose-200"
                    )}>
                        <div className="flex items-center justify-between pb-5 border-b border-rose-500/10">
                            <div>
                                <p className="text-[13px] font-medium text-primary">Reset pipeline</p>
                                <p className="text-[12px] text-muted mt-0.5">Reset all deals to Discovery stage</p>
                            </div>
                            <button className="px-3.5 py-1.5 rounded-md border border-rose-500/30 text-[12px] font-medium text-rose-500 hover:bg-rose-500/10 transition-colors">
                                Reset Pipeline
                            </button>
                        </div>
                        <div className="flex items-center justify-between pt-5">
                            <div>
                                <p className="text-[13px] font-medium text-primary">Delete pipeline</p>
                                <p className="text-[12px] text-muted mt-0.5">Permanently delete this pipeline and all associated deals</p>
                            </div>
                            <button className="px-3.5 py-1.5 rounded-md border border-rose-500/30 text-[12px] font-medium text-rose-500 hover:bg-rose-500/10 transition-colors">
                                Delete Pipeline
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Save Footer */}
            <div
                className="absolute bottom-0 left-0 right-0 p-4 border-t flex justify-end gap-3 backdrop-blur-sm z-50 bg-surface/90 border-border"
            >
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-md text-[13px] font-medium border transition-colors border-input text-secondary hover:text-primary"
                >
                    Cancel
                </button>
                <button
                    disabled={!hasChanges}
                    onClick={() => setHasChanges(false)}
                    className={cn(
                        "px-4 py-2 rounded-md text-[13px] font-bold text-primary transition-all",
                        hasChanges ? "bg-emerald-500 hover:bg-emerald-400 cursor-pointer shadow-lg shadow-emerald-500/20" : "bg-surface text-muted cursor-not-allowed"
                    )}
                >
                    Save Changes
                </button>
            </div>

        </div>
    );
};

export default PipelineConfiguration;

