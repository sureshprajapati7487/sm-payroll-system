import { useEffect, useRef } from 'react';
import { useEmployeeStore } from '@/store/employeeStore';
import { useLoanStore } from '@/store/loanStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useProductionStore } from '@/store/productionStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Initial Data Load Hook (Auto-sync DISABLED)
 *
 * ✅ Data loads ONCE when the user logs in.
 * ❌ NO background timer refresh — prevents unsaved form work from being lost.
 * ❌ NO tab-visibility refresh — user stays in control.
 *
 * To manually refresh data, use the individual store fetch methods
 * (e.g., fetchEmployees(), fetchAttendance()) from the relevant page.
 */
export const useDataSync = (_intervalMs = 30000) => {
    const { isAuthenticated } = useAuthStore();
    const { fetchEmployees } = useEmployeeStore();
    const { fetchCompanies } = useMultiCompanyStore();
    const isSyncing = useRef(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        if (isSyncing.current) return;

        // Load data ONCE after login — no recurring timer
        const initialLoad = async () => {
            isSyncing.current = true;
            try {
                await Promise.allSettled([
                    fetchEmployees(),
                    useLoanStore.getState().fetchLoans?.(),
                    useAttendanceStore.getState().fetchAttendance?.(),
                    fetchCompanies(),
                    useProductionStore.getState().fetchProductionEntries?.(),
                ]);
            } catch (error) {
                console.error('[DataSync] Initial load failed:', error);
            } finally {
                isSyncing.current = false;
            }
        };

        initialLoad();

        // NO setInterval, NO visibilitychange listener
        // Data will NOT auto-refresh in the background
    }, [isAuthenticated, fetchEmployees, fetchCompanies]);
};
