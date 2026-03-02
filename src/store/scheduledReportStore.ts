import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    createScheduledReport: (report: Omit<ScheduledReport, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>) => void;
    updateScheduledReport: (id: string, updates: Partial<ScheduledReport>) => void;
    deleteScheduledReport: (id: string) => void;
    toggleReportStatus: (id: string) => void;
    markReportRun: (id: string) => void;
    getUpcomingReports: () => ScheduledReport[];
}

export const useScheduledReportStore = create<ScheduledReportState>()(
    persist(
        (set, get) => ({
            reports: [],

            createScheduledReport: (report) => {
                const nextRun = calculateNextRun(report.frequency, report.dayOfWeek, report.dayOfMonth);

                const newReport: ScheduledReport = {
                    ...report,
                    id: `sched-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    nextRun
                };

                set(state => ({
                    reports: [...state.reports, newReport]
                }));
            },

            updateScheduledReport: (id, updates) => {
                set(state => ({
                    reports: state.reports.map(r =>
                        r.id === id ? { ...r, ...updates } : r
                    )
                }));
            },

            deleteScheduledReport: (id) => {
                set(state => ({
                    reports: state.reports.filter(r => r.id !== id)
                }));
            },

            toggleReportStatus: (id) => {
                set(state => ({
                    reports: state.reports.map(r =>
                        r.id === id ? { ...r, enabled: !r.enabled } : r
                    )
                }));
            },

            markReportRun: (id) => {
                const report = get().reports.find(r => r.id === id);
                if (!report) return;

                const nextRun = calculateNextRun(report.frequency, report.dayOfWeek, report.dayOfMonth);

                set(state => ({
                    reports: state.reports.map(r =>
                        r.id === id
                            ? {
                                ...r,
                                lastRun: new Date().toISOString(),
                                nextRun
                            }
                            : r
                    )
                }));
            },

            getUpcomingReports: () => {
                const now = new Date();
                const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

                return get().reports
                    .filter(r => r.enabled && new Date(r.nextRun) <= next24Hours)
                    .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime());
            }
        }),
        {
            name: 'scheduled-report-store'
        }
    )
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
