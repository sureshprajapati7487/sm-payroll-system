/**
 * apiConfig.ts — Central API URL resolver
 *
 * THREE environments:
 *  1. Web Dev  (Vite dev server): '/api'  → Vite proxy → http://localhost:3000
 *  2. Android Dev (Capacitor):    'http://YOUR_PC_IP:3000/api'  (local network)
 *  3. Production (Vercel/Render): 'https://your-backend.com/api'
 *
 * To switch Android to production: set VITE_API_URL in your build env.
 */

import { Capacitor } from '@capacitor/core';

// ── Detect if running inside native Android/iOS app ──────────────────────────
const isNative = Capacitor.isNativePlatform();

// ── Android Dev (Local IP) ─────────────────
// Not used in Production mode

// ── Production URLs (Vercel/Render) ─────────────
const rawEnv = (import.meta.env.VITE_API_URL || 'https://sm-payroll-system.onrender.com').replace(/\/api\/?$/, '').replace(/\/$/, '');
const PROD_API = `${rawEnv}/api`;

// ── Resolution Logic ─────────────────────────────────────────────────────────
export const API_URL: string =
    isNative ? PROD_API : // Android always points to live server now
        (import.meta.env.VITE_API_URL ? PROD_API : '/api'); // Web uses proxy in dev or PROD in prod

export const getApiUrl = () => API_URL;

// ── Helper: full URL for direct fetch calls ────────
export const getServerBaseUrl = (): string => {
    if (isNative) return PROD_API.replace('/api', '');
    if (import.meta.env.VITE_API_URL) return PROD_API.replace('/api', '');
    return 'http://localhost:3000';
};
