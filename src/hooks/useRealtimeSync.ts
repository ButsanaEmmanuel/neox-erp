import { useEffect, useRef } from 'react';
import { connectSse, type SseConnection } from '../lib/sseClient';
import { useProjectStore } from '../store/pm/useProjectStore';

/**
 * React hook that opens an SSE connection and refreshes the Zustand
 * project store whenever a `work_item_updated` or `project_import_completed`
 * event is received.
 *
 * Debounces rapid-fire events (e.g. bulk save) into a single `loadProjectsForUser`
 * call with a 300ms window.
 */
export function useRealtimeSync(userId: string | undefined) {
  const loadProjectsForUser = useProjectStore((s) => s.loadProjectsForUser);
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

    connectionRef.current = connectSse(userId, {
      work_item_updated: scheduleRefresh,
      project_import_completed: scheduleRefresh,
    });

    return () => {
      connectionRef.current?.close();
      connectionRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, loadProjectsForUser]);
}
