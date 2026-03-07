import { create } from 'zustand';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

export interface WorkGroup {
    id: string;
    companyId: string;
    name: string;       // e.g. "Cutting Unit A", "Stitching Unit B"
    department: string; // e.g. "Production"
    color: string;      // tailwind color token e.g. "blue", "green"
    icon?: string;      // optional emoji
}

interface WorkGroupState {
    groups: WorkGroup[];
    assignments: Record<string, string>; // employeeId -> groupId
    isLoading: boolean;

    fetchGroups: (companyId: string) => Promise<void>;
    addGroup: (group: Omit<WorkGroup, 'id' | 'companyId'>) => Promise<void>;
    updateGroup: (id: string, updates: Partial<Omit<WorkGroup, 'id' | 'companyId'>>) => Promise<void>;
    removeGroup: (id: string) => Promise<void>;

    assignEmployee: (employeeId: string, groupId: string) => Promise<void>;
    unassignEmployee: (employeeId: string) => Promise<void>;

    getGroupEmployees: (groupId: string) => string[];
    getEmployeeGroup: (employeeId: string) => WorkGroup | undefined;
}

const COLORS = ['blue', 'emerald', 'violet', 'orange', 'pink', 'cyan', 'yellow', 'rose'];

export const useInternalWorkGroupStore = create<WorkGroupState>((set, get) => ({
    groups: [],
    assignments: {},
    isLoading: false,

    fetchGroups: async (companyId) => {
        if (!companyId) return;
        set({ isLoading: true });
        try {
            // Fetch groups
            const res1 = await apiFetch(`/work-groups?companyId=${companyId}`);
            if (res1.ok) {
                const data = await res1.json();
                set({ groups: data });
            }
            // Fetch assignments
            const res2 = await apiFetch(`/work-groups/assignments/all?companyId=${companyId}`);
            if (res2.ok) {
                const map = await res2.json();
                set({ assignments: map });
            }
        } catch (error) {
            console.error('Failed to fetch work groups:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addGroup: async (group) => {
        const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
        if (!currentCompanyId) return;

        try {
            const usedColors = get().groups.map(g => g.color);
            const nextColor = COLORS.find(c => !usedColors.includes(c)) || COLORS[get().groups.length % COLORS.length];
            const newGroup = {
                ...group,
                companyId: currentCompanyId,
                color: group.color || nextColor,
            };

            const tempId = `temp-${Date.now()}`;
            set(state => ({ groups: [...state.groups, { ...newGroup, id: tempId } as WorkGroup] }));

            const res = await apiFetch(`/work-groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newGroup, id: Math.random().toString(36).substr(2, 9) })
            });

            if (res.ok) {
                const saved = await res.json();
                set(state => ({
                    groups: state.groups.map(g => g.id === tempId ? saved : g)
                }));
            }
        } catch (error) {
            console.error('Failed to add group', error);
        }
    },

    updateGroup: async (id, updates) => {
        set(state => ({
            groups: state.groups.map(g => g.id === id ? { ...g, ...updates } : g),
        }));

        try {
            await apiFetch(`/work-groups/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        } catch (error) {
            console.error('Failed to update group:', error);
        }
    },

    removeGroup: async (id) => {
        // Optimistic clean
        const newAssignments = { ...get().assignments };
        Object.entries(newAssignments).forEach(([empId, gId]) => {
            if (gId === id) delete newAssignments[empId];
        });
        set(state => ({ groups: state.groups.filter(g => g.id !== id), assignments: newAssignments }));

        try {
            await apiFetch(`/work-groups/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete group:', error);
        }
    },

    assignEmployee: async (employeeId, groupId) => {
        set(state => ({ assignments: { ...state.assignments, [employeeId]: groupId } }));
        try {
            await apiFetch(`/work-groups/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, groupId })
            });
        } catch (error) {
            console.error('Failed to assign employee', error);
        }
    },

    unassignEmployee: async (employeeId) => {
        const a = { ...get().assignments };
        delete a[employeeId];
        set({ assignments: a });
        try {
            await apiFetch(`/work-groups/unassign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId })
            });
        } catch (error) {
            console.error('Failed to unassign employee', error);
        }
    },

    getGroupEmployees: (groupId) => {
        return Object.entries(get().assignments)
            .filter(([, gId]) => gId === groupId)
            .map(([empId]) => empId);
    },

    getEmployeeGroup: (employeeId) => {
        const groupId = get().assignments[employeeId];
        return groupId ? get().groups.find(g => g.id === groupId) : undefined;
    },
}));

// Provide filtered groups per company, like other stores
export const useWorkGroupStore = () => {
    const store = useInternalWorkGroupStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    const filteredGroups = store.groups.filter(g => g.companyId === currentCompanyId);

    return {
        ...store,
        groups: filteredGroups
    };
};

export const GROUP_COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-300' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', badge: 'bg-violet-500/20 text-violet-300' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', badge: 'bg-orange-500/20 text-orange-300' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30', badge: 'bg-pink-500/20 text-pink-300' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', badge: 'bg-cyan-500/20 text-cyan-300' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-300' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', badge: 'bg-rose-500/20 text-rose-300' },
};
