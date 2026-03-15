import type { CapacitorConfig } from '@capacitor/cli';

// ──────────────────────────────────────────────────────────────────────────────
// SM PAYROLL — Capacitor Config
//
// 🔧 LOCAL DEV MODE (current):
//   - server.url points to your PC's IP on local network
//   - Change YOUR_PC_IP to the IP shown by `ipconfig` (e.g. 192.168.1.5)
//   - Both PC and phone must be on the same WiFi
//
// 🚀 PRODUCTION MODE (later — when you deploy backend):
//   - Comment out the `server.url` line below
//   - App will use the bundled dist/ files and call your deployed API
// ──────────────────────────────────────────────────────────────────────────────

const IS_PRODUCTION = true; // Set to true to use Production URL and bundled web assets

const config: CapacitorConfig = {
  appId: 'com.smpayroll.app',
  appName: 'SM Payroll',
  webDir: 'dist',

  // ── Server Config ─────────────────────────────────────────────────────────
  server: {
    androidScheme: 'https',
    hostname: 'smpayroll.app',

    // 🔧 LOCAL DEV: Replace with your PC's local IP (run `ipconfig` in cmd)
    // Comment this out for production builds
    ...(IS_PRODUCTION ? {} : {
      url: 'http://YOUR_PC_IP:5173',
      cleartext: true, // Allow HTTP in dev mode
    }),
  },

  // ── Plugin Config ─────────────────────────────────────────────────────────
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#0f172a',       // Dark background (matches app theme)
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },

    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    CapacitorHttp: {
      enabled: true,
    },

    Geolocation: {
      // Permissions requested at runtime — see AndroidManifest.xml
    },

    StatusBar: {
      style: 'DARK',           // Dark text on status bar (light status bar icons)
      backgroundColor: '#0f172a', // Match dark theme
      overlaysWebView: true,   // Let WebView extend under status bar — safe-area-inset-top handles the padding
    },
  },

  // ── Android Specific ──────────────────────────────────────────────────────
  android: {
    allowMixedContent: true, // Required for dev with HTTP backend
    captureInput: true,
    webContentsDebuggingEnabled: true, // Enable Chrome DevTools debugging
  },
};

export default config;
