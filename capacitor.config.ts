import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bagsworld.app",
  appName: "BagsWorld",
  // Load from remote server — all API routes stay on Netlify
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://bagsworld.app",
    cleartext: false,
    // Allow navigation to wallet deep-link callbacks
    allowNavigation: ["bagsworld.app", "*.bagsworld.app"],
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: false,
    scheme: "bagsworld",
    webContentsDebuggingEnabled: false,
  },
  android: {
    // Require modern WebView for Solana wallet adapter compatibility
    minWebViewVersion: 80,
    webContentsDebuggingEnabled: false,
    buildOptions: {
      // APK required for Solana dApp Store (not AAB)
      releaseType: "APK",
      signingType: "apksigner",
    },
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#0a0a0f",
      showSpinner: false,
      launchFadeOutDuration: 300,
      splashImmersive: true,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0f",
    },
  },
};

export default config;
