import React, { useState, useRef, useEffect } from 'react';
import {
    Lock,
    Sun,
    Moon,
    ChevronDown,
    Zap,
    UserCircle,
    Bell,
    User as UserIcon,
    Settings,
    LogOut
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';
import { matchesNotificationTarget, useNotificationStore } from '../store/notifications/useNotificationStore';
import { NotificationDropdown } from './notifications/NotificationDropdown';
import { UserProfileModal } from './UserProfileModal';
import { QuickActionDropdown } from './QuickActionDropdown';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface HeaderProps {
    readonly isDark: boolean;
    readonly isSidebarOpen: boolean;
    readonly onToggleTheme: () => void;
    readonly onToggleSidebar: () => void;
    readonly onQuickNavigate: (view: string, path?: string) => void;
}

const Header: React.FC<HeaderProps> = ({ isDark, onToggleTheme, onQuickNavigate }) => {
    const { user, logout, updateProfile } = useAuth();
    const { notifications, syncNotifications, startRealtime, stopRealtime } = useNotificationStore();
    const isEnglish = (user?.preferredLanguage || 'fr') === 'en';
    const tr = (fr: string, en: string) => (isEnglish ? en : fr);
    const professionalTitle =
        (user as any)?.job_title ||
        user?.jobTitle ||
        user?.role ||
        (user as any)?.department ||
        user?.departmentName ||
        '';

    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profileModalTab, setProfileModalTab] = useState<'profile' | 'team' | 'settings' | 'statistics'>('profile');

    const profileMenuRef = useRef<HTMLDivElement>(null);

    const unreadCount = user ? notifications.filter((n) => {
      return matchesNotificationTarget(n, user.id, user.role, user.departmentId) && !n.isRead;
    }).length : 0;

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        if (user?.id) {
            void syncNotifications(user.id, 50);
            startRealtime(user.id);
            intervalId = setInterval(() => {
                void syncNotifications(user.id, 50);
            }, 15000);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
            stopRealtime();
        };
    }, [user?.id, syncNotifications, startRealtime, stopRealtime]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        if (isProfileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isProfileMenuOpen]);

    return (
        <>
            <header className={cn(
                'h-16 px-6 flex items-center justify-between border-b sticky top-0 z-[100] transition-colors duration-300',
                isDark ? 'bg-[#0d1117] border-[#1e2d3d]' : 'bg-white border-slate-200'
            )}>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <h1 className={cn(
                            'text-[15px] font-semibold leading-none mb-1',
                            isDark ? 'text-[#f1f5f9]' : 'text-slate-900'
                        )}>
                            NEOX COMMAND CENTER
                        </h1>
                        <p className="text-[11px] text-[#475569] font-medium uppercase tracking-wider">
                            Enterprise Resource Platform v2.0
                        </p>
                    </div>
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-5">
                    <QuickActionDropdown isDark={isDark} onNavigateView={onQuickNavigate} />

                    <div className="flex items-center gap-1">
                        <button
                            onClick={onToggleTheme}
                            className="p-2 rounded-md hover:bg-[#1e2d3d] text-slate-500 transition-colors"
                            title="Toggle Theme"
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                                className={cn(
                                    'p-2 rounded-md transition-colors relative',
                                    isNotificationOpen ? (isDark ? 'bg-[#1e2d3d] text-slate-300' : 'bg-slate-100 text-slate-700') : 'hover:bg-[#1e2d3d] hover:text-slate-300 text-slate-500'
                                )}
                                title="Notifications"
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-white dark:border-[#0d1117]"></span>
                                )}
                            </button>
                            <NotificationDropdown
                                isOpen={isNotificationOpen}
                                onClose={() => setIsNotificationOpen(false)}
                                isDark={isDark}
                            />
                        </div>

                        <button
                            onClick={() => logout()}
                            className="p-2 rounded-md hover:bg-[#1e2d3d] text-slate-500 transition-colors relative"
                            title="Se deconnecter"
                        >
                            <Lock size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 pl-2 border-l border-[#1e2d3d] relative" ref={profileMenuRef}>
                        <div className="flex flex-col items-end">
                            <p className={cn('text-xs font-semibold leading-none', isDark ? 'text-slate-300' : 'text-slate-900')}>
                                {user?.name || tr('Utilisateur', 'User')}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{professionalTitle}</p>
                        </div>

                        <div
                            className="flex items-center gap-2 cursor-pointer group"
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        >
                            <div className="w-8 h-8 rounded-full bg-[#1e2d3d] flex items-center justify-center text-[12px] font-semibold text-slate-300 group-hover:border group-hover:border-slate-700 transition-all overflow-hidden border border-transparent">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                    user?.name ? user.name.split(' ').map(n => n[0]).join('') : <UserCircle size={20} />
                                )}
                            </div>
                            <ChevronDown size={14} className={cn(
                                'text-slate-600 transition-transform duration-200',
                                isProfileMenuOpen && 'rotate-180'
                            )} />
                        </div>

                        {isProfileMenuOpen && (
                            <div className={cn(
                                'absolute top-full right-0 mt-3 w-56 rounded-xl shadow-2xl border overflow-hidden z-[200] py-1',
                                isDark ? 'bg-[#111822] border-[#2d3748]' : 'bg-white border-slate-200'
                            )}>
                                <button
                                    onClick={() => {
                                        setProfileModalTab('profile');
                                        setIsProfileModalOpen(true);
                                        setIsProfileMenuOpen(false);
                                    }}
                                    className={cn(
                                        'w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors',
                                        isDark ? 'text-slate-300 hover:bg-[#1e2d3d]' : 'text-slate-700 hover:bg-slate-50'
                                    )}
                                >
                                    <UserIcon size={14} /> {tr('Profil', 'Profile')}
                                </button>

                                <div className="px-4 py-2">
                                    <p className={cn('text-[11px] uppercase tracking-wide mb-2', isDark ? 'text-slate-500' : 'text-slate-500')}>{tr('Statut rapide', 'Quick Status')}</p>
                                    <select
                                        value={user?.quickStatus || 'online'}
                                        onChange={(e) => {
                                            const value = e.target.value as 'online' | 'in_meeting' | 'on_leave';
                                            void updateProfile({ quickStatus: value });
                                        }}
                                        className={cn(
                                            'w-full rounded-md border px-2 py-1.5 text-xs outline-none',
                                            isDark ? 'bg-[#0d1117] border-[#2d3748] text-slate-200' : 'bg-white border-slate-300 text-slate-700',
                                        )}
                                    >
                                        <option value="online">{tr('En ligne', 'Online')}</option>
                                        <option value="in_meeting">{tr('En reunion', 'In meeting')}</option>
                                        <option value="on_leave">{tr('En conge', 'On leave')}</option>
                                    </select>
                                </div>

                                <button
                                    onClick={() => {
                                        setProfileModalTab('settings');
                                        setIsProfileModalOpen(true);
                                        setIsProfileMenuOpen(false);
                                    }}
                                    className={cn(
                                        'w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors',
                                        isDark ? 'text-slate-300 hover:bg-[#1e2d3d]' : 'text-slate-700 hover:bg-slate-50'
                                    )}
                                >
                                    <Settings size={14} /> {tr('Parametres', 'Settings')}
                                </button>
                                <button
                                    onClick={() => {
                                        setProfileModalTab('statistics');
                                        setIsProfileModalOpen(true);
                                        setIsProfileMenuOpen(false);
                                    }}
                                    className={cn(
                                        'w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors',
                                        isDark ? 'text-slate-300 hover:bg-[#1e2d3d]' : 'text-slate-700 hover:bg-slate-50'
                                    )}
                                >
                                    <Zap size={14} /> {tr('Mes statistiques', 'My statistics')}
                                </button>

                                <div className={cn('my-1 border-t', isDark ? 'border-[#2d3748]' : 'border-slate-200')} />
                                <button
                                    onClick={() => {
                                        setIsProfileMenuOpen(false);
                                        logout();
                                    }}
                                    className={cn(
                                        'w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors',
                                        isDark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'
                                    )}
                                >
                                    <LogOut size={14} /> {tr('Deconnexion', 'Logout')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <UserProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                isDark={isDark}
                initialTab={profileModalTab}
            />
        </>
    );
};

export default Header;
