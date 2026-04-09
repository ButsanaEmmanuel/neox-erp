import React from 'react';
import { useHRMStore } from '../../store/hrm/useHRMStore';
import { useAuth } from '../../contexts/AuthContext';

interface HRMLayoutProps {
    children: React.ReactNode;
}

const HRMLayout: React.FC<HRMLayoutProps> = ({ children }) => {
    const { hydrateFromDatabase, hydrated, isLoading, error, employees, setActiveEmployeeId, setCurrentRole } = useHRMStore();
    const { user } = useAuth();
    const hasStartedRef = React.useRef(false);

    React.useEffect(() => {
        if (!hydrated && !hasStartedRef.current) {
            hasStartedRef.current = true;
            hydrateFromDatabase().catch((err) => {
                console.error('Failed to hydrate HRM from DB', err);
            });
        }
    }, [hydrated, hydrateFromDatabase]);

    React.useEffect(() => {
        const roleCode = String(user?.role || '').toUpperCase();
        if (roleCode === 'ADMIN' || roleCode === 'HR_MANAGER') {
            setCurrentRole('hr');
        } else if (roleCode === 'PROJECT_MANAGER' || roleCode === 'SCM_MANAGER' || roleCode === 'FINANCE' || roleCode === 'SALES') {
            setCurrentRole('manager');
        } else {
            setCurrentRole('staff');
        }
    }, [user?.role, setCurrentRole]);

    React.useEffect(() => {
        if (!hydrated || !user || !employees.length) return;
        const byUserId = employees.find((e: any) => e.userId && e.userId === user.id);
        const byEmail = user.email
            ? employees.find((e: any) => (e.email || '').toLowerCase() === user.email.toLowerCase())
            : undefined;
        const match = byUserId || byEmail;
        if (match) setActiveEmployeeId(match.id);
    }, [hydrated, user, employees, setActiveEmployeeId]);

    return (
        <div className="h-full flex flex-col bg-app overflow-hidden">
            {/* Page content */}
            <div className="flex-1 overflow-hidden">
                {!hydrated || isLoading ? (
                    <div className="h-full w-full p-6">
                        <div className="animate-pulse space-y-4">
                            <div className="h-20 rounded-xl bg-card border border-border/40" />
                            <div className="h-12 rounded-xl bg-card border border-border/40" />
                            {Array.from({ length: 8 }).map((_, index) => (
                                <div key={index} className="h-14 rounded-lg bg-card border border-border/30" />
                            ))}
                        </div>
                        <p className="mt-4 text-xs text-muted">Chargement des donnees RH...</p>
                    </div>
                ) : error ? (
                    <div className="h-full w-full flex items-center justify-center p-6">
                        <div className="max-w-xl w-full rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-center">
                            <p className="text-sm text-rose-300 font-semibold">Impossible de charger les donnees RH.</p>
                            <p className="text-xs text-rose-200/90 mt-1">{error}</p>
                            <button
                                onClick={() => {
                                    hasStartedRef.current = false;
                                    hydrateFromDatabase().catch((err) => {
                                        console.error('HRM retry failed', err);
                                    });
                                }}
                                className="mt-3 px-4 py-2 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-100 text-xs font-semibold hover:bg-rose-500/30 transition-colors"
                            >
                                Reessayer
                            </button>
                        </div>
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
};

export default HRMLayout;




