import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ProfessionalEmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    maxWidth?: string;
}

const ProfessionalEmptyState: React.FC<ProfessionalEmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    secondaryAction,
    maxWidth = 'max-w-md'
}) => {
    return (
        <div className={`flex flex-col items-center justify-center text-center p-12 ${maxWidth} mx-auto`}>
            {/* Animated Icon Container */}
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150 opacity-20 animate-pulse" />
                <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-card to-surface border border-border/60 flex items-center justify-center shadow-2xl shadow-blue-900/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <Icon size={40} className="text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
                </div>
                
                {/* Secondary decorative elements */}
                <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-purple-500/30 blur-md animate-bounce" />
                <div className="absolute -bottom-4 -left-4 w-6 h-6 rounded-full bg-emerald-500/20 blur-lg" />
            </div>

            <h2 className="text-2xl font-bold text-primary tracking-tight mb-3">
                {title}
            </h2>
            
            <p className="text-muted text-sm leading-relaxed mb-10 max-w-[320px] mx-auto">
                {description}
            </p>

            <div className="flex items-center gap-4">
                {secondaryAction && (
                    <button
                        onClick={secondaryAction.onClick}
                        className="px-6 py-2.5 text-sm font-medium text-muted hover:text-primary hover:bg-surface border border-input rounded-xl transition-all"
                    >
                        {secondaryAction.label}
                    </button>
                )}
                
                {action && (
                    <button
                        onClick={action.onClick}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 group"
                    >
                        {action.icon && <action.icon size={16} className="group-hover:scale-110 transition-transform" />}
                        {action.label}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProfessionalEmptyState;
