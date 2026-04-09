import React from 'react';
import { Project } from '../../types/pm';
import { format } from 'date-fns';
import StatusChip from '../ui/StatusChip';
import { Trash2, Calendar, CheckSquare } from 'lucide-react';
import { useProjectStore } from '../../store/pm/useProjectStore';

interface ProjectsListViewProps {
    projects: Project[];
    onNavigate: (view: string) => void;
    onDelete?: (id: string, name: string) => void;
}

const ProjectsListView: React.FC<ProjectsListViewProps> = ({ projects, onNavigate, onDelete }) => {
    const { setActiveProject } = useProjectStore();

    const handleRowClick = (projectId: string) => {
        setActiveProject(projectId);
        onNavigate('projects-overview');
    };

    if (projects.length === 0) {
        return (
            <div className="py-12 text-center text-muted italic border border-dashed border-border/60 rounded-lg">
                No projects found.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {projects.map((project) => (
                <div
                    key={project.id}
                    onClick={() => handleRowClick(project.id)}
                    className="group flex items-center justify-between p-3 bg-card border border-border/60 rounded-lg hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-900/5 transition-all cursor-pointer"
                >
                    {/* Left Block: Identity */}
                    <div className="flex items-center gap-4 min-w-[300px]">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center text-xs font-bold text-secondary border border-border/50">
                            {project.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-primary leading-tight group-hover:text-blue-400 transition-colors">
                                {project.name}
                            </h3>
                            <p className="text-xs text-muted mt-0.5">{project.clientName}</p>
                        </div>
                    </div>

                    {/* Middle Block: Manager & Timeline */}
                    <div className="flex items-center gap-8 flex-1">
                        <div className="flex items-center gap-2 min-w-[120px]">
                            {/* Avatar placeholder */}
                            <div className="w-5 h-5 rounded-full bg-border flex items-center justify-center text-[9px] text-secondary">
                                {project.managerName?.charAt(0) || '?'}
                            </div>
                            <span className="text-xs text-muted truncate max-w-[100px]">{project.managerName || 'Unassigned'}</span>
                        </div>

                        <div className="flex items-center gap-2 text-muted">
                            <Calendar size={14} />
                            <span className="text-xs font-mono">
                                {project.endDate ? format(new Date(project.endDate), 'MMM d') : 'No Date'}
                            </span>
                        </div>
                    </div>

                    {/* Right Block: Stats & Actions */}
                    <div className="flex items-center gap-6">
                        {/* Progress */}
                        <div className="flex items-center gap-2 w-24">
                            <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${project.kpis.progress}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono text-muted w-8 text-right">{project.kpis.progress}%</span>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 text-muted" title="Total Work Items">
                            <CheckSquare size={14} />
                            <span className="text-xs font-mono">{project.kpis.totalWorkItems}</span>
                        </div>

                        <StatusChip status={project.status} />

                        <div className="pl-2 border-l border-border/60">
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete?.(project.id, project.name); }}
                                className="p-1.5 text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete project"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProjectsListView;




