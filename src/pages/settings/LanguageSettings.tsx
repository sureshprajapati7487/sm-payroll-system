import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import i18n from '@/i18n';

interface Lang {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
    preview: string;
    script: string;
    rtl?: boolean;
}

const LANGUAGES: Lang[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', preview: 'Good Morning! • Employees • Payroll • Settings', script: 'Aa Bb Cc — SM Payroll' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', preview: 'सुप्रभात! • कर्मचारी • वेतन • सेटिंग्स', script: 'अ आ इ ई — SM पेरोल' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', preview: '早上好！• 员工 • 工资 • 设置', script: '你好 — SM 工资系统' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', preview: '¡Buenos días! • Empleados • Nómina • Ajustes', script: 'Aa Bb Cc — SM Nómina' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', preview: 'Bonjour! • Employés • Paie • Paramètres', script: 'Aa Bb Cc — SM Paie' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', preview: 'صباح الخير! • الموظفون • الرواتب • الإعدادات', script: 'ع ب ت — قائمة رواتب', rtl: true },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', preview: 'সুপ্রভাত! • কর্মচারী • বেতন • সেটিংস', script: 'অ আ ই — SM পেরোল' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', preview: 'Bom dia! • Funcionários • Folha • Config.', script: 'Aa Bb Cc — SM Folha' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', preview: 'Доброе утро! • Сотрудники • Зарплата • Настройки', script: 'А Б В — СМ Зарплата' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', preview: 'خوش آمدید! • ملازمین • تنخواہ • ترتیبات', script: 'ا ب پ — تنخواہ نظام', rtl: true },
];

export const LanguageSettings = () => {
    const { t, i18n: i18nHook } = useTranslation();
    const currentLang = i18nHook.language?.substring(0, 2) || 'en';

    const handleChange = (code: string) => {
        i18n.changeLanguage(code);
        localStorage.setItem('sm-lang', code);
    };

    const currentLangInfo = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
                    <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-dark-text">{t('settings.chooseLanguage')}</h1>
                    <p className="text-sm text-dark-muted mt-0.5">{t('settings.languageNote')}</p>
                </div>
            </div>

            {/* Current Language Badge */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-500/10 border border-primary-500/20 w-fit">
                <span className="text-2xl">{currentLangInfo.flag}</span>
                <div>
                    <p className="text-xs text-primary-400 font-medium">{t('settings.currentLanguage')}</p>
                    <p className="text-sm text-dark-text font-bold">{currentLangInfo.nativeName} ({currentLangInfo.name})</p>
                </div>
            </div>

            {/* Language Grid — 2 cols on mobile, 3 on md, 5 on xl */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {LANGUAGES.map((lang) => {
                    const isActive = currentLang === lang.code;
                    return (
                        <motion.button
                            key={lang.code}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleChange(lang.code)}
                            className={clsx(
                                'relative flex flex-col gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200',
                                isActive
                                    ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/25'
                                    : 'border-dark-border bg-dark-card hover:border-primary-500/40 hover:bg-dark-bg'
                            )}
                            dir={lang.rtl ? 'rtl' : 'ltr'}
                        >
                            {/* Active check */}
                            {isActive && (
                                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            )}

                            {/* Flag + Names */}
                            <div>
                                <span className="text-3xl">{lang.flag}</span>
                                <p className={clsx('text-sm font-bold mt-1.5', isActive ? 'text-primary-300' : 'text-dark-text')}>{lang.nativeName}</p>
                                <p className="text-[11px] text-dark-muted">{lang.name}</p>
                            </div>

                            {/* Script preview */}
                            <div className={clsx(
                                'text-[10px] px-2 py-1.5 rounded-lg border truncate',
                                lang.rtl ? 'text-right' : 'text-left',
                                isActive ? 'border-primary-500/30 text-primary-400 bg-primary-500/10' : 'border-dark-border/50 text-dark-muted bg-dark-bg'
                            )}>
                                {lang.script}
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* RTL note for Arabic/Urdu */}
            {(currentLang === 'ar' || currentLang === 'ur') && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                    <span>⚠️</span>
                    <span>This language uses right-to-left (RTL) text. Full RTL layout support coming soon.</span>
                </div>
            )}

            <p className="text-xs text-dark-muted text-center pb-2">
                {currentLang === 'hi' || currentLang === 'bn' || currentLang === 'ur'
                    ? '⚠️ कुछ तकनीकी शब्द अंग्रेज़ी में रह सकते हैं।'
                    : '⚠️ Some technical terms may remain in English.'}
            </p>
        </div>
    );
};
