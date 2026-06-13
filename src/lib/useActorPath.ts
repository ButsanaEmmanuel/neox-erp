import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Finance/PM backend routes run assertPermission against the ?userId= query
// param (parseActorFromUrl). A page that calls apiRequest with a bare path
// gets a silent 403 ("Permission denied") even for admins. This hook returns a
// `withActor(path)` that appends the current user's id so those calls resolve.
//
// Mirrors the inline helper used by budgetsApi/PayablesPage — centralised here
// so new finance pages don't reintroduce the missing-actor bug.
export function useActorPath(): (path: string) => string {
  const { user } = useAuth();
  return useCallback(
    (path: string) => {
      if (!user?.id) return path;
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}userId=${encodeURIComponent(user.id)}`;
    },
    [user?.id],
  );
}
