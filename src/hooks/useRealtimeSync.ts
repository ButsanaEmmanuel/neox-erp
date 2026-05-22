import { useEffect, useRef } from 'react';
import { connectSse, type SseConnection } from '../lib/sseClient';
import { useProjectStore } from '../store/pm/useProjectStore';

/**
 * React hook that opens an SSE connection and reacts to PM mutation events
 * by refreshing the relevant slice of the Zustand project store.
 *
 * Routing strategy (per Sprint 6 audit baseline) :
 *   - project_* / work_item_* / project_scope_updated / project_import_completed
 *     → full reload via `loadProjectsForUser(userId)` (debounced 300ms)
 *   - milestone_*  → targeted `fetchProjectMilestones(projectId)`
 *   - project_member_*  → targeted `fetchProjectMembers(projectId)`
 *
 * Targeted refreshes avoid re-fetching the whole project tree when only a
 * narrow slice changed; full reload is used for slices that are bundled
 * inside `loadProjectsForUser` (workItems, scope, KPIs).
 */
export function useRealtimeSync(userId: string | undefined) {
  const loadProjectsForUser = useProjectStore((s) => s.loadProjectsForUser);
  const fetchProjectMilestones = useProjectStore((s) => s.fetchProjectMilestones);
  const fetchProjectMembers = useProjectStore((s) => s.fetchProjectMembers);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionRef = useRef<SseConnection | null>(null);

  useEffect(() => {
    if (!userId) return;

    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void loadProjectsForUser(userId);
      }, 300);
    };

    const refreshMilestones = (payload: Record<string, unknown>) => {
      const projectId = typeof payload?.projectId === 'string' ? payload.projectId : null;
      if (projectId) void fetchProjectMilestones(projectId);
    };

    const refreshMembers = (payload: Record<string, unknown>) => {
      const projectId = typeof payload?.projectId === 'string' ? payload.projectId : null;
      if (projectId) void fetchProjectMembers(projectId);
    };

    connectionRef.current = connectSse(userId, {
      // Project lifecycle → full reload
      project_created: scheduleRefresh,
      project_updated: scheduleRefresh,
      project_deleted: scheduleRefresh,
      // Work items → full reload (workItems are bundled into loadProjectsForUser payload)
      work_item_created: scheduleRefresh,
      work_item_updated: scheduleRefresh,
      work_item_deleted: scheduleRefresh,
      // Scope → full reload (scope embedded in Project payload)
      project_scope_updated: scheduleRefresh,
      // Bulk imports
      project_import_completed: scheduleRefresh,
      // Members → targeted refresh
      project_member_added: refreshMembers,
      project_member_removed: refreshMembers,
      // Milestones → targeted refresh
      milestone_created: refreshMilestones,
      milestone_updated: refreshMilestones,
      milestone_deleted: refreshMilestones,
    });

    return () => {
      connectionRef.current?.close();
      connectionRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, loadProjectsForUser, fetchProjectMilestones, fetchProjectMembers]);
}
