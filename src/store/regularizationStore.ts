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
    requests: [
        // Mock Data
        {
            id: '1',
            employeeId: 'emp_1', // Assuming this exists or will match check below
            date: new Date().toISOString().split('T')[0],
            type: 'MISSED_PUNCH',
            reason: 'Forgot to punch out yesterday due to rush.',
            status: 'PENDING',
            createdAt: new Date().toISOString()
        }
    ],

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
