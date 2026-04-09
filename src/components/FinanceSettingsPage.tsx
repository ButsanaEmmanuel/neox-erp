import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/apiClient';

interface FinanceSettingsPayload {
  categories: Array<{ id: string; code: string; name: string; direction: string; isActive: boolean }>;
  evidenceRules: Array<{ id: string; code: string; transactionType: string; requiredDocsJson: unknown; minCount: number; isActive: boolean }>;
  approvalThresholds: Array<{ id: string; code: string; transactionType: string; minAmount: string | number; maxAmount?: string | number | null; requiredRole: string; isActive: boolean }>;
  numberingSchemes: Array<{ id: string; code: string; targetType: string; prefix: string; nextNumber: number; padding: number; isActive: boolean }>;
  paymentMethods: Array<{ id: string; code: string; label: string; direction: string; requiresProof: boolean; isActive: boolean }>;
  ledgerMappings: Array<{ id: string; code: string; sourceModule: string; sourceEntity: string; direction: string; accountCode: string; categoryCode: string; isActive: boolean }>;
}

const emptySettings: FinanceSettingsPayload = {
  categories: [],
  evidenceRules: [],
  approvalThresholds: [],
  numberingSchemes: [],
  paymentMethods: [],
  ledgerMappings: [],
};

const FinanceSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<FinanceSettingsPayload>(emptySettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const [categoryName, setCategoryName] = useState('Project Receivables');
  const [categoryDirection, setCategoryDirection] = useState('inflow');

  const [evidenceType, setEvidenceType] = useState('payable');
  const [evidenceDocs, setEvidenceDocs] = useState('po,supplier_invoice,grn');

  const [thresholdType, setThresholdType] = useState('payable');
  const [thresholdMin, setThresholdMin] = useState('0');
  const [thresholdRole, setThresholdRole] = useState('FINANCE_APPROVER');

  const [numberingTarget, setNumberingTarget] = useState('invoice');
  const [numberingPrefix, setNumberingPrefix] = useState('INV');

  const [paymentMethodLabel, setPaymentMethodLabel] = useState('Bank Transfer');
  const [paymentDirection, setPaymentDirection] = useState('both');

  const [ledgerModule, setLedgerModule] = useState('projects');
  const [ledgerEntity, setLedgerEntity] = useState('project_item_state');
  const [ledgerDirection, setLedgerDirection] = useState('inflow');
  const [ledgerAccount, setLedgerAccount] = useState('acc_project_receivables');
  const [ledgerCategory, setLedgerCategory] = useState('cat_project_receivables');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ settings: FinanceSettingsPayload }>('/api/v1/finance/settings');
      setSettings(data.settings || emptySettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveCategory = async () => {
    setSaving(true);
    setStatus('');
    try {
      await apiRequest('/api/v1/finance/settings/categories', {
        method: 'POST',
        body: {
          name: categoryName,
          direction: categoryDirection,
        },
      });
      setStatus('Category saved.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveEvidenceRule = async () => {
    setSaving(true);
    setStatus('');
    try {
      await apiRequest('/api/v1/finance/settings/evidence-rules', {
        method: 'POST',
        body: {
          transactionType: evidenceType,
          requiredDocs: evidenceDocs.split(',').map((d) => d.trim()).filter(Boolean),
          minCount: 1,
        },
      });
      setStatus('Evidence rule saved.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveThreshold = async () => {
    setSaving(true);
    setStatus('');
    try {
      await apiRequest('/api/v1/finance/settings/approval-thresholds', {
        method: 'POST',
        body: {
          transactionType: thresholdType,
          minAmount: Number(thresholdMin || 0),
          requiredRole: thresholdRole,
        },
      });
      setStatus('Approval threshold saved.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveNumbering = async () => {
    setSaving(true);
    setStatus('');
    try {
      await apiRequest('/api/v1/finance/settings/numbering-schemes', {
        method: 'POST',
        body: {
          targetType: numberingTarget,
          prefix: numberingPrefix,
          nextNumber: 1,
          padding: 5,
        },
      });
      setStatus('Numbering scheme saved.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const savePaymentMethod = async () => {
    setSaving(true);
    setStatus('');
    try {
      await apiRequest('/api/v1/finance/settings/payment-methods', {
        method: 'POST',
        body: {
          label: paymentMethodLabel,
          direction: paymentDirection,
          requiresProof: true,
        },
      });
      setStatus('Payment method saved.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveLedgerMapping = async () => {
    setSaving(true);
    setStatus('');
    try {
      await apiRequest('/api/v1/finance/settings/ledger-mappings', {
        method: 'POST',
        body: {
          sourceModule: ledgerModule,
          sourceEntity: ledgerEntity,
          direction: ledgerDirection,
          accountCode: ledgerAccount,
          categoryCode: ledgerCategory,
        },
      });
      setStatus('Ledger mapping saved.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const rolloutGovernance = async () => {
    setSaving(true);
    setStatus('');
    try {
      await apiRequest('/api/v1/finance/governance/rollout', { method: 'POST', body: {} });
      setStatus('Finance permissions and workflow transitions rolled out.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary">Finance Settings & Governance</h3>
          <p className="text-xs text-secondary mt-1">Configure categories, evidence rules, thresholds, numbering, payment methods, ledger mappings, and workflow rollout.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="h-9 px-3 rounded-md border border-input text-primary text-xs flex items-center gap-2 hover:bg-surface" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => void rolloutGovernance()} className="h-9 px-3 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-xs flex items-center gap-2 hover:bg-emerald-500/20" disabled={saving}>
            <ShieldCheck size={14} /> Rollout Permissions
          </button>
        </div>
      </div>

      {status && <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{status}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-sm font-semibold text-primary mb-3">Finance Categories</h4>
          <div className="flex gap-2">
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="flex-1 h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Category name" />
            <select value={categoryDirection} onChange={(e) => setCategoryDirection(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary">
              <option value="inflow">Inflow</option>
              <option value="outflow">Outflow</option>
            </select>
            <button onClick={() => void saveCategory()} className="h-9 px-3 rounded-md bg-blue-600 text-white text-xs">Save</button>
          </div>
          <div className="mt-3 text-xs text-secondary">{settings.categories.length} configured</div>
        </section>

        <section className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-sm font-semibold text-primary mb-3">Evidence Rule Matrix</h4>
          <div className="flex flex-col gap-2">
            <input value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Transaction type" />
            <input value={evidenceDocs} onChange={(e) => setEvidenceDocs(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="doc_a,doc_b" />
            <button onClick={() => void saveEvidenceRule()} className="h-9 px-3 rounded-md bg-blue-600 text-white text-xs">Save</button>
          </div>
          <div className="mt-3 text-xs text-secondary">{settings.evidenceRules.length} rules configured</div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-sm font-semibold text-primary mb-3">Approval Thresholds</h4>
          <div className="grid grid-cols-3 gap-2">
            <input value={thresholdType} onChange={(e) => setThresholdType(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Type" />
            <input value={thresholdMin} onChange={(e) => setThresholdMin(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Min amount" />
            <input value={thresholdRole} onChange={(e) => setThresholdRole(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Required role" />
          </div>
          <button onClick={() => void saveThreshold()} className="mt-2 h-9 px-3 rounded-md bg-blue-600 text-white text-xs">Save</button>
          <div className="mt-3 text-xs text-secondary">{settings.approvalThresholds.length} thresholds configured</div>
        </section>

        <section className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-sm font-semibold text-primary mb-3">Numbering Schemes</h4>
          <div className="grid grid-cols-2 gap-2">
            <input value={numberingTarget} onChange={(e) => setNumberingTarget(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Target type" />
            <input value={numberingPrefix} onChange={(e) => setNumberingPrefix(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Prefix" />
          </div>
          <button onClick={() => void saveNumbering()} className="mt-2 h-9 px-3 rounded-md bg-blue-600 text-white text-xs">Save</button>
          <div className="mt-3 text-xs text-secondary">{settings.numberingSchemes.length} schemes configured</div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-sm font-semibold text-primary mb-3">Payment Methods</h4>
          <div className="grid grid-cols-2 gap-2">
            <input value={paymentMethodLabel} onChange={(e) => setPaymentMethodLabel(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Label" />
            <input value={paymentDirection} onChange={(e) => setPaymentDirection(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Direction" />
          </div>
          <button onClick={() => void savePaymentMethod()} className="mt-2 h-9 px-3 rounded-md bg-blue-600 text-white text-xs">Save</button>
          <div className="mt-3 text-xs text-secondary">{settings.paymentMethods.length} methods configured</div>
        </section>

        <section className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-sm font-semibold text-primary mb-3">Ledger Mappings</h4>
          <div className="grid grid-cols-2 gap-2">
            <input value={ledgerModule} onChange={(e) => setLedgerModule(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Source module" />
            <input value={ledgerEntity} onChange={(e) => setLedgerEntity(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Source entity" />
            <input value={ledgerDirection} onChange={(e) => setLedgerDirection(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Direction" />
            <input value={ledgerAccount} onChange={(e) => setLedgerAccount(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary" placeholder="Account code" />
            <input value={ledgerCategory} onChange={(e) => setLedgerCategory(e.target.value)} className="h-9 px-3 rounded-md bg-surface border border-input text-sm text-primary col-span-2" placeholder="Category code" />
          </div>
          <button onClick={() => void saveLedgerMapping()} className="mt-2 h-9 px-3 rounded-md bg-blue-600 text-white text-xs">Save</button>
          <div className="mt-3 text-xs text-secondary">{settings.ledgerMappings.length} mappings configured</div>
        </section>
      </div>
    </div>
  );
};

export default FinanceSettingsPage;


