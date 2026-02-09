/**
 * Environment Utilities Tests
 *
 * Comprehensive tests for env-utils.ts covering:
 * - Environment detection (isProduction / isDevelopment)
 * - Secret management (getRequiredSecret, validateSecretStrength)
 * - Environment variable helpers (getEnvVar, getEnvList)
 * - Solana address validation (isValidSolanaAddress, isValidMintAddress)
 * - Input sanitization (sanitizeString, XSS prevention)
 * - Basis points validation (isValidBps)
 * - URL validation / SSRF protection (validateUrlSafe)
 */

import {
  isProduction,
  isDevelopment,
  getRequiredSecret,
  validateSecretStrength,
  getEnvVar,
  getEnvList,
  isValidSolanaAddress,
  isValidMintAddress,
  sanitizeString,
  isValidBps,
  validateUrlSafe,
} from "@/lib/env-utils";

// ---------------------------------------------------------------------------
// Helpers to manage process.env safely across tests
// ---------------------------------------------------------------------------

/** Keys that our tests might mutate in process.env. */
const ENV_KEYS = [
  "NETLIFY",
  "NETLIFY_DATABASE_URL",
  "NODE_ENV",
  "TEST_SECRET",
  "MY_VAR",
  "MY_LIST",
] as const;

type EnvSnapshot = Record<string, string | undefined>;

function snapshotEnv(): EnvSnapshot {
  const snap: EnvSnapshot = {};
  for (const key of ENV_KEYS) {
    snap[key] = process.env[key];
  }
  return snap;
}

function restoreEnv(snap: EnvSnapshot): void {
  for (const key of ENV_KEYS) {
    if (snap[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snap[key];
    }
  }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("env-utils", () => {
  let envBackup: EnvSnapshot;

  beforeEach(() => {
    envBackup = snapshotEnv();
    // Start each test with a clean slate for the keys we care about
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    restoreEnv(envBackup);
    jest.restoreAllMocks();
  });

  // =========================================================================
  // isProduction / isDevelopment
  // =========================================================================

  describe("isProduction", () => {
    it("returns true when NETLIFY=true", () => {
      process.env.NETLIFY = "true";
      expect(isProduction()).toBe(true);
    });

    it("returns true when NETLIFY_DATABASE_URL is set", () => {
      process.env.NETLIFY_DATABASE_URL = "postgres://host/db";
      expect(isProduction()).toBe(true);
    });

    it("returns true when both NETLIFY and NETLIFY_DATABASE_URL are set", () => {
      process.env.NETLIFY = "true";
      process.env.NETLIFY_DATABASE_URL = "postgres://host/db";
      expect(isProduction()).toBe(true);
    });

    it("returns false when NODE_ENV=production but NETLIFY is not set", () => {
      process.env.NODE_ENV = "production";
      expect(isProduction()).toBe(false);
    });

    it("returns false when no Netlify env vars are present", () => {
      expect(isProduction()).toBe(false);
    });

    it("returns false when NETLIFY is set to a value other than 'true'", () => {
      process.env.NETLIFY = "false";
      expect(isProduction()).toBe(false);
    });
  });

  describe("isDevelopment", () => {
    it("returns true when not on Netlify", () => {
      expect(isDevelopment()).toBe(true);
    });

    it("returns true when NODE_ENV=production but NETLIFY is not set", () => {
      process.env.NODE_ENV = "production";
      expect(isDevelopment()).toBe(true);
    });

    it("returns false when NETLIFY=true", () => {
      process.env.NETLIFY = "true";
      expect(isDevelopment()).toBe(false);
    });

    it("returns false when NETLIFY_DATABASE_URL is set", () => {
      process.env.NETLIFY_DATABASE_URL = "postgres://host/db";
      expect(isDevelopment()).toBe(false);
    });

    it("is always the inverse of isProduction", () => {
      expect(isDevelopment()).toBe(!isProduction());

      process.env.NETLIFY = "true";
      expect(isDevelopment()).toBe(!isProduction());
    });
  });

  // =========================================================================
  // getRequiredSecret
  // =========================================================================

  describe("getRequiredSecret", () => {
    it("returns the env value when the variable is set", () => {
      process.env.TEST_SECRET = "real-secret-value";
      expect(getRequiredSecret("TEST_SECRET", "fallback")).toBe("real-secret-value");
    });

    it("returns the env value even in production when set", () => {
      process.env.NETLIFY = "true";
      process.env.TEST_SECRET = "prod-secret";
      expect(getRequiredSecret("TEST_SECRET", "fallback")).toBe("prod-secret");
    });

    describe("in development mode (no Netlify)", () => {
      it("returns the dev fallback and logs a warning when the env var is not set", () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation();

        const result = getRequiredSecret("TEST_SECRET", "dev-fallback");

        expect(result).toBe("dev-fallback");
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("TEST_SECRET not set")
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("NOT FOR PRODUCTION")
        );
      });
    });

    describe("in production mode (NETLIFY=true)", () => {
      beforeEach(() => {
        process.env.NETLIFY = "true";
      });

      it("throws an error when the env var is not set", () => {
        expect(() => getRequiredSecret("TEST_SECRET", "fallback")).toThrow(
          /SECURITY ERROR.*Missing required environment variable.*TEST_SECRET/
        );
      });

      it("throws an error containing guidance about Netlify env vars", () => {
        expect(() => getRequiredSecret("TEST_SECRET", "fallback")).toThrow(
          /Netlify environment variables/
        );
      });

      it("throws an error containing the openssl generation hint", () => {
        expect(() => getRequiredSecret("TEST_SECRET", "fallback")).toThrow(
          /openssl rand -base64 32/
        );
      });
    });
  });

  // =========================================================================
  // validateSecretStrength
  // =========================================================================

  describe("validateSecretStrength", () => {
    it("does nothing in development mode regardless of value length", () => {
      expect(() => validateSecretStrength("MY_KEY", "short")).not.toThrow();
      expect(() => validateSecretStrength("MY_KEY", "")).not.toThrow();
      expect(() => validateSecretStrength("MY_KEY", "x", 100)).not.toThrow();
    });

    describe("in production mode (NETLIFY=true)", () => {
      beforeEach(() => {
        process.env.NETLIFY = "true";
      });

      it("does not throw when value meets default minimum length (32)", () => {
        const longEnough = "a".repeat(32);
        expect(() => validateSecretStrength("MY_KEY", longEnough)).not.toThrow();
      });

      it("does not throw when value exceeds minimum length", () => {
        const longer = "a".repeat(64);
        expect(() => validateSecretStrength("MY_KEY", longer)).not.toThrow();
      });

      it("throws when value is shorter than default minimum length (32)", () => {
        const tooShort = "a".repeat(31);
        expect(() => validateSecretStrength("MY_KEY", tooShort)).toThrow(
          /SECURITY ERROR.*MY_KEY must be at least 32 characters/
        );
      });

      it("includes current length in error message", () => {
        expect(() => validateSecretStrength("MY_KEY", "abc")).toThrow(
          /Current length: 3/
        );
      });

      it("respects custom minLength parameter", () => {
        expect(() => validateSecretStrength("MY_KEY", "a".repeat(15), 16)).toThrow(
          /at least 16 characters/
        );
        expect(() => validateSecretStrength("MY_KEY", "a".repeat(16), 16)).not.toThrow();
      });

      it("throws for empty string", () => {
        expect(() => validateSecretStrength("MY_KEY", "")).toThrow(/SECURITY ERROR/);
      });
    });
  });

  // =========================================================================
  // getEnvVar
  // =========================================================================

  describe("getEnvVar", () => {
    it("returns the env value when set", () => {
      process.env.MY_VAR = "hello";
      expect(getEnvVar("MY_VAR", "default")).toBe("hello");
    });

    it("returns the default value when env var is not set", () => {
      expect(getEnvVar("MY_VAR", "default")).toBe("default");
    });

    it("returns the default value when env var is empty string", () => {
      process.env.MY_VAR = "";
      expect(getEnvVar("MY_VAR", "default")).toBe("default");
    });
  });

  // =========================================================================
  // getEnvList
  // =========================================================================

  describe("getEnvList", () => {
    it("returns an empty array when env var is not set", () => {
      expect(getEnvList("MY_LIST")).toEqual([]);
    });

    it("splits a comma-separated value into an array", () => {
      process.env.MY_LIST = "a,b,c";
      expect(getEnvList("MY_LIST")).toEqual(["a", "b", "c"]);
    });

    it("trims whitespace from each item", () => {
      process.env.MY_LIST = " a , b , c ";
      expect(getEnvList("MY_LIST")).toEqual(["a", "b", "c"]);
    });

    it("filters out empty entries from trailing commas", () => {
      process.env.MY_LIST = "a,,b,,,c,";
      expect(getEnvList("MY_LIST")).toEqual(["a", "b", "c"]);
    });

    it("filters out whitespace-only entries", () => {
      process.env.MY_LIST = "a, ,b, ,c";
      // After trim, " " becomes "" which is falsy and filtered by Boolean
      expect(getEnvList("MY_LIST")).toEqual(["a", "b", "c"]);
    });

    it("returns an empty array when env var is empty string", () => {
      process.env.MY_LIST = "";
      expect(getEnvList("MY_LIST")).toEqual([]);
    });

    it("handles single-value list", () => {
      process.env.MY_LIST = "only_one";
      expect(getEnvList("MY_LIST")).toEqual(["only_one"]);
    });
  });

  // =========================================================================
  // isValidSolanaAddress / isValidMintAddress
  // =========================================================================

  describe("isValidSolanaAddress", () => {
    // A real-looking base58 address (44 chars, valid base58 charset)
    const VALID_ADDRESS_44 = "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC";
    // System program address (32 chars of "1")
    const VALID_ADDRESS_32 = "11111111111111111111111111111111";

    it("returns true for a valid 44-character base58 address", () => {
      expect(isValidSolanaAddress(VALID_ADDRESS_44)).toBe(true);
    });

    it("returns true for a valid 32-character address", () => {
      expect(isValidSolanaAddress(VALID_ADDRESS_32)).toBe(true);
    });

    it("returns false for an address shorter than 32 characters", () => {
      const tooShort = "1".repeat(31);
      expect(isValidSolanaAddress(tooShort)).toBe(false);
    });

    it("returns false for an address longer than 44 characters", () => {
      const tooLong = "1".repeat(45);
      expect(isValidSolanaAddress(tooLong)).toBe(false);
    });

    it("returns false when address contains invalid base58 character '0'", () => {
      // '0' is not in base58 alphabet
      const withZero = "0" + "1".repeat(43);
      expect(isValidSolanaAddress(withZero)).toBe(false);
    });

    it("returns false when address contains invalid base58 character 'O'", () => {
      const withO = "O" + "1".repeat(43);
      expect(isValidSolanaAddress(withO)).toBe(false);
    });

    it("returns false when address contains invalid base58 character 'I'", () => {
      const withI = "I" + "1".repeat(43);
      expect(isValidSolanaAddress(withI)).toBe(false);
    });

    it("returns false when address contains invalid base58 character 'l'", () => {
      const withL = "l" + "1".repeat(43);
      expect(isValidSolanaAddress(withL)).toBe(false);
    });

    it("returns false for non-string inputs", () => {
      expect(isValidSolanaAddress(null)).toBe(false);
      expect(isValidSolanaAddress(undefined)).toBe(false);
      expect(isValidSolanaAddress(12345)).toBe(false);
      expect(isValidSolanaAddress(true)).toBe(false);
      expect(isValidSolanaAddress({})).toBe(false);
      expect(isValidSolanaAddress([])).toBe(false);
    });

    it("returns false for an empty string", () => {
      expect(isValidSolanaAddress("")).toBe(false);
    });

    it("returns false for a string with spaces", () => {
      expect(isValidSolanaAddress("  " + "1".repeat(40) + "  ")).toBe(false);
    });

    it("returns false for a string with special characters", () => {
      expect(isValidSolanaAddress("abc+def/ghi=" + "1".repeat(30))).toBe(false);
    });
  });

  describe("isValidMintAddress", () => {
    it("is an alias for isValidSolanaAddress", () => {
      expect(isValidMintAddress).toBe(isValidSolanaAddress);
    });

    it("validates mint addresses the same way", () => {
      const validMint = "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC";
      expect(isValidMintAddress(validMint)).toBe(true);
      expect(isValidMintAddress("invalid")).toBe(false);
    });
  });

  // =========================================================================
  // sanitizeString
  // =========================================================================

  describe("sanitizeString", () => {
    it("returns empty string for non-string inputs", () => {
      expect(sanitizeString(null)).toBe("");
      expect(sanitizeString(undefined)).toBe("");
      expect(sanitizeString(123)).toBe("");
      expect(sanitizeString(true)).toBe("");
      expect(sanitizeString({})).toBe("");
      expect(sanitizeString([])).toBe("");
    });

    it("returns the string unchanged when it contains no dangerous content", () => {
      expect(sanitizeString("Hello World")).toBe("Hello World");
    });

    it("trims whitespace from the result", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });

    it("slices to maxLength", () => {
      const long = "a".repeat(2000);
      const result = sanitizeString(long, 100);
      expect(result.length).toBe(100);
    });

    it("uses default maxLength of 1000", () => {
      const long = "a".repeat(1500);
      const result = sanitizeString(long);
      expect(result.length).toBe(1000);
    });

    // XSS payloads
    describe("XSS prevention", () => {
      it("removes <script> tags", () => {
        const result = sanitizeString("<script>alert(1)</script>");
        expect(result).not.toContain("<");
        expect(result).not.toContain(">");
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("</script>");
      });

      it("removes javascript: protocol", () => {
        const result = sanitizeString("javascript:alert(1)");
        expect(result).not.toContain("javascript:");
        // The "alert(1)" part may remain but the dangerous protocol is removed
        expect(result).toBe("alert(1)");
      });

      it("removes JavaScript: protocol (case-insensitive)", () => {
        const result = sanitizeString("JavaScript:alert(1)");
        expect(result).not.toMatch(/javascript:/i);
      });

      it("removes onclick= event handler", () => {
        const result = sanitizeString('onclick=alert(1)');
        expect(result).not.toMatch(/onclick\s*=/i);
      });

      it("removes onerror= event handler", () => {
        const result = sanitizeString('<img src=x onerror=alert(1)>');
        expect(result).not.toMatch(/onerror\s*=/i);
        expect(result).not.toContain("<");
        expect(result).not.toContain(">");
      });

      it("removes onload= event handler", () => {
        const result = sanitizeString('onload=doStuff()');
        expect(result).not.toMatch(/onload\s*=/i);
      });

      it("removes onmouseover= event handler", () => {
        const result = sanitizeString('onmouseover=steal()');
        expect(result).not.toMatch(/onmouseover\s*=/i);
      });

      it("handles combined XSS attack vector", () => {
        const result = sanitizeString(
          '<img src="x" onerror="javascript:alert(document.cookie)">'
        );
        expect(result).not.toContain("<");
        expect(result).not.toContain(">");
        expect(result).not.toMatch(/onerror\s*=/i);
        expect(result).not.toMatch(/javascript:/i);
      });

      it("removes angle brackets from arbitrary HTML", () => {
        const result = sanitizeString("<div><b>bold</b></div>");
        expect(result).not.toContain("<");
        expect(result).not.toContain(">");
      });
    });
  });

  // =========================================================================
  // isValidBps
  // =========================================================================

  describe("isValidBps", () => {
    it("returns true for 0 (minimum boundary)", () => {
      expect(isValidBps(0)).toBe(true);
    });

    it("returns true for 10000 (maximum boundary)", () => {
      expect(isValidBps(10000)).toBe(true);
    });

    it("returns true for a value in the middle of the range", () => {
      expect(isValidBps(5000)).toBe(true);
    });

    it("returns true for 1 (just above minimum)", () => {
      expect(isValidBps(1)).toBe(true);
    });

    it("returns true for 9999 (just below maximum)", () => {
      expect(isValidBps(9999)).toBe(true);
    });

    it("returns false for -1 (below minimum)", () => {
      expect(isValidBps(-1)).toBe(false);
    });

    it("returns false for 10001 (above maximum)", () => {
      expect(isValidBps(10001)).toBe(false);
    });

    it("returns false for 5.5 (non-integer float)", () => {
      expect(isValidBps(5.5)).toBe(false);
    });

    it("returns false for 0.1 (non-integer float)", () => {
      expect(isValidBps(0.1)).toBe(false);
    });

    it('returns false for string "5"', () => {
      expect(isValidBps("5")).toBe(false);
    });

    it("returns false for NaN", () => {
      expect(isValidBps(NaN)).toBe(false);
    });

    it("returns false for Infinity", () => {
      expect(isValidBps(Infinity)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isValidBps(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidBps(undefined)).toBe(false);
    });

    it("returns false for boolean true", () => {
      expect(isValidBps(true)).toBe(false);
    });

    it("respects custom min and max parameters", () => {
      expect(isValidBps(50, 100, 200)).toBe(false);
      expect(isValidBps(100, 100, 200)).toBe(true);
      expect(isValidBps(150, 100, 200)).toBe(true);
      expect(isValidBps(200, 100, 200)).toBe(true);
      expect(isValidBps(201, 100, 200)).toBe(false);
    });
  });

  // =========================================================================
  // validateUrlSafe
  // =========================================================================

  describe("validateUrlSafe", () => {
    describe("valid external URLs", () => {
      it("accepts a standard HTTPS URL", () => {
        const result = validateUrlSafe("https://example.com");
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("accepts an HTTP URL", () => {
        const result = validateUrlSafe("http://example.com");
        expect(result.isValid).toBe(true);
      });

      it("accepts an IPFS URL", () => {
        const result = validateUrlSafe("ipfs:QmSomeHash");
        expect(result.isValid).toBe(true);
      });

      it("accepts URLs with paths and query strings", () => {
        const result = validateUrlSafe("https://api.example.com/v1/data?key=value");
        expect(result.isValid).toBe(true);
      });

      it("accepts a URL with a port number", () => {
        const result = validateUrlSafe("https://example.com:8443/path");
        expect(result.isValid).toBe(true);
      });

      it("accepts a public IP address URL", () => {
        const result = validateUrlSafe("https://8.8.8.8/dns");
        expect(result.isValid).toBe(true);
      });
    });

    describe("invalid URL format", () => {
      it("rejects an invalid URL string", () => {
        const result = validateUrlSafe("not-a-url");
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Invalid URL format");
      });

      it("rejects an empty string", () => {
        const result = validateUrlSafe("");
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Invalid URL format");
      });
    });

    describe("URL length", () => {
      it("rejects URLs longer than default maxLength (2048)", () => {
        const longUrl = "https://example.com/" + "a".repeat(2048);
        const result = validateUrlSafe(longUrl);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("URL too long");
      });

      it("respects custom maxLength option", () => {
        const result = validateUrlSafe("https://example.com/long-path", {
          maxLength: 10,
        });
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("URL too long");
      });
    });

    describe("protocol restrictions", () => {
      it("rejects ftp: protocol", () => {
        const result = validateUrlSafe("ftp://example.com/file");
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("Protocol not allowed");
      });

      it("rejects file: protocol", () => {
        const result = validateUrlSafe("file:///etc/passwd");
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("Protocol not allowed");
      });

      it("rejects javascript: protocol", () => {
        // URL constructor may not parse this, so it may fail as "Invalid URL format"
        const result = validateUrlSafe("javascript:alert(1)");
        expect(result.isValid).toBe(false);
      });

      it("respects custom allowedProtocols", () => {
        const result = validateUrlSafe("http://example.com", {
          allowedProtocols: ["https:"],
        });
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("Protocol not allowed");
      });
    });

    describe("blocked hostnames", () => {
      const blockedHosts = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "[::1]",
        "metadata.google.internal",
        "169.254.169.254",
      ];

      blockedHosts.forEach((host) => {
        it(`rejects blocked hostname: ${host}`, () => {
          // Construct a URL that the URL constructor will parse correctly
          const urlStr =
            host.includes(":") && !host.startsWith("[")
              ? `https://[${host}]/`
              : `https://${host}/`;
          const result = validateUrlSafe(urlStr);
          expect(result.isValid).toBe(false);
        });
      });

      it("rejects metadata.google hostname", () => {
        const result = validateUrlSafe("https://metadata.google/");
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Blocked hostname");
      });
    });

    describe("private IP ranges (SSRF protection)", () => {
      it("rejects 10.x.x.x (Class A private)", () => {
        const result = validateUrlSafe("https://10.0.0.1/internal");
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("Internal IP");
      });

      it("rejects 10.255.255.255 (Class A upper bound)", () => {
        const result = validateUrlSafe("https://10.255.255.255/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 172.16.0.1 (Class B private lower bound)", () => {
        const result = validateUrlSafe("https://172.16.0.1/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 172.31.255.255 (Class B private upper bound)", () => {
        const result = validateUrlSafe("https://172.31.255.255/");
        expect(result.isValid).toBe(false);
      });

      it("allows 172.15.0.1 (below Class B private range)", () => {
        const result = validateUrlSafe("https://172.15.0.1/");
        expect(result.isValid).toBe(true);
      });

      it("allows 172.32.0.1 (above Class B private range)", () => {
        const result = validateUrlSafe("https://172.32.0.1/");
        expect(result.isValid).toBe(true);
      });

      it("rejects 192.168.1.1 (Class C private)", () => {
        const result = validateUrlSafe("https://192.168.1.1/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 192.168.0.0", () => {
        const result = validateUrlSafe("https://192.168.0.0/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 169.254.1.1 (link-local)", () => {
        const result = validateUrlSafe("https://169.254.1.1/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 169.254.169.254 (cloud metadata)", () => {
        const result = validateUrlSafe("https://169.254.169.254/latest/meta-data/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 127.0.0.1 (loopback)", () => {
        const result = validateUrlSafe("https://127.0.0.1/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 127.255.255.255 (loopback range)", () => {
        const result = validateUrlSafe("https://127.255.255.255/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 0.0.0.0 (current network)", () => {
        const result = validateUrlSafe("https://0.0.0.0/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 100.64.0.1 (carrier-grade NAT lower bound)", () => {
        const result = validateUrlSafe("https://100.64.0.1/");
        expect(result.isValid).toBe(false);
      });

      it("rejects 100.127.255.255 (carrier-grade NAT upper bound)", () => {
        const result = validateUrlSafe("https://100.127.255.255/");
        expect(result.isValid).toBe(false);
      });

      it("allows 100.63.255.255 (below carrier-grade NAT range)", () => {
        const result = validateUrlSafe("https://100.63.255.255/");
        expect(result.isValid).toBe(true);
      });

      it("allows 100.128.0.1 (above carrier-grade NAT range)", () => {
        const result = validateUrlSafe("https://100.128.0.1/");
        expect(result.isValid).toBe(true);
      });
    });

    describe("IP-like hostname secondary check", () => {
      it("rejects numeric private IPs even if they bypass pattern matching", () => {
        // The secondary check parses IP octets for private ranges
        const result = validateUrlSafe("https://10.1.2.3/");
        expect(result.isValid).toBe(false);
      });

      it("allows valid public IP addresses", () => {
        const result = validateUrlSafe("https://203.0.113.1/");
        expect(result.isValid).toBe(true);
      });
    });
  });
});
