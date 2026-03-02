// biometricStore — server-first, localStorage as cache/fallback
// All writes go to server immediately. Reads use localStorage cache for instant load,
// then hydrate from server in the background.

import { apiFetch } from '@/lib/apiClient';

interface ThumbCredential {
    credentialId: string;
    rawId: number[];
}

interface BiometricData {
    thumbCredential?: ThumbCredential | null;
    faceDescriptor?: number[] | null;
    registeredAt?: string;
}

// ── localStorage helpers (used as cache only) ─────────────────────────────────
const LS_KEY = 'sm_biometrics';

function lsLoadAll(): Record<string, BiometricData> {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch { return {}; }
}

function lsSaveEmp(empId: string, data: BiometricData) {
    const all = lsLoadAll();
    all[empId] = data;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function lsClearField(empId: string, field: 'faceDescriptor' | 'thumbCredential') {
    const all = lsLoadAll();
    if (all[empId]) { all[empId][field] = null; localStorage.setItem(LS_KEY, JSON.stringify(all)); }
}

function lsClearEmp(empId: string) {
    const all = lsLoadAll();
    delete all[empId];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
}

// ── Server helpers ─────────────────────────────────────────────────────────────
async function serverGet(empId: string): Promise<BiometricData | null> {
    try {
        const res = await apiFetch(`/biometrics/${empId}`);
        if (res.status === 404) return null;
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

async function serverUpsert(empId: string, update: Partial<BiometricData>): Promise<void> {
    try {
        await apiFetch(`/biometrics/${empId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
        });
    } catch (e) { console.warn('[BiometricStore] Server upsert failed — localStorage-only fallback', e); }
}

async function serverDelete(empId: string, field?: 'face' | 'thumb'): Promise<void> {
    try {
        const path = `/biometrics/${empId}${field ? `/${field}` : ''}`;
        await apiFetch(path, { method: 'DELETE' });
    } catch (e) { console.warn('[BiometricStore] Server delete failed:', e); }
}

// ── Public API ────────────────────────────────────────────────────────────────
export const biometricStore = {

    // ── Hydrate: load from server into localStorage on login ──────────────────
    async hydrate(empId: string): Promise<void> {
        const data = await serverGet(empId);
        if (data) lsSaveEmp(empId, data);
    },

    // ── Thumb (WebAuthn) ──────────────────────────────────────────────────────
    getThumbCredential(empId: string): ThumbCredential | null {
        return lsLoadAll()[empId]?.thumbCredential ?? null;
    },

    async setThumbCredential(empId: string, cred: ThumbCredential): Promise<void> {
        const update: BiometricData = { thumbCredential: cred, registeredAt: new Date().toISOString() };
        const existing = lsLoadAll()[empId] || {};
        lsSaveEmp(empId, { ...existing, ...update });
        await serverUpsert(empId, update); // fire-and-forget
    },

    async clearThumbCredential(empId: string): Promise<void> {
        lsClearField(empId, 'thumbCredential');
        await serverDelete(empId, 'thumb');
    },

    // ── Face ──────────────────────────────────────────────────────────────────
    getFaceDescriptor(empId: string): Float32Array | null {
        const stored = lsLoadAll()[empId]?.faceDescriptor;
        return stored && stored.length ? new Float32Array(stored) : null;
    },

    async setFaceDescriptor(empId: string, descriptor: Float32Array): Promise<void> {
        const arr = Array.from(descriptor);
        const update: BiometricData = { faceDescriptor: arr, registeredAt: new Date().toISOString() };
        const existing = lsLoadAll()[empId] || {};
        lsSaveEmp(empId, { ...existing, ...update });
        await serverUpsert(empId, update); // fire-and-forget
    },

    async clearFaceDescriptor(empId: string): Promise<void> {
        lsClearField(empId, 'faceDescriptor');
        await serverDelete(empId, 'face');
    },

    // ── Utils ─────────────────────────────────────────────────────────────────
    isThumbRegistered(empId: string): boolean {
        return !!(lsLoadAll()[empId]?.thumbCredential);
    },

    isFaceRegistered(empId: string): boolean {
        const fd = lsLoadAll()[empId]?.faceDescriptor;
        return !!(fd && fd.length > 0);
    },

    getRegisteredAt(empId: string): string | null {
        return lsLoadAll()[empId]?.registeredAt ?? null;
    },

    async clearAll(empId: string): Promise<void> {
        lsClearEmp(empId);
        await serverDelete(empId);
    },
};
