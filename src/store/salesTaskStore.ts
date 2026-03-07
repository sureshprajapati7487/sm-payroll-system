import { create } from 'zustand';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from './authStore';

export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'canceled';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface SalesTask {
    id: string;
    companyId: string;
    salesmanId: string;
    title: string;
    description?: string;
    dueDate?: string;
    priority: TaskPriority;
    status: TaskStatus;
    createdAt: string;
    completedAt?: string;
}

interface SalesTaskState {
    tasks: SalesTask[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchTasks: () => Promise<void>;
    addTask: (data: Partial<SalesTask>) => Promise<void>;
    updateTask: (id: string, updates: Partial<SalesTask>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
}

export const useSalesTaskStore = create<SalesTaskState>((set, get) => ({
    tasks: [],
    isLoading: false,
    error: null,

    fetchTasks: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) return;

        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch('/api/sales/tasks');
            if (res.ok) {
                const tasks: SalesTask[] = await res.json();
                set({ tasks, isLoading: false });
            } else {
                throw new Error('Failed to fetch tasks');
            }
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch sales tasks', isLoading: false });
            throw err;
        }
    },

    addTask: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch('/api/sales/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                const newTask: SalesTask = await res.json();
                set((state) => ({
                    tasks: [newTask, ...state.tasks],
                    isLoading: false
                }));
            } else {
                throw new Error('Failed to add task');
            }
        } catch (err: any) {
            set({ error: err.message || 'Failed to add task', isLoading: false });
            throw err;
        }
    },

    updateTask: async (id, updates) => {
        // Optimistic update
        const prevTasks = [...get().tasks];
        set((state) => ({
            tasks: state.tasks.map((t) => t.id === id ? { ...t, ...updates } : t)
        }));

        try {
            const res = await apiFetch(`/api/sales/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (res.ok) {
                const savedTask: SalesTask = await res.json();
                // Sync with actual server response (e.g., getting accurate completedAt timestamp)
                set((state) => ({
                    tasks: state.tasks.map((t) => t.id === id ? savedTask : t)
                }));
            } else {
                throw new Error('Failed to update task');
            }
        } catch (err: any) {
            // Revert on failure
            set({ tasks: prevTasks, error: err.message || 'Failed to update task' });
            throw err;
        }
    },

    deleteTask: async (id) => {
        // Optimistic update
        const prevTasks = [...get().tasks];
        set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id)
        }));

        try {
            await apiFetch(`/api/sales/tasks/${id}`, { method: 'DELETE' });
        } catch (err: any) {
            set({ tasks: prevTasks, error: err.message || 'Failed to delete task' });
            throw err;
        }
    }
}));
