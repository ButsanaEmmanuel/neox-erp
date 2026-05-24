// HRM-2.6 — React hook that subscribes to the 8 HRM SSE events and
// dispatches them to a caller-supplied handler map. Thin wrapper over
// connectSse — the page decides what to do (refresh a list, push a
// toast, bump a notification badge).
//
// Mirrors hooks/useRealtimeSync.ts (PM) so the wiring stays uniform.

import { useEffect, useRef } from 'react';
import { connectSse, type SseConnection } from '../lib/sseClient';

export type HrmEventType =
  | 'hrm.leave.requested'
  | 'hrm.leave.approved'
  | 'hrm.leave.rejected'
  | 'hrm.employee.hired'
  | 'hrm.employee.offboarded'
  | 'hrm.onboarding.completed'
  | 'hrm.role.assigned'
  | 'hrm.case.escalated';

export type HrmEventHandlers = Partial<Record<HrmEventType, (payload: Record<string, unknown>) => void>>;

export function useHrmRealtimeSync(userId: string | undefined, handlers: HrmEventHandlers) {
  // Keep the latest handlers in a ref so the effect doesn't tear down
  // and re-open the SSE connection on every render of the caller.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connectionRef = useRef<SseConnection | null>(null);

  useEffect(() => {
    if (!userId) return;
    const wrapped: Record<string, (p: Record<string, unknown>) => void> = {};
    for (const key of [
      'hrm.leave.requested',
      'hrm.leave.approved',
      'hrm.leave.rejected',
      'hrm.employee.hired',
      'hrm.employee.offboarded',
      'hrm.onboarding.completed',
      'hrm.role.assigned',
      'hrm.case.escalated',
    ] as const) {
      wrapped[key] = (payload) => {
        const h = handlersRef.current[key];
        if (h) h(payload);
      };
    }
    connectionRef.current = connectSse(userId, wrapped);
    return () => {
      connectionRef.current?.close();
      connectionRef.current = null;
    };
  }, [userId]);
}
