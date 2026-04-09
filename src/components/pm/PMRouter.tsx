import React from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

import ProjectOverview from './ProjectOverview';
import ProjectScope from './ProjectScope';
import ProjectDocuments from './ProjectDocuments';
import WorkItemsPage from './WorkItemsPage';
import ImportWizard from './ImportWizard';
import ProjectsIndex from './ProjectsIndex';
import ProjectSwitcher from './ProjectSwitcher';

interface PMRouterProps {
    onNavigate: (view: string) => void;
}

const PMRouter: React.FC<PMRouterProps> = () => {
    return (
        <Routes>
            <Route path="/projects" element={<ProjectsIndex />} />
            <Route path="/projects/:id/*" element={<ProjectWorkspace />} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
    );
};

const ProjectWorkspace: React.FC = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const { setActiveProject, projects, projectsLoading, projectsLoaded, loadProjectsForUser } = useProjectStore();

    // ── SSE real-time sync (replaces polling) ──
    useRealtimeSync(user?.id);

    React.useEffect(() => {
        if (user?.id) {
            void loadProjectsForUser(user.id);
        }
    }, [user?.id, loadProjectsForUser]);

    // Fallback listeners: visibility, focus, storage (no polling interval)
    React.useEffect(() => {
        if (!user?.id) return;
        const refresh = () => void loadProjectsForUser(user.id);
        const onFocus = () => refresh();
        const onVisibility = () => {
            if (document.visibilityState === 'visible') refresh();
        };
        const onStorage = (event: StorageEvent) => {
            if (event.key === 'neox.global.projects.refreshAt') {
                refresh();
            }
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('storage', onStorage);
        };
    }, [user?.id, loadProjectsForUser]);
    
    // Sync store with URL
    React.useEffect(() => {
        if (id) {
            const projectExists = projects.some(p => p.id === id);
            if (projectExists) {
                setActiveProject(id);
            }
        }
    }, [id, setActiveProject, projects]);

    if (projectsLoading && !projectsLoaded) {
        return <div className="h-full flex items-center justify-center text-sm text-muted">Loading projects...</div>;
    }

    if (!id || !projects.some(p => p.id === id)) {
        return <Navigate to="/projects" replace />;
    }

    return (
        <div className="h-full flex flex-col bg-app overflow-hidden">
            <div className="h-14 border-b border-border/60 flex items-center px-4 bg-card/70 backdrop-blur-sm z-40">
                <ProjectSwitcher />
                <div className="h-4 w-[1px] bg-border mx-4" />
                <Routes>
                    <Route path="overview" element={<span className="text-sm font-medium text-muted">Overview</span>} />
                    <Route path="scope" element={<span className="text-sm font-medium text-muted">Project Scope</span>} />
                    <Route path="work-items" element={<span className="text-sm font-medium text-muted">Work Items</span>} />
                    <Route path="documents" element={<span className="text-sm font-medium text-muted">Documents</span>} />
                    <Route path="imports" element={<span className="text-sm font-medium text-muted">Data Imports</span>} />
                </Routes>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-hidden"
            >
                <Routes>
                    <Route path="overview" element={<ProjectOverview />} />
                    <Route path="scope" element={<ProjectScope />} />
                    <Route path="work-items" element={<WorkItemsPage />} />
                    <Route path="documents" element={<ProjectDocuments />} />
                    <Route path="imports" element={<ImportWizard />} />
                    <Route path="/" element={<Navigate to="overview" replace />} />
                </Routes>
            </motion.div>
        </div>
    );
};

export default PMRouter;




