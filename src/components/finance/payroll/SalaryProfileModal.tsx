// F2.6 — Salary profile create/edit modal. Used by PayrollDashboard;
// kept stateless (controlled inputs owned by parent) to keep
// optimistic-update + revert logic in one place.

import React from 'react';
import Modal from '../../ui/Modal';

interface Props {
  isOpen: boolean;
  editingProfileId: string | null;
  salaryUserId: string;
  salaryAmount: string;
  overtimeRate: string;
  busy: boolean;
  canWritePayroll: boolean;
  onChangeUserId: (v: string) => void;
  onChangeAmount: (v: string) => void;
  onChangeRate: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const SalaryProfileModal: React.FC<Props> = ({
  isOpen, editingProfileId, salaryUserId, salaryAmount, overtimeRate,
  busy, canWritePayroll,
  onChangeUserId, onChangeAmount, onChangeRate, onClose, onSubmit,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={editingProfileId ? 'Modifier le profil salarial' : 'Ajouter un profil salarial'}
    size="sm"
    footer={
      <>
        <button onClick={onClose} className="h-9 px-4 rounded-md border border-border text-secondary text-sm font-semibold hover:bg-surface">Annuler</button>
        <button
          disabled={busy || !salaryUserId || !salaryAmount || !canWritePayroll}
          onClick={onSubmit}
          className="h-9 px-4 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Saving…' : editingProfileId ? 'Update' : 'Create'}
        </button>
      </>
    }
  >
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs text-secondary">Employee User ID</label>
        <input
          value={salaryUserId}
          onChange={(e) => onChangeUserId(e.target.value)}
          placeholder="usr_..."
          disabled={!!editingProfileId}
          className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary disabled:opacity-60"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-secondary">Monthly salary</label>
          <input
            type="number"
            step="0.01"
            value={salaryAmount}
            onChange={(e) => onChangeAmount(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-secondary">Overtime multiplier</label>
          <input
            type="number"
            step="0.01"
            value={overtimeRate}
            onChange={(e) => onChangeRate(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary"
          />
        </div>
      </div>
      {!canWritePayroll && <p className="text-xs text-rose-400">Permission requise : hrm.payroll.write</p>}
    </div>
  </Modal>
);

export default SalaryProfileModal;
