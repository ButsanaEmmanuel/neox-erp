import React, { useState, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Option {
    id: string;
    label: string;
    subLabel?: string;
    meta?: string;
    avatar?: string;
    avatarColor?: string;
}

interface ComboboxProps {
    options: Option[];
    value?: string; // ID
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    emptyMessage?: string;
    onCreate?: (query?: string) => void;
    createLabel?: string;
    renderOption?: (option: Option) => React.ReactNode;
}

const ComboboxSelect: React.FC<ComboboxProps> = ({
    options,
    value,
    onChange,
    label,
    placeholder = 'Select...',
    disabled,
    required,
    error,
    emptyMessage = 'No results found.',
    onCreate,
    createLabel = 'Create new',
    renderOption
}) => {
    const [query, setQuery] = useState('');

    const filteredOptions =
        query === ''
            ? options
            : options.filter((option) =>
                option.label.toLowerCase().includes(query.toLowerCase()) ||
                option.subLabel?.toLowerCase().includes(query.toLowerCase())
            );

    // Default option renderer
    const defaultRenderOption = (option: Option) => (
        <div className="flex items-center gap-2 w-full">
            {option.avatar ? (
                <img src={option.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : option.avatarColor ? (
                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${option.avatarColor} flex items-center justify-center text-[10px] font-bold text-white`}>
                    {option.label.charAt(0)}
                </div>
            ) : null}
            <div className="flex flex-col">
                <span className="block truncate text-sm">{option.label}</span>
                {option.subLabel && (
                    <span className="block truncate text-xs text-slate-500">{option.subLabel}</span>
                )}
            </div>
            {option.meta && (
                <span className="ml-auto text-xs text-slate-500">{option.meta}</span>
            )}
        </div>
    );

    return (
        <div className="w-full">
            {label && (
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    {label} {required && <span className="text-red-400">*</span>}
                </label>
            )}
            <Combobox value={value} onChange={(next: string | null) => onChange(next || '')} disabled={disabled}>
                <div className="relative mt-1">
                    <div className={cn(
                        "relative w-full cursor-default overflow-hidden rounded-lg border bg-[#0d1117] text-left sm:text-sm focus:outline-none",
                        error ? "border-red-500/50" : "border-white/[0.1] focus-within:border-blue-500/50"
                    )}>
                        <Combobox.Input
                            className="w-full border-none py-2.5 pl-3 pr-10 text-sm leading-5 text-white bg-transparent focus:ring-0 placeholder-slate-500"
                            displayValue={(id: string) => {
                                const opt = options.find(o => o.id === id);
                                return opt ? opt.label : '';
                            }}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                            placeholder={placeholder}
                        />
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronsUpDown
                                className="h-4 w-4 text-slate-500"
                                aria-hidden="true"
                            />
                        </Combobox.Button>
                    </div>
                    <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        afterLeave={() => setQuery('')}
                    >
                        <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-[#161b22] py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50 border border-white/[0.1]">
                            {filteredOptions.length === 0 && query !== '' ? (
                                <div className="relative cursor-default select-none py-2 px-4 text-slate-500 text-xs">
                                    {emptyMessage}
                                </div>
                            ) : (
                                filteredOptions.map((option) => (
                                    <Combobox.Option
                                        key={option.id}
                                        className={({ active }: { active: boolean }) =>
                                            `relative cursor-default select-none py-2 pl-3 pr-9 ${active ? 'bg-blue-600/20 text-white' : 'text-slate-300'
                                            }`
                                        }
                                        value={option.id}
                                    >
                                        {({ selected, active }: { selected: boolean; active: boolean }) => (
                                            <>
                                                {renderOption ? renderOption(option) : defaultRenderOption(option)}
                                                {selected ? (
                                                    <span
                                                        className={`absolute inset-y-0 right-0 flex items-center pr-4 ${active ? 'text-white' : 'text-blue-500'
                                                            }`}
                                                    >
                                                        <Check className="h-4 w-4" aria-hidden="true" />
                                                    </span>
                                                ) : null}
                                            </>
                                        )}
                                    </Combobox.Option>
                                ))
                            )}

                            {onCreate && (
                                <div className="px-2 pt-1 border-t border-white/[0.08] mt-1">
                                    <button
                                        onClick={(e) => { e.preventDefault(); onCreate(query); }}
                                        className="w-full text-left px-2 py-2 rounded-md text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 transition-colors text-xs font-medium"
                                    >
                                        + {createLabel}
                                    </button>
                                </div>
                            )}
                        </Combobox.Options>
                    </Transition>
                </div>
            </Combobox>
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
    );
};

export default ComboboxSelect;
