import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/nonce-store";

// Always run fresh; never cache a nonce.
export const dynamic = "force-dynamic";

/**
 * GET /api/nonce
 * Hands the client a one-time value to bind into the World ID proof.
 */
export async function GET() {
  const nonce = issueNonce();
  return NextResponse.json({ nonce });
}
