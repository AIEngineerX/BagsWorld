/** Platform detection utilities for iOS/mobile/web branching. */

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as Record<string, unknown>).Capacitor;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isMobile(): boolean {
  return isIOS() || isAndroid();
}

export function isPhantomInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const solana = (window as unknown as Record<string, unknown>).solana as
    | { isPhantom?: boolean }
    | undefined;
  return !!solana?.isPhantom;
}

export function shouldUseDeepLink(): boolean {
  return isNativePlatform() && !isPhantomInstalled();
}

export const PHANTOM_DEEP_LINK_BASE = "https://phantom.app/ul/v1";
export const CALLBACK_SCHEME = "bagsworld";

export function buildCallbackUrl(path: string): string {
  return `${CALLBACK_SCHEME}://${path}`;
}
