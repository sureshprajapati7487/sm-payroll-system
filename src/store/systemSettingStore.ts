import { create } from 'zustand';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

interface SystemSettingState {
    settings: Record<string, any>;
    isLoading: boolean;

    fetchSettings: (companyId: string) => Promise<void>;
    updateSetting: (key: string, value: any) => Promise<void>;
}

export const useInternalSystemSettingStore = create<SystemSettingState>((set) => ({
    settings: {},
    isLoading: false,

    fetchSettings: async (companyId) => {
        if (!companyId) return;
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/system-settings?companyId=${companyId}`);
            if (res.ok) {
                const data = await res.json();
                const settingsRecord: Record<string, any> = {};
                for (const item of data) {
                    try {
                        settingsRecord[item.key] = JSON.parse(item.value);
                    } catch {
                        settingsRecord[item.key] = item.value;
                    }
                }
                set({ settings: settingsRecord });
            }
        } catch (error) {
            console.error('Failed to fetch system settings:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    updateSetting: async (key, value) => {
        const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
        if (!currentCompanyId) return;

        // Optimistic update
        set(state => ({
            settings: { ...state.settings, [key]: value }
        }));

        try {
            await apiFetch(`/system-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: currentCompanyId,
                    key,
                    value: typeof value === 'string' ? value : JSON.stringify(value)
                })
            });
        } catch (error) {
            console.error('Failed to save system setting:', error);
        }
    }
}));

export const useSystemSettingStore = () => {
    return useInternalSystemSettingStore();
};
