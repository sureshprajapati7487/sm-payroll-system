import { useState } from 'react';
import { DataSeeding } from '@/pages/admin/DataSeeding';
import { Shield, Palette, User, Database, Server, Settings2, ChevronRight, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ServerStatusDashboard } from '@/pages/settings/ServerStatusDashboard';
import { ConfigurationPage } from '@/pages/settings/ConfigurationPage';
import { useTranslation } from 'react-i18next';

type Tab = 'data' | 'config' | 'server';



export const GeneralSettings = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('data');
    const { t } = useTranslation();

    const TABS = [
        { id: 'data', label: t('settings.data'), icon: <Database className="w-5 h-5" />, desc: t('settings.dataDesc'), accent: 'from-blue-600 to-blue-500' },
        { id: null, label: t('settings.security'), icon: <Shield className="w-5 h-5" />, desc: t('settings.securityDesc'), accent: 'from-amber-600 to-amber-500', navigate: '/settings/security' },
        { id: null, label: t('settings.theme'), icon: <Palette className="w-5 h-5" />, desc: t('settings.themeDesc'), accent: 'from-pink-600 to-purple-500', navigate: '/settings/theme' },
        { id: null, label: t('settings.language'), icon: <Globe className="w-5 h-5" />, desc: t('settings.languageDesc'), accent: 'from-indigo-600 to-violet-500', navigate: '/settings/language' },
        { id: null, label: t('settings.profile'), icon: <User className="w-5 h-5" />, desc: t('settings.profileDesc'), accent: 'from-cyan-600 to-teal-500', navigate: '/settings/profile' },
        { id: 'config', label: t('settings.config'), icon: <Settings2 className="w-5 h-5" />, desc: t('settings.configDesc'), accent: 'from-violet-600 to-purple-500' },
        { id: 'server', label: t('settings.server'), icon: <Server className="w-5 h-5" />, desc: t('settings.serverDesc'), accent: 'from-emerald-600 to-green-500' },
    ] as { id: Tab | null; label: string; icon: React.ReactNode; desc: string; accent: string; navigate?: string }[];

    const activeInfo = TABS.find(tab => tab.id === activeTab);

    return (
        <div className="space-y-8">
            {/* ── Hero Header ──────────────────────────────────────────────── */}
            <div className="relative overflow-hidden glass border border-dark-border rounded-2xl p-6 sm:p-8">
                {/* Decorative blobs */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/30 shrink-0">
                        <Settings2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-dark-text">System Settings</h1>
                        <p className="text-dark-muted text-sm mt-0.5">Application configuration, backup, security aur server management</p>
                    </div>
                </div>
            </div>

            {/* ── Tab Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {TABS.map(tab => {
                    const isActive = tab.id && tab.id === activeTab;
                    const isLink = !!tab.navigate;
                    return (
                        <button
                            key={tab.label}
                            onClick={() => tab.navigate ? navigate(tab.navigate) : tab.id && setActiveTab(tab.id)}
                            className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 text-left overflow-hidden hover:scale-[1.02] active:scale-[0.98] ${isActive
                                ? 'border-primary-500/30 bg-gradient-to-br ' + tab.accent + ' shadow-lg'
                                : 'border-dark-border bg-dark-card hover:border-primary-500/30 hover:bg-dark-surface'
                                }`}
                        >
                            {/* Glow on active */}
                            {isActive && <div className={`absolute inset-0 bg-gradient-to-br ${tab.accent} opacity-20 blur-lg pointer-events-none`} />}

                            <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-white/20' : `bg-gradient-to-br ${tab.accent} opacity-80`
                                }`}>
                                <span className="text-white">{tab.icon}</span>
                            </div>
                            <div className="relative text-center">
                                <p className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-dark-text'}`}>{tab.label}</p>
                                <p className={`text-[10px] mt-0.5 ${isActive ? 'text-white/70' : 'text-dark-muted'}`}>{tab.desc}</p>
                            </div>
                            {/* Link arrow indicator */}
                            {isLink && (
                                <ChevronRight className="absolute top-3 right-3 w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                            {/* Live pulse for server */}
                            {tab.id === 'server' && (
                                <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Breadcrumb ─────────────────────────────────────────────── */}
            {activeInfo && (
                <div className="flex items-center gap-2 text-xs text-dark-muted">
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Settings</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-dark-text font-medium">{activeInfo.label}</span>
                </div>
            )}

            {/* ── Content ──────────────────────────────────────────────────── */}
            <div>
                {activeTab === 'data' && <DataSeeding />}
                {activeTab === 'config' && <ConfigurationPage />}
                {activeTab === 'server' && <ServerStatusDashboard />}
            </div>
        </div>
    );
};
