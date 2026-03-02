# Deployment Guide

This project is a static React Single Page Application (SPA). It can be deployed to any static host.

## Option 1: Vercel / Netlify (Recommended)
1.  Push this code to GitHub.
2.  Import project in Vercel/Netlify.
3.  Build Command: `npm run build`
4.  Output Directory: `dist`
5.  **Important**: Add a rewrite rule for SPA routing.
    - **Netlify**: Create `public/_redirects` file: `/*  /index.html  200`
    - **Vercel**:Auto-handled usually, or add `vercel.json`.

## Option 2: Local Server (IIS / Nginx)
1.  Run `npm run build`.
2.  Copy contents of `dist` folder to your server's root (e.g., `C:\inetpub\wwwroot`).
3.  **Config**: Ensure your server redirects all 404s to `index.html` so React Router works on refresh.

## Option 3: Preview Locally
To test the production build locally:
```bash
npm run build
npm run preview
```
