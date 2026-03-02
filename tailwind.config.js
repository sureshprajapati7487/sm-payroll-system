/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // ── Theme-reactive colors (powered by CSS variables) ────────────
                // These change instantly when applyTheme() sets --color-* vars
                primary: {
                    50: 'color-mix(in srgb, var(--color-primary) 10%, white)',
                    100: 'color-mix(in srgb, var(--color-primary) 20%, white)',
                    200: 'color-mix(in srgb, var(--color-primary) 40%, white)',
                    300: 'color-mix(in srgb, var(--color-primary) 60%, white)',
                    400: 'var(--color-primary-light)',
                    500: 'var(--color-primary)',
                    600: 'var(--color-primary-dark)',
                    700: 'color-mix(in srgb, var(--color-primary-dark) 80%, black)',
                    800: 'color-mix(in srgb, var(--color-primary-dark) 60%, black)',
                    900: 'color-mix(in srgb, var(--color-primary-dark) 40%, black)',
                },
                dark: {
                    bg: 'var(--color-background)',   // page background
                    card: 'var(--color-surface)',       // card / nav background
                    surface: 'var(--color-surface)',       // alias
                    border: 'var(--color-border)',        // borders
                    text: 'var(--color-text)',          // primary text
                    muted: 'var(--color-text-muted)',    // secondary text
                },
                // ── Fixed utility colors (never theme-reactive) ───────────────
                success: '#10b981',
                warning: '#f59e0b',
                danger: '#ef4444',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}
