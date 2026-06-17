import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const ACTION_ID = process.env.ACTION_ID as string;

/**
 * POST /api/checkout
 * Header: Authorization: Bearer <session token from /api/verify>
 *
 * This stands in for any sensitive action (login, checkout, posting, voting).
 * It does ZERO World ID work itself. It only trusts the server-signed session.
 * That separation is the point: the human-check happens once, here we just
 * confirm a valid, unexpired, correctly-scoped session exists.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;

  const session = readSession(token);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Human verification required or expired." },
      { status: 401 }
    );
  }

  // Defense in depth: make sure this session was minted for THIS action,
  // not reused from some other flow that happens to share the secret.
  if (session.action !== ACTION_ID) {
    return NextResponse.json(
      { ok: false, error: "Session is not valid for this action." },
      { status: 403 }
    );
  }

  // --- Your real sensitive logic goes here. ---
  // e.g. charge the cart, create the account, cast the vote.
  // You also have session.nullifierHash if you want per-human rate limits.
  return NextResponse.json({
    ok: true,
    message: "Checkout completed. A verified human authorized this action.",
    verifiedHuman: session.nullifierHash.slice(0, 10) + "…",
    expiresInSeconds: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
  });
}
