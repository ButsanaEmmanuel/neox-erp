import React, { Suspense } from 'react';
import HRMLayout from './HRMLayout';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import HRMDashboard from './dashboard/HRMDashboard';
import DirectoryPage from './directory/DirectoryPage';
import OnboardingPage from './onboarding/OnboardingPage';
import OffboardingPage from './offboarding/OffboardingPage';
import RecruitmentPage from './recruitment/RecruitmentPage';
import TimesheetsPage from './timesheets/TimesheetsPage';
import LeavePage from './leave/LeavePage';
import TrainingPage from './training/TrainingPage';
import PoliciesPage from './policies/PoliciesPage';
import CasesPage from './cases/CasesPage';
import HRMConfiguration from './config/HRMConfiguration';
import HRMOrgView from './HRMOrgView';
import { useHRMStore } from '../../store/hrm/useHRMStore';
import { can } from '../../lib/rbac';

interface HRMRouterProps {
    activeView: string;
    onNavigate?: (view: string) => void;
}

const HRMRouter: React.FC<HRMRouterProps> = ({ activeView, onNavigate }) => {
    const { currentRole } = useHRMStore();
    const canView = (resource: any) => can(currentRole, 'view', resource);
    // Pages that need onNavigate are rendered directly, the rest via a map
    const VIEW_MAP: Record<string, React.FC> = {
        'hrm-overview': HRMDashboard,
        'hrm-directory': DirectoryPage,
        'hrm-org-chart': HRMOrgView,
        'hrm-onboarding': OnboardingPage,
        'hrm-offboarding': OffboardingPage,
        'hrm-timesheets': TimesheetsPage,
        'hrm-leave': LeavePage,
        'hrm-training': TrainingPage,
        'hrm-policies': PoliciesPage,
        'hrm-cases': CasesPage,
        'hrm-configuration': HRMConfiguration,
    };

    const renderPage = () => {
        const protectedResourceByView: Record<string, any> = {
            'hrm-directory': 'directory',
            'hrm-org-chart': 'directory',
            'hrm-onboarding': 'onboarding',
            'hrm-offboarding': 'offboarding',
            'hrm-recruitment': 'recruitment',
            'hrm-cases': 'cases',
            'hrm-configuration': 'directory',
            'hrm-timesheets': 'timesheets',
            'hrm-leave': 'leave',
            'hrm-training': 'training',
            'hrm-policies': 'policies',
        };
        const guardedResource = protectedResourceByView[activeView];
        if (guardedResource && activeView !== 'hrm-policies' && !canView(guardedResource)) {
            return (
                <EmptyState
                    title="Access restricted"
                    description="Your role does not allow access to this HRM section."
                />
            );
        }

        // RecruitmentPage needs onNavigate prop
        if (activeView === 'hrm-recruitment') {
            return <RecruitmentPage onNavigate={onNavigate} />;
        }

        const PageComponent = VIEW_MAP[activeView];
        if (PageComponent) {
            return <PageComponent />;
        }

        return (
            <EmptyState
                title="Page not found"
                description="The HRM page you're looking for doesn't exist."
            />
        );
    };

    return (
        <HRMLayout>
            <Suspense fallback={<Skeleton rows={8} />}>
                {renderPage()}
            </Suspense>
        </HRMLayout>
    );
};

export default HRMRouter;



