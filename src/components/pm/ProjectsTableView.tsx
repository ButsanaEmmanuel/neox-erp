import React from 'react';
import { Project } from '../../types/pm';
import { format } from 'date-fns';
import StatusChip from '../ui/StatusChip';
import { Trash2 } from 'lucide-react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { useNavigate } from 'react-router-dom';

interface ProjectsTableViewProps {
    projects: Project[];
    sortConfig: { key: keyof Project | string; direction: 'asc' | 'desc' } | null;
    onSort: (key: keyof Project | string) => void;
    onNavigate: (view: string) => void;
    onDelete?: (id: string, name: string) => void;
}

const ProjectsTableView: React.FC<ProjectsTableViewProps> = ({ projects, sortConfig, onSort, onNavigate, onDelete }) => {
    const { setActiveProject } = useProjectStore();
    const navigate = useNavigate();

    const handleRowClick = (projectId: string) => {
        setActiveProject(projectId);
        navigate(`/projects/${projectId}/overview`);
    };

    const renderSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    };

    return (
        <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left text-sm text-muted">
                <thead className="bg-card text-xs uppercase font-semibold text-muted sticky top-0 z-10">
                    <tr>
                        <th
                            className="px-6 py-3 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => onSort('name')}
                        >
                            Project {renderSortIcon('name')}
                        </th>
                        <th
                            className="px-6 py-3 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => onSort('clientName')}
                        >
                            Client {renderSortIcon('clientName')}
                        </th>
                        <th
                            className="px-6 py-3 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => onSort('managerName')}
                        >
                            Manager {renderSortIcon('managerName')}
                        </th>
                        <th
                            className="px-6 py-3 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => onSort('status')}
                        >
                            Status {renderSortIcon('status')}
                        </th>
                        <th
                            className="px-6 py-3 cursor-pointer hover:text-primary transition-colors text-right"
                            onClick={() => onSort('kpis.progress')}
                        >
                            Progress {renderSortIcon('kpis.progress')}
                        </th>
                        <th
                            className="px-6 py-3 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => onSort('endDate')}
                        >
                            Due Date {renderSortIcon('endDate')}
                        </th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] bg-app">
                    {projects.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-muted italic">
                                No projects found matching your filters.
                            </td>
                        </tr>
                    ) : (
                        projects.map((project) => (
                            <tr
                                key={project.id}
                                onClick={() => handleRowClick(project.id)}
                                className="group hover:bg-surface transition-colors cursor-pointer"
                            >
                                <td className="px-6 py-4 font-medium text-primary">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400 border border-blue-500/10">
                                            {project.name.charAt(0)}
                                        </div>
                                        {project.name}
                                    </div>
                                </td>
                                <td className="px-6 py-4">{project.clientName || '—'}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {/* Avatar placeholder if needed */}
                                        {project.managerName || 'Unassigned'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <StatusChip status={project.status} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span className="text-xs font-mono">{project.kpis.progress}%</span>
                                        <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                style={{ width: `${project.kpis.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs">
                                    {project.endDate ? format(new Date(project.endDate), 'MMM d, yyyy') : '—'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete?.(project.id, project.name); }}
                                        className="p-1.5 text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete project"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default ProjectsTableView;




