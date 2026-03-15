import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SecurityAlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SecurityAlertType =
    | 'god_mode_enabled'
    | 'permission_escalation'
    | 'permission_denied'
    | 'role_change'
    | 'salary_access'
    | 'bulk_delete'
    | 'security_setting_change'
    | 'failed_login'
    | 'suspicious_ip'
    | 'data_export'
    | 'access_denied';

export interface SecurityAlert {
    id: string;
    type: SecurityAlertType;
    severity: SecurityAlertSeverity;
    title: string;
    description: string;
    userId: string;
    userName: string;
    timestamp: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
    isRead: boolean;
    isAcknowledged: boolean;
}

interface SecurityAlertsState {
    alerts: SecurityAlert[];
    addAlert: (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'isRead' | 'isAcknowledged'>) => void;
    markAsRead: (id: string) => void;
    acknowledgeAlert: (id: string) => void;
    acknowledgeAll: () => void;
    deleteAlert: (id: string) => void;
    clearOldAlerts: (days: number) => void;
    getUnreadCount: () => number;
    getCriticalCount: () => number;
    getRecentUnacknowledged: (sinceMs?: number) => SecurityAlert[];
}

export const useSecurityAlertsStore = create<SecurityAlertsState>()(
    persist(
        (set, get) => ({
            alerts: [],

            addAlert: (alert) => {
                const newAlert: SecurityAlert = {
                    ...alert,
                    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: new Date().toISOString(),
                    isRead: false,
                    isAcknowledged: false
                };

                set(state => ({
                    alerts: [newAlert, ...state.alerts].slice(0, 1000) // Keep max 1000 alerts
                }));

                // Log critical alerts to console
                if (alert.severity === 'critical' && import.meta.env.DEV) {
                    console.error('🚨 CRITICAL SECURITY ALERT:', newAlert);
                }
            },

            markAsRead: (id) => {
                set(state => ({
                    alerts: state.alerts.map(a =>
                        a.id === id ? { ...a, isRead: true } : a
                    )
                }));
            },

            acknowledgeAlert: (id) => {
                set(state => ({
                    alerts: state.alerts.map(a =>
                        a.id === id ? { ...a, isAcknowledged: true, isRead: true } : a
                    )
                }));
            },

            acknowledgeAll: () => {
                set(state => ({
                    alerts: state.alerts.map(a => ({ ...a, isAcknowledged: true, isRead: true }))
                }));
            },

            deleteAlert: (id) => {
                set(state => ({
                    alerts: state.alerts.filter(a => a.id !== id)
                }));
            },

            clearOldAlerts: (days) => {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
                const cutoffISO = cutoffDate.toISOString();

                set(state => ({
                    alerts: state.alerts.filter(a => a.timestamp >= cutoffISO)
                }));
            },

            getUnreadCount: () => {
                return get().alerts.filter(a => !a.isRead).length;
            },

            getCriticalCount: () => {
                return get().alerts.filter(a => a.severity === 'critical' && !a.isAcknowledged).length;
            },

            getRecentUnacknowledged: (sinceMs = 30000) => {
                const cutoff = new Date(Date.now() - sinceMs).toISOString();
                return get().alerts.filter(
                    a => !a.isAcknowledged && a.timestamp >= cutoff &&
                        (a.severity === 'critical' || a.severity === 'high')
                );
            }
        }),
        {
            name: 'security-alerts-store',
            partialize: (state) => ({
                alerts: state.alerts.slice(0, 500) // Persist max 500 alerts
            })
        }
    )
);
