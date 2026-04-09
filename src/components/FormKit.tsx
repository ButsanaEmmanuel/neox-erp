import React from 'react';
import { X, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Types ---
interface FormKitProps {
    isDark: boolean;
    children?: React.ReactNode;
    className?: string;
}

// --- Components ---

/**
 * 1. FormShell
 * The main container for the page. Handles the background and layout structure.
 */
export const FormShell: React.FC<FormKitProps & { onSubmit?: (e: React.FormEvent) => void; id?: string }> = ({ isDark, children, className, onSubmit, id }) => {
    return (
        <div className={cn(
            "flex flex-col h-full overflow-hidden relative font-sans selection:bg-emerald-500/30",
            isDark ? "bg-[#0d1117] text-slate-200" : "bg-slate-50 text-slate-900",
            className
        )}>
            {/* Background Texture/Gradient (Subtle) */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
            />
            {onSubmit ? (
                <form id={id} onSubmit={onSubmit} className="flex flex-col h-full relative z-10">
                    {children}
                </form>
            ) : (
                <div className="flex flex-col h-full relative z-10">{children}</div>
            )}
        </div>
    );
};

/**
 * 2. FormHeader
 * Breadcrumbs, Title, Subtitle, Close Action.
 */
interface FormHeaderProps extends FormKitProps {
    title: string;
    subtitle?: string;
    breadcrumb: string;
    onBack: () => void;
}

export const FormHeader: React.FC<FormHeaderProps> = ({ isDark, title, subtitle, breadcrumb, onBack }) => {
    return (
        <div className={cn(
            "h-20 px-6 md:px-12 flex items-center justify-between flex-none border-b transition-colors duration-200",
            isDark ? "bg-[#0d1117]/80 backdrop-blur-sm border-white/[0.06]" : "bg-white/80 backdrop-blur-sm border-slate-200"
        )}>
            <div className="flex flex-col gap-1">
                <nav className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-slate-500">
                    <span className="opacity-70">CRM</span>
                    <span className="opacity-40">/</span>
                    <span className="opacity-70">{breadcrumb}</span>
                </nav>
                <div className="flex items-center gap-3">
                    <h1 className={cn("text-xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                        {title}
                    </h1>
                    {subtitle && (
                        <span className={cn("hidden md:inline-block text-sm font-medium pt-1", isDark ? "text-slate-500" : "text-slate-400")}>
                            — {subtitle}
                        </span>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={onBack}
                className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 group",
                    isDark ? "bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                )}
            >
                <X size={16} className="group-hover:scale-110 transition-transform" />
            </button>
        </div>
    );
};

/**
 * 3. FormBody
 * Wrapper for the scrollable content area.
 */
export const FormBody: React.FC<FormKitProps> = ({ children, className }) => {
    return (
        <div className={cn("flex-1 overflow-y-auto overflow-x-hidden w-full", className)}>
            <div className="max-w-5xl mx-auto p-6 md:p-10 pb-32 flex flex-col gap-10">
                {children}
            </div>
        </div>
    );
};

/**
 * 4. FormSection
 * A thematic grouping of fields.
 */
interface FormSectionProps extends FormKitProps {
    title: string;
    icon?: React.ReactNode;
    description?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({ isDark, title, icon, description, children }) => {
    return (
        <section className="flex flex-col md:flex-row gap-6 md:gap-12 group">
            {/* Left: Section Header (Desktop) or Top (Mobile) */}
            <div className="flex-none w-full md:w-64 flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2.5">
                    {icon && <div className={cn("text-emerald-500 transition-opacity duration-300", isDark ? "opacity-90 group-hover:opacity-100" : "opacity-100")}>{icon}</div>}
                    <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-slate-200" : "text-slate-800")}>
                        {title}
                    </h3>
                </div>
                {description && <p className="text-xs text-slate-500 leading-relaxed font-medium max-w-[240px]">{description}</p>}
            </div>

            {/* Right: Fields Content */}
            <div className={cn(
                "flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 relative",
            )}>
                {children}
            </div>
        </section>
    );
};

/**
 * 5. Field
 * Wrapper for individual inputs with Label and Error.
 */
interface FieldProps extends FormKitProps {
    label: string;
    required?: boolean;
    error?: string;
    fullWidth?: boolean;
}

export const Field: React.FC<FieldProps> = ({ isDark, label, required, error, children, fullWidth }) => {
    return (
        <div className={cn("flex flex-col gap-2", fullWidth && "md:col-span-2")}>
            <div className="flex items-baseline justify-between">
                <label className={cn(
                    "text-[12px] font-semibold tracking-wide transition-colors",
                    isDark ? "text-slate-400 group-focus-within:text-emerald-400" : "text-slate-500 group-focus-within:text-emerald-600"
                )}>
                    {label}
                    {required && <span className="text-rose-500 ml-0.5">*</span>}
                </label>
                {error && <span className="text-[11px] font-medium text-rose-500 animate-in fade-in slide-in-from-right-2">{error}</span>}
            </div>
            <div className="relative group">
                {children}
            </div>
        </div>
    );
};

/**
 * 6. Inputs (Text, Select, TextArea)
 */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    isDark: boolean;
    icon?: React.ReactNode;
}

export const TextInput = React.forwardRef<HTMLInputElement, InputProps>(({ isDark, icon, className, ...props }, ref) => {
    return (
        <div className="relative">
            {icon && (
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                    {icon}
                </div>
            )}
            <input
                ref={ref}
                className={cn(
                    "w-full h-11 rounded-xl border text-[14px] font-medium transition-all duration-200",
                    "placeholder:text-slate-500 placeholder:font-normal placeholder:antialiased",
                    "focus:outline-none focus:ring-[3px] focus:ring-offset-0",
                    icon ? "pl-10 pr-4" : "px-4",
                    isDark
                        ? "bg-[#161b22] border-white/[0.08] text-white focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-white/[0.15]"
                        : "bg-white border-slate-200 text-slate-900 focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-slate-300 shadow-sm",
                    className
                )}
                {...props}
            />
        </div>
    );
});
TextInput.displayName = 'TextInput';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    isDark: boolean;
    icon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ isDark, icon, children, className, ...props }, ref) => {
    return (
        <div className="relative">
            {icon && (
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                    {icon}
                </div>
            )}
            <select
                ref={ref}
                className={cn(
                    "w-full h-11 rounded-xl border text-[14px] font-medium transition-all duration-200 appearance-none cursor-pointer",
                    "focus:outline-none focus:ring-[3px] focus:ring-offset-0",
                    icon ? "pl-10 pr-10" : "px-4 pr-10",
                    isDark
                        ? "bg-[#161b22] border-white/[0.08] text-white focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-white/[0.15]"
                        : "bg-white border-slate-200 text-slate-900 focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-slate-300 shadow-sm",
                    className
                )}
                {...props}
            >
                {children}
            </select>
            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
    );
});
Select.displayName = 'Select';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    isDark: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(({ isDark, className, ...props }, ref) => {
    return (
        <textarea
            ref={ref}
            className={cn(
                "w-full rounded-xl border text-[14px] font-medium transition-all duration-200 p-4 min-h-[100px] resize-none",
                "placeholder:text-slate-500 placeholder:font-normal",
                "focus:outline-none focus:ring-[3px] focus:ring-offset-0",
                isDark
                    ? "bg-[#161b22] border-white/[0.08] text-white focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-white/[0.15]"
                    : "bg-white border-slate-200 text-slate-900 focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-slate-300 shadow-sm",
                className
            )}
            {...props}
        />
    );
});
TextArea.displayName = 'TextArea';

/**
 * 7. StickyFooter
 * Action bar at the bottom.
 */
interface StickyFooterProps extends FormKitProps {
    onCancel: () => void;
    isValid?: boolean;
    primaryAction: string;
    icon?: React.ReactNode;
}

export const StickyFooter: React.FC<StickyFooterProps> = ({ isDark, onCancel, isValid = true, primaryAction, icon }) => {
    return (
        <div className={cn(
            "h-[72px] px-6 md:px-12 flex items-center justify-end gap-3 flex-none border-t relative z-50 transition-all duration-300",
            isDark ? "bg-[#0d1117]/80 backdrop-blur-xl border-white/[0.06]" : "bg-white/80 backdrop-blur-xl border-slate-200"
        )}>
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-0 transition-opacity duration-500"
                style={{ opacity: isValid ? 1 : 0 }}
            />

            <button
                type="button"
                onClick={onCancel}
                className={cn(
                    "h-10 px-5 rounded-lg text-[13px] font-semibold tracking-wide transition-all duration-200",
                    isDark
                        ? "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                )}
            >
                Cancel
            </button>
            <button
                type="submit"
                disabled={!isValid}
                className={cn(
                    "h-10 pl-4 pr-5 rounded-lg text-[13px] font-bold tracking-wide shadow-lg flex items-center gap-2 transition-all duration-200 active:scale-95",
                    isValid
                        ? "bg-gradient-to-b from-emerald-400 to-emerald-500 text-white shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:brightness-105"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none dark:bg-slate-800 dark:text-slate-600"
                )}
            >
                {icon}
                {primaryAction}
            </button>
        </div>
    );
};

/**
 * 8. Drawer Components
 * Slide-over panel for premium UX.
 */
interface DrawerProps extends FormKitProps {
    isOpen: boolean;
    onClose: () => void;
    width?: string;
    onSubmit?: (e: React.FormEvent) => void;
    id?: string;
}

export const Drawer: React.FC<DrawerProps> = ({ isDark, isOpen, onClose, width = '480px', children, onSubmit, id }) => {
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div
                className={cn(
                    "relative h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300",
                    "w-full md:w-auto md:max-w-[90vw]",
                    isDark ? "bg-[#0d1117] text-slate-200" : "bg-white text-slate-900"
                )}
                style={{ width: width }}
            >
                {/* Background Texture */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
                />

                {onSubmit ? (
                    <form id={id} onSubmit={onSubmit} className="flex flex-col h-full relative z-10">
                        {children}
                    </form>
                ) : (
                    <div className="flex flex-col h-full relative z-10">{children}</div>
                )}
            </div>
        </div>
    );
};

interface DrawerHeaderProps extends FormKitProps {
    title: string;
    subtitle?: string;
    breadcrumb?: string;
    onClose: () => void;
}

export const DrawerHeader: React.FC<DrawerHeaderProps> = ({ isDark, title, subtitle, breadcrumb, onClose }) => {
    return (
        <div className={cn(
            "h-16 px-6 flex items-center justify-between flex-none border-b transition-colors",
            isDark ? "bg-[#0d1117]/80 backdrop-blur-sm border-white/[0.06]" : "bg-white/80 backdrop-blur-sm border-slate-200"
        )}>
            <div className="flex flex-col gap-0.5">
                {breadcrumb && (
                    <nav className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase text-slate-500">
                        <span className="opacity-70">CRM</span>
                        <span className="opacity-40">/</span>
                        <span className="opacity-70">{breadcrumb}</span>
                    </nav>
                )}
                <div className="flex items-center gap-2">
                    <h2 className={cn("text-base font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                        {title}
                    </h2>
                    {subtitle && (
                        <span className={cn("text-xs font-medium", isDark ? "text-slate-500" : "text-slate-400")}>
                            — {subtitle}
                        </span>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={onClose}
                className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 group",
                    isDark ? "bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                )}
            >
                <X size={14} className="group-hover:scale-110 transition-transform" />
            </button>
        </div>
    );
};

export const DrawerBody: React.FC<FormKitProps> = ({ children, className }) => {
    return (
        <div className={cn("flex-1 overflow-y-auto overflow-x-hidden", className)}>
            <div className="px-6 py-6 pb-32 flex flex-col gap-8">
                {children}
            </div>
        </div>
    );
};

interface DrawerFooterProps extends FormKitProps {
    onCancel: () => void;
    isValid?: boolean;
    primaryAction: string;
    icon?: React.ReactNode;
}

export const DrawerFooter: React.FC<DrawerFooterProps> = ({ isDark, onCancel, isValid = true, primaryAction, icon }) => {
    return (
        <div className={cn(
            "h-16 px-6 flex items-center justify-end gap-3 flex-none border-t relative z-50",
            isDark ? "bg-[#0d1117]/90 backdrop-blur-xl border-white/[0.06]" : "bg-white/90 backdrop-blur-xl border-slate-200"
        )}>
            <button
                type="button"
                onClick={onCancel}
                className={cn(
                    "h-9 px-4 rounded-lg text-[13px] font-semibold transition-all duration-200",
                    isDark
                        ? "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                )}
            >
                Cancel
            </button>
            <button
                type="submit"
                disabled={!isValid}
                className={cn(
                    "h-9 pl-3 pr-4 rounded-lg text-[13px] font-bold shadow-lg flex items-center gap-1.5 transition-all duration-200 active:scale-95",
                    isValid
                        ? "bg-gradient-to-b from-emerald-400 to-emerald-500 text-white shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:brightness-105"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none dark:bg-slate-800 dark:text-slate-600"
                )}
            >
                {icon}
                {primaryAction}
            </button>
        </div>
    );
};

/**
 * 9. CurrencyInput
 * Specialized input for currency values with formatting.
 */
interface CurrencyInputProps extends Omit<InputProps, 'type'> {
    currencySymbol?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(({ isDark, currencySymbol = '$', className, ...props }, ref) => {
    return (
        <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-[14px]">
                {currencySymbol}
            </div>
            <input
                ref={ref}
                type="text"
                inputMode="decimal"
                className={cn(
                    "w-full h-11 rounded-xl border text-[14px] font-medium transition-all duration-200 pl-8 pr-4",
                    "placeholder:text-slate-500 placeholder:font-normal",
                    "focus:outline-none focus:ring-[3px] focus:ring-offset-0",
                    "tabular-nums",
                    isDark
                        ? "bg-[#161b22] border-white/[0.08] text-white focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-white/[0.15]"
                        : "bg-white border-slate-200 text-slate-900 focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-slate-300 shadow-sm",
                    className
                )}
                {...props}
            />
        </div>
    );
});
CurrencyInput.displayName = 'CurrencyInput';

/**
 * MultiSelect Component
 * For selecting multiple items (e.g., stakeholders)
 */
interface MultiSelectProps extends FormKitProps {
    name: string;
    value: string[];
    onChange: (value: string[]) => void;
    options: Array<{ id: string; name: string; subtitle?: string }>;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
    isDark,
    name,
    value = [],
    onChange,
    options,
    placeholder = "Select...",
    disabled = false,
    label
}) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const handleToggle = (optionId: string) => {
        const newValue = value.includes(optionId)
            ? value.filter(id => id !== optionId)
            : [...value, optionId];
        onChange(newValue);
    };

    const selectedOptions = options.filter(opt => value.includes(opt.id));

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "w-full h-11 rounded-xl border text-[14px] font-medium transition-all duration-200 px-4",
                    "text-left flex items-center justify-between",
                    "focus:outline-none focus:ring-[3px] focus:ring-offset-0",
                    disabled && "opacity-50 cursor-not-allowed",
                    isDark
                        ? "bg-[#161b22] border-white/[0.08] text-white focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-white/[0.15]"
                        : "bg-white border-slate-200 text-slate-900 focus:border-emerald-500/50 focus:ring-emerald-500/10 hover:border-slate-300 shadow-sm"
                )}
            >
                <span className={cn(
                    value.length === 0 && "text-slate-500 font-normal"
                )}>
                    {value.length === 0
                        ? placeholder
                        : `${value.length} selected${selectedOptions.length > 0 ? `: ${selectedOptions.map(o => o.name).join(', ')}` : ''}`
                    }
                </span>
                <ChevronDown size={16} className={cn(
                    "transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {isOpen && !disabled && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className={cn(
                        "absolute z-50 mt-2 w-full max-h-64 overflow-auto rounded-xl border shadow-xl",
                        isDark
                            ? "bg-[#161b22] border-white/[0.08]"
                            : "bg-white border-slate-200"
                    )}>
                        {options.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                No options available
                            </div>
                        ) : (
                            options.map(option => (
                                <label
                                    key={option.id}
                                    className={cn(
                                        "flex items-center gap-3 p-3 cursor-pointer transition-colors",
                                        isDark
                                            ? "hover:bg-white/[0.04]"
                                            : "hover:bg-slate-50"
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={value.includes(option.id)}
                                        onChange={() => handleToggle(option.id)}
                                        className={cn(
                                            "w-4 h-4 rounded border-2 transition-all",
                                            "focus:ring-2 focus:ring-emerald-500/20",
                                            isDark
                                                ? "bg-[#0d1117] border-white/[0.15] checked:bg-emerald-500 checked:border-emerald-500"
                                                : "bg-white border-slate-300 checked:bg-emerald-500 checked:border-emerald-500"
                                        )}
                                    />
                                    <div className="flex-1">
                                        <div className={cn(
                                            "text-[14px] font-medium",
                                            isDark ? "text-slate-200" : "text-slate-900"
                                        )}>
                                            {option.name}
                                        </div>
                                        {option.subtitle && (
                                            <div className="text-[12px] text-slate-500">
                                                {option.subtitle}
                                            </div>
                                        )}
                                    </div>
                                </label>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
