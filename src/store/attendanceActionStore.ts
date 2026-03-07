import { create } from 'zustand';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

export interface AttendanceAction {
    id: string;
    companyId: string;
    key: string;        // PRESENT, ABSENT, HALF_DAY, LATE, etc.
    label: string;      // Display name
    icon: string;       // Emoji icon
    color: string;      // Tailwind color class token
    enabled: boolean;   // Can be turned ON/OFF
    isDefault: boolean; // Default actions can't be deleted, only disabled
}

interface AttendanceActionState {
    attendanceActions: AttendanceAction[];
    isLoading: boolean;

    fetchAttendanceActions: (companyId: string) => Promise<void>;
    addAttendanceAction: (data: Omit<AttendanceAction, 'id' | 'companyId' | 'isDefault'>) => Promise<void>;
    updateAttendanceAction: (id: string, data: Partial<Omit<AttendanceAction, 'id' | 'companyId'>>) => Promise<void>;
    deleteAttendanceAction: (id: string) => Promise<void>;
    toggleAttendanceAction: (id: string) => Promise<void>;
}

const DEFAULT_ACTIONS = [
    { key: 'PRESENT', label: 'Mark Present', icon: '✅', color: 'green', enabled: true, isDefault: true },
    { key: 'ABSENT', label: 'Mark Absent', icon: '❌', color: 'red', enabled: true, isDefault: true },
    { key: 'HALF_DAY', label: 'Half Day', icon: '🌗', color: 'yellow', enabled: true, isDefault: true },
    { key: 'LATE', label: 'Mark Late', icon: '🕐', color: 'orange', enabled: true, isDefault: true },
    { key: 'CLEAR', label: 'Clear Status', icon: '✕', color: 'slate', enabled: true, isDefault: true },
];

export const useInternalAttendanceActionStore = create<AttendanceActionState>((set, get) => ({
    attendanceActions: [],
    isLoading: false,

    fetchAttendanceActions: async (companyId) => {
        if (!companyId) return;
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/attendance-actions?companyId=${companyId}`);
            if (res.ok) {
                let data: AttendanceAction[] = await res.json();

                // Seed defaults if empty
                if (data.length === 0) {
                    const seedPromises = DEFAULT_ACTIONS.map(action =>
                        apiFetch(`/attendance-actions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...action, companyId })
                        }).then(r => r.json())
                    );
                    data = await Promise.all(seedPromises);
                }

                set({ attendanceActions: data });
            }
        } catch (error) {
            console.error('Failed to fetch attendance actions:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addAttendanceAction: async (data) => {
        const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
        if (!currentCompanyId) return;

        try {
            const tempId = `temp-${Date.now()}`;
            const newAction = {
                ...data,
                companyId: currentCompanyId,
                isDefault: false,
                id: tempId
            };

            set(state => ({ attendanceActions: [...state.attendanceActions, newAction as AttendanceAction] }));

            const res = await apiFetch(`/attendance-actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newAction,
                    key: data.key.toUpperCase().replace(/\s+/g, '_')
                })
            });

            if (res.ok) {
                const saved = await res.json();
                set(state => ({
                    attendanceActions: state.attendanceActions.map(a => a.id === tempId ? saved : a)
                }));
            }
        } catch (error) {
            console.error('Failed to add attendance action:', error);
        }
    },

    updateAttendanceAction: async (id, data) => {
        set(state => ({
            attendanceActions: state.attendanceActions.map(a => a.id === id ? { ...a, ...data } : a),
        }));

        try {
            await apiFetch(`/attendance-actions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error('Failed to update attendance action:', error);
        }
    },

    deleteAttendanceAction: async (id) => {
        const action = get().attendanceActions.find(a => a.id === id);
        if (action?.isDefault) return; // Cannot delete defaults

        set(state => ({ attendanceActions: state.attendanceActions.filter(a => a.id !== id) }));

        try {
            await apiFetch(`/attendance-actions/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete attendance action:', error);
        }
    },

    toggleAttendanceAction: async (id) => {
        const action = get().attendanceActions.find(a => a.id === id);
        if (!action) return;

        const newEnabled = !action.enabled;

        set(state => ({
            attendanceActions: state.attendanceActions.map(a =>
                a.id === id ? { ...a, enabled: newEnabled } : a
            )
        }));

        try {
            await apiFetch(`/attendance-actions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled })
            });
        } catch (error) {
            console.error('Failed to toggle attendance action:', error);
        }
    }
}));

export const useAttendanceActionStore = () => {
    const store = useInternalAttendanceActionStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    return {
        ...store,
        attendanceActions: store.attendanceActions.filter(a => a.companyId === currentCompanyId)
    };
};
