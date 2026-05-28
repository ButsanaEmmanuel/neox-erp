// Access Control Center — left-side global section nav.
//
// Nine sections. Active = role-centred home. All other sections render
// a clean read-only placeholder explaining what phase 3+ will bring.

import React from 'react';
import { ACC_SECTIONS, type AccSectionKey } from './acc.constants';
import {
  Shield, Users, LayoutGrid, ListChecks, MapPin, Workflow,
  Network, EyeOff, History,
} from 'lucide-react';

const ICONS: Record<AccSectionKey, React.ReactNode> = {
  'roles':                  <Shield size={14} />,
  'users':                  <Users size={14} />,
  'page-access':            <LayoutGrid size={14} />,
  'action-permissions':     <ListChecks size={14} />,
  'data-scope':             <MapPin size={14} />,
  'approval-workflows':     <Workflow size={14} />,
  'cross-module-workflows': <Network size={14} />,
  'field-level-security':   <EyeOff size={14} />,
  'audit-log':              <History size={14} />,
};

interface AccLeftNavProps {
  active: AccSectionKey;
  onSelect: (key: AccSectionKey) => void;
}

const AccLeftNav: React.FC<AccLeftNavProps> = ({ active, onSelect }) => {
  return (
    <aside className="w-56 shrink-0 border-r border-border/60 bg-surface/30">
      <nav className="p-2 space-y-0.5">
        {ACC_SECTIONS.map((s) => {
          const isActive = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(s.key)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                isActive
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                  : 'text-secondary hover:text-primary hover:bg-surface border border-transparent'
              }`}
              title={s.description}
            >
              <span className={isActive ? 'text-blue-300' : 'text-muted'}>{ICONS[s.key]}</span>
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default AccLeftNav;
