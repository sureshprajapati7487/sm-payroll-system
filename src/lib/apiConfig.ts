/**
 * apiConfig.ts — API URL resolution
 *
 * Development: Vite proxy handles /api → http://localhost:3000
 * Production (Vercel): VITE_API_URL env var points to Render backend base URL
 *
 * IMPORTANT: Do NOT include /api in VITE_API_URL env var on Vercel.
 * Set it to: https://sm-payroll-system.onrender.com
 * All stores append /api/ themselves: `${API_URL}/api/employees`
 */

// Strip any trailing /api or / from env URL to avoid double /api/api bugs
const rawEnv = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '').replace(/\/$/, '') || '';

export const API_URL: string = rawEnv || '';  // empty = use Vite proxy (/api passes through)

export const getApiUrl = () => API_URL;
