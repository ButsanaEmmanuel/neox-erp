import React, { useState, useMemo, useRef } from 'react';
import {
    Filter,
    ChevronDown,
    Plus,
    MoreHorizontal,
    Clock,
    ArrowRight,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Deal } from '../types/deal'; // Import from types
import { useDeals } from '../contexts/DealsContext';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

import { STAGE_COLORS } from '../constants/crm';

const STAGES_CONFIG = [
    { id: 'Discovery', label: 'Discovery', color: STAGE_COLORS.Discovery },
    { id: 'Qualified', label: 'Qualified', color: STAGE_COLORS.Qualified },
    { id: 'Proposal', label: 'Proposal', color: STAGE_COLORS.Proposal },
    { id: 'Negotiation', label: 'Negotiation', color: STAGE_COLORS.Negotiation },
    { id: 'Closing', label: 'Closing', color: STAGE_COLORS.Closing },
] as const;

const OWNER_STYLES: Record<string, { bg: string, text: string }> = {
    'DK': { bg: '#1e3a5f', text: '#60a5fa' },
    'AL': { bg: '#2d1b4e', text: '#a78bfa' },
    'SJ': { bg: '#1a2e2a', text: '#10b981' },
};

const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${Math.round(val / 1000)}k`;
    return `$${val}`;
};

interface PipelineProps {
    isDark?: boolean; // Optional now as we use semantic tokens
}

const Pipeline: React.FC<PipelineProps> = () => {
    const { deals, updateDeal } = useDeals();
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
    const [dragOverStage, setDragOverStage] = useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const boardRef = useRef<HTMLDivElement>(null);

    // Dynamic calculations
    const stageStats = useMemo(() => {
        return STAGES_CONFIG.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.id);
            const total = stageDeals.reduce((sum, d) => sum + d.numericValue, 0);
            return {
                ...stage,
                count: stageDeals.length,
                totalValue: formatCurrency(total),
            };
        });
    }, [deals]);

    const totalPipelineValue = useMemo(() => {
        const total = deals.reduce((sum, d) => sum + d.numericValue, 0);
        return formatCurrency(total);
    }, [deals]);

    // DnD Handlers
    const handleDragStart = (e: React.DragEvent, dealId: string) => {
        setDraggedDealId(dealId);
        e.dataTransfer.setData('dealId', dealId);

        // Custom drag image logic or style application
        const target = e.currentTarget as HTMLElement;
        setTimeout(() => {
            target.style.opacity = '0.5';
            target.style.transform = 'rotate(1.5deg)';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = '1';
        target.style.transform = 'none';
        setDraggedDealId(null);
        setDragOverStage(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e: React.DragEvent, stageId: string, index: number | null = null) => {
        e.preventDefault();
        setDragOverStage(stageId);
        setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, stageId: any) => {
        e.preventDefault();
        const dealId = e.dataTransfer.getData('dealId');

        if (dealId) {
            const deal = deals.find(d => d.id === dealId);
            if (deal && deal.stage !== stageId) {
                // Update the deal stage using context
                updateDeal({ id: dealId, stage: stageId as any });
            }
        }

        setDragOverStage(null);
        setDragOverIndex(null);
    };

    return (
        // FULL HEIGHT CONTAINER
        <div className="h-full flex flex-col p-0 overflow-hidden relative bg-app" style={{ gap: '16px', padding: '16px 0 0 0' }}>
            <style dangerouslySetInnerHTML={{
                __html: `
        .pipeline-scrollbar::-webkit-scrollbar { height: 3px; }
        .pipeline-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .pipeline-scrollbar::-webkit-scrollbar-thumb { background: #2d4a6e; border-radius: 2px; }
        
        .column-scroll::-webkit-scrollbar { width: 4px; }
        .column-scroll::-webkit-scrollbar-track { background: transparent; }
        .column-scroll::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.55); border-radius: 10px; }
      ` }} />

            {/* Header Row - Condensed to 48px */}
            <div className="flex justify-between items-center flex-none px-6 h-[48px]">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em]">CRM · PIPELINE /</span>
                    <h1 className="text-[18px] font-bold tracking-tight text-primary">Pipeline</h1>
                </div>

                <div className="flex items-center gap-2">
                    <button className="h-8 px-3 rounded-md border border-border flex items-center gap-2 text-[12px] font-semibold transition-all bg-surface hover:bg-surface-highlight text-muted hover:text-primary">
                        <Filter size={14} />
                        Filter
                    </button>
                    <button className="h-8 px-3 rounded-md border border-border flex items-center gap-2 text-[12px] font-semibold transition-all bg-surface hover:bg-surface-highlight text-muted hover:text-primary">
                        Group by
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            {/* Summary Bar - Add horizontal padding */}
            <div className="flex items-center justify-between flex-none px-6" style={{ height: '40px' }}>
                <div className="flex items-center gap-3">
                    {stageStats.map((stage) => (
                        <div
                            key={stage.id}
                            className="flex items-center gap-2 px-3 py-1 rounded-lg border border-border text-[11px] font-semibold transition-all bg-surface shadow-sm"
                        >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                            <span className="text-muted uppercase tracking-wider">{stage.label}</span>
                            <span className="text-primary">{stage.totalValue}</span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2 pr-2">
                    <span className="text-[13px] font-semibold text-muted">Total Pipeline</span>
                    <span className="text-[15px] font-bold text-brand">{totalPipelineValue}</span>
                </div>
            </div>

            {/* Kanban Board - Fixed Horizontal Scroll Area with Updated Height Calc */}
            <div
                ref={boardRef}
                className="flex-1 flex gap-4 overflow-x-auto pipeline-scrollbar w-full"
                style={{
                    height: 'calc(100vh - 168px)', // 64 (header) + 48 (page header) + 40 (summary) + 16 (padding)
                    padding: '0 24px 16px 24px', // Standard Padding
                    paddingRight: '24px' // Explicit right padding for truncation safety
                }}
            >
                {STAGES_CONFIG.map((stage) => {
                    const stats = stageStats.find(s => s.id === stage.id);
                    const columnDeals = deals.filter(d => d.stage === stage.id);
                    const isClosingColumn = stage.id === 'Closing';

                    return (
                        <div
                            key={stage.id}
                            className="min-w-[260px] w-[280px] flex-none flex flex-col h-full rounded-xl relative"
                            onDragOver={(e) => handleDragOver(e, stage.id)}
                            onDrop={(e) => handleDrop(e, stage.id)}
                        >
                            {/* Column Header */}
                            <div className="flex flex-col gap-2 pb-4 px-1 group cursor-default flex-none">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">{stage.label}</span>
                                        <div className="bg-surface px-2 py-0.5 rounded text-[11px] font-bold text-muted">
                                            {stats?.count}
                                        </div>
                                    </div>
                                    <MoreHorizontal size={16} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                                </div>
                    <span className="text-[12px] font-semibold text-muted">{stats?.totalValue}</span>
                                <div className="h-[2px] w-full rounded-full" style={{ backgroundColor: stage.color }} />
                            </div>

                            {/* Cards Scroll Area - Inner Scroll with Fixed Height Calculation */}
                            <div
                                className="flex flex-col gap-3 pr-1 column-scroll relative"
                                style={{
                                    height: 'calc(100% - 80px)', // Account for Sticky Footer
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    paddingBottom: '56px' // Prevent content from being hidden behind sticky footer
                                }}
                            >
                                {columnDeals.map((deal, idx) => {
                                    const probStyle = deal.probabilityValue > 70
                                        ? { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)', text: '#10b981' }
                                        : deal.probabilityValue >= 40
                                            ? { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', text: '#f59e0b' }
                                            : { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.15)', text: '#f43f5e' };

                                    const ownerStyle = OWNER_STYLES[deal.owner] || { bg: '#1e3a5f', text: '#60a5fa' };
                                    const isLongName = deal.name.length > 20;

                                    return (
                                        <React.Fragment key={deal.id}>
                                            {/* Ghost Placeholder at specific index */}
                                            {dragOverStage === stage.id && dragOverIndex === idx && draggedDealId && (
                                                <div className="flex-shrink-0 min-h-[140px] w-full border-[1.5px] border-dashed border-brand/50 rounded-[10px] bg-brand/5 flex items-center justify-center animate-pulse transition-all duration-150" />
                                            )}

                                            <div
                                                draggable="true"
                                                onDragStart={(e) => handleDragStart(e, deal.id)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => handleDragOver(e, stage.id, idx)}
                                                onClick={() => setSelectedDeal(deal)}
                                                className="flex-shrink-0 flex flex-col rounded-[10px] border border-border p-4 transition-all duration-150 cursor-grab active:cursor-grabbing bg-card hover:border-brand hover:shadow-md"
                                                style={{
                                                    minHeight: '0' // Cards must always render at full natural height
                                                }}
                                            >
                                                {/* Card Top Row */}
                                                <div className="flex items-center justify-between mb-auto">
                                                    <div
                                                        className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[10px] font-bold bg-surface text-primary"
                                                    >
                                                        {deal.initials}
                                                    </div>
                                                    <div
                                                        className="px-2 py-0.5 rounded-full border text-[10px] font-semibold"
                                                        style={{
                                                            backgroundColor: probStyle.bg,
                                                            borderColor: probStyle.border,
                                                            color: probStyle.text
                                                        }}
                                                    >
                                                        {deal.probability}
                                                    </div>
                                                </div>

                                                <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.06em] mt-2.5">
                                                    {deal.company?.name || 'No Company'}
                                                </span>

                                                <h4
                                                    className="font-bold mt-0.5 leading-tight truncate w-full text-primary"
                                                    style={{
                                                        fontSize: isLongName ? '12px' : '14px',
                                                        lineHeight: isLongName ? '1.4' : '1.3',
                                                        ...(isClosingColumn ? {
                                                            maxWidth: '140px',
                                                            textOverflow: 'ellipsis',
                                                            overflow: 'hidden',
                                                            whiteSpace: 'nowrap'
                                                        } : {})
                                                    }}
                                                >
                                                    {deal.name}
                                                </h4>

                                                <p className="text-[18px] font-extrabold mt-1.5 tracking-tight text-primary">
                                                    {deal.value}
                                                </p>

                                                <div className="h-[1px] w-full bg-border my-3" />

                                                <div className="flex items-center justify-between mt-auto">
                                                    <div
                                                        className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[8px] font-bold"
                                                        style={{ backgroundColor: ownerStyle.bg, color: ownerStyle.text }}
                                                    >
                                                        {deal.owner}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-muted">
                                                        <Clock size={12} className="text-muted" />
                                                        <span className="text-[11px] font-medium">{deal.lastActivity}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                {/* Ghost Placeholder at the bottom if dragging over column but not specific card */}
                                {dragOverStage === stage.id && dragOverIndex === null && draggedDealId && (
                                    <div className="flex-shrink-0 min-h-[140px] w-full border-[1.5px] border-dashed border-brand/50 rounded-[10px] bg-brand/5 animate-pulse transition-all duration-150" />
                                )}
                            </div>

                            {/* Sibling Footer - Positioned absolute at bottom */}
                            <div
                                className="absolute bottom-0 w-full pt-4 pb-1 bg-gradient-to-t from-app via-app to-transparent"
                            >
                                <button className="w-full py-2.5 rounded-lg border border-dashed border-border flex items-center justify-center gap-2 text-[11px] font-bold transition-all text-muted hover:bg-surface hover:text-primary">
                                    <Plus size={14} />
                                    Add Card
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Slide-over Detail Panel */}
            <AnimatePresence>
                {selectedDeal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDeal(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-[60]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute top-0 right-0 h-full w-[380px] border-l border-border shadow-2xl z-[70] flex flex-col p-8 bg-card"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-brand/10 text-brand text-[10px] font-bold tracking-[0.15em] uppercase">
                                    Deal Insight
                                </div>
                                <button
                                    onClick={() => setSelectedDeal(null)}
                                    className="p-2 rounded-full hover:bg-surface transition-colors text-muted"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2 tracking-tight text-primary">
                                        {selectedDeal.name}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-bold text-brand">{selectedDeal.value}</span>
                                        <span className="text-muted text-sm font-medium tracking-wide">· {selectedDeal.company?.name || 'No Company'}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-5">
                                    {[
                                        { label: 'Current Stage', value: selectedDeal.stage },
                                        { label: 'Probability', value: selectedDeal.probability },
                                        { label: 'Expectation', value: 'High Confidence' },
                                        { label: 'Deal Owner', value: selectedDeal.owner === 'DK' ? 'Diva Kalala' : selectedDeal.owner === 'AL' ? 'Alex Lowen' : 'Sam Jones' },
                                        { label: 'Last Update', value: selectedDeal.lastActivity },
                                    ].map((field) => (
                                        <div key={field.label} className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.08em]">{field.label}</span>
                                            <span className="text-[14px] font-semibold text-primary">
                                                {field.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-6 border-t border-border flex flex-col gap-4">
                                    <h3 className="text-[10px] font-bold text-muted uppercase tracking-[0.1em]">Intelligence Summary</h3>
                                    <div className="p-5 rounded-xl border border-dashed border-border flex flex-col gap-3 bg-surface">
                                        <p className="text-[13px] leading-relaxed text-muted italic">This deal has been active for {selectedDeal.lastActivity}. Current probability suggests a strong match for the Q1 pipeline targets.</p>
                                        <button className="text-[12px] font-bold text-brand hover:underline flex items-center gap-1.5 group">
                                            View Timeline Analysis <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <button className="w-full py-3.5 rounded-xl bg-brand text-black text-[14px] font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg active:scale-95">
                                    Advance Deal Stage
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Pipeline;


