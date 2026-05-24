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
import { PermissionKey, usePermissions } from '../../lib/rbac';

interface HRMRouterProps {
    activeView: string;
    onNavigate?: (view: string) => void;
}

const VIEW_READ_PERMISSION: Record<string, PermissionKey> = {
    'hrm-directory': 'hrm.directory.read',
    'hrm-org-chart': 'hrm.directory.read',
    'hrm-onboarding': 'hrm.onboarding.read',
    'hrm-offboarding': 'hrm.offboarding.read',
    'hrm-recruitment': 'hrm.recruitment.read',
    'hrm-cases': 'hrm.cases.read',
    'hrm-configuration': 'hrm.configuration.read',
    'hrm-timesheets': 'hrm.timesheets.read',
    'hrm-leave': 'hrm.leave.read',
    'hrm-training': 'hrm.training.read',
    'hrm-policies': 'hrm.policies.read',
};

const HRMRouter: React.FC<HRMRouterProps> = ({ activeView, onNavigate }) => {
    const { has } = usePermissions();
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
        const guardedPermission = VIEW_READ_PERMISSION[activeView];
        if (guardedPermission && activeView !== 'hrm-policies' && !has(guardedPermission)) {
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



