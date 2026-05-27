import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

// Fixed bottom-right banner that surfaces 2 min before the 15-min idle
// auto-logout. Any click on "Stay signed in" stamps activity via
// extendSession and dismisses the warning. The banner is intentionally
// non-blocking — typing in any field is also treated as activity by the
// AuthProvider listeners, so a user already working never sees this.
const IdleWarningBanner: React.FC = () => {
  const { idleWarning, extendSession, user } = useAuth();
  if (!user || !idleWarning) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur px-4 py-3 shadow-2xl">
      <p className="text-sm font-semibold text-amber-200">Session about to expire</p>
      <p className="mt-1 text-xs text-amber-100/80">
        You'll be signed out in under 2 minutes due to inactivity.
      </p>
      <button
        type="button"
        onClick={extendSession}
        className="mt-3 w-full rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-semibold px-3 py-2 transition-colors"
      >
        Stay signed in
      </button>
    </div>
  );
};

export default IdleWarningBanner;
