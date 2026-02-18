/**
 * Platform Detection Tests
 *
 * Tests all platform utilities with:
 * - SSR (undefined window/navigator) handling
 * - Various user agent strings
 * - Window object detection (Capacitor, Phantom)
 * - Composite function logic (shouldUseDeepLink)
 * - URL building with edge case paths
 */

import {
  isNativePlatform,
  isIOS,
  isAndroid,
  isMobile,
  isPhantomInstalled,
  shouldUseDeepLink,
  buildCallbackUrl,
} from "@/lib/platform";

// Save originals for restoration
const originalNavigator = Object.getOwnPropertyDescriptor(global, "navigator");
const originalWindow = Object.getOwnPropertyDescriptor(global, "window");

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    writable: true,
    configurable: true,
  });
}

describe("isNativePlatform", () => {
  afterEach(() => {
    // Clean up Capacitor from window
    delete (window as unknown as Record<string, unknown>).Capacitor;
  });

  it("returns false when window has no Capacitor property", () => {
    expect(isNativePlatform()).toBe(false);
  });

  it("returns true when Capacitor is present on window", () => {
    (window as unknown as Record<string, unknown>).Capacitor = { platform: "ios" };
    expect(isNativePlatform()).toBe(true);
  });

  it("returns true for truthy Capacitor value (even empty object)", () => {
    (window as unknown as Record<string, unknown>).Capacitor = {};
    expect(isNativePlatform()).toBe(true);
  });

  it("returns false for falsy Capacitor value (empty string)", () => {
    (window as unknown as Record<string, unknown>).Capacitor = "";
    expect(isNativePlatform()).toBe(false);
  });

  it("returns false for Capacitor = 0", () => {
    (window as unknown as Record<string, unknown>).Capacitor = 0;
    expect(isNativePlatform()).toBe(false);
  });

  it("returns false for Capacitor = null", () => {
    (window as unknown as Record<string, unknown>).Capacitor = null;
    expect(isNativePlatform()).toBe(false);
  });
});

describe("isIOS", () => {
  it("returns true for iPhone user agent", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("returns true for iPad user agent", () => {
    setUserAgent("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("returns true for iPod user agent", () => {
    setUserAgent("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("returns false for Android user agent", () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 13; Pixel 7)");
    expect(isIOS()).toBe(false);
  });

  it("returns false for desktop Chrome user agent", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"
    );
    expect(isIOS()).toBe(false);
  });

  it("returns false for desktop macOS Safari (not iPhone/iPad/iPod)", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"
    );
    expect(isIOS()).toBe(false);
  });

  it("is case-insensitive (matches 'iphone')", () => {
    setUserAgent("some browser on iphone device");
    expect(isIOS()).toBe(true);
  });
});

describe("isAndroid", () => {
  it("returns true for Android phone user agent", () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36");
    expect(isAndroid()).toBe(true);
  });

  it("returns true for Android tablet user agent", () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 12; SM-T970)");
    expect(isAndroid()).toBe(true);
  });

  it("returns false for iPhone user agent", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)");
    expect(isAndroid()).toBe(false);
  });

  it("returns false for desktop user agent", () => {
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    expect(isAndroid()).toBe(false);
  });

  it("is case-insensitive (matches 'android')", () => {
    setUserAgent("some browser on android device");
    expect(isAndroid()).toBe(true);
  });
});

describe("isMobile", () => {
  it("returns true for iPhone", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)");
    expect(isMobile()).toBe(true);
  });

  it("returns true for iPad", () => {
    setUserAgent("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)");
    expect(isMobile()).toBe(true);
  });

  it("returns true for iPod", () => {
    setUserAgent("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0)");
    expect(isMobile()).toBe(true);
  });

  it("returns true for Android", () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 13; Pixel 7)");
    expect(isMobile()).toBe(true);
  });

  it("returns false for Windows desktop", () => {
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    expect(isMobile()).toBe(false);
  });

  it("returns false for macOS desktop", () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    expect(isMobile()).toBe(false);
  });

  it("returns false for Linux desktop", () => {
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
    expect(isMobile()).toBe(false);
  });

  it("returns false for empty user agent", () => {
    setUserAgent("");
    expect(isMobile()).toBe(false);
  });
});

describe("isPhantomInstalled", () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).solana;
  });

  it("returns false when window.solana is undefined", () => {
    expect(isPhantomInstalled()).toBe(false);
  });

  it("returns true when window.solana.isPhantom is true", () => {
    (window as unknown as Record<string, unknown>).solana = { isPhantom: true };
    expect(isPhantomInstalled()).toBe(true);
  });

  it("returns false when window.solana exists but isPhantom is false", () => {
    (window as unknown as Record<string, unknown>).solana = { isPhantom: false };
    expect(isPhantomInstalled()).toBe(false);
  });

  it("returns false when window.solana exists but isPhantom is missing", () => {
    (window as unknown as Record<string, unknown>).solana = { someOtherProp: true };
    expect(isPhantomInstalled()).toBe(false);
  });

  it("returns false when window.solana is null", () => {
    (window as unknown as Record<string, unknown>).solana = null;
    expect(isPhantomInstalled()).toBe(false);
  });
});

describe("shouldUseDeepLink", () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).Capacitor;
    delete (window as unknown as Record<string, unknown>).solana;
  });

  it("returns true when native platform and no Phantom", () => {
    (window as unknown as Record<string, unknown>).Capacitor = { platform: "ios" };
    // No solana => no Phantom
    expect(shouldUseDeepLink()).toBe(true);
  });

  it("returns false when native platform but Phantom is installed", () => {
    (window as unknown as Record<string, unknown>).Capacitor = { platform: "ios" };
    (window as unknown as Record<string, unknown>).solana = { isPhantom: true };
    expect(shouldUseDeepLink()).toBe(false);
  });

  it("returns false when web (not native) and no Phantom", () => {
    // No Capacitor
    expect(shouldUseDeepLink()).toBe(false);
  });

  it("returns false when web (not native) and Phantom installed", () => {
    (window as unknown as Record<string, unknown>).solana = { isPhantom: true };
    expect(shouldUseDeepLink()).toBe(false);
  });
});

describe("buildCallbackUrl", () => {
  it("builds URL with simple path", () => {
    expect(buildCallbackUrl("connect")).toBe("bagsworld://connect");
  });

  it("builds URL with nested path", () => {
    expect(buildCallbackUrl("wallet/connect/success")).toBe(
      "bagsworld://wallet/connect/success"
    );
  });

  it("builds URL with empty path", () => {
    expect(buildCallbackUrl("")).toBe("bagsworld://");
  });

  it("builds URL with query parameters in path", () => {
    expect(buildCallbackUrl("callback?status=success&token=abc")).toBe(
      "bagsworld://callback?status=success&token=abc"
    );
  });

  it("builds URL with special characters in path", () => {
    expect(buildCallbackUrl("path/with spaces")).toBe("bagsworld://path/with spaces");
  });
});
