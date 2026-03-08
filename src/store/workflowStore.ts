import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WorkflowStep {
    id: string;
    roleId: string; // Which role needs to approve this step (e.g., 'MANAGER', 'HR')
    roleName: string;
    stepOrder: number;
}

export interface WorkflowConfig {
    id: string;
    module: 'leave' | 'loan' | 'payroll';
    name: string;
    isActive: boolean;
    steps: WorkflowStep[];
}

interface WorkflowState {
    workflows: WorkflowConfig[];

    // Actions
    addWorkflow: (workflow: Omit<WorkflowConfig, 'id'>) => void;
    updateWorkflow: (id: string, workflow: Partial<WorkflowConfig>) => void;
    deleteWorkflow: (id: string) => void;
    toggleWorkflow: (id: string) => void;
    getWorkflowByModule: (module: 'leave' | 'loan' | 'payroll') => WorkflowConfig | undefined;
}

export const useWorkflowStore = create<WorkflowState>()(
    persist(
        (set, get) => ({
            workflows: [
                {
                    id: 'w-leave-1',
                    module: 'leave',
                    name: 'Standard Leave Approval',
                    isActive: false,
                    steps: [
                        { id: 's1', roleId: 'MANAGER', roleName: 'Manager', stepOrder: 1 },
                        { id: 's2', roleId: 'HR', roleName: 'HR', stepOrder: 2 },
                    ]
                },
                {
                    id: 'w-loan-1',
                    module: 'loan',
                    name: 'Loan Approval Hierarchy',
                    isActive: false,
                    steps: [
                        { id: 's1', roleId: 'HR', roleName: 'HR', stepOrder: 1 },
                        { id: 's2', roleId: 'SUPER_ADMIN', roleName: 'Super Admin', stepOrder: 2 },
                    ]
                }
            ],

            addWorkflow: (workflow) => set((state) => ({
                workflows: [...state.workflows, { ...workflow, id: `w-${Date.now()}` }]
            })),

            updateWorkflow: (id, data) => set((state) => ({
                workflows: state.workflows.map(w => w.id === id ? { ...w, ...data } : w)
            })),

            deleteWorkflow: (id) => set((state) => ({
                workflows: state.workflows.filter(w => w.id !== id)
            })),

            toggleWorkflow: (id) => set((state) => ({
                workflows: state.workflows.map(w =>
                    w.id === id ? { ...w, isActive: !w.isActive } : w
                )
            })),

            getWorkflowByModule: (module) => {
                return get().workflows.find(w => w.module === module && w.isActive);
            }
        }),
        {
            name: 'sm-payroll-workflows',
        }
    )
);
