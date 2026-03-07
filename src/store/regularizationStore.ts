import { create } from 'zustand';
import { RegularizationRequest } from '@/types';

interface RegularizationState {
    requests: RegularizationRequest[];

    // Actions
    addRequest: (req: Omit<RegularizationRequest, 'id' | 'status' | 'createdAt'>) => void;
    updateStatus: (id: string, status: 'APPROVED' | 'REJECTED') => void;
    getPendingRequests: () => RegularizationRequest[];
    getEmployeeRequests: (employeeId: string) => RegularizationRequest[];
}

export const useRegularizationStore = create<RegularizationState>((set, get) => ({
    requests: [],

    addRequest: (req) => {
        const newRequest: RegularizationRequest = {
            ...req,
            id: Math.random().toString(36).substr(2, 9),
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };
        set(state => ({ requests: [newRequest, ...state.requests] }));
    },

    updateStatus: (id, status) => {
        set(state => ({
            requests: state.requests.map(req =>
                req.id === id ? { ...req, status } : req
            )
        }));
    },

    getPendingRequests: () => {
        return get().requests.filter(req => req.status === 'PENDING');
    },

    getEmployeeRequests: (employeeId) => {
        return get().requests.filter(req => req.employeeId === employeeId);
    }
}));
