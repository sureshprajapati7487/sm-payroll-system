import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from '@/lib/apiClient';

interface KioskDevice {
    id: string; // generated UUID stored in browser localStorage
    name: string; // e.g. "Front Gate Tablet"
    registeredAt: string;
    registeredBy: string; // admin user name
}

interface SecurityState {
    allowedIps: string[];
    kioskDevices: KioskDevice[];
    currentIp: string | null;

    // Config Actions
    addAllowedIp: (ip: string) => void;
    removeAllowedIp: (ip: string) => void;
    registerKioskDevice: (name: string, registeredBy: string) => string; // returns generated ID
    removeKioskDevice: (id: string) => void;

    // IP Fetching Action
    fetchCurrentIp: () => Promise<void>;
}

export const useSecurityStore = create<SecurityState>()(
    persist(
        (set, get) => ({
            allowedIps: ['127.0.0.1', '::1', 'localhost'], // Default safe local IPs
            kioskDevices: [],
            currentIp: null,

            addAllowedIp: (ip) => set({ allowedIps: [...new Set([...get().allowedIps, ip])] }),
            removeAllowedIp: (ip) => set({ allowedIps: get().allowedIps.filter((i) => i !== ip) }),

            registerKioskDevice: (name, registeredBy) => {
                const id = crypto.randomUUID();
                const newDevice: KioskDevice = {
                    id,
                    name,
                    registeredAt: new Date().toISOString(),
                    registeredBy
                };
                set({ kioskDevices: [...get().kioskDevices, newDevice] });
                return id;
            },

            removeKioskDevice: (id) => set({ kioskDevices: get().kioskDevices.filter((d) => d.id !== id) }),

            fetchCurrentIp: async () => {
                try {
                    // Use server-side IP echo — avoids sending user IP to third-party services
                    const res = await apiFetch('/health/ip', { skipAuth: true });
                    if (res.ok) {
                        const data = await res.json();
                        set({ currentIp: data.ip });
                        return;
                    }
                } catch { /* fall through to local fallback */ }
                set({ currentIp: '127.0.0.1' });
            }
        }),
        {
            name: 'security-store',
            partialize: (state) => ({ allowedIps: state.allowedIps, kioskDevices: state.kioskDevices }) // Dont persist currentIp
        }
    )
);
