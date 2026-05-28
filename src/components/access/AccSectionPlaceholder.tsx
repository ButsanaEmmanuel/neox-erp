// Access Control Center — placeholder for non-Roles global sections.
//
// Reused for Users / Page Access / Action Permissions / Data Scope /
// Approval Workflows / Cross-Module Workflows / Field-Level Security /
// Audit Log until each one gets its own dedicated component in a
// later phase.

import React from 'react';
import { Info } from 'lucide-react';
import { ACC_SECTIONS, type AccSectionKey } from './acc.constants';

interface AccSectionPlaceholderProps {
  sectionKey: AccSectionKey;
}

const AccSectionPlaceholder: React.FC<AccSectionPlaceholderProps> = ({ sectionKey }) => {
  const meta = ACC_SECTIONS.find((s) => s.key === sectionKey);
  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto rounded-2xl border border-dashed border-border/60 bg-surface/30 p-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-surface/60 border border-border/60 flex items-center justify-center text-muted">
          <Info size={20} />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-primary">{meta?.label}</h3>
        <p className="mt-2 text-[12px] text-muted leading-relaxed">{meta?.description}</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] uppercase tracking-wider text-blue-300">
          Available in a later phase
        </div>
        <p className="mt-6 text-[10px] text-muted leading-relaxed max-w-md mx-auto">
          Phase 2 is the visual shell only. Editing flows arrive starting in phase 3.
          Storage, projection, and seeded defaults are already live (phase 1) — nothing
          here will need a fresh migration.
        </p>
      </div>
    </div>
  );
};

export default AccSectionPlaceholder;
