import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WorkGroup {
    id: string;
    name: string;       // e.g. "Cutting Unit A", "Stitching Unit B"
    department: string; // e.g. "Production"
    color: string;      // tailwind color token e.g. "blue", "green"
    icon?: string;      // optional emoji
}

interface WorkGroupState {
    groups: WorkGroup[];
    // employeeId → groupId mapping
    assignments: Record<string, string>;

    // Group CRUD
    addGroup: (group: Omit<WorkGroup, 'id'>) => void;
    updateGroup: (id: string, updates: Partial<Omit<WorkGroup, 'id'>>) => void;
    removeGroup: (id: string) => void;

    // Employee assignment
    assignEmployee: (employeeId: string, groupId: string) => void;
    unassignEmployee: (employeeId: string) => void;
    getGroupEmployees: (groupId: string) => string[]; // returns employeeIds
    getEmployeeGroup: (employeeId: string) => WorkGroup | undefined;
}

const COLORS = ['blue', 'emerald', 'violet', 'orange', 'pink', 'cyan', 'yellow', 'rose'];

export const useWorkGroupStore = create<WorkGroupState>()(
    persist(
        (set, get) => ({
            groups: [],
            assignments: {},

            addGroup: (group) => {
                const usedColors = get().groups.map(g => g.color);
                const nextColor = COLORS.find(c => !usedColors.includes(c)) || COLORS[get().groups.length % COLORS.length];
                const newGroup: WorkGroup = {
                    ...group,
                    id: Math.random().toString(36).substr(2, 9),
                    color: group.color || nextColor,
                };
                set(state => ({ groups: [...state.groups, newGroup] }));
            },

            updateGroup: (id, updates) => {
                set(state => ({
                    groups: state.groups.map(g => g.id === id ? { ...g, ...updates } : g),
                }));
            },

            removeGroup: (id) => {
                // Unassign all employees in this group
                const newAssignments = { ...get().assignments };
                Object.entries(newAssignments).forEach(([empId, gId]) => {
                    if (gId === id) delete newAssignments[empId];
                });
                set(state => ({ groups: state.groups.filter(g => g.id !== id), assignments: newAssignments }));
            },

            assignEmployee: (employeeId, groupId) => {
                set(state => ({ assignments: { ...state.assignments, [employeeId]: groupId } }));
            },

            unassignEmployee: (employeeId) => {
                const a = { ...get().assignments };
                delete a[employeeId];
                set({ assignments: a });
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
        }),
        { name: 'sm-work-groups' }
    )
);

// Color config for UI
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
