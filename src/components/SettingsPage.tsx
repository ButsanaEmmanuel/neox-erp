import React, { useEffect, useMemo, useState } from 'react';
import { Shield, User, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

type SettingsTab = 'profile' | 'preferences' | 'security';

const SettingsPage: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { user, updateProfile, completePasswordChange } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [notifyCrm, setNotifyCrm] = useState(true);
  const [notifyProjects, setNotifyProjects] = useState(true);
  const [notifyFinance, setNotifyFinance] = useState(true);
  const [quickStatus, setQuickStatus] = useState<'online' | 'in_meeting' | 'on_leave'>('online');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setJobTitle(user.jobTitle || '');
    setPhone(user.phoneNumber || '');
    setLanguage((user.preferredLanguage || 'fr') === 'en' ? 'en' : 'fr');
    setNotifyCrm(user.notifyCrm ?? true);
    setNotifyProjects(user.notifyProjects ?? true);
    setNotifyFinance(user.notifyFinance ?? true);
    setQuickStatus(user.quickStatus || 'online');
  }, [user]);

  const tabButtonClass = (current: SettingsTab) =>
    cn(
      'px-3 py-2 rounded-md text-sm font-medium border transition-colors flex items-center gap-2',
      tab === current
        ? 'bg-neox-emerald/15 border-neox-emerald/40 text-neox-emerald'
        : isDark
          ? 'bg-[#0d1117] border-[#2d3748] text-slate-300 hover:bg-[#1e2d3d]'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
    );

  const cardClass = useMemo(
    () =>
      cn(
        'rounded-xl border p-5',
        isDark ? 'bg-[#111822] border-[#2d3748]' : 'bg-white border-slate-200 shadow-sm',
      ),
    [isDark],
  );

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateProfile({
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        phoneNumber: phone.trim(),
      });
      setMessage('Profil enregistre en base de donnees.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateProfile({
        preferredLanguage: language,
        notifyCrm,
        notifyProjects,
        notifyFinance,
        quickStatus,
      });
      setMessage('Preferences enregistrees. Elles seront reappliquees a la prochaine connexion.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d enregistrer les preferences.');
    } finally {
      setSaving(false);
    }
  };

  const saveSecurity = async () => {
    if (!currentPassword || !newPassword) {
      setError('Veuillez renseigner le mot de passe actuel et le nouveau mot de passe.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await completePasswordChange(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Mot de passe mis a jour.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de mise a jour du mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h2 className={cn('text-xl font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>Parametres</h2>
        <p className={cn('text-sm mt-1', isDark ? 'text-slate-400' : 'text-slate-600')}>
          Gere votre profil, vos preferences et votre securite.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('profile')} className={tabButtonClass('profile')}><User size={14} /> Profil</button>
        <button onClick={() => setTab('preferences')} className={tabButtonClass('preferences')}><SlidersHorizontal size={14} /> Preferences</button>
        <button onClick={() => setTab('security')} className={tabButtonClass('security')}><Shield size={14} /> Securite</button>
      </div>

      {tab === 'profile' && (
        <div className={cardClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nom complet" isDark={isDark}>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass(isDark)} />
            </Field>
            <Field label="Email" isDark={isDark}>
              <input value={user?.email || ''} disabled className={cn(inputClass(isDark), 'opacity-70 cursor-not-allowed')} />
            </Field>
            <Field label="Titre professionnel" isDark={isDark}>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inputClass(isDark)} placeholder="Project Manager" />
            </Field>
            <Field label="Telephone" isDark={isDark}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass(isDark)} />
            </Field>
          </div>
          <div className="mt-4">
            <button disabled={saving} onClick={() => void saveProfile()} className={primaryBtnClass}>
              {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
            </button>
          </div>
        </div>
      )}

      {tab === 'preferences' && (
        <div className={cardClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Langue de l interface" isDark={isDark}>
              <select value={language} onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'fr')} className={inputClass(isDark)}>
                <option value="fr">Francais</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label="Statut rapide" isDark={isDark}>
              <select value={quickStatus} onChange={(e) => setQuickStatus((e.target.value as 'online' | 'in_meeting' | 'on_leave') || 'online')} className={inputClass(isDark)}>
                <option value="online">En ligne</option>
                <option value="in_meeting">En reunion</option>
                <option value="on_leave">En conge</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 space-y-2">
            <ToggleRow label="Notifications CRM" checked={notifyCrm} onChange={setNotifyCrm} />
            <ToggleRow label="Notifications Projets" checked={notifyProjects} onChange={setNotifyProjects} />
            <ToggleRow label="Notifications Finance" checked={notifyFinance} onChange={setNotifyFinance} />
          </div>

          <div className="mt-4">
            <button disabled={saving} onClick={() => void savePreferences()} className={primaryBtnClass}>
              {saving ? 'Enregistrement...' : 'Enregistrer les preferences'}
            </button>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className={cardClass}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Mot de passe actuel" isDark={isDark}>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass(isDark)} />
            </Field>
            <Field label="Nouveau mot de passe" isDark={isDark}>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass(isDark)} />
            </Field>
            <Field label="Confirmer" isDark={isDark}>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass(isDark)} />
            </Field>
          </div>
          <div className="mt-4">
            <button disabled={saving} onClick={() => void saveSecurity()} className={primaryBtnClass}>
              {saving ? 'Mise a jour...' : 'Changer le mot de passe'}
            </button>
          </div>
        </div>
      )}

      {(message || error) && (
        <div className={cn(
          'rounded-lg border px-4 py-3 text-sm',
          error
            ? 'border-red-500/40 bg-red-500/10 text-red-300'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        )}>
          {error || message}
        </div>
      )}
    </div>
  );
};

const primaryBtnClass = 'h-10 px-4 rounded-md bg-neox-emerald text-black text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-60';

const inputClass = (isDark: boolean) =>
  cn(
    'w-full h-10 px-3 rounded-md border outline-none text-sm',
    isDark
      ? 'bg-[#0d1117] border-[#2d3748] text-slate-100 focus:border-neox-emerald'
      : 'bg-white border-slate-300 text-slate-900 focus:border-neox-emerald',
  );

const Field: React.FC<{ label: string; isDark: boolean; children: React.ReactNode }> = ({ label, isDark, children }) => (
  <div>
    <label className={cn('block text-xs mb-1 font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>{label}</label>
    {children}
  </div>
);

const ToggleRow: React.FC<{ label: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3">
    <span className="text-sm text-slate-300">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-full border transition-colors',
        checked ? 'bg-neox-emerald/80 border-neox-emerald/80' : 'bg-[#0d1117] border-[#2d3748]',
      )}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  </label>
);

export default SettingsPage;
