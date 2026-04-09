import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Copy, CheckCircle2, BarChart3, Users, Clock3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type ProfileTab = 'profile' | 'team' | 'settings' | 'statistics';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  initialTab?: ProfileTab;
}

interface UserStats {
  projectsCount: number;
  assignedTasks: number;
  tasksCompleted: number;
  tasksOverdue: number;
  activeTeamMembers: number;
}

const QUICK_STATUS_OPTIONS: Array<{ value: 'online' | 'in_meeting' | 'on_leave'; label: string }> = [
  { value: 'online', label: 'En ligne' },
  { value: 'in_meeting', label: 'En reunion' },
  { value: 'on_leave', label: 'En conge' },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, isDark, initialTab = 'profile' }) => {
  const { user, updateProfile, refreshUserProfile } = useAuth();
  const isEnglish = (user?.preferredLanguage || 'fr') === 'en';
  const tr = (fr: string, en: string) => (isEnglish ? en : fr);

  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [preferredLanguage, setPreferredLanguage] = useState<'fr' | 'en'>('fr');
  const [notifyCrm, setNotifyCrm] = useState(true);
  const [notifyProjects, setNotifyProjects] = useState(true);
  const [notifyFinance, setNotifyFinance] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setActiveTab(initialTab);
    setName(user.name || '');
    setEmail(user.email || '');
    setAvatar(user.avatar || '');
    setJobTitle((user.jobTitle || (user as any).job_title || '').trim());
    setPhoneNumber(user.phoneNumber || '');
    setPreferredLanguage((user.preferredLanguage || 'fr') === 'en' ? 'en' : 'fr');
    setNotifyCrm(user.notifyCrm ?? true);
    setNotifyProjects(user.notifyProjects ?? true);
    setNotifyFinance(user.notifyFinance ?? true);
    setErrorMessage('');
    setSuccessMessage('');
    void refreshUserProfile();
  }, [isOpen, user?.id, initialTab]);

  useEffect(() => {
    if (!isOpen || !user || activeTab !== 'statistics') return;
    let cancelled = false;
    setStatsLoading(true);
    setErrorMessage('');
    void apiRequest<{ stats: UserStats }>(`/api/v1/auth/my-stats?userId=${encodeURIComponent(user.id)}`)
      .then((data) => {
        if (!cancelled) setStats(data.stats);
      })
      .catch((err) => {
        if (!cancelled) setErrorMessage(err instanceof Error ? err.message : 'Impossible de charger les statistiques.');
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, isOpen, user]);

  if (!isOpen || !user) return null;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');
      await updateProfile({ name, email, avatar, jobTitle, phoneNumber });
      setSuccessMessage(tr('Profil mis a jour.', 'Profile updated.'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : tr('Echec de sauvegarde du profil.', 'Failed to save profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');
      await updateProfile({ preferredLanguage, notifyCrm, notifyProjects, notifyFinance });
      setSuccessMessage(tr('Parametres enregistres.', 'Settings saved.'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : tr('Echec de sauvegarde des parametres.', 'Failed to save settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  const copyValue = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setSuccessMessage(tr('Valeur copiee.', 'Copied.'));
    } catch {
      setErrorMessage(tr('Impossible de copier cette valeur.', 'Unable to copy value.'));
    }
  };

  const tabClasses = (tab: ProfileTab) => cn(
    'px-3 py-2 text-sm font-medium border-b-2 transition-colors',
    activeTab === tab
      ? 'border-neox-emerald text-neox-emerald'
      : isDark
        ? 'border-transparent text-slate-400 hover:text-slate-200'
        : 'border-transparent text-slate-500 hover:text-slate-700',
  );

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className={cn(
        'w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden border transition-all',
        isDark ? 'bg-[#111822] border-[#2d3748]' : 'bg-white border-slate-200',
      )}>
        <div className={cn('flex items-center justify-between px-6 py-4 border-b', isDark ? 'border-[#2d3748]' : 'border-slate-200')}>
          <div>
            <h2 className={cn('text-lg font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>{tr('Mon Profil', 'My Profile')}</h2>
            <p className={cn('text-xs mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>{tr('Vue utilisateur entreprise', 'Enterprise user view')}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className={cn('px-6 border-b', isDark ? 'border-[#2d3748]' : 'border-slate-200')}>
          <div className="flex items-center gap-3 overflow-x-auto">
            <button type="button" className={tabClasses('profile')} onClick={() => setActiveTab('profile')}>{tr('Profil', 'Profile')}</button>
            <button type="button" className={tabClasses('team')} onClick={() => setActiveTab('team')}>{tr('Equipe', 'Team')}</button>
            <button type="button" className={tabClasses('settings')} onClick={() => setActiveTab('settings')}>{tr('Parametres', 'Settings')}</button>
            <button type="button" className={tabClasses('statistics')} onClick={() => setActiveTab('statistics')}>{tr('Mes statistiques', 'My statistics')}</button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {activeTab === 'profile' && (
            <>
              <div className="flex items-center gap-5">
                <div
                  onClick={handleAvatarClick}
                  className={cn(
                    'relative w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold cursor-pointer group overflow-hidden border-2 shrink-0',
                    isDark ? 'bg-[#1e2d3d] text-slate-300 border-[#2d3748] hover:border-slate-500' : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-400',
                  )}
                >
                  {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : <span>{name.split(' ').map((n) => n[0]).join('')}</span>}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={22} className="text-white" />
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-slate-300' : 'text-slate-700')}>Nom complet</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className={cn('w-full px-3 py-2 rounded-md border outline-none', isDark ? 'bg-[#0d1117] border-[#2d3748] text-slate-100 focus:border-neox-emerald' : 'bg-white border-slate-300 text-slate-900 focus:border-neox-emerald')} />
                  </div>
                  <div>
                    <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-slate-300' : 'text-slate-700')}>Email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className={cn('w-full px-3 py-2 rounded-md border outline-none', isDark ? 'bg-[#0d1117] border-[#2d3748] text-slate-100 focus:border-neox-emerald' : 'bg-white border-slate-300 text-slate-900 focus:border-neox-emerald')} />
                  </div>
                  <div>
                    <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-slate-300' : 'text-slate-700')}>Titre professionnel</label>
                    <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Ex: Project Manager" className={cn('w-full px-3 py-2 rounded-md border outline-none', isDark ? 'bg-[#0d1117] border-[#2d3748] text-slate-100 focus:border-neox-emerald' : 'bg-white border-slate-300 text-slate-900 focus:border-neox-emerald')} />
                  </div>
                  <div>
                    <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-slate-300' : 'text-slate-700')}>Telephone</label>
                    <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+243 ..." className={cn('w-full px-3 py-2 rounded-md border outline-none', isDark ? 'bg-[#0d1117] border-[#2d3748] text-slate-100 focus:border-neox-emerald' : 'bg-white border-slate-300 text-slate-900 focus:border-neox-emerald')} />
                  </div>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

              <div className={cn('rounded-lg border p-4 grid grid-cols-1 md:grid-cols-2 gap-4', isDark ? 'border-[#2d3748] bg-[#0d1117]/60' : 'border-slate-200 bg-slate-50')}>
                <div>
                  <p className={cn('text-xs mb-1', isDark ? 'text-slate-400' : 'text-slate-600')}>Identite professionnelle</p>
                  <p className={cn('font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>
                    {jobTitle || user.jobTitle || (user as any).job_title || user.departmentName || (user as any).department || user.role || '-'}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs mb-1', isDark ? 'text-slate-400' : 'text-slate-600')}>Titre affiche</p>
                  <p className={cn('font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>{jobTitle || user.jobTitle || (user as any).job_title || '-'}</p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'team' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cn('rounded-lg border p-4', isDark ? 'border-[#2d3748] bg-[#0d1117]/70' : 'border-slate-200 bg-slate-50')}>
                <p className={cn('text-xs mb-1', isDark ? 'text-slate-400' : 'text-slate-600')}>Departement</p>
                <p className={cn('font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>{user.departmentName || '-'}</p>
                <p className={cn('text-xs mt-2', isDark ? 'text-slate-500' : 'text-slate-500')}>ID: {user.departmentId || '-'}</p>
              </div>
              <div className={cn('rounded-lg border p-4', isDark ? 'border-[#2d3748] bg-[#0d1117]/70' : 'border-slate-200 bg-slate-50')}>
                <p className={cn('text-xs mb-1', isDark ? 'text-slate-400' : 'text-slate-600')}>Superviseur</p>
                <p className={cn('font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>{user.supervisorName || '-'}</p>
                <p className={cn('text-xs mt-2', isDark ? 'text-slate-500' : 'text-slate-500')}>ID: {user.supervisorId || '-'}</p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className={cn('rounded-lg border p-4', isDark ? 'border-[#2d3748] bg-[#0d1117]/70' : 'border-slate-200 bg-slate-50')}>
                <p className={cn('text-sm font-semibold mb-3', isDark ? 'text-slate-100' : 'text-slate-900')}>Notifications par module</p>
                <div className="space-y-2">
                  {[
                    { label: 'CRM', checked: notifyCrm, set: setNotifyCrm },
                    { label: 'Projets', checked: notifyProjects, set: setNotifyProjects },
                    { label: 'Finance', checked: notifyFinance, set: setNotifyFinance },
                  ].map((item) => (
                    <label key={item.label} className="flex items-center justify-between gap-3">
                      <span className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>{item.label}</span>
                      <button
                        type="button"
                        onClick={() => item.set(!item.checked)}
                        className={cn('relative h-6 w-11 rounded-full transition-colors border', item.checked ? 'bg-neox-emerald/80 border-neox-emerald/80' : (isDark ? 'bg-[#0d1117] border-[#2d3748]' : 'bg-slate-200 border-slate-300'))}
                      >
                        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform', item.checked ? 'translate-x-5' : 'translate-x-0.5')} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              <div className={cn('rounded-lg border p-4', isDark ? 'border-[#2d3748] bg-[#0d1117]/70' : 'border-slate-200 bg-slate-50')}>
                <p className={cn('text-sm font-semibold mb-3', isDark ? 'text-slate-100' : 'text-slate-900')}>Langue</p>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage((e.target.value === 'en' ? 'en' : 'fr'))}
                  className={cn('w-full px-3 py-2 rounded-md border outline-none', isDark ? 'bg-[#0d1117] border-[#2d3748] text-slate-100' : 'bg-white border-slate-300 text-slate-900')}
                >
                  <option value="fr">Francais</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="space-y-4">
              {statsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className={cn('h-24 rounded-lg animate-pulse', isDark ? 'bg-[#1a2533]' : 'bg-slate-100')} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <StatCard isDark={isDark} label="Taches accomplies" value={String(stats?.tasksCompleted ?? 0)} icon={<CheckCircle2 size={16} />} />
                  <StatCard isDark={isDark} label="Taches en retard" value={String(stats?.tasksOverdue ?? 0)} icon={<Clock3 size={16} />} />
                  <StatCard isDark={isDark} label="Taches assignees" value={String(stats?.assignedTasks ?? 0)} icon={<BarChart3 size={16} />} />
                  <StatCard isDark={isDark} label="Membres actifs" value={String(stats?.activeTeamMembers ?? 0)} icon={<Users size={16} />} />
                </div>
              )}
              <div className={cn('rounded-lg border p-3 text-xs', isDark ? 'border-[#2d3748] bg-[#0d1117]/70 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                Projets suivis: <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>{stats?.projectsCount ?? 0}</strong>
              </div>
            </div>
          )}

          {(errorMessage || successMessage) && (
            <div className={cn('rounded-md border px-3 py-2 text-sm', errorMessage ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300')}>
              {errorMessage || successMessage}
            </div>
          )}
        </div>

        <div className={cn('px-6 py-4 border-t flex justify-between items-center gap-3', isDark ? 'border-[#2d3748] bg-[#0d1117]' : 'border-slate-200 bg-slate-50')}>
          <button
            onClick={() => copyValue(JSON.stringify({
              user: user.name,
              email: user.email,
              role: user.role,
              department: user.departmentName,
              title: user.jobTitle || (user as any).job_title || user.departmentName || (user as any).department || user.role,
            }, null, 2))}
            className={cn('px-3 py-2 rounded-md text-xs font-medium border transition-colors flex items-center gap-2', isDark ? 'border-[#2d3748] text-slate-300 hover:bg-[#1e2d3d]' : 'border-slate-300 text-slate-700 hover:bg-slate-100')}
          >
            <Copy size={13} /> {tr('Copier resume', 'Copy summary')}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className={cn('px-4 py-2 rounded-md text-sm font-medium border', isDark ? 'border-[#2d3748] text-slate-300 hover:bg-[#1e2d3d]' : 'border-slate-300 text-slate-700 hover:bg-slate-100')}
            >
              {tr('Annuler', 'Cancel')}
            </button>
            <button
              onClick={() => {
                if (activeTab === 'settings') {
                  void saveSettings();
                } else {
                  void saveProfile();
                }
              }}
              disabled={isSaving || activeTab === 'statistics' || activeTab === 'team'}
              className="px-4 py-2 rounded-md text-sm font-medium bg-neox-emerald hover:bg-emerald-500 text-black transition-colors disabled:opacity-50"
            >
              {isSaving ? tr('Enregistrement...', 'Saving...') : tr('Enregistrer', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ isDark: boolean; label: string; value: string; icon: React.ReactNode }> = ({ isDark, label, value, icon }) => (
  <div className={cn('rounded-lg border p-4', isDark ? 'border-[#2d3748] bg-[#0d1117]/70' : 'border-slate-200 bg-slate-50')}>
    <div className="flex items-center justify-between">
      <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-600')}>{label}</p>
      <span className={cn('text-neox-emerald', isDark ? 'opacity-90' : 'opacity-100')}>{icon}</span>
    </div>
    <p className={cn('text-2xl font-semibold mt-2', isDark ? 'text-slate-100' : 'text-slate-900')}>{value}</p>
  </div>
);
