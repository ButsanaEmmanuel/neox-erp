import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TrendingUp, TrendingDown } from 'lucide-react';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface AnalyticsCardProps {
    readonly title: string;
    readonly value: string;
    readonly trend?: { val: string; positive: boolean };
    readonly icon: React.ReactNode;
    readonly children?: React.ReactNode;
    readonly isDark: boolean;
    readonly className?: string;
}

export const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
    title,
    value,
    trend,
    icon,
    children,
    isDark,
    className
}) => {
    return (
        <div
            className={cn(
                "p-4 px-5 flex flex-col transition-all duration-300 rounded-[10px] border shadow-sm min-h-0 overflow-hidden",
                isDark
                    ? "bg-[#111827] border-[#1f2937] hover:border-[#2d3f55]"
                    : "bg-white border-slate-200 hover:border-slate-300",
                className
            )}
        >
            <div className="flex items-center gap-2 mb-1 flex-none">
                <span className="text-slate-500">{icon}</span>
                <h3 className="text-[10px] uppercase font-medium tracking-[0.04em] text-[#475569]">
                    {title}
                </h3>
            </div>

            <div className="flex items-center gap-2.5 flex-none">
                <p className={cn(
                    "text-[26px] md:text-[28px] lg:text-[2rem] font-semibold tracking-tight",
                    isDark ? "text-[#f1f5f9]" : "text-slate-900"
                )}>
                    {value}
                </p>
                {trend && (
                    <div className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                        trend.positive
                            ? "bg-[rgba(16,185,129,0.1)] text-neox-emerald"
                            : "bg-[rgba(244,63,94,0.1)] text-neox-rose"
                    )}>
                        {trend.positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {trend.val}
                    </div>
                )}
            </div>

            <div className="mt-2.5 flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </div>
    );
};

export const ProjectItem: React.FC<{ name: string; progress: number; status: 'active' | 'at-risk' | 'complete'; isDark: boolean }> = ({
    name,
    progress,
    status,
    isDark
}) => {
    const statusConfig = {
        active: { label: 'Active', color: 'text-neox-emerald bg-neox-emerald/10' },
        'at-risk': { label: 'At-Risk', color: 'text-amber-500 bg-amber-500/10' },
        complete: { label: 'Complete', color: 'text-sky-500 bg-sky-500/10' },
    };

    return (
        <div className="py-1 min-h-0">
            <div className="flex justify-between items-center mb-1">
                <span className={cn("text-[12px] font-medium leading-none", isDark ? "text-slate-300" : "text-slate-900")}>{name}</span>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold", statusConfig[status].color)}>
                    {statusConfig[status].label}
                </span>
            </div>
            <div className="flex items-center gap-2.5">
                <div className={cn("flex-1 h-[3px] rounded-full", isDark ? "bg-[#1e2d3d]" : "bg-slate-100")}>
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            status === 'active' ? "bg-neox-emerald" : status === 'at-risk' ? "bg-amber-500" : "bg-sky-500"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-[10px] text-slate-500 font-medium w-6 text-right">{progress}%</span>
            </div>
        </div>
    );
};

export const MetricRow: React.FC<{ label: string; value: string; progress: number; isDark: boolean; color?: string }> = ({
    label, value, progress, isDark, color = "bg-neox-emerald"
}) => {
    return (
        <div className="flex flex-col gap-1 py-1 min-h-0">
            <div className="flex justify-between items-center text-[12px] font-medium h-[14px]">
                <span className="text-slate-500">{label}</span>
                <span className={isDark ? "text-slate-300" : "text-slate-900"}>{value}</span>
            </div>
            <div className={cn("w-full h-[3px] rounded-full overflow-hidden mt-0.5", isDark ? "bg-[#1e2d3d]" : "bg-slate-100")}>
                <div
                    className={cn("h-full transition-all duration-1000", color)}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export const ClusterRow: React.FC<{ name: string; region: string; status: 'Track' | 'Delayed'; isDark: boolean }> = ({
    name, region, status, isDark
}) => {
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-[#1e2d3d]/50 last:border-0 h-[40px]">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("w-1.5 h-1.5 rounded-full flex-none", status === 'Track' ? "bg-neox-emerald" : "bg-neox-rose")} />
                <div className="min-w-0">
                    <p className={cn("text-[12px] font-medium truncate leading-tight", isDark ? "text-slate-200" : "text-slate-900")}>{name}</p>
                    <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">{region}</p>
                </div>
            </div>
            <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ml-2",
                status === 'Track' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>
                {status === 'Track' ? 'ON TRACK' : 'DELAYED'}
            </span>
        </div>
    );
};

export default { AnalyticsCard, ProjectItem, MetricRow, ClusterRow };
