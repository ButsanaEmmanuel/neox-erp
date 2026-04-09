import React, { useState } from 'react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate, useLocation } from 'react-router-dom';

const ProjectSwitcher: React.FC = () => {
    const { projects, activeProjectId, setActiveProject } = useProjectStore();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const activeProject = projects.find(p => p.id === activeProjectId);

    const handleSelect = (id: string) => {
        setActiveProject(id);
        setIsOpen(false);
        
        // Preserve current sub-tab if possible
        const pathParts = location.pathname.split('/');
        const currentTab = pathParts[pathParts.length - 1];
        const validTabs = ['overview', 'scope', 'work-items', 'documents', 'imports'];
        const targetTab = validTabs.includes(currentTab) ? currentTab : 'overview';
        
        navigate(`/projects/${id}/${targetTab}`);
    };

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface transition-colors group"
            >
                <div className="w-6 h-6 rounded bg-brand/20 flex items-center justify-center text-brand text-[10px] font-bold">
                    {activeProject?.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-primary">{activeProject?.name}</span>
                <ChevronDown size={14} className={clsx("text-muted transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-input rounded-lg shadow-2xl py-2 z-50">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-muted uppercase tracking-widest">
                            Switch Project
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => handleSelect(project.id)}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
                                        project.id === activeProjectId 
                                            ? "bg-brand/10 text-brand" 
                                            : "text-secondary hover:bg-surface"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-2 h-2 rounded-full",
                                            project.status === 'active' ? "bg-emerald-500" :
                                            project.status === 'at-risk' ? "bg-amber-500" : "bg-muted"
                                        )} />
                                        <span>{project.name}</span>
                                    </div>
                                    {project.id === activeProjectId && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProjectSwitcher;




