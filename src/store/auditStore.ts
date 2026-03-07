import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuditLog, AuditAction, SessionInfo, IPRestriction } from '@/types/audit';
import { apiFetch } from '@/lib/apiClient';

interface AuditState {
    logs: AuditLog[];
    sessions: SessionInfo[];
    ipRestrictions: IPRestriction[];
    isFetching: boolean;
    totalCount: number;

    // Audit Log Actions
    addLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
    fetchLogs: (filters?: {
        companyId?: string;
        userId?: string;
        action?: AuditAction;
        entityType?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }) => Promise<void>;
    getLogs: (filters?: {
        userId?: string;
        action?: AuditAction;
        startDate?: string;
        endDate?: string;
        entityType?: string;
    }) => AuditLog[];
    clearOldLogs: (daysToKeep: number) => void;

    // Session Management
    fetchSessions: () => Promise<void>;
    revokeSession: (sessionId: string) => Promise<void>;

    // IP Restrictions
    fetchIPRestrictions: () => Promise<void>;
    addIPRestriction: (restriction: Omit<IPRestriction, 'id' | 'createdAt'>) => Promise<void>;
    removeIPRestriction: (id: string) => Promise<void>;
}

export const useAuditStore = create<AuditState>()(
    persist(
        (set, get) => ({
            logs: [],
            sessions: [],
            ipRestrictions: [],
            isFetching: false,
            totalCount: 0,

            // ========== AUDIT LOGS ==========
            addLog: (log) => {
                const newLog: AuditLog = {
                    ...log,
                    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: new Date().toISOString()
                };

                // Update local state immediately
                set(state => ({
                    logs: [newLog, ...state.logs].slice(0, 10000)
                }));

                // Fire-and-forget POST to backend (non-blocking)
                apiFetch(`/audit-logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newLog)
                }).catch(() => { /* silently fail — local state is always kept */ });

                if (import.meta.env.DEV) console.log('🔍 Audit Log:', newLog);
            },

            fetchLogs: async (filters = {}) => {
                set({ isFetching: true });
                try {
                    const params = new URLSearchParams();
                    if (filters.companyId) params.set('companyId', filters.companyId);
                    if (filters.action) params.set('action', filters.action);
                    if (filters.userId) params.set('userId', filters.userId);
                    if (filters.entityType) params.set('entityType', filters.entityType);
                    if (filters.status) params.set('status', filters.status);
                    if (filters.startDate) params.set('startDate', filters.startDate);
                    if (filters.endDate) params.set('endDate', filters.endDate);
                    if (filters.page) params.set('page', String(filters.page));
                    if (filters.limit) params.set('limit', String(filters.limit));

                    const res = await apiFetch(`/audit-logs?${params.toString()}`);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    set({ logs: data.logs || [], totalCount: data.total || 0, isFetching: false });
                } catch {
                    // Fallback to local store silently
                    set({ isFetching: false });
                }
            },

            getLogs: (filters) => {
                let logs = get().logs;

                if (filters?.userId) {
                    logs = logs.filter(l => l.userId === filters.userId);
                }

                if (filters?.action) {
                    logs = logs.filter(l => l.action === filters.action);
                }

                if (filters?.entityType) {
                    logs = logs.filter(l => l.entityType === filters.entityType);
                }

                if (filters?.startDate) {
                    logs = logs.filter(l => l.timestamp >= filters.startDate!);
                }

                if (filters?.endDate) {
                    logs = logs.filter(l => l.timestamp <= filters.endDate!);
                }

                return logs;
            },

            clearOldLogs: (daysToKeep) => {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
                const cutoffISO = cutoffDate.toISOString();

                set(state => ({
                    logs: state.logs.filter(l => l.timestamp >= cutoffISO)
                }));
            },

            // ========== SESSION MANAGEMENT ==========
            fetchSessions: async () => {
                try {
                    const res = await apiFetch('/sessions');
                    if (res.ok) set({ sessions: await res.json() });
                } catch (e) { console.error('Failed to fetch sessions', e); }
            },

            revokeSession: async (sessionId) => {
                try {
                    const res = await apiFetch(`/sessions/${sessionId}`, { method: 'DELETE' });
                    if (res.ok) {
                        set(state => ({ sessions: state.sessions.filter(s => s.id !== sessionId) }));
                    }
                } catch (e) { console.error('Failed to revoke session', e); }
            },

            // ========== IP RESTRICTIONS ==========
            fetchIPRestrictions: async () => {
                try {
                    const res = await apiFetch('/ip-restrictions');
                    if (res.ok) set({ ipRestrictions: await res.json() });
                } catch (e) { console.error('Failed to fetch IPs', e); }
            },

            addIPRestriction: async (restriction) => {
                try {
                    const res = await apiFetch('/ip-restrictions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(restriction)
                    });
                    if (res.ok) {
                        const newRestriction = await res.json();
                        set(state => ({ ipRestrictions: [...state.ipRestrictions, newRestriction] }));
                    }
                } catch (e) { console.error('Failed to add IP restriction', e); }
            },

            removeIPRestriction: async (id) => {
                try {
                    const res = await apiFetch(`/ip-restrictions/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        set(state => ({ ipRestrictions: state.ipRestrictions.filter(r => r.id !== id) }));
                    }
                } catch (e) { console.error('Failed to remove IP restriction', e); }
            }
        }),
        {
            name: 'audit-store',
            partialize: (state) => ({
                logs: state.logs.slice(0, 5000) // Persist max 5k logs
            })
        }
    )
);
