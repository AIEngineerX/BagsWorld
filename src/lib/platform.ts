/**
 * Platform detection utilities for iOS/mobile/web branching.
 * Used by wallet adapters, UI components, and deep-link handlers.
 */

/** Check if running inside Capacitor native shell */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor injects this on the window object
  return !!(window as unknown as Record<string, unknown>).Capacitor;
}

/** Check if running on iOS (native or Safari) */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Check if running on Android (native or browser) */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Check if on any mobile device (native or browser) */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** Check if Phantom mobile app is likely installed */
export function isPhantomInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // On mobile web/native, Phantom injects its provider if the in-app browser is used
  const solana = (window as unknown as Record<string, unknown>).solana as
    | { isPhantom?: boolean }
    | undefined;
  return !!solana?.isPhantom;
}

/** Check if we should use deep-link wallet flow (native iOS without injected provider) */
export function shouldUseDeepLink(): boolean {
  return isNativePlatform() && !isPhantomInstalled();
}

/** Build a Phantom deep-link URL for the current platform */
export function getPhantomDeepLinkBase(): string {
  // Universal link works on both iOS and Android
  return "https://phantom.app/ul/v1";
}

/** Get the app's custom URL scheme for callbacks */
export function getCallbackScheme(): string {
  return "bagsworld";
}

/** Build a full callback URL for deep-link returns */
export function buildCallbackUrl(path: string): string {
  return `${getCallbackScheme()}://${path}`;
}
