import React from 'react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { Target, CheckSquare, XCircle, AlertTriangle } from 'lucide-react';
import { ScopeBaseItem } from '../../types/pm';
import ProfessionalEmptyState from '../ui/ProfessionalEmptyState';

const ScopeSection: React.FC<{
    title: string;
    icon: React.ElementType;
    items: ScopeBaseItem[];
    color: string;
    renderItem?: (item: any) => React.ReactNode;
    onAdd?: () => void;
    isCreating?: boolean;
    newItemText?: string;
    setNewItemText?: (text: string) => void;
    onSave?: () => void;
    onCancel?: () => void;
}> = ({ title, icon: Icon, items, color, renderItem, onAdd, isCreating, newItemText, setNewItemText, onSave, onCancel }) => (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden flex flex-col h-full">
        <div className={`px-6 py-4 border-b border-border/60 flex items-center justify-between ${color} bg-surface`}>
            <div className="flex items-center gap-3">
                <Icon size={18} />
                <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
            </div>
            <span className="text-xs font-mono opacity-50">{items.length} items</span>
        </div>
        <div className="p-6 flex-1">
            {items.length > 0 || isCreating ? (
                <ul className="space-y-3">
                    {items.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 text-sm text-secondary group">
                            <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
                            <div className="flex-1">
                                <span className="leading-relaxed block">{item.text}</span>
                                {renderItem && renderItem(item)}
                            </div>
                        </li>
                    ))}
                    {isCreating && (
                        <li className="flex items-start gap-3 text-sm animate-in fade-in duration-200">
                            <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
                            <div className="flex-1">
                                <input
                                    autoFocus
                                    type="text"
                                    value={newItemText}
                                    onChange={(e) => setNewItemText?.(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') onSave?.();
                                        if (e.key === 'Escape') onCancel?.();
                                    }}
                                    onBlur={() => {
                                        if (newItemText?.trim()) onSave?.();
                                        else onCancel?.();
                                    }}
                                    className="w-full bg-transparent border-none p-0 text-primary placeholder:text-muted focus:ring-0 focus:outline-none leading-relaxed"
                                    placeholder={`Type a new ${title.slice(0, -1).toLowerCase()}...`}
                                />
                            </div>
                        </li>
                    )}
                </ul>
            ) : (
                <div className="h-full flex flex-col items-center justify-center min-h-[100px] text-muted italic text-sm border-2 border-dashed border-border/50 rounded-lg">
                    <p>No items defined.</p>
                </div>
            )}
        </div>
        {/* Add Action */}
        {!isCreating && onAdd && (
            <div className="p-4 border-t border-border/60 bg-surface">
                <button
                    onClick={onAdd}
                    className="text-xs font-medium text-muted hover:text-primary flex items-center gap-2 transition-colors w-full text-left"
                >
                    <span className="text-lg leading-none">+</span> Add {title.slice(0, -1)}
                </button>
            </div>
        )}
    </div>
);

const ProjectScope: React.FC = () => {
    const { projects, activeProjectId, addScopeItem, updateProject } = useProjectStore();
    const project = projects.find(p => p.id === activeProjectId);

    const [creatingType, setCreatingType] = React.useState<'objectives' | 'deliverables' | 'outOfScope' | 'assumptions' | null>(null);
    const [newItemText, setNewItemText] = React.useState('');

    if (!project) return (
        <div className="h-full flex items-center justify-center p-8">
            <ProfessionalEmptyState
                icon={Target}
                title="Select a Project"
                description="Please select a project from the list to view its scope and boundaries."
                action={{
                    label: "Go to Projects",
                    onClick: () => window.location.href = '/projects'
                }}
            />
        </div>
    );

    const ensureScopeInitialized = () => {
        if (!project) return;
        if (project.scope) return;
        updateProject(project.id, {
            scope: {
                objectives: [],
                deliverables: [],
                outOfScope: [],
                assumptions: [],
            },
        });
    };

    const scope = project.scope || {
        objectives: [],
        deliverables: [],
        outOfScope: [],
        assumptions: [],
    };
    const isScopeEmpty = !project.scope;

    const handleCreate = (type: 'objectives' | 'deliverables' | 'outOfScope' | 'assumptions') => {
        setCreatingType(type);
        setNewItemText('');
    };

    const handleSaveCreate = () => {
        if (!creatingType || !newItemText.trim() || !project) return;
        addScopeItem(project.id, creatingType, newItemText.trim());
        setCreatingType(null);
        setNewItemText('');
    };

    const handleCancelCreate = () => {
        setCreatingType(null);
        setNewItemText('');
    };

    return (
        <div className="h-full overflow-y-auto p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-primary tracking-tight mb-2">Project Scope</h2>
                    <p className="text-muted">Defined boundaries and deliverables for {project.name}.</p>
                </div>

                {isScopeEmpty && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-3">
                        <div className="text-sm text-amber-200">
                            Scope not initialized yet. Initialize it to start creating objectives, deliverables, assumptions and out-of-scope items.
                        </div>
                        <button
                            type="button"
                            onClick={ensureScopeInitialized}
                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
                        >
                            Initialize Scope
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ScopeSection
                        title="Objectives"
                        icon={Target}
                        items={scope.objectives}
                        color="text-emerald-400"
                        onAdd={() => handleCreate('objectives')}
                        isCreating={creatingType === 'objectives'}
                        newItemText={newItemText}
                        setNewItemText={setNewItemText}
                        onSave={handleSaveCreate}
                        onCancel={handleCancelCreate}
                    />
                    <ScopeSection
                        title="Deliverables"
                        icon={CheckSquare}
                        items={scope.deliverables}
                        color="text-blue-400"
                        onAdd={() => handleCreate('deliverables')}
                        isCreating={creatingType === 'deliverables'}
                        newItemText={newItemText}
                        setNewItemText={setNewItemText}
                        onSave={handleSaveCreate}
                        onCancel={handleCancelCreate}
                    />
                    <ScopeSection
                        title="Out of Scope"
                        icon={XCircle}
                        items={scope.outOfScope}
                        color="text-rose-400"
                        onAdd={() => handleCreate('outOfScope')}
                        isCreating={creatingType === 'outOfScope'}
                        newItemText={newItemText}
                        setNewItemText={setNewItemText}
                        onSave={handleSaveCreate}
                        onCancel={handleCancelCreate}
                    />
                    <ScopeSection
                        title="Assumptions"
                        icon={AlertTriangle}
                        items={scope.assumptions}
                        color="text-amber-400"
                        onAdd={() => handleCreate('assumptions')}
                        isCreating={creatingType === 'assumptions'}
                        newItemText={newItemText}
                        setNewItemText={setNewItemText}
                        onSave={handleSaveCreate}
                        onCancel={handleCancelCreate}
                    />
                </div>
            </div>
        </div>
    );
};

export default ProjectScope;




