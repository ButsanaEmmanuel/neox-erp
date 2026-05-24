// DH1 — Sprint Dettes Techniques 2026-05-24.
// The 777-line monolithic HRM store has been split into 8 focused sub-stores
// living in src/store/hrm/. This file is now:
//   1. a barrel re-export of every sub-store hook + their types + DEPARTMENTS
//   2. a composite hook `useHRMStore()` that spreads all 8 stores into one
//      object, preserving the legacy API so existing consumers keep working
//      with zero code changes.
//
// Re-render behaviour: the composite hook re-renders on ANY change to ANY
// sub-store. That matches the prior single-store behaviour exactly — no
// regression. Components that want finer-grained subscriptions should
// migrate to a specific sub-store hook (e.g. `useLeaveStore`) at their
// leisure; this is purely opportunistic optimisation, not required.

export * from './useDirectoryStore';
export * from './useOnboardingStore';
export * from './useRecruitmentStore';
export * from './useTimesheetsStore';
export * from './useLeaveStore';
export * from './useTrainingStore';
export * from './usePoliciesStore';
export * from './useCasesStore';

import { useDirectoryStore } from './useDirectoryStore';
import { useOnboardingStore } from './useOnboardingStore';
import { useRecruitmentStore } from './useRecruitmentStore';
import { useTimesheetsStore } from './useTimesheetsStore';
import { useLeaveStore } from './useLeaveStore';
import { useTrainingStore } from './useTrainingStore';
import { usePoliciesStore } from './usePoliciesStore';
import { useCasesStore } from './useCasesStore';

export const useHRMStore = () => ({
    ...useDirectoryStore(),
    ...useOnboardingStore(),
    ...useRecruitmentStore(),
    ...useTimesheetsStore(),
    ...useLeaveStore(),
    ...useTrainingStore(),
    ...usePoliciesStore(),
    ...useCasesStore(),
});
