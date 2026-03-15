import { create } from 'zustand';
import { LeaveRequest, LeaveStatus, NotificationType } from '@/types';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from './authStore';
import { useRolePermissionsStore } from './rolePermissionsStore';
import { useEmployeeStore } from './employeeStore';
import { useWorkflowStore } from './workflowStore';
import { useNotificationStore } from './notificationStore';

interface LeaveState {
    requests: LeaveRequest[];
    isLoading: boolean;

    // Actions
    fetchLeaves: () => Promise<void>;
    requestLeave: (req: Omit<LeaveRequest, 'id' | 'status' | 'appliedOn'>) => Promise<void>;
    approveLeave: (id: string) => Promise<void>;
    rejectLeave: (id: string) => Promise<void>;
    cancelLeave: (id: string) => Promise<void>;
    getLeavesByEmployee: (employeeId: string) => LeaveRequest[];
}

const useInternalLeaveStore = create<LeaveState>((set, get) => ({
    requests: [],
    isLoading: false,

    // ── Fetch from server ─────────────────────────────────────────────────────
    fetchLeaves: async () => {
        const companyId = useMultiCompanyStore.getState().currentCompanyId;
        set({ isLoading: true });
        try {
            const params = companyId ? `?companyId=${companyId}` : '';
            const res = await apiFetch(`/leaves${params}`);
            if (res.ok) {
                const data = await res.json();
                set({ requests: data });
            }
        } catch (e) {
            console.error('[LeaveStore] fetchLeaves failed:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    // ── Request Leave → POST /api/leaves ─────────────────────────────────────
    requestLeave: async (req) => {
        const companyId = useMultiCompanyStore.getState().currentCompanyId;

        // 🛡️ Leave > 15 days Rule: Mandatory 2-step approval
        let workflowApprovals = [];
        if (req.daysCount && req.daysCount > 15) {
            workflowApprovals = [
                { stepId: 's1', roleId: 'MANAGER', roleName: 'Manager', status: 'PENDING' as const },
                { stepId: 's2', roleId: 'ADMIN', roleName: 'Admin', status: 'PENDING' as const },
            ];
        } else {
            // Check if there's an active workflow for 'leave'
            const activeWorkflow = useWorkflowStore.getState().getWorkflowByModule('leave');
            workflowApprovals = activeWorkflow?.steps.map(step => ({
                stepId: step.id,
                roleId: step.roleId,
                roleName: step.roleName,
                status: 'PENDING' as const,
            })) || [];
        }

        const newRequest: LeaveRequest = {
            ...req,
            id: Math.random().toString(36).substr(2, 9),
            companyId: companyId || undefined,
            status: LeaveStatus.PENDING,
            appliedOn: new Date().toISOString().split('T')[0],
            workflowApprovals: workflowApprovals,
            currentWorkflowStep: workflowApprovals.length > 0 ? 0 : undefined,
        };

        // Optimistic update
        set(state => ({ requests: [newRequest, ...state.requests] }));

        try {
            const res = await apiFetch(`/leaves`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRequest),
            });
            if (res.ok) {
                const saved = await res.json();
                // Replace optimistic with server response
                set(state => ({
                    requests: state.requests.map(r => r.id === newRequest.id ? saved : r)
                }));
            }
        } catch (e) {
            console.error('[LeaveStore] requestLeave failed:', e);
            // Rollback on failure
            set(state => ({ requests: state.requests.filter(r => r.id !== newRequest.id) }));
        }

        // ── Notify Managers/Admins about new leave request ────────────────────
        const applicant = useEmployeeStore.getState()._rawEmployees.find(e => e.id === newRequest.employeeId);
        useNotificationStore.getState().addNotification({
            type: NotificationType.LEAVE_REQUEST,
            targetRoles: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
            title: `Leave Request — ${applicant?.name ?? newRequest.employeeId}`,
            message: `${newRequest.type} leave requested from ${newRequest.startDate} to ${newRequest.endDate}${newRequest.reason ? ': ' + newRequest.reason : ''}.`,
            employeeId: newRequest.employeeId,
        });
    },

    // ── Approve → PATCH /api/leaves/:id/approve ──────────────────────────────
    approveLeave: async (id) => {
        const user = useAuthStore.getState().user;
        const leave = get().requests.find(r => r.id === id);

        // Workflow-aware approval
        if (leave?.workflowApprovals && leave.workflowApprovals.length > 0) {
            const stepIdx = leave.currentWorkflowStep ?? 0;
            const updatedApprovals = leave.workflowApprovals.map((a, i) =>
                i === stepIdx
                    ? { ...a, status: 'APPROVED' as const, actorName: user?.name ?? '', actedAt: new Date().toISOString() }
                    : a
            );
            const nextStep = stepIdx + 1;
            const allDone = nextStep >= updatedApprovals.length;

            set(state => ({
                requests: state.requests.map(r =>
                    r.id === id
                        ? {
                            ...r,
                            workflowApprovals: updatedApprovals,
                            currentWorkflowStep: allDone ? undefined : nextStep,
                            status: allDone ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
                        }
                        : r
                )
            }));

            // Persist to server
            try {
                if (allDone) {
                    await apiFetch(`/leaves/${id}/approve`, { method: 'PATCH' });
                } else {
                    // Partial step — just save the workflow progress
                    await apiFetch(`/leaves/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ workflowApprovals: updatedApprovals, currentWorkflowStep: nextStep }),
                    }).catch(() => null); // Non-critical
                }
            } catch (e) {
                console.error('[LeaveStore] approveLeave (workflow) failed:', e);
            }
            return;
        }

        // No workflow — direct approve (original behaviour)
        set(state => ({
            requests: state.requests.map(r =>
                r.id === id ? { ...r, status: LeaveStatus.APPROVED } : r
            )
        }));

        try {
            await apiFetch(`/leaves/${id}/approve`, { method: 'PATCH' });
        } catch (e) {
            console.error('[LeaveStore] approveLeave failed:', e);
            set(state => ({
                requests: state.requests.map(r =>
                    r.id === id ? { ...r, status: LeaveStatus.PENDING } : r
                )
            }));
        }

        // ── Notify employee of the decision ─────────────────────────────────────
        const approvedLeave = get().requests.find(r => r.id === id);
        if (approvedLeave) {
            useNotificationStore.getState().addNotification({
                type: NotificationType.LEAVE_DECISION,
                targetUserIds: [approvedLeave.employeeId],
                title: 'Leave Approved ✅',
                message: `Your ${approvedLeave.type} leave from ${approvedLeave.startDate} to ${approvedLeave.endDate} has been approved.`,
                employeeId: approvedLeave.employeeId,
            });
        }
    },

    // ── Reject → PATCH /api/leaves/:id/reject ───────────────────────────────
    rejectLeave: async (id) => {
        // Optimistic update
        set(state => ({
            requests: state.requests.map(r =>
                r.id === id ? { ...r, status: LeaveStatus.REJECTED } : r
            )
        }));

        try {
            await apiFetch(`/leaves/${id}/reject`, {
                method: 'PATCH',
            });
        } catch (e) {
            console.error('[LeaveStore] rejectLeave failed:', e);
            // Rollback
            set(state => ({
                requests: state.requests.map(r =>
                    r.id === id ? { ...r, status: LeaveStatus.PENDING } : r
                )
            }));
        }

        // ── Notify employee of the decision ─────────────────────────────────────
        const rejectedLeave = get().requests.find(r => r.id === id);
        if (rejectedLeave) {
            useNotificationStore.getState().addNotification({
                type: NotificationType.LEAVE_DECISION,
                targetUserIds: [rejectedLeave.employeeId],
                title: 'Leave Rejected ❌',
                message: `Your ${rejectedLeave.type} leave request from ${rejectedLeave.startDate} to ${rejectedLeave.endDate} was not approved.`,
                employeeId: rejectedLeave.employeeId,
            });
        }
    },

    // ── Cancel (Employee self-cancel) → DELETE /api/leaves/:id ───────────────
    cancelLeave: async (id) => {
        // Optimistic
        set(state => ({ requests: state.requests.filter(r => r.id !== id) }));

        try {
            await apiFetch(`/leaves/${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error('[LeaveStore] cancelLeave failed:', e);
            // Refetch to restore state
            get().fetchLeaves();
        }
    },

    // ── Query helper ──────────────────────────────────────────────────────────
    getLeavesByEmployee: (employeeId) => {
        return get().requests.filter(r => r.employeeId === employeeId);
    }
}));

// ── Exported Hook with Data Visibility Filtering ─────────────────────────────
export const useLeaveStore = () => {
    const store = useInternalLeaveStore();
    const user = useAuthStore(s => s.user);
    const getScope = useRolePermissionsStore(s => s.getScope);

    // We need employee data to know departments for TEAM filtering
    const { _rawStore } = useEmployeeStore();
    const employees = _rawStore?._rawEmployees || [];

    const filteredRequests = store.requests.filter(r => {
        if (!user) return true;

        const scope = getScope(user.role);
        if (scope === 'ALL') return true;

        if (scope === 'TEAM') {
            const userEmp = employees.find((emp: any) => emp.id === user.id);
            const recordEmp = employees.find((emp: any) => emp.id === r.employeeId);
            if (!userEmp?.department) return r.employeeId === user.id; // Fallback to OWN
            return recordEmp?.department === userEmp.department;
        }

        if (scope === 'OWN') return r.employeeId === user.id;

        return false;
    });

    return {
        ...store,
        requests: filteredRequests,
        _rawStore: store
    };
};

useLeaveStore.getState = () => useInternalLeaveStore.getState();
