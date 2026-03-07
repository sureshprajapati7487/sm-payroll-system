import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Company {
    id: string;
    name: string;
    code: string;
    logo?: string;
    address: string;
    gstNumber?: string;
    panNumber?: string;
    employeeCount: number;
    isActive: boolean;
}

interface MultiCompanyState {
    companies: Company[];
    currentCompanyId: string | null;
    addCompany: (company: Omit<Company, 'id'>) => Promise<Company | null>;
    updateCompany: (id: string, updates: Partial<Company>) => void;
    switchCompany: (id: string) => void;
    getCurrentCompany: () => Company | undefined;
    getAllCompanies: () => Company[];
    getActiveCompanies: () => Company[];
    fetchCompanies: () => Promise<void>;
    isLoading: boolean;
}

import { apiFetch } from '@/lib/apiClient';

// const API_URL = 'http://localhost:3000/api';

export const useMultiCompanyStore = create<MultiCompanyState>()(
    persist(
        (set, get) => ({
            companies: [],
            currentCompanyId: null,
            isLoading: true,

            // Initial Fetch
            fetchCompanies: async () => {
                set({ isLoading: true });
                try {
                    const res = await apiFetch(`/companies`, { skipAuth: true });
                    if (!res.ok) {
                        set({ isLoading: false });
                        return;
                    }
                    const data = await res.json();
                    const companies = Array.isArray(data) ? data : [];

                    // Auto-select first company if none is currently selected
                    const currentId = get().currentCompanyId;
                    const autoSelectId = (!currentId && companies.length > 0) ? companies[0].id : currentId;

                    set({ companies, currentCompanyId: autoSelectId, isLoading: false });
                } catch (error) {
                    console.error('Failed to fetch companies:', error);
                    set({ isLoading: false });
                }
            },

            addCompany: async (company) => {
                try {
                    const newId = `company-${Date.now()}`;
                    const newCompany = { ...company, id: newId };

                    const res = await apiFetch(`/companies`, {
                        method: 'POST',
                        skipAuth: true,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newCompany)
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        console.error('Failed to add company:', err);
                        // Fallback: store locally if server fails
                        set(state => ({
                            companies: [...(Array.isArray(state.companies) ? state.companies : []), newCompany]
                        }));
                        return newCompany as Company;
                    }

                    const savedCompany = await res.json();
                    set(state => ({
                        companies: [...(Array.isArray(state.companies) ? state.companies : []), savedCompany]
                    }));
                    return savedCompany as Company;
                } catch (error) {
                    console.error('Failed to add company:', error);
                    return null;
                }
            },

            updateCompany: async (id, updates) => {
                // Optimistic UI update
                set(state => ({
                    companies: (Array.isArray(state.companies) ? state.companies : []).map(c =>
                        c.id === id ? { ...c, ...updates } : c
                    )
                }));

                // Persist to backend
                try {
                    await apiFetch(`/companies/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updates)
                    });
                } catch (error) {
                    console.error('Failed to update company:', error);
                }
            },

            switchCompany: (id) => {
                const company = get().companies.find(c => c.id === id);
                if (company) { // Removed isActive check for simplicity for now
                    set({ currentCompanyId: id });
                }
            },

            getCurrentCompany: () => {
                const currentId = get().currentCompanyId;
                return get().companies.find(c => c.id === currentId);
            },

            getAllCompanies: () => {
                return get().companies;
            },

            getActiveCompanies: () => {
                return get().companies.filter(c => c.isActive !== false);
            }
        }),
        {
            name: 'multi-company-store',
            partialize: (state) => ({
                currentCompanyId: state.currentCompanyId,
                companies: state.companies,
            })
        }
    )
);

// Initialize Request
// (Self-invoking not ideal inside store file, usually called in App.tsx)

