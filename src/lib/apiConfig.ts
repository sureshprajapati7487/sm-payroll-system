/**
 * apiConfig.ts — API URL resolution
 *
 * Development: Vite proxy handles /api → http://localhost:3000
 * Production (Vercel): VITE_API_URL env var points to Render backend
 */

// In production, set VITE_API_URL in Vercel Dashboard to your Render URL
// e.g. https://sm-payroll-backend.onrender.com/api
const envUrl = import.meta.env.VITE_API_URL;

export const API_URL: string = envUrl ? `${envUrl}/api` : '/api';

export const getApiUrl = () => API_URL;
