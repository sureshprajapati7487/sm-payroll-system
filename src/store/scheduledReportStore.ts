import { create } from 'zustand';
import { apiGet, apiJson } from '@/lib/apiClient';

export interface ScheduledReport {
    id: string;
    name: string;
    reportType: 'payslip' | 'attendance' | 'statutory' | 'custom';
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    recipients: string[];
    enabled: boolean;
    lastRun?: string;
    nextRun: string;
    createdAt: string;
    createdBy: string;
}

interface ScheduledReportState {
    reports: ScheduledReport[];

    // Actions
    fetchReports: () => Promise<void>;
    createScheduledReport: (report: Omit<ScheduledReport, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>) => Promise<void>;
    updateScheduledReport: (id: string, updates: Partial<ScheduledReport>) => Promise<void>;
    deleteScheduledReport: (id: string) => Promise<void>;
    toggleReportStatus: (id: string) => Promise<void>;
    getUpcomingReports: () => ScheduledReport[];
}

export const useScheduledReportStore = create<ScheduledReportState>()(
    (set, get) => ({
        reports: [],

        fetchReports: async () => {
            try {
                const data = await apiGet<ScheduledReport[]>('/reports/schedules');
                set({ reports: data });
            } catch (error) {
                console.error('Failed to fetch scheduled reports:', error);
            }
        },

        createScheduledReport: async (report) => {
            try {
                const nextRun = calculateNextRun(report.frequency, report.dayOfWeek, report.dayOfMonth);
                const payload = { ...report, nextRun };

                const newReport = await apiJson<ScheduledReport>(
                    'POST',
                    '/reports/schedules',
                    payload
                );

                set(state => ({
                    reports: [...state.reports, newReport]
                }));
            } catch (error) {
                console.error('Failed to create scheduled report:', error);
            }
        },

        updateScheduledReport: async (_id, _updates) => {
            console.warn('Backend updateScheduledReport not natively supported, defaulting to toggle or delete/recreate if needed.');
        },

        deleteScheduledReport: async (id) => {
            try {
                await apiJson('DELETE', `/reports/schedules/${id}`);
                set(state => ({
                    reports: state.reports.filter(r => r.id !== id)
                }));
            } catch (error) {
                console.error('Failed to delete scheduled report:', error);
            }
        },

        toggleReportStatus: async (id) => {
            try {
                const res = await apiJson<{ enabled: boolean }>('PATCH', `/reports/schedules/${id}/toggle`);
                set(state => ({
                    reports: state.reports.map(r =>
                        r.id === id ? { ...r, enabled: res.enabled } : r
                    )
                }));
            } catch (error) {
                console.error('Failed to toggle scheduled report:', error);
            }
        },

        getUpcomingReports: () => {
            const now = new Date();
            const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            return get().reports
                .filter(r => r.enabled && r.nextRun && new Date(r.nextRun) <= next24Hours)
                .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime());
        }
    })
);

function calculateNextRun(frequency: string, dayOfWeek?: number, dayOfMonth?: number): string {
    const now = new Date();
    let nextRun = new Date(now);

    if (frequency === 'daily') {
        nextRun.setDate(nextRun.getDate() + 1);
    } else if (frequency === 'weekly' && dayOfWeek !== undefined) {
        nextRun.setDate(nextRun.getDate() + ((7 + dayOfWeek - nextRun.getDay()) % 7 || 7));
    } else if (frequency === 'monthly' && dayOfMonth !== undefined) {
        nextRun.setMonth(nextRun.getMonth() + 1, dayOfMonth);
    }

    nextRun.setHours(9, 0, 0, 0); // Default to 9 AM
    return nextRun.toISOString();
}
