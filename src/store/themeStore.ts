import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

export interface Theme {
    id: string;
    name: string;
    category: string;
    emoji: string;
    primary: string;
    primaryLight: string;
    primaryDark: string;
    // Dark variant
    darkBg: string;
    darkSurface: string;
    darkBorder: string;
    darkText: string;
    darkMuted: string;
    // Light variant
    lightBg: string;
    lightSurface: string;
    lightBorder: string;
    lightText: string;
    lightMuted: string;
    // Accent
    accent?: string;
}

// ── 100+ Themes across 10 categories ─────────────────────────────────────────
export const ALL_THEMES: Theme[] = [
    // ── OCEAN & BLUE ─────────────────────────────────────────────────────────
    { id: 'ocean-blue', name: 'Ocean Blue', category: 'Ocean', emoji: '🌊', primary: '#3b82f6', primaryLight: '#60a5fa', primaryDark: '#2563eb', darkBg: '#0a0f1e', darkSurface: '#111827', darkBorder: '#1e3a5f', darkText: '#e2e8f0', darkMuted: '#94a3b8', lightBg: '#f0f9ff', lightSurface: '#e0f2fe', lightBorder: '#bae6fd', lightText: '#0c4a6e', lightMuted: '#0284c7' },
    { id: 'midnight', name: 'Midnight', category: 'Ocean', emoji: '🌙', primary: '#6366f1', primaryLight: '#818cf8', primaryDark: '#4f46e5', darkBg: '#020617', darkSurface: '#0f172a', darkBorder: '#1e293b', darkText: '#e2e8f0', darkMuted: '#94a3b8', lightBg: '#eef2ff', lightSurface: '#e0e7ff', lightBorder: '#c7d2fe', lightText: '#1e1b4b', lightMuted: '#4338ca' },
    { id: 'arctic', name: 'Arctic', category: 'Ocean', emoji: '🧊', primary: '#0ea5e9', primaryLight: '#38bdf8', primaryDark: '#0284c7', darkBg: '#020b18', darkSurface: '#0c1a2e', darkBorder: '#164e63', darkText: '#e0f7ff', darkMuted: '#7dd3fc', lightBg: '#f0f9ff', lightSurface: '#e0f2fe', lightBorder: '#7dd3fc', lightText: '#0c4a6e', lightMuted: '#0369a1' },
    { id: 'navy', name: 'Navy', category: 'Ocean', emoji: '⚓', primary: '#1e40af', primaryLight: '#3b82f6', primaryDark: '#1e3a8a', darkBg: '#030712', darkSurface: '#0a0f1e', darkBorder: '#1e3a8a', darkText: '#dbeafe', darkMuted: '#93c5fd', lightBg: '#eff6ff', lightSurface: '#dbeafe', lightBorder: '#bfdbfe', lightText: '#1e3a8a', lightMuted: '#1d4ed8' },
    { id: 'teal-wave', name: 'Teal Wave', category: 'Ocean', emoji: '🌺', primary: '#14b8a6', primaryLight: '#2dd4bf', primaryDark: '#0d9488', darkBg: '#030f0e', darkSurface: '#0d1f1e', darkBorder: '#134e4a', darkText: '#ccfbf1', darkMuted: '#5eead4', lightBg: '#f0fdfa', lightSurface: '#ccfbf1', lightBorder: '#99f6e4', lightText: '#134e4a', lightMuted: '#0f766e' },
    { id: 'deep-sea', name: 'Deep Sea', category: 'Ocean', emoji: '🐋', primary: '#0891b2', primaryLight: '#22d3ee', primaryDark: '#0e7490', darkBg: '#020e12', darkSurface: '#061b22', darkBorder: '#155e75', darkText: '#cffafe', darkMuted: '#67e8f9', lightBg: '#ecfeff', lightSurface: '#cffafe', lightBorder: '#a5f3fc', lightText: '#164e63', lightMuted: '#0891b2' },
    { id: 'sapphire', name: 'Sapphire', category: 'Ocean', emoji: '💎', primary: '#2563eb', primaryLight: '#60a5fa', primaryDark: '#1d4ed8', darkBg: '#040814', darkSurface: '#0d1526', darkBorder: '#1e3a8a', darkText: '#dbeafe', darkMuted: '#93c5fd', lightBg: '#eff6ff', lightSurface: '#dbeafe', lightBorder: '#93c5fd', lightText: '#1e40af', lightMuted: '#3b82f6' },
    { id: 'aqua-marine', name: 'Aquamarine', category: 'Ocean', emoji: '🦋', primary: '#06b6d4', primaryLight: '#22d3ee', primaryDark: '#0891b2', darkBg: '#020d10', darkSurface: '#071b22', darkBorder: '#0e7490', darkText: '#cffafe', darkMuted: '#67e8f9', lightBg: '#ecfeff', lightSurface: '#cffafe', lightBorder: '#67e8f9', lightText: '#0e7490', lightMuted: '#06b6d4' },
    { id: 'royal-blue', name: 'Royal Blue', category: 'Ocean', emoji: '👑', primary: '#4f46e5', primaryLight: '#818cf8', primaryDark: '#4338ca', darkBg: '#06040f', darkSurface: '#0f0a2e', darkBorder: '#1e1b4b', darkText: '#e0e7ff', darkMuted: '#a5b4fc', lightBg: '#eef2ff', lightSurface: '#e0e7ff', lightBorder: '#c7d2fe', lightText: '#1e1b4b', lightMuted: '#4f46e5' },
    { id: 'steel-blue', name: 'Steel Blue', category: 'Ocean', emoji: '🔵', primary: '#475569', primaryLight: '#64748b', primaryDark: '#334155', darkBg: '#050809', darkSurface: '#0f1721', darkBorder: '#1e293b', darkText: '#e2e8f0', darkMuted: '#94a3b8', lightBg: '#f8fafc', lightSurface: '#f1f5f9', lightBorder: '#cbd5e1', lightText: '#0f172a', lightMuted: '#475569' },

    // ── NATURE & GREEN ────────────────────────────────────────────────────────
    { id: 'emerald', name: 'Emerald', category: 'Nature', emoji: '🌿', primary: '#10b981', primaryLight: '#34d399', primaryDark: '#059669', darkBg: '#030f0a', darkSurface: '#061c12', darkBorder: '#064e3b', darkText: '#d1fae5', darkMuted: '#6ee7b7', lightBg: '#ecfdf5', lightSurface: '#d1fae5', lightBorder: '#a7f3d0', lightText: '#064e3b', lightMuted: '#059669' },
    { id: 'forest', name: 'Forest', category: 'Nature', emoji: '🌲', primary: '#16a34a', primaryLight: '#22c55e', primaryDark: '#15803d', darkBg: '#020b04', darkSurface: '#071510', darkBorder: '#14532d', darkText: '#dcfce7', darkMuted: '#86efac', lightBg: '#f0fdf4', lightSurface: '#dcfce7', lightBorder: '#bbf7d0', lightText: '#14532d', lightMuted: '#16a34a' },
    { id: 'lime', name: 'Lime', category: 'Nature', emoji: '🍋', primary: '#65a30d', primaryLight: '#84cc16', primaryDark: '#4d7c0f', darkBg: '#030801', darkSurface: '#0b1403', darkBorder: '#365314', darkText: '#ecfccb', darkMuted: '#bef264', lightBg: '#f7fee7', lightSurface: '#ecfccb', lightBorder: '#d9f99d', lightText: '#1a2e05', lightMuted: '#65a30d' },
    { id: 'sage', name: 'Sage', category: 'Nature', emoji: '🌱', primary: '#84cc16', primaryLight: '#a3e635', primaryDark: '#65a30d', darkBg: '#040801', darkSurface: '#0c1603', darkBorder: '#1a2e05', darkText: '#ecfccb', darkMuted: '#bef264', lightBg: '#f7fee7', lightSurface: '#ecfccb', lightBorder: '#bef264', lightText: '#1a2e05', lightMuted: '#4d7c0f' },
    { id: 'mint', name: 'Mint', category: 'Nature', emoji: '🍃', primary: '#34d399', primaryLight: '#6ee7b7', primaryDark: '#10b981', darkBg: '#030f0a', darkSurface: '#071a10', darkBorder: '#065f46', darkText: '#d1fae5', darkMuted: '#6ee7b7', lightBg: '#ecfdf5', lightSurface: '#d1fae5', lightBorder: '#6ee7b7', lightText: '#064e3b', lightMuted: '#10b981' },
    { id: 'olive', name: 'Olive', category: 'Nature', emoji: '🫒', primary: '#78716c', primaryLight: '#a8a29e', primaryDark: '#57534e', darkBg: '#090807', darkSurface: '#1c1917', darkBorder: '#292524', darkText: '#fafaf9', darkMuted: '#a8a29e', lightBg: '#fafaf9', lightSurface: '#f5f5f4', lightBorder: '#d6d3d1', lightText: '#1c1917', lightMuted: '#78716c' },
    { id: 'jade', name: 'Jade', category: 'Nature', emoji: '🪨', primary: '#059669', primaryLight: '#34d399', primaryDark: '#047857', darkBg: '#020b05', darkSurface: '#071511', darkBorder: '#064e3b', darkText: '#d1fae5', darkMuted: '#6ee7b7', lightBg: '#ecfdf5', lightSurface: '#d1fae5', lightBorder: '#a7f3d0', lightText: '#022c22', lightMuted: '#059669' },
    { id: 'tropical', name: 'Tropical', category: 'Nature', emoji: '🌴', primary: '#22c55e', primaryLight: '#4ade80', primaryDark: '#16a34a', darkBg: '#020b04', darkSurface: '#071510', darkBorder: '#166534', darkText: '#dcfce7', darkMuted: '#86efac', lightBg: '#f0fdf4', lightSurface: '#dcfce7', lightBorder: '#86efac', lightText: '#14532d', lightMuted: '#22c55e' },
    { id: 'bamboo', name: 'Bamboo', category: 'Nature', emoji: '🎋', primary: '#4ade80', primaryLight: '#86efac', primaryDark: '#22c55e', darkBg: '#030a02', darkSurface: '#081406', darkBorder: '#1c540a', darkText: '#f0fdf4', darkMuted: '#86efac', lightBg: '#f0fdf4', lightSurface: '#dcfce7', lightBorder: '#bbf7d0', lightText: '#14532d', lightMuted: '#16a34a' },
    { id: 'earth', name: 'Earth', category: 'Nature', emoji: '🌍', primary: '#92400e', primaryLight: '#b45309', primaryDark: '#78350f', darkBg: '#0d0601', darkSurface: '#1c0f03', darkBorder: '#451a03', darkText: '#fef3c7', darkMuted: '#d97706', lightBg: '#fffbeb', lightSurface: '#fef3c7', lightBorder: '#fde68a', lightText: '#451a03', lightMuted: '#92400e' },

    // ── FIRE & WARM ───────────────────────────────────────────────────────────
    { id: 'sunset', name: 'Sunset', category: 'Warm', emoji: '🌅', primary: '#f97316', primaryLight: '#fb923c', primaryDark: '#ea580c', darkBg: '#0f0700', darkSurface: '#1c0e02', darkBorder: '#7c2d12', darkText: '#ffedd5', darkMuted: '#fdba74', lightBg: '#fff7ed', lightSurface: '#ffedd5', lightBorder: '#fed7aa', lightText: '#431407', lightMuted: '#ea580c' },
    { id: 'crimson', name: 'Crimson', category: 'Warm', emoji: '🔴', primary: '#dc2626', primaryLight: '#f87171', primaryDark: '#b91c1c', darkBg: '#0f0202', darkSurface: '#1c0505', darkBorder: '#7f1d1d', darkText: '#fee2e2', darkMuted: '#fca5a5', lightBg: '#fef2f2', lightSurface: '#fee2e2', lightBorder: '#fecaca', lightText: '#450a0a', lightMuted: '#dc2626' },
    { id: 'amber', name: 'Amber', category: 'Warm', emoji: '🔥', primary: '#f59e0b', primaryLight: '#fbbf24', primaryDark: '#d97706', darkBg: '#0f0900', darkSurface: '#1c1202', darkBorder: '#78350f', darkText: '#fef3c7', darkMuted: '#fde68a', lightBg: '#fffbeb', lightSurface: '#fef3c7', lightBorder: '#fde68a', lightText: '#451a03', lightMuted: '#d97706' },
    { id: 'coral', name: 'Coral', category: 'Warm', emoji: '🪸', primary: '#f43f5e', primaryLight: '#fb7185', primaryDark: '#e11d48', darkBg: '#0f0206', darkSurface: '#1c0510', darkBorder: '#881337', darkText: '#ffe4e6', darkMuted: '#fda4af', lightBg: '#fff1f2', lightSurface: '#ffe4e6', lightBorder: '#fecdd3', lightText: '#4c0519', lightMuted: '#e11d48' },
    { id: 'volcano', name: 'Volcano', category: 'Warm', emoji: '🌋', primary: '#ef4444', primaryLight: '#f87171', primaryDark: '#dc2626', darkBg: '#0d0101', darkSurface: '#1a0303', darkBorder: '#7f1d1d', darkText: '#fee2e2', darkMuted: '#fca5a5', lightBg: '#fef2f2', lightSurface: '#fee2e2', lightBorder: '#fca5a5', lightText: '#7f1d1d', lightMuted: '#ef4444' },
    { id: 'rose-gold', name: 'Rose Gold', category: 'Warm', emoji: '🌹', primary: '#e11d48', primaryLight: '#fb7185', primaryDark: '#be123c', darkBg: '#0f0208', darkSurface: '#1c0510', darkBorder: '#881337', darkText: '#ffe4e6', darkMuted: '#fda4af', lightBg: '#fff1f2', lightSurface: '#ffe4e6', lightBorder: '#fda4af', lightText: '#4c0519', lightMuted: '#be123c' },
    { id: 'copper', name: 'Copper', category: 'Warm', emoji: '🟤', primary: '#b45309', primaryLight: '#d97706', primaryDark: '#92400e', darkBg: '#0d0600', darkSurface: '#1c0e02', darkBorder: '#78350f', darkText: '#fef3c7', darkMuted: '#fde68a', lightBg: '#fffbeb', lightSurface: '#fef3c7', lightBorder: '#fde68a', lightText: '#451a03', lightMuted: '#b45309' },
    { id: 'autumn', name: 'Autumn', category: 'Warm', emoji: '🍂', primary: '#c2410c', primaryLight: '#f97316', primaryDark: '#9a3412', darkBg: '#0d0400', darkSurface: '#1c0a02', darkBorder: '#7c2d12', darkText: '#ffedd5', darkMuted: '#fdba74', lightBg: '#fff7ed', lightSurface: '#ffedd5', lightBorder: '#fdba74', lightText: '#431407', lightMuted: '#c2410c' },
    { id: 'mahogany', name: 'Mahogany', category: 'Warm', emoji: '🪵', primary: '#9f1239', primaryLight: '#e11d48', primaryDark: '#881337', darkBg: '#0a0105', darkSurface: '#180210', darkBorder: '#4c0519', darkText: '#ffe4e6', darkMuted: '#fda4af', lightBg: '#fff1f2', lightSurface: '#ffe4e6', lightBorder: '#fda4af', lightText: '#4c0519', lightMuted: '#be123c' },
    { id: 'tangerine', name: 'Tangerine', category: 'Warm', emoji: '🍊', primary: '#ea580c', primaryLight: '#f97316', primaryDark: '#c2410c', darkBg: '#0f0600', darkSurface: '#1c0e02', darkBorder: '#7c2d12', darkText: '#ffedd5', darkMuted: '#fdba74', lightBg: '#fff7ed', lightSurface: '#ffedd5', lightBorder: '#fed7aa', lightText: '#431407', lightMuted: '#ea580c' },

    // ── PURPLE & COSMIC ───────────────────────────────────────────────────────
    { id: 'violet', name: 'Violet', category: 'Purple', emoji: '💜', primary: '#7c3aed', primaryLight: '#a78bfa', primaryDark: '#6d28d9', darkBg: '#07040f', darkSurface: '#11082a', darkBorder: '#4c1d95', darkText: '#ede9fe', darkMuted: '#c4b5fd', lightBg: '#f5f3ff', lightSurface: '#ede9fe', lightBorder: '#ddd6fe', lightText: '#2e1065', lightMuted: '#7c3aed' },
    { id: 'galaxy', name: 'Galaxy', category: 'Purple', emoji: '🌌', primary: '#8b5cf6', primaryLight: '#a78bfa', primaryDark: '#7c3aed', darkBg: '#050210', darkSurface: '#0e0b20', darkBorder: '#3b0764', darkText: '#f5f3ff', darkMuted: '#c4b5fd', lightBg: '#faf5ff', lightSurface: '#f3e8ff', lightBorder: '#e9d5ff', lightText: '#3b0764', lightMuted: '#9333ea' },
    { id: 'nebula', name: 'Nebula', category: 'Purple', emoji: '✨', primary: '#a855f7', primaryLight: '#c084fc', primaryDark: '#9333ea', darkBg: '#060310', darkSurface: '#100528', darkBorder: '#3b0764', darkText: '#f3e8ff', darkMuted: '#d8b4fe', lightBg: '#faf5ff', lightSurface: '#f3e8ff', lightBorder: '#d8b4fe', lightText: '#3b0764', lightMuted: '#a855f7' },
    { id: 'amethyst', name: 'Amethyst', category: 'Purple', emoji: '🟣', primary: '#9333ea', primaryLight: '#c084fc', primaryDark: '#7e22ce', darkBg: '#07040f', darkSurface: '#120626', darkBorder: '#4a1272', darkText: '#f3e8ff', darkMuted: '#d8b4fe', lightBg: '#faf5ff', lightSurface: '#f3e8ff', lightBorder: '#e9d5ff', lightText: '#3b0764', lightMuted: '#9333ea' },
    { id: 'lavender', name: 'Lavender', category: 'Purple', emoji: '💐', primary: '#c084fc', primaryLight: '#e879f9', primaryDark: '#a855f7', darkBg: '#080412', darkSurface: '#130628', darkBorder: '#512d78', darkText: '#fae8ff', darkMuted: '#e879f9', lightBg: '#fdf4ff', lightSurface: '#fae8ff', lightBorder: '#f5d0fe', lightText: '#4a044e', lightMuted: '#c026d3' },
    { id: 'orchid', name: 'Orchid', category: 'Purple', emoji: '🌸', primary: '#d946ef', primaryLight: '#e879f9', primaryDark: '#c026d3', darkBg: '#080313', darkSurface: '#140526', darkBorder: '#4a044e', darkText: '#fae8ff', darkMuted: '#e879f9', lightBg: '#fdf4ff', lightSurface: '#fae8ff', lightBorder: '#f0abfc', lightText: '#3b0764', lightMuted: '#d946ef' },
    { id: 'cosmos', name: 'Cosmos', category: 'Purple', emoji: '🪐', primary: '#6d28d9', primaryLight: '#8b5cf6', primaryDark: '#5b21b6', darkBg: '#05020e', darkSurface: '#0d0820', darkBorder: '#2e1065', darkText: '#ede9fe', darkMuted: '#c4b5fd', lightBg: '#f5f3ff', lightSurface: '#ede9fe', lightBorder: '#ddd6fe', lightText: '#2e1065', lightMuted: '#7c3aed' },
    { id: 'aurora-purple', name: 'Aurora', category: 'Purple', emoji: '🌈', primary: '#a78bfa', primaryLight: '#c4b5fd', primaryDark: '#8b5cf6', darkBg: '#060110', darkSurface: '#0c0420', darkBorder: '#3730a3', darkText: '#e0e7ff', darkMuted: '#a5b4fc', lightBg: '#eef2ff', lightSurface: '#e0e7ff', lightBorder: '#c7d2fe', lightText: '#1e1b4b', lightMuted: '#6366f1' },
    { id: 'plum', name: 'Plum', category: 'Purple', emoji: '🍇', primary: '#7e22ce', primaryLight: '#a855f7', primaryDark: '#6b21a8', darkBg: '#060212', darkSurface: '#0f0424', darkBorder: '#3b0764', darkText: '#f3e8ff', darkMuted: '#d8b4fe', lightBg: '#faf5ff', lightSurface: '#f3e8ff', lightBorder: '#d8b4fe', lightText: '#3b0764', lightMuted: '#7e22ce' },
    { id: 'mystic', name: 'Mystic', category: 'Purple', emoji: '🔮', primary: '#8b5cf6', primaryLight: '#a78bfa', primaryDark: '#7c3aed', darkBg: '#030110', darkSurface: '#0a0420', darkBorder: '#2e1065', darkText: '#ede9fe', darkMuted: '#a78bfa', lightBg: '#f5f3ff', lightSurface: '#ede9fe', lightBorder: '#c4b5fd', lightText: '#1e1b4b', lightMuted: '#6d28d9' },

    // ── PINK & FEMININE ───────────────────────────────────────────────────────
    { id: 'hot-pink', name: 'Hot Pink', category: 'Pink', emoji: '💗', primary: '#ec4899', primaryLight: '#f472b6', primaryDark: '#db2777', darkBg: '#0f0208', darkSurface: '#1c0512', darkBorder: '#831843', darkText: '#fce7f3', darkMuted: '#f9a8d4', lightBg: '#fdf2f8', lightSurface: '#fce7f3', lightBorder: '#fbcfe8', lightText: '#500724', lightMuted: '#db2777' },
    { id: 'bubblegum', name: 'Bubblegum', category: 'Pink', emoji: '🍬', primary: '#f472b6', primaryLight: '#f9a8d4', primaryDark: '#ec4899', darkBg: '#0a0208', darkSurface: '#180510', darkBorder: '#701a75', darkText: '#fdf4ff', darkMuted: '#f0abfc', lightBg: '#fdf4ff', lightSurface: '#fae8ff', lightBorder: '#f0abfc', lightText: '#4a044e', lightMuted: '#c026d3' },
    { id: 'flamingo', name: 'Flamingo', category: 'Pink', emoji: '🦩', primary: '#fb7185', primaryLight: '#fda4af', primaryDark: '#f43f5e', darkBg: '#0d0105', darkSurface: '#1a020c', darkBorder: '#9d174d', darkText: '#ffe4e6', darkMuted: '#fda4af', lightBg: '#fff1f2', lightSurface: '#ffe4e6', lightBorder: '#fecdd3', lightText: '#4c0519', lightMuted: '#e11d48' },
    { id: 'sakura', name: 'Sakura', category: 'Pink', emoji: '🌸', primary: '#f9a8d4', primaryLight: '#fbcfe8', primaryDark: '#f472b6', darkBg: '#0a0208', darkSurface: '#180510', darkBorder: '#9d174d', darkText: '#fdf2f8', darkMuted: '#f9a8d4', lightBg: '#fdf2f8', lightSurface: '#fce7f3', lightBorder: '#fbcfe8', lightText: '#831843', lightMuted: '#db2777' },
    { id: 'blush', name: 'Blush', category: 'Pink', emoji: '🌺', primary: '#db2777', primaryLight: '#ec4899', primaryDark: '#be185d', darkBg: '#0a0106', darkSurface: '#180312', darkBorder: '#831843', darkText: '#fce7f3', darkMuted: '#f9a8d4', lightBg: '#fdf2f8', lightSurface: '#fce7f3', lightBorder: '#fbcfe8', lightText: '#500724', lightMuted: '#db2777' },

    // ── PROFESSIONAL & MONO ───────────────────────────────────────────────────
    { id: 'slate', name: 'Slate', category: 'Pro', emoji: '🔘', primary: '#64748b', primaryLight: '#94a3b8', primaryDark: '#475569', darkBg: '#020617', darkSurface: '#0f172a', darkBorder: '#1e293b', darkText: '#f8fafc', darkMuted: '#94a3b8', lightBg: '#f8fafc', lightSurface: '#f1f5f9', lightBorder: '#e2e8f0', lightText: '#0f172a', lightMuted: '#64748b' },
    { id: 'charcoal', name: 'Charcoal', category: 'Pro', emoji: '⬛', primary: '#374151', primaryLight: '#6b7280', primaryDark: '#1f2937', darkBg: '#030305', darkSurface: '#111111', darkBorder: '#222222', darkText: '#f9fafb', darkMuted: '#9ca3af', lightBg: '#f9fafb', lightSurface: '#f3f4f6', lightBorder: '#e5e7eb', lightText: '#111827', lightMuted: '#6b7280' },
    { id: 'silver', name: 'Silver', category: 'Pro', emoji: '⚪', primary: '#9ca3af', primaryLight: '#d1d5db', primaryDark: '#6b7280', darkBg: '#060608', darkSurface: '#141416', darkBorder: '#27272a', darkText: '#fafafa', darkMuted: '#a1a1aa', lightBg: '#fafafa', lightSurface: '#f4f4f5', lightBorder: '#e4e4e7', lightText: '#18181b', lightMuted: '#71717a' },
    { id: 'onyx', name: 'Onyx', category: 'Pro', emoji: '🖤', primary: '#27272a', primaryLight: '#52525b', primaryDark: '#18181b', darkBg: '#000000', darkSurface: '#0a0a0a', darkBorder: '#1a1a1a', darkText: '#fafafa', darkMuted: '#a1a1aa', lightBg: '#fafafa', lightSurface: '#f4f4f5', lightBorder: '#d4d4d8', lightText: '#18181b', lightMuted: '#52525b' },
    { id: 'carbon', name: 'Carbon', category: 'Pro', emoji: '🔲', primary: '#1c1917', primaryLight: '#44403c', primaryDark: '#0c0a09', darkBg: '#000000', darkSurface: '#0f0e0c', darkBorder: '#1c1917', darkText: '#fafaf9', darkMuted: '#a8a29e', lightBg: '#fafaf9', lightSurface: '#f5f5f4', lightBorder: '#e7e5e4', lightText: '#1c1917', lightMuted: '#78716c' },
    { id: 'platinum', name: 'Platinum', category: 'Pro', emoji: '🥇', primary: '#71717a', primaryLight: '#a1a1aa', primaryDark: '#52525b', darkBg: '#09090b', darkSurface: '#18181b', darkBorder: '#27272a', darkText: '#fafafa', darkMuted: '#a1a1aa', lightBg: '#fafafa', lightSurface: '#f4f4f5', lightBorder: '#e4e4e7', lightText: '#09090b', lightMuted: '#71717a' },
    { id: 'white-clean', name: 'Clean White', category: 'Pro', emoji: '⬜', primary: '#3b82f6', primaryLight: '#60a5fa', primaryDark: '#2563eb', darkBg: '#f8fafc', darkSurface: '#f1f5f9', darkBorder: '#e2e8f0', darkText: '#0f172a', darkMuted: '#64748b', lightBg: '#ffffff', lightSurface: '#f8fafc', lightBorder: '#e2e8f0', lightText: '#0f172a', lightMuted: '#475569' },
    { id: 'corporate', name: 'Corporate', category: 'Pro', emoji: '🏢', primary: '#1e40af', primaryLight: '#3b82f6', primaryDark: '#1e3a8a', darkBg: '#040810', darkSurface: '#0a1020', darkBorder: '#1e3a8a', darkText: '#dbeafe', darkMuted: '#93c5fd', lightBg: '#f0f9ff', lightSurface: '#e0f2fe', lightBorder: '#bae6fd', lightText: '#0c4a6e', lightMuted: '#1e40af' },
    { id: 'executive', name: 'Executive', category: 'Pro', emoji: '👔', primary: '#334155', primaryLight: '#64748b', primaryDark: '#1e293b', darkBg: '#020617', darkSurface: '#0f172a', darkBorder: '#334155', darkText: '#f1f5f9', darkMuted: '#94a3b8', lightBg: '#f8fafc', lightSurface: '#f1f5f9', lightBorder: '#e2e8f0', lightText: '#0f172a', lightMuted: '#64748b' },
    { id: 'business', name: 'Business', category: 'Pro', emoji: '💼', primary: '#0369a1', primaryLight: '#0ea5e9', primaryDark: '#075985', darkBg: '#020d18', darkSurface: '#061828', darkBorder: '#075985', darkText: '#e0f2fe', darkMuted: '#38bdf8', lightBg: '#f0f9ff', lightSurface: '#e0f2fe', lightBorder: '#7dd3fc', lightText: '#0c4a6e', lightMuted: '#0369a1' },

    // ── CYBERPUNK & NEON ──────────────────────────────────────────────────────
    { id: 'neon-green', name: 'Neon Green', category: 'Cyber', emoji: '🔋', primary: '#00ff41', primaryLight: '#39ff14', primaryDark: '#00d435', darkBg: '#000000', darkSurface: '#050f05', darkBorder: '#003a0f', darkText: '#ccffcc', darkMuted: '#39ff14', lightBg: '#f0fdf4', lightSurface: '#dcfce7', lightBorder: '#86efac', lightText: '#14532d', lightMuted: '#22c55e' },
    { id: 'neon-blue', name: 'Neon Blue', category: 'Cyber', emoji: '⚡', primary: '#00cfff', primaryLight: '#40e0ff', primaryDark: '#00a8cc', darkBg: '#000000', darkSurface: '#00060f', darkBorder: '#001f3d', darkText: '#ccf5ff', darkMuted: '#00cfff', lightBg: '#ecfeff', lightSurface: '#cffafe', lightBorder: '#67e8f9', lightText: '#164e63', lightMuted: '#0891b2' },
    { id: 'neon-purple', name: 'Neon Purple', category: 'Cyber', emoji: '🔌', primary: '#bf00ff', primaryLight: '#d966ff', primaryDark: '#9900cc', darkBg: '#030008', darkSurface: '#0a0014', darkBorder: '#350050', darkText: '#f5d0fe', darkMuted: '#d946ef', lightBg: '#fdf4ff', lightSurface: '#fae8ff', lightBorder: '#f0abfc', lightText: '#3b0764', lightMuted: '#c026d3' },
    { id: 'neon-pink', name: 'Neon Pink', category: 'Cyber', emoji: '💫', primary: '#ff007f', primaryLight: '#ff66a3', primaryDark: '#cc0066', darkBg: '#0a0006', darkSurface: '#150010', darkBorder: '#6b003a', darkText: '#ffd6eb', darkMuted: '#ff66a3', lightBg: '#fff0f6', lightSurface: '#ffd6eb', lightBorder: '#ffadd2', lightText: '#520339', lightMuted: '#eb2f96' },
    { id: 'cyberpunk', name: 'Cyberpunk', category: 'Cyber', emoji: '🤖', primary: '#ffff00', primaryLight: '#ffff66', primaryDark: '#cccc00', darkBg: '#050000', darkSurface: '#100010', darkBorder: '#ff00ff', darkText: '#ffffcc', darkMuted: '#ff00ff', lightBg: '#fffff0', lightSurface: '#fefef0', lightBorder: '#fefeb0', lightText: '#333300', lightMuted: '#cccc00' },
    { id: 'matrix', name: 'Matrix', category: 'Cyber', emoji: '💻', primary: '#00ff00', primaryLight: '#66ff66', primaryDark: '#00cc00', darkBg: '#000000', darkSurface: '#000b00', darkBorder: '#003300', darkText: '#00ff00', darkMuted: '#008800', lightBg: '#f0fdf4', lightSurface: '#dcfce7', lightBorder: '#86efac', lightText: '#14532d', lightMuted: '#16a34a' },
    { id: 'hacker', name: 'Hacker', category: 'Cyber', emoji: '🛡️', primary: '#22c55e', primaryLight: '#4ade80', primaryDark: '#16a34a', darkBg: '#000000', darkSurface: '#030a03', darkBorder: '#0d2b0d', darkText: '#dbffd6', darkMuted: '#4ade80', lightBg: '#f0fdf4', lightSurface: '#dcfce7', lightBorder: '#bbf7d0', lightText: '#14532d', lightMuted: '#16a34a' },
    { id: 'electric', name: 'Electric', category: 'Cyber', emoji: '⚡', primary: '#f59e0b', primaryLight: '#fbbf24', primaryDark: '#d97706', darkBg: '#020100', darkSurface: '#0f0900', darkBorder: '#713f12', darkText: '#fef9c3', darkMuted: '#fde047', lightBg: '#fefce8', lightSurface: '#fef9c3', lightBorder: '#fef08a', lightText: '#422006', lightMuted: '#d97706' },
    { id: 'holographic', name: 'Holographic', category: 'Cyber', emoji: '🎆', primary: '#a855f7', primaryLight: '#c084fc', primaryDark: '#9333ea', darkBg: '#030018', darkSurface: '#0a0028', darkBorder: '#2e1065', darkText: '#f3e8ff', darkMuted: '#c4b5fd', lightBg: '#faf5ff', lightSurface: '#f3e8ff', lightBorder: '#d8b4fe', lightText: '#2e1065', lightMuted: '#7c3aed' },

    // ── EARTHY & BROWN ────────────────────────────────────────────────────────
    { id: 'coffee', name: 'Coffee', category: 'Earthy', emoji: '☕', primary: '#78350f', primaryLight: '#92400e', primaryDark: '#451a03', darkBg: '#0a0500', darkSurface: '#170b01', darkBorder: '#451a03', darkText: '#fef3c7', darkMuted: '#d97706', lightBg: '#fffbeb', lightSurface: '#fef3c7', lightBorder: '#fde68a', lightText: '#451a03', lightMuted: '#92400e' },
    { id: 'chocolate', name: 'Chocolate', category: 'Earthy', emoji: '🍫', primary: '#6b3a2a', primaryLight: '#8b4c3a', primaryDark: '#4a1e14', darkBg: '#080302', darkSurface: '#130805', darkBorder: '#3a1208', darkText: '#fdf4f0', darkMuted: '#b98074', lightBg: '#fdf4f0', lightSurface: '#f8e4dd', lightBorder: '#ead0c8', lightText: '#3a1208', lightMuted: '#8b4c3a' },
    { id: 'caramel', name: 'Caramel', category: 'Earthy', emoji: '🍮', primary: '#b45309', primaryLight: '#d97706', primaryDark: '#92400e', darkBg: '#0d0700', darkSurface: '#1c1002', darkBorder: '#78350f', darkText: '#fef3c7', darkMuted: '#fde68a', lightBg: '#fffbeb', lightSurface: '#fef3c7', lightBorder: '#fde68a', lightText: '#451a03', lightMuted: '#b45309' },
    { id: 'sand', name: 'Sand', category: 'Earthy', emoji: '🏜️', primary: '#ca8a04', primaryLight: '#eab308', primaryDark: '#a16207', darkBg: '#0c0900', darkSurface: '#1c1600', darkBorder: '#713f12', darkText: '#fefce8', darkMuted: '#fde047', lightBg: '#fefce8', lightSurface: '#fef9c3', lightBorder: '#fef08a', lightText: '#422006', lightMuted: '#ca8a04' },
    { id: 'walnut', name: 'Walnut', category: 'Earthy', emoji: '🥜', primary: '#a16207', primaryLight: '#ca8a04', primaryDark: '#854d0e', darkBg: '#0a0700', darkSurface: '#181200', darkBorder: '#78350f', darkText: '#fef9c3', darkMuted: '#fde047', lightBg: '#fefce8', lightSurface: '#fef9c3', lightBorder: '#fef08a', lightText: '#3f2a00', lightMuted: '#a16207' },

    // ── PASTEL ────────────────────────────────────────────────────────────────
    { id: 'pastel-blue', name: 'Pastel Blue', category: 'Pastel', emoji: '🦋', primary: '#7dd3fc', primaryLight: '#bae6fd', primaryDark: '#38bdf8', darkBg: '#040c14', darkSurface: '#0a1a24', darkBorder: '#1e3a8a', darkText: '#e0f2fe', darkMuted: '#7dd3fc', lightBg: '#f0f9ff', lightSurface: '#e0f2fe', lightBorder: '#bae6fd', lightText: '#0c4a6e', lightMuted: '#0284c7' },
    { id: 'pastel-pink', name: 'Pastel Pink', category: 'Pastel', emoji: '🌸', primary: '#f9a8d4', primaryLight: '#fbcfe8', primaryDark: '#f472b6', darkBg: '#0a0208', darkSurface: '#180510', darkBorder: '#9d174d', darkText: '#fdf2f8', darkMuted: '#f9a8d4', lightBg: '#fdf2f8', lightSurface: '#fce7f3', lightBorder: '#fbcfe8', lightText: '#831843', lightMuted: '#be185d' },
    { id: 'pastel-green', name: 'Pastel Green', category: 'Pastel', emoji: '🌿', primary: '#86efac', primaryLight: '#bbf7d0', primaryDark: '#4ade80', darkBg: '#030a04', darkSurface: '#071510', darkBorder: '#166534', darkText: '#dcfce7', darkMuted: '#86efac', lightBg: '#f0fdf4', lightSurface: '#dcfce7', lightBorder: '#bbf7d0', lightText: '#14532d', lightMuted: '#22c55e' },
    { id: 'pastel-purple', name: 'Pastel Purple', category: 'Pastel', emoji: '🫐', primary: '#c4b5fd', primaryLight: '#ddd6fe', primaryDark: '#a78bfa', darkBg: '#060310', darkSurface: '#0e0b20', darkBorder: '#3b0764', darkText: '#f5f3ff', darkMuted: '#c4b5fd', lightBg: '#f5f3ff', lightSurface: '#ede9fe', lightBorder: '#ddd6fe', lightText: '#2e1065', lightMuted: '#7c3aed' },
    { id: 'pastel-yellow', name: 'Pastel Yellow', category: 'Pastel', emoji: '🌻', primary: '#fde68a', primaryLight: '#fef3c7', primaryDark: '#fbbf24', darkBg: '#0c0900', darkSurface: '#1a1300', darkBorder: '#713f12', darkText: '#fef9c3', darkMuted: '#fde047', lightBg: '#fefce8', lightSurface: '#fef9c3', lightBorder: '#fef08a', lightText: '#1a1300', lightMuted: '#ca8a04' },
    { id: 'pastel-orange', name: 'Pastel Orange', category: 'Pastel', emoji: '🍑', primary: '#fdba74', primaryLight: '#fed7aa', primaryDark: '#fb923c', darkBg: '#0d0700', darkSurface: '#1c1002', darkBorder: '#7c2d12', darkText: '#ffedd5', darkMuted: '#fdba74', lightBg: '#fff7ed', lightSurface: '#ffedd5', lightBorder: '#fed7aa', lightText: '#431407', lightMuted: '#ea580c' },
    { id: 'candy', name: 'Candy', category: 'Pastel', emoji: '🍭', primary: '#fb7185', primaryLight: '#fda4af', primaryDark: '#f43f5e', darkBg: '#0d0106', darkSurface: '#1a020c', darkBorder: '#881337', darkText: '#ffe4e6', darkMuted: '#fda4af', lightBg: '#fff1f2', lightSurface: '#ffe4e6', lightBorder: '#fecdd3', lightText: '#4c0519', lightMuted: '#e11d48' },
    { id: 'cotton-candy', name: 'Cotton Candy', category: 'Pastel', emoji: '🎀', primary: '#f472b6', primaryLight: '#f9a8d4', primaryDark: '#ec4899', darkBg: '#0a0208', darkSurface: '#180510', darkBorder: '#831843', darkText: '#fce7f3', darkMuted: '#f9a8d4', lightBg: '#fdf2f8', lightSurface: '#fce7f3', lightBorder: '#fbcfe8', lightText: '#500724', lightMuted: '#db2777' },

    // ── SPECIAL & UNIQUE ──────────────────────────────────────────────────────
    { id: 'gold', name: 'Gold', category: 'Special', emoji: '🏆', primary: '#f59e0b', primaryLight: '#fcd34d', primaryDark: '#d97706', darkBg: '#0a0800', darkSurface: '#1a1400', darkBorder: '#78350f', darkText: '#fef9c3', darkMuted: '#fcd34d', lightBg: '#fffbeb', lightSurface: '#fef3c7', lightBorder: '#fde68a', lightText: '#451a03', lightMuted: '#d97706' },
    { id: 'diamond', name: 'Diamond', category: 'Special', emoji: '💠', primary: '#38bdf8', primaryLight: '#7dd3fc', primaryDark: '#0ea5e9', darkBg: '#020c14', darkSurface: '#041828', darkBorder: '#075985', darkText: '#e0f7ff', darkMuted: '#7dd3fc', lightBg: '#f0f9ff', lightSurface: '#e0f2fe', lightBorder: '#7dd3fc', lightText: '#0c4a6e', lightMuted: '#0284c7' },
    { id: 'ruby', name: 'Ruby', category: 'Special', emoji: '♦️', primary: '#e11d48', primaryLight: '#f43f5e', primaryDark: '#be123c', darkBg: '#0f0106', darkSurface: '#1c0210', darkBorder: '#9f1239', darkText: '#ffe4e6', darkMuted: '#fda4af', lightBg: '#fff1f2', lightSurface: '#ffe4e6', lightBorder: '#fecdd3', lightText: '#4c0519', lightMuted: '#e11d48' },
    { id: 'obsidian', name: 'Obsidian', category: 'Special', emoji: '🌑', primary: '#1e1b4b', primaryLight: '#312e81', primaryDark: '#0f0e24', darkBg: '#000000', darkSurface: '#050510', darkBorder: '#1e1b4b', darkText: '#e0e7ff', darkMuted: '#818cf8', lightBg: '#eef2ff', lightSurface: '#e0e7ff', lightBorder: '#c7d2fe', lightText: '#1e1b4b', lightMuted: '#6366f1' },
    { id: 'arctic-fox', name: 'Arctic Fox', category: 'Special', emoji: '🦊', primary: '#0891b2', primaryLight: '#22d3ee', primaryDark: '#0e7490', darkBg: '#010c12', darkSurface: '#0a1c24', darkBorder: '#155e75', darkText: '#cffafe', darkMuted: '#67e8f9', lightBg: '#ecfeff', lightSurface: '#cffafe', lightBorder: '#a5f3fc', lightText: '#164e63', lightMuted: '#0891b2' },
    { id: 'peacock', name: 'Peacock', category: 'Special', emoji: '🦚', primary: '#0d9488', primaryLight: '#14b8a6', primaryDark: '#0f766e', darkBg: '#020d0c', darkSurface: '#061c1a', darkBorder: '#134e4a', darkText: '#ccfbf1', darkMuted: '#5eead4', lightBg: '#f0fdfa', lightSurface: '#ccfbf1', lightBorder: '#99f6e4', lightText: '#022c22', lightMuted: '#0d9488' },
    { id: 'phoenix', name: 'Phoenix', category: 'Special', emoji: '🔥', primary: '#dc2626', primaryLight: '#f97316', primaryDark: '#c2410c', darkBg: '#0d0200', darkSurface: '#1a0500', darkBorder: '#7c2d12', darkText: '#fef3c7', darkMuted: '#fb923c', lightBg: '#fff7ed', lightSurface: '#ffedd5', lightBorder: '#fed7aa', lightText: '#431407', lightMuted: '#ea580c' },
    { id: 'chameleon', name: 'Chameleon', category: 'Special', emoji: '🦎', primary: '#84cc16', primaryLight: '#a3e635', primaryDark: '#65a30d', darkBg: '#040801', darkSurface: '#0c1603', darkBorder: '#365314', darkText: '#ecfccb', darkMuted: '#bef264', lightBg: '#f7fee7', lightSurface: '#ecfccb', lightBorder: '#d9f99d', lightText: '#1a2e05', lightMuted: '#65a30d' },
    { id: 'hummingbird', name: 'Hummingbird', category: 'Special', emoji: '🐦', primary: '#0ea5e9', primaryLight: '#38bdf8', primaryDark: '#0284c7', darkBg: '#010c18', darkSurface: '#051824', darkBorder: '#075985', darkText: '#e0f7ff', darkMuted: '#7dd3fc', lightBg: '#f0f9ff', lightSurface: '#e0f2fe', lightBorder: '#bae6fd', lightText: '#082f49', lightMuted: '#0284c7' },
    { id: 'galaxy-black', name: 'Galaxy Black', category: 'Special', emoji: '🌠', primary: '#818cf8', primaryLight: '#a5b4fc', primaryDark: '#6366f1', darkBg: '#000005', darkSurface: '#050510', darkBorder: '#1e1b4b', darkText: '#e0e7ff', darkMuted: '#a5b4fc', lightBg: '#eef2ff', lightSurface: '#e0e7ff', lightBorder: '#c7d2fe', lightText: '#1e1b4b', lightMuted: '#4f46e5' },

    // ── India Specific ────────────────────────────────────────────────────────
    { id: 'tricolor', name: 'Tricolor', category: 'India', emoji: '🇮🇳', primary: '#ff9933', primaryLight: '#ffb366', primaryDark: '#e68500', darkBg: '#0a0500', darkSurface: '#140a00', darkBorder: '#004b23', darkText: '#ffffff', darkMuted: '#80b3ff', lightBg: '#ffffff', lightSurface: '#f5f5f5', lightBorder: '#e0e0e0', lightText: '#000080', lightMuted: '#004b23' },
    { id: 'saffron', name: 'Saffron', category: 'India', emoji: '🌼', primary: '#ff9500', primaryLight: '#ffbb00', primaryDark: '#e67e00', darkBg: '#0d0700', darkSurface: '#1c1100', darkBorder: '#7c2d00', darkText: '#fff3e0', darkMuted: '#ffbb00', lightBg: '#fff8e1', lightSurface: '#fff3e0', lightBorder: '#ffcc80', lightText: '#e65100', lightMuted: '#ff9500' },
    { id: 'peacock-blue', name: 'Peacock Blue', category: 'India', emoji: '🦚', primary: '#006994', primaryLight: '#1e90c8', primaryDark: '#004f6f', darkBg: '#020c14', darkSurface: '#04182a', darkBorder: '#003655', darkText: '#e0f4ff', darkMuted: '#5bb3e0', lightBg: '#e8f6ff', lightSurface: '#cceeff', lightBorder: '#99d6ff', lightText: '#003355', lightMuted: '#006994' },
    { id: 'mehndi', name: 'Mehndi', category: 'India', emoji: '🪷', primary: '#6b8c21', primaryLight: '#8ab228', primaryDark: '#4d6518', darkBg: '#060800', darkSurface: '#0e1400', darkBorder: '#2d4008', darkText: '#e8f5c8', darkMuted: '#a5c842', lightBg: '#f2f9e6', lightSurface: '#e6f2cc', lightBorder: '#c5e080', lightText: '#2d4008', lightMuted: '#6b8c21' },
];

export const THEME_CATEGORIES = [...new Set(ALL_THEMES.map(t => t.category))];

interface ThemeState {
    themeId: string;
    mode: ThemeMode;
    currentTheme: Theme;
    setTheme: (id: string) => void;
    setMode: (mode: ThemeMode) => void;
    toggleMode: () => void;
    // Compat helpers
    colorScheme: string;
    setColorScheme: (scheme: string) => void;
}

function getThemeById(id: string): Theme {
    return ALL_THEMES.find(t => t.id === id) || ALL_THEMES[0];
}

function applyTheme(theme: Theme, mode: ThemeMode) {
    const root = document.documentElement;
    if (mode === 'dark') {
        root.style.setProperty('--color-primary', theme.primary);
        root.style.setProperty('--color-primary-light', theme.primaryLight);
        root.style.setProperty('--color-primary-dark', theme.primaryDark);
        root.style.setProperty('--color-background', theme.darkBg);
        root.style.setProperty('--color-surface', theme.darkSurface);
        root.style.setProperty('--color-border', theme.darkBorder);
        root.style.setProperty('--color-text', theme.darkText);
        root.style.setProperty('--color-text-muted', theme.darkMuted);
    } else {
        root.style.setProperty('--color-primary', theme.primary);
        root.style.setProperty('--color-primary-light', theme.primaryLight);
        root.style.setProperty('--color-primary-dark', theme.primaryDark);
        root.style.setProperty('--color-background', theme.lightBg);
        root.style.setProperty('--color-surface', theme.lightSurface);
        root.style.setProperty('--color-border', theme.lightBorder);
        root.style.setProperty('--color-text', theme.lightText);
        root.style.setProperty('--color-text-muted', theme.lightMuted);
    }
    root.setAttribute('data-theme', mode);
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            themeId: 'ocean-blue',
            mode: 'dark' as ThemeMode,
            currentTheme: ALL_THEMES[0],
            colorScheme: 'ocean-blue', // compat

            setTheme: (id) => {
                const theme = getThemeById(id);
                set({ themeId: id, currentTheme: theme, colorScheme: id });
                applyTheme(theme, get().mode);
            },

            setMode: (mode) => {
                set({ mode });
                applyTheme(get().currentTheme, mode);
            },

            toggleMode: () => {
                const newMode = get().mode === 'dark' ? 'light' : 'dark';
                get().setMode(newMode);
            },

            // Compat
            setColorScheme: (scheme) => {
                get().setTheme(scheme);
            },
        }),
        {
            name: 'theme-store-v2',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    const theme = getThemeById(state.themeId);
                    applyTheme(theme, state.mode);
                }
            }
        }
    )
);
