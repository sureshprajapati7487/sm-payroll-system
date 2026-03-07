import { create } from 'zustand';
import { apiGet } from '@/lib/apiClient';

interface DashboardStats {
    totalStaff: number;
    activeStaff: number;
    attendancePercentage: number;
    presentedCount: number;
    absentToday: number;
    monthProduction: number;
    momChange: number | null;
    totalOutstandingLoans: number;
    activeLoansCount: number;
    pendingLeaves: number;
    pendingProduction: number;
    pendingLoans: number;
    netPayrollThisMonth: number;
    slipsGenerated: number;
    attendanceTrendData: { name: string; present: number; total: number }[];
    productionData: { name: string; units: number }[];
    payrollDistribution: { name: string; value: number }[];
}

interface AnalyticsState {
    stats: DashboardStats | null;
    isLoading: boolean;
    error: string | null;
    fetchDashboardStats: (companyId: string, month: string) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
    stats: null,
    isLoading: false,
    error: null,
    fetchDashboardStats: async (companyId, month) => {
        try {
            set({ isLoading: true, error: null });
            const data = await apiGet<DashboardStats>(`/analytics/dashboard?companyId=${companyId}&month=${month}`);
            set({ stats: data, isLoading: false });
        } catch (error: any) {
            set({ error: error.message || 'Failed to fetch dashboard stats', isLoading: false });
        }
    }
}));
