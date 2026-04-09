import React from 'react';
import {
    ArrowLeft,
    Settings,
    CreditCard,
    PieChart,
    BarChart3
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const FinancePlaceholder: React.FC<{ title: string, description: string, icon: React.ReactNode }> = ({ title, description, icon }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center p-12 animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-500 mb-8 relative">
                <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full" />
                {icon}
            </div>

            <h2 className="text-2xl font-bold text-primary mb-3 text-center tracking-tight">{title}</h2>
            <p className="text-secondary text-center max-w-sm mb-12 leading-relaxed">
                {description}
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <div className="h-2 w-2/3 bg-white/5 rounded-full" />
                    <div className="h-2 w-full bg-white/5 rounded-full" />
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <div className="h-2 w-1/2 bg-white/5 rounded-full" />
                    <div className="h-2 w-full bg-white/5 rounded-full" />
                </div>
            </div>

            <button
                onClick={() => window.history.back()}
                className="mt-12 group flex items-center gap-2 text-[11px] font-bold text-muted hover:text-primary uppercase tracking-[0.2em] transition-all"
            >
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                Go Back
            </button>
        </div>
    );
};

export const PaymentsPlaceholder = () => (
    <FinancePlaceholder
        title="Payments Management"
        description="Streamline your incoming and outgoing payments with automated reconciliation and bank sync."
        icon={<CreditCard size={40} strokeWidth={1.5} />}
    />
);

export const BudgetsPlaceholder = () => (
    <FinancePlaceholder
        title="Financial Budgeting"
        description="Monitor spending against category limits in real-time. Forecast cashflow and optimize burn rate."
        icon={<PieChart size={40} strokeWidth={1.5} />}
    />
);

export const ReportsPlaceholder = () => (
    <FinancePlaceholder
        title="Advanced Analytics"
        description="Generate P&L statements, Cashflow reports, and Accounts Receivable aging with one click."
        icon={<BarChart3 size={40} strokeWidth={1.5} />}
    />
);

export const SettingsPlaceholder = () => (
    <FinancePlaceholder
        title="Finance Settings"
        description="Configure your currency preferences, category mapping, and institutional bank connections."
        icon={<Settings size={40} strokeWidth={1.5} />}
    />
);


