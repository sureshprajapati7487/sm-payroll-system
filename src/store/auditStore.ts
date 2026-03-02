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
    createSession: (userId: string, ipAddress: string, userAgent: string) => SessionInfo;
    updateSessionActivity: (sessionId: string) => void;
    endSession: (sessionId: string) => void;
    getActiveSession: (userId: string) => SessionInfo | undefined;
    checkSessionExpiry: () => void;

    // IP Restrictions
    addIPRestriction: (restriction: Omit<IPRestriction, 'id' | 'createdAt'>) => void;
    removeIPRestriction: (id: string) => void;
    isIPAllowed: (ipAddress: string) => boolean;
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
            createSession: (userId, ipAddress, userAgent) => {
                const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const now = new Date();
                const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours

                const newSession: SessionInfo = {
                    sessionId,
                    userId,
                    loginTime: now.toISOString(),
                    lastActivity: now.toISOString(),
                    ipAddress,
                    userAgent,
                    expiresAt: expiresAt.toISOString(),
                    isActive: true
                };

                set(state => ({
                    sessions: [...state.sessions, newSession]
                }));

                return newSession;
            },

            updateSessionActivity: (sessionId) => {
                set(state => ({
                    sessions: state.sessions.map(s =>
                        s.sessionId === sessionId
                            ? { ...s, lastActivity: new Date().toISOString() }
                            : s
                    )
                }));
            },

            endSession: (sessionId) => {
                set(state => ({
                    sessions: state.sessions.map(s =>
                        s.sessionId === sessionId
                            ? { ...s, isActive: false }
                            : s
                    )
                }));
            },

            getActiveSession: (userId) => {
                return get().sessions.find(s => s.userId === userId && s.isActive);
            },

            checkSessionExpiry: () => {
                const now = new Date().toISOString();
                set(state => ({
                    sessions: state.sessions.map(s =>
                        s.expiresAt < now && s.isActive
                            ? { ...s, isActive: false }
                            : s
                    )
                }));
            },

            // ========== IP RESTRICTIONS ==========
            addIPRestriction: (restriction) => {
                const newRestriction: IPRestriction = {
                    ...restriction,
                    id: `ip-${Date.now()}`,
                    createdAt: new Date().toISOString()
                };

                set(state => ({
                    ipRestrictions: [...state.ipRestrictions, newRestriction]
                }));
            },

            removeIPRestriction: (id) => {
                set(state => ({
                    ipRestrictions: state.ipRestrictions.filter(r => r.id !== id)
                }));
            },

            isIPAllowed: (ipAddress) => {
                const restrictions = get().ipRestrictions;

                // If no restrictions, allow all
                if (restrictions.length === 0) return true;

                // Check whitelist
                const whitelisted = restrictions.filter(r => r.isWhitelisted);
                if (whitelisted.length === 0) return true; // No whitelist = allow all

                // Check if IP is in whitelist
                return whitelisted.some(r => {
                    if (r.ipAddress === ipAddress) return true;
                    if (r.ipRange) {
                        // Simple range check (can be enhanced with proper CIDR matching)
                        return ipAddress.startsWith(r.ipRange.split('/')[0].substring(0, r.ipRange.lastIndexOf('.')));
                    }
                    return false;
                });
            }
        }),
        {
            name: 'audit-store',
            partialize: (state) => ({
                logs: state.logs.slice(0, 5000), // Persist max 5k logs
                sessions: state.sessions.filter(s => s.isActive), // Only active sessions
                ipRestrictions: state.ipRestrictions
            })
        }
    )
);
