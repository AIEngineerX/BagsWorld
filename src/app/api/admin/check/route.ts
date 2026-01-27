import { NextRequest, NextResponse } from "next/server";
import { isAdmin, isAdminConfigured } from "@/lib/config";
import { isValidSolanaAddress } from "@/lib/env-utils";

/**
 * GET /api/admin/check?wallet=<address>
 * Check if a wallet has admin privileges (server-side check)
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ isAdmin: false, configured: isAdminConfigured() });
  }

  if (!isValidSolanaAddress(wallet)) {
    return NextResponse.json({ isAdmin: false, configured: isAdminConfigured() });
  }

  return NextResponse.json({
    isAdmin: isAdmin(wallet),
    configured: isAdminConfigured(),
  });
}
