// holidayStore — Server-first with company-wise holidays
import { create } from 'zustand';
import { Holiday } from '@/types';
import { apiFetch } from '@/lib/apiClient';
import { useMultiCompanyStore } from './multiCompanyStore';

interface HolidayState {
    holidays: Holiday[];
    isLoading: boolean;

    fetchHolidays: (year?: number) => Promise<void>;
    addHoliday: (holiday: Omit<Holiday, 'id'>) => Promise<void>;
    updateHoliday: (id: string, updates: Partial<Holiday>) => Promise<void>;
    removeHoliday: (id: string) => Promise<void>;
    bulkImport: (holidays: Omit<Holiday, 'id'>[]) => Promise<void>;
    isHoliday: (date: string) => Holiday | undefined;
    getHolidaysForMonth: (month: string) => Holiday[];
}

export const useHolidayStore = create<HolidayState>((set, get) => ({
    holidays: [],
    isLoading: false,

    // ── Fetch from server ─────────────────────────────────────────────────────
    fetchHolidays: async (year) => {
        set({ isLoading: true });
        try {
            const companyId = useMultiCompanyStore.getState().currentCompanyId;
            const params = new URLSearchParams();
            if (companyId) params.append('companyId', companyId);
            if (year) params.append('year', String(year));
            const res = await apiFetch(`/holidays?${params}`);
            if (res.ok) {
                const data: Holiday[] = await res.json();
                set({ holidays: data });
            }
        } catch (e) {
            console.error('[HolidayStore] fetch failed:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    // ── Add single holiday ────────────────────────────────────────────────────
    addHoliday: async (holiday) => {
        const companyId = useMultiCompanyStore.getState().currentCompanyId;
        const optimistic: Holiday = {
            ...holiday,
            id: `hol-${Date.now()}`,
        };
        set(s => ({ holidays: [...s.holidays, optimistic].sort((a, b) => a.date.localeCompare(b.date)) }));
        try {
            const res = await apiFetch(`/holidays`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...optimistic, companyId }),
            });
            if (res.ok) {
                const saved = await res.json();
                set(s => ({ holidays: s.holidays.map(h => h.id === optimistic.id ? saved : h) }));
            }
        } catch (e) {
            console.error('[HolidayStore] addHoliday failed:', e);
            set(s => ({ holidays: s.holidays.filter(h => h.id !== optimistic.id) }));
        }
    },

    // ── Update holiday ────────────────────────────────────────────────────────
    updateHoliday: async (id, updates) => {
        set(s => ({ holidays: s.holidays.map(h => h.id === id ? { ...h, ...updates } : h) }));
        try {
            await apiFetch(`/holidays/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        } catch (e) {
            console.error('[HolidayStore] updateHoliday failed:', e);
        }
    },

    // ── Remove holiday ────────────────────────────────────────────────────────
    removeHoliday: async (id) => {
        const prev = get().holidays;
        set(s => ({ holidays: s.holidays.filter(h => h.id !== id) }));
        try {
            await apiFetch(`/holidays/${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error('[HolidayStore] removeHoliday failed:', e);
            set({ holidays: prev });
        }
    },

    // ── Bulk import (Indian holidays preload) ─────────────────────────────────
    bulkImport: async (holidays) => {
        const companyId = useMultiCompanyStore.getState().currentCompanyId;
        const withIds = holidays.map(h => ({ ...h, id: `hol-${h.date}-${Math.random().toString(36).substr(2, 5)}` }));
        set(s => {
            const existing = new Set(s.holidays.map(h => h.date));
            const newOnes = withIds.filter(h => !existing.has(h.date));
            return { holidays: [...s.holidays, ...newOnes].sort((a, b) => a.date.localeCompare(b.date)) };
        });
        try {
            await apiFetch(`/holidays/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ holidays: withIds, companyId }),
            });
        } catch (e) {
            console.error('[HolidayStore] bulkImport failed:', e);
        }
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    isHoliday: (date) => get().holidays.find(h => h.date === date),
    getHolidaysForMonth: (month) => get().holidays.filter(h => h.date.startsWith(month)),
}));
