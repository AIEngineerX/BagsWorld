// Temporary debug endpoint - DELETE AFTER DEBUGGING
import { NextResponse } from "next/server";
import { isProduction, isDevelopment } from "@/lib/env-utils";
import { isAdmin, isAdminConfigured, ECOSYSTEM_CONFIG } from "@/lib/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet");

  return NextResponse.json({
    env: {
      ADMIN_WALLETS: process.env.ADMIN_WALLETS ? "SET" : "NOT SET",
      ADMIN_WALLET: process.env.ADMIN_WALLET ? "SET" : "NOT SET",
      NEXT_PUBLIC_ADMIN_WALLET: process.env.NEXT_PUBLIC_ADMIN_WALLET ? "SET" : "NOT SET",
      NETLIFY: process.env.NETLIFY,
      NODE_ENV: process.env.NODE_ENV,
    },
    detection: {
      isProduction: isProduction(),
      isDevelopment: isDevelopment(),
    },
    admin: {
      configuredWallets: ECOSYSTEM_CONFIG.admin.wallets,
      isAdminConfigured: isAdminConfigured(),
      isWalletAdmin: wallet ? isAdmin(wallet) : "no wallet provided",
    },
  });
}
