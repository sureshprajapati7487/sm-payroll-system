// ThemeCustomizer — 100+ themes, category tabs, search, live preview
import { useState, useMemo } from 'react';
import { Sun, Moon, Search, Check, Palette, Sparkles } from 'lucide-react';
import { useThemeStore, ALL_THEMES, THEME_CATEGORIES, Theme } from '@/store/themeStore';

export const ThemeCustomizer = () => {
    const { themeId, mode, setTheme, setMode } = useThemeStore();
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    const categories = ['All', ...THEME_CATEGORIES];

    const filtered = useMemo(() =>
        ALL_THEMES.filter(t => {
            const matchCat = activeCategory === 'All' || t.category === activeCategory;
            const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
            return matchCat && matchSearch;
        }),
        [activeCategory, search]
    );

    const currentTheme = ALL_THEMES.find(t => t.id === themeId) || ALL_THEMES[0];

    const ThemeCard = ({ theme }: { theme: Theme }) => {
        const isActive = theme.id === themeId;
        const bg = mode === 'dark' ? theme.darkBg : theme.lightBg;
        const surface = mode === 'dark' ? theme.darkSurface : theme.lightSurface;
        const border = mode === 'dark' ? theme.darkBorder : theme.lightBorder;
        const text = mode === 'dark' ? theme.darkText : theme.lightText;
        const muted = mode === 'dark' ? theme.darkMuted : theme.lightMuted;

        return (
            <button
                onClick={() => setTheme(theme.id)}
                className={`relative rounded-2xl p-1 transition-all duration-200 ${isActive ? `ring-2 ring-offset-1` : 'hover:scale-105'}`}
                style={{ outlineOffset: isActive ? 2 : 0, outline: isActive ? `2px solid ${theme.primary}` : 'none' }}
                title={theme.name}
            >
                {/* Theme Mini Preview */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
                    {/* Mock Header */}
                    <div className="px-3 py-2 flex items-center gap-1.5" style={{ backgroundColor: surface, borderBottom: `1px solid ${border}` }}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.primary }} />
                        <div className="h-1.5 rounded-full flex-1" style={{ backgroundColor: muted, opacity: 0.5 }} />
                    </div>
                    {/* Mock Content */}
                    <div className="p-2.5 space-y-1.5">
                        <div className="flex gap-1.5">
                            <div className="h-6 w-6 rounded-lg flex-shrink-0" style={{ backgroundColor: theme.primary, opacity: 0.15 }} />
                            <div className="flex-1 space-y-1">
                                <div className="h-1.5 rounded-full w-3/4" style={{ backgroundColor: text, opacity: 0.8 }} />
                                <div className="h-1 rounded-full w-1/2" style={{ backgroundColor: muted, opacity: 0.5 }} />
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <div className="h-4 flex-1 rounded-lg" style={{ backgroundColor: theme.primary }} />
                            <div className="h-4 flex-1 rounded-lg" style={{ backgroundColor: surface, border: `1px solid ${border}` }} />
                        </div>
                    </div>
                </div>

                {/* Label */}
                <div className="mt-1.5 px-1 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <span className="text-[10px]">{theme.emoji}</span>
                        <span className="text-xs text-white truncate max-w-[70px]">{theme.name}</span>
                    </div>
                    {isActive && (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.primary }}>
                            <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                    )}
                </div>
            </button>
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Palette className="w-8 h-8" style={{ color: currentTheme.primary }} />
                        Theme Studio
                    </h1>
                    <p className="text-dark-muted mt-1">{ALL_THEMES.length} themes · {THEME_CATEGORIES.length} categories · Dark & Light modes</p>
                </div>

                {/* Dark/Light Toggle */}
                <div className="flex items-center gap-2 glass rounded-2xl p-1">
                    <button onClick={() => setMode('dark')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'dark' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        style={{ backgroundColor: mode === 'dark' ? currentTheme.primary : 'transparent' }}>
                        <Moon className="w-4 h-4" /> Dark
                    </button>
                    <button onClick={() => setMode('light')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'light' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        style={{ backgroundColor: mode === 'light' ? currentTheme.primary : 'transparent' }}>
                        <Sun className="w-4 h-4" /> Light
                    </button>
                </div>
            </div>

            {/* Current Theme Banner */}
            <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${currentTheme.primary}20, ${currentTheme.primaryDark}10)`, border: `1px solid ${currentTheme.primary}30` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${currentTheme.primary}20` }}>
                    {currentTheme.emoji}
                </div>
                <div className="flex-1">
                    <p className="text-white font-bold">{currentTheme.name}</p>
                    <p className="text-sm" style={{ color: currentTheme.primary }}>{currentTheme.category} · {mode === 'dark' ? '🌙 Dark' : '☀️ Light'} Mode</p>
                </div>
                <div className="flex gap-2">
                    {[currentTheme.primary, currentTheme.primaryLight, currentTheme.primaryDark].map((c, i) => (
                        <div key={i} className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: c }} title={c} />
                    ))}
                </div>
                <div className="hidden sm:block px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: currentTheme.primary }}>
                    Active Theme
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search themes… e.g. Ocean, Neon, Gold, Pastel"
                    className="w-full pl-11 pr-4 py-3 bg-dark-surface border border-dark-border rounded-2xl text-white placeholder:text-slate-500 outline-none focus:border-primary-500 text-sm" />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs">✕</button>
                )}
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeCategory === cat ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white bg-dark-surface border border-dark-border'}`}
                        style={{ backgroundColor: activeCategory === cat ? currentTheme.primary : '' }}>
                        {cat}
                        {cat !== 'All' && <span className="ml-1.5 opacity-60">{ALL_THEMES.filter(t => t.category === cat).length}</span>}
                        {cat === 'All' && <span className="ml-1.5 opacity-60">{ALL_THEMES.length}</span>}
                    </button>
                ))}
            </div>

            {/* Themes Grid */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-400 text-sm">{filtered.length} themes{search ? ` for "${search}"` : activeCategory !== 'All' ? ` in ${activeCategory}` : ''}</p>
                    <Sparkles className="w-4 h-4" style={{ color: currentTheme.primary }} />
                </div>

                {filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No themes found for "{search}"</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                        {filtered.map(theme => <ThemeCard key={theme.id} theme={theme} />)}
                    </div>
                )}
            </div>

            {/* Quick Picks */}
            {!search && activeCategory === 'All' && (
                <div className="glass rounded-2xl p-5">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <span>⚡</span> Quick Picks
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'ocean-blue', label: '🌊 Ocean Blue' },
                            { id: 'galaxy', label: '🌌 Galaxy' },
                            { id: 'neon-green', label: '🔋 Neon Green' },
                            { id: 'gold', label: '🏆 Gold' },
                            { id: 'tricolor', label: '🇮🇳 Tricolor' },
                            { id: 'cyberpunk', label: '🤖 Cyberpunk' },
                            { id: 'cherry', label: '🍒 Cherry', fallback: 'crimson' },
                            { id: 'emerald', label: '🌿 Emerald' },
                            { id: 'matrix', label: '💻 Matrix' },
                            { id: 'sakura', label: '🌸 Sakura' },
                            { id: 'obsidian', label: '🌑 Obsidian' },
                            { id: 'copper', label: '🟤 Copper' },
                        ].map(q => {
                            const tid = ALL_THEMES.find(t => t.id === q.id) ? q.id : (q.fallback || 'ocean-blue');
                            const t = ALL_THEMES.find(t => t.id === tid)!;
                            return (
                                <button key={q.id} onClick={() => setTheme(tid)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${themeId === tid ? 'text-white' : 'text-slate-400 hover:text-white border-dark-border bg-dark-surface'}`}
                                    style={{ backgroundColor: themeId === tid ? t?.primary : '', borderColor: themeId === tid ? t?.primary : '' }}>
                                    {q.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
